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

/** Display stages only. Existing persisted demo workflow statuses remain unchanged. */
export const issueStages = Object.freeze({
 found:Object.freeze({key:'found',label:'Issue found',colour:'#D92D20',rank:3,status:'open',symbol:'!'}),
 progress:Object.freeze({key:'progress',label:'In progress',colour:'#F4C430',rank:2,status:'in_progress',symbol:'...'}),
 working:Object.freeze({key:'working',label:'Working correctly',colour:'#16804A',rank:1,status:'resolved',symbol:'check'}),
 unknown:Object.freeze({key:'unknown',label:'Condition not recorded',colour:'#667085',rank:0,status:null,symbol:'?'})
});
export function issueStage(record){
 if(record?.kind!=='issue')return issueStages.unknown;
 if(record.status==='open')return issueStages.found;
 if(['in_progress','awaiting_review'].includes(record.status))return issueStages.progress;
 return record.status==='resolved'?issueStages.working:issueStages.unknown;
}
export function recordStage(record,records=[]){
 if(record?.kind==='issue')return issueStage(record);
 if(!record||!['equipment','area','reference'].includes(record.kind))return issueStages.unknown;
 const linked=records.filter(r=>r.kind==='issue'&&(r.assetId===record.id||record.kind!=='equipment'&&record.locationId&&r.locationId===record.locationId));
 return linked.reduce((best,r)=>issueStage(r).rank>best.rank?issueStage(r):best,issueStages.unknown);
}
export function issueCounts(records=[]){return records.reduce((sum,r)=>{const stage=issueStage(r);if(stage.key!=='unknown')sum[stage.key]++;return sum;},{found:0,progress:0,working:0});}
// Fixed, local line icons: titles and other record text never become SVG markup.
const glyphs=Object.freeze({
 alarm:'M4 3h16v18H4z M7 6h10v5H7z M7 15h1m3 0h1m3 0h1 M7 18h1m3 0h1m3 0h1',
 detector:'M5 9h14l2 5-3 4H6l-3-4z M7 12h10 M8 15h8 M8 3v3m4-3v3m4-3v3',
 callpoint:'M4 4h16v16H4z M8 8h8v8H8z M12 9v4m0 2v.1',
 sounder:'M8 16V9a4 4 0 0 1 8 0v7 M6 16h12 M10 19h4 M3 9v5m18-5v5',
 battery:'M3 6h16v12H3z M19 10h2v4h-2 M7 12h4m-2-2v4 M14 12h2',
 light:'M8 15a7 7 0 1 1 8 0l-1 3H9z M9 21h6 M12 2v1',
 emergency:'M7 12h10v8H7z M8 12 5 8m11 4 3-4 M2 4h6v5H2z M16 4h6v5h-6z',
 exit:'M3 3h11v18H3z M10 12h12m-4-4 4 4-4 4 M6 18h1',
 extinguisher:'M8 9h8v12H8z M10 9V5h4v4 M10 5V3h7 M16 7h3v8',
 water:'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13z M8 15a4 4 0 0 0 4 4',
 valve:'M3 10h18v5H3z M12 10V5 M7 5h10 M9 2v3m6-3v3',
 fan:'M12 12c-7 2-10-3-6-7 5-4 7 0 6 7z M12 12c2-7 8-6 9-1 0 6-5 6-9 1z M12 12c5 5 2 10-3 9-5-1-4-6 3-9z',
 electric:'M5 3h14v18H5z M13 6 8 13h4l-1 5 6-8h-5z',
 camera:'M3 6h13v12H3z M16 10l5-3v10l-5-3 M6 9h3',
 access:'M7 2h10v20H7z M10 6h4 M10 10h4 M10 15h1m2 0h1 M10 18h1m2 0h1',
 lift:'M3 3h18v18H3z M8 18V8m-3 3 3-3 3 3 M16 8v10m-3-3 3 3 3-3',
 bin:'M5 7h14l-1 14H6z M3 7h18 M9 7V3h6v4 M10 10v7m4-7v7',
 clean:'M15 3 9 13 M7 12l7 4-3 5H3z M7 16l-2 4m5-3-1 4',
 floor:'M3 3h18v18H3z M13 3l-4 7 6 3-4 8 M3 12h7m5 0h6',
 paint:'M4 3h13v7H4z M17 5h4v8h-9v4 M10 17h4v5h-4z',
 document:'M5 2h10l4 4v16H5z M15 2v5h4 M8 11h8m-8 4h8m-8 4h5',
 seat:'M4 5h16v8H4z M3 13h18v4H3z M5 17v5m14-5v5',
 heat:'M4 6h16v15H4z M8 9v9m4-9v9m4-9v9 M8 2v1m4-1v1m4-1v1',
 tool:'M14 3a5 5 0 0 0-6 6L2 17l5 5 8-8a5 5 0 0 0 6-6l-5 3-3-3 3-5z',
 door:'M5 2h14v20H5z M8 2v20 M14 12h2'
});
const styleGlyph=Object.freeze({'alarm-panel':'alarm','smoke-detector':'detector','heat-detector':'detector','call-point':'callpoint',sounder:'sounder',extinguisher:'extinguisher','riser-outlet':'valve','emergency-light':'emergency','exit-sign':'exit','smoke-vent':'fan',light:'light','electrical-board':'electric',meter:'electric',battery:'battery',intercom:'access',cctv:'camera','access-reader':'access','lift-controller':'lift',pump:'water',tank:'water',valve:'valve','leak-sensor':'water',boiler:'heat',fan:'fan',radiator:'heat',bin:'bin',recycling:'bin',bench:'seat','information-box':'document','ev-charger':'electric'});
export function issueGlyph(record,asset){
 const text=String(record?.title||'').toLowerCase();
 if(record?.kind==='issue'){
  if(/leak|flood/.test(text))return 'water';
  if(/battery/.test(text))return 'battery';
  if(/floor finish|flooring|trip/.test(text))return 'floor';
  if(/decorat|paint/.test(text))return 'paint';
  if(/cleaning|housekeeping/.test(text))return 'clean';
  if(/collection|contamination|waste|refuse/.test(text))return 'bin';
 }
 return styleGlyph[asset?.style||record?.style]||({doors:'door',water:'water',fire:'alarm',escape:'emergency',electrical:'electric',security:'access',lifts:'lift',cleaning:'clean',fabric:'floor',structure:'floor',finance:'document',safety:'document'}[record?.category])||'tool';
}
export function issueIconSVG(key){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(Object.hasOwn(glyphs,key)?glyphs[key]:glyphs.tool)+'"/></svg>';}
export function primaryIssue(items=[]){return [...items].filter(r=>issueStage(r).rank).sort((a,b)=>issueStage(b).rank-issueStage(a).rank||String(a.id).localeCompare(String(b.id)))[0]||null;}
const point3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
/** Orbit parameters representing an eye and target. No world coordinate is accepted from a message. */
export function cameraFromEye(eye,target){
 if(!point3(eye)||!point3(target))throw Error('Finite camera points required.');
 const delta=eye.map((v,i)=>v-target[i]),radius=Math.hypot(...delta);
 if(radius<.2||radius>240)throw Error('Camera distance outside display limits.');
 return {theta:Math.atan2(delta[0],delta[2]),phi:Math.acos(Math.max(-1,Math.min(1,delta[1]/radius))),radius,target:[...target]};
}
export function aerialCamera(anchor,floorPoints=[],width=1200,height=800){
 if(!point3(anchor))throw Error('Finite anchor required.');
 const points=floorPoints.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)).slice(0,20000);
 // Frame the selected floor around its bounding centre; retain the selected icon as the focus cue.
 const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
 const minX=xs.length?Math.min(...xs):anchor[0]-5,maxX=xs.length?Math.max(...xs):anchor[0]+5;
 const minZ=zs.length?Math.min(...zs):anchor[2]-5,maxZ=zs.length?Math.max(...zs):anchor[2]+5;
 const aspect=Math.max(.2,Math.min(6,(Number(width)||1200)/(Number(height)||800)));
 const fov=2*Math.atan(Math.tan(Math.PI/7)*Math.max(1,1.3/aspect));
 const span=Math.max((maxX-minX)/aspect,maxZ-minZ,8);
 return {theta:0,phi:.025,radius:Math.min(220,Math.max(12,span/(2*Math.tan(fov/2))*1.25+3)),target:[(minX+maxX)/2,0,(minZ+maxZ)/2]};
}
export function eyeLevelCandidates(anchor,rotation=0){
 if(!point3(anchor))throw Error('Finite anchor required.');
 const out=[],target=[...anchor],angle=Number.isFinite(rotation)?rotation:0;
 for(const radius of [2.2,3.2,1.4])for(const delta of [0,.45,-.45,.9,-.9,Math.PI/2,-Math.PI/2,Math.PI]){
  const a=angle+delta,eye=[target[0]+Math.sin(a)*radius,1.6,target[2]+Math.cos(a)*radius];
  out.push({eye,camera:cameraFromEye(eye,target)});
 }
 return out;
}
