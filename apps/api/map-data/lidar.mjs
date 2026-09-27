import { inflateSync } from 'node:zlib';
import { insidePolygon } from '../../../packages/auto-model/geometry.mjs';

export const EA = {
  dsm: 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-surface-model-last-return-dsm-1m/wcs',
  dtm: 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs'
};
/** Approximate WGS84 -> OSGB36/British National Grid. Helmert, not OSTN15:
 * allow several metres of horizontal datum uncertainty in the height check. */
export function britishGrid(lon, lat) {
  const rad = Math.PI / 180, phi = lat * rad, lam = lon * rad;
  const a0 = 6378137, e0 = 0.00669437999014, v = a0 / Math.sqrt(1 - e0 * Math.sin(phi) ** 2);
  const x = v * Math.cos(phi) * Math.cos(lam), y = v * Math.cos(phi) * Math.sin(lam), z = v * (1 - e0) * Math.sin(phi);
  const sec = rad / 3600, rx = -.1502 * sec, ry = -.2470 * sec, rz = -.8421 * sec, scale = 1 + 20.4894e-6;
  const X = -446.448 + x * scale - y * rz + z * ry, Y = 125.157 + x * rz + y * scale - z * rx, Z = -542.060 - x * ry + y * rx + z * scale;
  const a = 6377563.396, b = 6356256.909, e = 1 - b * b / (a * a), p = Math.hypot(X, Y);
  let f = Math.atan2(Z, p * (1 - e));
  for (let n = 0; n < 8; n++) f = Math.atan2(Z + e * a / Math.sqrt(1 - e * Math.sin(f) ** 2) * Math.sin(f), p);
  const l = Math.atan2(Y, X), F = .9996012717, lat0 = 49 * rad, lon0 = -2 * rad, n = (a - b) / (a + b);
  const sin = Math.sin(f), cos = Math.cos(f), tan = Math.tan(f), nu = a * F / Math.sqrt(1 - e * sin * sin), rho = a * F * (1 - e) / (1 - e * sin * sin) ** 1.5, eta = nu / rho - 1;
  const M = b * F * ((1 + n + 5 / 4 * n * n + 5 / 4 * n ** 3) * (f - lat0) - (3 * n + 3 * n * n + 21 / 8 * n ** 3) * Math.sin(f - lat0) * Math.cos(f + lat0) + (15 / 8 * n * n + 15 / 8 * n ** 3) * Math.sin(2 * (f - lat0)) * Math.cos(2 * (f + lat0)) - 35 / 24 * n ** 3 * Math.sin(3 * (f - lat0)) * Math.cos(3 * (f + lat0)));
  const d = l - lon0;
  return [400000 + nu * cos * d + nu / 6 * cos ** 3 * (nu / rho - tan * tan) * d ** 3 + nu / 120 * cos ** 5 * (5 - 18 * tan * tan + tan ** 4 + 14 * eta - 58 * tan * tan * eta) * d ** 5,
    -100000 + M + nu / 2 * sin * cos * d * d + nu / 24 * sin * cos ** 3 * (5 - tan * tan + 9 * eta) * d ** 4 + nu / 720 * sin * cos ** 5 * (61 - 58 * tan * tan + tan ** 4) * d ** 6];
}
const bad = () => { throw new Error('Unsupported or incomplete numeric scan raster.'); };
/** Small single-band numeric GeoTIFF decoder. Never decode a map screenshot.
 * Only bounded classic TIFF, no tiles/overviews/external references/BigTIFF. */
export function numericTiff(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 16 || bytes.length > 4 * 1024 * 1024) bad();
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), marker = String.fromCharCode(bytes[0], bytes[1]);
  if (!['II', 'MM'].includes(marker)) bad(); const le = marker === 'II';
  const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
  if (u16(2) !== 42) bad(); const offset = u32(4); if (offset + 2 > bytes.length) bad();
  const n = u16(offset), tags = new Map(), sizes = { 1:1, 2:1, 3:2, 4:4, 11:4, 12:8 };
  if (n > 128 || offset + 2 + n * 12 + 4 > bytes.length) bad();
  for (let i = 0; i < n; i++) {
    const at = offset + 2 + i * 12, tag = u16(at), type = u16(at + 2), count = u32(at + 4), length = (sizes[type] || 0) * count;
    if (!sizes[type]) continue;
    if (count > 32768) bad(); const start = length <= 4 ? at + 8 : u32(at + 8);
    if (start + length > bytes.length) bad();
    if (type === 2) { tags.set(tag, Buffer.from(bytes.subarray(start, start + length)).toString('ascii').replace(/\0/g, '')); continue; }
    const values = [];
    for (let j = 0; j < count; j++) { const p = start + j * sizes[type]; values.push(type === 1 ? bytes[p] : type === 3 ? u16(p) : type === 4 ? u32(p) : type === 11 ? v.getFloat32(p, le) : v.getFloat64(p, le)); }
    tags.set(tag, values);
  }
  const scalar = (tag, fallback) => tags.get(tag)?.[0] ?? fallback;
  const width = scalar(256), height = scalar(257), bits = scalar(258), format = scalar(339, 1), compression = scalar(259, 1);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256 || width * height > 40000 || scalar(277, 1) !== 1 || scalar(274, 1) !== 1 || scalar(317, 1) !== 1 || ![16,32,64].includes(bits) || ![1,2,3].includes(format) || ![1,8,32946].includes(compression) || tags.has(324)) bad();
  const scale = tags.get(33550), tie = tags.get(33922), keys = tags.get(34735), strips = tags.get(273), lengths = tags.get(279);
  if (!scale || !tie || scale.length < 2 || tie.length < 6 || !scale.every(Number.isFinite) || scale[0] <= 0 || scale[1] <= 0 || !strips || !lengths || strips.length !== lengths.length || strips.length > 256) bad();
  let crs = null, rasterType = 1;
  if (keys) for (let i = 4; i + 3 < keys.length; i += 4) { if (keys[i] === 3072 && keys[i + 1] === 0) crs = keys[i + 3]; if (keys[i] === 1025 && keys[i+1] === 0) rasterType = keys[i+3]; }
  if (crs !== 27700 || rasterType !== 1 || tags.has(34264) || !tie.every(Number.isFinite)) bad();
  const need = width * height * bits / 8, raw = Buffer.alloc(need); let written = 0;
  for (let i = 0; i < strips.length; i++) {
    if (strips[i] + lengths[i] > bytes.length) bad();
    const chunk = bytes.subarray(strips[i], strips[i] + lengths[i]);
    const b = compression === 1 ? chunk : inflateSync(chunk, { maxOutputLength: need });
    if (written + b.length > need) bad(); raw.set(b, written); written += b.length;
  }
  if (written !== need) bad();
  const rv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), data = new Float64Array(width * height), nodataText = tags.get(42113), nodata = nodataText === undefined ? null : Number(nodataText);
  for (let i = 0; i < data.length; i++) {
    const p = i * bits / 8;
    let val;
    if (format === 3 && bits === 32) val = rv.getFloat32(p, le);
    else if (format === 3 && bits === 64) val = rv.getFloat64(p, le);
    else if (format !== 3 && bits === 16) val = format === 1 ? rv.getUint16(p, le) : rv.getInt16(p, le);
    else if (format !== 3 && bits === 32) val = format === 1 ? rv.getUint32(p, le) : rv.getInt32(p, le);
    else bad();
    data[i] = !Number.isFinite(val) || nodata !== null && val === nodata || val < -100 || val > 1600 ? NaN : val;
  }
  return { width, height, dx: scale[0], dy: scale[1], x: tie[3] - tie[0] * scale[0], y: tie[4] + tie[1] * scale[1], data };
}
const quantile = (values, p) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))];
export function scanHeight(dsm, dtm, polygons) {
  const values = []; let total = 0;
  for (let y = 0; y < dsm.height; y++) for (let x = 0; x < dsm.width; x++) {
    const e = dsm.x + (x + .5) * dsm.dx, n = dsm.y - (y + .5) * dsm.dy;
    if (!polygons.some(p => insidePolygon([e, n], p))) continue; total++;
    const tx = Math.floor((e - dtm.x) / dtm.dx), ty = Math.floor((dtm.y - n) / dtm.dy);
    if (tx < 0 || ty < 0 || tx >= dtm.width || ty >= dtm.height) continue;
    const h = dsm.data[y * dsm.width + x] - dtm.data[ty * dtm.width + tx];
    if (Number.isFinite(h) && h >= 2.4 && h <= 125) values.push(h);
  }
  if (values.length < 6 || values.length < total * .65) return null;
  values.sort((a, b) => a - b); const medianM = quantile(values, .5), p90M = quantile(values, .9);
  if (p90M - medianM > Math.max(7, medianM * .7)) return null;
  return { medianM: Math.round(medianM * 10) / 10, p90M: Math.round(p90M * 10) / 10, samples: Math.min(values.length, 4096) };
}
export function coverageInfo(capabilities, description) {
  if (/<!DOCTYPE|<!ENTITY/i.test(capabilities + description)) throw new Error('Invalid scan metadata.');
  const ids = [...capabilities.matchAll(/<(?:\w+:)?CoverageId[^>]*>([A-Za-z0-9_.:-]+)<\//g)].map(m => m[1]);
  const envelope = [...description.matchAll(/<(?:\w+:)?Envelope\b([^>]*)>/g)].map(m => m[1]).find(s => /27700/.test(s));
  const axes = /axisLabels="([A-Za-z]+) ([A-Za-z]+)"/.exec(envelope || '');
  if (ids.length !== 1 || !axes || !/^(E|X|easting)$/i.test(axes[1]) || !/^(N|Y|northing)$/i.test(axes[2])) throw new Error('Scan coverage grid is not supported.');
  return { id: ids[0], axes: axes.slice(1) };
}
export function createLidar({ read, enabled = () => process.env.MAP_LIDAR_ENABLED !== 'false' }) {
  const metadata = new Map();
  async function raster(endpoint, box, signal) {
    let info = metadata.get(endpoint);
    if (!info) {
      const cap = await read(endpoint + '?service=WCS&request=GetCapabilities&version=2.0.1', { max: 512 * 1024, signal, timeout: 12000 });
      const text = cap.toString('utf8'), id = /<(?:\w+:)?CoverageId[^>]*>([A-Za-z0-9_.:-]+)<\//.exec(text)?.[1];
      if (!id) throw new Error('Scan coverage was not advertised.');
      const des = await read(endpoint + '?service=WCS&request=DescribeCoverage&version=2.0.1&coverageId=' + encodeURIComponent(id), { max: 512 * 1024, signal, timeout: 12000 });
      info = coverageInfo(text, des.toString('utf8')); metadata.set(endpoint, info);
    }
    const params = new URLSearchParams({ service:'WCS', request:'GetCoverage', version:'2.0.1', coverageId:info.id, format:'image/tiff', subsettingCrs:'http://www.opengis.net/def/crs/EPSG/0/27700', outputCrs:'http://www.opengis.net/def/crs/EPSG/0/27700', 'geotiff:compression':'NONE' });
    params.append('subset', `${info.axes[0]}(${Math.floor(box[0])},${Math.ceil(box[2])})`);
    params.append('subset', `${info.axes[1]}(${Math.floor(box[1])},${Math.ceil(box[3])})`);
    return numericTiff(await read(endpoint + '?' + params, { max: 4 * 1024 * 1024, signal, timeout: 18000 }));
  }
  return async (feature, signal) => {
    if (!enabled()) return { scan: null, note: 'Optional LiDAR height checking is disabled.' };
    const raw = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const polygons = raw.map(p => p.map(r => r.map(([lon, lat]) => britishGrid(lon, lat))));
    const pts = polygons.flat(2), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const box = [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1];
    if (box[2] - box[0] > 150 || box[3] - box[1] > 150) return { scan:null, note:'Building exceeds the bounded LiDAR height window.' };
    try {
      const dsm = await raster(EA.dsm, box, signal), dtm = await raster(EA.dtm, box, signal);
      const scan = scanHeight(dsm, dtm, polygons);
      return { scan, note: scan ? 'Height cross-check uses historic Environment Agency 2022 composite surface minus terrain; horizontal alignment is approximate. Trees, annexes and later changes may affect it.' : 'LiDAR did not provide enough consistent building-height samples; map/AI height retained.' };
    } catch (error) {
      if (signal.aborted) throw error;
      return { scan:null, note:'LiDAR numeric coverage was unavailable or unsupported; map/AI height retained. No replacement scan was invented.' };
    }
  };
}
