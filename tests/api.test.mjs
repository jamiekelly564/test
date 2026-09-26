import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';
import { request as httpRequest } from 'node:http';
let app,base,cookie,csrf,root,bid,taskId,docId;
const scope={tier:'silver',modules:['fire_doors','condition'],coverage:'Communal areas',preferredDate:'',notes:'No private flat entry',requestKey:'request-test-123456789'};
before(async()=>{
 root=mkdtempSync(join(tmpdir(),'propertychecked-test-'));const assets=join(root,'assets');mkdirSync(join(assets,'marketfield'),{recursive:true});
 writeFileSync(join(assets,'marketfield','manifest.json'),JSON.stringify({meta:{basis:'Test fixture only'},floors:[{key:'0'}],assets:[{id:'TEST-DOOR',title:'Test door',type:'door',floor:0,source:'TEST',basis:'estimated',summary:'Test location; no inspection.'}],sources:[]}));
 app=createApp({dataDir:join(root,'data'),assetsDir:assets});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
 const r=await fetch(base+'/api/session');cookie=r.headers.get('set-cookie').split(';')[0];csrf=(await r.json()).csrf;
});
after(async()=>{await app.close();rmSync(root,{recursive:true,force:true});});
async function call(path,method='GET',body,headers={}){const response=await fetch(base+path,{method,headers:{cookie,Origin:base,'X-CSRF-Token':csrf,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
test('unauthenticated API cannot read private buildings',async()=>{const r=await fetch(base+'/api/buildings');assert.equal(r.status,401);});
test('bad host prevents DNS rebinding',async()=>{const status=await new Promise((resolve,reject)=>{const req=httpRequest(base+'/',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(status,403);});
test('cross-site mutations are rejected',async()=>{const r=await call('/api/buildings','POST',{name:'Unsafe',postcode:'RH29QQ'},{Origin:'https://attacker.example'});assert.equal(r.status,403);});
test('missing CSRF is rejected',async()=>{const r=await call('/api/buildings','POST',{name:'Unsafe',postcode:'RH29QQ'},{'X-CSRF-Token':''});assert.equal(r.status,403);});
test('known demo asset metadata is imported, not assessed',async()=>{const r=await call('/api/buildings/marketfield/locations');assert.equal(r.status,200);assert.equal(r.data[0].review_status,'not_reviewed');assert.equal(r.data[0].basis,'estimated');});
test('postcode offline path is labelled format-only',async()=>{const r=await call('/api/postcodes/RH29QQ');assert.equal(r.status,200);assert.equal(r.data.verification,'format-only');assert.equal(r.data.postcode,'RH2 9QQ');});
test('create building persists a record without fake geometry',async()=>{const r=await call('/api/buildings','POST',{name:'Test Court',postcode:'RH29QQ',address:'Supplied test address'});assert.equal(r.status,201);bid=r.data.id;assert.equal(r.data.model_key,null);const get=await call('/api/buildings/'+bid);assert.equal(get.data.name,'Test Court');assert.equal(get.data.model,null);});
test('notes update uses optimistic concurrency',async()=>{const r=await call('/api/locations/TEST-DOOR','PATCH',{notes:'Check at next visit',reviewStatus:'site_check_needed',version:1});assert.equal(r.status,200);assert.equal(r.data.version,2);const stale=await call('/api/locations/TEST-DOOR','PATCH',{notes:'Stale edit',reviewStatus:'drawing_reviewed',version:1});assert.equal(stale.status,409);});
test('survey request is saved locally and retry is idempotent',async()=>{const first=await call(`/api/buildings/${bid}/surveys`,'POST',scope);assert.equal(first.status,201);assert.equal(first.data.status,'saved_locally');const duplicate=await call(`/api/buildings/${bid}/surveys`,'POST',scope);assert.equal(duplicate.status,200);assert.equal(first.data.id,duplicate.data.id);const clash=await call(`/api/buildings/${bid}/surveys`,'POST',{...scope,coverage:'Different scope'});assert.equal(clash.status,409);});
test('a location from another building cannot be attached',async()=>{const r=await call(`/api/buildings/${bid}/tasks`,'POST',{title:'Invalid link',locationId:'TEST-DOOR'});assert.equal(r.status,400);});
test('task lifecycle is persisted',async()=>{const r=await call(`/api/buildings/${bid}/tasks`,'POST',{title:'Arrange access',description:'Local test',priority:'normal'});assert.equal(r.status,201);taskId=r.data.id;const p=await call('/api/tasks/'+taskId,'PATCH',{status:'awaiting_review',version:1});assert.equal(p.status,200);assert.equal(p.data.status,'awaiting_review');const stale=await call('/api/tasks/'+taskId,'PATCH',{status:'closed',version:1});assert.equal(stale.status,409);});
test('HTML uploads are rejected even with an allowed-looking filename',async()=>{const r=await fetch(base+`/api/buildings/${bid}/documents`,{method:'POST',headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'X-File-Name':'test.pdf','Content-Type':'application/pdf'},body:'<script>alert(1)</script>'});assert.equal(r.status,415);});
test('valid file upload is stored, served as attachment and exported as metadata',async()=>{const data='%PDF-1.4\n% test fixture';const r=await fetch(base+`/api/buildings/${bid}/documents`,{method:'POST',headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'X-File-Name':'test.pdf','Content-Type':'application/pdf'},body:data});assert.equal(r.status,201);docId=(await r.json()).id;const d=await fetch(base+'/api/documents/'+docId,{headers:{cookie}});assert.equal(d.status,200);assert.match(d.headers.get('content-disposition'),/^attachment/);assert.equal(await d.text(),data);});
test('workspace JSON export includes saved records but not binary files or secrets',async()=>{const r=await call(`/api/buildings/${bid}/export`);assert.equal(r.status,200);assert.equal(r.data.surveys.length,1);assert.equal(r.data.tasks.length,1);assert.equal(r.data.documents.length,1);assert.ok(r.data.events.length>=4);assert.equal(r.data.documents[0].storage_name,undefined);});
test('unknown API and invalid JSON produce clear errors',async()=>{assert.equal((await call('/api/no-such-route')).status,404);const r=await fetch(base+'/api/buildings',{method:'POST',headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:'broken JSON'});assert.equal(r.status,400);});
test('application module and CSS are served locally without external CDNs',async()=>{const r=await fetch(base+'/app.js');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);const html=await (await fetch(base+'/')).text();assert.ok(!html.includes('cdn.'));});
test('LAN mode requires the access code and rate limits bad guesses',async()=>{
 const lan=createApp({dbPath:':memory:',assetsDir:join(root,'nothing'),dataDir:join(root,'lan'),lan:true,accessCode:'known-private-test-code'});await new Promise(r=>lan.server.listen(0,'127.0.0.1',r));const u=`http://127.0.0.1:${lan.server.address().port}`;
 try{
  assert.equal((await(await fetch(u+'/api/session')).json()).authenticated,false);
  const good=await fetch(u+'/api/session',{method:'POST',headers:{Origin:u,'Content-Type':'application/json'},body:JSON.stringify({code:'known-private-test-code'})});assert.equal(good.status,200);
  const c=good.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(u+'/api/buildings',{headers:{cookie:c}})).status,200);
  for(let i=0;i<5;i++)assert.equal((await fetch(u+'/api/session',{method:'POST',headers:{Origin:u,'Content-Type':'application/json'},body:JSON.stringify({code:'wrong'})})).status,401);
  const blocked=await fetch(u+'/api/session',{method:'POST',headers:{Origin:u,'Content-Type':'application/json'},body:JSON.stringify({code:'wrong'})});assert.equal(blocked.status,429);
 }finally{await lan.close();}
});
