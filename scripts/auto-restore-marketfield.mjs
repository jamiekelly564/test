import { promises as fs, constants } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

// A digest only. No model, plan, account key or private download URL is in Git.
export const TRUSTED_MANIFEST = 'a9d662c571f49ebe5917054b07826ed0738a1a1a07dbb11334ffb77066b234fa';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MB = 1024 * 1024, MAX_ZIP = 80 * MB, MAX_FILE = 24 * MB, MAX_TOTAL = 96 * MB;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
async function stat(path) { try { return await fs.lstat(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function safeName(name, directory = false) {
  if (typeof name !== 'string' || name.length > 700 || /[\\:\u0000-\u001f]/.test(name)) fail('Unsafe recovery path.');
  const parts = (directory && name.endsWith('/') ? name.slice(0, -1) : name).split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) fail('Unsafe recovery path.');
  return name;
}
async function plainDirectory(path) {
  const s = await stat(path);
  if (!s || !s.isDirectory() || s.isSymbolicLink()) fail('Recovery folders must be real local directories, not links.');
}
async function readFile(path, limit) {
  const s = await stat(path);
  if (!s || !s.isFile() || s.isSymbolicLink() || s.size > limit) fail('A recovery file is missing, linked or too large.');
  const handle = await fs.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > limit || opened.ino !== s.ino || opened.dev !== s.dev) fail('A recovery file changed while opening.');
    // Bounded read, including files that grow after the first stat.
    const buffer = Buffer.alloc(opened.size + 1); let n = 0;
    while (n < buffer.length) { const part = await handle.read(buffer, n, buffer.length - n, n); if (!part.bytesRead) break; n += part.bytesRead; }
    if (n !== opened.size || (await handle.stat()).size !== opened.size) fail('A recovery file changed while reading.');
    return buffer.subarray(0, n);
  } finally { await handle.close(); }
}

/** Bounded ZIP32 reader: no shell, extraction command, ZIP scripts or dependency. */
export function readZip(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_ZIP) fail('Recovery ZIP is incomplete or too large.');
  let end = -1;
  for (let n = bytes.length - 22; n >= Math.max(0, bytes.length - 65557); n--) {
    if (bytes.readUInt32LE(n) === 0x06054b50 && n + 22 + bytes.readUInt16LE(n + 20) === bytes.length) { end = n; break; }
  }
  if (end < 0) fail('Recovery ZIP is incomplete.');
  const count = bytes.readUInt16LE(end + 10), length = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || count < 1 || count > 160 || start + length !== end) fail('Unsupported recovery ZIP directory.');
  const entries = new Map(), names = new Set(), spans = []; let at = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50) fail('Invalid recovery ZIP entry.');
    const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10), compressed = bytes.readUInt32LE(at + 20), size = bytes.readUInt32LE(at + 24);
    const nl = bytes.readUInt16LE(at + 28), xl = bytes.readUInt16LE(at + 30), cl = bytes.readUInt16LE(at + 32), offset = bytes.readUInt32LE(at + 42);
    const unixType = (bytes.readUInt32LE(at + 38) >>> 16) & 0xf000;
    if (at + 46 + nl + xl + cl > end || !nl || size > MAX_FILE || compressed > MAX_ZIP || (total += size) > MAX_TOTAL || flags & 1 || ![0, 8].includes(method) || ![0, 0x8000, 0x4000].includes(unixType) || bytes.readUInt16LE(at + 34)) fail('Unsupported or oversized recovery ZIP entry.');
    const name = safeName(new TextDecoder('utf-8', { fatal:true }).decode(bytes.subarray(at + 46, at + 46 + nl)), true);
    if (names.has(name.toLowerCase())) fail('Duplicate recovery ZIP path.'); names.add(name.toLowerCase());
    if (offset + 30 > start || bytes.readUInt32LE(offset) !== 0x04034b50 || bytes.readUInt16LE(offset + 6) !== flags || bytes.readUInt16LE(offset + 8) !== method) fail('Invalid recovery ZIP local header.');
    const localLength = bytes.readUInt16LE(offset + 26), dataStart = offset + 30 + localLength + bytes.readUInt16LE(offset + 28);
    if (dataStart + compressed > start || localLength !== nl || !bytes.subarray(offset + 30, offset + 30 + localLength).equals(bytes.subarray(at + 46, at + 46 + nl))) fail('Recovery ZIP paths or data do not match.');
    spans.push([offset, dataStart + compressed]);
    if (!name.endsWith('/')) entries.set(name, { method, size, compressed, dataStart });
    else if (size !== 0) fail('Invalid recovery ZIP directory entry.');
    at += 46 + nl + xl + cl;
  }
  if (at !== end) fail('Invalid recovery ZIP directory size.');
  spans.sort((a,b) => a[0] - b[0]);
  if (spans.some((s,i) => i && s[0] < spans[i - 1][1])) fail('Overlapping recovery ZIP entries.');
  return {
    names:[...entries.keys()],
    async read(name) {
      const e = entries.get(safeName(name)); if (!e) fail('A required recovery file is missing.');
      const compressed = bytes.subarray(e.dataStart, e.dataStart + e.compressed);
      const out = e.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength:Math.max(1, e.size) });
      if (out.length !== e.size) fail('A recovery ZIP file has the wrong size.');
      return out;
    }
  };
}
function folderReader(root) {
  return { async read(name) {
    safeName(name); await plainDirectory(root); const parts = name.split('/'); let parent = root;
    for (const p of parts.slice(0,-1)) { parent = join(parent,p); await plainDirectory(parent); }
    return readFile(join(parent,parts.at(-1)), MAX_FILE);
  } };
}
async function recoveryReader(candidate) {
  if (candidate.kind === 'folder') return folderReader(candidate.path);
  const zip = readZip(await readFile(candidate.path, MAX_ZIP));
  const manifests = zip.names.filter(n => n === 'restore-manifest.json' || n.endsWith('/restore-manifest.json'));
  if (manifests.length !== 1) fail('Recovery ZIP needs one restore manifest.');
  const prefix = manifests[0].slice(0,-'restore-manifest.json'.length);
  return { read:name => zip.read(prefix + safeName(name)) };
}

/** Only named Marketfield recovery packs in Downloads or this project are inspected. */
export async function findRecoveryPacks(roots) {
  const found = [], seen = new Set();
  const named = /^Marketfield(?:-Court)?-Recovery(?:-Pack)?(?:\s*\(\d+\))?(?:\.zip)?$/i;
  async function folder(path, depth = 0) {
    const manifest = await stat(join(path,'restore-manifest.json'));
    if (manifest?.isFile() && !manifest.isSymbolicLink()) { found.push({path,kind:'folder',mtime:manifest.mtimeMs}); return; }
    if (depth >= 2) return;
    for (const e of await fs.readdir(path,{withFileTypes:true})) if (e.isDirectory() && named.test(e.name)) await folder(join(path,e.name),depth + 1);
  }
  for (const root of [...new Set(roots.map(r => resolve(r)))]) {
    const s = await stat(root); if (!s?.isDirectory() || s.isSymbolicLink()) continue;
    const dir = await fs.opendir(root); let scanned = 0;
    for await (const e of dir) {
      if (++scanned > 5000 || found.length >= 20) break;
      if (!named.test(e.name) || e.isSymbolicLink()) continue;
      const path = join(root,e.name); if (seen.has(path)) continue; seen.add(path);
      if (e.isFile() && /\.zip$/i.test(e.name)) found.push({path,kind:'zip',mtime:(await fs.lstat(path)).mtimeMs});
      else if (e.isDirectory()) await folder(path);
    }
  }
  return found.sort((a,b) => b.mtime - a.mtime).slice(0,12);
}
async function targetStatus(target) {
  const s = await stat(target); if (!s) return 'missing';
  if (!s.isDirectory() || s.isSymbolicLink()) return 'preserved';
  if (!(await fs.readdir(target)).length) return 'empty';
  for (const name of ['manifest.json','viewer.html','model.glb','model.usdz']) {
    const f = await stat(join(target,name)); if (!f?.isFile() || f.isSymbolicLink() || f.size < 1) return 'preserved';
  }
  return 'present';
}

/** Hash-pinned, staged copy. The optional digest argument is for synthetic unit tests;
 * production startup always uses TRUSTED_MANIFEST, never an environment override. */
export async function installRecovery({projectDir, reader, trustedManifest = TRUSTED_MANIFEST}) {
  projectDir = resolve(projectDir); await plainDirectory(projectDir);
  const pkg = JSON.parse((await readFile(join(projectDir,'package.json'),128 * 1024)).toString());
  if (pkg.name !== 'propertychecked-platform') fail('Use the PropertyChecked project containing package.json.');
  const ignore = (await readFile(join(projectDir,'.gitignore'),128 * 1024)).toString().split(/\r?\n/).map(s => s.trim());
  if (!ignore.some(s => ['private-assets/*','/private-assets/*','private-assets/','/private-assets/'].includes(s)) || ignore.some(s => /^!\/?private-assets\//.test(s) && s !== '!private-assets/README.md')) fail('Private model Git exclusions must be retained. Nothing restored.');
  const target = join(projectDir,'private-assets','marketfield');
  const before = await targetStatus(target);
  if (['present','preserved'].includes(before)) return {status:before};
  const manifestBytes = await reader.read('restore-manifest.json');
  if (manifestBytes.length > 64 * 1024 || sha(manifestBytes) !== trustedManifest) fail('Recovery pack is not the recognised unchanged Marketfield pack.');
  const manifest = JSON.parse(manifestBytes.toString());
  if (manifest.kind !== 'private-marketfield-recovery' || !manifest.files || Array.isArray(manifest.files)) fail('Invalid recovery manifest.');
  const files = Object.entries(manifest.files);
  if (!files.length || files.length > 100 || !['manifest.json','viewer.html','model.glb','model.usdz'].every(n => manifest.files[n])) fail('Recovery pack is missing required model files.');
  for (const [name,hash] of files) { safeName(name); if (!/^[a-f0-9]{64}$/.test(hash)) fail('Invalid recovery hash.'); }
  const parent = dirname(target); await fs.mkdir(parent,{recursive:true}); await plainDirectory(parent);
  const lockPath = join(parent,'.marketfield-setup.lock'); let lock, staging;
  try {
    try { lock = await fs.open(lockPath,'wx',0o600); } catch (e) { if (e.code === 'EEXIST') fail('Another model restore may be running. Existing files have not been changed.'); throw e; }
    if (!['missing','empty'].includes(await targetStatus(target))) return {status:'preserved'};
    staging = join(parent,'.marketfield-setup-' + randomUUID()); await fs.mkdir(staging,{mode:0o700}); let total = 0;
    for (const [name,hash] of files) {
      const bytes = await reader.read('private-assets/marketfield/' + name);
      if (bytes.length > MAX_FILE || (total += bytes.length) > MAX_TOTAL || sha(bytes) !== hash) fail('Recovery file verification failed. Existing files have not been changed.');
      const out = resolve(staging,name); if (!out.startsWith(staging + sep)) fail('Unsafe destination.');
      await fs.mkdir(dirname(out),{recursive:true}); await fs.writeFile(out,bytes,{flag:'wx',mode:0o600});
    }
    const current = await targetStatus(target);
    if (current === 'empty') await fs.rmdir(target); // Never recursive; fails if any file appeared.
    else if (current !== 'missing') fail('A Marketfield folder appeared during recovery. Nothing replaced.');
    if (await stat(target)) fail('Marketfield appeared before installation. Nothing replaced.');
    await fs.rename(staging,target); staging = null;
    return {status:'restored',files:files.length,bytes:total};
  } finally {
    if (staging) await fs.rm(staging,{recursive:true,force:true});
    if (lock) { await lock.close(); await fs.unlink(lockPath); }
  }
}

export async function autoRestoreMarketfield({projectDir = ROOT, searchRoots, disabled = process.env.CI || process.env.PROPERTYCHECKED_AUTO_RESTORE === '0', log = console.log} = {}) {
  if (disabled) return {status:'disabled'};
  const existing = await targetStatus(join(projectDir,'private-assets','marketfield'));
  if (existing === 'present') return {status:'present'};
  if (existing === 'preserved') { log('[Marketfield] Existing incomplete model folder preserved; no files overwritten.'); return {status:existing}; }
  const candidates = await findRecoveryPacks(searchRoots || [join(homedir(),'Downloads'),projectDir]);
  if (!candidates.length) { log('[Marketfield] Keep Marketfield-Court-Recovery-Pack.zip in Downloads and start again. Automatic local installation will use this project folder.'); return {status:'not_found'}; }
  let error;
  for (const candidate of candidates) {
    try {
      const result = await installRecovery({projectDir,reader:await recoveryReader(candidate)});
      if (result.status === 'restored') log(`[Marketfield] Restored ${result.files} verified files into this project's private-assets/marketfield. No folder selection needed. No files uploaded.`);
      return result;
    } catch (e) { error = e; }
  }
  log('[Marketfield] Automatic restore stopped: ' + error.message + ' The register can still open.');
  return {status:'invalid_pack'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  autoRestoreMarketfield().catch(e => { console.error('[Marketfield] Restore stopped: ' + e.message); process.exitCode = 1; });
}
