import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoURL,photoType,webImageCandidates,createWebPhotoLoader,PHOTO_LIMITS } from '../apps/api/preview/web-photos.mjs';
const signal=()=>new AbortController().signal;
const png=(width=640,height=480,marker=0)=>{const b=Buffer.alloc(64,marker);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b;};
const result=(url='https://photos.example.org/queensgate.jpg',caption='Queensgate Redhill RH1 1RT exterior')=>({type:'image_result',image_url:url,source_website_url:'https://property.example.org/queensgate-redhill',caption});
const search=items=>({output:[{type:'web_search_call',status:'completed',results:items}]});
const http=(status,bytes=Buffer.from(''),headers={})=>({status,bytes,headers:new Headers(headers)});

test('image candidates use provider image_result fields, not invented URLs in prose',()=>{
  const data=search([result(),{type:'text_result',url:'https://example.org/a.jpg'}]);data.output.push({type:'message',content:[{type:'output_text',text:'https://example.org/fabricated.jpg'}]});
  const found=webImageCandidates(data,{name:'Queensgate',postcode:'RH1 1RT'});assert.equal(found.length,1);assert.match(found[0].id,/^web-photo-[a-f0-9]{16}$/);assert.equal(found[0].url,result().source_website_url);assert.equal(found[0].referenceOnly,true);
});
test('photo URLs reject private hosts, secrets, maps and search-engine image proxies',()=>{
  for(const url of ['http://example.org/a.jpg','https://127.0.0.1/a.jpg','https://user:pass@example.org/a.jpg','https://a.local/a.jpg','https://example.org/a.jpg?api_key=secret','https://example.org/a.jpg?key=secret','https://maps.googleapis.com/a.jpg','https://lh3.googleusercontent.com/a.jpg','https://t.bing.com/a.jpg','https://example.org/streetview/1.jpg'])assert.equal(photoURL(url),null,url);
  assert.equal(photoURL('https://photos.example.org/a.jpg?width=1024'),'https://photos.example.org/a.jpg?width=1024');assert.equal(webImageCandidates(search([{...result(),source_website_url:'https://maps.google.com'}])).length,0);
});
test('duplicate, interior, plan and map candidates are filtered before fetching',()=>{
  assert.equal(webImageCandidates(search([result(),result(),result('https://photos.example.org/b.jpg','Queensgate bedroom'),result('https://photos.example.org/c.jpg','Google Maps Queensgate'),result('https://photos.example.org/d.jpg','Queensgate floorplan')])).length,1);
});
test('full name and postcode rank photos but never establish verified identity',()=>{
  const items=[result('https://photos.example.org/a.jpg','Queensgate elsewhere'),result('https://photos.example.org/b.jpg','Queensgate RH1 1RT Redhill facade')];const found=webImageCandidates(search(items),{name:'Queensgate',postcode:'RH1 1RT'});assert.equal(found[0].imageUrl,items[1].image_url);assert.equal(found[0].verified,undefined);
});
test('image candidate metadata is bounded and stripped of markup',()=>{
  const found=webImageCandidates(search(Array.from({length:30},(_,i)=>result('https://photos.example.org/'+i+'.jpg','<script>bad</script>'+ 'A'.repeat(4000)))));assert.equal(found.length,12);assert.ok(found.every(p=>p.description.length<=500&&!p.title.includes('<')));
});
test('image signatures and dimensions are checked before AI transmission',()=>{
  assert.deepEqual(photoType(png()),{mime:'image/png',width:640,height:480});
  const jpeg=Buffer.alloc(40);Buffer.from([255,216,255,192,0,17,8,1,224,2,128]).copy(jpeg);assert.equal(photoType(jpeg).mime,'image/jpeg');
  const webp=Buffer.alloc(32);webp.write('RIFF');webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUIntLE(639,24,3);webp.writeUIntLE(479,27,3);assert.equal(photoType(webp).width,640);webp[20]=2;assert.equal(photoType(webp),null);
  for(const b of [Buffer.from('<html>not an image</html>'),png(100,100),png(9000,9000),Buffer.alloc(PHOTO_LIMITS.perImageBytes+1)])assert.equal(photoType(b),null);
});
test('loader checks source and image policy, returns actual bytes and safe metadata',async()=>{
  const calls=[];const r=await createWebPhotoLoader({request:async(url,opts)=>{calls.push({url,opts});return url.endsWith('robots.txt')?http(404):http(200,png());}})(webImageCandidates(search([result()])),signal());assert.equal(r.images.length,1);assert.equal(r.attempts[0].status,'loaded');assert.equal(r.images[0].bytes.length,64);assert.ok(calls.some(c=>c.url==='https://property.example.org/robots.txt'));assert.ok(calls.some(c=>c.url==='https://photos.example.org/robots.txt'));assert.ok(calls.every(c=>c.opts.signal));
});
test('robots disallow stops before downloading the photograph',async()=>{
  const calls=[];const r=await createWebPhotoLoader({request:async(url)=>{calls.push(url);return http(200,Buffer.from('User-agent: *\nDisallow: /'));}})(webImageCandidates(search([result()])),signal());assert.equal(r.images.length,0);assert.equal(calls.length,1);assert.equal(r.attempts[0].status,'policy-unavailable');
});
test('cross-host photo redirects are not followed',async()=>{
  const calls=[];const r=await createWebPhotoLoader({request:async(url)=>{calls.push(url);return url.endsWith('robots.txt')?http(404):http(302,Buffer.alloc(0),{location:'https://another.example.org/image.jpg'});}})(webImageCandidates(search([result()])),signal());assert.equal(r.images.length,0);assert.equal(r.attempts[0].status,'redirect-not-followed');assert.ok(!calls.some(u=>u.includes('another')));
});
test('same-host photo redirect rechecks the path policy',async()=>{
  const r=await createWebPhotoLoader({request:async(url)=>url.endsWith('robots.txt')?http(200,Buffer.from('User-agent: *\nDisallow: /private')):http(302,Buffer.alloc(0),{location:'/private/image.jpg'})})(webImageCandidates(search([result()])),signal());assert.equal(r.images.length,0);assert.equal(r.attempts[0].status,'policy-unavailable');
});
for(const status of [401,403,406,429])test('photo HTTP '+status+' is not retried on the same host',async()=>{
  let n=0;const r=await createWebPhotoLoader({request:async(url)=>{if(url.endsWith('robots.txt'))return http(404);n++;return http(status);}})(webImageCandidates(search([result(),result('https://photos.example.org/other.jpg')])),signal());assert.equal(n,1);assert.equal(r.images.length,0);
});
test('byte-identical photographs are transmitted only once',async()=>{
  const r=await createWebPhotoLoader({request:async(url)=>url.endsWith('robots.txt')?http(404):http(200,png())})(webImageCandidates(search([result(),result('https://photos.example.org/duplicate.jpg')])),signal());assert.equal(r.images.length,1);assert.equal(r.attempts[1].status,'duplicate');
});
test('photo count limits and cancellation are enforced',async()=>{
  let n=0;const load=createWebPhotoLoader({request:async(url)=>url.endsWith('robots.txt')?http(404):http(200,png(640,480,++n))});const r=await load(webImageCandidates(search(Array.from({length:12},(_,i)=>result('https://photos.example.org/'+i+'.jpg')))),signal());assert.equal(r.images.length,4);const c=new AbortController();c.abort();await assert.rejects(load(webImageCandidates(search([result()])),c.signal));
});
test('failed photo diagnostics do not expose raw exceptions',async()=>{
  const r=await createWebPhotoLoader({request:async()=>{throw new Error('PRIVATE-EXCEPTION-DETAILS');}})(webImageCandidates(search([result()])),signal());assert.doesNotMatch(JSON.stringify(r),/PRIVATE-EXCEPTION/);assert.equal(r.attempts[0].status,'unavailable');
});
test('HTML 404 for robots is absent policy, not an access challenge',async()=>{
  const r=await createWebPhotoLoader({request:async(url)=>url.endsWith('robots.txt')?http(404,Buffer.from('<html>Not found</html>'),{'content-type':'text/html'}):http(200,png())})(webImageCandidates(search([result()])),signal());assert.equal(r.images.length,1);
});
