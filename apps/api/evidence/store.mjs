import { randomUUID, createHash } from 'node:crypto';
import { HttpError, record, text, choice } from '../validation.mjs';
import { SCENARIOS, validateGraph } from '../../../packages/evidence/graph.mjs';
import { safeReference } from './ai.mjs';
export const ROLES=['floor-plan','elevation','section','roof-plan','site-plan','photo'];
export const RIGHTS=['owned','licensed','permission','pending'];
export const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const now=()=>new Date().toISOString();
export function evidenceStore(workspace){
  const db=workspace.db;
  db.exec(`CREATE TABLE IF NOT EXISTS evidence_sources(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),metadata TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence_drafts(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),graph TEXT NOT NULL,sources TEXT NOT NULL,method TEXT NOT NULL,review_state TEXT NOT NULL DEFAULT 'unreviewed',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence_jobs(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),kind TEXT NOT NULL,status TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL);
    UPDATE evidence_jobs SET status='interrupted',error='The PC server stopped. This job was not retried or charged again automatically.' WHERE status='running';`);
  const sources=id=>{workspace.building(id);return db.prepare('SELECT s.*,d.mime,d.name,d.sha256,d.size FROM evidence_sources s JOIN documents d ON d.id=s.document_id WHERE s.building_id=? ORDER BY s.created_at').all(id).map(s=>({id:s.id,buildingId:s.building_id,documentId:s.document_id,mime:s.mime,size:s.size,sha256:s.sha256,createdAt:s.created_at,...JSON.parse(s.metadata)}));};
  const draft=(buildingId,id)=>{workspace.building(buildingId);const d=db.prepare('SELECT * FROM evidence_drafts WHERE building_id=? AND id=?').get(buildingId,id);if(!d)throw new HttpError(404,'Draft not found for this building.');return {...d,graph:JSON.parse(d.graph),sources:JSON.parse(d.sources)};};
  const event=(bid,type,summary)=>db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(randomUUID(),bid,type,summary,now());
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
  return {
    sources,draft,
    addSource(buildingId,input){
      workspace.building(buildingId);record(input);const documentId=text(input.documentId,'Document',100),d=workspace.document(documentId);
      if(d.building_id!==buildingId)throw new HttpError(400,'Document belongs to another building.');
      if(db.prepare('SELECT id FROM evidence_sources WHERE document_id=?').get(documentId))throw new HttpError(409,'Document is already registered. Upload a new revision separately.');
      const role=choice(input.role,'source role',ROLES),rights=choice(input.rights,'rights',RIGHTS),scenario=choice(input.scenario,'drawing status',SCENARIOS);
      if(input.buildingConfirmed!==true)throw new HttpError(400,'Confirm this source relates to the selected building.');
      const sourceUrl=text(input.sourceUrl,'Source URL',1800,false);if(sourceUrl&&!safeReference(sourceUrl))throw new HttpError(400,'Use a public HTTPS reference URL, without credentials.');
      const metadata={title:d.name,role,rights,rightsNote:text(input.rightsNote,'Rights or permission details',800,rights!=='pending'),scenario,revision:text(input.revision,'Revision/date',100,false),floorLabel:text(input.floorLabel,'Floor label',100,false),notes:text(input.notes,'Source notes',1200,false),sourceUrl,buildingConfirmed:true};
      const id=randomUUID();db.prepare('INSERT INTO evidence_sources VALUES(?,?,?,?,?)').run(id,buildingId,documentId,JSON.stringify(metadata),now());event(buildingId,'evidence_added','Source added with declared rights and drawing status. Not site verified.');return sources(buildingId).find(s=>s.id===id);
    },
    list(id){workspace.building(id);return {sources:sources(id),drafts:db.prepare('SELECT id,method,review_state,version,created_at FROM evidence_drafts WHERE building_id=? ORDER BY created_at DESC').all(id),jobs:db.prepare('SELECT * FROM evidence_jobs WHERE building_id=? ORDER BY created_at DESC LIMIT 20').all(id).map(j=>({...j,result:j.result?JSON.parse(j.result):null}))};},
    saveDraft(buildingId,graph,method,requestKey,sourceList=sources(buildingId)){
      const hash=digest({buildingId,graph,method});const previous=db.prepare('SELECT id,building_id,request_hash FROM evidence_drafts WHERE request_key=?').get(requestKey);
      if(previous){if(previous.request_hash!==hash||previous.building_id!==buildingId)throw new HttpError(409,'This save reference has different contents.');return draft(buildingId,previous.id);}
      let normalized;try{normalized=validateGraph(graph,sourceList);}catch(e){throw new HttpError(422,e.message);}
      return transaction(()=>{const id=randomUUID();db.prepare('INSERT INTO evidence_drafts(id,building_id,graph,sources,method,created_at,request_key,request_hash) VALUES(?,?,?,?,?,?,?,?)').run(id,buildingId,JSON.stringify(normalized),JSON.stringify(sourceList),method,now(),requestKey,hash);event(buildingId,'reconstruction_draft','New unverified evidence reconstruction saved. Existing model and inspection records unchanged.');return draft(buildingId,id);});
    },
    review(buildingId,id,input){const d=draft(buildingId,id);if(input.version!==d.version)throw new HttpError(409,'Draft changed. Reload before reviewing.');if(input.acknowledge!==true)throw new HttpError(400,'Acknowledge the unresolved items and that this is not site verification.');if(!d.graph.floors.length)throw new HttpError(422,'No geometry to review.');return transaction(()=>{db.prepare("UPDATE evidence_drafts SET review_state='reviewed-not-surveyed',version=version+1 WHERE id=? AND version=?").run(id,input.version);event(buildingId,'drawing_reviewed','Draft reviewed against supplied evidence; not a site survey or compliance decision.');return draft(buildingId,id);});},
    job(id){const j=db.prepare('SELECT * FROM evidence_jobs WHERE id=?').get(id);if(!j)throw new HttpError(404,'Job not found.');return {...j,result:j.result?JSON.parse(j.result):null};},
    priorJob(key,hash){const j=db.prepare('SELECT * FROM evidence_jobs WHERE request_key=?').get(key);if(!j)return null;if(j.request_hash!==hash)throw new HttpError(409,'Job reference reused with different details.');return {...j,result:j.result?JSON.parse(j.result):null};},
    startJob(bid,kind,key,hash){const id=randomUUID();db.prepare("INSERT INTO evidence_jobs(id,building_id,kind,status,request_key,request_hash,created_at) VALUES(?,?,?,'running',?,?,?)").run(id,bid,kind,key,hash,now());event(bid,'evidence_job',`${kind} explicitly requested by the local user.`);return this.job(id);},
    finishJob(id,status,result,error){db.prepare("UPDATE evidence_jobs SET status=?,result=?,error=? WHERE id=? AND status='running'").run(status,result?JSON.stringify(result):null,error||null,id);}
  };
}
