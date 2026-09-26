/** Commercial proposals only. No payment is collected and no subscription is activated. */
export const tiers = [
  { id: 'bronze', name: 'Bronze', purpose: 'Capture', description: 'Turn the agreed areas into a useful visual building record.', features: ['Agreed communal-area capture', 'Key locations and photographs', 'Document library', 'Survey findings and basic actions'], featured: false },
  { id: 'silver', name: 'Silver', purpose: 'Manage', description: 'Bring the building and its day-to-day workflow together.', features: ['More detailed capture specification', 'Structured asset register', 'Planned inspections and work tracking', 'Contractor and NFC/QR workflows'], featured: true },
  { id: 'gold', name: 'Gold', purpose: 'Optimise', description: 'Scope a more comprehensive survey and advanced reporting.', features: ['Expanded capture scope', 'Portfolio reporting and permissions', 'Source-linked AI questions', 'Budget planning and integrations'], featured: false },
];
export const surveyModules = [
  { id: 'fire_doors', name: 'Fire doors', icon: 'door', description: 'Select communal doors, flat entrances, or both in the scope notes.' },
  { id: 'condition', name: 'Building condition', icon: 'building', description: 'Accessible communal walls, floors, ceilings and visible defects.' },
  { id: 'external', name: 'Roof & external areas', icon: 'roof', description: 'Accessible elevations, gutters and grounds; specialist access separately scoped.' },
  { id: 'plant', name: 'Plant & services', icon: 'tool', description: 'Asset identification and document capture. Specialist tests are separate.' },
  { id: 'cleaning', name: 'Cleaning & presentation', icon: 'sparkle', description: 'Agreed areas, photographs and a record of presentation standards.' },
];
export const actionStatuses = ['open', 'in_progress', 'awaiting_review', 'closed'];
export const priorities = ['normal', 'high', 'urgent'];
export const reviewStatuses = ['not_reviewed', 'drawing_reviewed', 'site_check_needed'];
export const labels = { open:'Open', in_progress:'In progress', awaiting_review:'Awaiting review', closed:'Closed', normal:'Normal', high:'High', urgent:'Urgent', not_reviewed:'Not reviewed', drawing_reviewed:'Drawing reviewed', site_check_needed:'Site check needed' };
export const featureStatus = [
  { name:'Interactive Marketfield model', state:'working', detail:'Existing estimated geometry with floor controls, cutaway and source comparison.' },
  { name:'Buildings, locations & notes', state:'working', detail:'Persisted in the SQLite workspace on your PC.' },
  { name:'Survey scope & package selection', state:'working', detail:'Saves a local quotation request. No email, appointment or payment is sent.' },
  { name:'Documents & task tracking', state:'working', detail:'Private local uploads, task statuses and event history.' },
  { name:'Postcode lookup', state:'optional', detail:'Optional postcode centroid lookup. Does not provide an address list or building outline.' },
  { name:'Automatic exterior model creation', state:'working', detail:'Postcode / Maps pin to selected OSM outlines, estimated exterior geometry, local persistence, GLB and GeoJSON export. Requires internet for live mapping.' },
  { name:'GPT-6 height suggestions', state:'optional', detail:'Opt-in bounded assumptions via the OpenAI Responses API. Private server-side key required; not a measured survey.' },
  { name:'Stripe & paid feature entitlements', state:'planned', detail:'No charges, checkout or paid access controls are active.' },
  { name:'Customer accounts & multi-tenant access', state:'planned', detail:'This is a single-owner local preview, not a public client portal.' },
  { name:'AI analysis & automated floor-plan conversion', state:'planned', detail:'Not connected. Uploaded documents are stored, not automatically interpreted.' },
];
