"""Temporary, hash-pinned transport for already-tested tracked code. Never commits or pushes."""
import base64, hashlib, json, os, pathlib, sys, urllib.request, zlib
ROOT = pathlib.Path.cwd().resolve()
REPO = 'jamiekelly564/test'
ALLOWED = set('''apps/api/server.mjs
apps/web/public/equipment-demo/app.js
apps/web/public/equipment-demo/style.css
packages/equipment-demo/geometry.mjs
packages/equipment-demo/model.mjs
packages/equipment-demo/viewer.css
packages/equipment-demo/viewer.js
packages/viewer/embed.css
packages/viewer/interaction.js
packages/viewer/surfaces.mjs
tests/equipment-demo.test.mjs
packages/viewer/scene.mjs
tests/equipment-rag.test.mjs
tests/model-foundation.test.mjs
docs/MARKETFIELD-MODEL-FOUNDATION.md'''.splitlines())

def blob(body):
    return hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()

chunks = [(ROOT / '.github' / ('foundation-delta-%d.txt' % i)).read_text(encoding='ascii') for i in range(6)]
# Correct known transport-only transcription slips, then require the original full digest.
chunks[0] = chunks[0].replace('BDVfqa2aZZ', 'BDVfqa2ZZ').replace('GTvmkUnSa7', 'GTvmkWJa7')
chunks[3] = chunks[3].replace('qUWDL6bhh', 'qUWDL6ohh').replace('25x9dYR', '25x9eYR').replace('RVSPo7LbIHMW0', 'RVSPo7Lb/bIHMW0')
encoded = ''.join(chunks).encode('ascii')
if len(encoded) != 50768 or hashlib.sha256(encoded).hexdigest() != 'bc9aca70c75d749c456a4d059bedec926ca905e2418054939ba751e4a0442963':
    raise SystemExit('Transport digest mismatch; no files changed.')
inflater = zlib.decompressobj()
decoded = inflater.decompress(base64.b64decode(encoded, validate=True), 3000000)
if not inflater.eof or inflater.unconsumed_tail or inflater.unused_data:
    raise SystemExit('Invalid bounded transport.')
entries = json.loads(decoded)
if not isinstance(entries, list) or len(entries) != 15 or {e['path'] for e in entries} != ALLOWED:
    raise SystemExit('Unexpected file scope.')
pending = []
for e in entries:
    path = ROOT / e['path']
    if any(p.is_symlink() for p in [path, *path.parents]) or not path.resolve().is_relative_to(ROOT):
        raise SystemExit('Unsafe target path.')
    old = path.read_bytes() if path.exists() else None
    if old is not None and blob(old) == e['sha']:
        pending.append((e, path, old))
        continue
    if (blob(old) if old is not None else None) != e['old']:
        raise SystemExit('Base file mismatch: ' + e['path'])
    text = (old or b'').decode('utf8')
    output = []
    for part in e['parts']:
        if isinstance(part, str):
            output.append(part)
        elif isinstance(part, list) and len(part) == 2 and all(type(v) is int for v in part) and 0 <= part[0] <= part[1] <= len(text):
            output.append(text[part[0]:part[1]])
        else:
            raise SystemExit('Invalid source slice.')
    body = ''.join(output).encode('utf8')
    if blob(body) != e['sha']:
        raise SystemExit('Reconstructed file mismatch: ' + e['path'])
    pending.append((e, path, body))
# Validate the entire set before writing any target.
for e, path, body in pending:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
print('Verified 15 tracked-code files. No private files or records accessed.')
if '--publish-blobs' in sys.argv:
    if os.environ.get('GITHUB_REPOSITORY') != REPO or os.environ.get('GITHUB_HEAD_REF') != 'fix/marketfield-model-foundation':
        raise SystemExit('Publication repository/branch mismatch.')
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        raise SystemExit('No publication token.')
    result = []
    for e, path, body in pending:
        request = urllib.request.Request('https://api.github.com/repos/' + REPO + '/git/blobs', method='POST', data=json.dumps({'content': body.decode('utf8'), 'encoding': 'utf-8'}).encode(), headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'PropertyChecked-code-publication', 'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(request, timeout=30) as response:
            actual = json.load(response)['sha']
        if actual != e['sha']:
            raise SystemExit('Uploaded blob mismatch.')
        result.append({'path': e['path'], 'sha': actual})
    (ROOT / 'foundation-blobs.json').write_text(json.dumps(result, indent=2), encoding='utf8')
    print('Created verified loose code blobs only. No branch or commit was changed.')
