import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { readZip, installRecovery, findRecoveryPacks, autoRestoreMarketfield } from '../scripts/auto-restore-marketfield.mjs';
const digest = b => createHash('sha256').update(b).digest('hex');
const files = {
  'manifest.json':Buffer.from('{"assets":[],"floors":[],"sources":[],"fixture":true}'),
  'viewer.html':Buffer.from('<!doctype html><title>Synthetic fixture only</title>'),
  'model.glb':Buffer.from('Synthetic GLB fixture, not building geometry'),
  'model.usdz':Buffer.from('Synthetic USDZ fixture'),
  'nested/fixture.txt':Buffer.from('Non-sensitive synthetic source')
};
const manifest = Buffer.from(JSON.stringify({kind:'private-marketfield-recovery',files:Object.fromEntries(Object.entries(files).map(([n,b]) => [n,digest(b)]))}));
const trustedManifest = digest(manifest);
function reader(override = {}) { return {async read(n) { if (Object.hasOwn(override,n)) return override[n]; if (n === 'restore-manifest.json') return manifest; const b = files[n.replace('private-assets/marketfield/','')]; assert.ok(b, n); return b; }}; }
async function fixture(fn) {
  const dir = await fs.mkdtemp(join(tmpdir(),'pc-local-restore-')),projectDir = join(dir,'custom-project-location');
  await fs.mkdir(projectDir); await fs.writeFile(join(projectDir,'package.json'),'{"name":"propertychecked-platform"}');
  await fs.writeFile(join(projectDir,'.gitignore'),'private-assets/*\n!private-assets/README.md\n.data/\n.env\n');
  await fs.writeFile(join(projectDir,'.env'),'SYNTHETIC_TEST_CONFIG=true');
  await fs.mkdir(join(projectDir,'.data')); await fs.writeFile(join(projectDir,'.data','unchanged.txt'),'Keep this existing record');
  try { await fn({dir,projectDir,target:join(projectDir,'private-assets','marketfield')}); }
  finally { await fs.rm(dir,{recursive:true,force:true}); }
}
function zip(entries, {method = 8, mode = 0x8000} = {}) {
  const chunks = [],central = []; let offset = 0;
  for (const [name,value] of entries) {
    const nameBytes = Buffer.from(name),b = Buffer.from(value),compressed = method === 8 ? deflateRawSync(b) : b;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(method,8); local.writeUInt32LE(compressed.length,18); local.writeUInt32LE(b.length,22); local.writeUInt16LE(nameBytes.length,26);
    chunks.push(local,nameBytes,compressed);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50,0); cd.writeUInt16LE(method,10); cd.writeUInt32LE(compressed.length,20); cd.writeUInt32LE(b.length,24); cd.writeUInt16LE(nameBytes.length,28); cd.writeUInt32LE((mode * 65536) >>> 0,38); cd.writeUInt32LE(offset,42);
    central.push(cd,nameBytes); offset += local.length + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(central),end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}

test('restores into the supplied project, not a fixed Documents/Downloads path', () => fixture(async f => {
  const out = await installRecovery({...f,reader:reader(),trustedManifest}); assert.equal(out.status,'restored'); assert.equal(out.files,5);
  for (const [n,b] of Object.entries(files)) assert.deepEqual(await fs.readFile(join(f.target,n)),b);
  assert.equal(await fs.readFile(join(f.projectDir,'.env'),'utf8'),'SYNTHETIC_TEST_CONFIG=true');
  assert.equal(await fs.readFile(join(f.projectDir,'.data','unchanged.txt'),'utf8'),'Keep this existing record');
}));
test('requires a separately pinned manifest, not a self-declared pack', () => fixture(async f => {
  await assert.rejects(installRecovery({...f,reader:reader()}), /recognised unchanged/); await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
}));
test('changed source files abort the entire staged install', () => fixture(async f => {
  await assert.rejects(installRecovery({...f,reader:reader({'private-assets/marketfield/nested/fixture.txt':Buffer.from('tampered')}),trustedManifest}),/verification/);
  await assert.rejects(fs.stat(f.target),{code:'ENOENT'}); assert.deepEqual(await fs.readdir(join(f.projectDir,'private-assets')),[]);
}));
test('existing model is never overwritten and the source is not read', () => fixture(async f => {
  await installRecovery({...f,reader:reader(),trustedManifest}); await fs.writeFile(join(f.target,'viewer.html'),'Keep user work');
  const r = await installRecovery({...f,reader:{read(){throw Error('Must not read source');}},trustedManifest});
  assert.equal(r.status,'present'); assert.equal(await fs.readFile(join(f.target,'viewer.html'),'utf8'),'Keep user work');
}));
test('partially populated destination is preserved, never merged into', () => fixture(async f => {
  await fs.mkdir(f.target,{recursive:true}); await fs.writeFile(join(f.target,'only-file.txt'),'User work');
  assert.equal((await installRecovery({...f,reader:reader(),trustedManifest})).status,'preserved'); assert.deepEqual(await fs.readdir(f.target),['only-file.txt']);
}));
test('an empty destination directory from an earlier failed attempt can be filled', () => fixture(async f => {
  await fs.mkdir(f.target,{recursive:true}); assert.equal((await installRecovery({...f,reader:reader(),trustedManifest})).status,'restored');
}));
test('wrong package or removed privacy exclusions block installation', () => fixture(async f => {
  await fs.writeFile(join(f.projectDir,'package.json'),'{"name":"some-other-app"}'); await assert.rejects(installRecovery({...f,reader:reader(),trustedManifest}),/project/);
  await fs.writeFile(join(f.projectDir,'package.json'),'{"name":"propertychecked-platform"}'); await fs.writeFile(join(f.projectDir,'.gitignore'),'private-assets/*\n!private-assets/marketfield/**\n');
  await assert.rejects(installRecovery({...f,reader:reader(),trustedManifest}),/exclusions/); await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
}));
test('a symlinked private-assets destination is rejected', () => fixture(async f => {
  const elsewhere = join(f.dir,'elsewhere'); await fs.mkdir(elsewhere); await fs.symlink(elsewhere,join(f.projectDir,'private-assets'),'dir');
  await assert.rejects(installRecovery({...f,reader:reader(),trustedManifest}),/real local directories/); assert.deepEqual(await fs.readdir(elsewhere),[]);
}));
test('a competing setup lock is retained and not stolen', () => fixture(async f => {
  const parent = join(f.projectDir,'private-assets'); await fs.mkdir(parent); await fs.writeFile(join(parent,'.marketfield-setup.lock'),'Other process');
  await assert.rejects(installRecovery({...f,reader:reader(),trustedManifest}),/Another model restore/); assert.equal(await fs.readFile(join(parent,'.marketfield-setup.lock'),'utf8'),'Other process');
}));
test('populated destination appearing during copy is preserved', () => fixture(async f => {
  const source = reader(),wrapped = {async read(n) { if (n.endsWith('nested/fixture.txt')) { await fs.mkdir(f.target); await fs.writeFile(join(f.target,'new-work'),'Keep'); } return source.read(n); }};
  await assert.rejects(installRecovery({...f,reader:wrapped,trustedManifest}),/appeared/); assert.deepEqual(await fs.readdir(f.target),['new-work']);
}));
test('unsafe manifest paths are rejected before writing', () => fixture(async f => {
  const b = Buffer.from(JSON.stringify({kind:'private-marketfield-recovery',files:{...JSON.parse(manifest).files,'../outside.txt':digest(Buffer.from('bad'))}}));
  await assert.rejects(installRecovery({...f,reader:reader({'restore-manifest.json':b}),trustedManifest:digest(b)}),/Unsafe/);
}));
test('ZIP32 handles deflate and stored bytes without executing files', async () => {
  for (const method of [0,8]) { const r = readZip(zip([['root/test.txt','content'],['root/do-not-run.cmd','exit 99']],{method})); assert.equal((await r.read('root/test.txt')).toString(),'content'); assert.equal(r.names.length,2); }
});
test('ZIP paths reject traversal, absolute, drives, backslashes, devices and aliases', () => {
  for (const name of ['../escape','/absolute','C:/bad','a\\b','a/./b','a//b','a/../b','NUL.txt','COM1','a.','a ']) assert.throws(() => readZip(zip([[name,'x']])),/Unsafe/);
});
test('ZIP rejects duplicate case-insensitive paths and symlink entries', () => {
  assert.throws(() => readZip(zip([['a.txt','x'],['A.TXT','y']])),/Duplicate/); assert.throws(() => readZip(zip([['link','x']],{mode:0xa000})),/Unsupported/);
});
test('ZIP rejects truncated, encrypted, invalid headers and size bombs', () => {
  const good = zip([['text','x']]); assert.throws(() => readZip(good.subarray(0,-10)),/incomplete/);
  const bad = Buffer.from(good); bad.writeUInt16LE(1,6); assert.throws(() => readZip(bad),/header/);
  const bomb = Buffer.from(good),central = good.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])); bomb.writeUInt32LE(0xffffffff,central+24); assert.throws(() => readZip(bomb),/oversized/);
});
test('ZIP reads cannot exceed the declared expanded size', async () => {
  const b = zip([['data','abcdefghijklmnopqrstuvwxyz']]),cd = b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])); b.writeUInt32LE(1,cd+24);
  await assert.rejects(readZip(b).read('data'));
});
test('discovery accepts duplicate download names and extracted packs without broad scanning', () => fixture(async f => {
  const downloads = join(f.dir,'Downloads'); await fs.mkdir(downloads);
  await fs.writeFile(join(downloads,'Marketfield-Court-Recovery-Pack (2).zip'),'Synthetic ZIP candidate');
  const root = join(downloads,'Marketfield-Court-Recovery-Pack','Marketfield-Recovery'); await fs.mkdir(root,{recursive:true}); await fs.writeFile(join(root,'restore-manifest.json'),manifest);
  await fs.mkdir(join(downloads,'Unrelated')); await fs.writeFile(join(downloads,'Unrelated','restore-manifest.json'),manifest);
  const c = await findRecoveryPacks([downloads,downloads]); assert.equal(c.length,2); assert.ok(c.some(x => x.kind === 'zip')); assert.ok(c.some(x => x.path === root));
}));
test('discovery ignores symbolic links', () => fixture(async f => {
  const downloads = join(f.dir,'Downloads'); await fs.mkdir(downloads); const source = join(f.dir,'private-pack'); await fs.mkdir(source); await fs.writeFile(join(source,'restore-manifest.json'),manifest);
  await fs.symlink(source,join(downloads,'Marketfield-Recovery'),'dir'); assert.deepEqual(await findRecoveryPacks([downloads]),[]);
}));
test('no pack leaves all existing records alone and returns an actionable message', () => fixture(async f => {
  const logs = []; const r = await autoRestoreMarketfield({...f,disabled:false,searchRoots:[f.projectDir],log:s=>logs.push(s)});
  assert.equal(r.status,'not_found'); assert.match(logs[0],/Downloads/); await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
}));
test('untrusted discovered ZIP never installs even with matching internal file hashes', () => fixture(async f => {
  const b = zip([['Marketfield-Recovery/restore-manifest.json',manifest],...Object.entries(files).map(([n,b])=>['Marketfield-Recovery/private-assets/marketfield/'+n,b])]);
  await fs.writeFile(join(f.projectDir,'Marketfield-Court-Recovery-Pack.zip'),b);
  const r = await autoRestoreMarketfield({...f,disabled:false,searchRoots:[f.projectDir],log(){}}); assert.equal(r.status,'invalid_pack'); await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
}));
test('CI and explicit disabling do not probe files or start any external work', async () => {
  assert.equal((await autoRestoreMarketfield({projectDir:'/missing-project',disabled:true,log(){throw Error('No output');}})).status,'disabled');
});
test('doctor hooks automatic restore; helper contains no network, shell or private bytes', async () => {
  const code = await fs.readFile(new URL('../scripts/auto-restore-marketfield.mjs',import.meta.url),'utf8'),doctor = await fs.readFile(new URL('../scripts/doctor.mjs',import.meta.url),'utf8');
  assert.match(doctor,/autoRestoreMarketfield/); assert.doesNotMatch(code,/\bfetch\s*\(|child_process|https?:\/\/|execSync|spawnSync/); assert.match(code,/import\.meta\.url/);
});
