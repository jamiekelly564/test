import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPreviewApp} from '../apps/api/preview-server.mjs';
import {defaultSpec,validateSpec,previewModel,previewMeshes,previewGLB,PREVIEW_NOTICE} from '../packages/preview/model.mjs';
import {createResearch,createPhotoSearch,commonsCandidates,licenceAllowed,safeLink,apiFailure,ResearchError,RESEARCH_LIMITS} from '../apps/api/preview/research.mjs';

const offline={configured:()=>false};
const key=()=>crypto.randomUUID();
async function harness(research=offline,existingRoot){
  const root=existingRoot||mkdtempSync(join(tmpdir(),'pc-instant-test-'));
  const app=createPreviewApp({dataDir:root,assetsDir:join(root,'no-assets'),preview:{research}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf;
  const request=async(path,method='GET',body,auth=true)=>{const r=await fetch(base+path,{method,headers:auth?{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.text()};};
  return {app,base,root,request,close:async(remove=true)=>{await app.close();if(remove)rmSync(root,{recursive:true,force:true});}};
}
const input=(name='Synthetic Court')=>({name,postcode:'RH1 1RT',requestKey:key(),allowProcessing:true});
async function waitReady(h,id){for(let i=0;i<100;i++){const p=(await h.request('/api/previews/'+id)).data;if(p.status!=='refining')return p;await new Promise(r=>setTimeout(r,5));}throw new Error('preview never settled');}
function response(spec){return {status:'completed',usage:{input_tokens:100,output_tokens:30},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(spec)}]}]};}
const jsonResponse=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});

test('a no-evidence input produces real bounded geometry immediately, with no claimed survey',()=>{
  const spec=defaultSpec('Synthetic Court'),model=previewModel(spec),objects=previewMeshes(model);
  assert.ok(objects.length>100);assert.ok(objects.every(o=>o.extras.notSurveyed));assert.equal(spec.matchBasis,'unresolved');assert.match(model.provenance.status,/Illustrative/);
  assert.ok(!JSON.stringify(spec).includes('FD30'));assert.ok(model.volumes.every(v=>v.provenance.height.source==='estimated'));
});
for(const roof of ['flat','gable','hip'])test(roof+' roofs create valid matching viewer/export geometry',()=>{
  const s=defaultSpec();s.blocks[0].roof=roof;s.blocks[0].roofHeight=3;const m=previewModel(s),glb=previewGLB(s,{sources:[{url:'https://example.org/source'}]});
  const v=new DataView(glb.buffer);assert.equal(v.getUint32(0,true),0x46546c67);assert.equal(v.getUint32(8,true),glb.length);
  const doc=JSON.parse(new TextDecoder().decode(glb.slice(20,20+v.getUint32(12,true))));assert.equal(doc.meshes.length,previewMeshes(m).length);assert.match(doc.extras.status,/not surveyed/);
  assert.ok(previewMeshes(m).every(o=>o.positions.every(Number.isFinite)));if(roof!=='flat')assert.equal(m.roofs.length,1);
});
test('invalid geometry is rejected without executing extra AI fields',()=>{
  for(const [field,value] of [['floors',200],['width',NaN],['rotation',999],['columns',3.3]]){const s=defaultSpec();s.blocks[0][field]=value;assert.throws(()=>validateSpec(s));}
  const s=defaultSpec();s.run='malicious';assert.equal(validateSpec(s).run,undefined);
});
test('cutaway and isolated floors never fabricate rooms or change the saved specification',()=>{
  const s=defaultSpec(),before=JSON.stringify(s),m=previewModel(s,{floor:'2',cutaway:true,explode:true});
  assert.equal(JSON.stringify(s),before);assert.ok(m.volumes.every(v=>v.preview.level===2));assert.equal(m.roofs.length,0);assert.ok(m.volumes.every(v=>!['room','sensor','fire-door'].includes(v.preview.kind)));
});
test('extreme but valid estimates remain within the geometry budget',()=>{
  const s=defaultSpec();s.blocks[0].floors=25;s.blocks[0].width=100;s.blocks[0].depth=80;s.blocks[0].columns=12;s.blocks[0].balconies=true;
  const m=previewModel(s);assert.ok(m.volumes.length<=3000);assert.ok(previewMeshes(m).length>0);
});
test('start page and modules are served by the real app without a CDN',async()=>{const h=await harness();try{for(const p of ['/start','/instant.js','/instant.css','/modules/preview/model.mjs','/modules/preview/viewer.mjs'])assert.equal((await h.request(p)).status,200);const r=await h.request('/api/status');assert.equal(r.data.version,JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);assert.ok(r.data.features.length);}finally{await h.close();}});
test('preview API keeps host/session/CSRF boundaries',async()=>{const h=await harness();try{assert.equal((await h.request('/api/previews','GET',undefined,false)).status,401);assert.equal((await fetch(h.base+'/api/previews',{method:'POST',body:JSON.stringify(input()),headers:{'Content-Type':'application/json'}})).status,401);assert.equal((await h.request('/api/previews','POST',{...input(),allowProcessing:false})).status,400);}finally{await h.close();}});
test('first HTTP response contains a usable model even while research has not resolved',async()=>{
  let resolve;const job=new Promise(r=>resolve=r),h=await harness({configured:()=>true,run:async()=>job});
  try{const r=await h.request('/api/previews','POST',input());assert.equal(r.status,201);assert.equal(r.data.status,'refining');assert.ok(r.data.spec.blocks.length);assert.equal((await h.request('/api/previews/'+r.data.id)).status,200);
    resolve({spec:defaultSpec(),basis:'ai-estimated',message:'Done',references:[],photos:[],usage:{}});await waitReady(h,r.data.id);
  }finally{resolve?.({spec:defaultSpec(),basis:'ai-estimated',message:'Done',references:[],photos:[],usage:{}});await h.close();}
});
test('no key still saves a model, supports export and never calls a provider',async()=>{const h=await harness({configured:()=>false,run:()=>{throw new Error('should not run');}});try{const r=await h.request('/api/previews','POST',input());assert.equal(r.data.status,'ready');assert.equal(r.data.stage,'local');const exportRes=await h.request('/api/previews/'+r.data.id+'/model.glb');assert.equal(exportRes.status,200);assert.equal(exportRes.headers.get('content-type'),'model/gltf-binary');}finally{await h.close();}});
test('same property and repeated request keys do not create another paid job or building',async()=>{let calls=0;const h=await harness({configured:()=>true,run:async()=>{calls++;return {spec:defaultSpec(),basis:'ai-estimated',message:'Done',references:[],photos:[],usage:{}};}});try{const b=input(),a=(await h.request('/api/previews','POST',b)).data;await waitReady(h,a.id);const repeat=(await h.request('/api/previews','POST',input())).data;assert.equal(repeat.id,a.id);assert.equal((await h.request('/api/previews','POST',b)).data.id,a.id);assert.equal(calls,1);assert.equal(h.app.workspace.buildings().length,1);assert.equal((await h.request('/api/previews','POST',{...b,name:'Different'})).status,409);}finally{await h.close();}});
test('429 cannot take away the existing model and does not auto-retry',async()=>{let calls=0;const h=await harness({configured:()=>true,run:async()=>{calls++;throw new ResearchError('credit_balance_exhausted','Credits unavailable.');}});try{const p=(await h.request('/api/previews','POST',input())).data,r=await waitReady(h,p.id);assert.equal(r.status,'ready');assert.equal(r.stage,'fallback');assert.ok(r.spec.blocks.length);assert.equal(r.meta.error.code,'credit_balance_exhausted');await h.request('/api/previews/'+p.id);assert.equal(calls,1);}finally{await h.close();}});
test('failure of checking pass retains the successful first AI improvement',async()=>{const h=await harness({configured:()=>true,run:async({onProgress})=>{const s=defaultSpec();s.blocks[0].floors=7;await onProgress({spec:s,basis:'ai-estimated',stage:'checking',message:'Checking'});throw new ResearchError('INCOMPLETE','Check failed');}});try{const p=(await h.request('/api/previews','POST',input())).data,r=await waitReady(h,p.id);assert.equal(r.spec.blocks[0].floors,7);assert.equal(r.stage,'fallback');}finally{await h.close();}});
test('stop and edit prevent a late AI result from overwriting a user estimate',async()=>{
  let finish;const delayed=new Promise(r=>finish=r),h=await harness({configured:()=>true,run:async()=>delayed});
  try{const p=(await h.request('/api/previews','POST',input())).data;const s=defaultSpec();s.blocks[0].floors=2;const edit=await h.request('/api/previews/'+p.id,'PATCH',{version:p.version,spec:s});assert.equal(edit.status,200);
    finish({spec:defaultSpec(),basis:'ai-estimated',message:'Late',references:[],photos:[],usage:{}});await new Promise(r=>setTimeout(r,10));const final=(await h.request('/api/previews/'+p.id)).data;assert.equal(final.spec.blocks[0].floors,2);assert.equal(final.meta.basis,'user-adjusted-estimate');
  }finally{finish?.({spec:defaultSpec(),basis:'ai-estimated',message:'Late',references:[],photos:[],usage:{}});await h.close();}
});
test('stale edits are rejected and failed validation preserves the original model',async()=>{const h=await harness();try{const p=(await h.request('/api/previews','POST',input())).data;assert.equal((await h.request('/api/previews/'+p.id,'PATCH',{version:0,spec:p.spec})).status,409);const s=defaultSpec();s.blocks=[];assert.notEqual((await h.request('/api/previews/'+p.id,'PATCH',{version:p.version,spec:s})).status,200);assert.ok((await h.request('/api/previews/'+p.id)).data.spec.blocks.length);}finally{await h.close();}});
test('saved previews survive closing/reopening SQLite without paid work',async()=>{const h=await harness();const p=(await h.request('/api/previews','POST',input())).data;const root=h.root;await h.close(false);const next=await harness(offline,root);try{assert.equal((await next.request('/api/previews/'+p.id)).data.name,p.name);assert.equal(next.app.workspace.locations(p.building_id).length,0);}finally{await next.close();}});
for(const code of ['credit_balance_exhausted','insufficient_quota','project_spend_limit_exceeded','organization_spend_limit_exceeded','rate_limit_exceeded'])test('safe API diagnostics recognise '+code,()=>{const e=apiFailure(429,{error:{code,message:'DO-NOT-LEAK-A-KEY'}},'60');assert.equal(e.code,code);assert.equal(e.retryAfterSeconds,60);assert.ok(!e.message.includes('DO-NOT'));});
test('unknown provider code and message cannot leak raw secrets',()=>{const e=apiFailure(400,{error:{code:'secret-credential',message:'secret-credential'}},null);assert.equal(e.code,'HTTP_400');assert.ok(!e.message.includes('secret-credential'));});
test('public references reject IPs, credentials, signed URLs and Google Maps content',()=>{for(const u of ['http://example.org','https://127.0.0.1/x','https://secret:pw@example.org/x','https://example.org/x?token=abc','https://maps.google.com/maps/','https://example.local/file'])assert.equal(safeLink(u),null);assert.equal(safeLink('https://example.org/building'),'https://example.org/building');});
test('automatic photo licensing accepts reusable variants but not NC, ND or unknown',()=>{assert.equal(licenceAllowed('https://creativecommons.org/licenses/by-sa/4.0/'),true);assert.equal(licenceAllowed('https://creativecommons.org/publicdomain/zero/1.0/'),true);for(const s of ['by-nc','by-nd','unknown'])assert.equal(licenceAllowed('https://creativecommons.org/licenses/'+s+'/4.0/'),false);});
const photoFixture=()=>({query:{pages:{12:{pageid:12,title:'File:Synthetic Court.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Test.jpg/1024px-Test.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Test.jpg',mime:'image/jpeg',extmetadata:{LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},LicenseShortName:{value:'CC BY-SA 4.0'},Artist:{value:'<b>Example creator</b>'},ImageDescription:{value:'<i>Building view</i>'}}}]}}}});
test('photo source metadata is stripped of HTML and foreign image hosts are rejected',()=>{const f=photoFixture(),p=commonsCandidates(f);assert.equal(p[0].artist,'Example creator');f.query.pages[12].imageinfo[0].thumburl='https://evil.example.com/image.jpg';assert.deepEqual(commonsCandidates(f),[]);});
test('photo discovery retrieves only fixed Commons API and validated image hosts',async()=>{const calls=[],photos=createPhotoSearch({fetcher:async(url)=>{calls.push(url);return calls.length===1?jsonResponse(photoFixture()):new Response(Buffer.from([255,216,255,0]));}});const result=await photos('Synthetic Court','RH1 1RT',new AbortController().signal);assert.equal(result.length,1);assert.equal(calls.length,2);assert.equal(new URL(calls[0]).hostname,'commons.wikimedia.org');assert.equal(result[0].id,'photo-12');});
test('research uses exactly three bounded passes, server credentials and actual cited IDs',async()=>{
  const payloads=[],s=defaultSpec();s.matchBasis='likely';s.facts=[{detail:'Four storeys described',sourceId:'web-1'},{detail:'Invented citation',sourceId:'fake'}];
  const research=createResearch({key:()=> 'synthetic-test-credential',model:()=> 'test-model',photos:async()=>[],fetcher:async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');const p=JSON.parse(opts.body);payloads.push(p);assert.equal(p.store,false);return jsonResponse(payloads.length===1?{status:'completed',usage:{input_tokens:20,output_tokens:10},output:[{type:'web_search_call',action:{type:'search'}},{type:'message',content:[{type:'output_text',text:'Four-storey block.',annotations:[{type:'url_citation',url:'https://example.org/building',title:'Example'}]}]}]}:response(s));}});
  const usage={responses:0,inputTokens:0,outputTokens:0,searchCalls:0},result=await research.run({name:'Synthetic Court',postcode:'RH1 1RT',spec:defaultSpec(),usage,signal:new AbortController().signal,onProgress:async()=>{}});
  assert.equal(payloads.length,3);assert.equal(payloads[0].max_tool_calls,8);assert.equal(payloads.reduce((n,p)=>n+p.max_output_tokens,0),24000);assert.equal(result.spec.facts.length,1);assert.equal(result.usage.searchCalls,1);assert.ok(!JSON.stringify(result).includes('synthetic-test-credential'));
});
test('empty research still builds a plausible estimate without pretending identity is known',async()=>{let n=0;const research=createResearch({key:()=> 'synthetic',photos:async()=>[],fetcher:async()=>jsonResponse(++n===1?{status:'completed',output:[]}:response(defaultSpec()))});const result=await research.run({name:'Unknown Court',postcode:'RH1 1RT',spec:defaultSpec(),usage:{responses:0,inputTokens:0,outputTokens:0,searchCalls:0},signal:new AbortController().signal,onProgress:async()=>{}});assert.equal(result.spec.matchBasis,'unresolved');assert.ok(result.spec.blocks.length);assert.match(result.spec.summary,/concept/);});
test('AI provider 429 is inspected once and never retried by this pipeline',async()=>{let n=0;const research=createResearch({key:()=> 'synthetic',photos:async()=>[],fetcher:async()=>{n++;return new Response(JSON.stringify({error:{code:'credit_balance_exhausted',message:'private'}}),{status:429});}});await assert.rejects(research.run({name:'A',postcode:'RH1 1RT',spec:defaultSpec(),usage:{responses:0,inputTokens:0,outputTokens:0,searchCalls:0},signal:new AbortController().signal,onProgress:async()=>{}}),e=>e.code==='credit_balance_exhausted');assert.equal(n,1);});