import { randomUUID, createHash } from 'node:crypto';
import { stat, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError, text, normalisePostcode } from '../validation.mjs';
import { createEvidenceAI, safeReference } from '../evidence/ai.mjs';
import { documentDownloader, fileType } from '../evidence/download.mjs';
import { createProviders } from '../auto-model/providers.mjs';
import { toModel, validateGraph } from '../../../packages/evidence/graph.mjs';
import { glb } from '../../../packages/auto-model/geometry.mjs';
import { alignGraphs } from '../../../packages/concierge/alignment.mjs';
import { VERSION, ReviewNeeded, requestInput, catalogInput, propertyKey, nameKey, planBatches, footprintModel, MAX_BATCH_BYTES } from './policy.mjs';

const RUNNING=['queued','identifying','preparing','importing','reconstructing','validating','searching'];
const TITLES={queued:'Your request is saved',identifying:'Finding your building',preparing:'Checking available building information',importing:'Collecting approved drawings',reconstructing:'Building your 3D preview',validating:'Checking the model',searching:'Searching planning references',choosing:'Which building is yours?',ready:'Your building preview is ready',exterior_ready:'Your exterior preview is ready',review_required:'PropertyChecked review required',cancelled:'Request cancelled'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stamp=()=>new Date().toISOString();

/** Local-owner orchestration. No public tenant boundary is claimed by the customer-style UI. */
export function createConcierge({workspace,store,workflow,uploadDir,ai=createEvidenceAI(),download=documentDownloader(),resolveLocation=createProviders().resolve,configured=()=>Boolean(process.env.OPENAI_API_KEY),send,jsonBody,readBody}){
  const db=workspace.db;let active=null,closing=false,scheduled=false;
  db.exec(`CREATE TABLE IF NOT EXISTS automatic_packs(id TEXT PRIMARY KEY,property_key TEXT UNIQUE NOT NULL,definition TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS automatic_requests(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,property_key TEXT NOT NULL,input TEXT NOT NULL,building_id TEXT REFERENCES buildings(id),status TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,steps TEXT NOT NULL DEFAULT '[]',candidates TEXT NOT NULL DEFAULT '[]',refs TEXT NOT NULL DEFAULT '[]',result TEXT,private_note TEXT NOT NULL DEFAULT '',review_note TEXT NOT NULL DEFAULT '',review_needed INTEGER NOT NULL DEFAULT 0,call_count INTEGER NOT NULL DEFAULT 0,retries INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS automatic_property ON automatic_requests(property_key);
    CREATE TABLE IF NOT EXISTS automatic_usage(id TEXT PRIMARY KEY,kind TEXT NOT NULL,created_at TEXT NOT NULL);
    UPDATE automatic_requests SET status='review_required',review_needed=1,private_note='SERVER_RESTART: work interrupted; no paid call retried automatically.',version=version+1 WHERE status IN ('queued','identifying','preparing','importing','reconstructing','validating','searching');`);
  function get(id){
    const r=db.prepare('SELECT * FROM automatic_requests WHERE id=?').get(id);if(!r)throw new HttpError(404,'Building request not found.');
    return {...r,input:JSON.parse(r.input),steps:JSON.parse(r.steps),candidates:JSON.parse(r.candidates),refs:JSON.parse(r.refs),result:r.result?JSON.parse(r.result):null};
  }
  function update(id,fields){
    const allowed=['building_id','status','steps','candidates','refs','result','private_note','review_note','review_needed','call_count','retries'];
    const entries=Object.entries(fields).filter(([k])=>allowed.includes(k));if(!entries.length)return get(id);
    db.prepare(`UPDATE automatic_requests SET ${entries.map(([k])=>k+'=?').join(',')},updated_at=?,version=version+1 WHERE id=?`).run(...entries.map(([k,v])=>['steps','candidates','refs','result'].includes(k)?JSON.stringify(v):v),stamp(),id);return get(id);
  }
  function step(id,status){return update(id,{status,steps:[...get(id).steps,{stage:status,at:stamp()}].slice(-50)});}
  function review(id,reason){step(id,'review_required');return update(id,{review_needed:1,private_note:reason});}
  function packs(){return db.prepare('SELECT * FROM automatic_packs').all().map(r=>({...r,definition:JSON.parse(r.definition)}));}
  function packFor(r){
    const matches=packs().filter(p=>p.property_key===r.property_key||p.definition.postcode===r.input.postcode&&p.definition.aliases.some(a=>nameKey(a)===nameKey(r.input.name)));
    if(matches.length>1)throw new ReviewNeeded('PROPERTY_MATCH','More than one approved source pack matches this name/postcode. Staff must resolve the aliases.');
    return matches[0]?.definition;
  }
  function check(id,signal){if(closing||signal.aborted||get(id).status==='cancelled')throw new ReviewNeeded('CANCELLED','Cancelled before further processing.');}
  function consume(id,kind){
    const since=new Date(Date.now()-3600000).toISOString(),count=db.prepare('SELECT count(*) AS n FROM automatic_usage WHERE kind=? AND created_at>?').get(kind,since).n;
    if(count>=12)throw new ReviewNeeded('PROCESSING_BUDGET','The local hourly processing budget has been reached. Staff must wait and review before resuming.');
    const r=get(id);if(kind==='ai'&&r.call_count>=5)throw new ReviewNeeded('AI_BUDGET','This request has reached its automatic AI-call budget. Staff must complete it in the drawing workspace.');
    db.prepare('INSERT INTO automatic_usage VALUES(?,?,?)').run(randomUUID(),kind,stamp());
    if(kind==='ai')update(id,{call_count:r.call_count+1});
  }
  function publicView(r){
    return {id:r.id,name:r.input.name,postcode:r.input.postcode,buildingId:r.building_id,status:r.status,title:TITLES[r.status],version:r.version,
      steps:r.steps.map(s=>({stage:s.stage,title:TITLES[s.stage],at:s.at})),candidates:r.status==='choosing'?r.candidates:[],
      result:r.result?{kind:r.result.kind,label:r.result.label,revision:r.result.draftId||r.updated_at}:null,reviewRequired:Boolean(r.review_needed),createdAt:r.created_at,updatedAt:r.updated_at,
      message:r.status==='review_required'?'We need to check the available information before showing a reliable preview. This request is saved in the local PropertyChecked review queue; no model has been invented.':r.status==='exterior_ready'?'The exterior is based on approved footprint data. Heights may be estimated; interiors and condition are not assessed.':r.status==='ready'?'This is a building preview, not a site survey or confirmation of compliance.':r.status==='choosing'?'More than one record may match, or its postcode is not recorded. Confirm the intended building to continue.':r.status==='cancelled'?'No further processing will run. Any provider usage already incurred may still be charged.':'You can leave this page and return to check progress. Keep the local PC server running.'};
  }
  function candidatesFor(r,pack){
    const aliases=[nameKey(r.input.name),...(pack?.aliases||[]).map(nameKey),...(pack?[nameKey(pack.name)]:[])];
    return workspace.buildings().filter(b=>{let postcode='';try{postcode=b.postcode?normalisePostcode(b.postcode):'';}catch{return false;}return aliases.includes(nameKey(b.name))&&(!postcode||postcode===r.input.postcode);}).map(b=>({id:b.id,name:b.name,address:b.address,postcode:b.postcode}));
  }
  async function intactSources(sources,max=MAX_BATCH_BYTES){
    const buffers=[];let total=0;
    for(const s of sources){
      const d=workspace.document(s.documentId),path=join(uploadDir,d.storage_name);
      if(d.building_id!==s.buildingId)throw new ReviewNeeded('SOURCE_OWNER','Source ownership changed. Staff must review the register.');
      const info=await stat(path).catch(()=>{throw new ReviewNeeded('SOURCE_MISSING','A registered drawing is missing on disk.');});
      if(info.size>max||(total+=info.size)>64*1024*1024)throw new ReviewNeeded('PAGE_PROCESSING','Source files exceed the automatic read budget. Staff must prepare page groups.');
      const bytes=await readFile(path);if(sha(bytes)!==s.sha256)throw new ReviewNeeded('SOURCE_CHANGED','A source changed on disk. Re-register the correct drawing revision.');buffers.push(bytes);
    }
    return buffers;
  }
  async function importPinned(id,bid,source,pack,signal){
    const prior=store.sources(bid).find(s=>s.sha256===source.sha256&&s.role===source.role&&s.scenario===source.scenario&&s.revision===source.revision&&s.rights!=='pending');
    if(prior)return prior;
    check(id,signal);consume(id,'import');
    const data=await download(source.url,signal);check(id,signal);
    // Check the approved revision BEFORE registering it or sending any bytes to AI.
    if(sha(data.bytes)!==source.sha256)throw new ReviewNeeded('SOURCE_REVISION_CHANGED','The remote document no longer matches the staff-approved hash. No source was registered or sent to AI.');
    if(data.bytes.length>MAX_BATCH_BYTES)throw new ReviewNeeded('PAGE_PROCESSING','The approved remote document needs a smaller page group.');
    const type=fileType(data.bytes),storageName=randomUUID(),path=join(uploadDir,storageName);
    const name=source.name.toLowerCase().endsWith(type.extension)?source.name:source.name+type.extension;
    await mkdir(uploadDir,{recursive:true});await writeFile(path,data.bytes,{flag:'wx',mode:0o600});
    try{
      check(id,signal);db.exec('BEGIN IMMEDIATE');
      try{
        // One transaction owns both document and source; do not nest addDocument's transaction.
        const documentId=randomUUID();
        db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)').run(documentId,bid,name,type.mime,data.bytes.length,storageName,source.sha256,stamp());
        const registered=store.addSource(bid,{documentId,role:source.role,scenario:source.scenario,revision:source.revision,floorLabel:source.floorLabel,rights:'permission',rightsNote:pack.rightsNote,sourceUrl:source.url,notes:'Operator-approved automatic source pack; exact file hash checked before registration.',buildingConfirmed:true});
        db.exec('COMMIT');return registered;
      }catch(error){db.exec('ROLLBACK');throw error;}
    }catch(error){await unlink(path).catch(()=>{});throw error;}
  }
  async function existing(id,bid,signal){
    const d=workflow.active(bid).draft;
    if(d&&d.review_state==='reviewed-not-surveyed'&&d.graph.floors.length){
      validateGraph(d.graph,store.sources(bid));await intactSources(d.sources,25*1024*1024);check(id,signal);
      update(id,{result:{kind:'evidence',draftId:d.id,label:'Reviewed drawing model / not site surveyed'}});step(id,'ready');return true;
    }
    const b=workspace.building(bid);
    if(b.model_key==='marketfield'&&workspace.manifest){update(id,{result:{kind:'marketfield',label:'Existing plan-derived + estimated model'}});step(id,'ready');return true;}
    if(b.model_key==='auto-exterior'){workspace.generatedModel(bid);update(id,{result:{kind:'saved-exterior',label:'Existing exterior preview / not surveyed'}});step(id,'exterior_ready');return true;}
    return false;
  }
  function exterior(id,pack,note=''){
    update(id,{result:{kind:'exterior',model:footprintModel(pack),label:'Approved dataset exterior / height assumptions retained'},review_needed:note?1:0,private_note:note});step(id,'exterior_ready');
  }
  async function build(id,signal){
    const r=get(id);step(id,'identifying');const pack=packFor(r);let bid=r.building_id;
    if(!bid){
      const matches=candidatesFor(r,pack);
      if(matches.length>1||matches.length===1&&!matches[0].postcode){update(id,{candidates:matches});step(id,'choosing');return;}
      bid=matches[0]?.id||workspace.addBuilding({name:pack?.name||r.input.name,postcode:r.input.postcode,address:pack?.address||''}).id;
      update(id,{building_id:bid});
    }
    check(id,signal);step(id,'preparing');if(await existing(id,bid,signal))return;
    const hasKey=configured(),available=store.sources(bid).filter(s=>s.rights!=='pending');
    if(pack?.footprint&&!pack.remoteSources.length&&!(pack.sourceIds.length||available.length)){exterior(id,pack);return;}
    const imported=[];
    if(pack?.remoteSources.length){step(id,'importing');for(const source of pack.remoteSources){check(id,signal);imported.push(await importPinned(id,bid,source,pack,signal));}}
    let sources=store.sources(bid);
    if(pack&&(pack.sourceIds.length||pack.remoteSources.length)){
      const selected=new Set([...pack.sourceIds,...imported.map(s=>s.id)]);sources=sources.filter(s=>selected.has(s.id));
      if(pack.sourceIds.some(id=>!sources.some(s=>s.id===id)))throw new ReviewNeeded('SOURCE_MISSING','An approved source ID is not registered against this property.');
    }
    if(!sources.some(s=>s.rights!=='pending'&&s.role!=='photo')){
      if(pack?.footprint){exterior(id,pack);return;}
      if(!hasKey)throw new ReviewNeeded('AI_SETUP','No approved geometry is installed and the operator AI account is not configured.');
      step(id,'searching');let locality='';
      try{const point=await resolveLocation(r.input.postcode);locality=String(point.label||'').slice(0,200);}catch{/* A postcode outage does not stop the named-property reference search. */}
      check(id,signal);consume(id,'ai');
      const found=await ai.discover({query:[r.input.name,pack?.address||'',r.input.postcode,locality,'planning drawings existing building'].filter(Boolean).join(', '),domain:''},signal);
      check(id,signal);const refs=(found.references||[]).filter(s=>safeReference(s.url)).slice(0,12).map(s=>({url:safeReference(s.url),title:String(s.title||'Planning reference').slice(0,220)}));update(id,{refs});
      throw new ReviewNeeded(refs.length?'REFERENCES_REVIEW':'NO_REFERENCES',refs.length?'Planning references were found. Staff must confirm the property, drawing scheme and reuse rights before approving sources.':'No usable indexed planning references were returned. Staff must acquire approved geometry or drawings.');
    }
    if(!hasKey)throw new ReviewNeeded('AI_SETUP','Approved drawings exist, but the operator AI account is not configured.');
    const plan=planBatches(sources,{allowProposed:pack?.allowProposed}),drafts=[];step(id,'reconstructing');
    for(const [index,batch] of plan.batches.entries()){
      check(id,signal);const buffers=await intactSources(batch);check(id,signal);consume(id,'ai');
      const {graph,model}=await ai.reconstruct({title:workspace.building(bid).name,scenario:plan.scenario,sources:batch,buffers,
        notes:'Automatic preview. Interpret only the floors in this group. Use drawing datum elevations and a unique lift/stair pair only when visible. Do not invent scale, shared references, hidden details or current built condition. Record unsupported information in unknowns.'},signal);
      check(id,signal);if(graph.scenario!==plan.scenario)throw new ReviewNeeded('SCHEME_MISMATCH','The interpretation returned another drawing scheme.');
      const draft=store.saveDraft(bid,graph,'automatic-openai:'+model,id+'-batch-'+r.retries+'-'+index,batch);drafts.push(draft);
      if(!draft.graph.floors.length||draft.graph.conflicts.length)throw new ReviewNeeded('DRAWING_REVIEW','A floor group has no supported geometry or unresolved conflicts. Its draft is available to staff.');
    }
    step(id,'validating');check(id,signal);const graph=alignGraphs(drafts.map(d=>d.graph));
    if(plan.omitted.length)graph.unknowns.push('Some optional context sources did not fit the automatic groups. Staff should check the complete evidence pack.');
    const selected=[...new Map(drafts.flatMap(d=>d.sources).map(s=>[s.id,s])).values()];
    const final=store.saveDraft(bid,graph,'automatic-preview',id+'-result-'+r.retries,selected);check(id,signal);
    update(id,{result:{kind:'evidence',draftId:final.id,label:plan.scenario==='proposed'?'Proposed design preview / not current as-built':'AI drawing preview / not site surveyed'},review_needed:1,private_note:'PREVIEW_QA: automatic interpretation needs drawing quality review. It has not been marked reviewed or substituted for the original workspace model.'});step(id,'ready');
  }
  function schedule(){if(scheduled||active||closing)return;scheduled=true;setImmediate(()=>{scheduled=false;pump();});}
  function pump(){
    if(active||closing)return;const row=db.prepare("SELECT id FROM automatic_requests WHERE status='queued' ORDER BY created_at LIMIT 1").get();if(!row)return;
    const controller=new AbortController();
    const promise=build(row.id,controller.signal).catch(error=>{
      if(controller.signal.aborted||get(row.id).status==='cancelled')return;
      const reason=error instanceof ReviewNeeded?error.code+': '+error.message:error instanceof HttpError?'PROVIDER_OR_DATA: '+error.message:'PROCESSING_ERROR: automatic processing did not complete safely. Staff should inspect the source pack.';
      let pack;try{pack=packFor(get(row.id));}catch{/* Ambiguous identity stays in review. */}
      if(pack?.footprint&&get(row.id).building_id)exterior(row.id,pack,reason);else review(row.id,reason);
    }).finally(()=>{active=null;schedule();});active={id:row.id,controller,promise};
  }
  function create(input){
    if(closing)throw new HttpError(503,'Server is stopping.');const data=requestInput(input),key=propertyKey(data.name,data.postcode);
    const same=db.prepare('SELECT id,property_key FROM automatic_requests WHERE request_key=?').get(data.requestKey);
    if(same){if(same.property_key!==key)throw new HttpError(409,'Request reference was used for another building.');return {...publicView(get(same.id)),duplicate:true};}
    const previous=db.prepare('SELECT id FROM automatic_requests WHERE property_key=? ORDER BY created_at DESC LIMIT 1').get(key);if(previous)return {...publicView(get(previous.id)),duplicate:true};
    const count=db.prepare('SELECT count(*) AS n FROM automatic_requests WHERE created_at>?').get(new Date(Date.now()-600000).toISOString()).n;
    if(count>=10)throw new HttpError(429,'Please wait before creating another building request.');
    const id=randomUUID(),time=stamp();db.prepare('INSERT INTO automatic_requests(id,request_key,property_key,input,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,data.requestKey,key,JSON.stringify(data),'queued',time,time);schedule();return publicView(get(id));
  }
  function expected(r,input){if(input.version!==r.version)throw new HttpError(409,'The request changed. Reload before updating it.');}
  function putPack(input){
    const definition=catalogInput(input),key=propertyKey(definition.name,definition.postcode),old=db.prepare('SELECT id,version FROM automatic_packs WHERE property_key=?').get(key);
    if(old&&input.expectedVersion!==old.version)throw new HttpError(409,'To replace an approved source pack, provide its current expectedVersion.');
    const id=old?.id||randomUUID();db.prepare('INSERT INTO automatic_packs VALUES(?,?,?,1,?) ON CONFLICT(property_key) DO UPDATE SET definition=excluded.definition,version=version+1,updated_at=excluded.updated_at').run(id,key,JSON.stringify(definition),stamp());return {id,version:(old?.version||0)+1};
  }
  async function model(id){
    const r=get(id);if(!['ready','exterior_ready'].includes(r.status)||!r.result)throw new HttpError(409,'The building preview is not ready.');
    if(r.result.kind==='marketfield')return {kind:'marketfield',viewerUrl:'/api/models/marketfield/viewer?embed=1',label:r.result.label};
    if(r.result.kind==='evidence'){const d=store.draft(r.building_id,r.result.draftId);validateGraph(d.graph,store.sources(r.building_id));await intactSources(d.sources,25*1024*1024);return {kind:'evidence',model:toModel(d.graph),graph:d.graph,label:r.result.label};}
    return {kind:'exterior',model:r.result.kind==='saved-exterior'?workspace.generatedModel(r.building_id):r.result.model,label:r.result.label};
  }
  return {
    create,get,publicView,putPack,model,
    async idle(){while(!closing&&(active||scheduled||db.prepare("SELECT id FROM automatic_requests WHERE status='queued' LIMIT 1").get())){if(active)await active.promise;else await new Promise(r=>setImmediate(r));}},
    async close(){closing=true;if(active){active.controller.abort();review(active.id,'SERVER_STOP: processing interrupted. Staff may resume explicitly; paid calls are not replayed.');await active.promise;}},
    async handle(req,res,path,method){
      if(!path.startsWith('/api/concierge/'))return false;if(closing)throw new HttpError(503,'The PC server is stopping.');
      if(path==='/api/concierge/config'&&method==='GET'){send(req,res,200,{version:VERSION,localOnly:true,consent:'Create building uses available approved records and, when enabled by the operator, Postcodes.io and OpenAI search/interpretation. The operator account may incur API usage. No payment is collected from the customer. Keep the local PC running.'});return true;}
      if(path==='/api/concierge/requests'&&method==='POST'){send(req,res,202,create(await jsonBody(req)));return true;}
      if(path==='/api/concierge/requests'&&method==='GET'){send(req,res,200,db.prepare('SELECT id FROM automatic_requests ORDER BY created_at DESC LIMIT 100').all().map(r=>publicView(get(r.id))));return true;}
      if(path==='/api/concierge/admin/queue'&&method==='GET'){send(req,res,200,{localOwnerOnly:true,aiConfigured:configured(),packs:packs(),requests:db.prepare("SELECT id FROM automatic_requests WHERE review_needed=1 OR status IN ('choosing','cancelled') ORDER BY created_at LIMIT 100").all().map(r=>get(r.id))});return true;}
      if(path==='/api/concierge/admin/catalog'&&method==='POST'){
        if(!String(req.headers['content-type']).startsWith('application/json'))throw new HttpError(415,'Expected JSON.');let input;try{input=JSON.parse((await readBody(req,512*1024)).toString('utf8'));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Invalid source-pack JSON.');}send(req,res,201,putPack(input));return true;
      }
      const m=path.match(/^\/api\/concierge\/requests\/([a-zA-Z0-9-]+)(?:\/(choose|cancel|resume|review|model|model\.glb))?$/);
      if(!m)throw new HttpError(404,'Automatic-building route not found.');const r=get(m[1]),action=m[2];
      if(!action&&method==='GET'){send(req,res,200,publicView(r));return true;}
      if(['model','model.glb'].includes(action)&&method==='GET'){
        const value=await model(r.id);if(action==='model.glb'){if(!value.model)throw new HttpError(409,'Use the original model export in the building workspace.');res.setHeader('Content-Disposition','attachment; filename="propertychecked-building-preview.glb"');send(req,res,200,Buffer.from(glb(value.model)),'model/gltf-binary');}else send(req,res,200,value);return true;
      }
      if(method==='POST'){
        const input=await jsonBody(req);expected(r,input);
        if(action==='choose'){
          if(r.status!=='choosing'||!r.candidates.some(c=>c.id===input.buildingId)||input.confirm!==true)throw new HttpError(400,'Choose one of the matching building records.');
          update(r.id,{building_id:input.buildingId,candidates:[],status:'queued'});schedule();
        }else if(action==='cancel'){
          if(!RUNNING.includes(r.status)&&r.status!=='choosing')throw new HttpError(409,'This request is no longer running.');
          if(active?.id===r.id)active.controller.abort();step(r.id,'cancelled');
        }else if(action==='resume'){
          if(!['review_required','cancelled','ready','exterior_ready'].includes(r.status)||active?.id===r.id||input.allowProcessing!==true)throw new HttpError(409,'Review this request and approve a new attempt first.');
          if(r.retries>=3)throw new HttpError(429,'Automatic retry limit reached. Complete the request in the staff drawing workspace.');
          const note=text(input.note,'Staff action taken',800);update(r.id,{retries:r.retries+1,status:'queued',result:null,review_needed:0,review_note:note,private_note:''});schedule();
        }else if(action==='review'){
          if(r.status!=='ready'||r.result?.kind!=='evidence'||input.acknowledge!==true)throw new HttpError(409,'Inspect a completed evidence preview before recording drawing review.');
          const note=text(input.note,'Review note',800),d=store.draft(r.building_id,r.result.draftId);await intactSources(d.sources,25*1024*1024);expected(get(r.id),input);
          store.review(r.building_id,d.id,{version:d.version,acknowledge:true});update(r.id,{review_needed:0,review_note:note,private_note:'Drawing review recorded; not a site survey.'});
        }else throw new HttpError(405,'Method not allowed.');send(req,res,200,publicView(get(r.id)));return true;
      }
      throw new HttpError(405,'Method not allowed.');
    }
  };
}
