import { HttpError, text, normalisePostcode, record } from '../validation.mjs';
import { project, cleanRing, validatePolygon, createModel, meshModel } from '../../../packages/auto-model/geometry.mjs';
import { publicURL } from '../evidence/download.mjs';

export const VERSION = '0.5.0';
export const MAX_BATCH_BYTES = 16 * 1024 * 1024;
export const nameKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
export const propertyKey = (name, postcode) => normalisePostcode(postcode) + '|' + nameKey(name);
export class ReviewNeeded extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function requestInput(input) {
  record(input);
  const name = text(input.name, 'Building name', 150), postcode = normalisePostcode(input.postcode);
  if (nameKey(name).length < 2) throw new HttpError(400, 'Enter the building name as well as its postcode.');
  const requestKey = text(input.requestKey, 'Request reference', 70);
  if (!/^[a-zA-Z0-9-]{12,70}$/.test(requestKey)) throw new HttpError(400, 'Invalid request reference.');
  if (input.allowProcessing !== true) throw new HttpError(400, 'Approve creation of the building preview before continuing.');
  return { name, postcode, requestKey, allowProcessing: true };
}

/** A catalogue entry is an operator-approved property match, never a licence inferred by AI. */
export function catalogInput(input) {
  record(input);
  const name = text(input.name, 'Building name', 150), postcode = normalisePostcode(input.postcode);
  if (input.identityConfirmed !== true || input.rightsConfirmed !== true) throw new HttpError(400, 'Staff must confirm the exact property and rights before approving a source pack.');
  const aliases = input.aliases || [];
  if (!Array.isArray(aliases) || aliases.length > 10) throw new HttpError(400, 'Use at most ten approved building aliases.');
  const sources = input.remoteSources || [], localIds = input.sourceIds || [];
  if (!Array.isArray(sources) || sources.length > 12 || !Array.isArray(localIds) || localIds.length > 24) throw new HttpError(400, 'Source pack exceeds its limits.');
  const sourceIds = [...new Set(localIds.map(id => text(id, 'Source ID', 100)))];
  const out = { name, postcode, address: text(input.address, 'Address', 400, false), aliases: aliases.map(a => text(a, 'Alias', 150)),
    identityConfirmed: true, rightsConfirmed: true, rightsNote: text(input.rightsNote, 'Rights/permission reference', 800),
    allowProposed: input.allowProposed === true, sourceIds,
    remoteSources: sources.map(s => {
      record(s); const url = publicURL(text(s.url, 'Source URL', 1800));
      if (!/^[a-f0-9]{64}$/.test(s.sha256 || '')) throw new HttpError(400, 'Pin each approved remote document to its SHA-256 hash.');
      if (!['floor-plan','elevation','section','roof-plan','site-plan','photo'].includes(s.role) || !['existing','proposed','as-built-record','unknown'].includes(s.scenario)) throw new HttpError(400, 'Invalid source role or drawing scenario.');
      return { url: url.href, sha256: s.sha256, name: text(s.name, 'Source name', 160), role: s.role, scenario: s.scenario,
        floorLabel: text(s.floorLabel, 'Floor label', 100, false), revision: text(s.revision, 'Revision', 100, false) };
    }), footprint: null };
  if (input.footprint) {
    const fp = record(input.footprint);
    if (!fp.geometry || !['Polygon','MultiPolygon'].includes(fp.geometry.type)) throw new HttpError(400, 'Footprints require GeoJSON Polygon or MultiPolygon geometry.');
    out.footprint = { geometry: fp.geometry, sourceUrl: publicURL(text(fp.sourceUrl, 'Footprint source', 1500)).href,
      attribution: text(fp.attribution, 'Attribution', 500), licence: text(fp.licence, 'Licence', 200),
      retrievedAt: text(fp.retrievedAt, 'Dataset date', 50), heightM: fp.heightM ?? null, storeys: fp.storeys ?? null };
    if (out.footprint.heightM !== null && (!Number.isFinite(fp.heightM) || fp.heightM < 2 || fp.heightM > 250)) throw new HttpError(400, 'Footprint height must be 2 to 250 metres.');
    if (out.footprint.storeys !== null && (!Number.isInteger(fp.storeys) || fp.storeys < 1 || fp.storeys > 70)) throw new HttpError(400, 'Storeys must be an integer from 1 to 70.');
    footprintModel(out);
  }
  if (!out.sourceIds.length && !out.remoteSources.length && !out.footprint) throw new HttpError(400, 'Add approved source IDs, pinned document URLs, or a licensed footprint.');
  return out;
}

export function footprintModel(pack) {
  const fp = pack.footprint, coordinates = fp.geometry.type === 'Polygon' ? [fp.geometry.coordinates] : fp.geometry.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.length || coordinates.length > 12) throw new HttpError(400, 'Use 1 to 12 footprint polygons.');
  let count = 0;
  for (const polygon of coordinates) {
    if (!Array.isArray(polygon) || !polygon.length || polygon.length > 8) throw new HttpError(400, 'Invalid footprint rings.');
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || ring.length > 256) throw new HttpError(400, 'Footprint is too complex.');
      for (const point of ring) {
        if (++count > 1600 || !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || point[0] < -9 || point[0] > 3 || point[1] < 49 || point[1] > 61) throw new HttpError(400, 'Use bounded UK longitude/latitude pairs.');
      }
    }
  }
  const origin = { longitude: coordinates[0][0][0][0], latitude: coordinates[0][0][0][1], postcode: pack.postcode, basis: 'operator-approved-dataset' };
  let polygons;
  try { polygons = coordinates.map(p => validatePolygon(p.map(r => cleanRing(r.map(q => project(q[0], q[1], origin)))))); }
  catch { throw new HttpError(400, 'Footprint rings must be closed, valid and non-intersecting.'); }
  const tags = {}; if (fp.heightM !== null) tags.height = String(fp.heightM); if (fp.storeys !== null) tags['building:levels'] = String(fp.storeys);
  const model = createModel({ location: origin, retrievedAt: fp.retrievedAt, candidates: [{ id:'approved-footprint', name:pack.name, sourceUrl:fp.sourceUrl, polygons, tags }] }, ['approved-footprint']);
  if (model.extent.maxX-model.extent.minX > 1400 || model.extent.maxY-model.extent.minY > 1400) throw new HttpError(400, 'Footprint is larger than the supported property extent.');
  // The existing engine's OSM defaults must not misattribute an independent source.
  model.title = pack.name;
  model.attribution = { text: fp.attribution, url: fp.sourceUrl, licence: fp.licence, dataRetrievedAt: fp.retrievedAt };
  model.provenance = { ...model.provenance, propertyMatch:'Operator-approved name/postcode match', footprint:'Approved dataset, not a site survey', interior:'Unknown / not surveyed' };
  for (const volume of model.volumes) {
    if (fp.heightM !== null) volume.provenance.height = {value:fp.heightM,source:'approved-data',detail:'Height in the operator-approved dataset; not site verified.'};
    if (fp.storeys !== null) volume.provenance.storeys = {value:fp.storeys,source:'approved-data',detail:'Storeys in the operator-approved dataset; not site verified.'};
  }
  meshModel(model); return model;
}

/** Select without guessing the latest scheme or revision. Limits are staff issues, not customer forms. */
export function planBatches(all, { allowProposed = false } = {}) {
  const seen = new Set(), sources = all.filter(s => {
    if (s.rights === 'pending' || !s.buildingConfirmed || !s.sha256 || seen.has(s.sha256)) return false;
    seen.add(s.sha256); return true;
  });
  const drawings = sources.filter(s => s.role !== 'photo');
  if (!drawings.length) throw new ReviewNeeded('NO_APPROVED_DRAWINGS', 'No dimensioned drawings with confirmed reuse permission are available.');
  const scenarios = new Set(drawings.map(s => s.scenario));
  if (scenarios.size !== 1 || scenarios.has('unknown')) throw new ReviewNeeded('SCHEME_REVIEW', 'Drawing schemes differ or are unknown; staff must select the applicable scheme.');
  const scenario = drawings[0].scenario;
  if (scenario === 'proposed' && !allowProposed) throw new ReviewNeeded('PROPOSAL_ONLY', 'Only a proposed design is available. Staff must decide whether a clearly labelled proposed preview is appropriate.');
  const revisionGroups = new Map();
  for (const s of drawings.filter(s => s.floorLabel)) {
    const k = s.role + ':' + nameKey(s.floorLabel), group = revisionGroups.get(k) || new Set();
    group.add((s.revision || '').trim()); revisionGroups.set(k, group);
  }
  if ([...revisionGroups.values()].some(g => g.size > 1)) throw new ReviewNeeded('REVISION_CONFLICT', 'Different revisions of the same floor/role need staff review. No latest revision was guessed.');
  if (sources.some(s => s.size > MAX_BATCH_BYTES)) throw new ReviewNeeded('PAGE_PROCESSING', 'A source is too large for automatic interpretation; staff must prepare a smaller page group.');
  const size = group => group.reduce((n, s) => n + s.size, 0);
  if (sources.length <= 6 && size(sources) <= MAX_BATCH_BYTES) return { scenario, batches:[sources], omitted:[] };
  const plans = drawings.filter(s => s.role === 'floor-plan');
  if (!plans.length || plans.some(s => !s.floorLabel?.trim())) throw new ReviewNeeded('FLOOR_METADATA', 'A large source pack needs floor labels in the internal register before automatic grouping.');
  const groups = new Map();
  for (const s of plans) { const k=nameKey(s.floorLabel); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  if (groups.size > 4) throw new ReviewNeeded('BUILD_BUDGET', 'More than four floor groups require a staff-approved processing plan.');
  const context = sources.filter(s => s.role !== 'floor-plan'), used = new Set();
  const batches = [...groups.values()].map(group => {
    const batch=[...group];
    if (batch.length > 6 || size(batch) > MAX_BATCH_BYTES) throw new ReviewNeeded('PAGE_PROCESSING', 'A single floor group exceeds the processing limit. Staff must prepare it.');
    for (const s of context) if (batch.length < 6 && size(batch)+s.size <= MAX_BATCH_BYTES) batch.push(s);
    batch.forEach(s=>used.add(s.id)); return batch;
  });
  return { scenario, batches, omitted:sources.filter(s=>!used.has(s.id)).map(s=>s.id) };
}
