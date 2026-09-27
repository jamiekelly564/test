import { gunzipSync } from 'node:zlib';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { normalisePostcode } from '../validation.mjs';
import { candidateFeature, mappedFromCandidate, rankCandidates, ukPoint } from '../../../packages/preview/map-shape.mjs';
import { createLidar } from './lidar.mjs';

export const RELEASE = '2026-07-24';
export const DATASET_INDEX = 'https://bfppub.blob.core.windows.net/%24web/' + RELEASE + '/dataset-links.csv';
const UA = 'PropertyChecked/0.8 (+https://github.com/jamiekelly564/test; user-requested open building data)';
const MB = 1024 * 1024;
export class MapDataError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function allowedURL(value) {
  let u; try { u = new URL(value); } catch { throw new MapDataError('MAP_URL', 'Invalid map-data URL.'); }
  const fixed = u.hostname === 'api.postcodes.io' && /^\/postcodes\/[A-Za-z0-9% ]+$/.test(u.pathname) && !u.search;
  const microsoft = u.hostname === 'bfppub.blob.core.windows.net' && u.pathname.length < 2000 && (/\.csv$/i.test(u.pathname) || /\.gz$/i.test(u.pathname)) && !u.search;
  const ea = u.hostname === 'environment.data.gov.uk' && /^\/spatialdata\/lidar-composite-digital-(surface-model-last-return-dsm|terrain-model-dtm)-1m\/wcs$/.test(u.pathname);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash || !(fixed || microsoft || ea)) throw new MapDataError('MAP_URL', 'Map data must come from a supported public dataset endpoint.');
  return u;
}
export function quadkey(lon, lat, zoom = 9) {
  if (!ukPoint({ longitude:lon, latitude:lat }) || zoom !== 9) throw new MapDataError('MAP_LOCATION', 'Use a UK location.');
  const n = 2 ** zoom, x = Math.floor((lon + 180) / 360 * n), sin = Math.sin(lat * Math.PI / 180), y = Math.floor((.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n);
  let out = '';
  for (let i = zoom; i > 0; i--) { const mask = 1 << (i - 1); out += String((x & mask ? 1 : 0) + (y & mask ? 2 : 0)); }
  return out;
}
function csvRow(line) {
  const out = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (line[i] === ',' && !quoted) { out.push(cell); cell = ''; }
    else cell += line[i];
  }
  if (quoted) throw new MapDataError('MAP_INDEX', 'Map index has invalid CSV.');
  out.push(cell); return out;
}
export function indexTiles(text, wanted) {
  if (typeof text !== 'string' || text.length > 16 * MB) throw new MapDataError('MAP_INDEX', 'Map index exceeds its supported size.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/), header = csvRow(lines.shift() || '').map(s => s.trim().toLowerCase());
  const qi = header.indexOf('quadkey'), ui = header.indexOf('url');
  if (qi < 0 || ui < 0) throw new MapDataError('MAP_INDEX', 'Map index format changed.');
  const matches = [];
  for (const line of lines) {
    if (!line) continue; if (line.length > 8192) throw new MapDataError('MAP_INDEX', 'Map index row is too long.');
    const cells = csvRow(line), rawKey = String(cells[qi] || '').trim(), q = /^[0-3]{1,9}$/.test(rawKey) ? rawKey.padStart(9, '0') : ''; 
    if (!wanted.has(q)) continue;
    const u = allowedURL(cells[ui]);
    if (u.hostname !== 'bfppub.blob.core.windows.net' || !u.pathname.endsWith('.gz')) throw new MapDataError('MAP_INDEX', 'Map index contains an unsupported dataset file.');
    if (!matches.some(m => m.url === u.href)) matches.push({ quadkey:q, url:u.href });
  }
  if (matches.length > 4) throw new MapDataError('MAP_INDEX', 'Too many regional files for a bounded building lookup.');
  return matches;
}
export async function nearbyFeatures(bytes, origin, tile, signal) {
  const body = bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes, { maxOutputLength:192 * MB }) : bytes;
  if (body.length > 192 * MB) throw new MapDataError('MAP_TOO_LARGE', 'Regional map data exceeds its processing limit.');
  const candidates = []; let start = 0, line = 0;
  for (let i = 0; i <= body.length; i++) {
    if (i < body.length && body[i] !== 10) continue;
    if (i - start > 64 * 1024) throw new MapDataError('MAP_ROW', 'An individual map feature exceeds its size limit.');
    const raw = body.subarray(start, i).toString('utf8').trim(); start = i + 1;
    if (!raw) continue;
    if (++line > 600000) throw new MapDataError('MAP_TOO_LARGE', 'Regional map has too many features.');
    if (line % 8192 === 0) { await yieldTurn(); signal.throwIfAborted(); }
    let feature; try { feature = JSON.parse(raw); } catch { throw new MapDataError('MAP_FORMAT', 'Regional map returned incomplete data.'); }
    const c = candidateFeature(feature, origin, line);
    if (c) { c.id = `ms-${tile}-${line}`; candidates.push(c); }
    if (candidates.length > 1600) throw new MapDataError('MAP_TOO_DENSE', 'The local mapped area exceeds its preview limit.');
  }
  signal.throwIfAborted(); return candidates;
}
/** Network reads are bounded and fixed-host. No Google/Overpass inputs, mirrors,
 * redirects, credentials, public geocoder scraping or paid map API calls. */
export function createMapProvider({ workspace, fetcher = fetch, clock = Date.now, lidar, enabled = () => process.env.MAP_DATA_ENABLED !== 'false' } = {}) {
  const db = workspace?.db, memory = new Map(), pauses = new Map(); let busy = false;
  if (db) db.exec('CREATE TABLE IF NOT EXISTS map_data_cache(cache_key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL)');
  const cached = key => {
    const entry = db ? db.prepare('SELECT value,expires_at FROM map_data_cache WHERE cache_key=?').get(key) : memory.get(key);
    if (!entry || entry.expires_at < clock()) return null;
    try { return JSON.parse(entry.value); } catch { return null; }
  };
  const save = (key, data, seconds) => {
    const value = JSON.stringify(data); if (value.length > 20 * MB) return;
    if (db) {
      db.prepare('DELETE FROM map_data_cache WHERE expires_at<?').run(clock());
      if (db.prepare('SELECT count(*) AS n FROM map_data_cache').get().n > 64) db.prepare('DELETE FROM map_data_cache WHERE cache_key IN (SELECT cache_key FROM map_data_cache ORDER BY expires_at LIMIT 8)').run();
      db.prepare('INSERT INTO map_data_cache VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').run(key, value, clock() + seconds * 1000);
    } else { memory.set(key, { value, expires_at:clock() + seconds * 1000 }); if (memory.size > 64) memory.delete(memory.keys().next().value); }
  };
  async function read(url, { max = 16 * MB, signal, timeout = 15000 } = {}) {
    const u = allowedURL(url);
    if ((pauses.get(u.hostname) || 0) > clock()) throw new MapDataError('MAP_PAUSED', 'This map-data provider is paused after an access or rate-limit response.');
    const combined = AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
    let r;
    try { r = await fetcher(u.href, { redirect:'error', signal:combined, headers:{ 'User-Agent':UA, Accept:'application/json,text/csv,application/xml,image/tiff,application/octet-stream' } }); }
    catch (error) { if (signal.aborted) throw error; throw new MapDataError('MAP_NETWORK', 'Open building data could not be reached within its time limit.'); }
    if (!r.ok) {
      await r.body?.cancel();
      if ([401,403,406].includes(r.status)) pauses.set(u.hostname, Infinity);
      else if (r.status === 429) { const h = r.headers.get('retry-after'), wait = /^\d+$/.test(h || '') ? Number(h) : Math.ceil((Date.parse(h) - clock()) / 1000); pauses.set(u.hostname, clock() + Math.max(60, Math.min(86400, wait || 60)) * 1000); }
      else pauses.set(u.hostname, clock() + 60000);
      throw new MapDataError('MAP_HTTP_' + r.status, 'Open building-data request was declined or unavailable. The existing model is retained; no mirror or automatic retry was used.');
    }
    if (Number(r.headers.get('content-length')) > max) { await r.body?.cancel(); throw new MapDataError('MAP_TOO_LARGE', 'Map-data download exceeds its size limit.'); }
    if (!r.body) throw new MapDataError('MAP_EMPTY', 'The map-data response was empty.');
    const reader = r.body.getReader(), parts = []; let count = 0;
    try {
      while (true) { combined.throwIfAborted(); const { value, done } = await reader.read(); if (done) break; count += value.length; if (count > max) { await reader.cancel(); throw new MapDataError('MAP_TOO_LARGE', 'Map-data download exceeds its size limit.'); } parts.push(value); }
    } finally { reader.releaseLock(); }
    return Buffer.concat(parts);
  }
  const getLidar = lidar || createLidar({ read });
  return {
    enabled,
    async lookup(name, postcode, parentSignal) {
      if (!enabled()) return { mapped:null, reason:'Open map data is disabled by the operator.' };
      const code = normalisePostcode(postcode), key = `building:${RELEASE}:${code}`, hit = cached(key);
      if (hit) return { ...hit, cached:true };
      if (busy) return { mapped:null, reason:'Another open-map lookup is running; the current estimate remains available.' };
      busy = true; const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(110000)]);
      try {
        let location = cached('postcode:' + code);
        if (!location) {
          const data = JSON.parse((await read('https://api.postcodes.io/postcodes/' + encodeURIComponent(code), { max:64000, signal })).toString('utf8'));
          location = { latitude:data?.result?.latitude, longitude:data?.result?.longitude };
          if (!ukPoint(location)) throw new MapDataError('MAP_LOCATION', 'Postcode did not return a usable UK location.');
          save('postcode:' + code, location, 30 * 86400);
        }
        let index = cached('index:' + RELEASE);
        if (typeof index !== 'string') { index = (await read(DATASET_INDEX, { max:16 * MB, signal, timeout:20000 })).toString('utf8'); save('index:' + RELEASE, index, 30 * 86400); }
        const dy = 350 / 111320, dx = dy / Math.cos(location.latitude * Math.PI / 180), wanted = new Set();
        for (const x of [-dx, 0, dx]) for (const y of [-dy, 0, dy]) wanted.add(quadkey(location.longitude + x, location.latitude + y));
        const tiles = indexTiles(index, wanted), all = []; let downloaded = 0;
        for (const tile of tiles) {
          const bytes = await read(tile.url, { max:32 * MB, signal, timeout:60000 }); downloaded += bytes.length;
          if (downloaded > 64 * MB) throw new MapDataError('MAP_TOO_LARGE', 'Regional building-data budget reached.');
          all.push(...await nearbyFeatures(bytes, location, tile.quadkey, signal));
        }
        const selected = rankCandidates(all)[0];
        if (!selected) { const out = { mapped:null, reason:'No supported open building footprint was found near this postcode. AI can keep estimating.', location }; save(key, out, 3600); return out; }
        let scanResult;
        try { scanResult = await getLidar(selected, AbortSignal.any([signal, AbortSignal.timeout(40000)])); }
        catch (error) { if (parentSignal.aborted) throw error; scanResult = {scan:null,note:'LiDAR height checking did not finish; the mapped outline and available map height have been retained.'}; }
        parentSignal.throwIfAborted();
        const mapped = mappedFromCandidate(selected, location, { release:RELEASE, scan:scanResult.scan, scanNote:scanResult.note });
        const result = { mapped, location, candidates:all.length, cached:false, reason:mapped.matchNote };
        save(key, result, 30 * 86400); return result;
      } finally { busy = false; }
    }
  };
}
