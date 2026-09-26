import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.mjs';
import { validateGraph,polygon,toModel,exportGLB } from '../packages/evidence/graph.mjs';
import { createEvidenceAI,safeReference } from '../apps/api/evidence/ai.mjs';

const fakeSource={id:'plan1',documentId:'doc1',rights:'owned',buildingConfirmed:true,mime:'image/png',scenario:'proposed',role:'floor-plan'};
const frame=()=>({schemaVersion:1,units:'metres',title:'Synthetic court',scenario:'proposed',scaleBasis:'dimensioned-drawing',scaleNote:'Synthetic 10 metre dimension.',alignment:'Common local origin at lift corner.',unknowns:['Facade unverified.'],conflicts:[],floors:[{id:'L0',label:'Ground',elevationM:0,heightM:3,verticalBasis:'estimated',sourceId:'plan1',page:1,note:'Synthetic floor height assumption.',components:[{id:'slab1',kind:'slab',label:'Floor plate',rings:[[[0,0],[10,0],[10,8],[0,8]],[[3,2],[3,4],[5,4],[5,2]]],bottomM:0,topM:.15,basis:'drawing',sourceId:'plan1',page:1,note:'Courtyard retained from synthetic source.',finish:'unknown',finishSourceId:null,finishPage:null},{id:'wall1',kind:'wall',label:'Wall',rings:[[[0,0],[10,0],[10,.2],[0,.2]]],bottomM:.15,topM:3,basis:'drawing',sourceId:'plan1',page:1,note:'Synthetic wall.',finish:'unknown',finishSourceId:null,finishPage:null}]}]});
const json=v=>({method:'POST',body:JSON.stringify(v),headers:{'Content-Type':'application/json'}});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+iK1sAAAAASUVORK5CYII=','base64');
const complete=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});

async function fixture(fn,ai){
  const dir=mkdtempSync(join(tmpdir(),'pc-evidence-')),app=createApp({dataDir:dir,assetsDir:join(dir,'none'),evidence:ai?{ai}:undefined});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf;
  const request=(path,options={})=>fetch(base+path,{...options,headers:{cookie,Origin:base,'X-CSRF-Token':csrf,...options.headers}});
  const bid=app.workspace.addBuilding({name:'Synthetic court',address:'Test only',postcode:'RH2 9QQ'}).id;
  const source=async(scenario='proposed',rights='owned',role='floor-plan',buildingId=bid)=>{
    const uploaded=await request(`/api/buildings/${buildingId}/documents`,{method:'POST',body:png,headers:{'Content-Type':'image/png','X-File-Name':'synthetic.png'}});assert.equal(uploaded.status,201);const doc=await uploaded.json();
    const response=await request(`/api/evidence/buildings/${buildingId}/sources`,json({documentId:doc.id,role,scenario,rights,rightsNote:'Synthetic fixture owned for tests',revision:'test-A',floorLabel:'Ground',buildingConfirmed:true}));assert.equal(response.status,201);return response.json();
  };
  const graph=s=>{const g=frame();g.floors[0].sourceId=s.id;g.floors[0].components.forEach(c=>c.sourceId=s.id);return g;};
  const job=async(id)=>{for(let i=0;i<100;i++){const j=await (await request('/api/evidence/jobs/'+id)).json();if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,5));}throw new Error('Job did not complete.');};
  try{await fn({app,dir,base,request,bid,source,graph,job});}finally{await app.close();rmSync(dir,{recursive:true,force:true});}
}

test('evidence graph keeps courtyard, small walls, named parts and actual GLB geometry',()=>{
  const g=validateGraph(frame(),[fakeSource]),m=toModel(g);assert.equal(m.volumes.length,2);assert.equal(m.volumes[0].rings.length,2);assert.equal(m.origin.georeferenced,false);
  const b=exportGLB(g);assert.equal(Buffer.from(b.subarray(0,4)).toString(),'glTF');const n=new DataView(b.buffer).getUint32(12,true);const doc=JSON.parse(new TextDecoder().decode(b.subarray(20,20+n)));assert.equal(doc.nodes.length,2);assert.equal(doc.extras.provenance.scenario,'proposed');assert.equal(doc.extras.provenance.components[0].sourceId,'plan1');
});
test('empty scale-unknown interpretation stores unknowns rather than invented geometry',()=>{const g={...frame(),floors:[],scaleBasis:'unknown',unknowns:['No legible scale.']};assert.equal(validateGraph(g,[fakeSource]).floors.length,0);assert.throws(()=>toModel(g),/no supported geometry/);});
test('scale must be established for metric geometry',()=>{const g=frame();g.scaleBasis='unknown';assert.throws(()=>validateGraph(g,[fakeSource]),/Establish scale/);});
test('source references are constrained to owned project evidence and cannot claim another scheme',()=>{for(const s of [{...fakeSource,rights:'pending'},{...fakeSource,buildingConfirmed:false},{...fakeSource,id:'wrong'},{...fakeSource,scenario:'existing'},{...fakeSource,role:'photo'}])assert.throws(()=>validateGraph(frame(),[s]));});
test('floors and components require unique identifiers and bounded finite heights',()=>{const g=frame();g.floors[0].components[1].id='slab1';assert.throws(()=>validateGraph(g,[fakeSource]),/unique/);g.floors[0].components[1].id='wall';g.floors[0].components[1].topM=Infinity;assert.throws(()=>validateGraph(g,[fakeSource]),/outside/);g.floors[0].components[1].topM=4;assert.throws(()=>validateGraph(g,[fakeSource]),/within their floor/);});
test('self intersections, overlapping/outside holes and malformed points rejected',()=>{for(const p of [[[[0,0],[4,4],[0,4],[4,0]]],[[[0,0],[10,0],[10,8],[0,8]],[[20,20],[21,20],[21,21],[20,21]]],[[[0,0],[10,0],[10,8],[0,8]],[[1,1],[5,1],[5,5],[1,5]],[[2,2],[3,2],[3,3],[2,3]]],[[[0,0],[10,0],[NaN,8],[0,8]]]])assert.throws(()=>polygon(p));});
test('image evidence cannot claim nonexistent page and finish requires own source',()=>{const g=frame();g.floors[0].page=3;assert.throws(()=>validateGraph(g,[fakeSource]),/source page/);g.floors[0].page=1;g.floors[0].components[0].finish='brick';assert.throws(()=>validateGraph(g,[fakeSource]),/source is unapproved/);});
test('cutaway/isolation and explosion do not mutate stored geometry',()=>{const g=frame(),before=JSON.stringify(g);const m=toModel(g,{cutaway:true});assert.ok(m.volumes[1].heightM<3);assert.equal(JSON.stringify(g),before);assert.equal(toModel(g,{floor:'L0'}).volumes.length,2);});
test('discovery accepts HTTPS references only and filters unsafe links',()=>{assert.equal(safeReference('javascript:alert(1)'),null);assert.equal(safeReference('https://user:secret@example.com/x'),null);assert.equal(safeReference('http://example.com'),null);assert.equal(safeReference('https://127.0.0.1/admin'),null);assert.equal(safeReference('https://example.gov.uk/planning'),'https://example.gov.uk/planning');});

test('local upload/register/trace/review/export cycle preserves original building model',async()=>fixture(async({app,request,bid,source,graph})=>{
 const s=await source();const g=graph(s),body={graph:g,requestKey:randomUUID()},before=app.workspace.building(bid).model_key;
 const saved=await request(`/api/evidence/buildings/${bid}/drafts`,json(body));assert.equal(saved.status,201);const d=await saved.json();assert.equal(d.review_state,'unreviewed');
 const repeat=await (await request(`/api/evidence/buildings/${bid}/drafts`,json(body))).json();assert.equal(repeat.id,d.id);
 const changed=await request(`/api/evidence/buildings/${bid}/drafts`,json({...body,graph:{...g,title:'Changed'}}));assert.equal(changed.status,409);
 const download=await request(`/api/evidence/buildings/${bid}/drafts/${d.id}/export.glb`);assert.equal(download.status,200);assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0,4).toString(),'glTF');
 const reviewed=await request(`/api/evidence/buildings/${bid}/drafts/${d.id}/review`,json({version:d.version,acknowledge:true}));assert.equal(reviewed.status,200);assert.equal((await reviewed.json()).review_state,'reviewed-not-surveyed');
 assert.equal((await request(`/api/evidence/buildings/${bid}/drafts/${d.id}/review`,json({version:d.version,acknowledge:true}))).status,409);assert.equal(app.workspace.building(bid).model_key,before);
}));

test('evidence routes require session and mutation CSRF',async()=>fixture(async({base,request,bid})=>{
 assert.equal((await fetch(base+'/api/evidence/config')).status,401);
 assert.equal((await fetch(base+`/api/evidence/buildings/${bid}`)).status,401);
 assert.equal((await request(`/api/evidence/buildings/${bid}/sources`,{...json({}),headers:{'Content-Type':'application/json','X-CSRF-Token':''}})).status,403);
 assert.equal((await request('/studio')).status,200);for(const path of ['/studio.js','/modules/evidence/graph.mjs','/modules/evidence/viewer.mjs','/modules/auto-model/viewer.mjs','/modules/auto-model/geometry.mjs'])assert.equal((await request(path)).status,200);
}));

test('source from another building cannot be attached or referenced in graph',async()=>fixture(async({app,request,bid,source,graph})=>{const other=app.workspace.addBuilding({name:'Other',address:'Other',postcode:'RH2 9QQ'}).id,s=await source('proposed','owned','floor-plan',other);assert.equal((await request(`/api/evidence/buildings/${bid}/sources`,json({documentId:s.documentId}))).status,400);assert.equal((await request(`/api/evidence/buildings/${bid}/drafts`,json({graph:graph(s),requestKey:randomUUID()}))).status,422);}));

test('permission pending, photo-only, missing consent and mixed scenarios stop before AI',async()=>{let calls=0;await fixture(async({request,bid,source})=>{const owned=await source(),pending=await source('proposed','pending'),existing=await source('existing'),photo=await source('unknown','owned','photo');const base={scenario:'proposed',allowExternal:true,buildingConfirmed:true,requestKey:randomUUID()};for(const b of [{...base,sourceIds:[owned.id],allowExternal:false},{...base,sourceIds:[pending.id]},{...base,sourceIds:[photo.id]},{...base,sourceIds:[existing.id,owned.id]}])assert.equal((await request(`/api/evidence/buildings/${bid}/reconstruct`,json(b))).status,400);assert.equal(calls,0);},{reconstruct:async()=>{calls++;}});});

test('explicit AI job creates persisted validated draft, deduplicates retries and survives reload',async()=>{
 let calls=0;await fixture(async({request,bid,source,job})=>{const s=await source(),input={sourceIds:[s.id],scenario:'proposed',allowExternal:true,buildingConfirmed:true,requestKey:randomUUID()};const started=await (await request(`/api/evidence/buildings/${bid}/reconstruct`,json(input))).json();const done=await job(started.id);assert.equal(done.status,'succeeded');const repeated=await (await request(`/api/evidence/buildings/${bid}/reconstruct`,json(input))).json();assert.equal(repeated.id,started.id);assert.equal(calls,1);const d=await (await request(`/api/evidence/buildings/${bid}/drafts/${done.result.draftId}`)).json();assert.equal(d.method,'openai:test-model');assert.equal(d.graph.floors[0].sourceId,s.id);},{reconstruct:async({sources})=>{calls++;const g=frame();g.floors[0].sourceId=sources[0].id;g.floors[0].components.forEach(c=>c.sourceId=sources[0].id);return {graph:g,model:'test-model'};}});
});

test('invalid AI references fail job without saving a partial building',async()=>fixture(async({request,bid,source,job})=>{const s=await source();const started=await (await request(`/api/evidence/buildings/${bid}/reconstruct`,json({sourceIds:[s.id],scenario:'proposed',allowExternal:true,buildingConfirmed:true,requestKey:randomUUID()}))).json();assert.equal((await job(started.id)).status,'failed');assert.equal((await (await request(`/api/evidence/buildings/${bid}`)).json()).drafts.length,0);},{reconstruct:async()=>({graph:frame(),model:'test-model'})}));

test('changed stored bytes stop reconstruction before transmitting to AI',async()=>{let calls=0;await fixture(async({app,dir,request,bid,source,job})=>{const s=await source();writeFileSync(join(dir,'uploads',app.workspace.document(s.documentId).storage_name),'modified');const started=await (await request(`/api/evidence/buildings/${bid}/reconstruct`,json({sourceIds:[s.id],scenario:'proposed',allowExternal:true,buildingConfirmed:true,requestKey:randomUUID()}))).json();const done=await job(started.id);assert.equal(done.status,'failed');assert.match(done.error,/changed on disk/);assert.equal(calls,0);},{reconstruct:async()=>{calls++;}});});

test('AI request has explicit files, fixed endpoint, strict schema, no storage or extra tools',async()=>{
 let payload;const client=createEvidenceAI({key:()=> 'synthetic-secret',model:()=> 'test-model',fetcher:async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(opts.redirect,'error');payload=JSON.parse(opts.body);return new Response(JSON.stringify(complete(JSON.stringify(frame()))));}});
 const sources=[{...fakeSource,title:'plan.pdf',mime:'application/pdf'},{...fakeSource,id:'photo1',title:'photo.png',role:'photo'}];
 await client.reconstruct({title:'Test',scenario:'proposed',notes:'untrusted data',sources,buffers:[Buffer.from('%PDF-1.4'),png]});assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.tools,undefined);assert.equal(payload.input[0].content.filter(c=>c.type==='input_file').length,1);assert.equal(payload.input[0].content.filter(c=>c.type==='input_image').length,1);
});
test('no-key, refusal, truncated output and HTTP errors fail without leaking provider text',async()=>{
 await assert.rejects(createEvidenceAI({key:()=>''}).discover({query:'Test'}),/not connected/);
 for(const value of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal',refusal:'secret'}]}]}])await assert.rejects(createEvidenceAI({key:()=> 'test',fetcher:async()=>new Response(JSON.stringify(value))}).discover({query:'Test'}),/could not complete/);
 await assert.rejects(createEvidenceAI({key:()=> 'test',fetcher:async()=>new Response('secret raw provider response',{status:401})}).discover({query:'Test'}),e=>e.message.includes('HTTP 401')&&!e.message.includes('secret raw'));
});
test('discovery keeps only actual URL citations, not invented URLs in model prose',async()=>{let payload;const data=complete('Candidate, not verified https://madeup.invalid');data.output[0].content[0].annotations=[{type:'url_citation',url:'https://council.gov.uk/plan',title:'Planning reference'},{type:'url_citation',url:'javascript:alert(1)',title:'Bad'}];const ai=createEvidenceAI({key:()=> 'test',fetcher:async(u,o)=>{payload=JSON.parse(o.body);return new Response(JSON.stringify(data));}});const r=await ai.discover({query:'Synthetic',domain:'council.gov.uk'});assert.equal(r.references.length,1);assert.equal(payload.tools[0].filters.allowed_domains[0],'council.gov.uk');assert.equal(payload.input.includes('base64'),false);});

test('cancelled job is not saved and cannot charge again using the same retry key',async()=>{
 let calls=0;await fixture(async({request,bid,source,job})=>{const s=await source(),body={sourceIds:[s.id],scenario:'proposed',allowExternal:true,buildingConfirmed:true,requestKey:randomUUID()};const start=await (await request(`/api/evidence/buildings/${bid}/reconstruct`,json(body))).json();await request('/api/evidence/jobs/'+start.id+'/cancel',json({}));assert.equal((await job(start.id)).status,'cancelled');const again=await (await request(`/api/evidence/buildings/${bid}/reconstruct`,json(body))).json();assert.equal(again.id,start.id);assert.ok(calls<=1);assert.equal((await (await request(`/api/evidence/buildings/${bid}`)).json()).drafts.length,0);},{reconstruct:async(args,signal)=>{calls++;return new Promise((resolve,reject)=>{if(signal.aborted)reject(new Error('Cancelled'));else signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true});});}});
});

test('restarting evidence storage marks running jobs interrupted without external retries',async()=>{
 const { openWorkspace }=await import('../apps/api/database.mjs');const { evidenceStore }=await import('../apps/api/evidence/store.mjs');const dir=mkdtempSync(join(tmpdir(),'pc-evidence-restart-'));
 let ws=openWorkspace(join(dir,'workspace.sqlite'),join(dir,'none'));let store=evidenceStore(ws);const bid=ws.addBuilding({name:'Synthetic',address:'',postcode:'RH2 9QQ'}).id;
 const job=store.startJob(bid,'discover',randomUUID(),'synthetic-hash');ws.close();ws=openWorkspace(join(dir,'workspace.sqlite'),join(dir,'none'));store=evidenceStore(ws);assert.equal(store.job(job.id).status,'interrupted');assert.match(store.job(job.id).error,/not retried/);ws.close();rmSync(dir,{recursive:true,force:true});
});

test('graph drops unrecognised output fields instead of executing or using them',()=>{const g=frame();g.script='dangerous()';g.floors[0].components[0].fireRating='FD60';const out=validateGraph(g,[fakeSource]);assert.equal(out.script,undefined);assert.equal(out.floors[0].components[0].fireRating,undefined);});

test('review cannot promote unsupported empty reconstruction',async()=>fixture(async({request,bid,source,graph})=>{const s=await source(),g=graph(s);g.floors=[];g.scaleBasis='unknown';const d=await (await request(`/api/evidence/buildings/${bid}/drafts`,json({graph:g,requestKey:randomUUID()}))).json();assert.equal((await request(`/api/evidence/buildings/${bid}/drafts/${d.id}/review`,json({version:d.version,acknowledge:true}))).status,422);assert.equal((await request(`/api/evidence/buildings/${bid}/drafts/${d.id}/export.glb`)).status,422);}));
