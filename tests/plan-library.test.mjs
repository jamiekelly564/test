import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewApp } from '../apps/api/preview-server.mjs';
import { exampleFiles,exampleMime } from '../apps/api/examples/routes.mjs';
import '../apps/web/public/examples/data.js';
import '../apps/web/public/examples/whole-buildings.js';
import '../apps/web/public/examples/engine.js';
const properties=globalThis.PC_PROPERTIES,engine=globalThis.PC_PLAN_ENGINE;

test('ten whole-building studies keep source-backed and estimated storeys explicit',()=>{
 assert.equal(properties.length,10);assert.equal(new Set(properties.map(p=>p.id)).size,10);
 assert.equal(new Set(properties.map(p=>p.source.url)).size,10);
 for(const p of properties){
  assert.ok(p.level&&p.limitations&&p.scaleBasis);assert.match(p.source.sha256,/^[a-f0-9]{64}$/);
  assert.equal(new URL(p.source.url).hostname,'commons.wikimedia.org');
  assert.equal(new URL(p.source.original).hostname,'upload.wikimedia.org');
  assert.ok(p.source.credit&&p.source.licence&&p.source.modelLicenceUrl);
  assert.equal(new Set(p.rooms.map(r=>r.id)).size,p.rooms.length);
  assert.equal(p.height,2.8);assert.match(p.source.alterations,/assumed/);
  assert.ok(p.wholeBuilding&&p.wholeBuilding.storeys>=1);assert.equal(p.wholeBuilding.sourceBackedStoreys,1);assert.equal(p.wholeBuilding.estimatedStoreys,p.wholeBuilding.storeys-1);
 }
 assert.match(properties.find(p=>p.id==='belton').limitations,/unscaled rough sketch/);
 assert.match(properties.find(p=>p.id==='lancaster').limitations,/early scheme altered/);
 assert.match(properties.find(p=>p.id==='beverley').limitations,/apartment/i);
});

for(const property of properties){
 test('real geometry, normals and attributed GLB: '+property.id,()=>{
  for(const cutaway of [true,false]){
   const scene=engine.geometry(property,{cutaway,furniture:true});
   assert.ok(scene.faces.length>20);assert.ok(scene.faces.length<50000);assert.equal(scene.storeys,property.wholeBuilding.storeys);assert.equal(scene.estimatedStoreys,property.wholeBuilding.estimatedStoreys);
   for(const o of scene.objects){assert.equal(o.positions.length,o.normals.length);assert.ok(o.positions.every(Number.isFinite));
    for(let i=0;i<o.positions.length;i+=9){const a=o.positions.slice(i,i+3),b=o.positions.slice(i+3,i+6),c=o.positions.slice(i+6,i+9),n=o.normals.slice(i,i+3),ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);const cr=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];assert.ok(cr.reduce((s,v,j)=>s+v*n[j],0)>=-1e-7,'triangle normal winding');}
   }
   const projection=engine.projection(scene,640,400);assert.ok(projection.scale>0);
  }
  const bytes=engine.glb(property),view=new DataView(bytes.buffer);assert.equal(view.getUint32(0,true),0x46546c67);assert.equal(view.getUint32(8,true),bytes.length);
  const doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+view.getUint32(12,true))).trim());assert.ok(doc.meshes.length>10);assert.equal(doc.extras.source,property.source.url);assert.equal(doc.extras.scope,property.level);assert.match(doc.extras.status,/Not surveyed/);assert.ok(!doc.images&&!doc.textures,'no unlicensed source texture extraction');
  assert.equal(doc.extras.licence,property.source.modelLicenceUrl);
  assert.match(engine.svgPreview(property),/<polygon/);
 });
}

test('even-odd triangulation leaves courtyards empty and conserves area',()=>{
 const rings=[[[0,0],[12,0],[12,10],[0,10]],[[3,3],[7,3],[7,7],[3,7]]];const tris=engine.triangulate(rings);
 assert.ok(Math.abs(tris.reduce((n,r)=>n+Math.abs(engine.area(r)),0)-104)<1e-6);
 for(const tri of tris){const c=[0,1].map(i=>tri.reduce((n,p)=>n+p[i],0)/3);assert.equal(engine.inside(c,rings[1]),false);}
});
test('saved geometry is not mutated by display settings or export',()=>{
 const before=JSON.stringify(properties);for(const p of properties){engine.geometry(p,{cutaway:false,furniture:true});engine.glb(p);}assert.equal(JSON.stringify(properties),before);
});
test('projection floor picking agrees with rendered plane',()=>{
 const p=properties[0],scene=engine.geometry(p),proj=engine.projection(scene,720,500);
 for(const pt of [[1,2],[4,3],[5,7]]){const screen=proj.project([pt[0],.03,pt[1]]),restored=proj.floorPoint(screen[0],screen[1]);assert.ok(Math.abs(restored[0]-pt[0])<1e-7);assert.ok(Math.abs(restored[1]-pt[1])<1e-7);}
});
test('local source previews exist with supported image signatures and matching metadata',async()=>{
 for(const p of properties){const bytes=await readFile(new URL('../apps/web/public/examples/'+p.source.image,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length<300000);}
});
test('demo assets use a fixed allowlist and do not expose private paths',()=>{
 assert.equal(exampleMime('/examples/assets/unknown.webp'),null);assert.equal(exampleMime('/examples/assets/simon.webp'),'image/webp');
 assert.equal(exampleMime('/examples/sources.json'),'application/json; charset=utf-8');assert.equal(exampleMime('/examples/whole-buildings.js'),'text/javascript; charset=utf-8');
 assert.ok(Object.values(exampleFiles).every(v=>v.startsWith('apps/web/public/examples/')));
});
test('demo is self-contained and does not call inference or mutate the live records',async()=>{
 const code=await readFile(new URL('../apps/web/public/examples/app.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|\/api\//);
 assert.match(code,/propertychecked-plan-library-01/);assert.match(code,/User-started hands-on timer/);
 const html=await readFile(new URL('../apps/web/public/examples/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<script[^>]+src="https?:/);assert.match(html,/whole-building visual studies/i);assert.match(html,/No historical hours have been invented/);
});
test('real local HTTP serves the demo and correct MIME without requiring an API key',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pc-plan-demo-'));
 const app=createPreviewApp({dataDir:dir,assetsDir:join(dir,'none'),preview:{research:{configured:()=>false,run(){throw Error('No external request permitted.');}}},photoFlow:{research:{configured:()=>false},maps:{enabled:()=>false}}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const before=app.workspace.buildings().length;
  const redirect=await fetch(base+'/examples',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/examples/');
  for(const [path] of Object.entries(exampleFiles)){const r=await fetch(base+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('content-type'),exampleMime(path));assert.ok((await r.arrayBuffer()).byteLength>0);}
  const head=await fetch(base+'/examples/assets/simon.webp',{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  const hostStatus=await new Promise((resolve,reject)=>{const req=httpRequest(base+'/examples/',{headers:{Host:'not-allowed.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(hostStatus,403);
  assert.equal((await fetch(base+'/examples/',{method:'POST'})).status,404);
  assert.equal((await fetch(base+'/examples/assets/unknown.webp')).status,404);
  assert.equal(app.workspace.buildings().length,before,'no demo buildings were added to live database');
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
