import { randomUUID, createHash } from 'node:crypto';
import { HttpError, normalisePostcode, text, record } from '../validation.mjs';
import { defaultSpec, validateSpec, previewModel, previewGLB, PREVIEW_NOTICE } from '../../../packages/preview/model.mjs';
import { createResearch, ResearchError, RESEARCH_LIMITS } from './research.mjs';
const now=()=>new Date().toISOString();
const normalName=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const requestKey=v=>{if(typeof v!=='string'||!/^[a-zA-Z0-9-]{12,80}$/.test(v))throw new HttpError(400,'Invalid request reference.');return v;};

/** A speculative preview is never promoted to an evidence draft or inspected asset. */
export function createPreviewService({workspace,research=createResearch(),deadlineMs=RESEARCH_LIMITS.deadlineSeconds*1000}){
  const db=workspace.db,workers=new Map();let closed=false;
  db.exec(`CREATE TABLE IF NOT EXISTS quick_previews (
    id TEXT PRIMARY KEY, property_key TEXT UNIQUE NOT NULL, building_id TEXT NOT NULL REFERENCES buildings(id),
    name TEXT NOT NULL,postcode TEXT NOT NULL,spec TEXT NOT NULL,meta TEXT NOT NULL,status TEXT NOT NULL,
    stage TEXT NOT NULL,message TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,epoch INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quick_preview_requests(request_key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,preview_id TEXT NOT NULL REFERENCES quick_previews(id));
    CREATE TABLE IF NOT EXISTS quick_preview_runs(id TEXT PRIMARY KEY,preview_id TEXT NOT NULL REFERENCES quick_previews(id),request_key TEXT UNIQUE NOT NULL,started_at TEXT NOT NULL,status TEXT NOT NULL,usage TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quick_preview_undo(preview_id TEXT PRIMARY KEY REFERENCES quick_previews(id),spec TEXT NOT NULL,meta TEXT NOT NULL,after_version INTEGER NOT NULL);
    UPDATE quick_previews SET status='ready',stage='interrupted',message='Refinement stopped when the PC server closed. Your last usable estimate is saved. No AI request was automatically repeated.',version=version+1 WHERE status='refining';
    UPDATE quick_preview_runs SET status='interrupted' WHERE status='running';`);
  function get(id){const row=db.prepare('SELECT * FROM quick_previews WHERE id=?').get(id);if(!row)throw new HttpError(404,'Estimated preview not found.');return {...row,spec:JSON.parse(row.spec),meta:JSON.parse(row.meta),notice:PREVIEW_NOTICE,canUndo:!!db.prepare('SELECT 1 FROM quick_preview_undo WHERE preview_id=? AND after_version=?').get(id,row.version)};}
  function update(id,epoch,change){const current=get(id);if(epoch!==undefined&&current.epoch!==epoch)return null;
    const spec=change.spec?validateSpec(change.spec):current.spec;if(change.spec)previewModel(spec);
    const meta={...current.meta,...change.meta};
    meta.events=[...(current.meta.events||[]),...(change.message?[{time:now(),stage:change.stage||current.stage,message:change.message}]:[])].slice(-20);
    db.prepare('UPDATE quick_previews SET spec=?,meta=?,status=?,stage=?,message=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(spec),JSON.stringify(meta),change.status||current.status,change.stage||current.stage,change.message||current.message,now(),id);return get(id);
  }
  function prior(key,signature){const p=db.prepare('SELECT * FROM quick_preview_requests WHERE request_key=?').get(key);if(!p)return null;if(p.request_hash!==signature)throw new HttpError(409,'Request reference was used for different details.');return get(p.preview_id);}
  function startRefinement(id,key){
    if(closed)return;
    const current=get(id);
    if(workers.has(id))return;
    if(!research.configured()){update(id,undefined,{status:'ready',stage:'local',message:'Initial estimated model ready. AI research is not configured on this PC.',meta:{basis:current.meta.basis}});return;}
    if(workers.size){update(id,undefined,{status:'ready',stage:'deferred',message:'Your estimate is ready. Another building is being researched; refine this one afterwards.'});return;}
    const count=db.prepare('SELECT count(*) AS n FROM quick_preview_runs WHERE started_at>?').get(new Date(Date.now()-3600000).toISOString()).n;
    if(count>=6){update(id,undefined,{status:'ready',stage:'budget',message:'Your local estimate is ready. The six-refinements-per-hour development budget has been reached.'});return;}
    if(db.prepare('SELECT id FROM quick_preview_runs WHERE request_key=?').get(key))return;
    const runId=randomUUID(),epoch=current.epoch+1,controller=new AbortController(),usage={responses:0,inputTokens:0,outputTokens:0,searchCalls:0};
    db.prepare("UPDATE quick_previews SET epoch=?,status='refining',stage='research',version=version+1 WHERE id=?").run(epoch,id);
    db.prepare('INSERT INTO quick_preview_runs VALUES(?,?,?,?,?,?)').run(runId,id,key,now(),'running',JSON.stringify(usage));
    const timer=setTimeout(()=>controller.abort(new Error('deadline')),deadlineMs);timer.unref();
    const onProgress=async progress=>{
      if(controller.signal.aborted||closed)return;
      const meta={};for(const field of ['basis','references','photos','usage'])if(progress[field]!==undefined)meta[field]=progress[field];
      update(id,epoch,{...progress,meta,status:'refining'});
      db.prepare('UPDATE quick_preview_runs SET usage=? WHERE id=?').run(JSON.stringify(usage),runId);
    };
    // Store and return the initial spec before scheduling any external request.
    const promise=new Promise(resolve=>setImmediate(resolve)).then(async()=>{
      if(controller.signal.aborted||closed)return;
      const result=await research.run({name:current.name,postcode:current.postcode,spec:current.spec,signal:controller.signal,usage,onProgress});
      if(controller.signal.aborted||closed)return;
      update(id,epoch,{spec:result.spec,status:'ready',stage:'complete',message:result.message,meta:{basis:result.basis,references:result.references,photos:result.photos,usage,error:null}});
    }).catch(error=>{
      if(closed)return;
      const safe=error instanceof ResearchError?{code:error.code,message:error.message,retryAfterSeconds:error.retryAfterSeconds||0}:{code:controller.signal.aborted?'STOPPED':'REFINEMENT_FAILED',message:controller.signal.aborted?'Refinement stopped. Your last usable model is preserved.':'Refinement could not finish. Your last usable estimate is preserved.'};
      update(id,epoch,{status:'ready',stage:'fallback',message:safe.message,meta:{usage,error:safe}});
    }).finally(()=>{
      clearTimeout(timer);
      db.prepare('UPDATE quick_preview_runs SET status=?,usage=? WHERE id=?').run(controller.signal.aborted?'interrupted':get(id).stage==='complete'?'completed':'stopped',JSON.stringify(usage),runId);
      workers.delete(id);
    });workers.set(id,{controller,promise});
  }
  return {
    get,
    config(){return {researchConfigured:Boolean(research.configured()),limits:RESEARCH_LIMITS};},
    list(){return db.prepare('SELECT id,name,postcode,building_id,status,stage,updated_at,spec,meta FROM quick_previews ORDER BY updated_at DESC LIMIT 60').all().map(({spec,meta,...row})=>{
      const model=JSON.parse(spec),details=JSON.parse(meta);
      return {...row,basis:details.basis,matchBasis:model.matchBasis,storeys:Math.max(...model.blocks.map(b=>b.floors)),blocks:model.blocks.length};
    });},
    create(input){
      record(input);const name=text(input.name,'Building name',150),postcode=normalisePostcode(input.postcode),key=requestKey(input.requestKey);
      if(normalName(name).length<2)throw new HttpError(400,'Enter a building name and postcode.');
      if(input.allowProcessing!==true)throw new HttpError(400,'Starting a preview requires processing consent.');
      const propertyKey=normalName(name)+'|'+postcode,signature=hash({propertyKey});
      const p=prior(key,signature);if(p)return {...p,duplicate:true};
      const existing=db.prepare('SELECT id FROM quick_previews WHERE property_key=?').get(propertyKey);
      if(existing){db.prepare('INSERT INTO quick_preview_requests VALUES(?,?,?)').run(key,signature,existing.id);return {...get(existing.id),duplicate:true};}
      const matched=workspace.buildings().filter(b=>normalName(b.name)===normalName(name)&&b.postcode===postcode);
      const building=matched[0]||workspace.addBuilding({name,address:name+', '+postcode,postcode});
      const spec=defaultSpec(name),meta={basis:'generic-starting-estimate',references:[],photos:[],events:[],usage:{responses:0,inputTokens:0,outputTokens:0,searchCalls:0},error:null,existingModel:!!building.model_key,buildingRecordMatch:matched.length>1?'multiple local records - first selected':matched.length?'name and postcode matched':'new unverified record'};
      previewModel(spec);const id=randomUUID(),time=now();
      db.prepare('INSERT INTO quick_previews(id,property_key,building_id,name,postcode,spec,meta,status,stage,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,propertyKey,building.id,name,postcode,JSON.stringify(spec),JSON.stringify(meta),'ready','initial','Initial concept ready. Building research will refine it where possible.',time,time);
      db.prepare('INSERT INTO quick_preview_requests VALUES(?,?,?)').run(key,signature,id);
      startRefinement(id,key);return get(id);
    },
    refine(id,input){
      record(input);const current=get(id),key=requestKey(input.requestKey);
      if(input.allowProcessing!==true)throw new HttpError(400,'Approve this additional refinement.');
      const old=db.prepare('SELECT preview_id FROM quick_preview_runs WHERE request_key=?').get(key);
      if(old){if(old.preview_id!==id)throw new HttpError(409,'Request reference belongs to a different preview.');return current;}
      if(input.version!==current.version)throw new HttpError(409,'Preview changed; reload before refining.');
      const wait=current.meta.error?.retryAfterSeconds||0;if(wait&&(Date.now()-Date.parse(current.updated_at))/1000<wait)throw new HttpError(429,'Wait for the provider retry interval before refining again.');
      startRefinement(id,key);return get(id);
    },
    stop(id){const current=get(id);workers.get(id)?.controller.abort();db.prepare('UPDATE quick_previews SET epoch=epoch+1 WHERE id=?').run(id);return update(id,undefined,{status:'ready',stage:'stopped',message:'Research stopped. Your last usable model is saved.'});},
    edit(id,input){
      record(input);const current=get(id);if(input.version!==current.version)throw new HttpError(409,'Preview changed. Refresh before saving your adjustment.');
      let spec;try{spec=validateSpec(input.spec);previewModel(spec);}catch{throw new HttpError(422,'Check the estimated dimensions and roof settings. Nothing has been saved.');}
      // A completed local edit is atomic and has one persistent undo point.
      spec.facts=[];spec.usedPhotoIds=[];spec.assumptions=[...spec.assumptions.slice(0,28),'Dimensions or appearance were adjusted by the user, not measured.'];
      workers.get(id)?.controller.abort();
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('UPDATE quick_previews SET epoch=epoch+1 WHERE id=?').run(id);
        const saved=update(id,undefined,{spec,status:'ready',stage:'adjusted',message:'Your estimated shape has been saved. It is not a measured model.',meta:{basis:'user-adjusted-estimate',error:null}});
        db.prepare('INSERT INTO quick_preview_undo VALUES(?,?,?,?) ON CONFLICT(preview_id) DO UPDATE SET spec=excluded.spec,meta=excluded.meta,after_version=excluded.after_version').run(id,JSON.stringify(current.spec),JSON.stringify(current.meta),saved.version);
        db.exec('COMMIT');return get(id);
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    undo(id,input){
      record(input);const current=get(id),previous=db.prepare('SELECT * FROM quick_preview_undo WHERE preview_id=?').get(id);
      if(input.version!==current.version||!previous||previous.after_version!==current.version)throw new HttpError(409,'This undo is no longer current. Reload the saved model first.');
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('UPDATE quick_previews SET epoch=epoch+1 WHERE id=?').run(id);
        db.prepare('DELETE FROM quick_preview_undo WHERE preview_id=?').run(id);
        const saved=update(id,undefined,{spec:JSON.parse(previous.spec),meta:{...JSON.parse(previous.meta),error:null},status:'ready',stage:'restored',message:'Your previous estimate has been restored. No AI request was made.'});
        db.exec('COMMIT');return saved;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    glb(id){const p=get(id);return previewGLB(p.spec,{sources:p.meta.references,photoCredits:p.meta.photos,title:p.name,postcode:p.postcode});},
    async close(){closed=true;for(const {controller} of workers.values())controller.abort();await Promise.allSettled([...workers.values()].map(w=>w.promise));
      db.prepare("UPDATE quick_previews SET status='ready',stage='interrupted',message='PC server stopped. The last estimate is saved; refinement was not automatically retried.',version=version+1 WHERE status='refining'").run();}
  };
}
