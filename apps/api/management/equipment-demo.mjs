import { randomUUID } from 'node:crypto';
import { generateDemo, demoCounts, NOTICE } from '../../../packages/equipment-demo/model.mjs';
import { HttpError, record, text } from '../validation.mjs';
const fail=(s,m)=>{throw new HttpError(s,m);};
/** A separate table: demo data can NEVER be accepted as a real management completion. */
export function createEquipmentDemo({workspace,clock=()=>new Date(),loadTopics=async()=>(await import('../../../packages/management/tracking-library.mjs')).trackingItems}){
 const db=workspace.db;
 db.exec('CREATE TABLE IF NOT EXISTS marketfield_equipment_demo (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, body TEXT NOT NULL);');
 const read=()=>{const r=db.prepare('SELECT * FROM marketfield_equipment_demo WHERE id=1').get();return r?{...JSON.parse(r.body),version:r.version}:null;};
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 const stamp=()=>clock().toISOString();
 const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock());
 function envelope(d){return d?{...d,counts:demoCounts(d),notice:NOTICE}:{demo:true,initialized:false,modelInstalled:!!workspace.manifest,notice:NOTICE};}
 async function initialize(input){record(input);if(input.demonstration!==true)fail(400,'Explicit demonstration selection is required.');
  const prior=read();if(prior)return envelope(prior);
  if(!workspace.manifest)fail(409,'Restore the private Marketfield model before populating this demonstration. No replacement building will be generated.');
  const topics=await loadTopics();
  return transaction(()=>{const existing=read();if(existing)return envelope(existing);const d=generateDemo({locations:workspace.locations('marketfield'),floors:workspace.manifest.floors,topics,today:date()});d.history=[{id:randomUUID(),at:stamp(),action:'demo_initialized',note:'Fictional records only; real records untouched.'}];db.prepare('INSERT INTO marketfield_equipment_demo VALUES(1,1,?)').run(JSON.stringify(d));return envelope(d);});
 }
 function update(input){record(input);return transaction(()=>{
  const d=read();if(!d)fail(404,'Open the populated demonstration first.');if(input.version!==d.version)fail(409,'The demonstration changed in another window. Reload it before saving.');
  const id=text(input.id,'Demo record',160),r=d.records.find(r=>r.id===id);if(!r)fail(404,'Unknown demonstration record.');
  if(!['issue','check'].includes(r.kind))fail(400,'Only demonstration issues/checks can change state. Real asset data is not edited here.');
  const allowed=r.kind==='issue'?['open','in_progress','awaiting_review','resolved']:['planned','in_progress','illustrated_complete'];
  if(!allowed.includes(input.status))fail(400,'Choose a supported demonstration status.');
  const note=text(input.note,'Simulation note',1000,true);r.status=input.status;r.simulationNote=note;
  d.history.push({id:randomUUID(),at:stamp(),recordId:id,action:'demo_state_changed',status:r.status,note});d.history=d.history.slice(-1000);d.version++;
  db.prepare('UPDATE marketfield_equipment_demo SET version=?,body=? WHERE id=1').run(d.version,JSON.stringify(d));return envelope(d);
 });}
 function reset(input){record(input);return transaction(()=>{const d=read();if(!d)return envelope(null);if(input.confirm!=='RESET DEMO'||input.version!==d.version)fail(409,'Confirm RESET DEMO for the current demonstration version.');db.prepare('DELETE FROM marketfield_equipment_demo WHERE id=1').run();return envelope(null);});}
 return {read:()=>envelope(read()),initialize,update,reset};
}
export function equipmentDemoRouter(service,{send,jsonBody}){
 return async(req,res,path,method)=>{
  if(!path.startsWith('/api/equipment-demo'))return false;
  if(path==='/api/equipment-demo'&&method==='GET'){send(req,res,200,service.read());return true;}
  if(path==='/api/equipment-demo'&&method==='POST'){send(req,res,200,await service.initialize(await jsonBody(req)));return true;}
  if(path==='/api/equipment-demo'&&method==='PATCH'){send(req,res,200,service.update(await jsonBody(req)));return true;}
  if(path==='/api/equipment-demo/reset'&&method==='POST'){send(req,res,200,service.reset(await jsonBody(req)));return true;}
  if(path==='/api/equipment-demo/export'&&method==='GET'){res.setHeader('Content-Disposition','attachment; filename="DEMO-Marketfield-fictional-records.json"');send(req,res,200,service.read());return true;}
  fail(404,'Demonstration route not found.');
 };
}
