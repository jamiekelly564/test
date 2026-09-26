import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createProviders } from '../auto-model/providers.mjs';
import { HttpError, text, choice, filenameInput } from '../validation.mjs';
import { digest, ROLES } from './store.mjs';
import { documentDownloader, publicURL, fileType } from './download.mjs';
import { accountSettings, checkAccount } from './account.mjs';
import { assembleDrafts } from '../../../packages/evidence/assemble.mjs';
import { SCENARIOS, validateGraph } from '../../../packages/evidence/graph.mjs';

const stamp=()=>new Date().toISOString();
export function createWorkflow({workspace,store,uploadDir,send,jsonBody,download=documentDownloader(),verifyAI=checkAccount,resolveLocation=createProviders().resolve}){
  const db=workspace.db,imports=new Map(),controllers=new Set();let calls=[],checkAt=0,closed=false,locationBusy=false,locationCalls=[];
  db.exec(`CREATE TABLE IF NOT EXISTS evidence_active(building_id TEXT PRIMARY KEY REFERENCES buildings(id),draft_id TEXT REFERENCES evidence_drafts(id),draft_version INTEGER,version INTEGER NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence_imports(request_key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,building_id TEXT NOT NULL REFERENCES buildings(id),source_id TEXT NOT NULL REFERENCES evidence_sources(id));`);
  const event=(bid,type,summary)=>db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(randomUUID(),bid,type,summary,stamp());
  const key=value=>{const k=text(value,'Request reference',70);if(!/^[a-zA-Z0-9-]{12,70}$/.test(k))throw new HttpError(400,'Invalid request reference.');return k;};
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
  function active(bid){workspace.building(bid);const row=db.prepare('SELECT * FROM evidence_active WHERE building_id=?').get(bid);return {version:row?.version||0,updatedAt:row?.updated_at||null,draft:row?.draft_id?store.draft(bid,row.draft_id):null};}
  async function checkSourceFiles(sources){for(const s of sources){const d=workspace.document(s.documentId),path=join(uploadDir,d.storage_name);let info;try{info=await stat(path);}catch{throw new HttpError(409,'A source file is missing. Restore it before publishing the model.');}if(info.size>25*1024*1024)throw new HttpError(413,'A source file exceeds the size limit.');const b=await readFile(path);if(createHash('sha256').update(b).digest('hex')!==s.sha256)throw new HttpError(409,'A source changed on disk. Register the new revision before publishing.');}}
  async function importSource(bid,input){
    workspace.building(bid);
    if(input.allowExternal!==true||input.buildingConfirmed!==true)throw new HttpError(400,'Approve the external download and confirm the exact building.');
    const requestKey=key(input.requestKey),url=publicURL(text(input.url,'Document URL',1800)).href;
    const metadata={role:choice(input.role,'source role',ROLES),scenario:choice(input.scenario,'drawing status',SCENARIOS),rights:choice(input.rights,'reuse permission',['owned','licensed','permission']),rightsNote:text(input.rightsNote,'Rights details',800),revision:text(input.revision,'Revision',100,false),floorLabel:text(input.floorLabel,'Floor label',100,false),notes:text(input.notes,'Source notes',1200,false),buildingConfirmed:true,sourceUrl:url};
    const name=filenameInput(text(input.name,'File name',200)),hash=digest({bid,url,name,metadata});
    const previous=db.prepare('SELECT * FROM evidence_imports WHERE request_key=?').get(requestKey);
    if(previous){if(previous.request_hash!==hash||previous.building_id!==bid)throw new HttpError(409,'Import reference reused with different details.');return {source:store.sources(bid).find(s=>s.id===previous.source_id),duplicate:true};}
    if(imports.has(requestKey)){if(imports.get(requestKey).hash!==hash)throw new HttpError(409,'Import already running with different details.');return imports.get(requestKey).promise;}
    if(imports.size)throw new HttpError(429,'One document import is already running. Wait for it to finish.');
    calls=calls.filter(t=>Date.now()-t<3600000);if(calls.length>=12)throw new HttpError(429,'Twelve remote imports per hour are allowed in this local preview. Use local uploads for larger batches.');calls.push(Date.now());
    const controller=new AbortController();controllers.add(controller);
    const promise=(async()=>{
      const result=await download(url,controller.signal);if(closed||controller.signal.aborted)throw new HttpError(409,'Import cancelled.');
      const type=fileType(result.bytes);if(result.bytes.length>25*1024*1024)throw new HttpError(413,'Document exceeds 25 MB.');
      metadata.sourceUrl=publicURL(result.url).href;
      const storageName=randomUUID(),documentId=randomUUID(),filename=name.toLowerCase().endsWith(type.extension)?name:name+type.extension;
      await mkdir(uploadDir,{recursive:true});const path=join(uploadDir,storageName);await writeFile(path,result.bytes,{flag:'wx',mode:0o600});
      try{return tx(()=>{
        db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)').run(documentId,bid,filename,type.mime,result.bytes.length,storageName,createHash('sha256').update(result.bytes).digest('hex'),stamp());
        const source=store.addSource(bid,{...metadata,documentId});
        db.prepare('INSERT INTO evidence_imports VALUES(?,?,?,?)').run(requestKey,hash,bid,source.id);event(bid,'evidence_imported','Imported one user-approved drawing/photo. Reuse permission is user-declared; file has not been sent to AI.');return {source,duplicate:false};
      });}catch(e){await unlink(path).catch(()=>{});throw e;}
    })().finally(()=>{imports.delete(requestKey);controllers.delete(controller);});imports.set(requestKey,{hash,promise});return promise;
  }
  return {
    active,
    async close(){closed=true;for(const c of controllers)c.abort();await Promise.allSettled([...imports.values()].map(v=>v.promise));},
    async handle(req,res,path,method){
      if(!path.startsWith('/api/workflow/'))return false;if(closed)throw new HttpError(503,'Server is stopping.');
      if(path==='/api/workflow/config'&&method==='GET'){send(req,res,200,{...accountSettings(),version:'0.4.0',localOnly:true,automaticNationwideSearch:false});return true;}
      if(path==='/api/workflow/ai/check'&&method==='POST'){
        const input=await jsonBody(req);if(input.allowExternal!==true)throw new HttpError(400,'Approve the OpenAI account check first.');
        if(Date.now()-checkAt<10000)throw new HttpError(429,'Wait ten seconds before checking again.');checkAt=Date.now();send(req,res,200,await verifyAI());return true;
      }
      if(path==='/api/workflow/active'&&method==='GET'){send(req,res,200,db.prepare('SELECT building_id,draft_id,version FROM evidence_active WHERE draft_id IS NOT NULL').all());return true;}
      if(path==='/api/workflow/location'&&method==='POST'){
        const input=await jsonBody(req);if(input.allowExternal!==true)throw new HttpError(400,'Approve the public location lookup first.');
        const value=text(input.input,'Postcode or Maps link',2200);locationCalls=locationCalls.filter(t=>Date.now()-t<60000);
        if(locationBusy||locationCalls.length>=4)throw new HttpError(429,'Wait before another location lookup.');locationBusy=true;locationCalls.push(Date.now());
        try{send(req,res,200,{location:await resolveLocation(value),notice:'Location reference only. Confirm the exact building address before searching drawings. No footprint service contacted.'});}finally{locationBusy=false;}return true;
      }
      const m=path.match(/^\/api\/workflow\/buildings\/([a-zA-Z0-9-]+)\/(import|active|assemble|sources\/([a-zA-Z0-9-]+)\/preview)$/);
      if(!m)throw new HttpError(404,'Workflow route not found.');const [,bid,part,sid]=m;workspace.building(bid);
      if(part==='import'&&method==='POST'){send(req,res,201,await importSource(bid,await jsonBody(req)));return true;}
      if(part==='active'&&method==='GET'){send(req,res,200,active(bid));return true;}
      if(part==='active'&&method==='PUT'){
        const input=await jsonBody(req),id=text(input.draftId,'Draft',100),d=store.draft(bid,id),current=active(bid);
        if(input.acknowledge!==true)throw new HttpError(400,'Confirm this is a reviewed drawing reconstruction, not a site-verified building.');
        if(d.review_state!=='reviewed-not-surveyed'||!d.graph.floors.length)throw new HttpError(409,'Review a draft with geometry before making it the workspace model.');
        if(input.draftVersion!==d.version)throw new HttpError(409,'Draft changed. Reload and review before saving.');
        if(current.draft?.id===id&&current.draft.version===d.version){send(req,res,200,{...current,duplicate:true});return true;}
        if(input.expectedVersion!==current.version)throw new HttpError(409,'Workspace model changed in another tab. Reload before replacing it.');
        try{validateGraph(d.graph,store.sources(bid));}catch(e){throw new HttpError(422,e.message);}await checkSourceFiles(d.sources);
        // Recheck after file IO so concurrent activation cannot silently win.
        const result=tx(()=>{if(active(bid).version!==input.expectedVersion)throw new HttpError(409,'Workspace model changed during review.');db.prepare('INSERT INTO evidence_active VALUES(?,?,?,?,?) ON CONFLICT(building_id) DO UPDATE SET draft_id=excluded.draft_id,draft_version=excluded.draft_version,version=excluded.version,updated_at=excluded.updated_at').run(bid,id,d.version,current.version+1,stamp());event(bid,'workspace_model_selected','Selected a reviewed evidence reconstruction. Original model and records retained; not site verified.');return active(bid);});send(req,res,200,result);return true;
      }
      if(part==='active'&&method==='DELETE'){
        const input=await jsonBody(req),current=active(bid);if(input.expectedVersion!==current.version)throw new HttpError(409,'Workspace model changed. Reload first.');
        if(current.draft)tx(()=>{db.prepare('UPDATE evidence_active SET draft_id=NULL,draft_version=NULL,version=version+1,updated_at=? WHERE building_id=?').run(stamp(),bid);event(bid,'workspace_model_restored','Restored original model view. No evidence drafts or records deleted.');});send(req,res,200,active(bid));return true;
      }
      if(part==='assemble'&&method==='POST'){
        const input=await jsonBody(req);if(input.alignmentConfirmed!==true)throw new HttpError(400,'Confirm common reference points, scale and alignment before combining drafts.');
        if(!Array.isArray(input.placements)||input.placements.length<2||input.placements.length>12||new Set(input.placements.map(p=>p?.draftId)).size!==input.placements.length)throw new HttpError(400,'Select 2 to 12 different drafts.');
        const drafts=input.placements.map(p=>store.draft(bid,text(p.draftId,'Draft',100)));let result;
        try{result=assembleDrafts(drafts,input.placements,{title:workspace.building(bid).name,alignmentNote:text(input.alignmentNote,'Alignment explanation',600)});}catch(e){throw new HttpError(422,e.message);}
        send(req,res,201,store.saveDraft(bid,result.graph,'user-aligned-assembly',key(input.requestKey),result.sources));return true;
      }
      if(sid&&method==='GET'){
        const source=store.sources(bid).find(s=>s.id===sid);if(!source)throw new HttpError(404,'Source not found for this building.');const doc=workspace.document(source.documentId),path=join(uploadDir,doc.storage_name);
        const info=await stat(path).catch(()=>{throw new HttpError(404,'Source file missing.');});if(info.size>25*1024*1024)throw new HttpError(413,'Source file too large.');const bytes=await readFile(path);const type=fileType(bytes);
        if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw new HttpError(409,'Source file changed; preview stopped.');
        res.setHeader('Content-Disposition','inline; filename="evidence'+type.extension+'"');res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; frame-ancestors 'self'");send(req,res,200,bytes,type.mime);return true;
      }
      throw new HttpError(405,'Method not allowed.');
    }
  };
}
