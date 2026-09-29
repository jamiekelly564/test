import { randomUUID, createHash } from 'node:crypto';
import { HttpError, record, text } from '../validation.mjs';
import { categories, kinds, templates, boundary, referenceReviewDate } from '../../../packages/management/catalog.mjs';
const fail=(message,status=400)=>{throw new HttpError(status,message);};
const enumValue=(v,allowed,label)=>{if(!allowed.includes(v))fail('Invalid '+label+'.');return v;};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function validDate(v,label='Date'){
 const s=text(v,label,10,false);if(s&&(!DATE.test(s)||!Number.isFinite(Date.parse(s+'T12:00:00Z'))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s||s<'1900-01-01'||s>'2200-12-31'))fail(label+' must be a real calendar date.');return s;
}
export function localDay(now=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function advanceDate(value,unit,count,anchorDay){
 if(unit==='none')return '';
 validDate(value);const d=new Date(value+'T12:00:00Z');
 if(unit==='months'){const original=anchorDay||d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count);const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(original,max));}
 else d.setUTCDate(d.getUTCDate()+count);
 return validDate(d.toISOString().slice(0,10));
}
export function moneyPence(value){if(value===''||value===undefined)return 0;const s=String(value);if(!/^\d{1,8}(\.\d{1,2})?$/.test(s))fail('Use a non-negative GBP amount with at most two decimal places.');const [whole,decimal='']=s.split('.');return Number(whole)*100+Number(decimal.padEnd(2,'0'));}
const key=value=>{const v=text(value,'Request key',80);if(!/^[a-zA-Z0-9-]{12,80}$/.test(v))fail('Invalid request key.');return v;};
const cleanId=v=>text(v,'Reference',120,false)||null;
const centsText=v=>{if(v===undefined||v==='')return '';return (moneyPence(v)/100).toFixed(2);};
const statusActive=r=>!['retired','closed','cancelled','superseded','ended','void','paused'].includes(r.status);

export function createManagement({workspace,clock=()=>new Date()}){
 const db=workspace.db,stamp=()=>clock().toISOString(),today=()=>localDay(clock());
 db.exec(`CREATE TABLE IF NOT EXISTS management_records(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),kind TEXT NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,location_id TEXT REFERENCES locations(id),asset_id TEXT REFERENCES management_records(id),status TEXT NOT NULL,due_date TEXT NOT NULL DEFAULT '',body TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS management_building_kind ON management_records(building_id,kind);
 CREATE TABLE IF NOT EXISTS management_history(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),record_id TEXT NOT NULL REFERENCES management_records(id),version INTEGER NOT NULL,action TEXT NOT NULL,actor TEXT NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(record_id,version));
 CREATE TABLE IF NOT EXISTS management_requests(request_key TEXT PRIMARY KEY,signature TEXT NOT NULL,building_id TEXT NOT NULL,record_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS management_check_logs(id TEXT PRIMARY KEY,building_id TEXT NOT NULL REFERENCES buildings(id),schedule_id TEXT NOT NULL REFERENCES management_records(id),due_for TEXT NOT NULL,checked_on TEXT NOT NULL,outcome TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);`);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 function read(bid,id){const r=db.prepare('SELECT * FROM management_records WHERE building_id=? AND id=?').get(bid,id);if(!r)fail('Record not found in this building.',404);return {...JSON.parse(r.body),id:r.id,buildingId:bid,kind:r.kind,title:r.title,category:r.category,locationId:r.location_id,assetId:r.asset_id,status:r.status,dueDate:r.due_date,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at};}
 const list=bid=>db.prepare('SELECT id FROM management_records WHERE building_id=? ORDER BY created_at DESC,id').all(bid).map(r=>read(bid,r.id));
 function evidence(bid,ids){if(!Array.isArray(ids)||ids.length>20)fail('Choose up to twenty evidence documents.');return [...new Set(ids.map(id=>{const d=workspace.document(text(id,'Document ID',100));if(d.building_id!==bid)fail('Evidence belongs to another building.');return d.id;}))];}
 function validated(bid,input){
  const b=record(input),kind=enumValue(b.kind,Object.keys(kinds),'record type'),definition=kinds[kind];
  const r={kind,title:text(b.title,'Title',180),category:enumValue(b.category||'other',categories.map(c=>c.id),'category'),status:enumValue(b.status||definition.statuses[0],definition.statuses,'status'),
   locationId:cleanId(b.locationId),assetId:cleanId(b.assetId),owner:text(b.owner,'Owner',160,false),dueDate:validDate(b.dueDate,'Due date'),notes:text(b.notes,'Notes',5000,false),evidenceReference:text(b.evidenceReference,'Evidence reference',1200,false),evidenceIds:evidence(bid,b.evidenceIds||[]),data:{}};
  if(r.locationId&&workspace.location(r.locationId).building_id!==bid)fail('Model location belongs to another building.');
  if(r.assetId&&read(bid,r.assetId).kind!=='asset')fail('Linked record must be an asset in this building.');
  if(kind==='asset'&&r.assetId)fail('Assets cannot link to themselves or another asset using the task asset field.');
  const data=record(b.data||{});
  for(const f of definition.fields){const v=data[f.key];
   if(f.type==='select')r.data[f.key]=enumValue(v||f.options[0],f.options,f.label);
   else if(f.type==='integer'){const n=v===undefined?f.default:Number(v);if(!Number.isSafeInteger(n)||n<f.min||n>f.max)fail(f.label+' is outside its allowed range.');r.data[f.key]=n;}
   else if(f.type==='date')r.data[f.key]=validDate(v,f.label);
   else if(f.type==='datetime'){const s=text(v,f.label,16,false);if(s){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(s)||s.slice(11,13)>'23'||s.slice(14)>'59')fail('Invalid '+f.label+'.');validDate(s.slice(0,10),f.label);}r.data[f.key]=s;}
   else if(f.type==='money'){if(f.required&&(v===undefined||v===''))fail(f.label+' is required.');r.data[f.key]=centsText(v);}
   else r.data[f.key]=text(v,f.label,f.type==='textarea'?3000:500,!!f.required);
  }
  if(kind==='asset'&&['site_observed','document_supported'].includes(r.data.basis)&&(!r.data.verifiedBy||!r.data.verifiedOn||(!r.evidenceIds.length&&!r.evidenceReference)))fail('Record the checker, date and supporting evidence before claiming an observed/document-supported asset.');
  if(kind==='asset'&&r.data.verifiedOn>today())fail('Asset check date cannot be in the future.');
  if(kind==='schedule'&&r.status==='active'&&!r.dueDate)fail('An active schedule needs its first due date.');
  if(kind==='schedule'&&r.data.intervalUnit==='months'&&r.data.interval>120)fail('Monthly intervals cannot exceed 120 months.');
  if(kind==='document'&&r.status==='current'&&!r.evidenceIds.length&&!r.evidenceReference)fail('Link a document or external reference before marking it current.');
  if(kind==='document'&&r.data.supersedesId&&read(bid,r.data.supersedesId).kind!=='document')fail('Superseded record must be a document in this building.');
  if(kind==='contract'&&r.data.startsOn&&r.data.endsOn&&r.data.endsOn<r.data.startsOn)fail('Contract end cannot precede its start.');
  if(kind==='cost'&&r.status==='paid'&&(!r.data.paidOn||!r.data.reference))fail('Paid costs need a payment date and invoice/reference.');
  if(kind==='resident'&&r.data.caseType==='Evacuation-process administration'&&r.notes.length>0&&/medical|diagnos|disab|wheelchair|dementia/i.test(r.notes))fail('Use an anonymised administration reference; personal evacuation/health information belongs in a restricted system.');
  return r;
 }
 function audit(r,action,actor){db.prepare('INSERT INTO management_history VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),r.buildingId,r.id,r.version,action,actor,JSON.stringify(r),stamp());
  db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(randomUUID(),r.buildingId,'management_'+action,r.kind+': '+r.title+'. Human-entered record; not an automated safety result.',stamp());}
 function persist(bid,r,before,action,actor){
  const id=before?.id||randomUUID(),time=stamp(),version=before?before.version+1:1;
  const body={owner:r.owner,notes:r.notes,evidenceReference:r.evidenceReference,evidenceIds:r.evidenceIds,data:r.data,...(r.completion?{completion:r.completion}:{}),...(r.lastCheck?{lastCheck:r.lastCheck}:{}),...(r.anchorDay?{anchorDay:r.anchorDay}:{})};
  if(before){if(!db.prepare('UPDATE management_records SET title=?,category=?,location_id=?,asset_id=?,status=?,due_date=?,body=?,version=?,updated_at=? WHERE id=? AND building_id=? AND version=?').run(r.title,r.category,r.locationId,r.assetId,r.status,r.dueDate,JSON.stringify(body),version,time,id,bid,before.version).changes)fail('This record changed in another window. Reload before saving.',409);}
  else{if(db.prepare('SELECT count(*) AS n FROM management_records WHERE building_id=?').get(bid).n>=10000)fail('The local building register has reached its 10,000-record limit.',413);db.prepare('INSERT INTO management_records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,bid,r.kind,r.title,r.category,r.locationId,r.assetId,r.status,r.dueDate,JSON.stringify(body),version,time,time);}
  const saved=read(bid,id);audit(saved,action,actor);return saved;
 }
 function mutate(bid,input,tag,fn){workspace.building(bid);record(input);const k=key(input.requestKey),signature=createHash('sha256').update(JSON.stringify({bid,tag,input})).digest('hex');
  return transaction(()=>{const prior=db.prepare('SELECT * FROM management_requests WHERE request_key=?').get(k);if(prior){if(prior.signature!==signature||prior.building_id!==bid)fail('Request reference was reused for different contents.',409);return read(bid,prior.record_id);}
   const out=fn(text(input.actor,'Recorded by',120,false)||'Local operator (self-declared)');db.prepare('INSERT INTO management_requests VALUES(?,?,?,?)').run(k,signature,bid,out.id);return out;});
 }
 function version(bid,id,input){const before=read(bid,id);if(input.version!==before.version)fail('This record has changed. Reload before saving.',409);return before;}
 const hasEvidence=r=>r.evidenceIds.length>0||r.evidenceReference.trim().length>=8;
 function supersede(bid,r,actor){if(r.kind==='document'&&r.status==='current'&&r.data.supersedesId){let ancestor=r.data.supersedesId;const visited=new Set([r.id]);while(ancestor){if(visited.has(ancestor))fail('Document revision links cannot form a cycle.');visited.add(ancestor);if(visited.size>100)fail('Revision chain exceeds the supported limit.');ancestor=read(bid,ancestor).data.supersedesId;}const previous=read(bid,r.data.supersedesId);if(previous.status!=='superseded')persist(bid,{...previous,status:'superseded'},previous,'superseded',actor);}}
 function snapshot(bid){workspace.building(bid);const records=list(bid),date=today(),localTime=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'short'}).format(clock()).replace(' ','T'),active=records.filter(statusActive);const costs={forecast:0,quotation:0,committed:0,paid:0};for(const r of records)if(r.kind==='cost'&&Object.hasOwn(costs,r.status))costs[r.status]+=moneyPence(r.data.amount);
  const attention=records.flatMap(r=>{const reasons=[];if(statusActive(r)&&r.dueDate&&r.dueDate<date)reasons.push('Overdue');if(r.kind==='asset'&&r.status==='out_of_service')reasons.push('Out of service');if(r.kind==='work'&&r.status==='awaiting_review')reasons.push('Evidence awaiting acceptance');if(r.kind==='work'&&r.status==='no_access')reasons.push('Access needed');if(r.kind==='schedule'&&r.lastCheck&&r.lastCheck.outcome!=='completed'&&r.status==='active')reasons.push('Last check: '+r.lastCheck.outcome.replaceAll('_',' '));if(r.kind==='incident'&&!['resolved','closed'].includes(r.status))reasons.push('Incident / outage open');if(['work'].includes(r.kind)&&r.data.priority==='immediate'&&statusActive(r))reasons.push('Immediate action');if(['contract'].includes(r.kind)&&r.data.noticeOn&&r.data.noticeOn<=date&&r.status==='active')reasons.push('Contract notice date reached');if(r.kind==='incident'&&r.data.notificationDeadline&&r.data.notificationDeadline<localTime&&!r.data.notifiedAt&&!['resolved','closed'].includes(r.status))reasons.push('Recorded notification deadline passed');if(r.kind==='contract'&&r.data.endsOn&&r.data.endsOn<date&&r.status==='active')reasons.push('Contract end date passed');if(r.kind==='document'&&r.status==='current'&&r.data.expiresOn&&r.data.expiresOn<date)reasons.push('Document expired');return reasons.length?[{id:r.id,title:r.title,kind:r.kind,category:r.category,reasons}]:[];});
  const model=workspace.manifest;const b=workspace.building(bid);return {building:b,modelInstalled:b.model_key==='marketfield'&&!!model,floors:b.model_key==='marketfield'?model?.floors||[]:[],locations:workspace.locations(bid),records,documents:workspace.documents(bid).map(({id,name,mime,size,created_at})=>({id,name,mime,size,createdAt:created_at})),checks:db.prepare('SELECT * FROM management_check_logs WHERE building_id=? ORDER BY created_at DESC LIMIT 200').all(bid).map(r=>({...r,body:JSON.parse(r.body)})),
   attention,summary:{assets:records.filter(r=>r.kind==='asset'&&r.status!=='retired').length,unconfirmedAssets:records.filter(r=>r.kind==='asset'&&!['site_observed','document_supported'].includes(r.data.basis)).length,overdue:active.filter(r=>r.dueDate&&r.dueDate<date).length,awaitingReview:records.filter(r=>r.kind==='work'&&r.status==='awaiting_review').length,costs},today:date,boundary};
 }
 return {
  catalog:()=>({categories,kinds,templates,boundary,referenceReviewDate}),
  bootstrap:()=>({exists:!!db.prepare('SELECT 1 FROM buildings WHERE id=?').get('marketfield'),modelInstalled:!!workspace.manifest,boundary}),
  open(){return transaction(()=>{db.prepare('INSERT OR IGNORE INTO buildings VALUES(?,?,?,?,?,?,?)').run('marketfield','Marketfield Court','Existing property; address/height/classification not confirmed in this register.','','marketfield','Model pack or operator evidence required',stamp());return {buildingId:'marketfield',modelInstalled:!!workspace.manifest};});},
  snapshot,read,
  add(bid,input){return mutate(bid,input,'create',actor=>{const r=validated(bid,input);if(r.kind==='work'&&['closed','awaiting_review'].includes(r.status))fail('Create the work order first, then submit completion evidence.');if(r.kind==='schedule')r.anchorDay=r.dueDate?Number(r.dueDate.slice(-2)):undefined;const out=persist(bid,r,null,'created',actor);supersede(bid,out,actor);return out;});},
  update(bid,id,input){return mutate(bid,input,'edit:'+id,actor=>{const before=version(bid,id,input);if(input.kind&&input.kind!==before.kind)fail('Record type cannot change.');const r=validated(bid,{...before,...input,data:{...before.data,...input.data}});
    if(before.kind==='work'&&(r.status==='closed'||r.status==='awaiting_review'||before.status==='closed'))fail('Use Submit completion, Accept completion or Reopen; completion cannot be changed through ordinary edits.');
    if(before.kind==='schedule'){r.lastCheck=before.lastCheck;r.anchorDay=r.dueDate!==before.dueDate?Number(r.dueDate.slice(-2)):before.anchorDay;}
    const out=persist(bid,r,before,'edited',actor);supersede(bid,out,actor);return out;});},
  action(bid,id,input){return mutate(bid,input,'action:'+id,actor=>{const before=version(bid,id,input);if(before.kind!=='work')fail('This action is only for work orders.');const r=structuredClone(before);
    if(input.action==='submit'){if(['closed','cancelled','awaiting_review'].includes(before.status))fail('This work order cannot be submitted in its current state.',409);r.evidenceIds=evidence(bid,input.evidenceIds||before.evidenceIds);r.evidenceReference=text(input.evidenceReference??before.evidenceReference,'Completion evidence',1200,false);if(!hasEvidence(r))fail('Attach evidence or supply a substantive external report reference.');r.data.completionNotes=text(input.notes,'Completion notes',3000);r.status='awaiting_review';r.completion={submittedAt:stamp(),submittedBy:actor,reviewedAt:null,reviewedBy:null};}
    else if(input.action==='accept'){if(before.status!=='awaiting_review'||!hasEvidence(before))fail('Only an evidenced completion awaiting review can be accepted.',409);const reviewer=text(input.reviewer,'Reviewer name',120);r.status='closed';r.completion={...before.completion,reviewedAt:stamp(),reviewedBy:reviewer,reviewNote:text(input.notes,'Review note',3000),identity:'self-declared local operator, not authenticated sign-off'};}
    else if(input.action==='reopen'){r.status='reported';r.completion={...before.completion,reopenedAt:stamp(),reopenReason:text(input.notes,'Reason for reopening',3000)};}
    else fail('Unknown work-order action.');return persist(bid,r,before,input.action,actor);});},
  check(bid,id,input){return mutate(bid,input,'check:'+id,actor=>{const r=version(bid,id,input);if(r.kind!=='schedule'||r.status!=='active')fail('Choose an active schedule.');const outcome=enumValue(input.outcome,['completed','no_access','defect','skipped'],'check outcome'),checkedOn=validDate(input.checkedOn,'Check date');if(!checkedOn||checkedOn>today())fail('Check date must be today or earlier.');
    if(input.dueFor!==r.dueDate)fail('The due occurrence changed; reopen the check form.',409);const body={notes:text(input.notes,'Check notes',4000),evidenceIds:evidence(bid,input.evidenceIds||[]),evidenceReference:text(input.evidenceReference,'Report reference',1200,false),reviewer:text(input.reviewer,'Reviewer',120,false),actor};
    if(outcome==='completed'&&(!body.reviewer||!hasEvidence(body)))fail('A completed occurrence needs reviewed evidence and a named reviewer. No access/defect outcomes keep the due date outstanding.');
    if(outcome==='completed'&&db.prepare("SELECT 1 FROM management_check_logs WHERE schedule_id=? AND due_for=? AND outcome='completed'").get(id,r.dueDate))fail('This occurrence has already been completed.',409);
    const logId=randomUUID();db.prepare('INSERT INTO management_check_logs VALUES(?,?,?,?,?,?,?,?)').run(logId,bid,id,r.dueDate,checkedOn,outcome,JSON.stringify(body),stamp());
    // One occurrence at a time; late completion does not skip all overdue occurrences.
    const updated={...r,lastCheck:{id:logId,checkedOn,outcome,dueFor:r.dueDate}};if(outcome==='completed'){updated.dueDate=advanceDate(r.dueDate,r.data.intervalUnit,r.data.interval,r.anchorDay);if(!updated.dueDate)updated.status='paused';}return persist(bid,updated,r,'check_'+outcome,actor);});},
  history(bid,id){read(bid,id);return db.prepare('SELECT * FROM management_history WHERE building_id=? AND record_id=? ORDER BY version DESC').all(bid,id).map(r=>({...r,snapshot:JSON.parse(r.snapshot)}));},
  export(bid){return {...snapshot(bid),exportedAt:stamp(),recordHistory:db.prepare('SELECT * FROM management_history WHERE building_id=? ORDER BY created_at').all(bid).map(r=>({...r,snapshot:JSON.parse(r.snapshot)})),allCheckLogs:db.prepare('SELECT * FROM management_check_logs WHERE building_id=? ORDER BY created_at').all(bid).map(r=>({...r,body:JSON.parse(r.body)})),note:'Metadata export, not a file backup. Use npm.cmd run backup for database and uploaded files. No compliance certification implied.'};}
 };
}
