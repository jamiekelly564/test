import { HttpError } from '../validation.mjs';
import { parseInput, parseMaps, mapsUrl, coordinates } from './input.mjs';
import { project, cleanRing, validatePolygon, polygonArea, insidePolygon, insideRing, bounds } from '../../../packages/auto-model/geometry.mjs';
import { ProviderError, request, readJson, checkStatus, cancelBody } from './network.mjs';
const TAGS=['name','addr:housenumber','addr:street','addr:postcode','building','building:part','building:levels','building:min_level','height','min_height','roof:height','roof:shape'];
const PRIMARY = 'https://overpass-api.de/api/interpreter';
const BACKUP = 'https://overpass.private.coffee/api/interpreter';
function endpoint(value) {
  let url; try { url = new URL(value); } catch { throw new Error('Overpass configuration must be a trusted HTTPS endpoint.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Overpass configuration must be a trusted HTTPS endpoint with no credentials or fragment.');
  return url;
}

export function createProviders({fetcher=fetch, overpassUrl=process.env.OVERPASS_API_URL, fallbackUrl=process.env.OVERPASS_FALLBACK_URL, now=Date.now}={}) {
  // A configured/private endpoint is never silently replaced by a public one.
  const primary=endpoint(overpassUrl || PRIMARY);
  const backup=fallbackUrl === 'none' ? null : fallbackUrl ? endpoint(fallbackUrl) : !overpassUrl ? endpoint(BACKUP) : null;
  const endpoints=[primary, ...(backup && backup.href !== primary.href ? [backup] : [])];
  const cooldowns=new Map(); let pauseUntil=0;
  const context=url=>({stage:'footprints',provider:url.hostname});
  return {
    async resolve(input) {
      let parsed=parseInput(input);
      // Follow only redirect headers on explicitly allowed Google hosts. Never read page HTML.
      for (let n=0; parsed.kind==='short-link'; n++) {
        if(n>=4)throw new HttpError(422,'Maps link has too many redirects. Paste the postcode or pin coordinates instead.');
        const u=mapsUrl(parsed.url), ctx={stage:'maps',provider:u.hostname};
        const r=await request(fetcher,u.href,{redirect:'manual',signal:AbortSignal.timeout(10000)},ctx);
        if(r.status>=400)await checkStatus(r,ctx);
        await cancelBody(r);
        if(![301,302,303,307,308].includes(r.status)||!r.headers.get('location'))throw new ProviderError(ctx,'MAPS_LINK','the short link did not provide a usable redirect',{status:422});
        let next;try{next=new URL(r.headers.get('location'),u);}catch{throw new HttpError(422,'Invalid Maps redirect.');}
        parsed=parseMaps(mapsUrl(next.href));
      }
      if(parsed.kind==='coordinate')return parsed.location;
      const ctx={stage:'postcode',provider:'api.postcodes.io'};
      const r=await request(fetcher,`https://api.postcodes.io/postcodes/${encodeURIComponent(parsed.postcode)}`,{signal:AbortSignal.timeout(10000)},ctx);
      if(r.status===404){await cancelBody(r);throw new HttpError(404,'Postcode not found. Enter a complete current postcode or a location pin.');}
      const data=await readJson(r,64000,ctx),p=data?.result;
      if(!p||p.latitude==null||p.longitude==null)throw new HttpError(422,'This postcode has no usable coordinate. Use a precise location pin instead.');
      return {...coordinates(p.latitude,p.longitude,'postcode-centroid'),postcode:p.postcode,label:[p.postcode,p.admin_district].filter(Boolean).join(' / '),source:'https://postcodes.io',quality:p.quality};
    },
    async buildings(location) {
      const {latitude:lat,longitude:lon}=coordinates(location.latitude,location.longitude);
      if(now()<pauseUntil)throw new ProviderError(context(primary),'COOLDOWN',`the provider requested a pause; try again in ${Math.ceil((pauseUntil-now())/1000)} seconds`,{status:429,retryAfterSeconds:Math.ceil((pauseUntil-now())/1000)});
      const query=`[out:json][timeout:15][maxsize:33554432];(way["building"]["building"!="no"](around:250,${lat},${lon});relation["building"]["type"="multipolygon"](around:250,${lat},${lon});way["building:part"]["building:part"!="no"](around:250,${lat},${lon});relation["building:part"]["type"="multipolygon"](around:250,${lat},${lon});way["highway"]["name"](around:280,${lat},${lon}););out body geom;`;
      const attempts=[];
      for (const url of endpoints) {
        if((cooldowns.get(url.href)||0)>now())continue;
        const ctx=context(url);
        try {
          // 35 seconds allows the documented queue wait plus the 15-second query.
          const response=await request(fetcher,url.href,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}).toString()},ctx);
          const data=await readJson(response,3*1024*1024,ctx);
          if(data?.remark)throw new ProviderError(ctx,'INCOMPLETE','the service did not complete the query; no partial footprint has been modelled',{transient:true});
          if(!Array.isArray(data?.elements)||data.elements.length>2500)throw new ProviderError(ctx,'INVALID_DATA','the footprint response is missing or too complex',{status:502});
          const result=normaliseElements(data.elements,location,data.osm3s?.timestamp_osm_base);
          if(url!==primary)result.warnings.push('The primary mapping service was unavailable. Outlines were retrieved from the configured backup service.');
          return {...result,provider:{host:url.hostname,fallback:url!==primary}};
        } catch(error) {
          if(!(error instanceof ProviderError))throw error;
          attempts.push(error.diagnostic);
          error.diagnostic={...error.diagnostic,attempts:[...attempts]};
          // Never rotate providers to get around a rate limit, access denial or Retry-After.
          if(error.diagnostic.retryAfterSeconds)pauseUntil=now()+error.diagnostic.retryAfterSeconds*1000;
          if(!error.transient)throw error;
          cooldowns.set(url.href,now()+60000);
          if(url===endpoints.at(-1))throw error;
        }
      }
      const wait=Math.max(1,Math.ceil((Math.min(...cooldowns.values())-now())/1000));
      const error=new ProviderError(context(primary),'COOLDOWN',`mapping services are cooling down after a failure; retry in ${wait} seconds`,{retryAfterSeconds:wait});
      error.diagnostic.attempts=attempts;throw error;
    }
  };
}
function tagsOf(input){const tags={};for(const key of TAGS)if(typeof input?.[key]==='string')tags[key]=input[key].slice(0,180);return tags;}
function same(a,b){return Math.abs(a.lat-b.lat)<1e-8&&Math.abs(a.lon-b.lon)<1e-8;}
function joinRings(members,role){
  const pending=members.filter(m=>m.type==='way'&&(m.role||'outer')===role).map(m=>m.geometry?.map(p=>({...p})));
  if(pending.some(r=>!r||r.length<2||r.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon))))throw new Error('Incomplete relation geometry.');
  const rings=[];
  while(pending.length){let ring=pending.shift();let loops=0;
    while(!same(ring[0],ring.at(-1))){
      if(++loops>512)throw new Error('Unclosed relation.');
      const idx=pending.findIndex(r=>same(r[0],ring.at(-1))||same(r.at(-1),ring.at(-1)));
      if(idx<0)throw new Error('Incomplete relation ring.');let next=pending.splice(idx,1)[0];if(!same(next[0],ring.at(-1)))next.reverse();ring.push(...next.slice(1));
    }rings.push(ring);
  }return rings;
}
function polygonsOf(element,origin){
  const convert=ring=>cleanRing(ring.map(p=>project(p.lon,p.lat,origin)));
  if(element.type==='way')return [validatePolygon([convert(element.geometry||[])])];
  const outer=joinRings(element.members||[],'outer').map(convert),inner=joinRings(element.members||[],'inner').map(convert);
  if(!outer.length||outer.length>20)throw new Error('Missing outline.');
  const polygons=outer.map(r=>[r]);
  for(const ring of inner){const containing=polygons.map((p,i)=>({p,i})).filter(({p})=>insideRing(ring[0],p[0])).sort((a,b)=>polygonArea(a.p)-polygonArea(b.p))[0];if(!containing)throw new Error('Unassigned courtyard.');polygons[containing.i].push(ring);}
  return polygons.map(validatePolygon);
}
export function normaliseElements(elements,origin,sourceTimestamp=null){
  const items=[],roads=[],members=new Set();let skipped=0;
  for(const el of elements){
    if(el.tags?.highway&&!el.tags.building&&!el.tags['building:part']){
      const points=(el.geometry||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>project(p.lon,p.lat,origin));
      if(points.length>1&&points.length<500)roads.push({name:String(el.tags.name||'').slice(0,100),points});continue;
    }
    if(!['way','relation'].includes(el.type)||!Number.isSafeInteger(el.id)||!el.tags||(el.tags.building==='no')||(!el.tags.building&&!el.tags['building:part']))continue;
    try{
      const polygons=polygonsOf(el,origin),tags=tagsOf(el.tags),box=bounds(polygons),area=polygons.reduce((s,p)=>s+polygonArea(p),0);
      if(area>150000||box.maxX-box.minX>1400||box.maxY-box.minY>1400||polygons.flat(2).length>1600)throw new Error('Too complex.');
      const centre=[(box.minX+box.maxX)/2,(box.minY+box.maxY)/2];
      const containsOrigin=polygons.some(p=>insidePolygon([0,0],p));
      items.push({id:`${el.type}/${el.id}`,sourceUrl:`https://www.openstreetmap.org/${el.type}/${el.id}`,tags,polygons,areaM2:Math.round(area),centre,distanceM:containsOrigin?0:Math.round(Math.hypot(...centre)),
        name:tags.name||[tags['addr:housenumber'],tags['addr:street']].filter(Boolean).join(' ')||`Mapped ${tags.building&&tags.building!=='yes'?tags.building:'building'} ${el.id}`,
        address:[tags['addr:housenumber'],tags['addr:street'],tags['addr:postcode']].filter(Boolean).join(' '),isPart:!!tags['building:part']&&tags['building:part']!=='no',parts:[]});
      if(el.type==='relation')for(const member of el.members||[])if(member.type==='way')members.add(`way/${member.ref}`);
    }catch{skipped++;}
  }
  const roots=items.filter(i=>!i.isPart&&!members.has(i.id));
  const orphanParts=[];
  for(const part of items.filter(i=>i.isPart&&!members.has(i.id))){
    const parent=roots.filter(r=>part.polygons.every(p=>p[0].every(pt=>r.polygons.some(rp=>insidePolygon(pt,rp))))).sort((a,b)=>a.areaM2-b.areaM2)[0];
    if(parent)parent.parts.push(part);else orphanParts.push({...part,name:part.name+' (mapped part)'});
  }
  const candidates=[...roots,...orphanParts].sort((a,b)=>a.distanceM-b.distanceM).slice(0,100);
  return {candidates,roads:roads.slice(0,40),retrievedAt:new Date().toISOString(),sourceTimestamp,
    warnings:[...(skipped?[`${skipped} unsupported or incomplete mapped outlines were omitted, not guessed.`]:[]),...(roots.length+orphanParts.length>100?['Showing the nearest 100 mapped outlines. Use a more precise pin to narrow the search.']:[])],
    radiusM:250,attribution:{text:'\u00a9 OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',licence:'ODbL 1.0'}};
}
export {readJson};
