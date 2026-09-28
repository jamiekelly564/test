/** Tracking choices, not assets detected from a postcode or model. */
export const trackingCategories = [
  {id:'fire-doors',title:'Fire doors',icon:'door',description:'Inspections, repairs and door records.',examples:['Door register','Inspection reports','Remedial work']},
  {id:'fire-systems',title:'Fire systems',icon:'shield',description:'Alarms, extinguishers and smoke control.',examples:['Alarm servicing','Extinguisher records','Smoke-control maintenance']},
  {id:'emergency-lighting',title:'Emergency lighting',icon:'bulb',description:'Test records, faults and replacements.',examples:['Test reports','Reported faults','Replacement work']},
  {id:'building-fabric',title:'Roof & building fabric',icon:'building',description:'Roofs, gutters, walls and windows.',examples:['Roof repairs','Gutter clearance','Window maintenance']},
  {id:'water',title:'Water & leaks',icon:'drop',description:'Leaks, plumbing and water-system records.',examples:['Reported leaks','Plumbing repairs','Water-system checks']},
  {id:'heating',title:'Heating & ventilation',icon:'air',description:'Boilers, heating and ventilation servicing.',examples:['Service visits','Heating faults','Ventilation maintenance']},
  {id:'electrical',title:'Electrical',icon:'bolt',description:'Inspection records, lighting and repairs.',examples:['Electrical reports','Communal lighting','Repair jobs']},
  {id:'lifts-access',title:'Lifts & access',icon:'key',description:'Lift servicing, entry systems and security.',examples:['Lift records','Access-control faults','Entry-system servicing']},
  {id:'cleaning',title:'Cleaning & waste',icon:'spark',description:'Cleaning visits, bins and reported issues.',examples:['Cleaning visits','Waste collections','Resident-reported issues']},
  {id:'grounds',title:'Grounds & outside areas',icon:'leaf',description:'Gardens, paths, parking and outside work.',examples:['Grounds maintenance','Path repairs','External cleaning']},
  {id:'documents',title:'Documents & certificates',icon:'file',description:'Reports, warranties and renewal dates.',examples:['Inspection certificates','Warranties','Renewals']},
  {id:'general',title:'Other maintenance',icon:'tools',description:'Anything else your building needs.',examples:['General repairs','Contractor visits','Follow-up jobs']}
];
export const trackingStatuses = [{id:'open',label:'To do'},{id:'in_progress',label:'In progress'},{id:'awaiting_review',label:'Awaiting review'},{id:'closed',label:'Done'}];
export const TRACKING_NOTICE = 'Manual records, not live monitoring. The model does not detect assets, defects or compliance. A completed task is not a safety certification.';
