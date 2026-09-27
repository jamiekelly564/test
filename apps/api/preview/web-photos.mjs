import { createHash } from 'node:crypto';
import { fetchPublic, publicURL, robotsAllow } from '../evidence/download.mjs';

export const PHOTO_LIMITS = Object.freeze({ candidates:12, attempts:8, images:4, perImageBytes:2*1024*1024, totalBytes:8*1024*1024, timeoutMs:45000 });
const clean = (s,n=500) => typeof s === 'string' ? s.replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n) : '';
const key = s => String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const digest = s => createHash('sha256').update(s).digest('hex');

export function photoURL(value) {
  if (typeof value !== 'string' || value.length>1800) return null;
  try {
    const u=publicURL(value);
    // Use publishers' independent photographs, not maps, Street View, or a
    // search engine's image proxy. A search result is not a texture licence.
    if (/(^|\.)(ggpht\.com|googleusercontent\.com|bing\.com|virtualearth\.net|mapbox\.com|maptiler\.com)$/.test(u.hostname)) return null;
    if (/(?:streetview|street-view|maps\/vt|\/tiles\/|\/staticmap)/i.test(u.pathname)) return null;
    if ([...u.searchParams.keys()].some(k=>/^(key|auth|password|secret|token)$/i.test(k))) return null;
    return u.href;
  } catch { return null; }
}
/** Only provider-returned image_result records are eligible. URLs written in
 * generated prose/captions are never promoted to downloadable image inputs. */
export function webImageCandidates(data,{name='',postcode=''}={}) {
  const result=[],seen=new Set();
  for (const call of Array.isArray(data?.output)?data.output:[]) {
    if (call.type!=='web_search_call' || call.status && call.status!=='completed') continue;
    for (const item of (Array.isArray(call.results)?call.results:[]).slice(0,40)) {
      if (item?.type!=='image_result') continue;
      const imageUrl=photoURL(item.image_url),url=photoURL(item.source_website_url);
      if (!imageUrl || !url || seen.has(imageUrl)) continue;
      const description=clean(item.caption), title=clean(item.title,180)||description.slice(0,180)||new URL(url).hostname;
      // These are relevance filters, not proof that the surviving photo is of
      // this property. The vision pass must check the remaining candidates.
      if (/\b(floor ?plans?|bedroom|bathroom|living room|kitchen interior|street ?view|google maps|satellite map|cgi render)\b/i.test(description+' '+title)) continue;
      const hay=key(description+' '+url),nameKey=key(name),postKey=key(postcode);
      const relevance=(postKey && hay.includes(postKey)?50:0)+(nameKey && hay.includes(nameKey)?25:0);
      seen.add(imageUrl);
      result.push({id:'web-photo-'+digest(imageUrl).slice(0,16),title,url,imageUrl,description,relevance,
        provider:'web-image-search',artist:'See original publisher',licence:'Reference only; reuse rights not established',licenceUrl:'',referenceOnly:true});
    }
  }
  return result.sort((a,b)=>b.relevance-a.relevance).slice(0,PHOTO_LIMITS.candidates);
}

/** Read image dimensions without running a decoder on untrusted bytes. */
export function photoType(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length<24 || bytes.length>PHOTO_LIMITS.perImageBytes) return null;
  let mime,width,height;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.subarray(12,16).toString()==='IHDR') {
    mime='image/png';width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
  } else if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) {
    mime='image/jpeg';let at=2;
    for(let n=0;n<1024 && at+4<bytes.length;n++) {
      if(bytes[at++]!==255)break;
      while(bytes[at]===255)at++;
      const marker=bytes[at++];
      if(marker===0xd9 || marker===0xda)break;
      if(marker===0x01 || marker>=0xd0&&marker<=0xd7)continue;
      if(at+2>bytes.length)break;
      const length=bytes.readUInt16BE(at);if(length<2 || at+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length>=8) {height=bytes.readUInt16BE(at+3);width=bytes.readUInt16BE(at+5);break;}
      at+=length;
    }
  } else if(bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP' && bytes.length>=30) {
    mime='image/webp';const chunk=bytes.subarray(12,16).toString();
    if(chunk==='VP8X'){if(bytes[20]&2)return null;width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}
    else if(chunk==='VP8 ' && bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;}
    else if(chunk==='VP8L' && bytes[20]===47){const bits=bytes.readUInt32LE(21);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);}
  }
  if(!mime || !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width,height)<160 || Math.max(width,height)>8192 || width*height>25000000)return null;
  return {mime,width,height};
}

/** Download references only for an explicit research job. No keys, cookies,
 * authentication bypass, arbitrary URL route, permanent photos or textures. */
export function createWebPhotoLoader({request=fetchPublic}={}) {
  return async(candidates,parentSignal)=>{
    const signal=AbortSignal.any([parentSignal,AbortSignal.timeout(PHOTO_LIMITS.timeoutMs)]);
    const policies=new Map(),blocked=new Set(),hashes=new Set(),images=[],attempts=[];let bytesTotal=0;
    async function policy(url) {
      const u=new URL(url);
      if(blocked.has(u.origin))return false;
      if(!policies.has(u.origin)) {
        const r=await request(u.origin+'/robots.txt',{max:256*1024,timeout:8000,signal});
        if(![200,404,410].includes(r.status)){blocked.add(u.origin);return false;}
        const rules=r.status===200?r.bytes.toString('utf8'):'';
        if(r.status===200 && (/^\s*</.test(rules) || r.headers.get('content-type')?.includes('html'))){blocked.add(u.origin);return false;}
        policies.set(u.origin,rules);
      }
      return robotsAllow(policies.get(u.origin),u.pathname+u.search);
    }
    for(const candidate of candidates.slice(0,PHOTO_LIMITS.attempts)) {
      if(images.length>=PHOTO_LIMITS.images || bytesTotal>=PHOTO_LIMITS.totalBytes)break;
      parentSignal.throwIfAborted();
      if(signal.aborted)break;
      const attempt={id:candidate.id,status:'unavailable'};attempts.push(attempt);
      let url=photoURL(candidate.imageUrl),source=photoURL(candidate.url);
      if(!url||!source){attempt.status='unsupported-source';continue;}
      try {
        if(!await policy(source)||!await policy(url)){attempt.status='policy-unavailable';continue;}
        const origin=new URL(url).origin;
        for(let hops=0;hops<3;hops++) {
          if(blocked.has(origin)||!await policy(url)){attempt.status='policy-unavailable';break;}
          const r=await request(url,{max:PHOTO_LIMITS.perImageBytes,timeout:10000,signal});
          if([301,302,303,307,308].includes(r.status)) {
            const next=photoURL(new URL(r.headers.get('location')||'',url).href);
            if(!next||new URL(next).origin!==origin){attempt.status='redirect-not-followed';break;}
            url=next;continue;
          }
          if(r.status!==200){if([401,403,406,429].includes(r.status))blocked.add(origin);attempt.status='host-unavailable';break;}
          if(!['identity','',null].includes(r.headers.get('content-encoding'))){attempt.status='unsupported-image';break;}
          bytesTotal+=r.bytes.length;if(bytesTotal>PHOTO_LIMITS.totalBytes){attempt.status='budget';break;}
          const type=photoType(r.bytes);if(!type){attempt.status='unsupported-image';break;}
          const sha256=digest(r.bytes);if(hashes.has(sha256)){attempt.status='duplicate';break;}
          hashes.add(sha256);images.push({...candidate,imageUrl:url,...type,sha256,bytes:r.bytes});attempt.status='loaded';break;
        }
      } catch {parentSignal.throwIfAborted();attempt.status=signal.aborted?'timeout':'unavailable';}
    }
    return {images,attempts};
  };
}
