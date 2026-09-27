import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createServer as createProbe } from 'node:net';
import { createApp } from './server.mjs';
import { featureStatus } from '../../packages/domain/catalog.mjs';
import { HttpError, record } from './validation.mjs';
import { createPreviewService } from './preview/service.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const VERSION='0.8.1';
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const files={'/':'apps/web/public/index.html','/index.html':'apps/web/public/index.html','/preview-workspace.js':'apps/web/public/preview-workspace.js','/start':'apps/web/public/instant.html','/instant':'apps/web/public/instant.html','/instant.js':'apps/web/public/instant.js','/instant.css':'apps/web/public/instant.css','/modules/preview/model.mjs':'packages/preview/model.mjs','/modules/preview/viewer.mjs':'packages/preview/viewer.mjs','/modules/preview/ux.mjs':'packages/preview/ux.mjs','/modules/preview/map-shape.mjs':'packages/preview/map-shape.mjs',
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
  app.server.removeAllListeners('request');
  app.server.on('request',async(req,res)=>{
    const path=String(req.url||'').split('?')[0],ours=!!files[path]||path.startsWith('/api/previews')||path==='/api/status';
    if(!ours){for(const listener of old)listener.call(app.server,req,res);return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Content-Security-Policy',CSP);res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      app.security.checkHost(req);const method=req.method;
      if(path.startsWith('/api/'))app.security.requireSession(req,!['GET','HEAD'].includes(method));
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
      if(files[path]&&['GET','HEAD'].includes(method)){let content=await readFile(join(ROOT,files[path]));if(path==='/'||path==='/index.html')content=Buffer.from(content.toString().replace('</body>','<script type="module" src="/preview-workspace.js"></script></body>'));send(req,res,200,content,path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.js')||path.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');return;}
      throw new HttpError(404,'Preview route not found.');
    }catch(e){if(!res.headersSent)send(req,res,e instanceof HttpError?e.status:500,{error:e instanceof HttpError?e.message:'Preview request failed safely. Your saved model is unchanged.'});else res.destroy();}
  });
  return {...app,preview,close:async()=>{await preview.close();await app.close();}};
}
async function run(){
  try{loadEnvFile(join(ROOT,'.env'));}catch(e){if(e.code!=='ENOENT')throw new Error('Could not load the project .env file.');}
  if(process.env.NODE_ENV==='production')throw new Error('This is a local preview, not a production portal.');
  const port=Number(process.env.PORT||3000),lan=process.argv.includes('--lan');if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
  // Check before opening the database; a second server must not interrupt the first server's jobs.
  await new Promise((resolve,reject)=>{const probe=createProbe();probe.once('error',()=>reject(new Error(`Port ${port} is already in use. Stop the other PropertyChecked terminal with Ctrl+C before starting this version.`)));probe.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>probe.close(resolve));});
  const app=createPreviewApp({lan});app.server.on('error',()=>{console.error('The local server could not start. Check the selected port.');app.close().finally(()=>process.exit(1));});
  app.server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
    console.log(`\nPropertyChecked ${VERSION} - map-based building estimates\nOpen http://localhost:${port}/start\nDatabase: ${process.env.PROPERTYCHECKED_DATA_DIR||'.data'}/workspace.sqlite\nAI research: ${process.env.OPENAI_API_KEY?'key configured (access not yet verified)':'not configured; open map estimates still work'}\nOpen map data: ${process.env.MAP_DATA_ENABLED==='false'?'disabled':'enabled (downloads run only after creation/refinement)'}\n`);
    if(lan){console.log('Trusted Wi-Fi only. Access code: '+app.security.code);for(const ip of app.security.allowedHosts)if(!['localhost','127.0.0.1','[::1]'].includes(ip))console.log(`Phone: http://${ip}:${port}/start`);}
    console.log('Estimates are not surveys. No paid request runs until a preview/refinement is requested.');
  });
  let closing=false;const stop=()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run().catch(e=>{console.error(e.message);process.exitCode=1;});
