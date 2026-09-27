import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unproject, polygonArea } from '../packages/auto-model/geometry.mjs';
import { candidateFeature, rankCandidates, mappedFromCandidate, validateMapped, applyMapped, MAP_SOURCE } from '../packages/preview/map-shape.mjs';
import { defaultSpec, validateSpec, previewModel, previewMeshes, previewGLB } from '../packages/preview/model.mjs';
import { createMapProvider, allowedURL, DATASET_INDEX, indexTiles, quadkey, nearbyFeatures } from '../apps/api/map-data/provider.mjs';
import { britishGrid, numericTiff, scanHeight, coverageInfo, createLidar, EA } from '../apps/api/map-data/lidar.mjs';
import { mapResearch } from '../apps/api/map-data/research.mjs';
import { ResearchError } from '../apps/api/preview/research.mjs';
import { modelBasis, stageSteps, editBlock } from '../packages/preview/ux.mjs';
import { createPreviewApp, VERSION } from '../apps/api/preview-server.mjs';
const origin={longitude:-.169,latitude:51.24};
const signal=()=>new AbortController().signal;
const square=[[-10,-10],[20,-10],[20,20],[-10,20],[-10,-10]];
const court=[[[0,0],[30,0],[30,25],[0,25],[0,0]],[[10,8],[20,8],[20,18],[10,18],[10,8]]];
const feature=(rings=[square],height=12)=>({type:'Feature',properties:{height},geometry:{type:'Polygon',coordinates:rings.map(r=>r.map(p=>unproject(...p,origin)))}});
const c=()=>candidateFeature(feature(court),origin,1);
const mapped=()=>mappedFromCandidate(c(),origin);
const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
const offline={configured:()=>false,run:()=>{throw new Error('unexpected AI');}};
const providerResult=()=>({mapped:mapped(),candidates:3,reason:'Postcode-based guess'});
const staticProvider={enabled:()=>true,lookup:async()=>providerResult()};
const usage=()=>({responses:0,inputTokens:0,outputTokens:0,searchCalls:0});

test('open map URL allowlist accepts official data only, not Google, Overpass or private hosts',()=>{
  for(const url of [DATASET_INDEX,EA.dsm+'?service=WCS',EA.dtm+'?service=WCS','https://api.postcodes.io/postcodes/RH1%201RT'])assert.ok(allowedURL(url));
  for(const url of ['https://tile.googleapis.com/v1/3dtiles/root.json','https://overpass-api.de/api/interpreter','https://127.0.0.1/x','https://user:pw@bfppub.blob.core.windows.net/file.gz','https://bfppub.blob.core.windows.net/file.gz?sig=abc','http://bfppub.blob.core.windows.net/file.gz','https://example.org/file.gz'])assert.throws(()=>allowedURL(url));
});
test('Microsoft index reads quoted CSV and restores numeric quadkey leading zeros',()=>{
  const q=quadkey(origin.longitude,origin.latitude),url='https://bfppub.blob.core.windows.net/global-buildings/x.csv.gz';
  assert.equal(q.length,9);assert.equal(q,'031313131');
  const rows=indexTiles('Location,QuadKey,Url,Size\r\n"United Kingdom",'+Number(q)+',"'+url+'",10\r\n',new Set([q]));
  assert.equal(rows.length,1);assert.equal(rows[0].quadkey,q);assert.equal(rows[0].url,url);
  assert.throws(()=>indexTiles('QuadKey,Url\n'+q+',https://example.org/x.gz',new Set([q])));
});
test('a real polygon and courtyard survive projection and source normalisation',()=>{
  const candidate=c(),m=mapped();assert.ok(candidate);assert.equal(m.source,MAP_SOURCE);
  assert.ok(Math.abs(polygonArea(m.polygons[0])-650)<.1);assert.equal(m.polygons[0].length,2);
  assert.equal(m.heightBasis,'dataset-estimate');assert.match(m.matchNote,/may be a neighbour/);assert.equal(m.licence,'CDLA-Permissive-2.0');
});
test('no building identity is inferred from the postcode; nearest plausible outline stays separate',()=>{
  const a=candidateFeature(feature(),origin,1),b=candidateFeature(feature([square.map(([x,y])=>[x+100,y])]),origin,2);
  assert.equal(rankCandidates([b,a])[0].id,a.id);assert.equal(rankCandidates([b,a]).length,2);
  const s=applyMapped(defaultSpec('Synthetic Court'),mappedFromCandidate(a,origin));assert.equal(s.matchBasis,'ambiguous');assert.equal(s.blocks.length,1);
});
for(const value of [-1,null,'12',200,NaN])test('missing or invalid map height is not fabricated: '+String(value),()=>{
  const a=candidateFeature(feature([square],value),origin);assert.equal(a.heightM,null);
});
test('invalid, distant or unclosed source polygons are omitted',()=>{
  assert.equal(candidateFeature(feature([square.map(([x,y])=>[x+1000,y])]),origin),null);
  assert.equal(candidateFeature(feature([[[0,0],[10,10],[0,10],[10,0],[0,0]]]),origin),null);
  assert.equal(candidateFeature(feature([square.slice(0,-1)]),origin),null);
});
test('height-driven storeys stay within preview bounds for all valid heights',()=>{
  for(let h=2.4;h<=125;h+=.2){const m=mapped();m.heightM=h;const s=applyMapped(defaultSpec(),m);assert.doesNotThrow(()=>validateSpec(s));assert.ok(Math.abs(s.blocks[0].floors*s.blocks[0].floorHeight-h)<1e-6);}
});
test('AI rectangular massing cannot erase the source polygon or add neighbouring blocks',()=>{
  const s=defaultSpec();s.blocks[0].width=60;s.blocks.push({...s.blocks[0],x:100});s.matchBasis='likely';
  const result=applyMapped(s,mapped());assert.equal(result.blocks.length,1);assert.equal(result.blocks[0].width,30);assert.equal(result.matchBasis,'ambiguous');
  assert.deepEqual(validateSpec(result).mapped.polygons,mapped().polygons);
});
test('mapped sources cannot add executable or credential-bearing links',()=>{
  const m=mapped();m.sourceUrl='javascript:bad()';m.secret='secret';const result=validateMapped(m);
  assert.equal(result.secret,undefined);assert.match(result.sourceUrl,/github.com\/microsoft/);
  m.polygons[0][0][0][0]=9000;assert.throws(()=>validateMapped(m));
});
for(const roof of ['flat','gable','hip'])test('mapped '+roof+' geometry and GLB retain real courtyard fill and credits',()=>{
  const spec=applyMapped(defaultSpec(),mapped());spec.blocks[0].roof=roof;spec.blocks[0].roofHeight=3;spec.blocks[0].balconies=true;
  const model=previewModel(spec),slab=model.volumes.find(v=>v.preview.kind==='mapped floor envelope');assert.equal(polygonArea(slab.rings),650);
  const objects=previewMeshes(model);assert.ok(objects.every(o=>o.positions.every(Number.isFinite)));assert.ok(objects.every(o=>o.extras.notSurveyed));
  const bin=previewGLB(spec),dv=new DataView(bin.buffer),doc=JSON.parse(new TextDecoder().decode(bin.slice(20,20+dv.getUint32(12,true))));
  assert.equal(doc.meshes.length,objects.length);assert.equal(doc.extras.source.licence,'CDLA-Permissive-2.0');assert.match(doc.extras.status,/not surveyed/);
  if(roof!=='flat')assert.ok(model.roofs.length);assert.ok(model.volumes.some(v=>v.preview.kind==='illustrative balcony'));
});
test('cutaway and upper-floor isolation preserve the map and never add rooms',()=>{
  const s=applyMapped(defaultSpec(),mapped()),before=JSON.stringify(s),m=previewModel(s,{floor:'2',cutaway:true,explode:true});
  assert.equal(JSON.stringify(s),before);assert.ok(m.volumes.every(v=>v.preview.level===2));assert.equal(m.roofs.length,0);
  assert.ok(!JSON.stringify(m).includes('FD30'));
});
test('manual editing preserves source rings and records transformed dimensions',()=>{
  const s=applyMapped(defaultSpec(),mapped()),edited=editBlock(s,0,{width:40,roof:'hip'});
  assert.deepEqual(edited.mapped.polygons,s.mapped.polygons);assert.equal(edited.mapped.manualDimensions,true);assert.equal(previewModel(edited).extent.maxX,40);
});
test('map-only progress does not pretend that AI ran or a building was verified',()=>{
  const p={spec:applyMapped(defaultSpec(),mapped()),meta:{mapData:{},usage:usage()},stage:'complete',status:'ready'};
  assert.match(modelBasis(p),/unconfirmed/);assert.notEqual(stageSteps(p).at(-1).state,'done');
});
test('GeoJSON lines parse gzip and fail closed on truncated data',async()=>{
  const b=gzipSync(JSON.stringify(feature())+'\n'+JSON.stringify(feature([square.map(([x,y])=>[x+2000,y])]))+'\n');
  const found=await nearbyFeatures(b,origin,'031313131',signal());assert.equal(found.length,1);assert.match(found[0].id,/ms-031/);
  await assert.rejects(nearbyFeatures(Buffer.from('{broken'),origin,'0',signal()));
  const controller=new AbortController();controller.abort();await assert.rejects(nearbyFeatures(b,origin,'0',controller.signal));
});
function networkFixture({status=200,empty=false}={}){
  const calls=[],q=quadkey(origin.longitude,origin.latitude),tile='https://bfppub.blob.core.windows.net/global-buildings/uk.csv.gz';
  const fetcher=async(url,opts)=>{calls.push(url);assert.equal(opts.redirect,'error');assert.match(opts.headers['User-Agent'],/PropertyChecked/);
    if(url.includes('postcodes.io'))return json({result:origin});
    if(url===DATASET_INDEX)return new Response('Location,QuadKey,Url,Size\nUnitedKingdom,'+Number(q)+','+tile+',10');
    if(url===tile)return status===200?new Response(gzipSync(empty?'':JSON.stringify(feature())+'\n')):new Response('declined',{status,headers:{'Retry-After':'120'}});
    throw new Error('unexpected network request '+url);
  };return {fetcher,calls};
}
test('real provider reads official index and gzipped geometry, then uses its cache',async()=>{
  const n=networkFixture(),p=createMapProvider({...n,lidar:async()=>({scan:null,note:'No scan fixture'})});
  const a=await p.lookup('Synthetic Court','RH1 1RT',signal());assert.ok(a.mapped);assert.equal(n.calls.length,3);
  const b=await p.lookup('Synthetic Court','RH11RT',signal());assert.equal(b.cached,true);assert.equal(n.calls.length,3);
});
test('no footprint stays a labelled fallback and no scan is requested',async()=>{
  const n=networkFixture({empty:true}),p=createMapProvider({...n,lidar:()=>{throw new Error('must not run');}});const r=await p.lookup('Unknown','RH1 1RT',signal());assert.equal(r.mapped,null);assert.match(r.reason,/No supported/);
});
test('scan failure never discards a successfully loaded map outline',async()=>{
  const n=networkFixture(),p=createMapProvider({...n,lidar:async()=>{throw new Error('timeout');}});const r=await p.lookup('Synthetic','RH1 1RT',signal());assert.ok(r.mapped);assert.equal(r.mapped.heightM,12);assert.match(r.mapped.scanNote,/retained/);
});
for(const status of [401,403,406,429])test('map HTTP '+status+' pauses the provider and never retries via another host',async()=>{
  const n=networkFixture({status}),p=createMapProvider({...n,lidar:async()=>({scan:null})});
  await assert.rejects(p.lookup('Synthetic','RH1 1RT',signal()),e=>e.code==='MAP_HTTP_'+status);
  const before=n.calls.length;await assert.rejects(p.lookup('Synthetic','RH1 1RT',signal()),e=>e.code==='MAP_PAUSED');assert.equal(n.calls.length,before);
});
test('operator can disable open map requests completely',async()=>{
  const p=createMapProvider({enabled:()=>false,fetcher:()=>{throw new Error('must not call');}});assert.equal((await p.lookup('A','RH1 1RT',signal())).mapped,null);
});
// Small numeric GeoTIFF fixture with actual British National Grid geotags.
function tiff(value,{nodata=-9999,crs=27700,endian='II'}={}){
  const le=endian==='II', entries=[],extra=[],data=Buffer.alloc(8*8*4);for(let i=0;i<64;i++)le?data.writeFloatLE(value,i*4):data.writeFloatBE(value,i*4);
  const add=(tag,type,values)=>entries.push({tag,type,values});
  add(256,4,[8]);add(257,4,[8]);add(258,3,[32]);add(259,3,[1]);add(262,3,[1]);add(273,4,[0]);add(277,3,[1]);add(278,4,[8]);add(279,4,[data.length]);add(339,3,[3]);
  add(33550,12,[1,1,0]);add(33922,12,[0,0,0,100,200,0]);add(34735,3,[1,1,0,2,1025,0,1,1,3072,0,1,crs]);add(42113,2,[...Buffer.from(String(nodata)+'\0')]);
  entries.sort((a,b)=>a.tag-b.tag);let at=8+2+entries.length*12+4;
  for(const e of entries){const size=({2:1,3:2,4:4,12:8})[e.type],bytes=Buffer.alloc(e.values.length*size);e.values.forEach((v,i)=>{if(size===1)bytes[i]=v;else if(size===2)le?bytes.writeUInt16LE(v,i*size):bytes.writeUInt16BE(v,i*size);else if(size===4)le?bytes.writeUInt32LE(v,i*size):bytes.writeUInt32BE(v,i*size);else le?bytes.writeDoubleLE(v,i*size):bytes.writeDoubleBE(v,i*size);});e.bytes=bytes;if(bytes.length>4){e.offset=at;at+=bytes.length;extra.push(bytes);}}
  const dataAt=at,out=Buffer.alloc(at+data.length),v=new DataView(out.buffer,out.byteOffset,out.length);out.write(endian,0);v.setUint16(2,42,le);v.setUint32(4,8,le);v.setUint16(8,entries.length,le);
  entries.forEach((e,i)=>{const p=10+i*12;v.setUint16(p,e.tag,le);v.setUint16(p+2,e.type,le);v.setUint32(p+4,e.values.length,le);if(e.tag===273)v.setUint32(p+8,dataAt,le);else if(e.offset){v.setUint32(p+8,e.offset,le);out.set(e.bytes,e.offset);}else out.set(e.bytes,p+8);});out.set(data,dataAt);return out;
}
for(const endian of ['II','MM'])test('numeric scan raster decodes '+endian+' with georeferencing and no image colours',()=>{
  const r=numericTiff(tiff(112,{endian}));assert.equal(r.width,8);assert.equal(r.x,100);assert.equal(r.y,200);assert.equal(r.data[30],112);
});
test('numeric scan decoder rejects non-raster data and wrong CRS',()=>{
  assert.throws(()=>numericTiff(Buffer.from('<html>error</html>')));assert.throws(()=>numericTiff(tiff(112,{crs:4326})));
  assert.ok(Number.isNaN(numericTiff(tiff(-9999)).data[0]));
});
test('scan height is DSM minus terrain within the footprint, not absolute elevation',()=>{
  const dsm=numericTiff(tiff(112)),dtm=numericTiff(tiff(100)),poly=[[[[100,192],[108,192],[108,200],[100,200]]]];
  const r=scanHeight(dsm,dtm,poly);assert.equal(r.medianM,12);assert.equal(r.samples,64);
  assert.equal(scanHeight(numericTiff(tiff(-9999)),dtm,poly),null);
  const outside=[[[[300,300],[308,300],[308,308],[300,308]]]];assert.equal(scanHeight(dsm,dtm,outside),null);
});
test('approximate OSGB36 projection matches known London control within 5 m',()=>{
  const [e,n]=britishGrid(-.1276,51.5072);assert.ok(Math.abs(e-530043.195)<5);assert.ok(Math.abs(n-180358.209)<5);
});
test('scan coverage rejects unsafe XML and unsupported axes',()=>{
  const cap='<wcs:CoverageId>DSM_1m</wcs:CoverageId>',des='<gml:Envelope srsName="http://www.opengis.net/def/crs/EPSG/0/27700" axisLabels="E N">';
  assert.deepEqual(coverageInfo(cap,des),{id:'DSM_1m',axes:['E','N']});assert.throws(()=>coverageInfo('<!DOCTYPE x>'+cap,des));assert.throws(()=>coverageInfo(cap,des.replace('E N','Lat Long')));
});
test('LiDAR client requests numeric GetCoverage and never WMS screenshots',async()=>{
  const calls=[],read=async(url)=>{calls.push(url);const u=new URL(url),kind=u.pathname.includes('surface')?'DSM':'DTM',req=u.searchParams.get('request');
    if(req==='GetCapabilities')return Buffer.from('<wcs:CoverageId>'+kind+'</wcs:CoverageId>');
    if(req==='DescribeCoverage')return Buffer.from('<gml:Envelope srsName="http://www.opengis.net/def/crs/EPSG/0/27700" axisLabels="E N">');
    assert.equal(req,'GetCoverage');assert.equal(u.searchParams.get('format'),'image/tiff');assert.equal(u.searchParams.getAll('subset').length,2);return tiff(kind==='DSM'?112:100);
  };
  const result=await createLidar({read})(feature(),signal());assert.equal(calls.length,6);assert.equal(result.scan,null);
});
test('map-only processing has usable geometry without any AI key or inference',async()=>{
  const phases=[],r=await mapResearch(offline,staticProvider).run({name:'Synthetic',postcode:'RH1 1RT',spec:defaultSpec(),signal:signal(),usage:usage(),onProgress:async v=>phases.push(v)});
  assert.ok(r.spec.mapped);assert.equal(r.usage.responses,0);assert.equal(r.basis,'map-based-estimate');assert.ok(phases.some(p=>p.spec?.mapped));
});
test('map result survives AI error and each successful AI pass is constrained to the source footprint',async()=>{
  const phases=[],base={configured:()=>true,run:async a=>{const s=defaultSpec();s.blocks[0].width=100;s.matchBasis='likely';await a.onProgress({spec:s,stage:'appearance'});throw new ResearchError('insufficient_quota','No credit');}};
  await assert.rejects(mapResearch(base,staticProvider).run({name:'Synthetic',postcode:'RH1 1RT',spec:defaultSpec(),signal:signal(),usage:usage(),onProgress:async v=>phases.push(v)}));
  assert.equal(phases.at(-1).spec.blocks[0].width,30);assert.ok(phases.at(-1).spec.mapped);assert.equal(phases.at(-1).spec.matchBasis,'ambiguous');
});
async function harness(research=mapResearch(offline,staticProvider),root){
  root||=mkdtempSync(join(tmpdir(),'pc-map-tests-'));const app=createPreviewApp({dataDir:root,assetsDir:join(root,'private'),preview:{research}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf;
  const request=async(path,method='GET',body,auth=true)=>{const res=await fetch(base+path,{method,headers:auth?{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:res.headers.get('content-type')?.includes('json')?await res.json():await res.arrayBuffer()};};
  const settle=async id=>{for(let i=0;i<100;i++){const p=(await request('/api/previews/'+id)).data;if(p.status!=='refining')return p;await new Promise(r=>setTimeout(r,5));}throw new Error('job did not settle');};
  return {app,base,root,request,settle,close:async(remove=true)=>{await app.close();if(remove)rmSync(root,{recursive:true,force:true});}};
}
const input=()=>({name:'Synthetic Court',postcode:'RH1 1RT',requestKey:crypto.randomUUID(),allowProcessing:true});
test('real HTTP create -> mapped model -> export retains session and CSRF boundaries',async()=>{
  const h=await harness();try{
    assert.equal((await h.request('/api/previews','POST',input(),false)).status,401);
    const p=(await h.request('/api/previews','POST',input())).data;assert.ok(p.spec.blocks.length);const final=await h.settle(p.id);assert.ok(final.spec.mapped);assert.equal(final.meta.mapData.state,'available');
    assert.equal((await h.request('/api/previews/'+p.id+'/model.glb')).status,200);
    assert.equal((await h.request('/modules/preview/map-shape.mjs')).status,200);
    assert.equal((await h.request('/api/status')).data.version,VERSION);
    assert.equal(h.app.workspace.locations(p.building_id).length,0);
  }finally{await h.close();}
});
test('map preview edits, undo and repeat creation do not repeat external processing',async()=>{
  let calls=0;const h=await harness(mapResearch(offline,{enabled:()=>true,lookup:async()=>{calls++;return providerResult();}}));try{
    const p=(await h.request('/api/previews','POST',input())).data,ready=await h.settle(p.id),edited=editBlock(ready.spec,0,{width:40});
    const saved=(await h.request('/api/previews/'+p.id,'PATCH',{version:ready.version,spec:edited})).data;assert.equal(saved.spec.mapped.manualDimensions,true);
    const undone=(await h.request('/api/previews/'+p.id+'/undo','POST',{version:saved.version})).data;assert.deepEqual(undone.spec.mapped.polygons,ready.spec.mapped.polygons);assert.equal(undone.spec.blocks[0].width,30);
    const repeat=(await h.request('/api/previews','POST',input())).data;assert.equal(repeat.id,p.id);assert.equal(calls,1);
  }finally{await h.close();}
});
test('database reopen preserves map geometry and cached datasets without external work',async()=>{
  const h=await harness(),p=(await h.request('/api/previews','POST',input())).data;await h.settle(p.id);const n=networkFixture();await createMapProvider({...n,workspace:h.app.workspace,lidar:async()=>({scan:null})}).lookup('Synthetic','RH1 1RT',signal());const root=h.root;await h.close(false);
  const next=await harness(offline,root);try{assert.ok((await next.request('/api/previews/'+p.id)).data.spec.mapped);
    const cached=await createMapProvider({workspace:next.app.workspace,fetcher:()=>{throw new Error('network must not run');}}).lookup('Synthetic','RH1 1RT',signal());assert.equal(cached.cached,true);
  }finally{await next.close();}
});
test('late map/AI results cannot overwrite a saved correction',async()=>{
  let finish;const done=new Promise(r=>finish=r),h=await harness(mapResearch({configured:()=>true,run:async()=>done},staticProvider));
  try{const p=(await h.request('/api/previews','POST',input())).data;let now;for(let i=0;i<100;i++){now=(await h.request('/api/previews/'+p.id)).data;if(now.spec.mapped)break;await new Promise(r=>setTimeout(r,5));}
    const edit=editBlock(now.spec,0,{width:45});assert.equal((await h.request('/api/previews/'+p.id,'PATCH',{version:now.version,spec:edit})).status,200);
    finish({spec:defaultSpec(),references:[],photos:[],usage:usage()});await new Promise(r=>setTimeout(r,15));assert.equal((await h.request('/api/previews/'+p.id)).data.spec.blocks[0].width,45);
  }finally{finish?.({spec:defaultSpec(),references:[],photos:[],usage:usage()});await h.close();}
});
test('manual PATCH cannot forge or change mapped source geometry',async()=>{
  const h=await harness();try{
    const p=(await h.request('/api/previews','POST',input())).data,r=await h.settle(p.id),s=structuredClone(r.spec);s.mapped.heightM=20;
    assert.equal((await h.request('/api/previews/'+p.id,'PATCH',{version:r.version,spec:s})).status,409);
    assert.equal((await h.request('/api/previews/'+p.id)).data.version,r.version);
  }finally{await h.close();}
});
test('scan/map height conflict is recorded instead of silently averaging',()=>{
  const candidate=c(),m=mappedFromCandidate(candidate,origin,{scan:{medianM:50,p90M:52,samples:30},scanNote:'Historic sample.'});
  assert.equal(m.heightM,12);assert.equal(m.heightBasis,'dataset-estimate');assert.equal(m.scan.medianM,50);assert.match(m.scanNote,/disagree/);
});
