import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApp} from '../apps/api/server.mjs';
import {requestInput,catalogInput,footprintModel,planBatches,propertyKey,MAX_BATCH_BYTES} from '../apps/api/concierge/policy.mjs';
import {alignGraphs} from '../packages/concierge/alignment.mjs';

const digest=b=>createHash('sha256').update(b).digest('hex');
const input=(name='Synthetic Court',postcode='RH1 1RT')=>({name,postcode,requestKey:randomUUID(),allowProcessing:true});
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const pack=()=>({name:'Synthetic Court',postcode:'RH1 1RT',address:'Synthetic test address only',identityConfirmed:true,rightsConfirmed:true,rightsNote:'Created for automated tests only',aliases:[],sourceIds:[],remoteSources:[],footprint:{sourceUrl:'https://example.org/synthetic.geojson',attribution:'Synthetic owner',licence:'Synthetic test',retrievedAt:'2026-01-01',heightM:12,storeys:4,geometry:{type:'Polygon',coordinates:[[[0,51],[.0003,51],[.0003,51.0002],[0,51.0002],[0,51]]]}}});
function graph(source,{label='Ground',z=0,dx=0,dy=0,cores=true}={}){
 const c=(id,kind,rings,bottomM,topM)=>({id,kind,label:kind,rings,bottomM,topM,basis:'drawing',sourceId:source.id,page:1,note:'Synthetic dimensioned fixture',finish:'unknown',finishSourceId:null,finishPage:null});
 return {schemaVersion:1,units:'metres',title:'Synthetic Court',scenario:source.scenario,scaleBasis:'dimensioned-drawing',scaleNote:'Synthetic 20 metre dimension',alignment:'Synthetic shared cores',unknowns:['Not a survey'],conflicts:[],floors:[{id:'level',label,elevationM:z,heightM:3,verticalBasis:'drawing',sourceId:source.id,page:1,note:'Synthetic datum',components:[c('slab','slab',[rect(dx,dy,20,15)],0,.2),c('wall','wall',[rect(dx,dy,20,.2)],.2,3),...(cores?[c('lift','lift',[rect(dx+3,dy+4,2,2)],.2,3),c('stair','stair',[rect(dx+9,dy+4,3,5)],.2,3)]:[])]}]};
}
async function fixture(t,options={}){
 const root=mkdtempSync(join(tmpdir(),'pc-automatic-'));
 const app=createApp({dataDir:root,assetsDir:join(root,'assets'),concierge:{configured:()=>false,resolveLocation:async()=>({label:'Synthetic district'}),ai:{discover:async()=>{throw new Error('Unexpected AI call');},reconstruct:async()=>{throw new Error('Unexpected AI call');}},...options}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await app.close();rmSync(root,{recursive:true,force:true});});
 const response=await fetch(base+'/api/session'),cookie=response.headers.get('set-cookie').split(';')[0],csrf=(await response.json()).csrf;
 const call=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const building=(name='Synthetic Court',postcode='RH1 1RT')=>app.workspace.addBuilding({name,postcode,address:'Synthetic address'});
 async function source(bid,meta={}){
  const bytes=Buffer.from('%PDF-1.4\nSynthetic fixture '+randomUUID());
  const upload=await fetch(base+`/api/buildings/${bid}/documents`,{method:'POST',headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/pdf','X-File-Name':'Synthetic.pdf'},body:bytes});assert.equal(upload.status,201);const doc=await upload.json();
  const result=await call(`/api/evidence/buildings/${bid}/sources`,'POST',{documentId:doc.id,rights:'owned',rightsNote:'Synthetic test fixture',role:'floor-plan',scenario:'existing',floorLabel:'Ground',revision:'A',buildingConfirmed:true,...meta});assert.equal(result.status,201);return result.json();
 }
 const finish=async r=>{await app.concierge.idle();return app.concierge.get(r.id);};
 return {app,base,call,building,source,finish,root,service:app.concierge};
}

test('automatic request requires two bounded fields and processing consent',()=>{
 assert.equal(propertyKey('  SYNTHETIC Court ','rh11rt'),'RH1 1RT|synthetic court');
 for(const bad of [{...input(),name:''},{...input(),postcode:'bad'},{...input(),allowProcessing:false},{...input(),requestKey:'bad'}])assert.throws(()=>requestInput(bad));
});
test('approved catalogue validates permissions, URLs, source hashes and geometry',()=>{
 assert.throws(()=>catalogInput({...pack(),rightsConfirmed:false}));
 const bad=pack();bad.footprint.geometry.coordinates[0]=[];assert.throws(()=>catalogInput(bad));
 const outside=pack();outside.footprint.geometry.coordinates[0][1]=[999,51];assert.throws(()=>catalogInput(outside));
 assert.throws(()=>catalogInput({...pack(),remoteSources:[{url:'http://127.0.0.1/a',sha256:'bad'}]}));
 const m=footprintModel(catalogInput(pack()));assert.equal(m.attribution.text,'Synthetic owner');assert.equal(m.attribution.licence,'Synthetic test');assert.equal(m.volumes[0].heightM,12);assert.equal(m.volumes[0].provenance.height.source,'approved-data');
});
test('actual app serves the two-field start, staff queue and modules without a CDN',async t=>{
 const f=await fixture(t);
 for(const path of ['/start','/automatic.js','/automatic.css','/operations','/operations.js','/customer-entry.js'])assert.equal((await fetch(f.base+path)).status,200,path);
 const html=await(await fetch(f.base+'/start')).text();assert.match(html,/building-name/);assert.match(html,/Create my 3D building/);assert.ok(!html.includes('cdn.'));
 assert.match(await(await fetch(f.base+'/')).text(),/customer-entry.js/);
});
test('real session and CSRF guards protect automatic requests and operations',async t=>{
 const f=await fixture(t);assert.equal((await fetch(f.base+'/api/concierge/admin/queue')).status,401);
 assert.equal((await f.call('/api/concierge/requests','POST',input(),{'X-CSRF-Token':''})).status,403);
 assert.equal((await f.call('/api/concierge/requests','POST',{...input(),allowProcessing:false})).status,400);
});
test('approved footprint creates a real local model without AI or Overpass',async t=>{
 const f=await fixture(t);f.service.putPack(pack());const r=await f.finish(f.service.create(input()));assert.equal(r.status,'exterior_ready');assert.equal(r.call_count,0);
 const m=await f.service.model(r.id);assert.equal(m.model.volumes.length,1);assert.equal(f.app.workspace.buildings().length,1);
 const exported=await f.call(`/api/concierge/requests/${r.id}/model.glb`);assert.equal(exported.status,200);assert.equal(new DataView(await exported.arrayBuffer()).getUint32(0,true),0x46546c67);
});
test('repeated clicks and new retry keys reuse the existing property request',async t=>{
 const f=await fixture(t);f.service.putPack(pack());const a=f.service.create(input()),b=f.service.create(input('synthetic court','rh11rt'));assert.equal(a.id,b.id);await f.service.idle();assert.equal(f.service.create(input()).id,a.id);
 assert.throws(()=>f.service.create({...input('Other Court'),requestKey:f.service.get(a.id).input.requestKey}),/another building/);
});
test('catalogue replacement requires the correct optimistic version',async t=>{
 const f=await fixture(t);const p=f.service.putPack(pack());assert.equal(p.version,1);assert.throws(()=>f.service.putPack(pack()),/expectedVersion/);assert.equal(f.service.putPack({...pack(),expectedVersion:1}).version,2);
});
test('unknown property becomes a review request without fabricated geometry or a customer API form',async t=>{
 const f=await fixture(t),r=await f.finish(f.service.create(input()));assert.equal(r.status,'review_required');assert.equal(r.result,null);assert.match(r.private_note,/AI_SETUP/);
 const publicData=f.service.publicView(r);assert.ok(!('private_note' in publicData));assert.ok(!('refs' in publicData));assert.match(publicData.message,/local.*review queue/);
});
test('automatic planning search runs once and keeps citations in staff review',async t=>{
 let calls=0;const f=await fixture(t,{configured:()=>true,ai:{discover:async({query})=>{calls++;assert.match(query,/Synthetic Court/);assert.match(query,/RH1 1RT/);return {references:[{url:'https://example.org/planning',title:'Reference'},{url:'javascript:alert(1)',title:'Unsafe'}]};}}});
 const r=await f.finish(f.service.create(input()));assert.equal(calls,1);assert.equal(r.status,'review_required');assert.equal(r.refs.length,1);assert.match(r.private_note,/REFERENCES_REVIEW/);f.service.create(input());await f.service.idle();assert.equal(calls,1);
});
test('empty planning search ends visibly in staff review rather than continuing to spin',async t=>{
 const f=await fixture(t,{configured:()=>true,ai:{discover:async()=>({references:[]})}}),r=await f.finish(f.service.create(input()));assert.match(r.private_note,/NO_REFERENCES/);assert.equal(r.result,null);
});
test('ambiguous and postcode-missing matches require user confirmation before external calls',async t=>{
 const f=await fixture(t);f.building();f.building();const r=await f.finish(f.service.create(input()));assert.equal(r.status,'choosing');assert.equal(r.candidates.length,2);assert.equal(r.call_count,0);
 f.building('Old Record','');const other=await f.finish(f.service.create(input('Old Record')));assert.equal(other.status,'choosing');assert.equal(other.candidates.length,1);
});
test('candidate confirmation resumes the same request without creating a second building',async t=>{
 const f=await fixture(t),b=f.building('Synthetic Court',''),r=await f.finish(f.service.create(input()));
 assert.equal((await f.call(`/api/concierge/requests/${r.id}/choose`,'POST',{version:r.version,buildingId:'other',confirm:true})).status,400);
 assert.equal((await f.call(`/api/concierge/requests/${r.id}/choose`,'POST',{version:r.version,buildingId:b.id,confirm:true})).status,200);await f.service.idle();assert.equal(f.service.get(r.id).building_id,b.id);assert.equal(f.app.workspace.buildings().length,1);
});
test('approved drawings automatically produce an unreviewed source-linked preview',async t=>{
 let count=0;const f=await fixture(t,{configured:()=>true,ai:{reconstruct:async({sources,buffers})=>{count++;assert.ok(buffers[0].length);return {model:'synthetic-model',graph:graph(sources[0])};}}});const b=f.building();await f.source(b.id);
 const r=await f.finish(f.service.create(input()));assert.equal(r.status,'ready',r.private_note);assert.equal(count,1);assert.equal(r.building_id,b.id);assert.equal(r.review_needed,1);
 const d=await(await f.call(`/api/evidence/buildings/${b.id}/drafts/${r.result.draftId}`)).json();assert.equal(d.review_state,'unreviewed');assert.equal(f.app.workspace.building(b.id).model_key,null);assert.equal((await f.service.model(r.id)).model.volumes.length,4);
});
test('changed source bytes stop before transmission to AI',async t=>{
 let calls=0;const f=await fixture(t,{configured:()=>true,ai:{reconstruct:async()=>{calls++;}}}),b=f.building(),s=await f.source(b.id);const d=f.app.workspace.document(s.documentId);writeFileSync(join(f.root,'uploads',d.storage_name),'tampered');
 const r=await f.finish(f.service.create(input()));assert.equal(calls,0);assert.match(r.private_note,/SOURCE_CHANGED/);assert.equal(r.result,null);
});
test('unknown scale and conflicting drawings cannot be labelled model ready',async t=>{
 const f=await fixture(t,{configured:()=>true,ai:{reconstruct:async({sources})=>({model:'synthetic',graph:{...graph(sources[0]),scaleBasis:'unknown',floors:[]}})}}),b=f.building();await f.source(b.id);
 const r=await f.finish(f.service.create(input()));assert.equal(r.status,'review_required');assert.equal(r.result,null);assert.equal((await(await f.call(`/api/evidence/buildings/${b.id}`)).json()).drafts.length,1);
});
test('permission-pending evidence is not sent to AI',async t=>{
 let calls=0;const f=await fixture(t,{configured:()=>true,ai:{discover:async()=>({references:[]}),reconstruct:async()=>{calls++;}}}),b=f.building();await f.source(b.id,{rights:'pending'});await f.finish(f.service.create(input()));assert.equal(calls,0);
});
test('drawing scenario and revision conflicts are handled internally before charging',async t=>{
 const f=await fixture(t,{configured:()=>true}),b=f.building();await f.source(b.id,{revision:'A'});await f.source(b.id,{revision:'B'});const r=await f.finish(f.service.create(input()));assert.match(r.private_note,/REVISION_CONFLICT/);assert.equal(r.call_count,0);
 const p=f.building('Proposed Court');await f.source(p.id,{scenario:'proposed'});const proposed=await f.finish(f.service.create(input('Proposed Court')));assert.match(proposed.private_note,/PROPOSAL_ONLY/);assert.equal(proposed.call_count,0);
});
test('larger packs are batched by floor and byte-identical evidence is deduplicated',()=>{
 const sources=Array.from({length:8},(_,i)=>({id:String(i),sha256:String(i),rights:'owned',buildingConfirmed:true,role:'floor-plan',floorLabel:i<4?'Ground':'First',revision:'A',scenario:'existing',size:1024}));
 const plan=planBatches(sources);assert.deepEqual(plan.batches.map(x=>x.length),[4,4]);assert.equal(planBatches([sources[0],{...sources[0],id:'duplicate'}]).batches[0].length,1);assert.throws(()=>planBatches([{...sources[0],size:MAX_BATCH_BYTES+1}]),/too large/);
});
test('core alignment preserves source elevations and never changes the input drafts',()=>{
 const source={id:'source',scenario:'existing'},a=graph(source),b=graph(source,{label:'First',z:3,dx:40,dy:10}),before=JSON.stringify(b),result=alignGraphs([a,b]);
 assert.equal(result.floors.length,2);assert.equal(result.floors[1].elevationM,3);assert.deepEqual(result.floors[1].components[0].rings,result.floors[0].components[0].rings);assert.equal(JSON.stringify(b),before);
 assert.throws(()=>alignGraphs([a,graph(source,{label:'First',z:0})]),/elevation/);assert.throws(()=>alignGraphs([a,graph(source,{label:'First',z:3,cores:false})]),/unique/);
});
test('eight drawings automatically become two AI groups and one aligned 3D preview',async t=>{
 const calls=[];const f=await fixture(t,{configured:()=>true,ai:{reconstruct:async({sources})=>{calls.push(sources.length);const label=sources[0].floorLabel;return {model:'synthetic',graph:graph(sources[0],{label,z:label==='Ground'?0:3,dx:label==='Ground'?0:40})};}}}),b=f.building();for(let i=0;i<8;i++)await f.source(b.id,{floorLabel:i<4?'Ground':'First'});
 const r=await f.finish(f.service.create(input()));assert.equal(r.status,'ready',r.private_note);assert.deepEqual(calls,[4,4]);assert.equal((await f.service.model(r.id)).graph.floors.length,2);
});
test('foreign building source IDs cannot be used by a source pack',async t=>{
 const f=await fixture(t,{configured:()=>true}),b=f.building(),other=f.building('Other'),s=await f.source(other.id);await f.source(b.id);f.service.putPack({...pack(),footprint:null,sourceIds:[s.id]});const r=await f.finish(f.service.create(input()));assert.match(r.private_note,/SOURCE_MISSING/);assert.equal(r.call_count,0);
});
test('pinned remote source is registered once only after its exact hash matches',async t=>{
 const bytes=Buffer.from('%PDF-1.4\nSynthetic approved import');let downloads=0;
 const f=await fixture(t,{configured:()=>true,download:async url=>{downloads++;return {url,bytes};},ai:{reconstruct:async({sources})=>({model:'synthetic',graph:graph(sources[0])})}});
 f.service.putPack({...pack(),footprint:null,remoteSources:[{url:'https://example.org/plan.pdf',sha256:digest(bytes),name:'Plan.pdf',role:'floor-plan',scenario:'existing',floorLabel:'Ground',revision:'A'}]});
 const r=await f.finish(f.service.create(input()));assert.equal(r.status,'ready',r.private_note);assert.equal(downloads,1);assert.equal(f.app.workspace.documents(r.building_id).length,1);
 f.service.create(input());await f.service.idle();assert.equal(downloads,1);
});
test('remote source revision changes stop before registration and AI interpretation',async t=>{
 const f=await fixture(t,{configured:()=>true,download:async url=>({url,bytes:Buffer.from('%PDF-1.4 changed')})});f.service.putPack({...pack(),footprint:null,remoteSources:[{url:'https://example.org/plan.pdf',sha256:'a'.repeat(64),name:'Plan.pdf',role:'floor-plan',scenario:'existing',floorLabel:'Ground',revision:'A'}]});
 const r=await f.finish(f.service.create(input()));assert.match(r.private_note,/SOURCE_REVISION_CHANGED/);assert.equal(r.call_count,0);assert.equal(f.app.workspace.documents(r.building_id).length,0);
});
test('licensed exterior remains available while an interior processing error goes to staff',async t=>{
 const f=await fixture(t,{configured:()=>true,ai:{reconstruct:async()=>{throw new Error('untrusted raw response');}}}),b=f.building();await f.source(b.id);f.service.putPack(pack());const r=await f.finish(f.service.create(input()));assert.equal(r.status,'exterior_ready');assert.equal(r.review_needed,1);assert.ok(!r.private_note.includes('untrusted raw response'));
});
test('stale resume is rejected and staff can explicitly resume after adding approved data',async t=>{
 const f=await fixture(t);let r=await f.finish(f.service.create(input()));f.service.putPack(pack());assert.equal((await f.call(`/api/concierge/requests/${r.id}/resume`,'POST',{version:1,note:'stale',allowProcessing:true})).status,409);
 assert.equal((await f.call(`/api/concierge/requests/${r.id}/resume`,'POST',{version:r.version,note:'Approved catalogue checked',allowProcessing:true})).status,200);await f.service.idle();r=f.service.get(r.id);assert.equal(r.status,'exterior_ready');assert.equal(r.retries,1);
});
test('drawing QA is explicit, versioned and never a site-verification status',async t=>{
 const f=await fixture(t,{configured:()=>true,ai:{reconstruct:async({sources})=>({model:'synthetic',graph:graph(sources[0])})}}),b=f.building();await f.source(b.id);let r=await f.finish(f.service.create(input()));
 assert.equal((await f.call(`/api/concierge/requests/${r.id}/review`,'POST',{version:r.version,acknowledge:true,note:''})).status,400);
 assert.equal((await f.call(`/api/concierge/requests/${r.id}/review`,'POST',{version:r.version,acknowledge:true,note:'Checked source dimensions and unresolved items'})).status,200);r=f.service.get(r.id);assert.equal(r.review_needed,0);assert.equal(f.app.workspace.building(b.id).model_key,null);
});
test('cancelled work cannot save a late model or automatically charge again',async t=>{
 let begin;const started=new Promise(r=>begin=r);let calls=0;
 const f=await fixture(t,{configured:()=>true,ai:{discover:async(_arg,signal)=>{calls++;begin();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));}}});
 const created=f.service.create(input());await started;const r=f.service.get(created.id);assert.equal((await f.call(`/api/concierge/requests/${r.id}/cancel`,'POST',{version:r.version})).status,200);await f.service.idle();assert.equal(f.service.get(r.id).status,'cancelled');f.service.create(input());assert.equal(calls,1);
});
test('shutdown interrupts queued processing; reopening the database does not replay paid jobs',async t=>{
 let begin;const started=new Promise(r=>begin=r);let calls=0;
 const f=await fixture(t,{configured:()=>true,ai:{discover:async(_arg,signal)=>{calls++;begin();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));}}});const r=f.service.create(input());await started;await f.service.close();assert.equal(f.service.get(r.id).status,'review_required');assert.equal(calls,1);
});
test('successful model survives reopening the same SQLite database without API calls',async t=>{
 const f=await fixture(t);f.service.putPack(pack());const r=await f.finish(f.service.create(input()));
 const second=createApp({dataDir:f.root,assetsDir:join(f.root,'none'),concierge:{configured:()=>false}});try{assert.equal(second.concierge.get(r.id).status,'exterior_ready');assert.equal((await second.concierge.model(r.id)).model.volumes[0].heightM,12);}finally{await second.close();}
});
