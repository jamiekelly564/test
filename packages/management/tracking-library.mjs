/** Operational prompts, not findings, installed-equipment claims or a statutory schedule.
 * New entries require the operator to save an ordinary existing management record.
 */
const sections = [
 ['doors','Doors & compartmentation','door corridor lobby riser plant stair',[
  ['Flat entrance doors','Door identity, access attempts, inspection report, defects, remedial evidence and next agreed check'],
  ['Communal doors','Leaf/frame condition, closing action, latch, gaps, seals, glazing and inspection evidence'],
  ['Riser and cupboard doors','Access, leaf/frame, hinges, seals, locks and the applicable inspection specification'],
  ['Access hatches','Identity, opening protection, condition and evidence of reinstatement'],
  ['Closers and hold-open devices','Device identity, adjustment, release/function checks and maintenance report'],
  ['Hinges, locks and ironmongery','Specification, fixings, condition and repair/replacement history'],
  ['Door seals and threshold seals','Product identity, damage, gaps and repair evidence'],
  ['Fire-resisting glazing','Documented specification, markings, beads, damage and specialist evidence'],
  ['Fire stopping and penetrations','Location, before/after evidence, product/system records, installer and review'],
  ['Compartment walls and ceilings','Recorded construction, damage, alterations, openings and specialist investigations'],
  ['Fire and smoke dampers','Asset location/access, maintenance method, service report and defects'],
  ['Door signage','Identity, legibility, location and replacement tasks']]],
 ['fire','Fire detection & protection','plant riser corridor lobby service',[
  ['Fire alarm panel','Panel identity, service provider, faults, isolations, test evidence and reinstatement'],
  ['Detectors and interfaces','Recorded location, system association, testing, faults and replacement'],
  ['Call points and sounders','Location, testing, damage and service reports'],
  ['Evacuation alert system','Where provided: equipment register, competent servicing, faults and evidence'],
  ['Sprinkler / suppression equipment','Where provided: system scope, heads, valves, tests and competent service records'],
  ['Fire pumps and tanks','Where provided: plant identity, water supply, test reports and defects'],
  ['Dry / wet risers','Inlets, outlets, access, signs and competent inspection/testing records'],
  ['Fire extinguishers','Where provided: identity, position, servicing, damage and replacement'],
  ['Fire-system isolation','Authorisation, affected areas, interim measures and evidenced reinstatement']]],
 ['escape','Smoke control & shared routes','corridor lobby stair roof',[
  ['Automatic opening vents','Identity, controls, actuators, service reports and recorded faults'],
  ['Smoke fans and shafts','Equipment, access, system relationship and competent testing/servicing'],
  ['Emergency lighting','Fittings, circuit references, testing reports, failures and repairs'],
  ['Exit and wayfinding signs','Location, visibility, condition and replacement tasks'],
  ['Route obstructions','Precise location, photograph, responsible party, removal and recheck'],
  ['Information box','Current contents register, controlled document versions and review history; no access codes'],
  ['Firefighter access','Access routes, recorded restrictions, equipment access and action ownership'],
  ['Refuge communication','Where provided: equipment identity, testing, faults and service evidence']]],
 ['structure','Structure & balconies','balcony stair exterior',[
  ['Structural survey actions','Survey reference, exact location, engineer recommendations and closure evidence'],
  ['Cracks and movement reports','Observation photographs, date, location and competent assessment; no diagnosis from the model'],
  ['Concrete and reinforcement','Specialist findings, repairs, protection and inspection evidence'],
  ['Balcony slabs and fixings','Location, specialist review, works and completion records'],
  ['Balustrades and guarding','Reported damage, fixings, specialist assessment and repair evidence'],
  ['Retaining walls','Location, inspection findings, drainage and planned works'],
  ['Structural alterations','Approval references, design records, inspections and handover evidence']]],
 ['fabric','Roof, facade & windows','window roof exterior balcony corridor',[
  ['Roof coverings','Roof zone, material records, leaks, inspections and repairs'],
  ['Roof drainage and outlets','Outlet zones, blockages, cleaning and drainage maintenance'],
  ['Gutters and downpipes','Location, damage, blockages, cleaning access and completed work'],
  ['Rooflights and roof hatches','Identity, glazing, seals, access and condition reports'],
  ['Facade and cladding','Recorded construction, surveys, fixings, defects and repair evidence'],
  ['Brickwork, render and pointing','Area, reported deterioration, specialist recommendations and repairs'],
  ['Windows and frames','Window location, seals, opening hardware, damage and replacement history'],
  ['Window restrictors','Where specified: identity, documented requirements, inspections and repairs'],
  ['Balcony / terrace waterproofing','Area, leak history, drainage and repair evidence'],
  ['Expansion joints and sealants','Zone, product records, defects and replacement programme'],
  ['Internal walls and ceilings','Area, finishes, damage, damp reports and decoration work'],
  ['Floor finishes and thresholds','Area, finish type, trip reports, wear, repairs and replacement allowance']]],
 ['lifts','Lifts & accessibility','lift lobby stair entrance',[
  ['Passenger lift','Identity, contractor, servicing, breakdowns, examinations and action reports'],
  ['Firefighting / evacuation lift','Only where provided: documented function, system dependencies, checks and outages'],
  ['Lift alarm and communication','Tests, failures, contractor response and restoration'],
  ['Lift motor / control equipment','Access, equipment identity, service reports and defects'],
  ['Lift examination actions','Examination report, recommendations, deadlines and accepted completion'],
  ['Entrapment / breakdown case','Time, response, affected lift, external incident reference and restoration'],
  ['Accessible entrances and ramps','Location, obstructions, defects, access arrangements and maintenance'],
  ['Platform lifts','Where present: equipment identity, servicing and examination records']]],
 ['water','Water, plumbing & drainage','plant service riser bin',[
  ['Incoming water supply','Supply point, provider, isolation reference and faults'],
  ['Isolation valves','Identity, location, system served and documented operating information'],
  ['Water storage tanks','Identity, access, inspection/cleaning reports and specialist actions'],
  ['Booster / circulation pumps','Equipment identity, system served, faults and servicing'],
  ['Water meters','Meter identity, dated manual readings, usage queries and billing references'],
  ['Water hygiene programme','Assessment reference, control tasks, responsible party and evidence; intervals set by that assessment'],
  ['Water temperature / flushing logs','Evidence reference, method, responsible person and results recorded in the appropriate programme'],
  ['Leak investigation','Affected area, photographs, suspected source clearly labelled, isolation and repair evidence'],
  ['Soil / waste stacks','Location where known, leaks, blockage history, access and repairs'],
  ['Gullies and drainage channels','Area, condition, clearance visits and repeat problems'],
  ['Sump pumps and flood alarms','Where present: equipment, test/service reports, outages and restoration'],
  ['Backflow / non-return devices','Where present: identity, competent inspection/service records and defects']]],
 ['hvac','Heating, ventilation & gas','plant service riser',[
  ['Communal boilers','Equipment identity, competent service records, faults and replacement plan'],
  ['Heat pumps','Equipment identity, service provider, operating faults and maintenance'],
  ['Heat interface units','Identity, flat/area served, access appointments and service evidence'],
  ['Heating controls and BMS','System identity, faults, configuration/change reference; no credentials'],
  ['Extract / supply fans','Location, filters, service reports and performance complaints'],
  ['Ductwork and grilles','Access, cleaning, damage, specialist reports and maintenance'],
  ['Filters','Equipment served, specification, change history and next agreed replacement'],
  ['Gas installation records','Scope of responsibility, competent contractor, certification and remedial actions'],
  ['Gas isolation points','Verified location and controlled operating reference; no invented routes'],
  ['Communal hot-water plant','Equipment, system served, service evidence and fault response']]],
 ['electrical','Electrical & energy','plant service riser corridor',[
  ['Distribution boards','Identity, circuits served, access, labels and competent inspection reports'],
  ['Communal lighting','Fitting/area, failures, replacement, energy and maintenance records'],
  ['Electrical installation reports','Report reference, scope, observations and remedial evidence'],
  ['Portable equipment','Where managed: inventory, risk-based checks and repair/replacement history'],
  ['Electricity meters','Identity, dated readings, consumption and supplier/billing references'],
  ['Generator and backup power','Where installed: service reports, tests, faults and readiness records'],
  ['UPS and battery systems','Equipment identity, replacement dates, faults and competent servicing'],
  ['Lightning protection','System register, inspection reports, actions and repairs'],
  ['Solar PV / inverter','Where installed: equipment, warranties, faults and service records'],
  ['EV charging equipment','Identity, responsible operator, defects, service history and usage references'],
  ['Electrical risers and containment','Verified routes where recorded, access, condition and alterations']]],
 ['security','Security & access','entrance lobby door exterior',[
  ['Intercom / entry panel','Equipment identity, faults, contractor and repair evidence'],
  ['Access-control equipment','Readers/controllers, faults and servicing; never store access credentials'],
  ['Entrance locks and releases','Door relationship, access faults, emergency-release checks where applicable'],
  ['Powered gates and barriers','Identity, specialist service/inspection records, faults and safety actions'],
  ['CCTV equipment','Camera/equipment identity, maintenance and controlled policy references; no footage or passwords'],
  ['Key / fob administration','Anonymised request reference, approval and completion; no key codes'],
  ['Security incidents','Anonymised case reference, actions, contractor and resolution'],
  ['Post boxes and parcel areas','Damage, access complaints, signage and repairs']]],
 ['cleaning','Communal presentation & cleaning','corridor lobby stair bin cycle community',[
  ['Communal area','Area boundary/reference, responsibility, finishes, cleaning contractor and evidence'],
  ['Routine area cleaning','Area, agreed service scope, visit evidence, missed visits and follow-up'],
  ['Carpet / hard-floor cleaning','Finish type, service scope, stain/wear reports and completed work'],
  ['Window cleaning','Areas included, safe access contractor, dates and completion evidence'],
  ['Touchpoints and handrails','Area, cleaning scope, damage reports and completed visits'],
  ['Bin-store housekeeping','Waste storage, cleaning, access, leaks, pests and repeat issues'],
  ['Waste and recycling collection','Service scope, missed collections, contamination and contractor follow-up'],
  ['Bulky waste / fly-tipping','Location, photograph, authorised disposal and completion'],
  ['Refuse chutes','Where provided: cleaning, blockages, doors and maintenance history'],
  ['Pest-control visits','Area, contractor report, treatment reference and follow-up'],
  ['Graffiti and litter','Location, photographs, cleaning/reinstatement evidence'],
  ['Decoration and presentation','Area, finish schedule, damage, quote, programme and handover']]],
 ['grounds','Grounds & shared facilities','exterior cycle community',[
  ['Paths and paving','Area, trips, damage, surface water and repairs'],
  ['Gardens and planting','Area, service scope, seasonal work and contractor visits'],
  ['Tree inspections and actions','Tree location where verified, competent reports and required works'],
  ['Fences and boundaries','Responsibility, condition, damage and repairs'],
  ['External lighting','Verified fitting/area, outages and repairs'],
  ['Parking and accessible bays','Space reference, markings, maintenance and anonymised case administration'],
  ['Cycle stores and racks','Area, access, capacity policy, damage and maintenance'],
  ['Shared lounges / community rooms','Area, cleaning, fixtures, bookings-policy reference and repair work'],
  ['Play / leisure equipment','Only where present: identity, competent inspections and actions'],
  ['Winter / severe-weather readiness','Agreed programme, supplies, contractor and visit evidence'],
  ['External drainage and flooding','Known drainage areas, clearance, incident history and mitigation']]],
 ['health','Health & safety records','corridor plant roof community',[
  ['Asbestos register references','Controlled survey/register reference, location, management actions and review'],
  ['Damp and mould reports','Location, dated photographs, investigation, responsible party and remedial evidence'],
  ['Slip / trip / fall reports','Area, interim action, incident reference and repair evidence'],
  ['Roof access and fall protection','Equipment/zone, access restrictions and competent inspection evidence'],
  ['Accident and near-miss administration','Anonymised case, actions, review and controlled report reference'],
  ['Hazardous-material information','Controlled assessment/data-sheet references and responsibility'],
  ['Lone-working / contractor arrangements','Approved process reference, responsible party and review'],
  ['Access and safety notices','Location, current notice revision, condition and review']]],
 ['residents','Residents & engagement','lobby community flat',[
  ['Resident repair request','Anonymised reference, affected area, owner and response status'],
  ['Access appointment / failed visit','Anonymised case, location, date, outcome and next action'],
  ['Complaint and response','Anonymised case reference, topic, owner, due date and outcome'],
  ['Resident notice','Notice reference, revision, audience scope and issue/review record'],
  ['Consultation administration','Consultation reference, stage, responses held separately and decisions'],
  ['Alteration request','Approval reference, drawings, responsibility, inspections and handover'],
  ['Evacuation-process administration','Process owner and anonymised reference only; no personal health/PEEP information']]],
 ['repairs','Repairs & contractor control','all',[
  ['Repair work order','Issue, location, priority, interim measures, owner and accepted completion evidence'],
  ['Quotation and approval','Scope, supplier quote, approval reference and associated work'],
  ['Contractor competence','Organisation, scope, competence evidence and renewal review'],
  ['Contractor insurance','Policy reference, scope, expiry and renewal responsibility'],
  ['RAMS and permit records','Approved document references, location/scope and responsible person'],
  ['Attendance and access','Visit reference, agreed scope, access outcome and follow-up'],
  ['Completion evidence review','Before/after evidence, reviewer, exceptions and acceptance'],
  ['Warranty / defects period','Supplier, affected asset, scope, end date and notified defects']]],
 ['finance','Costs, contracts & insurance','building',[
  ['Budget / forecast','Period, scope, amount and decision reference; not an accounting reconciliation'],
  ['Quotation / committed cost','Supplier, scope, amount and authorisation reference'],
  ['Paid cost reference','Invoice reference, amount and payment date; no bank credentials'],
  ['Reserve / replacement allowance','Asset, estimated replacement, basis and planning period'],
  ['Service contract','Provider, scope, start/end/notice dates and allowance'],
  ['Insurance policy / claim','Policy or claim reference, scope, renewal and actions'],
  ['Utility contract','Provider, meter/system reference, renewal and procurement actions'],
  ['Service-charge administration','Controlled statement/reference and review actions; no personal arrears or banking data']]],
 ['projects','Major works & change control','building exterior',[
  ['Major works programme','Scope, approved design, milestones, costs and change history'],
  ['Planning / building-control references','Application/decision reference, scope, conditions and evidence'],
  ['Design and specification revisions','Author, revision, approvals and superseded documents'],
  ['Consultation stages','Process reference, stage, dates, owner and decision records'],
  ['Construction inspections','Competent reports, location, observations and remedial evidence'],
  ['Handover / O&M information','Document register, warranties, asset updates and outstanding items'],
  ['Defects and change requests','Location, agreed change, approvals, contractor and closure evidence']]],
 ['safety','Building governance & information','building',[
  ['Dutyholder responsibilities','Recorded role, organisation, scope and appointment evidence'],
  ['Building classification evidence','Documentary height/storeys/use evidence and competent applicability review'],
  ['Building registration reference','Actual registration details and controlled supporting records'],
  ['Safety case records','Controlled report, supporting evidence, owner and review actions'],
  ['Fire risk assessment actions','Assessment reference, owner, priorities and closure evidence'],
  ['External-wall information','Controlled construction/survey records, revisions and specialist actions'],
  ['Firefighter plans and information','Current drawings, issued revisions and information-box review'],
  ['Resident engagement process','Strategy revision, responsibilities, feedback and actions'],
  ['Mandatory occurrence process','Dutyholder assessment and external submission references; nothing sent automatically'],
  ['Regulator correspondence','External reference, required action, owner and deadline'],
  ['Emergency / outage arrangements','Actual controlled procedure, roles and recorded exercises'],
  ['Golden-thread document review','Current versions, missing information, access responsibility and audit records']]],
 ['other','Other responsibilities','all',[
  ['Other equipment or responsibility','Describe what is present, who is responsible, its evidence and any applicable programme']]]
];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const trackingItems=Object.freeze(sections.flatMap(([category,group,tags,items])=>items.map(([label,scope])=>Object.freeze({id:category+'-'+slug(label),category,group,label,scope,tags:tags.split(' ')}))));
export const trackingSections=Object.freeze(sections.map(([id,label])=>({id,label,count:trackingItems.filter(i=>i.category===id).length})));
export function locationTags(l){
 const name=String(l?.title||'').toLowerCase(),t=String(l?.type||'');
 const tags=new Set(['all']);if(!l)tags.add('building');
 for(const [tag,rx] of Object.entries({corridor:/corridor|passage/,lobby:/lobby|landing|entrance/,stair:/stair/,lift:/lift/,riser:/riser|shaft/,plant:/plant|sub.?station/,bin:/bin|refuse|waste/,cycle:/cycle|bike/,community:/community|communal room|shared lounge/,roof:/roof/,balcony:/balcony|terrace/,window:/window/,door:/door/,flat:/apartment|flat|bedroom|living/}))if(rx.test(name)||t===tag)tags.add(tag);
 if(['plant','riser','bin'].some(x=>tags.has(x)))tags.add('service');
 return [...tags];
}
export function communalLocation(l){
 if(!l||l.type==='void')return false;
 if(l.type==='stairs')return true;
 if(l.type!=='space')return false;
 const n=String(l.title||'').toLowerCase();
 if(/apartment|bedroom|living|\bflat\b|private/.test(n)&&!/community/.test(n))return false;
 return /corridor|lobby|landing|entrance|community|communal|shared|cycle|bike|plant|bin|refuse|\bstore\b|sub.?station/.test(n);
}
export function trackingSuggestions(l,limit=12){
 const tags=new Set(locationTags(l));
 return trackingItems.map(i=>({i,score:i.tags.reduce((n,t)=>n+(tags.has(t)?t==='all'?1:4:0),0)+(i.id==='cleaning-communal-area'&&communalLocation(l)?20:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i.label.localeCompare(b.i.label)).slice(0,limit).map(x=>x.i);
}
export function searchTracking(query='',category=''){
 const words=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
 return trackingItems.filter(i=>(!category||i.category===category)&&words.every(w=>(i.label+' '+i.group+' '+i.scope).toLowerCase().includes(w)));
}
export const openWorkTone=Object.freeze({colour:'#a46d24',label:'Open work / follow-up',symbol:'!',rank:3});
export const isIssueEntry=e=>!!(e.flags?.active&&(e.flags.attention||e.record.kind==='work'));
export function issueMarkers(view,colourBy='status'){
 // Ordinary assets, unconfirmed information and future-only checks are never persistent dots.
 const entries=new Map((view.matches||[]).filter(e=>isIssueEntry(e)&&e.location).map(e=>[e.record.id,e]));
 return (view.highlights||[]).filter(h=>!h.reference&&h.recordIds?.some(id=>entries.has(id))).map(h=>{
  const ids=h.recordIds.filter(id=>entries.has(id)),ordinaryWork=ids.every(id=>!entries.get(id).flags.attention);
  const display=ordinaryWork?{tone:'work',symbol:'!',...(colourBy==='status'?{colour:openWorkTone.colour}:{})}:{};
  return {...h,...display,count:ids.length,recordIds:ids,label:colourBy==='system'?h.label:ordinaryWork?openWorkTone.label:'Recorded issue / follow-up'};
 });
}
function recordKind(item){
 if(item.category==='finance')return /contract|policy|insurance/.test(item.label.toLowerCase())?'contract':/administration/.test(item.label.toLowerCase())?'work':'cost';
 if(item.category==='residents')return 'resident';
 if(item.category==='safety')return /responsibilit/.test(item.label)?'responsibility':'safety';
 if(item.category==='projects')return /revision|reference|information/.test(item.label)?'document':'work';
 if(item.category==='repairs')return /competence|insurance|RAMS/.test(item.label)?'document':'work';
 if(item.category==='health')return /register|information|arrangements/.test(item.label)?'document':'work';
 return 'asset';
}
export function trackingActions(item){
 const kind=recordKind(item),labels={asset:'Register item',work:'Add work record',cost:'Add cost record',contract:'Add contract',document:'Add document record',responsibility:'Record responsibility',safety:'Add safety record',resident:'Add anonymised case'};
 return [{kind,label:labels[kind]},...(kind==='work'?[]:[{kind:'work',label:'Add task'}]),{kind:'schedule',label:'Plan check'}];
}
export function trackingPreset(item,action,location){
 if(!trackingItems.some(i=>i.id===item?.id)||!['asset','work','schedule','cost','contract','document','responsibility','safety','resident'].includes(action))throw new Error('Choose a valid tracking item and action.');
 const place=location?location.floor_key+' / '+location.title:'Building-wide / location unconfirmed';
 const p={kind:action,title:item.label+' - '+place,category:item.category,locationId:location?.id||'',notes:'Tracking scope: '+item.scope+'.\nCatalogue prompt only; presence, applicability and current condition must be confirmed.',data:{}};
 if(action==='asset'){p.status='unconfirmed';p.data={equipment:item.id==='cleaning-communal-area'?'Communal area':item.label,basis:item.id==='cleaning-communal-area'&&location?'drawing_derived':'unconfirmed',specification:'Source location: '+(location?.source||'not recorded')+'. '+(location?.basis||'unconfirmed')+'. '+item.scope};}
 if(action==='work'){p.status='reported';p.data={priority:'routine',completionNotes:''};}
 if(action==='schedule'){p.status='paused';p.data={intervalUnit:'none',interval:1,basisType:'manager_programme',basisReference:'Set applicability and frequency from the agreed programme, risk assessment, manufacturer or competent advice before activating.',scope:item.scope};}
 if(action==='cost'){p.status='forecast';p.data={amount:'',reference:'',period:''};}
 if(action==='contract'){p.status='draft';p.data={coverage:item.scope};}
 if(action==='document'){p.status='draft';p.data={documentType:'other',reference:''};}
 if(action==='responsibility'){p.status='unconfirmed';p.data={role:'Other',scope:item.scope};}
 if(action==='safety'){p.status='not_started';p.data={topic:'Other',nextAction:item.scope};}
 if(action==='resident'){p.status='open';p.data={caseType:'Repair request',outcome:item.scope};}
 return p;
}
