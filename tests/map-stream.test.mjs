import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {streamTile} from '../apps/api/map-data/tile-stream.mjs';
import {allowedURL,indexTiles,createMapProvider,DATASET_INDEX} from '../apps/api/map-data/provider.mjs';
import {unproject} from '../packages/auto-model/geometry.mjs';
const origin={longitude:-.169,latitude:51.24},signal=()=>new AbortController().signal;
const feature=()=>({type:'Feature',properties:{height:12},geometry:{type:'Polygon',coordinates:[[[0,0],[20,0],[20,20],[0,20],[0,0]].map(p=>unproject(...p,origin))]}});
const publicTile='https://bfppub.z5.web.core.windows.net/2026-07-24/global-buildings.geojsonl/RegionName=UnitedKingdom/quadkey=031313131/part-00024.c000.csv.gz';
async function* chunks(bytes,size){for(let i=0;i<bytes.length;i+=size)yield bytes.subarray(i,i+size);}
test('published Microsoft static host is supported without accepting arbitrary Azure accounts',()=>{
  assert.equal(allowedURL(publicTile).hostname,'bfppub.z5.web.core.windows.net');
  for(const url of [publicTile.replace('bfppub.','other.'),publicTile.replace('z5.','z4.'),publicTile+'?sig=secret',publicTile.replace('https:','http:')])assert.throws(()=>allowedURL(url));
  const rows=indexTiles('Location,QuadKey,Url,Size,UploadDate\nUnitedKingdom,031313131,'+publicTile+',113.4MB,2026-07-24',new Set(['031313131']));assert.equal(rows[0].url,publicTile);
});
for(const size of [1,7,65536])test('streaming gzip parses complete features across '+size+' byte boundaries',async()=>{
  const bytes=gzipSync(JSON.stringify(feature())+'\n');const result=await streamTile(chunks(bytes,size),origin,'031313131',signal());
  assert.equal(result.candidates.length,1);assert.equal(result.bytes,bytes.length);assert.equal(result.candidates[0].heightM,12);
});
test('already decompressed HTTP body is handled without inflating it again',async()=>{
  const bytes=Buffer.from(JSON.stringify(feature())+'\r\n');assert.equal((await streamTile(chunks(bytes,3),origin,'0',signal())).candidates.length,1);
});
test('streaming enforces compressed byte and individual row bounds',async()=>{
  const bytes=gzipSync(JSON.stringify(feature()));await assert.rejects(streamTile(chunks(bytes,5),origin,'0',signal(),20),e=>e.code==='MAP_TOO_LARGE');
  await assert.rejects(streamTile([Buffer.alloc(65537,65)],origin,'0',signal()),e=>e.code==='MAP_ROW');
});
test('truncated gzip and malformed final JSON are not accepted as partial results',async()=>{
  const bytes=gzipSync(JSON.stringify(feature())+'\n');await assert.rejects(streamTile([bytes.subarray(0,bytes.length-5)],origin,'0',signal()));
  await assert.rejects(streamTile([Buffer.from(JSON.stringify(feature())+'\n{bad')],origin,'0',signal()),e=>e.code==='MAP_FORMAT');
});
test('cancelled streaming reads do not return a late candidate',async()=>{
  const controller=new AbortController();controller.abort();await assert.rejects(streamTile([gzipSync(JSON.stringify(feature()))],origin,'0',controller.signal));
});
test('live-format regional response streams through provider including large announced size',async()=>{
  const calls=[],bytes=gzipSync(JSON.stringify(feature())+'\n');
  const provider=createMapProvider({lidar:async()=>({scan:null,note:'synthetic'}),fetcher:async(url)=>{
    calls.push(url);
    if(url.includes('postcodes.io'))return new Response(JSON.stringify({result:origin}));
    if(url===DATASET_INDEX)return new Response('Location,QuadKey,Url,Size\nUnitedKingdom,031313131,'+publicTile+',113.4MB');
    assert.equal(url,publicTile);
    return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=9)c.enqueue(bytes.subarray(i,i+9));c.close();}}),{headers:{'content-length':String(114*1024*1024)}});
  }});
  const result=await provider.lookup('Synthetic','RH1 1RT',signal());assert.ok(result.mapped);assert.equal(calls.length,3);
});
