/** Read-only visualisation of saved records. Colours are workflow cues, never safety verdicts. */
export const tones = Object.freeze({
  urgent: { colour:'#c34247', label:'Action / outage', symbol:'!', rank:6 },
  overdue: { colour:'#aa6b13', label:'Overdue / follow-up', symbol:'!', rank:5 },
  review: { colour:'#7952ac', label:'Awaiting review', symbol:'R', rank:4 },
  upcoming: { colour:'#18768c', label:'Due in 30 days', symbol:'D', rank:3 },
  recorded: { colour:'#366eae', label:'Registered record', symbol:'+', rank:2 },
  unconfirmed: { colour:'#687880', label:'Information unconfirmed', symbol:'?', rank:1 },
  completed: { colour:'#237b64', label:'Accepted / resolved record', symbol:'C', rank:0 },
  archived: { colour:'#879095', label:'Archived / paused', symbol:'-', rank:0 },
  reference: { colour:'#657982', label:'Drawing location only', symbol:'o', rank:-1 }
});
export const systemColours = Object.freeze({
  doors:'#b55837',fire:'#b94751',escape:'#9e6340',structure:'#867152',fabric:'#997438',lifts:'#7963a4',
  water:'#2583ae',hvac:'#258980',electrical:'#a38321',security:'#516aae',cleaning:'#7c8362',grounds:'#54875a',
  health:'#9d637e',residents:'#857594',repairs:'#637cb1',finance:'#7a8870',projects:'#a47557',safety:'#645b92',other:'#627982'
});
export const layerGroups = [
  {label:'Fire & life safety',ids:['doors','fire','escape','safety']},
  {label:'Fabric & shared spaces',ids:['structure','fabric','lifts','cleaning','grounds','health']},
  {label:'Building services',ids:['water','hvac','electrical','security']},
  {label:'Management & projects',ids:['residents','repairs','finance','projects','other']}
];
export const referenceTypes = {door:'Doors',space:'Rooms & areas',lift:'Lift locations',stairs:'Stairs',riser:'Risers',window:'Windows'};
export const viewModes = [
  ['all','All records'],['attention','Needs attention'],['overdue','Overdue'],['outages','Outages'],
  ['review','Awaiting review'],['upcoming','Due in 30 days'],['unlocated','Not located']
];
const inactive = new Set(['retired','closed','cancelled','superseded','ended','void','paused','resolved']);
export const activeRecord = r => !inactive.has(r.status);
const inScope = (r,bid) => !r.buildingId || r.buildingId===bid;
export function futureDay(day,days=30) {
  if(!/^\d{4}-\d\d-\d\d$/.test(day||''))return '';
  const d=new Date(day+'T12:00:00Z');if(!Number.isFinite(+d))return '';
  d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
export function recordFlags(r,today,reasons=[]) {
  const active=activeRecord(r),data=r.data||{},a=Array.isArray(reasons)?reasons:[];
  const overdue=active&&!!r.dueDate&&r.dueDate<today || a.includes('Overdue');
  const outage=r.kind==='asset'&&r.status==='out_of_service' || r.kind==='incident'&&active;
  const urgent=outage || active&&(r.status==='needs_action'||r.kind==='work'&&['immediate','urgent'].includes(data.priority));
  const review=active&&['awaiting_review','needs_review','review_due'].includes(r.status);
  const followup=active&&(r.status==='no_access'||r.status==='awaiting_access'||r.lastCheck&&r.lastCheck.outcome!=='completed');
  const next=futureDay(today),dates=[r.dueDate];
  if(r.kind==='document')dates.push(data.expiresOn);
  if(r.kind==='contract')dates.push(data.noticeOn,data.endsOn);
  const upcoming=active&&dates.some(d=>d&&d>=today&&d<=next);
  const unconfirmed=r.kind==='asset'&&!['site_observed','document_supported'].includes(data.basis) || r.status==='unconfirmed';
  const accepted=r.kind==='work'&&r.status==='closed'&&r.completion?.reviewedAt || ['incident','resident'].includes(r.kind)&&r.status==='resolved';
  const attention=urgent||review||followup||overdue||a.length>0;
  const tone=urgent?'urgent':overdue||followup||a.length&&!review?'overdue':review?'review':upcoming?'upcoming':!active?(accepted?'completed':'archived'):unconfirmed?'unconfirmed':'recorded';
  return {active,overdue:!!overdue,outage:!!outage,urgent:!!urgent,review:!!review,upcoming:!!upcoming,unconfirmed:!!unconfirmed,attention:!!attention,tone};
}
/** Resolve only explicit links. Never guess a location from an asset name, category or floor text. */
export function resolveRecordLocation(r,records,locations,bid) {
  if(!inScope(r,bid))return null;
  const locById=locations instanceof Map?locations:new Map(locations.map(l=>[l.id,l]));
  const recordById=records instanceof Map?records:new Map(records.map(a=>[a.id,a]));
  let id=r.locationId;
  if(!id&&r.assetId){const asset=recordById.get(r.assetId);if(asset?.kind==='asset'&&inScope(asset,bid))id=asset.locationId;}
  const loc=locById.get(id);
  return loc&&(!loc.building_id||loc.building_id===bid)?loc:null;
}
/** Produces ALL matching record rows plus grouped point locations. No stored model/record is mutated. */
export function buildLayerView(snapshot,filter={}) {
  const bid=snapshot.building?.id,records=(snapshot.records||[]).filter(r=>inScope(r,bid));
  const locations=(snapshot.locations||[]).filter(l=>!l.building_id||l.building_id===bid);
  const locById=new Map(locations.map(l=>[l.id,l])),recById=new Map(records.map(r=>[r.id,r]));
  const attention=new Map((snapshot.attention||[]).map(a=>[a.id,a.reasons]));
  const floor=snapshot.floors?.find(f=>String(f.id)===String(filter.floor));
  const mode=viewModes.some(([id])=>id===filter.mode)?filter.mode:'all';
  const query=String(filter.query||'').trim().toLowerCase();
  const entries=records.map(r=>({record:r,location:resolveRecordLocation(r,recById,locById,bid),flags:recordFlags(r,snapshot.today,attention.get(r.id))}));
  const matches=entries.filter(e=>{
    const {record:r,location:l,flags:f}=e;
    if(!filter.includeClosed&&!f.active)return false;
    if(filter.category&&r.category!==filter.category)return false;
    if(filter.kinds?.length&&!filter.kinds.includes(r.kind)||filter.kind&&filter.kind!==r.kind)return false;
    if(filter.location&&l?.id!==filter.location)return false;
    // The explicit 'Not located' view ignores floor because no floor can be established.
    if(mode!=='unlocated'&&floor&&l?.floor_key!==floor.key)return false;
    if(query&&!JSON.stringify(r).toLowerCase().includes(query)&&!l?.title.toLowerCase().includes(query))return false;
    return mode==='all'||mode==='attention'&&f.attention||mode==='overdue'&&f.overdue||mode==='outages'&&f.outage||mode==='review'&&f.review||mode==='upcoming'&&f.upcoming||mode==='unlocated'&&!l;
  });
  const groups=new Map();
  for(const e of matches){if(!e.location)continue;const id=e.location.id;if(!groups.has(id))groups.set(id,{id,title:e.location.title,floorKey:e.location.floor_key,basis:e.location.basis,records:[],tone:e.flags.tone,reference:false});const g=groups.get(id);g.records.push(e.record);if(tones[e.flags.tone].rank>tones[g.tone].rank)g.tone=e.flags.tone;}
  const highlights=[...groups.values()].map(g=>{
    const cats=[...new Set(g.records.map(r=>r.category))];
    return {...g,count:g.records.length,colour:filter.colourBy==='system'?(cats.length===1?systemColours[cats[0]]||systemColours.other:'#45667d'):tones[g.tone].colour,
      symbol:tones[g.tone].symbol,label:filter.colourBy==='system'?(cats.length>1?'Multiple systems':cats[0]):tones[g.tone].label,recordIds:g.records.map(r=>r.id)};
  });
  const requested=new Set((filter.referenceTypes||[]).filter(t=>Object.hasOwn(referenceTypes,t)));
  const references=locations.filter(l=>requested.has(l.type)&&(!floor||floor.key===l.floor_key)&&(!query||(l.title+' '+l.id).toLowerCase().includes(query))&&!groups.has(l.id));
  for(const l of references)highlights.push({id:l.id,title:l.title,floorKey:l.floor_key,basis:l.basis,count:0,tone:'reference',colour:tones.reference.colour,symbol:'o',label:'Drawing location only',reference:true,recordIds:[]});
  highlights.sort((a,b)=>tones[b.tone].rank-tones[a.tone].rank||a.id.localeCompare(b.id));
  const counts=Object.fromEntries(viewModes.map(([id])=>[id,entries.filter(e=>filter.includeClosed||e.flags.active).filter(e=>id==='all'||id==='attention'&&e.flags.attention||id==='overdue'&&e.flags.overdue||id==='outages'&&e.flags.outage||id==='review'&&e.flags.review||id==='upcoming'&&e.flags.upcoming||id==='unlocated'&&!e.location).length]));
  const floors=(snapshot.floors||[]).map(f=>({id:f.id,key:f.key,name:f.name,coverage:f.coverage,count:entries.filter(e=>e.flags.active&&e.location?.floor_key===f.key&&(!filter.category||e.record.category===filter.category)).length,attention:entries.filter(e=>e.flags.active&&e.flags.attention&&e.location?.floor_key===f.key).length}));
  const systems=Object.fromEntries(Object.keys(systemColours).map(id=>[id,entries.filter(e=>e.record.category===id&&e.flags.active).length]));
  return {matches,highlights,unlocated:matches.filter(e=>!e.location),counts,floors,systems,locatedRecords:matches.filter(e=>e.location).length,locatedPlaces:groups.size,referenceCount:references.length};
}
