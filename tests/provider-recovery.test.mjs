import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProviders } from '../apps/api/auto-model/providers.mjs';
import { ProviderError, readJson, retrySeconds, request } from '../apps/api/auto-model/network.mjs';
import { createApp } from '../apps/api/server.mjs';

const origin={latitude:51.24,longitude:-0.16,basis:'user-coordinate',postcode:'',label:'Synthetic test point'};
const fixture={elements:[{type:'way',id:991,tags:{building:'yes',name:'Synthetic fixture'},geometry:[
  {lat:51.2400,lon:-0.1600},{lat:51.2400,lon:-0.1598},{lat:51.2402,lon:-0.1598},{lat:51.2402,lon:-0.1600},{lat:51.2400,lon:-0.1600}
]}]};
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
const fail=async(p,code)=>{let caught;await assert.rejects(p,e=>{caught=e;return e instanceof ProviderError&&e.code===code;});return caught;};

for(const status of [500,502,503,504])test(`HTTP ${status} recovers with ONE sequential backup and preserves attribution`,async()=>{
  const calls=[];let active=0;
  const p=createProviders({fetcher:async(url,options)=>{
    assert.equal(++active,1);calls.push(url);
    assert.equal(options.redirect,'error');assert.equal(options.method,'POST');
    assert.match(options.headers['User-Agent'],/PropertyChecked/);assert.ok(options.signal instanceof AbortSignal);
    active--;return calls.length===1?json({},status):json(fixture);
  }});
  const result=await p.buildings(origin);
  assert.deepEqual(calls,['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']);
  assert.equal(result.candidates[0].id,'way/991');assert.equal(result.provider.fallback,true);
  assert.match(result.attribution.text,/OpenStreetMap/);assert.match(result.warnings.at(-1),/backup service/);
});

test('network timeout uses the backup but not another call to the same endpoint',async()=>{
  let calls=0;const p=createProviders({fetcher:async()=>{if(++calls===1)throw new DOMException('raw private URL','TimeoutError');return json(fixture);}});
  assert.equal((await p.buildings(origin)).provider.fallback,true);assert.equal(calls,2);
});

test('rate limits are not bypassed using a mirror; Retry-After blocks further calls',async()=>{
  let calls=0,clock=Date.now();
  const p=createProviders({now:()=>clock,fetcher:async()=>{calls++;return json({},429,{'retry-after':'90'});}});
  const error=await fail(p.buildings(origin),'RATE_LIMIT');assert.equal(calls,1);assert.equal(error.diagnostic.retryAfterSeconds,90);
  await fail(p.buildings(origin),'COOLDOWN');assert.equal(calls,1);
  clock+=91000;await fail(p.buildings(origin),'RATE_LIMIT');assert.equal(calls,2);
});

test('HTTP 406 from overpass-api.de is an access refusal, not a 30-second rate limit',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>{count++;return json({},406);}});
  const error=await fail(p.buildings(origin),'ACCESS_DENIED');assert.equal(count,1);
  assert.equal(error.diagnostic.httpStatus,406);assert.equal(error.diagnostic.retryAfterSeconds,0);
  assert.equal(error.diagnostic.actionRequired,true);assert.equal(error.transient,false);
  assert.doesNotMatch(error.message,/wait at least 30|asked us to pause/);
});

test('503 Retry-After is honoured without hitting a backup',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>{count++;return json({},503,{'retry-after':'120'});}});
  const error=await fail(p.buildings(origin),'UPSTREAM');assert.equal(count,1);assert.equal(error.diagnostic.retryAfterSeconds,120);
  await fail(p.buildings(origin),'COOLDOWN');assert.equal(count,1);
});

for(const status of [400,401,403,404])test(`HTTP ${status} is not retried against other servers`,async()=>{
  let count=0;const p=createProviders({fetcher:async()=>{count++;return json({},status);}});
  const error=await fail(p.buildings(origin),[401,403].includes(status)?'ACCESS_DENIED':'HTTP');
  assert.equal(count,1);assert.equal(error.diagnostic.httpStatus,status);
});

test('all failed services enter cooldown; repeated clicks do not create a retry storm',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>{count++;return json({},504);}});
  const error=await fail(p.buildings(origin),'UPSTREAM');assert.equal(count,2);assert.equal(error.diagnostic.attempts.length,2);
  await fail(p.buildings(origin),'COOLDOWN');assert.equal(count,2);
});

test('successful backup remains usable during the failed primary cooldown',async()=>{
  const hosts=[];const p=createProviders({fetcher:async(url)=>{hosts.push(new URL(url).hostname);return hosts.length===1?json({},504):json(fixture);}});
  await p.buildings(origin);await p.buildings(origin);
  assert.deepEqual(hosts,['overpass-api.de','overpass.private.coffee','overpass.private.coffee']);
});

test('a custom endpoint never sends coordinates to a public fallback',async()=>{
  const calls=[];const p=createProviders({overpassUrl:'https://licensed.example/api/private-key',fetcher:async(url)=>{calls.push(url);return json({},503);}});
  const error=await fail(p.buildings(origin),'UPSTREAM');assert.equal(calls.length,1);
  assert.equal(error.diagnostic.provider,'licensed.example');assert.ok(!JSON.stringify(error.diagnostic).includes('private-key'));
});

test('explicit trusted backup is supported and none disables the default backup',async()=>{
  const calls=[];const p=createProviders({overpassUrl:'https://one.example/api',fallbackUrl:'https://two.example/api',fetcher:async(url)=>{calls.push(url);return calls.length===1?json({},502):json(fixture);}});
  assert.equal((await p.buildings(origin)).provider.host,'two.example');assert.equal(calls.length,2);
  let count=0;await fail(createProviders({fallbackUrl:'none',fetcher:async()=>{count++;return json({},503);}}).buildings(origin),'UPSTREAM');assert.equal(count,1);
});

test('the same configured endpoint is never attempted twice',async()=>{
  let count=0;const p=createProviders({overpassUrl:'https://one.example/api',fallbackUrl:'https://one.example/api',fetcher:async()=>{count++;return json({},503);}});
  await fail(p.buildings(origin),'UPSTREAM');assert.equal(count,1);
});

test('HTTP 200 HTML recovers without executing or exposing the response body',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>++count===1?new Response('<script>secret-key</script>'):json(fixture)});
  assert.equal((await p.buildings(origin)).candidates.length,1);assert.equal(count,2);
});

test('partial Overpass results are discarded before fallback, not modelled or merged',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>++count===1?json({...fixture,remark:'private timeout body'}):json({elements:[]})});
  const result=await p.buildings(origin);assert.equal(result.candidates.length,0);assert.equal(count,2);
});

test('empty successful results are authoritative and do not trigger a fallback',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>{count++;return json({elements:[]});}});
  assert.equal((await p.buildings(origin)).candidates.length,0);assert.equal(count,1);
});

test('body-size and complexity safeguards stop recovery without inventing geometry',async()=>{
  let count=0;const p=createProviders({fetcher:async()=>{count++;return new Response('abc',{headers:{'content-length':'99999999'}});}});
  await fail(p.buildings(origin),'TOO_LARGE');assert.equal(count,1);
  await fail(createProviders({fetcher:async()=>json({elements:new Array(2501).fill({})})}).buildings(origin),'INVALID_DATA');
  await fail(readJson(new Response('123456'),3),'TOO_LARGE');
});

test('stream interruptions become safe transport diagnostics rather than HTTP 500',async()=>{
  const stream=new ReadableStream({start(controller){controller.error(new DOMException('https://secret.invalid/token','AbortError'));}});
  const error=await fail(readJson(new Response(stream),100,{stage:'footprints',provider:'example.test'}),'TIMEOUT');
  assert.ok(!error.message.includes('secret.invalid'));
});

test('DNS, TLS and connection errors identify the failed stage without leaking secrets',async()=>{
  for(const [cause,expected] of [['ENOTFOUND','DNS'],['SELF_SIGNED_CERT_IN_CHAIN','TLS'],['ECONNRESET','NETWORK']]){
    const error=await fail(createProviders({fetcher:async()=>{throw Object.assign(new Error('private-key'),{cause:{code:cause}});}}).resolve('RH2 9QQ'),expected);
    assert.equal(error.diagnostic.stage,'postcode');assert.equal(error.diagnostic.provider,'api.postcodes.io');assert.ok(!error.message.includes('private-key'));
  }
});

test('Maps HTTP failures identify link resolution and do not contact mapping providers',async()=>{
  const calls=[];const p=createProviders({fetcher:async(url)=>{calls.push(url);return json({},503);}});
  const error=await fail(p.resolve('https://maps.app.goo.gl/synthetic'),'UPSTREAM');
  assert.equal(error.diagnostic.stage,'maps');assert.match(error.message,/full Maps URL/);assert.equal(calls.length,1);
});

test('short link recovery never weakens redirect validation',async()=>{
  for(const location of ['https://127.0.0.1/private','https://user:password@www.google.com/maps/','https://evil.test/maps/']){
    const p=createProviders({fetcher:async()=>new Response('',{status:302,headers:{location}})});
    await assert.rejects(p.resolve('https://maps.app.goo.gl/synthetic'),/Only HTTPS Google Maps/);
  }
});

test('Retry-After supports numeric and HTTP-date values',()=>{
  assert.equal(retrySeconds('90'),90);assert.equal(retrySeconds('invalid'),0);
  assert.equal(retrySeconds('Wed, 01 Jan 2031 00:01:00 GMT',Date.parse('2031-01-01T00:00:00Z')),60);
});

test('real local HTTP failures exercise the fetch/read/backup path end to end',async()=>{
  const server=createServer((req,res)=>{if(req.url==='/primary'){res.writeHead(504);res.end('temporary overload');}else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixture));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const p=createProviders({fetcher:(url,opts)=>fetch(base+(new URL(url).hostname==='overpass-api.de'?'/primary':'/backup'),opts)});
    const result=await p.buildings(origin);assert.equal(result.candidates.length,1);assert.equal(result.provider.fallback,true);
    await fail(request(fetch,base+'/backup',{signal:AbortSignal.abort(new DOMException('timeout','TimeoutError'))},{stage:'footprints',provider:'test'}),'TIMEOUT');
  }finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});

test('HTTP API returns safe failure details and Retry-After only to an authorised client',async()=>{
  const root=mkdtempSync(join(tmpdir(),'pc-recovery-test-'));
  const providers=createProviders({fetcher:async()=>json({},429,{'retry-after':'60'})});
  const app=createApp({dataDir:root,assetsDir:join(root,'missing'),auto:{providers}});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    assert.equal((await fetch(base+'/api/auto/config')).status,401);
    const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],csrf=(await session.json()).csrf;
    const response=await fetch(base+'/api/auto/search',{method:'POST',headers:{cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify({input:'51.24, -0.16',allowExternal:true})});
    assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
    const data=await response.json();assert.equal(data.lookup.code,'RATE_LIMIT');assert.equal(data.lookup.stage,'footprints');assert.match(data.error,/location was found/);
    assert.ok(!JSON.stringify(data).includes('51.24'));
  }finally{await app.close();rmSync(root,{recursive:true,force:true});}
});
