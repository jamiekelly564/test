import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProviders } from '../apps/api/auto-model/providers.mjs';
import { checkStatus, request } from '../apps/api/auto-model/network.mjs';
import { createApp } from '../apps/api/server.mjs';

const point={latitude:51.24,longitude:-0.16};
const failure=(status,headers={})=>new Response('untrusted-body-secret',{status,headers});
const capture=async(p)=>{let error;await assert.rejects(p,e=>{error=e;return true;});return error;};

for(const status of [401,403,406])test(`a ${status} refusal stops further footprint requests in this provider session`,async()=>{
  let calls=0,clock=100000;
  const providers=createProviders({now:()=>clock,fetcher:async()=>{calls++;return failure(status);}});
  const first=await capture(providers.buildings(point));
  assert.equal(first.code,'ACCESS_DENIED');assert.equal(calls,1);
  clock+=86400000;
  const next=await capture(providers.buildings({...point,latitude:51.241}));
  assert.equal(calls,1);assert.equal(next.diagnostic.requestSuppressed,true);
  assert.equal(next.diagnostic.httpStatus,status);assert.equal(next.diagnostic.actionRequired,true);
  assert.equal(next.diagnostic.retryAfterSeconds,0);
  assert.doesNotMatch(JSON.stringify(next.diagnostic),/untrusted-body-secret|51\.24/);
});

test('a backup access refusal cannot be circumvented by waiting for the primary cooldown',async()=>{
  let calls=0,clock=100000;
  const providers=createProviders({now:()=>clock,fetcher:async()=>failure(++calls===1?503:403)});
  const first=await capture(providers.buildings(point));assert.equal(calls,2);
  assert.equal(first.diagnostic.provider,'overpass.private.coffee');
  clock+=120000;const next=await capture(providers.buildings(point));
  assert.equal(calls,2);assert.equal(next.diagnostic.attempts.length,2);
});

test('406 from another host is not asserted to be an Overpass access block or rate limit',async()=>{
  for(const stage of ['maps','postcode','footprints']){
    const error=await capture(checkStatus(failure(406),{stage,provider:'other.example'}));
    assert.equal(error.code,'NOT_ACCEPTABLE');assert.equal(error.status,502);
    assert.equal(error.diagnostic.retryAfterSeconds,0);assert.equal(error.transient,false);
    assert.equal(error.diagnostic.actionRequired,true);
  }
});

test('406 preserves a real Retry-After but still never fails over or resumes after the timer',async()=>{
  let calls=0,clock=100000;
  const providers=createProviders({now:()=>clock,fetcher:async()=>{calls++;return failure(406,{'retry-after':'120'});}});
  const error=await capture(providers.buildings(point));assert.equal(error.diagnostic.retryAfterSeconds,120);
  clock+=121000;await capture(providers.buildings(point));assert.equal(calls,1);
});

test('a configured provider receives its own request; access failures disclose only its host',async()=>{
  let calls=0;
  const providers=createProviders({overpassUrl:'https://approved.example/secret-path?api-key=secret-query',fetcher:async()=>{calls++;return failure(406);}});
  const error=await capture(providers.buildings(point));
  assert.equal(error.code,'NOT_ACCEPTABLE');assert.equal(error.diagnostic.provider,'approved.example');
  assert.doesNotMatch(JSON.stringify(error),/secret-path|secret-query|untrusted-body-secret/);
  await capture(providers.buildings(point));assert.equal(calls,1);
});

test('identifying application headers are transmitted by real fetch without pretending to be a browser',async()=>{
  let received;
  const server=createServer((req,res)=>{received=req.headers;res.setHeader('Content-Type','application/json');res.end('{}');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await request(fetch,`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data=test'});
    await response.json();
    assert.match(received['user-agent'],/^PropertyChecked-Local-Preview\//);
    assert.match(received['user-agent'],/github\.com\/jamiekelly564\/test/);
    assert.equal(received.accept,'application/json');assert.equal(received['content-type'],'application/x-www-form-urlencoded');
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});

test('an HTTP API 406 diagnosis returns no invented Retry-After or building and repeated clicks are suppressed',async()=>{
  const root=mkdtempSync(join(tmpdir(),'pc-access-test-'));let calls=0;
  const providers=createProviders({fetcher:async()=>{calls++;return failure(406);}});
  const app=createApp({dataDir:root,assetsDir:join(root,'missing'),auto:{providers}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf;
    for(let i=0;i<2;i++){
      const response=await fetch(base+'/api/auto/search',{method:'POST',headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify({input:'51.24, -0.16',allowExternal:true})});
      assert.equal(response.status,502);assert.equal(response.headers.get('retry-after'),null);
      const data=await response.json();assert.equal(data.lookup.code,'ACCESS_DENIED');assert.equal(data.lookup.httpStatus,406);
      assert.equal(data.lookup.retryAfterSeconds,0);assert.equal(data.lookup.actionRequired,true);
      assert.equal(data.candidates,undefined);assert.equal(data.model,undefined);
      if(i===1)assert.equal(data.lookup.requestSuppressed,true);
    }
    assert.equal(calls,1);
    const buildings=await (await fetch(base+'/api/buildings',{headers:{cookie}})).json();
    assert.equal(buildings.length,0);
  }finally{await app.close();rmSync(root,{recursive:true,force:true});}
});
