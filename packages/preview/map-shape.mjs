import { project, unproject, cleanRing, validatePolygon, polygonArea, insidePolygon, signedArea, bounds, triangulate } from '../auto-model/geometry.mjs';

export const MAP_SOURCE = 'Microsoft Global ML Building Footprints';
export const MAP_LICENCE = 'CDLA-Permissive-2.0';
export const MAP_LICENCE_URL = 'https://cdla.dev/permissive-2-0/';
export const MAP_SOURCE_URL = 'https://github.com/microsoft/GlobalMLBuildingFootprints';
const licenceText = `Community Data License Agreement - Permissive - Version 2.0

This is the Community Data License Agreement - Permissive, Version 2.0 (the "agreement"). Data Provider(s) and Data Recipient(s) agree as follows:

1. Provision of the Data

1.1. A Data Recipient may use, modify, and share the Data made available by Data Provider(s) under this agreement if that Data Recipient follows the terms of this agreement.
1.2. This agreement does not impose any restriction on a Data Recipient's use, modification, or sharing of any portions of the Data that are in the public domain or that may be used, modified, or shared under any other legal exception or limitation.

2. Conditions for Sharing Data

2.1. A Data Recipient may share Data, with or without modifications, so long as the Data Recipient makes available the text of this agreement with the shared Data.

3. No Restrictions on Results
3.1. This agreement does not impose any restriction or obligations with respect to the use, modification, or sharing of Results.

4. No Warranty; Limitation of Liability

4.1. All Data Recipients receive the Data subject to the following terms:
THE DATA IS PROVIDED ON AN "AS IS" BASIS, WITHOUT REPRESENTATIONS, WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
NO DATA PROVIDER SHALL HAVE ANY LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING WITHOUT LIMITATION LOST PROFITS), HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE DATA OR RESULTS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

5. Definitions

5.1. "Data" means the material received by a Data Recipient under this agreement.
5.2. "Data Provider" means any person who is the source of Data provided under this agreement and in reliance on a Data Recipient's agreement to its terms.

5.3. "Data Recipient" means any person who receives Data directly or indirectly from a Data Provider and agrees to the terms of this agreement.

5.4. "Results" means any outcome obtained by computational analysis of Data, including for example machine learning models and models' insights.
`;
const fail = message => { throw new Error(message); };
const finite = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const clean = (v, n = 400) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : '';
export const ukPoint = p => p && finite(p.longitude, -9, 3) && finite(p.latitude, 49, 61);
export function distanceToRing(p, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t));
  }
  return best;
}
/** Drop irrelevant rows cheaply before doing bounded polygon validation. */
export function candidateFeature(feature, origin, index = 0, radiusM = 350) {
  if (!ukPoint(origin) || feature?.type !== 'Feature' || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) return null;
  const raw = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  if (!Array.isArray(raw) || !raw.length || raw.length > 6) return null;
  let count = 0, minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const polygon of raw) {
    if (!Array.isArray(polygon) || !polygon.length || polygon.length > 8) return null;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || ring.length > 129) return null;
      for (const p of ring) {
        if (++count > 70 || !Array.isArray(p) || p.length !== 2 || !finite(p[0], -180, 180) || !finite(p[1], -90, 90)) return null;
        minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]); minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]);
      }
    }
  }
  const lo = project(minLon, minLat, origin), hi = project(maxLon, maxLat, origin);
  if (lo[0] > radiusM || hi[0] < -radiusM || lo[1] > radiusM || hi[1] < -radiusM) return null;
  let polygons;
  try { polygons = raw.map(p => validatePolygon(p.map(r => cleanRing(r.map(q => project(q[0], q[1], origin)))))); } catch { return null; }
  if (polygons.flat(2).length > 64) return null;
  const box = bounds(polygons), width = box.maxX - box.minX, depth = box.maxY - box.minY, areaM2 = polygons.reduce((n, p) => n + polygonArea(p), 0);
  if (width < 4 || width > 120 || depth < 4 || depth > 100 || areaM2 < 30 || areaM2 > 12000) return null;
  const contains = polygons.some(p => insidePolygon([0, 0], p));
  const distanceM = contains ? 0 : Math.min(...polygons.flatMap(p => p.map(r => distanceToRing([0, 0], r))));
  const centreDistance = Math.hypot((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  if (distanceM > radiusM) return null;
  const h = feature.properties?.height;
  return { id: `ms-${index}`, polygons, box, areaM2, width, depth, distanceM, centreDistance, contains,
    heightM: finite(h, 2.4, 125) ? h : null,
    geometry: { type: feature.geometry.type, coordinates: raw.length === 1 && feature.geometry.type === 'Polygon' ? raw[0] : raw } };
}
export function rankCandidates(candidates) {
  // A postcode is an area reference, not identity proof. Keep the nearest plausible
  // structure, prioritising containment, without silently combining neighbours.
  return [...candidates].sort((a, b) => Number(b.contains) - Number(a.contains) || a.distanceM - b.distanceM || a.centreDistance - b.centreDistance || b.areaM2 - a.areaM2);
}
export function validateMapped(value) {
  if (!value || value.version !== 1 || value.source !== MAP_SOURCE || value.licence !== MAP_LICENCE || !ukPoint(value.origin)) fail('Unsupported map-derived geometry.');
  if (!Array.isArray(value.polygons) || !value.polygons.length || value.polygons.length > 6) fail('Invalid mapped footprint.');
  let points = 0;
  const polygons = value.polygons.map(p => {
    if (!Array.isArray(p) || !p.length || p.length > 8) fail('Invalid mapped rings.');
    return validatePolygon(p.map(r => {
      if (!Array.isArray(r) || r.length < 3 || r.length > 128 || (points += r.length) > 64) fail('Mapped geometry is too complex.');
      const ring = r.map(q => {
        if (!Array.isArray(q) || q.length !== 2 || !finite(q[0], -0.02, 120.02) || !finite(q[1], -0.02, 100.02)) fail('Invalid mapped coordinate.');
        return q.slice();
      });
      return cleanRing([...ring, ring[0]]);
    }));
  });
  if (!finite(value.baseWidth, 4, 120) || !finite(value.baseDepth, 4, 100)) fail('Invalid mapped dimensions.');
  const b = bounds(polygons);
  if (Math.abs(b.minX) > .02 || Math.abs(b.minY) > .02 || Math.abs(b.maxX - value.baseWidth) > .02 || Math.abs(b.maxY - value.baseDepth) > .02) fail('Mapped dimensions do not match the footprint.');
  const heightM = finite(value.heightM, 2.4, 125) ? value.heightM : null;
  if (!['dataset-estimate', 'lidar-estimate', 'unknown'].includes(value.heightBasis)) fail('Invalid mapped height basis.');
  const out = { version: 1, source: MAP_SOURCE, sourceUrl: MAP_SOURCE_URL, licence: MAP_LICENCE, licenceUrl: MAP_LICENCE_URL, licenceText,
    release: clean(value.release, 40), retrievedAt: clean(value.retrievedAt, 40),
    origin: { longitude: value.origin.longitude, latitude: value.origin.latitude },
    polygons, baseWidth: value.baseWidth, baseDepth: value.baseDepth, heightM,
    heightBasis: heightM === null ? 'unknown' : value.heightBasis,
    matchNote: clean(value.matchNote), selectedId: clean(value.selectedId, 80),
    scanNote: clean(value.scanNote), manualDimensions: value.manualDimensions === true };
  if (value.scan && finite(value.scan.medianM, 2.4, 125) && finite(value.scan.p90M, 2.4, 150) && Number.isInteger(value.scan.samples) && value.scan.samples >= 6 && value.scan.samples <= 4096) {
    out.scan = { medianM: value.scan.medianM, p90M: value.scan.p90M, samples: value.scan.samples,
      source: 'Environment Agency LiDAR composite 2022', licence: 'OGL-UK-3.0', attribution: '\u00a9 Environment Agency copyright and/or database right 2022. All rights reserved.',
      sourceUrl: 'https://environment.data.gov.uk/dataset/9ba4d5ac-d596-445a-9056-dae3ddec0178' };
  }
  return out;
}
export function mappedFromCandidate(c, origin, { release = '2026-07-24', retrievedAt = new Date().toISOString(), scan = null, scanNote = '' } = {}) {
  const shifted = c.polygons.map(p => p.map(r => r.map(([x, y]) => [x - c.box.minX, y - c.box.minY])));
  const anchor = unproject(c.box.minX, c.box.minY, origin);
  const scanAccepted = scan && (c.heightM === null || Math.abs(scan.medianM-c.heightM) <= Math.max(3,c.heightM*.35));
  if(scan && !scanAccepted)scanNote += ' Scan and map height disagree; mapped height retained rather than averaging conflicting data.';
  return validateMapped({ version: 1, source: MAP_SOURCE, licence: MAP_LICENCE, polygons: shifted, baseWidth: c.width, baseDepth: c.depth,
    origin: { longitude: anchor[0], latitude: anchor[1] }, release, retrievedAt, selectedId: c.id,
    heightM: scanAccepted ? scan.medianM : c.heightM, heightBasis: scanAccepted ? 'lidar-estimate' : c.heightM === null ? 'unknown' : 'dataset-estimate', scan, scanNote,
    matchNote: `Automatically selected near the postcode centre (${Math.round(c.distanceM)} m to footprint). The building name is not verified by this dataset; this may be a neighbour.` });
}
export function applyMapped(spec, mapped) {
  const data = validateMapped(mapped), b = { ...spec.blocks[0] };
  b.label = 'Mapped building outline'; b.x = 0; b.y = 0; b.rotation = 0; b.width = data.baseWidth; b.depth = data.baseDepth;
  if (data.heightM !== null) {
    const rise = b.roof === 'flat' ? 0 : Math.max(0, Math.min(b.roofHeight, data.heightM - 2.4));
    if (rise < .2) { b.roof = 'flat'; b.roofHeight = 0; } else b.roofHeight = rise;
    const bodyHeight = data.heightM - (b.roof === 'flat' ? 0 : rise);
    b.floors = Math.max(1, Math.ceil(bodyHeight / 5), Math.min(25, Math.floor(bodyHeight / 2.4), Math.round(bodyHeight / 3)));
    b.floorHeight = bodyHeight / b.floors;
  }
  // Roof style is an illustrative AI/user estimate, not observed roof planes.
  const notes = [data.matchNote, 'Mapped footprint and source height are estimates, not a surveyed model.',
    'Floor divisions, window spacing, facade materials and unseen details are illustrative.',
    'Roof is a simplified envelope; internal layout and safety information remain unknown.',
    ...(data.heightM === null ? ['No usable map/scan height was available; height is estimated.'] : []), ...(data.scanNote ? [data.scanNote] : [])];
  const facts = (spec.facts || []).filter(f => !/^map-|^scan-/.test(f.sourceId)).slice(0, 24);
  facts.push({ detail: `Footprint from ${MAP_SOURCE}, release ${data.release}.`, sourceId: 'map-ms' });
  if (data.heightM !== null) facts.push({ detail: `Source height estimate ${data.heightM.toFixed(1)} m (${data.heightBasis}); not site verified.`, sourceId: data.heightBasis === 'lidar-estimate' ? 'scan-ea' : 'map-ms' });
  return { ...spec, blocks: [b], mapped: data, matchBasis: 'ambiguous', matchLabel: 'Postcode-based building guess', facts,
    summary: 'The outline is drawn from reusable map data. The postcode-based building match, facade and floor layout are unverified estimates.',
    assumptions: [...notes, ...(spec.assumptions || [])].slice(0, 30) };
}
/** A polygonal shell, not a rectangular substitute for the mapped footprint. */
export function mappedModel(spec, { floor = 'all', explode = false, cutaway = false } = {}, palette) {
  const m = validateMapped(spec.mapped), b = spec.blocks[0], volumes = [], roofs = [];
  const a = b.rotation * Math.PI / 180, sx = b.width / m.baseWidth, sy = b.depth / m.baseDepth;
  const transform = ([x, y]) => [b.x + x * sx * Math.cos(a) - y * sy * Math.sin(a), b.y + x * sx * Math.sin(a) + y * sy * Math.cos(a)];
  const polygons = m.polygons.map(p => p.map(r => r.map(transform)));
  let seq = 0, windows = 0;
  const edgeCount=polygons.flat().reduce((n,r)=>n+r.length,0), detailed=edgeCount*b.floors<=500, maxWindows=detailed?400:220;
  const add = (rings, bottom, top, kind, colour, level) => {
    if (top <= bottom) return;
    if (volumes.length >= 2800) fail('Mapped estimate is too complex to render completely.');
    volumes.push({ id: `map-${seq++}`, title: kind, parentId: `floor-${level}`, rings, minHeightM: bottom, heightM: top, storeys: 1, sourceUrl: MAP_SOURCE_URL,
      provenance: { height: { source: 'estimated', detail: 'Map-derived outline with illustrative storeys and facade.' } }, preview: { kind, colour, level, label: kind } });
  };
  for (let f = 0; f < b.floors; f++) {
    if (floor !== 'all' && Number(floor) !== f) continue;
    const bottom = f * b.floorHeight + (explode ? f * 1.8 : 0), top = bottom + b.floorHeight;
    for (const polygon of polygons) {
      add(polygon, bottom, bottom + .12, 'mapped floor envelope', palette.trim, f);
      for (let ri = 0; ri < polygon.length; ri++) {
        const ring = polygon[ri], sign = (signedArea(ring) > 0 ? 1 : -1) * (ri === 0 ? 1 : -1);
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
          if (len < .1) continue;
          const nx = sign * dy / len, ny = -sign * dx / len;
          const quad = (start, end, outer, inner) => [[p[0] + dx * start + nx * outer, p[1] + dy * start + ny * outer], [p[0] + dx * end + nx * outer, p[1] + dy * end + ny * outer], [p[0] + dx * end + nx * inner, p[1] + dy * end + ny * inner], [p[0] + dx * start + nx * inner, p[1] + dy * start + ny * inner]];
          add([quad(0, 1, 0, -.18)], bottom + .12, cutaway ? bottom + .8 : top, 'illustrative facade on mapped edge', palette[b.finish], f);
          if (cutaway) continue;
          if(detailed)add([quad(0, 1, .01, -.19)], top - .10, top, 'estimated storey band', palette.trim, f);
          const n = Math.min(b.columns, Math.floor(len / 2.8));
          for (let j = 0; j < n && windows < maxWindows; j++, windows++) {
            const start = (j + .2) / n, end = (j + .8) / n;
            add([quad(start, end, .07, .03)], bottom + .8, bottom + b.floorHeight * .77, 'illustrative window frame', palette.trim, f);
            if ((end - start) * len > .2) add([quad(start + .06 / len, end - .06 / len, .09, .075)], bottom + .87, bottom + b.floorHeight * .77 - .07, 'illustrative glazing', palette.glass, f);
            if (b.balconies && f > 0 && ri === 0 && j % 2 === 0) {
              add([quad(start, end, 1.1, 0)], bottom + .12, bottom + .25, 'illustrative balcony', palette.concrete, f);
              add([quad(start, end, 1.1, 1.04)], bottom + .25, bottom + 1.2, 'illustrative balcony rail', palette.metal, f);
            }
          }
        }
      }
      if (!cutaway && f === b.floors - 1) {
        if (b.roof === 'flat') add(polygon, top, top + .15, 'simplified mapped roof envelope', palette.roof, f);
        else {
          const box = bounds([polygon]), midY = (box.minY + box.maxY) / 2, midX = (box.minX + box.maxX) / 2;
          const roofAt = p => {
            const y = 1 - Math.abs((p[1] - midY) / Math.max(.1, (box.maxY - box.minY) / 2));
            const x = 1 - Math.abs((p[0] - midX) / Math.max(.1, (box.maxX - box.minX) / 2));
            return top + Math.max(.2, b.roofHeight) * Math.max(0, b.roof === 'hip' ? Math.min(x, y) : y);
          };
          const triangles = [];
          const subdivide = (tri, n) => {
            if (!n) { triangles.push(tri.map(p => [p[0], roofAt(p), -p[1]])); return; }
            const [a, c, d] = tri, ac = a.map((v,i)=>(v+c[i])/2), cd = c.map((v,i)=>(v+d[i])/2), da = d.map((v,i)=>(v+a[i])/2);
            for (const t of [[a,ac,da],[ac,c,cd],[da,cd,d],[ac,cd,da]]) subdivide(t,n-1);
          };
          for (const tri of triangulate(polygon)) subdivide(tri,2);
          for (const ring of polygon) for (let i=0;i<ring.length;i++) {
            const p=ring[i],q=ring[(i+1)%ring.length];
            for (let k=0;k<4;k++) {
              const a=p.map((v,j)=>v+(q[j]-v)*k/4),c=p.map((v,j)=>v+(q[j]-v)*(k+1)/4);
              const lowA=[a[0],top,-a[1]],lowC=[c[0],top,-c[1]],highA=[a[0],roofAt(a),-a[1]],highC=[c[0],roofAt(c),-c[1]];
              triangles.push([lowA,lowC,highC],[lowA,highC,highA]);
            }
          }
          roofs.push({id:'map-roof-'+roofs.length,triangles,colour:palette.roof,level:f});
        }
      }
    }
  }
  if (!volumes.length) fail('No mapped floor in this view.');
  return { schemaVersion: 1, kind: 'map-derived-preview', volumes, roofs, extent: bounds(polygons), origin: { ...m.origin, coordinateSystem: 'local approximate metres', georeferenced: false },
    attribution: { text: `${MAP_SOURCE}; ${MAP_LICENCE}${m.scan ? '; Environment Agency, OGL-UK-3.0' : ''}`, url: MAP_SOURCE_URL, licence: MAP_LICENCE },
    provenance: { status: 'Map-based estimate; not surveyed. Building match may be wrong. No safety assessment.', matchBasis: 'ambiguous', source: m,
      facts: spec.facts, assumptions: spec.assumptions, dimensionsEdited: m.manualDimensions || Math.abs(b.width - m.baseWidth) > .01 || Math.abs(b.depth - m.baseDepth) > .01,
      roof: 'Illustrative roof envelope, not observed roof planes.' } };
}
