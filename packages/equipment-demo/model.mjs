/** Explicitly fictional demonstration. Nothing in this module is an inspection finding. */
export const DEMO_VERSION = 1;
export const NOTICE = 'DEMONSTRATION ONLY - equipment, positions, faults, dates and assignments are illustrative, not a survey of Marketfield. Real records are separate.';
const type = (id, label, category, mount, issue) => Object.freeze({id,label,category,mount,issue});
export const equipmentTypes = Object.freeze([
 type('alarm-panel','Fire alarm panel','fire','wall','Panel backup-battery fault awaiting a competent service visit'),
 type('smoke-detector','Smoke detector','fire','ceiling','Detector reported obstructed; investigate and record the outcome'),
 type('heat-detector','Heat detector','fire','ceiling','Device fault reported during a simulated service visit'),
 type('call-point','Manual call point','fire','wall','Call-point face damaged; example repair request'),
 type('sounder','Alarm sounder / beacon','fire','wall','Sounder fault reported; specialist diagnosis required'),
 type('extinguisher','Fire extinguisher','fire','floor','Service record unavailable; confirm scope and competent maintenance'),
 type('riser-outlet','Fire riser outlet','fire','wall','Outlet cabinet damaged; example contractor work order'),
 type('emergency-light','Emergency lighting unit','escape','wall','Battery-duration test fault recorded in the demonstration'),
 type('exit-sign','Exit sign','escape','wall','Sign reported damaged; check the required replacement'),
 type('smoke-vent','Smoke ventilation control','escape','wall','Vent actuator fault reported; assess system impact'),
 type('light','Communal light fitting','electrical','ceiling','Fitting reported not lighting; example maintenance visit'),
 type('electrical-board','Electrical distribution board','electrical','wall','Board label schedule missing; investigate with the contractor'),
 type('meter','Utility meter','electrical','wall','Unexpected consumption query requiring a manual reading review'),
 type('battery','Backup battery cabinet','electrical','floor','Battery replacement recommendation awaiting approval'),
 type('intercom','Door-entry intercom','security','wall','Entry-call audio intermittent; example resident access case'),
 type('cctv','CCTV camera','security','wall','Camera housing damaged; service equipment only, no footage'),
 type('access-reader','Access-control reader','security','wall','Reader intermittent; no access credentials are stored'),
 type('lift-controller','Lift controller cabinet','lifts','floor','Lift outage scenario awaiting contractor diagnosis'),
 type('pump','Water booster pump','water','floor','Water leak reported at pump; isolate only through actual procedures'),
 type('tank','Water storage tank','water','floor','Inspection recommendation awaiting competent review'),
 type('valve','Isolation valve','water','wall','Valve identification label missing; verify the system served'),
 type('leak-sensor','Water leak sensor','water','floor','Example leak alert; this demonstration has no live sensor feed'),
 type('boiler','Communal boiler','hvac','floor','Boiler service recommendation awaiting an approved contractor'),
 type('fan','Ventilation fan / grille','hvac','wall','Ventilation noise complaint; example investigation'),
 type('radiator','Heating radiator','hvac','wall','Radiator leak report awaiting a maintenance visit'),
 type('bin','Communal waste bin','cleaning','floor','Missed collection and housekeeping follow-up'),
 type('recycling','Recycling bin','cleaning','floor','Contamination report requiring collection-provider follow-up'),
 type('bench','Shared-area bench','grounds','floor','Loose seat reported; example furniture repair'),
 type('information-box','Building information box','safety','wall','Drawing revision review due; confirm actual controlled contents'),
 type('ev-charger','EV charger','electrical','wall','Charging equipment fault scenario; applicability unconfirmed')
]);
export const typeById = new Map(equipmentTypes.map(t => [t.id,t]));
export const isCommunal = l => l.type === 'stairs' || l.type === 'space' && !/\bflat\b|apartment|bedroom|private/i.test(l.title) && /corridor|lobby|landing|entrance|community|communal|shared|cycle|bike|plant|bin|refuse|store|sub.?station/i.test(l.title);
const day = (today,n) => {const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const safeId = s => String(s).replace(/[^a-zA-Z0-9-]/g,'-').slice(0,110);
const categoryFor = l => ({door:'doors',window:'fabric',stairs:'escape',lift:'lifts',riser:'water',space:isCommunal(l)?'cleaning':'fabric'}[l.type]||'other');
function stylesFor(l){
 if(!['space','stairs','lift','riser'].includes(l.type)||l.type==='space'&&!isCommunal(l))return [];
 const n=l.title.toLowerCase();
 if(l.type==='lift')return ['lift-controller'];
 if(l.type==='riser')return ['valve'];
 if(/sub.?station/.test(n))return ['electrical-board','meter','battery'];
 if(/plant/.test(n))return ['pump','tank','boiler','fan','leak-sensor','heat-detector'];
 if(/bin|refuse/.test(n))return ['bin','recycling','light','heat-detector'];
 if(/cycle|bike/.test(n))return ['cctv','light','access-reader'];
 if(/community|communal room|shared lounge/.test(n))return ['smoke-detector','emergency-light','extinguisher','radiator','bench'];
 if(/entrance|lobby/.test(n))return ['alarm-panel','call-point','emergency-light','intercom','information-box','cctv'];
 if(l.type==='stairs')return ['emergency-light','riser-outlet','exit-sign'];
 if(/corridor|landing/.test(n))return ['smoke-detector','call-point','sounder','emergency-light','light'];
 return isCommunal(l)?['light','smoke-detector']:[];
}
/** Preserve explicit links. Guessed equipment is only ever placed in the DEMO layer. */
export function generateDemo({locations=[],floors=[],topics=[],today}){
 if(!/^\d{4}-\d\d-\d\d$/.test(today||'')||!Number.isFinite(Date.parse(today+'T12:00:00Z')))throw Error('A demonstration date is required.');
 if(locations.length>2000||topics.length>500)throw Error('Demonstration scope exceeds its local limit.');
 const locs=locations.filter(l=>l.type!=='void'&&(!l.building_id||l.building_id==='marketfield')).sort((a,b)=>a.id.localeCompare(b.id));
 const records=[],objects=[],seen=new Set();
 const add=(r)=>{if(seen.has(r.id))throw Error('Duplicate demonstration reference.');seen.add(r.id);records.push({demo:true,status:'illustrative',notes:'Example only. No inspection has been performed.',owner:'Demonstration team',dueDate:'',locationId:'',category:'other',...r});return records.at(-1);};
 for(const l of locs){
  add({id:'demo-area-'+safeId(l.id),kind:isCommunal(l)?'area':'reference',title:l.title,category:categoryFor(l),locationId:l.id,sourceBasis:l.basis||'unconfirmed',notes:'Existing model location used for this demonstration. Site condition and equipment remain unconfirmed.'});
  if(isCommunal(l)){
   add({id:'demo-check-'+safeId(l.id),kind:'check',status:'planned',title:'Area condition and housekeeping review',category:'cleaning',locationId:l.id,dueDate:day(today,14),notes:'Example programme: review floor/wall condition, cleaning, reported obstructions and lighting. The date is not a statutory interval.'});
  }
  const styles=stylesFor(l);
  styles.forEach((style,slot)=>{
   const t=typeById.get(style),id='demo-equipment-'+safeId(l.id)+'-'+style;
   const r=add({id,kind:'equipment',title:t.label,category:t.category,locationId:l.id,style,notes:'Illustrative equipment associated with this model area. Presence, mounting, dimensions and service requirements have NOT been verified.'});
   objects.push({id:r.id,style,locationId:l.id,floorKey:l.floor_key,slot,mount:t.mount,demo:true});
  });
 }
 // Include every equipment style somewhere appropriate in the DEMO, or leave it unlocated.
 for(const t of equipmentTypes){if(objects.some(o=>o.style===t.id))continue;
  const l=locs.find(l=>isCommunal(l)&&/plant|entrance|community|store|lobby/i.test(l.title))||locs.find(isCommunal);
  const id='demo-equipment-example-'+t.id;
  add({id,kind:'equipment',title:t.label,category:t.category,locationId:l?.id||'',style:t.id,notes:'Additional illustrative equipment example; not evidence that this system is provided in Marketfield.'});
  if(l)objects.push({id,style:t.id,locationId:l.id,floorKey:l.floor_key,slot:objects.filter(o=>o.locationId===l.id).length,mount:t.mount,demo:true});
 }
 // One genuinely hypothetical scenario for every device style, not a generated condition finding.
 for(const t of equipmentTypes){const equipment=records.find(r=>r.kind==='equipment'&&r.style===t.id);
  if(!equipment)continue;
  const i=equipmentTypes.indexOf(t);
  add({id:'demo-issue-'+t.id,kind:'issue',title:t.issue,category:t.category,locationId:equipment.locationId,assetId:equipment.id,status:i%5===0?'awaiting_review':i%3===0?'in_progress':'open',dueDate:day(today,i%4===0?-3:7+i%10),notes:'HYPOTHETICAL ISSUE: '+t.issue+'. Use an appropriate competent person and the actual building procedures. No inspection report or service result exists for this demonstration.'});
 }
 // Every original tracking topic gets an applicability/scoping card, NOT an installed asset or fault.
 for(const t of topics){
  if(!t||typeof t.id!=='string'||typeof t.label!=='string')continue;
  const physical=!['finance','safety','residents','projects','repairs'].includes(t.category);
  const candidates=physical?locs.filter(isCommunal):[];
  const l=candidates.find(l=>(t.tags||[]).some(tag=>tag!=='all'&&tag!=='building'&&l.title.toLowerCase().includes(tag)));
  add({id:'demo-scope-'+safeId(t.id),kind:'scope',status:'not_assessed',title:t.label,category:t.category,locationId:l?.id||'',topicId:t.id,notes:t.scope+'\nPotential issue to consider: missing, outdated or incomplete records for this responsibility. Applicability, presence, responsible party and any physical defect still need evidence. This is a discussion prompt, not an outstanding fault.'});
 }
 const areas=locs.filter(isCommunal);
 for(const [index,l] of areas.entries())if(index%3===0)add({id:'demo-issue-area-'+safeId(l.id),kind:'issue',title:['Missed cleaning visit','Floor finish damage reported','Decoration repair awaiting a quotation'][Math.floor(index/3)%3],category:'cleaning',locationId:l.id,assetId:'demo-area-'+safeId(l.id),status:'open',dueDate:day(today,3),notes:'HYPOTHETICAL area issue. No current site defect or missed visit has been verified.'});
 return {demo:true,schemaVersion:DEMO_VERSION,notice:NOTICE,createdOn:today,floors:floors.map(({id,key,name})=>({id,key,name})),locations:locs.map(({id,title,type,floor_key,basis})=>({id,title,type,floor_key,basis})),records,objects:objects.slice(0,400),history:[],version:1};
}
export const openIssue = r => r.kind==='issue'&&!['resolved','cancelled'].includes(r.status);
export function demoCounts(d){return {equipment:d.records.filter(r=>r.kind==='equipment').length,areas:d.records.filter(r=>r.kind==='area').length,topics:d.records.filter(r=>r.kind==='scope').length,checks:d.records.filter(r=>r.kind==='check').length,issues:d.records.filter(openIssue).length,objects:d.objects.length};}
