import { validateSpec } from './model.mjs';

export const RELEASE = '0.9.0';
export function postcodeValue(value) {
  const raw = String(value || '').toUpperCase().replace(/\s/g, '');
  if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(raw)) return null;
  return `${raw.slice(0, -3)} ${raw.slice(-3)}`;
}
export function propertyInput(name, postcode) {
  const clean = String(name || '').trim(), code = postcodeValue(postcode);
  const errors = {};
  if (clean.length < 2 || clean.length > 150 || /[\u0000-\u001f]/.test(clean)) errors.name = 'Enter the building name, for example Queensgate.';
  if (!code) errors.postcode = 'Enter the full postcode, for example RH1 1RT.';
  return { name: clean, postcode: code, errors };
}
export function modelBasis(p) {
  if (p.meta?.basis === 'user-adjusted-estimate' || p.basis === 'user-adjusted-estimate') return 'Your adjusted estimate';
  if (p.spec?.mapped || p.meta?.basis === 'map-based-estimate' || p.basis === 'map-based-estimate') return 'Map-based estimate / unconfirmed match';
  const basis = p.spec?.matchBasis || p.matchBasis;
  if (!basis || basis === 'unresolved') return 'Starting estimate';
  return basis === 'ambiguous' ? 'Building match uncertain' : 'Research-informed estimate';
}
export function retryRemaining(p, clock = Date.now()) {
  const wait = Number(p?.meta?.error?.retryAfterSeconds) || 0;
  return Math.max(0, Math.ceil(wait - (clock - Date.parse(p?.updated_at || '')) / 1000)) || 0;
}
export function stageSteps(p) {
  if (p.meta?.mapData && !p.meta?.usage?.responses) {
    const found = !!p.spec?.mapped, scan = !!p.spec?.mapped?.scan;
    return [{label:'Starting shape',state:'done'}, {label:'Open map outline',state:found?'done':p.status==='refining'?'active':'paused'},
      {label:scan?'Scan height available':'Height estimated',state:found?'done':'pending'},
      {label:'AI appearance (optional)',state:p.status==='refining'?'pending':'paused'}];
  }
  const phases = ['initial', 'research', 'appearance', 'checking'];
  let index = phases.indexOf(p.stage);
  if (p.stage === 'complete') index = 4;
  if (index < 0) index = Math.max(0, ...(p.meta?.events || []).map(v => phases.indexOf(v.stage)));
  return ['Starting shape', 'Find references', 'Refine exterior', 'Check consistency'].map((label, i) => ({
    label,
    state: i === 0 || i < index ? 'done' : i === index && p.status === 'refining' ? 'active' : i === index && index > 0 ? 'paused' : 'pending'
  }));
}
export function statusCopy(p) {
  if (p.status === 'refining') return { title: 'Improving your estimate', detail: 'Explore the model while open-map and appearance research runs. Keep the PC server open.' };
  if (p.stage === 'local') return { title: 'Your starting estimate is ready', detail: 'Online research is not connected on this PC. You can still explore and adjust the shape.' };
  if (p.stage === 'deferred') return { title: 'Estimate saved', detail: 'Another building is using research. You can start an additional pass when it finishes.' };
  if (p.stage === 'budget') return { title: 'Estimate saved; research paused', detail: 'The development processing allowance has been reached. No further AI requests were started.' };
  if (p.stage === 'fallback') return { title: 'Your estimate is safe', detail: 'Research could not finish. The last usable shape is saved; it has not been retried automatically.' };
  if (['stopped', 'interrupted'].includes(p.stage)) return { title: 'Research paused; model saved', detail: 'You can keep exploring or request another research pass. Reloading does not restart paid work.' };
  if (p.stage === 'adjusted') return { title: 'Your changes are saved', detail: 'You can undo the last saved adjustment. These changes are estimates, not measurements.' };
  if (p.stage === 'restored') return { title: 'Previous estimate restored', detail: 'Undo did not use AI or change your drawing-based model.' };
  if (p.stage === 'complete' && p.spec?.mapped) return {title:'Your map-based model is ready',detail:'The outline comes from open map data. The postcode match, storeys and facade remain unverified; see Sources.'};
  if (p.stage === 'complete') return { title: 'Your estimated model is ready', detail: p.spec?.matchBasis === 'unresolved' ? 'Research did not establish a reliable building match. This remains a starting concept.' : 'This is a best guess from available references, not a survey.' };
  return { title: p.id ? 'Starting shape saved' : 'Saving your starting shape', detail: 'The first shape is a concept, not an identified reconstruction.' };
}
export function editBlock(spec, index, values) {
  if (!Number.isInteger(index) || !spec.blocks[index]) throw new Error('Choose a building section to edit.');
  const next = structuredClone(spec), b = next.blocks[index];
  for (const key of ['floors', 'width', 'depth', 'columns']) if (values[key] !== undefined) b[key] = Number(values[key]);
  for (const key of ['roof', 'finish', 'balconies']) if (values[key] !== undefined) b[key] = values[key];
  b.roofHeight = b.roof === 'flat' ? 0 : Math.max(1.5, b.roofHeight);
  if(next.mapped && ['floors','width','depth'].some(key=>values[key]!==undefined&&Number(values[key])!==spec.blocks[index][key]))next.mapped.manualDimensions=true;
  return validateSpec(next);
}
export function matchesSaved(items, query) {
  const q = String(query || '').normalize('NFKC').toLowerCase().replace(/\s/g, '');
  return items.filter(p => `${p.name} ${p.postcode}`.normalize('NFKC').toLowerCase().replace(/\s/g, '').includes(q));
}
export function safeSource(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}
export function supportSummary(p, online) {
  const error = String(p?.meta?.error?.code || 'none');
  return [
    `PropertyChecked ${RELEASE}`, `PC connection: ${online ? 'responding' : 'unavailable'}`,
    `Saved preview: ${p?.id ? 'yes' : 'no'}`,
    `Stage: ${['initial','local','research','appearance','checking','complete','fallback','stopped','interrupted','adjusted','restored','deferred','budget'].includes(p?.stage) ? p.stage : 'not started'}`,
    `Error code: ${/^[a-zA-Z0-9_]{1,64}$/.test(error) ? error : 'unavailable'}`
  ].join('\n');
}
