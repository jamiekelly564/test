import { exampleFiles, exampleMime } from './examples/routes.mjs';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createServer as createProbe } from 'node:net';
import { createApp } from './server.mjs';
import { featureStatus } from '../../packages/domain/catalog.mjs';
import { HttpError, record } from './validation.mjs';
import { createPreviewService } from './preview/service.mjs';
import { createBuildingWorkspace } from './workspace/service.mjs';
import { createPhotoFlow } from './photo-flow/service.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const VERSION='0.11.0';
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const files={...exampleFiles,'/workspace-ui.js':'apps/web/public/workspace-ui.js','/workspace.css':'apps/web/public/workspace.css','/modules/domain/tracking.mjs':'packages/domain/tracking.mjs','/admin':'apps/web/public/index.html','/photo-tools':'apps/web/public/photo-first.html','/architecture.css':'apps/web/public/architecture.css','/modules/preview/architecture.mjs':'packages/preview/architecture.mjs','/modules/preview/detailed-model.mjs':'packages/preview/detailed-model.mjs','/modules/preview/materials.mjs':'packages/preview/materials.mjs','/build':'apps/web/public/instant.html','/advanced-build':'apps/web/public/build.html','/photo-first.js':'apps/web/public/photo-first.js','/photo-first.css':'apps/web/public/photo-first.css','/modules/preview/concept.mjs':'packages/preview/concept.mjs','/':'apps/web/public/instant.html','/index.html':'apps/web/public/instant.html','/preview-workspace.js':'apps/web/public/preview-workspace.js','/start':'apps/web/public/instant.html','/instant':'apps/web/public/instant.html','/instant.js':'apps/web/public/instant.js','/instant.css':'apps/web/public/instant.css','/modules/preview/model.mjs':'packages/preview/model.mjs','/modules/preview/viewer.mjs':'packages/preview/viewer.mjs','/modules/preview/ux.mjs':'packages/preview/ux.mjs','/modules/preview/map-shape.mjs':'packages/preview/map-shape.mjs',
  '/modules/auto-model/geometry.mjs':'packages/auto-model/geometry.mjs','/modules/auto-model/viewer.mjs':'packages/auto-model/viewer.mjs'};
const send=(req,res,status,value,type='application/json; charset=utf-8')=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value));res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);};
async function jsonBody(req){
  if(!String(req.headers['content-type']).startsWith('application/json'))throw new HttpError(415,'Expected JSON.');const parts=[];let n=0;
  for await(const part of req){n+=part.length;if(n>64000)throw new HttpError(413,'Preview request is too large.');parts.push(part);}
  try{return record(JSON.parse(Buffer.concat(parts).toString()));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid JSON.');}
}
/** Layer estimated previews over the existing app without weakening its evidence validation. */
export function createPreviewApp(options={}){
  const app=createApp(options),preview=createPreviewService({workspace:app.workspace,...options.preview}),old=app.server.listeners('request');
  const photoFlow=createPhotoFlow({workspace:app.workspace,preview,uploadDir:join(resolve(options.dataDir||process.env.PROPERTYCHECKED_DATA_DIR||join(ROOT,'.data')),'uploads'),...options.photoFlow});
  const buildingWorkspace=createBuildingWorkspace({workspace:app.workspace,preview});
  app.server.removeAllListeners('request');
  app.server.on('request',async(req,res)=>{
    const path=String(req.url||'').split('?')[0],ours=path==='/examples'||!!files[path]||path.startsWith('/api/previews')||path.startsWith('/api/photo-flow')||path.startsWith('/api/workspace')||path==='/api/status';
    if(!ours){for(const listener of old)listener.call(app.server,req,res);return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Content-Security-Policy',CSP);res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      app.security.checkHost(req);const method=req.method;
      if(path==='/examples'&&['GET','HEAD'].includes(method)){res.writeHead(302,{Location:'/examples/'});res.end();return;}
      if(path.startsWith('/api/'))app.security.requireSession(req,!['GET','HEAD'].includes(method));
      if(path==='/api/workspace/start'&&method==='POST'){send(req,res,200,buildingWorkspace.start(await jsonBody(req)));return;}
      if(path==='/api/workspace/buildings'&&method==='GET'){send(req,res,200,buildingWorkspace.list());return;}
      const recover=/^\/api\/workspace\/requests\/([a-zA-Z0-9-]+)$/.exec(path);
      if(recover&&method==='GET'){send(req,res,200,buildingWorkspace.recover(recover[1]));return;}
      const wb=/^\/api\/workspace\/buildings\/([a-zA-Z0-9-]+)(?:\/(modules|records)(?:\/([a-zA-Z0-9-]+))?)?$/.exec(path);
      if(wb){const [,bid,part,id]=wb;
        if(!part&&method==='GET'){send(req,res,200,buildingWorkspace.read(bid));return;}
        if(part==='modules'&&id&&method==='PUT'){send(req,res,200,buildingWorkspace.setModule(bid,id,await jsonBody(req)));return;}
        if(part==='records'&&!id&&method==='POST'){send(req,res,201,buildingWorkspace.add(bid,await jsonBody(req)));return;}
        if(part==='records'&&id&&method==='PATCH'){send(req,res,200,buildingWorkspace.patch(bid,id,await jsonBody(req)));return;}
      }
      if(path==='/api/photo-flow/jobs'&&method==='POST'){send(req,res,201,photoFlow.create(await jsonBody(req)));return;}
      const fb=/^\/api\/photo-flow\/buildings\/([a-zA-Z0-9-]+)$/.exec(path);
      if(fb&&method==='GET'){send(req,res,200,photoFlow.building(fb[1]));return;}
      const fa=/^\/api\/photo-flow\/assets\/([a-zA-Z0-9-]+)$/.exec(path);
      if(fa&&['GET','HEAD'].includes(method)){const image=await photoFlow.asset(fa[1]);send(req,res,200,image.bytes,image.mime);return;}
      const fj=/^\/api\/photo-flow\/jobs\/([a-zA-Z0-9-]+)(?:\/(search|reject|build|stop|upload))?$/.exec(path);
      if(fj){
        const [,id,action]=fj;
        if(method==='GET'&&!action){send(req,res,200,photoFlow.get(id));return;}
        if(method==='POST'&&action==='upload'){
          if(Number(req.headers['content-length'])>25*1024*1024)throw new HttpError(413,'The file exceeds 25 MB.');
          const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>25*1024*1024)throw new HttpError(413,'The file exceeds 25 MB.');parts.push(chunk);}
          let name;try{name=decodeURIComponent(req.headers['x-file-name']||'');}catch{throw new HttpError(400,'Invalid file name.');}
          send(req,res,201,await photoFlow.upload(id,{name,kind:req.headers['x-file-kind'],bytes:Buffer.concat(parts),requestKey:req.headers['x-request-key'],rightsConfirmed:req.headers['x-file-permission']==='yes'}));return;
        }
        if(method==='POST'&&['search','reject','build','stop'].includes(action)){send(req,res,202,photoFlow[action](id,await jsonBody(req)));return;}
      }
      if(path==='/api/status'&&method==='GET'){send(req,res,200,{version:VERSION,mode:'local-development',database:'SQLite on this PC',cloudHosted:false,githubPublished:null,modelInstalled:!!app.workspace.manifest,postcodesEnabled:app.workspace.setting('postcodes_enabled','false')==='true',features:featureStatus});return;}
      if(path==='/api/previews/config'&&method==='GET'){send(req,res,200,{version:VERSION,...preview.config()});return;}
      if(path==='/api/previews'&&method==='POST'){send(req,res,201,preview.create(await jsonBody(req)));return;}
      if(path==='/api/previews'&&method==='GET'){send(req,res,200,preview.list());return;}
      const m=/^\/api\/previews\/([a-zA-Z0-9-]+)(?:\/(refine|stop|undo|model\.glb))?$/.exec(path);
      if(m){
        const [,id,action]=m;
        if(method==='GET'&&!action){send(req,res,200,preview.get(id));return;}
        if(['GET','HEAD'].includes(method)&&action==='model.glb'){res.setHeader('Content-Disposition','attachment; filename="propertychecked-estimated-preview.glb"');send(req,res,200,Buffer.from(preview.glb(id)),'model/gltf-binary');return;}
        if(method==='POST'&&action==='refine'){send(req,res,202,preview.refine(id,await jsonBody(req)));return;}
        if(method==='POST'&&action==='stop'){await jsonBody(req);send(req,res,200,preview.stop(id));return;}
        if(method==='POST'&&action==='undo'){send(req,res,200,preview.undo(id,await jsonBody(req)));return;}
        if(method==='PATCH'&&!action){send(req,res,200,preview.edit(id,await jsonBody(req)));return;}
      }
      if(files[path]&&['GET','HEAD'].includes(method)){let content=await readFile(join(ROOT,files[path]));if(path==='/admin')content=Buffer.from(content.toString().replace('</body>','<script type="module" src="/preview-workspace.js"></script></body>'));send(req,res,200,content,exampleMime(path)||(path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.js')||path.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'));return;}
      throw new HttpError(404,'Preview route not found.');
    }catch(e){if(!res.headersSent)send(req,res,e instanceof HttpError?e.status:500,{error:e instanceof HttpError?e.message:'Preview request failed safely. Your saved model is unchanged.'});else res.destroy();}
  });
  return {...app,preview,photoFlow,buildingWorkspace,close:async()=>{await photoFlow.close();await preview.close();await app.close();}};
}
async function run(){
  try{loadEnvFile(join(ROOT,'.env'));}catch(e){if(e.code!=='ENOENT')throw new Error('Could not load the project .env file.');}
  if(process.env.NODE_ENV==='production')throw new Error('This is a local preview, not a production portal.');
  const port=Number(process.env.PORT||3000),lan=process.argv.includes('--lan');if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
  // Check before opening the database; a second server must not interrupt the first server's jobs.
  await new Promise((resolve,reject)=>{const probe=createProbe();probe.once('error',()=>reject(new Error(`Port ${port} is already in use. Stop the other PropertyChecked terminal with Ctrl+C before starting this version.`)));probe.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>probe.close(resolve));});
  const app=createPreviewApp({lan});app.server.on('error',()=>{console.error('The local server could not start. Check the selected port.');app.close().finally(()=>process.exit(1));});
  app.server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
    console.log(`\nPropertyChecked ${VERSION} - one building workspace\nOpen http://localhost:${port}/start\nDatabase: ${process.env.PROPERTYCHECKED_DATA_DIR||'.data'}/workspace.sqlite\nAI research: ${process.env.OPENAI_API_KEY?'key configured (access not yet verified)':'not configured; open map estimates still work'}\nOpen map data: ${process.env.MAP_DATA_ENABLED==='false'?'disabled':'enabled (downloads run only after creation/refinement)'}\n`);
    if(lan){console.log('Trusted Wi-Fi only. Access code: '+app.security.code);for(const ip of app.security.allowedHosts)if(!['localhost','127.0.0.1','[::1]'].includes(ip))console.log(`Phone: http://${ip}:${port}/start`);}
    console.log('Estimates are not surveys. No paid request runs until a preview/refinement is requested.');
  });
  let closing=false;const stop=()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run().catch(e=>{console.error(e.message);process.exitCode=1;});
