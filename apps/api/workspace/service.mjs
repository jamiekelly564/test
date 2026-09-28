import { randomUUID, createHash } from 'node:crypto';
import { HttpError, text, normalisePostcode, record, choice } from '../validation.mjs';
import { trackingCategories, trackingStatuses, TRACKING_NOTICE } from '../../../packages/domain/tracking.mjs';

const now=()=>new Date().toISOString();
const normal=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const category=id=>choice(id,'tracking category',trackingCategories.map(c=>c.id));
function reference(value){const r=text(value,'Request reference',80);if(!/^[a-zA-Z0-9-]{12,80}$/.test(r))throw new HttpError(400,'Invalid request reference.');return r;}
function version(n){if(!Number.isSafeInteger(n)||n<0)throw new HttpError(400,'A record version is required.');return n;}
function date(value){const d=text(value,'Due date',10,false);if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))throw new HttpError(400,'Use a valid due date.');return d;}

/** One local workspace; all reads still require the server's session guard. */
export function createBuildingWorkspace({workspace,preview}){
  const db=workspace.db;
  db.exec(`CREATE TABLE IF NOT EXISTS workspace_requests(request_key TEXT PRIMARY KEY,signature TEXT NOT NULL,building_id TEXT NOT NULL REFERENCES buildings(id),record_id TEXT);
    CREATE TABLE IF NOT EXISTS workspace_modules(building_id TEXT NOT NULL REFERENCES buildings(id),category TEXT NOT NULL,enabled INTEGER NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(building_id,category));
    CREATE TABLE IF NOT EXISTS workspace_tracked_tasks(task_id TEXT PRIMARY KEY REFERENCES tasks(id),category TEXT NOT NULL,place TEXT NOT NULL,owner TEXT NOT NULL,due_date TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS workspace_tasks_category ON workspace_tracked_tasks(category);`);
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  function replay(key,signature){const previous=db.prepare('SELECT * FROM workspace_requests WHERE request_key=?').get(key);if(previous&&previous.signature!==signature)throw new HttpError(409,'This request reference belongs to different details.');return previous;}
  const remember=(key,sig,bid,id=null)=>db.prepare('INSERT INTO workspace_requests VALUES(?,?,?,?)').run(key,sig,bid,id);
  const event=(bid,kind,summary)=>db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(randomUUID(),bid,kind,summary,now());
  const savedPreview=bid=>{const p=db.prepare('SELECT id FROM quick_previews WHERE building_id=? ORDER BY updated_at DESC LIMIT 1').get(bid);return p?preview.get(p.id):null;};
  function read(bid){
    const building=workspace.building(bid),settings=db.prepare('SELECT * FROM workspace_modules WHERE building_id=?').all(bid);
    const records=db.prepare(`SELECT t.*, m.category, m.place, m.owner, m.due_date FROM tasks t JOIN workspace_tracked_tasks m ON m.task_id=t.id WHERE t.building_id=? ORDER BY t.created_at DESC,t.id`).all(bid);
    const today=now().slice(0,10),open=records.filter(r=>r.status!=='closed');
    return {building,preview:savedPreview(bid),categories:trackingCategories.map(c=>{const setting=settings.find(s=>s.category===c.id),all=records.filter(r=>r.category===c.id);return {...c,enabled:!!setting?.enabled,version:setting?.version||0,count:all.length,open:all.filter(r=>r.status!=='closed').length};}),records,
      summary:{records:records.length,open:open.length,overdue:open.filter(r=>r.due_date&&r.due_date<today).length,enabled:settings.filter(s=>s.enabled).length},
      statuses:trackingStatuses,notice:TRACKING_NOTICE,documents:workspace.documents(bid).map(({storage_name,sha256,...d})=>d)};
  }
  function start(input){
    record(input);const key=reference(input.requestKey),postcode=normalisePostcode(input.postcode),name=text(input.name,'Building name',150,false),selected=text(input.buildingId,'Building ID',100,false);
    if(input.allowProcessing!==true)throw new HttpError(400,'Approve building creation before starting.');
    const signature=hash({action:'start',postcode,name:normal(name),selected}),previous=replay(key,signature);
    if(previous)return {kind:'building',...read(previous.building_id),duplicate:true};
    let matches=workspace.buildings().filter(b=>b.postcode===postcode);
    if(selected){matches=matches.filter(b=>b.id===selected);if(matches.length!==1)throw new HttpError(400,'The chosen building does not belong to this postcode.');}
    else if(name)matches=matches.filter(b=>normal(b.name)===normal(name));
    if(matches.length>1)return {kind:'choose',postcode,choices:matches.map(({id,name})=>({id,name})),message:'You have several buildings at this postcode. Which one would you like to open?'};
    const b=matches[0];
    let p=b?savedPreview(b.id):null;
    if(!p){
      p=preview.create({name:b?.name||name||'Building at '+postcode,postcode,requestKey:key,allowProcessing:true});
      if(b&&p.building_id!==b.id)throw new HttpError(409,'A duplicate building record needs resolving before replacing its preview.');
    }
    remember(key,signature,p.building_id);
    return {kind:'building',...read(p.building_id),created:!b};
  }
  function setModule(bid,id,input){
    workspace.building(bid);category(id);record(input);version(input.version);if(typeof input.enabled!=='boolean')throw new HttpError(400,'Choose whether to track this category.');
    return tx(()=>{
      const old=db.prepare('SELECT * FROM workspace_modules WHERE building_id=? AND category=?').get(bid,id);
      if((old?.version||0)!==input.version)throw new HttpError(409,'Tracking settings changed. Reload before saving.');
      db.prepare('INSERT INTO workspace_modules VALUES(?,?,?,?) ON CONFLICT(building_id,category) DO UPDATE SET enabled=excluded.enabled,version=excluded.version').run(bid,id,Number(input.enabled),(old?.version||0)+1);
      event(bid,'tracking_setting',`${input.enabled?'Enabled':'Paused'} ${trackingCategories.find(c=>c.id===id).title} manual tracking. Existing records retained.`);return read(bid);
    });
  }
  function add(bid,input){
    workspace.building(bid);record(input);const key=reference(input.requestKey),c=category(input.category);
    const fields={title:text(input.title,'Record title',180),description:text(input.description,'Notes',4000,false),place:text(input.place,'Location',180,false),owner:text(input.owner,'Responsible person or company',180,false),due:date(input.dueDate),priority:choice(input.priority||'normal','priority',['normal','high','urgent'])};
    const sig=hash({action:'add',bid,c,fields}),previous=replay(key,sig);if(previous)return read(bid);
    if(db.prepare('SELECT count(*) AS n FROM workspace_tracked_tasks m JOIN tasks t ON t.id=m.task_id WHERE t.building_id=?').get(bid).n>=2000)throw new HttpError(413,'This local building has reached the 2,000-record tracking limit.');
    return tx(()=>{
      const id=randomUUID(),time=now();
      db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,bid,null,fields.title,fields.description,fields.priority,'open',1,time,time);
      db.prepare('INSERT INTO workspace_tracked_tasks VALUES(?,?,?,?,?)').run(id,c,fields.place,fields.owner,fields.due);
      db.prepare('INSERT INTO workspace_modules VALUES(?,?,1,1) ON CONFLICT(building_id,category) DO UPDATE SET enabled=1,version=workspace_modules.version+1').run(bid,c);
      event(bid,'tracking_record_added','Added a manual '+trackingCategories.find(x=>x.id===c).title+' record: '+fields.title);remember(key,sig,bid,id);return read(bid);
    });
  }
  function patch(bid,id,input){
    workspace.building(bid);record(input);version(input.version);
    const status=choice(input.status,'record status',trackingStatuses.map(s=>s.id));
    return tx(()=>{
      const exists=db.prepare('SELECT t.id FROM tasks t JOIN workspace_tracked_tasks m ON m.task_id=t.id WHERE t.id=? AND t.building_id=?').get(id,bid);
      if(!exists)throw new HttpError(404,'Tracking record not found in this building.');
      const r=db.prepare('UPDATE tasks SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(status,now(),id,input.version);
      if(!r.changes)throw new HttpError(409,'This record changed in another view. Reload it first.');
      event(bid,'tracking_status','Manual task status updated to '+trackingStatuses.find(s=>s.id===status).label+'. This is not a compliance judgement.');return read(bid);
    });
  }
  return {start,read,setModule,add,patch,recover(key){const r=db.prepare('SELECT * FROM workspace_requests WHERE request_key=?').get(reference(key));if(!r)throw new HttpError(404,'No saved result exists for this request.');return {kind:'building',...read(r.building_id)};},list(){return workspace.buildings().map(b=>({id:b.id,name:b.name,postcode:b.postcode,previewId:db.prepare('SELECT id FROM quick_previews WHERE building_id=? ORDER BY updated_at DESC LIMIT 1').get(b.id)?.id||null}));}};
}
