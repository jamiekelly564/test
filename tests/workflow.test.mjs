import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.mjs';
import { publicURL,publicIPv4,robotsAllow,documentDownloader,fileType } from '../apps/api/evidence/download.mjs';
import { assembleDrafts } from '../packages/evidence/assemble.mjs';
import { saveAIConfig } from '../scripts/setup-ai.mjs';
import { checkAccount } from '../apps/api/evidence/account.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
function graph(source,label='Ground',elevation=0){return {schemaVersion:1,units:'metres',title:'Synthetic test building',scenario:'existing',scaleBasis:'user-calibrated',scaleNote:'Synthetic 10 metre dimension.',alignment:'Synthetic shared origin.',unknowns:['Site condition unknown.'],conflicts:[],floors:[{id:'floor',label,elevationM:elevation,heightM:3,verticalBasis:'estimated',sourceId:source.id,page:1,note:'Synthetic floor.',components:[{id:'slab',kind:'slab',label:'Synthetic slab',rings:[[[0,0],[10,0],[10,8],[0,8]]],bottomM:0,topM:.2,basis:'user-traced',sourceId:source.id,page:1,note:'Test only.',finish:'unknown',finishSourceId:null,finishPage:null}]}]};}
const source={id:'source1',documentId:'doc1',rights:'owned',buildingConfirmed:true,scenario:'existing',mime:'image/png',role:'floor-plan',sha256:'hash'};
const response=(status,bytes='',headers={})=>({status,bytes:Buffer.from(bytes),headers:new Headers(headers)});

test('document URL validation rejects internal hosts, IP literals, credentials, signed links and Maps imagery',()=>{
  for(const u of ['http://example.com/a.pdf','https://127.0.0.1/a','https://[::1]/a','https://localhost/a','https://machine.local/a','https://user:pass@example.com/a','https://example.com:8443/a','https://maps.google.com/a','https://maps.app.goo.gl/a','https://example.com/a?token=secret'])assert.throws(()=>publicURL(u));
  assert.equal(publicURL('https://planning.example.com/a.pdf#page=2').href,'https://planning.example.com/a.pdf');
});
test('DNS pinning predicate rejects private, loopback, link-local, reserved and mapped IP space',()=>{for(const a of ['10.1.1.1','127.1.2.3','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','198.18.0.1','203.0.113.1','224.0.0.1','::ffff:127.0.0.1'])assert.equal(publicIPv4(a),false,a);assert.equal(publicIPv4('8.8.8.8'),true);});
test('robots honours agent specificity, path specificity, wildcards and allow ties',()=>{
  assert.equal(robotsAllow('User-agent: *\nDisallow: /private\nAllow: /private/approved','/private/no.pdf'),false);
  assert.equal(robotsAllow('User-agent: *\nDisallow: /private\nAllow: /private/approved','/private/approved/a.pdf'),true);
  assert.equal(robotsAllow('User-agent: OtherBot\nDisallow: /','/a.pdf'),true);
  assert.equal(robotsAllow('User-agent: *\nDisallow: /\nUser-agent: PropertyChecked\nAllow: /','/a.pdf'),true);
  assert.equal(robotsAllow('User-agent: *\nDisallow: /*.pdf$','/a.pdf'),false);
});
test('approved direct download checks robots first and returns real file bytes',async()=>{const calls=[];const download=documentDownloader({request:async u=>{calls.push(u);return u.endsWith('robots.txt')?response(404):response(200,png);}});const r=await download('https://planning.example.com/floor.png');assert.equal(r.mime,'image/png');assert.equal(calls.length,2);});
test('robots refusal stops before downloading a document',async()=>{let count=0;await assert.rejects(documentDownloader({request:async()=>{count++;return response(200,'User-agent: *\nDisallow: /');}})('https://planning.example.com/a.pdf'),/disallows/);assert.equal(count,1);});
for(const status of [401,403,406,429,503])test(`document HTTP ${status} is not retried or sent to a mirror`,async()=>{let count=0;await assert.rejects(documentDownloader({request:async u=>{count++;return u.endsWith('robots.txt')?response(404):response(status);}})('https://planning.example.com/a.pdf'),new RegExp('HTTP '+status));assert.equal(count,2);});
test('cross-host redirects, HTML pages and malformed file signatures fail safely',async()=>{
  await assert.rejects(documentDownloader({request:async u=>u.endsWith('robots.txt')?response(404):response(302,'',{location:'https://other.example.com/a.pdf'})})('https://planning.example.com/a.pdf'),/different host/);
  await assert.rejects(documentDownloader({request:async u=>u.endsWith('robots.txt')?response(404):response(200,'<html>login</html>')})('https://planning.example.com/a.pdf'),/web page/);assert.throws(()=>fileType(Buffer.from('nope')));
});
test('AI setup preserves other environment settings and rejects newline injection',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pc-env-'));try{const path=join(root,'.env');await writeFile(path,'PORT=3100\nOTHER=keep\nOPENAI_API_KEY=old\n');await saveAIConfig(path,'sk-synthetic-key-do-not-use','gpt-6-astra');const data=await readFile(path,'utf8');assert.match(data,/PORT=3100/);assert.match(data,/OTHER=keep/);assert.equal((data.match(/OPENAI_API_KEY=/g)||[]).length,1);await assert.rejects(saveAIConfig(path,'sk-key\nEVIL=1','gpt-6-astra'));}finally{await rm(root,{recursive:true,force:true});}
});
test('account check calls only fixed models endpoint and does not submit files or inference',async()=>{let opts,url;const result=await checkAccount({key:'synthetic',model:'gpt-6-astra',fetcher:async(u,o)=>{url=u;opts=o;return new Response('{}');}});assert.equal(url,'https://api.openai.com/v1/models/gpt-6-astra');assert.equal(opts.body,undefined);assert.equal(result.accountAccessChecked,true);assert.equal(JSON.stringify(result).includes('synthetic'),false);await assert.rejects(checkAccount({key:'x',model:'bad/model'}));});
test('draft assembly preserves dimensions, applies explicit transforms and prefixes component IDs',()=>{const a={graph:graph(source),sources:[source]},b={graph:graph(source,'First'),sources:[source]};const r=assembleDrafts([a,b],[{x:0,y:0,z:0,rotation:0},{x:10,y:5,z:3,rotation:90}],{title:'Combined',alignmentNote:'Shared corner checked.'});assert.equal(r.graph.floors[1].elevationM,3);assert.deepEqual(r.graph.floors[1].components[0].rings[0][0],[10,5]);assert.equal(r.sources.length,1);assert.notEqual(r.graph.floors[0].components[0].id,r.graph.floors[1].components[0].id);});
test('assembly refuses duplicate floors, mixed drawing schemes and nonfinite transforms',()=>{const a={graph:graph(source),sources:[source]},p={x:0,y:0,z:0,rotation:0},opts={title:'Combined',alignmentNote:'checked'};assert.throws(()=>assembleDrafts([a,a],[p,p],opts),/Duplicate floor/);const b=structuredClone(a);b.graph.scenario='proposed';assert.throws(()=>assembleDrafts([a,b],[p,p],opts),/same/);b.graph.scenario='existing';b.graph.floors[0].label='First';assert.throws(()=>assembleDrafts([a,b],[p,{...p,x:NaN}],opts),/finite/);});

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'pc-workflow-'));let downloads=0,locationCalls=0;
  const app=createApp({dataDir:root,assetsDir:join(root,'no-models'),workflow:{download:async(url)=>{downloads++;return {bytes:png,url,mime:'image/png',extension:'.png'};},verifyAI:async()=>({accountAccessChecked:true}),resolveLocation:async()=>{locationCalls++;return {latitude:51.2,longitude:-.2,basis:'test'};}}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf;
  async function call(path,method='GET',body){const response=await fetch(base+path,{method,headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer();return {status:response.status,data,response};}
  const b=(await call('/api/buildings','POST',{name:'Synthetic block',address:'Test address',postcode:'RH2 9QQ'})).data;
  const url=part=>'/api/workflow/buildings/'+b.id+'/'+part,ev=part=>'/api/evidence/buildings/'+b.id+'/'+part;
  const importBody={url:'https://planning.example.com/plan.png',name:'plan.png',role:'floor-plan',scenario:'existing',rights:'owned',rightsNote:'Synthetic test material.',buildingConfirmed:true,allowExternal:true,requestKey:randomUUID()};
  async function add(){const r=await call(url('import'),'POST',importBody);assert.equal(r.status,201,JSON.stringify(r.data));return r.data.source;}
  async function draft(s){const r=await call(ev('drafts'),'POST',{requestKey:randomUUID(),graph:graph(s)});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});return {app,root,base,call,b,url,ev,importBody,add,draft,get downloads(){return downloads;},get locationCalls(){return locationCalls;}};
}
test('workflow APIs require a session, mutation CSRF and explicit external consent',async t=>{const f=await fixture(t);assert.equal((await fetch(f.base+'/api/workflow/config')).status,401);const r=await f.call(f.url('import'),'POST',{...f.importBody,allowExternal:false});assert.equal(r.status,400);assert.equal(f.downloads,0);assert.equal((await f.call('/api/workflow/ai/check','POST',{})).status,400);assert.equal((await f.call('/api/workflow/location','POST',{input:'test'})).status,400);assert.equal(f.locationCalls,0);});
test('location resolution does not invoke a building-footprint provider',async t=>{const f=await fixture(t);const r=await f.call('/api/workflow/location','POST',{input:'51.2, -.2',allowExternal:true});assert.equal(r.status,200);assert.equal(f.locationCalls,1);assert.match(r.data.notice,/No footprint/);});
test('import persists private files, preserves hashes and deduplicates successful retry',async t=>{const f=await fixture(t),s=await f.add();const again=await f.call(f.url('import'),'POST',f.importBody);assert.equal(again.data.source.id,s.id);assert.equal(again.data.duplicate,true);assert.equal(f.downloads,1);assert.equal(f.app.workspace.documents(f.b.id).length,1);const conflict=await f.call(f.url('import'),'POST',{...f.importBody,name:'other.png'});assert.equal(conflict.status,409);const preview=await f.call(f.url('sources/'+s.id+'/preview'));assert.equal(preview.status,200);assert.match(preview.response.headers.get('content-security-policy'),/sandbox/);});
test('pending permission and foreign-building source are rejected',async t=>{const f=await fixture(t);assert.equal((await f.call(f.url('import'),'POST',{...f.importBody,rights:'pending'})).status,400);assert.equal(f.downloads,0);const s=await f.add(),other=(await f.call('/api/buildings','POST',{name:'Other block',address:'Elsewhere',postcode:'RH2 9QQ'})).data;assert.equal((await f.call('/api/workflow/buildings/'+other.id+'/sources/'+s.id+'/preview')).status,404);});
test('review -> active workspace model -> restore retains original record, source and draft',async t=>{
  const f=await fixture(t),s=await f.add(),d=await f.draft(s);const activate={draftId:d.id,draftVersion:d.version,expectedVersion:0,acknowledge:true};
  assert.equal((await f.call(f.url('active'),'PUT',activate)).status,409);
  const reviewed=(await f.call(f.ev('drafts/'+d.id+'/review'),'POST',{version:d.version,acknowledge:true})).data;activate.draftVersion=reviewed.version;
  const saved=await f.call(f.url('active'),'PUT',activate);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.version,1);assert.equal(saved.data.draft.graph.floors.length,1);assert.equal(f.app.workspace.building(f.b.id).model_key,null);
  assert.equal((await f.call(f.url('active'),'PUT',activate)).data.duplicate,true);
  assert.equal((await f.call(f.url('active'),'DELETE',{expectedVersion:0})).status,409);
  assert.equal((await f.call(f.url('active'),'DELETE',{expectedVersion:1})).data.draft,null);
  assert.equal((await f.call(f.ev('drafts/'+d.id))).status,200);assert.equal(f.app.workspace.documents(f.b.id).length,1);
});
test('activation rejects changed source bytes instead of presenting a verified model',async t=>{const f=await fixture(t),s=await f.add(),d=await f.draft(s);const reviewed=(await f.call(f.ev('drafts/'+d.id+'/review'),'POST',{version:d.version,acknowledge:true})).data;const doc=f.app.workspace.document(s.documentId);await writeFile(join(f.root,'uploads',doc.storage_name),'tampered');const r=await f.call(f.url('active'),'PUT',{draftId:d.id,draftVersion:reviewed.version,expectedVersion:0,acknowledge:true});assert.equal(r.status,409);assert.match(r.data.error,/changed/);assert.equal((await f.call(f.url('active'))).data.draft,null);});
test('assembly endpoint requires alignment confirmation and refuses other-building drafts',async t=>{const f=await fixture(t);const r=await f.call(f.url('assemble'),'POST',{placements:[]});assert.equal(r.status,400);assert.match(r.data.error,/reference/);});
test('new builder, model panel and styles are served locally without CDN dependencies',async t=>{const f=await fixture(t);for(const path of ['/build','/build.js','/build.css','/model-panel.js','/model-panel.css'])assert.equal((await fetch(f.base+path)).status,200,path);});

test('workflow mutations reject missing CSRF even with a valid local session',async t=>{
  const f=await fixture(t),session=await fetch(f.base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];
  const response=await fetch(f.base+f.url('import'),{method:'POST',headers:{cookie,Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify(f.importBody)});
  assert.equal(response.status,403);assert.equal(f.downloads,0);
});
test('two separately prepared floors assemble through HTTP, require fresh review and export all geometry',async t=>{
  const f=await fixture(t),s=await f.add(),first=await f.draft(s);
  const second=(await f.call(f.ev('drafts'),'POST',{requestKey:randomUUID(),graph:graph(s,'First',0)})).data;
  const request={requestKey:randomUUID(),alignmentConfirmed:true,alignmentNote:'Same drawing corner; first floor offset 3 metres.',placements:[{draftId:first.id,x:0,y:0,z:0,rotation:0},{draftId:second.id,x:0,y:0,z:3,rotation:0}]};
  const r=await f.call(f.url('assemble'),'POST',request);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.review_state,'unreviewed');assert.equal(r.data.graph.floors.length,2);assert.equal(r.data.graph.floors[1].elevationM,3);
  const exportResult=await f.call(f.ev('drafts/'+r.data.id+'/export.glb'));assert.equal(exportResult.status,200);assert.equal(Buffer.from(exportResult.data).subarray(0,4).toString(),'glTF');
  assert.equal((await f.call(f.url('assemble'),'POST',request)).data.id,r.data.id);
});
test('assembly cannot attach a draft belonging to a different building',async t=>{
  const f=await fixture(t),s=await f.add(),d=await f.draft(s),other=(await f.call('/api/buildings','POST',{name:'Other',address:'Other address',postcode:'RH2 9QQ'})).data;
  const r=await f.call('/api/workflow/buildings/'+other.id+'/assemble','POST',{requestKey:randomUUID(),alignmentConfirmed:true,alignmentNote:'Test',placements:[{draftId:d.id,x:0,y:0,z:0,rotation:0},{draftId:randomUUID(),x:0,y:0,z:3,rotation:0}]});assert.equal(r.status,404);
});
test('building export contains the selected evidence model without exposing private file bytes',async t=>{
  const f=await fixture(t),s=await f.add(),d=await f.draft(s),reviewed=(await f.call(f.ev('drafts/'+d.id+'/review'),'POST',{version:d.version,acknowledge:true})).data;
  await f.call(f.url('active'),'PUT',{draftId:d.id,draftVersion:reviewed.version,expectedVersion:0,acknowledge:true});
  const output=(await f.call('/api/buildings/'+f.b.id+'/export')).data;assert.equal(output.evidenceModel.draft.id,d.id);assert.equal(output.evidenceModel.draft.sources[0].sha256,s.sha256);assert.ok(!JSON.stringify(output.evidenceModel).includes(png.toString('base64')));
  const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(f.root,'workspace.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT draft_id FROM evidence_active WHERE building_id=?').get(f.b.id).draft_id,d.id);}finally{db.close();}
});
test('same-host redirects work only when the new document path is allowed by robots',async()=>{
  let count=0;const r=await documentDownloader({request:async u=>{count++;return u.endsWith('robots.txt')?response(200,'User-agent: *\nDisallow: /private/'):u.endsWith('/a.pdf')?response(302,'',{location:'/approved.pdf'}):response(200,'%PDF-1.7\n');}})('https://planning.example.com/a.pdf');assert.equal(count,3);assert.equal(r.mime,'application/pdf');
  await assert.rejects(documentDownloader({request:async u=>u.endsWith('robots.txt')?response(200,'User-agent: *\nDisallow: /private/'):response(302,'',{location:'/private/a.pdf'})})('https://planning.example.com/a.pdf'),/disallows/);
});
