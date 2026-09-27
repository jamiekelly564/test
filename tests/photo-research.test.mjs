import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createResearch } from '../apps/api/preview/research.mjs';
import { webImageCandidates } from '../apps/api/preview/web-photos.mjs';
import { defaultSpec } from '../packages/preview/model.mjs';
import { createPreviewApp } from '../apps/api/preview-server.mjs';
import { mapResearch } from '../apps/api/map-data/research.mjs';
import { candidateFeature, mappedFromCandidate } from '../packages/preview/map-shape.mjs';

const bytes=Buffer.from([137,80,78,71,13,10,26,10]);
const found={status:'completed',usage:{input_tokens:40,output_tokens:30},output:[{type:'web_search_call',status:'completed',action:{type:'search'},results:[{type:'image_result',image_url:'https://photos.example.org/redhill.jpg',source_website_url:'https://architect.example.org/queensgate-rh1-1rt',caption:'Queensgate, Redhill RH1 1RT exterior'}]},{type:'message',content:[{type:'output_text',text:'Exterior photograph of the named property.',annotations:[{type:'url_citation',url:'https://architect.example.org/queensgate-rh1-1rt',title:'Architect project'}]}]}]};
const photo=()=>({...webImageCandidates(found,{name:'Queensgate',postcode:'RH1 1RT'})[0],mime:'image/png',bytes});
const response=spec=>({status:'completed',usage:{input_tokens:40,output_tokens:30},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(spec)}]}]});
const reply=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
function mock({noPhotos=false,unused=false,failCheck=false}={}) {
  const payloads=[],progress=[];let loads=0;
  const research=createResearch({key:()=> 'synthetic-key',model:()=> 'synthetic-model',photos:async(_name,postcode)=>{assert.equal(postcode,'RH1 1RT');return [];},
    webPhotos:async candidates=>{loads++;assert.equal(candidates[0].imageUrl,photo().imageUrl);return {images:[photo()],attempts:[{id:photo().id,status:'loaded'}]};},
    fetcher:async(url,opts)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');const p=JSON.parse(opts.body);payloads.push(p);assert.equal(p.store,false);
      if(payloads.length===1)return reply(noPhotos?{...found,output:found.output.filter(o=>o.type==='message')}:found);
      if(payloads.length===3&&failCheck)return new Response(JSON.stringify({error:{code:'insufficient_quota',message:'secret provider text'}}),{status:429});
      const s=defaultSpec('Queensgate');s.matchBasis='likely';s.blocks[0].finish='render';s.blocks[0].roof='hip';s.blocks[0].roofHeight=2;
      s.usedPhotoIds=noPhotos||unused?['fabricated-photo']:[photo().id,'fabricated-photo'];s.facts=[{detail:'Light render is visible in the supplied facade photo.',sourceId:photo().id},{detail:'Invalid citation',sourceId:'made-up'}];return reply(response(s));
    }});
  return {research,payloads,progress,get loads(){return loads;},run:()=>research.run({name:'Queensgate',postcode:'RH1 1RT',spec:defaultSpec(),signal:new AbortController().signal,usage:{responses:0,searchCalls:0,inputTokens:0,outputTokens:0},onProgress:async p=>{progress.push(structuredClone(p));}})};
}
test('appearance research explicitly requests image results within the existing call budget',async()=>{
  const m=mock(),r=await m.run(),first=m.payloads[0];assert.deepEqual(first.tools[0].search_content_types,['image','text']);assert.equal(first.tools[0].image_settings.caption,true);assert.equal(first.tools[0].image_settings.max_results,12);assert.ok(first.include.includes('web_search_call.results'));assert.match(first.input,/Queensgate/);assert.match(first.input,/RH1 1RT/);assert.equal(m.payloads.length,3);assert.equal(first.max_tool_calls,8);assert.equal(m.payloads.reduce((n,p)=>n+p.max_output_tokens,0),24000);assert.equal(r.usage.responses,3);assert.equal(m.loads,1);
});
test('appearance and checking both receive actual photo bytes rather than just captions',async()=>{
  const m=mock();await m.run();for(const p of m.payloads.slice(1)){const images=p.input.flatMap(x=>x.content).filter(x=>x.type==='input_image');assert.equal(images.length,1);assert.equal(images[0].image_url,'data:image/png;base64,'+bytes.toString('base64'));assert.equal(images[0].detail,'high');}
});
test('photo usage, original source links and observed facts survive without image bytes or fabricated IDs',async()=>{
  const m=mock(),r=await m.run();assert.deepEqual(r.spec.usedPhotoIds,[photo().id]);assert.equal(r.spec.facts.length,1);assert.equal(r.visualResearch.used,1);assert.equal(r.visualResearch.analysed,1);assert.match(r.spec.summary,/Appearance uses 1 retrieved photo reference/);assert.equal(r.photos[0].bytes,undefined);assert.equal(r.photos[0].url,photo().url);assert.equal(r.photos[0].referenceOnly,true);assert.equal(r.usage.photoSearch.loaded,1);assert.doesNotMatch(JSON.stringify(r),/synthetic-key|base64/);
});
test('no retrieved photos yields explicit text-only appearance status',async()=>{
  const m=mock({noPhotos:true}),r=await m.run();assert.equal(m.loads,0);assert.equal(r.photos.length,0);assert.equal(r.visualResearch.used,0);assert.equal(r.visualResearch.analysed,0);assert.match(r.spec.summary,/No matching photograph was used/);assert.ok(m.payloads.slice(1).every(p=>p.input.every(x=>x.content.every(c=>c.type!=='input_image'))));assert.equal(r.spec.facts.length,0);
});
test('a rejected photo cannot supply facts or be counted as used',async()=>{
  const r=await mock({unused:true}).run();assert.equal(r.visualResearch.analysed,1);assert.equal(r.visualResearch.used,0);assert.equal(r.visualResearch.status,'no-matching-photos');assert.equal(r.spec.facts.length,0);assert.match(r.spec.summary,/No matching photograph/);
});
test('failed checking preserves a successful photo-informed progress state without paid retry',async()=>{
  const m=mock({failCheck:true});await assert.rejects(m.run(),e=>e.code==='insufficient_quota');assert.equal(m.payloads.length,3);const p=m.progress.find(p=>p.stage==='checking');assert.equal(p.spec.blocks[0].finish,'render');assert.equal(p.usage.photoSearch.used,1);assert.equal(p.photos[0].bytes,undefined);
});
test('preliminary photo search does not overwrite saved model sources before a new shape succeeds',async()=>{
  const m=mock();await m.run();for(const p of m.progress.filter(p=>!p.spec)){assert.equal(p.references,undefined);assert.equal(p.photos,undefined);}assert.ok(m.progress.find(p=>p.spec)?.photos.length);
});
function mappedFixture(){const origin={longitude:-.17,latitude:51.24};const feature={type:'Feature',properties:{height:12},geometry:{type:'Polygon',coordinates:[[[-.17,51.24],[-.1697,51.24],[-.1697,51.2402],[-.17,51.2402],[-.17,51.24]]]}};return mappedFromCandidate(candidateFeature(feature,origin,1),origin,{release:'2026-07-24'});}
test('mapped outline remains unchanged while photo-based facade and source status survive',async()=>{
  const m=mock(),mapped=mappedFixture(),progress=[];const r=await mapResearch(m.research,{enabled:()=>true,lookup:async()=>({mapped})}).run({name:'Queensgate',postcode:'RH1 1RT',spec:defaultSpec(),usage:{responses:0,inputTokens:0,outputTokens:0,searchCalls:0},signal:new AbortController().signal,onProgress:async p=>progress.push(p)});assert.deepEqual(r.spec.mapped.polygons,mapped.polygons);assert.equal(r.spec.blocks[0].finish,'render');assert.match(r.spec.summary,/Appearance uses 1/);assert.ok(r.references.some(r=>r.id==='map-ms'));assert.equal(r.usage.photoSearch.used,1);assert.ok(progress.filter(p=>p.photos).every(p=>p.spec));
});
test('real HTTP persists photo usage, serves status UI and never replays paid research on reads',async()=>{
  const m=mock(),root=mkdtempSync(join(tmpdir(),'pc-photo-api-')),app=createPreviewApp({dataDir:root,assetsDir:join(root,'none'),preview:{research:m.research}});
  try{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf,headers={cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
    const created=await fetch(base+'/api/previews',{method:'POST',headers,body:JSON.stringify({name:'Queensgate',postcode:'RH1 1RT',requestKey:randomUUID(),allowProcessing:true})});assert.equal(created.status,201);let p=await created.json();for(let n=0;p.status==='refining'&&n<100;n++){await new Promise(r=>setTimeout(r,5));p=await(await fetch(base+'/api/previews/'+p.id,{headers})).json();}
    assert.equal(p.status,'ready');assert.equal(p.meta.usage.photoSearch.used,1);assert.equal(p.meta.photos[0].bytes,undefined);assert.match(p.spec.summary,/Appearance uses 1/);for(let i=0;i<3;i++)await fetch(base+'/api/previews/'+p.id,{headers});assert.equal(m.payloads.length,3);assert.equal((await fetch(base+'/api/previews/'+p.id)).status,401);assert.match(await(await fetch(base+'/start')).text(),/photo-evidence-status/);
  }finally{await app.close();rmSync(root,{recursive:true,force:true});}
});
