/* Tracking scope is a catalogue, not a finding that an asset exists or is safe. */
export const categories = [
 ['doors','Fire doors & compartmentation','Flat entrances, communal doors, risers, hatches, seals, closers, glazing, fire stopping, penetrations, dampers'],
 ['fire','Fire detection & protection','Alarm panels, detectors, call points, sounders, sprinklers, tanks, pumps, dry/wet risers, extinguishers'],
 ['escape','Smoke control & escape provisions','AOVs, fans, shafts, emergency lighting, signage, corridors, information boxes, obstructions'],
 ['structure','Structure & balconies','Structural surveys, cracking, concrete, balcony connections, balustrades, retaining walls'],
 ['fabric','Roof, facade & windows','Roof coverings, terraces, rooflights, gutters, outlets, cladding, render, masonry, glazing'],
 ['lifts','Lifts & accessibility','Passenger/firefighting/evacuation lifts where present, alarms, servicing, examinations, ramps, platforms'],
 ['water','Water, plumbing & drainage','Supplies, valves, tanks, pumps, meters, hygiene controls, leaks, stacks, gullies, sump pumps'],
 ['hvac','Heating, ventilation & gas','Communal heating, heat pumps, HIUs, extract fans, filters, controls, gas equipment'],
 ['electrical','Electrical & energy','Distribution boards, communal lighting, meters, generators, batteries, lightning protection, PV, EV charging'],
 ['security','Security & access','Intercoms, entrance locks, gates, barriers, CCTV equipment, access faults; no access codes in this register'],
 ['cleaning','Cleaning, waste & pests','Cleaning visits, carpets, window cleaning, bins, chutes, bulky waste, pest control, graffiti'],
 ['grounds','Grounds & shared facilities','Trees, paths, fences, parking, cycle stores, gardens, lounges, gyms and other shared areas'],
 ['health','Health & safety','Asbestos register references, damp/mould reports, hazards, roof access and fall protection'],
 ['residents','Residents & engagement','Anonymised access cases, complaints, notices, consultation and alterations; no medical/PEEP profiles'],
 ['repairs','Repairs & contractors','Quotations, authorisation, competence, insurance, RAMS, permits, work orders, evidence and warranties'],
 ['finance','Costs, contracts & insurance','Budgets, quotes, commitments, invoices, reserves, renewals, warranty dates and claim references'],
 ['projects','Major works & alterations','Approvals, consultation, specifications, programme, changes, handover and defects'],
 ['safety','Building safety & governance','Dutyholders, registration, FRA, safety case, engagement, incident references, documents and regulator correspondence'],
 ['other','Other responsibility','Add a responsibility or asset not covered by the catalogue']
].map(([id,label,examples])=>({id,label,examples}));
const field=(key,label,type='text',extra={})=>({key,label,type,...extra});
const select=(key,label,options,extra={})=>field(key,label,'select',{options,...extra});
export const kinds = {
 asset:{label:'Asset',plural:'Assets',statuses:['unconfirmed','in_service','out_of_service','retired'],fields:[
  field('assetTag','Site asset ID / NFC reference'),field('equipment','Type / equipment'),field('manufacturer','Manufacturer'),field('model','Model / serial number'),
  field('specification','Specification and source','textarea'),select('basis','Information basis',['unconfirmed','drawing_derived','site_observed','document_supported']),
  field('verifiedBy','Checked by (self-declared)'),field('verifiedOn','Checked on','date'),field('installedOn','Installed on','date'),field('warrantyUntil','Warranty until','date'),field('contractor','Maintainer / contractor'),field('replacementAmount','Replacement allowance, GBP incl. VAT','money')]},
 work:{label:'Work order',plural:'Work orders',statuses:['reported','assessed','awaiting_approval','authorised','in_progress','no_access','awaiting_review','closed','cancelled'],fields:[
  select('priority','Priority',['routine','soon','urgent','immediate']),field('interimMeasures','Interim measures / immediate action','textarea'),field('contractor','Assigned contractor'),field('approvalRef','Approval / authority reference'),field('completionNotes','Completion notes','textarea')]},
 schedule:{label:'Scheduled check',plural:'Checks & maintenance',statuses:['active','paused'],fields:[
  select('intervalUnit','Repeat unit',['months','days','none']),field('interval','Repeat every','integer',{min:1,max:3650,default:1}),
  select('basisType','Why this frequency?',['manager_programme','risk_assessment','manufacturer','contract','legislation','competent_person']),field('basisReference','Frequency / applicability reference','textarea',{required:true}),field('scope','What must be checked','textarea')]},
 document:{label:'Document record',plural:'Documents',statuses:['draft','current','superseded','review_due'],fields:[
  select('documentType','Document type',['drawing','certificate','inspection_report','manual','risk_assessment','contract','insurance','other']),field('reference','Reference'),field('revision','Revision'),field('issuedOn','Issue date','date'),field('expiresOn','Expiry date','date'),field('supersedesId','Supersedes record','record-document'),field('issuer','Issuer / author')]},
 cost:{label:'Cost record',plural:'Costs',statuses:['forecast','quotation','committed','paid','void'],fields:[
  field('amount','Amount, GBP including VAT','money',{required:true}),field('period','Budget period / financial year'),field('reference','Quote / invoice reference'),field('supplier','Supplier'),field('paidOn','Paid on','date')]},
 contract:{label:'Contract / warranty',plural:'Contracts',statuses:['draft','active','expired','ended'],fields:[
  field('supplier','Supplier / insurer'),field('reference','Contract / policy reference'),field('startsOn','Start date','date'),field('endsOn','End date','date'),field('noticeOn','Notice deadline','date'),field('amount','Annual allowance, GBP incl. VAT','money'),field('coverage','Coverage / exclusions','textarea')]},
 responsibility:{label:'Responsibility',plural:'Responsibilities',statuses:['unconfirmed','recorded','ended'],fields:[
  select('role','Role',['Principal Accountable Person','Accountable Person','Responsible Person','Managing agent','Contractor','Owner / leaseholder boundary','Other']),field('organisation','Organisation'),field('scope','Parts / responsibilities covered','textarea',{required:true}),field('authority','Lease, contract or appointment reference'),field('businessContact','Business contact (no personal access credentials)')]},
 safety:{label:'Safety record',plural:'Building safety',statuses:['not_started','in_progress','needs_review','recorded','needs_action'],fields:[
  select('topic','Topic',['Building classification','Registration','Safety case','Fire risk assessment','Structural safety','External wall information','Firefighter plans / information box','Resident engagement','Evacuation arrangements process','Mandatory occurrence process','Regulator correspondence','Other']),field('reference','External reference'),field('classificationEvidence','Applicability / evidence','textarea'),field('nextAction','Next action','textarea')]},
 incident:{label:'Incident / outage',plural:'Incidents & outages',statuses:['open','made_safe','repairing','resolved','closed'],fields:[
  field('noticedAt','Identified at (local time)','datetime'),field('interimMeasures','Immediate measures','textarea',{required:true}),field('notificationDeadline','Notification / report deadline (set by dutyholder)','datetime'),field('reportability','Dutyholder reportability assessment','textarea'),field('notifiedAt','External notification recorded at','datetime'),field('reportReference','External notification reference'),field('restoredAt','Restored at','datetime')]},
 resident:{label:'Engagement / access case',plural:'Engagement & access',statuses:['open','awaiting_access','awaiting_response','resolved','closed'],fields:[
  select('caseType','Case type',['Access attempt','Repair request','Complaint','Notice','Consultation','Alteration request','Evacuation-process administration']),field('caseReference','Anonymised case reference'),field('attemptedOn','Attempt / communication date','date'),field('outcome','Outcome / next step (no health details)','textarea')]}
};
export const commonFields=[field('title','Title','text',{required:true}),select('category','Category',categories.map(c=>c.id)),field('locationId','Model location','location'),field('assetId','Linked asset','asset'),field('owner','Responsible organisation / person'),field('dueDate','Due / review date','date'),field('notes','Notes','textarea'),field('evidenceReference','External evidence / report reference')];
export const templates=[
 {id:'communal-doors',kind:'schedule',title:'Communal fire-door checks',category:'doors',data:{intervalUnit:'months',interval:3,basisType:'legislation',basisReference:'Regulation 10: assess applicability for an English multi-occupied residential building with storeys over 11m. Quarterly common-part fire-door checks. Routine checks do not replace maintenance.',scope:'Define the communal doors included, record access issues and follow-up defects.'},source:'https://www.gov.uk/government/publications/fire-safety-england-regulations-2022/fact-sheet-fire-doors-regulation-10'},
 {id:'flat-doors',kind:'schedule',title:'Flat entrance fire-door checks',category:'doors',data:{intervalUnit:'months',interval:12,basisType:'legislation',basisReference:'Regulation 10: assess applicability for an English multi-occupied residential building with storeys over 11m. Annual flat-door checks on a best-endeavours basis; record access attempts.',scope:'Include both sides of the door. A failed access attempt does not complete a check.'},source:'https://www.gov.uk/government/publications/fire-safety-england-regulations-2022-fire-door-guidance/fire-safety-england-regulations-2022-fire-door-guidance'},
 {id:'fire-equipment',kind:'schedule',title:'Applicable high-rise firefighting equipment checks',category:'fire',data:{intervalUnit:'months',interval:1,basisType:'legislation',basisReference:'Assess the Fire Safety (England) Regulations 2022 high-rise scope and applicable equipment. Routine monthly checks are additional to competent servicing.',scope:'Set the actual equipment scope. Escalate outages promptly; the app does not notify the fire and rescue service.'},source:'https://www.gov.uk/government/publications/check-your-fire-safety-responsibilities-under-the-fire-safety-england-regulations-2022/check-your-fire-safety-responsibilities-under-the-fire-safety-england-regulations-2022'},
 {id:'fra',kind:'safety',title:'Fire risk assessment and action register',category:'safety',data:{topic:'Fire risk assessment'}},
 {id:'safety-case',kind:'safety',title:'Safety case and supporting information',category:'safety',data:{topic:'Safety case'},source:'https://www.gov.uk/guidance/preparing-a-safety-case-report'},
 {id:'golden-thread',kind:'safety',title:'Building information / golden-thread review',category:'safety',data:{topic:'Other'},source:'https://www.gov.uk/guidance/keeping-information-about-a-higher-risk-building-the-golden-thread'},
 {id:'mor',kind:'safety',title:'Mandatory occurrence reporting process',category:'safety',data:{topic:'Mandatory occurrence process',nextAction:'Dutyholder assesses reportability and handles external notices/reports. No automatic report is submitted.'},source:'https://www.gov.uk/guidance/submit-a-mandatory-occurrence-notice-and-report'},
 {id:'evacuation',kind:'safety',title:'Evacuation arrangements administration',category:'safety',data:{topic:'Evacuation arrangements process',nextAction:'Track process ownership and review only. Keep personal evacuation/medical information in an appropriately restricted system, not this local prototype.'},source:'https://www.gov.uk/government/publications/residential-personal-emergency-evacuation-plans-residential-peeps'}
];
export const boundary='Local-owner prototype. No live sensors, automatic safety judgements, notifications, payments or resident medical records. Statuses are human-entered. Model locations are not verified installed assets.';
export const referenceReviewDate='2026-09-29';
