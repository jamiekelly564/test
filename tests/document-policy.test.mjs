import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicURL, robotsAllow } from '../apps/api/evidence/download.mjs';

test('document policy rejects trailing-dot host aliases before DNS or fetching',()=>{
  for(const url of ['https://maps.google.com./a.png','https://localhost./a','https://planning.example.com./a.pdf'])assert.throws(()=>publicURL(url));
});
test('bounded robots matching preserves prefix, literal punctuation, wildcard and end-anchor semantics',()=>{
  for(const [pattern,path,allowed] of [['/x','/xyz',false],['/x$','/xyz',true],['/*.pdf$','/a.pdf',false],['/*.pdf$','/a.pdf?x',true],['/x?y$','/x?y',false],['/x*ab$','/xyzab',false]])assert.equal(robotsAllow('User-agent: *\nDisallow: '+pattern,path),allowed);
});
test('untrusted wildcard patterns are not executed as exponential backtracking regexes',()=>{
  const policy='User-agent: *\nDisallow: /*'+'a*'.repeat(30)+'b$';
  assert.equal(robotsAllow(policy,'/'+'a'.repeat(1700)),true);
});
test('excessive robot policy or matching work fails closed',()=>{
  assert.equal(robotsAllow('User-agent: *\nAllow: /'+'a'.repeat(5000),'/'),false);
  const rule='Disallow: /*'+'a'.repeat(500)+'b$';
  assert.equal(robotsAllow('User-agent: *\n'+[rule,rule,rule].join('\n'),'/'+'a'.repeat(3000)),false);
});
