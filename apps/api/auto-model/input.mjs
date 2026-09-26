import { HttpError, normalisePostcode, text } from '../validation.mjs';
const hosts=new Set(['maps.app.goo.gl','goo.gl','google.com','www.google.com','maps.google.com','google.co.uk','www.google.co.uk','maps.google.co.uk']);
export function mapsUrl(value){
  let u;try{u=new URL(value);}catch{throw new HttpError(400,'Enter a complete UK postcode, a Google Maps sharing link, or latitude, longitude.');}
  if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.port||u.username||u.password)throw new HttpError(400,'Only HTTPS Google Maps sharing links are supported.');
  if(u.hostname==='goo.gl'&&!u.pathname.startsWith('/maps/'))throw new HttpError(400,'This is not a Google Maps link.');
  if(u.hostname.includes('google.')&&!u.pathname.startsWith('/maps')&&u.hostname.split('.')[0]!=='maps')throw new HttpError(400,'Please paste a Google Maps link, not a general Google search.');
  if(u.href.length>2200)throw new HttpError(400,'Maps link is too long.');return u;
}
export function coordinates(lat,lon,basis='user-coordinate'){
  if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<49||lat>61.2||lon< -8.8||lon>2.1)throw new HttpError(400,'This first version supports UK locations. Check latitude, longitude.');
  return {latitude:lat,longitude:lon,basis,label:`${lat.toFixed(5)}, ${lon.toFixed(5)}`,postcode:''};
}
export function parseInput(value){
  const input=text(value,'Postcode or Maps link',2200);
  const coord=/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(input);
  if(coord)return {kind:'coordinate',location:coordinates(Number(coord[1]),Number(coord[2]))};
  if(/^https?:\/\//i.test(input))return parseMaps(mapsUrl(input));
  return {kind:'postcode',postcode:normalisePostcode(input)};
}
export function parseMaps(url){
  const u=typeof url==='string'?mapsUrl(url):mapsUrl(url.href);
  if(['maps.app.goo.gl','goo.gl'].includes(u.hostname))return {kind:'short-link',url:u.href};
  let decoded;try{decoded=decodeURIComponent(u.href);}catch{throw new HttpError(400,'Invalid encoded Maps link.');}
  // The pinned destination takes priority over the @ viewport centre.
  const pin=/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
  if(pin)return {kind:'coordinate',location:coordinates(Number(pin[1]),Number(pin[2]),'maps-link-pin')};
  for(const key of ['query','q','ll','center']){const value=u.searchParams.get(key)||'',m=/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(value);if(m)return {kind:'coordinate',location:coordinates(Number(m[1]),Number(m[2]),['ll','center'].includes(key)?'maps-link-centre':'maps-link-pin')};}
  const pc=decoded.replace(/\+/g,' ').match(/\b(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
  if(pc)return {kind:'postcode',postcode:normalisePostcode(pc[0])};
  const centre=/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decoded);
  if(centre)return {kind:'coordinate',location:coordinates(Number(centre[1]),Number(centre[2]),'maps-link-centre')};
  throw new HttpError(422,'This Maps link does not contain usable coordinates or a postcode. Paste the building postcode, or drop a pin in Maps and copy its latitude, longitude. No Google page content is scraped.');
}
export function selectionInput(input){
  if(!Array.isArray(input.candidateIds)||input.candidateIds.length<1||input.candidateIds.length>6||new Set(input.candidateIds).size!==input.candidateIds.length||input.candidateIds.some(id=>! /^(way|relation)\/\d+$/.test(id)))throw new HttpError(400,'Choose between one and six distinct building outlines.');
  const overrides=input.overrides||{};if(typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>80)throw new HttpError(400,'Invalid height overrides.');
  for(const [id,v] of Object.entries(overrides)){if(!/^(way|relation)\/\d+$/.test(id)||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['heightM','storeys'].includes(k)))throw new HttpError(400,'Invalid height override.');if(v.heightM!=null&&(!Number.isFinite(v.heightM)||v.heightM<1||v.heightM>350))throw new HttpError(400,'Overall height must be between 1 and 350 metres.');if(v.storeys!=null&&(!Number.isInteger(v.storeys)||v.storeys<1||v.storeys>80))throw new HttpError(400,'Storeys must be a whole number between 1 and 80.');}
  if(input.confirmBuilding!==true)throw new HttpError(400,'Confirm the selected building before saving.');
  if(input.useAI!=null&&typeof input.useAI!=='boolean')throw new HttpError(400,'Invalid AI option.');
  return {searchId:text(input.searchId,'Search reference',60),candidateIds:input.candidateIds,overrides,name:text(input.name,'Building name',150),address:text(input.address,'Address',400,false),requestKey:text(input.requestKey,'Request key',60),useAI:input.useAI===true};
}
