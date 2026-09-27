import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError, normalisePostcode, text, record, filenameInput } from '../validation.mjs';
import { createResearch, ResearchError } from '../preview/research.mjs';
import { photoType } from '../preview/web-photos.mjs';
import { createMapProvider } from '../map-data/provider.mjs';
import { applyMapped, MAP_SOURCE_URL, MAP_LICENCE_URL } from '../../../packages/preview/map-shape.mjs';
import { defaultSpec } from '../../../packages/preview/model.mjs';

const now=()=>new Date().toISOString(), key=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const digest=v=>createHash('sha256').update(v).digest('hex');
const reqKey=v=>{if(typeof v!=='string'||!/^[a-zA-Z0-9-]{12,80}$/.test(v))throw new HttpError(400,'Invalid request reference.');return v;};
const freshUsage=()=>({responses:0,searchCalls:0,inputTokens:0,outputTokens:0});
const expiry=()=>Date.now()+60*60*1000;
const publicAsset=a=>({id:a.id,kind:a.kind,origin:a.origin,...JSON.parse(a.metadata),imageUrl:a.kind==='photo'?'/api/photo-flow/assets/'+a.id:undefined,documentId:a.document_id||undefined});

/** Photo identity confirmation is separate from both surveying and footprint identity.
 * No GET, upload, rejection or restart starts paid inference. */
export function createPhotoFlow({workspace,preview,uploadDir,research=createResearch(),maps=createMapProvider({workspace}),deadlineMs=420000}) {
  const db=workspace.db,workers=new Map();let closed=false,uploadBusy=false;
  db.exec(`CREATE TABLE IF NOT EXISTS photo_flow_jobs(id TEXT PRIMARY KEY,building_id TEXT UNIQUE NOT NULL REFERENCES buildings(id),state TEXT NOT NULL,stage TEXT NOT NULL,message TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,epoch INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS photo_flow_assets(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),job_id TEXT REFERENCES photo_flow_jobs(id),kind TEXT NOT NULL,origin TEXT NOT NULL,document_id TEXT REFERENCES documents(id),metadata TEXT NOT NULL,pixels BLOB,expires_at INTEGER);
    CREATE TABLE IF NOT EXISTS photo_flow_requests(request_key TEXT PRIMARY KEY,signature TEXT NOT NULL,job_id TEXT NOT NULL REFERENCES photo_flow_jobs(id));
    CREATE TABLE IF NOT EXISTS photo_flow_runs(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,kind TEXT NOT NULL,started_at TEXT NOT NULL);
    UPDATE photo_flow_jobs SET state='paused',stage='interrupted',message='The PC restarted. Your files and last saved model remain. Resume explicitly; no paid request was repeated.',version=version+1 WHERE state IN ('searching','building');
    DELETE FROM photo_flow_assets WHERE expires_at IS NOT NULL AND expires_at < ${Date.now()};`);
  const row=id=>{const r=db.prepare('SELECT * FROM photo_flow_jobs WHERE id=?').get(id);if(!r)throw new HttpError(404,'Building session not found.');return {...r,data:JSON.parse(r.data)};};
  function change(id,fields,epoch) {
    const p=row(id);if(epoch!==undefined&&p.epoch!==epoch)return null;
    const data={...p.data,...fields.data};
    db.prepare('UPDATE photo_flow_jobs SET state=?,stage=?,message=?,data=?,version=version+1,updated_at=? WHERE id=?').run(fields.state||p.state,fields.stage||p.stage,fields.message||p.message,JSON.stringify(data),now(),id);
    return row(id);
  }
  function assets(bid) {return db.prepare('SELECT * FROM photo_flow_assets WHERE building_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY rowid DESC').all(bid,Date.now());}
  function get(id) {
    const p=row(id),b=workspace.building(p.building_id),all=assets(b.id),candidates=all.filter(a=>a.job_id===id&&a.origin==='web'&&p.data.candidateIds?.includes(a.id));
    const {usage,error,previewId,selectedIds}=p.data;const expired=p.state==='confirm'&&!candidates.length;
    return {id,buildingId:b.id,name:b.name,postcode:b.postcode,state:expired?'needs_photo':p.state,stage:expired?'upload':p.stage,message:expired?'The temporary search photos expired. Add your own photo or explicitly search again.':p.message,version:p.version,updatedAt:p.updated_at,
      candidates:candidates.map(publicAsset),uploads:all.filter(a=>a.origin==='upload').map(publicAsset),usage:usage||freshUsage(),error:error||null,previewId:previewId||null,selectedIds:selectedIds||[],
      aiConfigured:research.configured(),hasPlans:hasPlans(b.id)};
  }
  function hasPlans(bid) {return !!db.prepare("SELECT 1 FROM evidence_sources WHERE building_id=? AND json_extract(metadata,'$.role')='floor-plan' LIMIT 1").get(bid);}
  function building(bid) {const b=workspace.building(bid),j=db.prepare('SELECT id FROM photo_flow_jobs WHERE building_id=?').get(bid);return {building:b,job:j?get(j.id):null,uploads:assets(bid).filter(a=>a.origin==='upload').map(publicAsset),hasPlans:hasPlans(bid)};}
  function checked(id,input,action) {
    record(input);const k=reqKey(input.requestKey),signature=digest(JSON.stringify({id,action,...input}));
    const previous=db.prepare('SELECT * FROM photo_flow_requests WHERE request_key=?').get(k);
    if(previous){if(previous.signature!==signature)throw new HttpError(409,'Request reference was used for a different action.');return {duplicate:true};}
    const p=row(id);if(input.version!==p.version)throw new HttpError(409,'This building session changed. Reload it before continuing.');
    return {p,k,signature};
  }
  const remember=(id,c)=>db.prepare('INSERT INTO photo_flow_requests VALUES(?,?,?)').run(c.k,c.signature,id);
  function canRun() {
    db.prepare('DELETE FROM photo_flow_assets WHERE expires_at IS NOT NULL AND expires_at<?').run(Date.now());
    if(closed||workers.size)throw new HttpError(409,'Another photo search or build is running. Wait for it to finish or pause it first.');
    const since=new Date(Date.now()-3600000).toISOString();
    if(db.prepare('SELECT count(*) AS n FROM photo_flow_runs WHERE started_at>?').get(since).n>=12)throw new HttpError(429,'The local photo-search/build allowance is reached. Your saved files are still available.');
  }
  function work(id,state,task) {
    const p=row(id),epoch=p.epoch+1,controller=new AbortController();
    db.prepare('UPDATE photo_flow_jobs SET epoch=? WHERE id=?').run(epoch,id);
    change(id,{state,stage:state,message:state==='searching'?'Finding exterior photographs. No model is being guessed on screen yet.':'Preparing your building from the selected photo and map data.',data:{error:null}},epoch);
    db.prepare('INSERT INTO photo_flow_runs VALUES(?,?,?,?)').run(randomUUID(),id,state,now());
    const timer=setTimeout(()=>controller.abort(),deadlineMs);timer.unref();
    const live=()=>{controller.signal.throwIfAborted();if(closed||row(id).epoch!==epoch)throw new Error('Superseded');};
    const promise=new Promise(r=>setImmediate(r)).then(()=>{live();return task({signal:controller.signal,live,update:f=>{live();return change(id,f,epoch);}});}).catch(e=>{
      if(closed||row(id).epoch!==epoch)return;
      const safe=e instanceof ResearchError?{code:e.code,message:e.message}:e instanceof HttpError?{code:'ACTION_'+e.status,message:e.message}:{code:controller.signal.aborted?'PAUSED':'BUILD_FAILED',message:controller.signal.aborted?'Processing paused. Nothing is automatically retried.':'Processing could not finish. Your uploads and existing model are preserved.'};
      change(id,{state:'paused',stage:'interrupted',message:safe.message,data:{error:safe}},epoch);
    }).finally(()=>{clearTimeout(timer);workers.delete(id);});workers.set(id,{controller,promise});
  }
  async function image(a) {
    let bytes;
    if(a.origin==='web') {if(a.expires_at<Date.now())throw new HttpError(410,'This search photo has expired. Search again or add your own photo.');bytes=Buffer.from(a.pixels);}
    else {const d=workspace.document(a.document_id);bytes=await readFile(join(uploadDir,d.storage_name));if(digest(bytes)!==d.sha256)throw new HttpError(409,'A stored image changed. Upload it again.');}
    const type=photoType(bytes);if(!type)throw new HttpError(415,'This photo is unsupported. Add a JPEG, PNG or WebP photograph.');
    return {id:a.id,...JSON.parse(a.metadata),...type,bytes};
  }
  function search(id,c) {
    if(!research.configured()){remember(id,c);change(id,{state:'needs_photo',stage:'upload',message:'Online photo search is not configured. Add a building photo; local map estimates still work.'});return get(id);}
    canRun();remember(id,c);
    work(id,'searching',async({signal,live,update})=>{
      const p=row(id),b=workspace.building(p.building_id),usage=freshUsage();
      update({data:{usage,candidateIds:[],selectedIds:[],notes:'',references:[]}});
      const found=await research.discover({name:b.name,postcode:b.postcode,signal,usage,onProgress:async progress=>update({message:progress.message,data:{usage}})});
      live();const ids=[];
      for(const ph of found.images.slice(0,4)) {
        if(!photoType(ph.bytes))continue;
        const id2=randomUUID(),{bytes,...meta}=ph;
        db.prepare('INSERT INTO photo_flow_assets VALUES(?,?,?,?,?,?,?,?,?)').run(id2,b.id,id,'photo','web',null,JSON.stringify({...meta,id:id2}),bytes,expiry());ids.push(id2);
      }
      update({state:ids.length?'confirm':'needs_photo',stage:ids.length?'confirm':'upload',message:ids.length?'Is this your building? Check the photo before we create the model.':'No usable exterior photograph was retrieved. Add one of your own to continue.',data:{candidateIds:ids,notes:found.notes,references:found.references,visualResearch:found.visualResearch,usage}});
    });return get(id);
  }
  return {
    get,building,hasPlans,
    create(input) {
      record(input);const k=reqKey(input.requestKey),signature=digest(JSON.stringify(input)),old=db.prepare('SELECT * FROM photo_flow_requests WHERE request_key=?').get(k);
      if(old){if(old.signature!==signature)throw new HttpError(409,'Request reference changed.');return get(old.job_id);}
      if(input.allowProcessing!==true)throw new HttpError(400,'Approve the building preview process before continuing.');
      let b;
      if(input.buildingId)b=workspace.building(text(input.buildingId,'Building ID',100));
      else {
        const name=text(input.name,'Building name',150),postcode=normalisePostcode(input.postcode);
        if(key(name).length<2)throw new HttpError(400,'Enter the building name.');
        b=workspace.buildings().find(b=>key(b.name)===key(name)&&b.postcode===postcode)||workspace.addBuilding({name,postcode,address:name+', '+postcode});
      }
      const existing=db.prepare('SELECT id FROM photo_flow_jobs WHERE building_id=?').get(b.id);
      if(existing){db.prepare('INSERT INTO photo_flow_requests VALUES(?,?,?)').run(k,signature,existing.id);return get(existing.id);}
      const id=randomUUID();db.prepare('INSERT INTO photo_flow_jobs(id,building_id,state,stage,message,data,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,b.id,'needs_photo','upload','Add your building photos or find a photo online.',JSON.stringify({usage:freshUsage()}),now());
      const c={k,signature};
      if(input.search===false){remember(id,c);return get(id);}
      try{return search(id,c);}catch(e){remember(id,c);change(id,{message:e instanceof HttpError?e.message:'Photo search has not started.'});return get(id);}
    },
    search(id,input) {const c=checked(id,input,'search');if(c.duplicate)return get(id);if(input.allowProcessing!==true)throw new HttpError(400,'Approve this new online search.');return search(id,c);},
    reject(id,input) {
      const c=checked(id,input,'reject');if(c.duplicate)return get(id);remember(id,c);
      workers.get(id)?.controller.abort();db.prepare('UPDATE photo_flow_jobs SET epoch=epoch+1 WHERE id=?').run(id);
      change(id,{state:'needs_photo',stage:'upload',message:'Add a photo of the correct building. The rejected photo will not be used.',data:{selectedIds:[],candidateIds:[],notes:'',references:[]}});return get(id);
    },
    build(id,input) {
      const c=checked(id,input,'build');if(c.duplicate)return get(id);
      if(input.allowProcessing!==true)throw new HttpError(400,'Approve using the selected photos for this model.');
      const p=c.p,b=workspace.building(p.building_id),available=assets(b.id);
      if(!Array.isArray(input.assetIds)||input.assetIds.length>4||new Set(input.assetIds).size!==input.assetIds.length)throw new HttpError(400,'Choose up to four photos.');
      const selected=input.assetIds.map(aid=>available.find(a=>a.id===aid&&a.kind==='photo'&&(a.origin==='upload'||p.data.candidateIds?.includes(a.id))));
      if(selected.some(a=>!a))throw new HttpError(400,'A selected photo is missing, expired or belongs to another building.');
      if(!selected.length&&input.withoutPhoto!==true)throw new HttpError(400,'Confirm a photo or explicitly continue without one.');
      canRun();
      const prior=preview.create({name:b.name,postcode:b.postcode,requestKey:randomUUID(),allowProcessing:true},{deferResearch:true});
      if(prior.building_id!==b.id)throw new HttpError(409,'A duplicate local building record needs resolving before this model can be replaced.');
      if(prior.status==='refining')throw new HttpError(409,'Pause the existing model research before using new photographs.');
      remember(id,c);change(id,{data:{selectedIds:input.assetIds,previewId:prior.id,usage:freshUsage()}});
      work(id,'building',async({signal,live,update})=>{
        const usage=freshUsage(),images=[];
        for(const a of selected){images.push(await image(a));live();}
        // Rejected web metadata cannot carry into a user-photo-only build.
        const usesWeb=selected.some(a=>a.origin==='web');
        const references=usesWeb?(p.data.references||[]):[],notes=usesWeb?(p.data.notes||''):'';
        let spec=structuredClone(prior.spec||defaultSpec(b.name)),mapData={},sourceRefs=[];
        update({stage:'outline',message:'Preparing the building outline. The photo confirms appearance, not the map footprint.'});
        try {const r=await maps.lookup(b.name,b.postcode,signal);live();if(r.mapped)spec=applyMapped(spec,r.mapped);mapData={state:r.mapped?'available':'unavailable',note:r.reason||''};}
        catch {live();mapData={state:'unavailable',note:'Using the previous outline or an estimated shape.'};}
        const mapped=spec.mapped;
        if(mapped)sourceRefs=[{id:'map-ms',url:MAP_SOURCE_URL,title:'Microsoft building footprint / unconfirmed match'},{id:'map-ms-license',url:MAP_LICENCE_URL,title:'CDLA Permissive 2.0'}];
        let result={spec,basis:mapped?'map-based-estimate':'generic-starting-estimate',references:[],photos:[],message:'Estimate ready. Photo analysis is not configured; appearance has not been derived from the uploaded image.'},partial=null;
        const prepared={images,photoMeta:images.map(({bytes,...x})=>x),references,notes,visualResearch:{found:images.length,loaded:images.length,analysed:0,used:0,status:'confirmed-inputs'}};
        if(research.configured()) {
          update({stage:'appearance',message:`Using ${images.length} selected photo${images.length===1?'':'s'} to estimate the exterior.`,data:{usage}});
          try {
            const base={...spec};delete base.mapped;
            result=await research.run({name:b.name,postcode:b.postcode,spec:base,prepared,usage,signal,onProgress:async progress=>{
              live();if(progress.spec)partial={...progress};update({stage:progress.stage==='checking'?'checking':'appearance',message:progress.message,data:{usage}});
            }});
          }catch(e){live();result=partial?.spec?{...partial,message:'The first visual estimate is saved; the final check did not finish.'}:{...result,message:'Photo interpretation did not finish. The available outline is retained, not presented as a photo-matched reconstruction.'};
            update({data:{error:e instanceof ResearchError?{code:e.code,message:e.message}:{code:'APPEARANCE_UNAVAILABLE',message:'Photo interpretation did not finish.'}}});}
        }
        live();if(mapped)result.spec=applyMapped(result.spec,mapped);
        if(result.spec.usedPhotoIds?.length)result.spec.summary='Photo-informed appearance; map identity remains unverified. '+result.spec.summary.slice(0,570);
        update({stage:'saving',message:'Saving the model and its source information.'});
        const saved=preview.publishPrepared(prior.id,prior.version,{spec:result.spec,message:result.message,meta:{basis:mapped?'map-based-estimate':result.basis,photos:result.photos||[],references:[...sourceRefs,...(result.references||[])],usage,mapData,photoFlow:{jobId:id,userConfirmedPhotoIds:input.assetIds,identity:'user-selected-photo; footprint unverified'}}});
        update({state:'ready',stage:'ready',message:result.message,data:{previewId:saved.id,usage}});
      });return get(id);
    },
    stop(id,input) {const c=checked(id,input,'stop');if(c.duplicate)return get(id);remember(id,c);workers.get(id)?.controller.abort();db.prepare('UPDATE photo_flow_jobs SET epoch=epoch+1 WHERE id=?').run(id);change(id,{state:'paused',stage:'interrupted',message:'Paused. Your photos and last saved model are retained.'});return get(id);},
    async upload(id,{name,kind,bytes,requestKey,rightsConfirmed}) {
      const p=row(id);if(rightsConfirmed!==true)throw new HttpError(400,'Confirm that you may use these files for the building.');
      if(uploadBusy)throw new HttpError(409,'Another upload is finishing. Try this file again shortly.');
      name=filenameInput(name);reqKey(requestKey);
      if(!['photo','plan'].includes(kind))throw new HttpError(400,'Choose photos or floor plans.');
      const signature=digest(Buffer.concat([Buffer.from(JSON.stringify({id,name,kind})),bytes])),old=db.prepare('SELECT * FROM photo_flow_requests WHERE request_key=?').get(requestKey);
      if(old){if(old.signature!==signature)throw new HttpError(409,'Upload reference belongs to different contents.');return get(id);}
      let mime;
      if(kind==='plan'&&bytes.subarray(0,5).toString()==='%PDF-'&&bytes.length<=25*1024*1024)mime='application/pdf';
      else mime=photoType(bytes)?.mime;
      if(!mime)throw new HttpError(415,'Use JPEG, PNG or WebP photos (up to 2 MB after resizing), or PDF plans up to 25 MB. HEIC must be converted to JPEG first.');
      const all=assets(p.building_id).filter(a=>a.origin==='upload');
      if(all.length>=40)throw new HttpError(413,'This building already has 40 uploaded files. Use the document workspace for larger packs.');
      const sha=digest(bytes),duplicate=all.find(a=>JSON.parse(a.metadata).sha256===sha&&a.kind===kind);
      if(duplicate){db.prepare('INSERT INTO photo_flow_requests VALUES(?,?,?)').run(requestKey,signature,id);return get(id);}
      uploadBusy=true;const storageName=randomUUID(),documentId=randomUUID(),assetId=randomUUID();
      try {
        await mkdir(uploadDir,{recursive:true});await writeFile(join(uploadDir,storageName),bytes,{flag:'wx',mode:0o600});
        const metadata={title:name,role:kind==='photo'?'photo':'floor-plan',rights:'permission',rightsNote:'Uploader confirmed permission for this building.',scenario:'unknown',revision:'',floorLabel:'',notes:'Simple upload. Source is unreviewed; no inferred measurements.',sourceUrl:'',buildingConfirmed:true};
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)').run(documentId,p.building_id,name,mime,bytes.length,storageName,sha,now());
          db.prepare('INSERT INTO evidence_sources VALUES(?,?,?,?,?)').run(randomUUID(),p.building_id,documentId,JSON.stringify(metadata),now());
          db.prepare('INSERT INTO photo_flow_assets VALUES(?,?,?,?,?,?,?,?,?)').run(assetId,p.building_id,id,kind,'upload',documentId,JSON.stringify({id:assetId,title:name,mime,sha256:sha,url:'',imageUrl:'',description:'User-provided building '+kind,provider:'user-upload',artist:'User supplied',licence:'Uploader-declared permission',licenceUrl:'',size:bytes.length}),null,null);
          db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(randomUUID(),p.building_id,'document_uploaded','Uploaded '+kind+' through the simple photo page; not automatically measured or inspected.',now());
          db.prepare('INSERT INTO photo_flow_requests VALUES(?,?,?)').run(requestKey,signature,id);db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');await unlink(join(uploadDir,storageName));throw e;}
        return get(id);
      }finally{uploadBusy=false;}
    },
    async asset(id) {const a=db.prepare('SELECT * FROM photo_flow_assets WHERE id=?').get(id);if(!a||a.kind!=='photo')throw new HttpError(404,'Photo not found.');workspace.building(a.building_id);const p=await image(a);return {bytes:p.bytes,mime:p.mime};},
    async close() {closed=true;for(const w of workers.values())w.controller.abort();await Promise.allSettled([...workers.values()].map(w=>w.promise));db.prepare("UPDATE photo_flow_jobs SET state='paused',stage='interrupted',message='PC server stopped. No paid work was restarted.',version=version+1 WHERE state IN ('searching','building')").run();}
  };
}
