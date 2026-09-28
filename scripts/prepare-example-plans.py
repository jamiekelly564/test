"""Explicit developer-only import of the ten hash-pinned public drawing sources.
Not run by npm install/start, page loads, or CI's ordinary regression tests.
Requires Pillow and CairoSVG; output files are committed as local WebP previews.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from PIL import Image
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/web/public/examples/assets'
SOURCES = ROOT / 'apps/web/public/examples/sources.json'
IDS = {'farnsworth','radlett','beverley','simon','walsh','mccraith','schmidt','cambridge','belton','lancaster'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Source redirect refused; review the source record first.')
opener = urllib.request.build_opener(NoRedirect())

def main():
    entries = json.loads(SOURCES.read_text(encoding='utf8'))
    if len(entries) != 10 or {e['id'] for e in entries} != IDS:
        raise ValueError('Expected the reviewed ten-source register.')
    DEST.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        url = urllib.parse.urlsplit(entry['original'])
        if url.scheme != 'https' or url.netloc != 'upload.wikimedia.org' or not url.path.startswith('/wikipedia/commons/'):
            raise ValueError('Unsupported source origin.')
        request = urllib.request.Request(entry['original'], headers={'User-Agent':'PropertyCheckedPlanLibrary/1.0 (https://github.com/jamiekelly564/test; explicit public drawing import)'})
        # Refusals/timeouts stop the import; no retry, login or mirror workaround.
        with opener.open(request, timeout=30) as response:
            data = response.read(16000001)
        if len(data) > 16000000 or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Source changed or exceeds the reviewed size limit: '+entry['id'])
        if url.path.lower().endswith('.svg'):
            # The pinned SVG may have embedded raster symbols, but no remote resources.
            if b'<!ENTITY' in data or b'<!DOCTYPE' in data:
                raise ValueError('Unsupported SVG declaration.')
            tree = ET.fromstring(data)
            for node in tree.iter():
                if node.tag.rsplit('}',1)[-1].lower() in ('script','foreignobject'):
                    raise ValueError('Unsupported active SVG content.')
                for attr,value in node.attrib.items():
                    if attr.rsplit('}',1)[-1] == 'href' and not value.startswith(('data:image/','#')):
                        raise ValueError('External SVG resource refused.')
            data = cairosvg.svg2png(bytestring=data,output_width=entry['imageSize'][0],output_height=entry['imageSize'][1])
        image = Image.open(BytesIO(data)).convert('RGB')
        image.thumbnail((1150,1150),Image.Resampling.LANCZOS)
        if list(image.size) != entry['imageSize']:
            raise ValueError('Source dimensions no longer match the prepared trace: '+entry['id'])
        target = DEST / (entry['id']+'.webp')
        image.save(target,'WEBP',quality=90,method=6)
        print(entry['id'],entry['licence'],target.stat().st_size,hashlib.sha256(target.read_bytes()).hexdigest())

if __name__ == '__main__':
    main()
