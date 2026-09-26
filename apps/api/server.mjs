import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join, extname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { openWorkspace } from './database.mjs';
import { createSecurity } from './security.mjs';
import { createAutoService } from './auto-model/service.mjs';
import { ProviderError } from './auto-model/network.mjs';
import { HttpError, buildingInput, normalisePostcode, surveyInput, taskInput, taskPatch, locationPatch, filenameInput, record } from './validation.mjs';
import { tiers, surveyModules, featureStatus } from '../../packages/domain/catalog.mjs';

const ROOT=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const mimeTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
async function readBody(req,max=32000) {
  if(Number(req.headers['content-length'])>max){req.resume();throw new HttpError(413,'File or request is too large.');}
  const parts=[];let bytes=0;
  for await(const part of req){bytes+=part.length;if(bytes>max)throw new HttpError(413,'File or request is too large.');parts.push(part);}
  return Buffer.concat(parts);
}
async function jsonBody(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw new HttpError(415,'Expected application/json.');let input;try{input=JSON.parse((await readBody(req)).toString('utf8'));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid JSON.');}return record(input);}
function send(req,res,status,content,type='application/json; charset=utf-8') {
  const source=Buffer.isBuffer(content)?content:Buffer.from(typeof content==='string'?content:JSON.stringify(content));
  const gzip=source.length>2048&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
  const body=gzip?gzipSync(source):source;
  res.writeHead(status,{'Content-Type':type,'Content-Length':body.length,...(gzip?{'Content-Encoding':'gzip','Vary':'Accept-Encoding'}:{})});res.end(req.method==='HEAD'?undefined:body);
}
async function stream(req,res,path,mime,filename){
  let info;try{info=await stat(path);}catch{throw new HttpError(404,'Local file is missing. Restore the private model pack or upload again.');}
  res.setHeader('Content-Type',mime);res.setHeader('Accept-Ranges','bytes');
  if(filename)res.setHeader('Content-Disposition',`attachment; filename="download${extname(filename).replace(/[^.a-z0-9]/gi,'')}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g,'%27')}`);
  let start=0,end=info.size-1,status=200;
  if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m||(!m[1]&&!m[2]))throw new HttpError(416,'Invalid byte range.');if(!m[1])start=Math.max(0,info.size-Number(m[2]));else start=Number(m[1]);if(m[1]&&m[2])end=Math.min(end,Number(m[2]));if(start>end||start>=info.size){res.setHeader('Content-Range',`bytes */${info.size}`);throw new HttpError(416,'Range outside file.');}status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);}
  res.writeHead(status,{'Content-Length':end-start+1});if(req.method==='HEAD')return res.end();
  const input=createReadStream(path,{start,end});input.on('error',()=>res.destroy());input.pipe(res);
}
function checkUpload(buffer,mime){
  const match=(mime==='application/pdf'&&buffer.subarray(0,5).toString()==='%PDF-')||(mime==='image/png'&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(mime==='image/jpeg'&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255);
  if(!match)throw new HttpError(415,'Upload a PDF, PNG or JPEG with a matching file signature.');
}
export function createApp(options={}){
  const dataDir=resolve(options.dataDir||process.env.PROPERTYCHECKED_DATA_DIR||join(ROOT,'.data'));
  const assetsDir=resolve(options.assetsDir||join(ROOT,'private-assets'));
  const workspace=openWorkspace(options.dbPath||join(dataDir,'workspace.sqlite'),assetsDir);
  const security=createSecurity({lan:!!options.lan,accessCode:options.accessCode||process.env.LOCAL_ACCESS_CODE});
  const uploadDir=join(dataDir,'uploads');
  const auto=createAutoService(workspace,options.auto||{});
  const lookupDefault=process.env.POSTCODE_LOOKUP_ENABLED==='true'?'true':'false';
  const requestCounts=new Map();
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Content-Security-Policy',CSP);res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      security.checkHost(req);
      const url=new URL(req.url,`http://${req.headers.host}`), path=url.pathname, method=req.method;
      if(method==='OPTIONS')throw new HttpError(403,'Cross-origin requests are not supported.');
      if(path==='/api/session'&&method==='GET')return send(req,res,200,security.session(req,res));
      if(path==='/api/session'&&method==='POST'){const b=await jsonBody(req);const s=security.authenticate(req,res,b.code);return send(req,res,200,{authenticated:true,csrf:s.csrf,mode:'trusted-lan'});}
      if(path.startsWith('/api/'))security.requireSession(req,!['GET','HEAD'].includes(method));
      if(path==='/api/status'&&method==='GET')return send(req,res,200,{version:'0.2.2',mode:'local-development',database:'SQLite on this PC',cloudHosted:false,githubPublished:null,modelInstalled:!!workspace.manifest,postcodesEnabled:workspace.setting('postcodes_enabled',lookupDefault)==='true',features:featureStatus});
      if(path==='/api/catalog'&&method==='GET')return send(req,res,200,{tiers,modules:surveyModules,pricingStatus:'Quotation required - prices not configured',paymentsEnabled:false});
      if(path==='/api/settings'&&method==='PATCH'){const b=await jsonBody(req);if(typeof b.postcodesEnabled!=='boolean')throw new HttpError(400,'postcodesEnabled must be true or false.');workspace.setSetting('postcodes_enabled',String(b.postcodesEnabled));return send(req,res,200,{postcodesEnabled:b.postcodesEnabled});}
      if(path.startsWith('/api/postcodes/')&&method==='GET'){
        const postcode=normalisePostcode(decodeURIComponent(path.slice('/api/postcodes/'.length)));
        if(workspace.setting('postcodes_enabled',lookupDefault)!=='true')return send(req,res,200,{postcode,verification:'format-only',message:'Format checked only. Live lookup is switched off. Enter the building address yourself; no geometry has been generated.'});
        const key=req.socket.remoteAddress||'local',time=Date.now();for(const [k,v] of requestCounts)if(v.reset<time)requestCounts.delete(k);const rate=requestCounts.get(key)||{count:0,reset:time+60000};if(++rate.count>20)throw new HttpError(429,'Please wait before looking up more postcodes.');requestCounts.set(key,rate);
        let response;try{response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,{signal:AbortSignal.timeout(6000),redirect:'error'});}catch{throw new HttpError(503,'Postcode service could not be reached. You can still enter the address manually.');}
        if(response.status===404)throw new HttpError(404,'Postcode not found by the lookup service.');if(!response.ok)throw new HttpError(503,'Postcode lookup temporarily unavailable.');const result=await response.json();const r=result.result;
        return send(req,res,200,{postcode:r.postcode,verification:'postcode-centroid',district:r.admin_district,latitude:r.latitude,longitude:r.longitude,source:'postcodes.io',message:'Postcode area found, not an individual building. Confirm the address; a licensed geometry provider is still required.'});
      }
      if(path==='/api/auto/config'&&method==='GET')return send(req,res,200,auto.config());
      if(path==='/api/auto/search'&&method==='POST')return send(req,res,200,await auto.search(await jsonBody(req)));
      if(path==='/api/auto/generate'&&method==='POST'){const result=await auto.generate(await jsonBody(req));return send(req,res,result.duplicate?200:201,result);}
      const am=path.match(/^\/api\/buildings\/([a-zA-Z0-9-]+)\/auto-model(?:\.(glb|geojson))?$/);
      if(am&&['GET','HEAD'].includes(method)){
        if(am[2])res.setHeader('Content-Disposition',`attachment; filename="propertychecked-exterior-${am[1]}.${am[2]}"`);
        if(am[2]==='glb')return send(req,res,200,Buffer.from(auto.glb(am[1])),'model/gltf-binary');
        return send(req,res,200,am[2]==='geojson'?auto.geojson(am[1]):auto.model(am[1]));
      }
      if(path==='/api/buildings'&&method==='GET')return send(req,res,200,workspace.buildings());
      if(path==='/api/buildings'&&method==='POST')return send(req,res,201,workspace.addBuilding(buildingInput(await jsonBody(req))));
      if(path==='/api/surveys'&&method==='GET')return send(req,res,200,workspace.surveys());
      if(path==='/api/tasks'&&method==='GET')return send(req,res,200,workspace.tasks());
      let m=path.match(/^\/api\/buildings\/([a-zA-Z0-9-]+)(?:\/(locations|surveys|tasks|documents|events|export))?$/);
      if(m){const id=m[1],part=m[2];const building=workspace.building(id);
        if(method==='GET'&&!part)return send(req,res,200,{...building,model:building.model_key==='auto-exterior'?{kind:'auto-exterior',document:auto.model(id),floors:[]}:building.model_key==='marketfield'&&workspace.manifest?{meta:workspace.manifest.meta,floors:workspace.manifest.floors,sources:workspace.manifest.sources}:null});
        if(method==='GET'&&['locations','surveys','tasks','documents','events'].includes(part))return send(req,res,200,workspace[part](id));
        if(method==='GET'&&part==='export'){res.setHeader('Content-Disposition',`attachment; filename="propertychecked-${id}.json"`);return send(req,res,200,{exportedAt:new Date().toISOString(),notice:'Local preview record. Estimates and drawing reviews are not site inspections.',generatedModel:building.model_key==='auto-exterior'?auto.model(id):null,building,locations:workspace.locations(id),surveys:workspace.surveys(id),tasks:workspace.tasks(id),documents:workspace.documents(id),events:workspace.events(id)});}
        if(method==='POST'&&part==='surveys'){const s=workspace.addSurvey(id,surveyInput(await jsonBody(req)));return send(req,res,s.duplicate?200:201,s);}
        if(method==='POST'&&part==='tasks')return send(req,res,201,workspace.addTask(id,taskInput(await jsonBody(req))));
        if(method==='POST'&&part==='documents'){
          const name=filenameInput(decodeURIComponent(String(req.headers['x-file-name']||''))),mime=String(req.headers['content-type']||'');
          const buffer=await readBody(req,25*1024*1024);checkUpload(buffer,mime);
          const storageName=randomUUID();await mkdir(uploadDir,{recursive:true});await writeFile(join(uploadDir,storageName),buffer,{flag:'wx',mode:0o600});
          try{return send(req,res,201,workspace.addDocument(id,{name,mime,size:buffer.length,storageName,sha256:createHash('sha256').update(buffer).digest('hex')}));}catch(e){await unlink(join(uploadDir,storageName));throw e;}
        }
      }
      m=path.match(/^\/api\/locations\/([a-zA-Z0-9-]+)$/);if(m&&method==='PATCH')return send(req,res,200,workspace.updateLocation(m[1],locationPatch(await jsonBody(req))));
      m=path.match(/^\/api\/tasks\/([a-zA-Z0-9-]+)$/);if(m&&method==='PATCH')return send(req,res,200,workspace.updateTask(m[1],taskPatch(await jsonBody(req))));
      m=path.match(/^\/api\/documents\/([a-zA-Z0-9-]+)$/);if(m&&['GET','HEAD'].includes(method)){const d=workspace.document(m[1]);return await stream(req,res,join(uploadDir,d.storage_name),d.mime,d.name);}
      m=path.match(/^\/api\/models\/marketfield\/(viewer|model\.glb|model\.usdz)$/);
      if(m&&['GET','HEAD'].includes(method)){
        if(!workspace.manifest)throw new HttpError(404,'The private Marketfield model pack is not installed. Copy it into private-assets/marketfield.');
        if(m[1]==='viewer'){
          let html=await readFile(join(assetsDir,'marketfield','viewer.html'),'utf8');
          html=html.replace('</head>','<link rel="stylesheet" href="/viewer-embed.css"></head>').replace('</body>','<script src="/viewer-bridge.js"></script></body>');
          res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
          return send(req,res,200,html,'text/html; charset=utf-8');
        }
        return await stream(req,res,join(assetsDir,'marketfield',m[1]),m[1].endsWith('glb')?'model/gltf-binary':'model/vnd.usdz+zip',`Marketfield-Court-${m[1]}`);
      }
      if(path.startsWith('/api/'))throw new HttpError(404,'API route not found.');
      if(!['GET','HEAD'].includes(method))throw new HttpError(405,'Method not allowed.');
      const staticFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/api.js':'api.js','/icons.js':'icons.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
      let filename=staticFiles[path]?join(ROOT,'apps/web/public',staticFiles[path]):null;
      if(path==='/shared/catalog.mjs')filename=join(ROOT,'packages/domain/catalog.mjs');
      const autoStatic={'/auto-page.js':'apps/web/public/auto-page.js','/auto.css':'apps/web/public/auto.css','/shared/geometry.mjs':'packages/auto-model/geometry.mjs','/shared/exterior-viewer.mjs':'packages/auto-model/viewer.mjs'};
      if(autoStatic[path])filename=join(ROOT,autoStatic[path]);
      if(path==='/viewer-bridge.js')filename=join(ROOT,'packages/viewer/bridge.js');
      if(path==='/viewer-embed.css')filename=join(ROOT,'packages/viewer/embed.css');
      if(!filename)throw new HttpError(404,'Page not found.');
      const content=await readFile(filename);return send(req,res,200,content,mimeTypes[extname(filename)]||'application/octet-stream');
    }catch(e){
      const status=e instanceof HttpError?e.status:500;
      const lookup=e instanceof ProviderError?e.diagnostic:undefined;
      if(lookup)console.warn('[auto-model lookup]',JSON.stringify(lookup));
      if(status===500)console.error('Request failed:',e.message);
      if(!res.headersSent){
        if(lookup?.retryAfterSeconds)res.setHeader('Retry-After',String(lookup.retryAfterSeconds));
        send(req,res,status,{error:status===500?'An unexpected local server error occurred. See the PC terminal.':e.message,...(lookup?{lookup}:{})});
      }else res.destroy();
    }
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  return{server,workspace,security,close:()=>new Promise(resolve=>{server.close(()=>{workspace.close();resolve();});server.closeIdleConnections();})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.env.NODE_ENV==='production'){console.error('This starter is a local preview, not a production portal. Read docs/SECURITY.md before deploying.');process.exit(1);}
  const lan=process.argv.includes('--lan'),port=Number(process.env.PORT||3000);
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.');
  const app=createApp({lan});
  app.server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Stop the other local server or change PORT in .env.`:error.message);app.workspace.close();process.exit(1);});
  app.server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
    console.log(`\nPropertyChecked 0.2.2 - provider access diagnostics\nOpen http://localhost:${port}\nDatabase: ${process.env.PROPERTYCHECKED_DATA_DIR||'.data'}/workspace.sqlite\n`);
    if(lan){console.log('TRUSTED HOME/OFFICE WIFI ONLY. This is HTTP, not an internet deployment.');console.log(`Access code: ${app.security.code}`);for(const ip of app.security.allowedHosts)if(!['localhost','127.0.0.1','[::1]'].includes(ip))console.log(`iPhone browser: http://${ip}:${port}`);}
    console.log('No payment, email, appointment or cloud deployment is made by this starter.\n');
  });
  process.on('SIGINT',()=>app.close().then(()=>process.exit(0)));process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));
}
