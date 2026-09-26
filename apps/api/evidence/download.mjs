import { get } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { HttpError } from '../validation.mjs';

const BOT='PropertyChecked';
const UA='PropertyChecked/0.4 (+https://github.com/jamiekelly564/test; user-approved document import)';
export function publicURL(value){
  let u;try{u=new URL(value);}catch{throw new HttpError(400,'Enter a complete public HTTPS document link.');}
  const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||isIP(h.replace(/[\[\]]/g,''))||!h.includes('.')||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(h))throw new HttpError(400,'Use a public HTTPS hostname, without credentials, IP addresses or custom ports.');
  if(/(^|\.)(google\.[a-z.]+|googleapis\.com|gstatic\.com|goo\.gl)$/.test(h))throw new HttpError(400,'Google Maps links are location references, not permission to import imagery. Supply your own or licensed drawings/photos.');
  if([...u.searchParams.keys()].some(k=>/^(token|access_token|api_?key|signature|sig|credential|x-amz-.+)$/i.test(k)))throw new HttpError(400,'Use a public document link without embedded credentials or signed access tokens.');
  u.hash='';return u;
}
export function publicIPv4(ip){
  if(isIP(ip)!==4)return false;const [a,b,c]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));
}
/** Resolve once, reject non-public answers, pin that IP to the TLS request. */
export async function fetchPublic(value,{max=25*1024*1024,timeout=20000,signal}={}){
  const u=publicURL(value);let addresses;
  try{addresses=await Promise.race([lookup(u.hostname,{all:true,family:4}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('dns')),5000);t.unref();})]);}catch{throw new HttpError(502,'The document host could not be resolved. Download the authorised file yourself and upload it instead.');}
  if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw new HttpError(400,'The document host resolves to a non-public address. Import stopped.');
  const address=addresses[0].address;
  return new Promise((resolve,reject)=>{
    const req=get(u,{agent:false,signal,headers:{'User-Agent':UA,Accept:'application/pdf,image/png,image/jpeg,text/plain;q=0.8','Accept-Encoding':'identity'},lookup:(_host,opts,cb)=>opts.all?cb(null,[{address,family:4}]):cb(null,address,4)},res=>{
      const parts=[];let size=0;
      if(Number(res.headers['content-length'])>max){res.destroy();reject(new HttpError(413,'Remote document exceeds the size limit.'));return;}
      res.on('data',part=>{size+=part.length;if(size>max){res.destroy();reject(new HttpError(413,'Remote response exceeds the size limit.'));}else parts.push(part);});
      res.on('end',()=>resolve({status:res.statusCode,headers:new Headers(Object.entries(res.headers).filter(([,v])=>v!==undefined).map(([k,v])=>[k,Array.isArray(v)?v.join(', '):String(v)])),bytes:Buffer.concat(parts)}));
      res.on('error',()=>reject(new HttpError(502,'Document transfer stopped before completion. No file imported.')));
    });
    const timer=setTimeout(()=>req.destroy(new Error('timeout')),timeout);timer.unref();
    req.on('close',()=>clearTimeout(timer));req.on('error',()=>reject(new HttpError(502,signal?.aborted?'Import cancelled.':'Secure document request failed. Check the link or upload the authorised file instead.')));
  });
}
/** Conservative robots policy: most specific matching agent/rule, allow wins ties. */
export function robotsAllow(text,path){
  const groups=[];let group=null,rules=false;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim(),m=/^([^:]+):(.*)$/.exec(line);if(!m)continue;
    const key=m[1].trim().toLowerCase(),value=m[2].trim();
    if(key==='user-agent'){if(!group||rules){group={agents:[],rules:[]};groups.push(group);rules=false;}group.agents.push(value.toLowerCase());}
    else if(group&&['allow','disallow'].includes(key)){rules=true;if(value)group.rules.push({allow:key==='allow',value});}
  }
  const specificity=g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:BOT.toLowerCase().includes(a)?a.length:-1));
  const best=Math.max(-1,...groups.map(specificity));let winner=null;if(best<0)return true;
  for(const g of groups.filter(g=>specificity(g)===best))for(const rule of g.rules){
    const pattern=rule.value,anchor=pattern.endsWith('$'),body=anchor?pattern.slice(0,-1):pattern;
    const re=new RegExp('^'+body.split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+(anchor?'$':''));
    const length=body.replace(/\*/g,'').length;
    if(re.test(path)&&(!winner||length>winner.length||length===winner.length&&rule.allow))winner={length,allow:rule.allow};
  }
  return !winner||winner.allow;
}
export function fileType(bytes){
  if(bytes.subarray(0,5).toString()==='%PDF-')return {mime:'application/pdf',extension:'.pdf'};
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',extension:'.png'};
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',extension:'.jpg'};
  throw new HttpError(415,'This link is a web page or unsupported file, not a PDF/PNG/JPEG. Open the planning record and supply its direct drawing link, or upload the downloaded file.');
}
export function documentDownloader({request=fetchPublic}={}){
  return async(value,signal)=>{
    let u=publicURL(value);const origin=u.origin;
    // No automatic retries, cookies, login, CAPTCHA solving or cross-host redirects.
    const robots=await request(origin+'/robots.txt',{max:256*1024,signal});
    if(![200,404,410].includes(robots.status))throw new HttpError(502,'The site did not permit an automated policy check. Use its normal download process and upload a file you are authorised to use.');
    const rules=robots.status===200?robots.bytes.toString('utf8'):'';
    if(robots.status===200&&(/^\s*</.test(rules)||robots.headers.get('content-type')?.includes('html')))throw new HttpError(502,'The site returned a policy/login page. Automatic import stopped.');
    for(let redirects=0;redirects<3;redirects++){
      if(!robotsAllow(rules,u.pathname+u.search))throw new HttpError(403,'The site disallows automated retrieval of this document. Download it through the permitted site workflow, then upload only with reuse permission.');
      const result=await request(u.href,{signal});
      if([301,302,303,307,308].includes(result.status)){
        const location=result.headers.get('location');if(!location)break;
        const next=publicURL(new URL(location,u).href);if(next.origin!==origin)throw new HttpError(422,'The document redirects to a different host. Review that final public link and explicitly import it separately.');u=next;continue;
      }
      if(result.status!==200)throw new HttpError(502,`Document host returned HTTP ${result.status}. No retry, mirror or access bypass was attempted. Upload the authorised file instead.`);
      if(!['identity','',null].includes(result.headers.get('content-encoding')))throw new HttpError(415,'The host returned an encoded response. Use a downloaded file instead.');
      if(!result.bytes.length)throw new HttpError(422,'Remote file was empty.');
      return {...fileType(result.bytes),bytes:result.bytes,url:u.href};
    }
    throw new HttpError(422,'The document has too many redirects. Use the final direct file link.');
  };
}
