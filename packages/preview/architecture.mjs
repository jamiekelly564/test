import { signedArea } from '../auto-model/geometry.mjs';

export const WINDOW_STYLES = ['casement', 'sash', 'picture', 'ribbon', 'bay', 'none'];
export const SURFACES = ['plain', 'brick', 'horizontal', 'vertical'];
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str = {type:'string'}, num = {type:'number'}, int = {type:'integer'};
const list = (items, maxItems) => ({type:'array',items,maxItems});
const enumeration = values => ({type:'string',enum:values});
const idsSchema = list(str,4);
export const architectureSchema = object({
  version:{type:'integer',enum:[1]}, roofColour:str, parapetHeight:num,
  facades:list(object({
    block:int, edge:int, start:num, end:num, firstFloor:int, lastFloor:int,
    wallColour:str, frameColour:str, glassColour:str, accentColour:str,
    surface:enumeration(SURFACES), windowStyle:enumeration(WINDOW_STYLES),
    windowWidth:num, windowHeight:num, sillHeight:num, spacing:num, panesX:int, panesY:int,
    balcony:enumeration(['none','projecting','juliet']), balconyEvery:int, balconyDepth:num,
    railing:enumeration(['metal','glass']), band:enumeration(['none','sill','floor']),
    sourcePhotoIds:idsSchema, note:str
  }),24),
  entrances:list(object({block:int,edge:int,position:num,width:num,height:num,canopyDepth:num,
    doubleDoor:{type:'boolean'},colour:str,sourcePhotoIds:idsSchema}),8),
  roofFeatures:list(object({block:int,kind:enumeration(['chimney','rooflight','dormer','plant']),
    u:num,v:num,width:num,depth:num,height:num,colour:str,sourcePhotoIds:idsSchema}),12)
});
const check = (condition,message) => {if(!condition)throw new Error('Architectural detail: '+message);};
const number = (v,lo,hi,label,integer=false) => {check(typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi&&(!integer||Number.isInteger(v)),label+' is out of range.');return v;};
const choice = (v,values) => {check(values.includes(v),'unsupported style.');return v;};
const text = v => {check(typeof v==='string'&&v.length<=600,'invalid note.');return v.replace(/[\u0000-\u001f]/g,' ').trim();};
export function hexColour(v){check(typeof v==='string'&&/^#[\da-f]{6}$/i.test(v),'use a six-digit colour.');return v.toLowerCase();}
export const rgb = value => [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
function sourceIds(v){check(Array.isArray(v)&&v.length<=4,'too many photo references.');return [...new Set(v.map(x=>{check(typeof x==='string'&&/^[\w-]{1,100}$/.test(x),'invalid photo reference.');return x;}))];}
function array(v,max){check(Array.isArray(v)&&v.length<=max,'too many features.');return v;}

/** No arbitrary geometry, expressions, URLs or materials are accepted from AI. */
export function validateArchitecture(v,blocks) {
  check(v&&typeof v==='object'&&v.version===1,'unsupported version.');
  const block=x=>number(x,0,blocks.length-1,'block',true),edge=x=>number(x,-1,63,'edge',true);
  return {version:1,roofColour:hexColour(v.roofColour),parapetHeight:number(v.parapetHeight,0,1.5,'parapet'),
    facades:array(v.facades,24).map(p=>{
      check(p&&typeof p==='object','invalid facade.');
      const out={block:block(p.block),edge:edge(p.edge),start:number(p.start,0,.99,'start'),end:number(p.end,.01,1,'end'),
        firstFloor:number(p.firstFloor,0,24,'first floor',true),lastFloor:number(p.lastFloor,0,24,'last floor',true),
        wallColour:hexColour(p.wallColour),frameColour:hexColour(p.frameColour),glassColour:hexColour(p.glassColour),accentColour:hexColour(p.accentColour),
        surface:choice(p.surface,SURFACES),windowStyle:choice(p.windowStyle,WINDOW_STYLES),windowWidth:number(p.windowWidth,.4,5,'window width'),
        windowHeight:number(p.windowHeight,.4,4,'window height'),sillHeight:number(p.sillHeight,.1,2.5,'sill height'),spacing:number(p.spacing,1,10,'spacing'),
        panesX:number(p.panesX,1,4,'vertical panes',true),panesY:number(p.panesY,1,4,'horizontal panes',true),
        balcony:choice(p.balcony,['none','projecting','juliet']),balconyEvery:number(p.balconyEvery,1,6,'balcony frequency',true),balconyDepth:number(p.balconyDepth,.2,2.5,'balcony depth'),
        railing:choice(p.railing,['metal','glass']),band:choice(p.band,['none','sill','floor']),sourcePhotoIds:sourceIds(p.sourcePhotoIds),note:text(p.note)};
      check(out.end>out.start&&out.lastFloor>=out.firstFloor,'inverted facade range.');return out;
    }),
    entrances:array(v.entrances,8).map(p=>{check(p&&typeof p==='object'&&typeof p.doubleDoor==='boolean','invalid entrance.');return {
      block:block(p.block),edge:number(p.edge,0,63,'entrance edge',true),position:number(p.position,.05,.95,'entrance position'),width:number(p.width,.7,6,'entrance width'),
      height:number(p.height,1.8,4,'entrance height'),canopyDepth:number(p.canopyDepth,0,3,'canopy'),doubleDoor:p.doubleDoor,colour:hexColour(p.colour),sourcePhotoIds:sourceIds(p.sourcePhotoIds)};}),
    roofFeatures:array(v.roofFeatures,12).map(p=>{check(p&&typeof p==='object','invalid roof feature.');return {block:block(p.block),kind:choice(p.kind,['chimney','rooflight','dormer','plant']),
      u:number(p.u,.02,.98,'roof x'),v:number(p.v,.02,.98,'roof y'),width:number(p.width,.3,6,'roof feature width'),depth:number(p.depth,.3,6,'roof feature depth'),
      height:number(p.height,.1,4,'roof feature height'),colour:hexColour(p.colour),sourcePhotoIds:sourceIds(p.sourcePhotoIds)};})};
}
const finishes={brick:'#926049','cream-brick':'#c1ae85',render:'#e1ddd2',concrete:'#a3aaa8',metal:'#747f85'};
export function defaultFacade(b,block=0) {
  return {block,edge:-1,start:0,end:1,firstFloor:0,lastFloor:24,wallColour:finishes[b.finish]||finishes.brick,frameColour:'#e5e6df',glassColour:'#6b8995',accentColour:'#d6d1c3',
    surface:b.finish==='brick'||b.finish==='cream-brick'?'brick':'plain',windowStyle:'casement',windowWidth:1.4,windowHeight:Math.min(1.65,b.floorHeight*.52),sillHeight:.8,
    spacing:Math.max(1.8,Math.min(8,b.width/b.columns)),panesX:2,panesY:1,balcony:b.balconies?'projecting':'none',balconyEvery:2,balconyDepth:1.15,railing:'metal',band:'none',sourcePhotoIds:[],note:'Generic unmeasured detail; not extracted from a photograph.'};
}
export function defaultArchitecture(spec) {return {version:1,roofColour:'#4a5156',parapetHeight:.35,facades:spec.blocks.map(defaultFacade),entrances:[],roofFeatures:[]};}
export function withoutPhotoClaims(value){if(!value)return value;const out=structuredClone(value);for(const group of ['facades','entrances','roofFeatures'])for(const p of out[group]){p.sourcePhotoIds=[];if('note' in p)p.note='User-adjusted estimate; not measured.';}return out;}
export function filterArchitectureSources(value,usedIds){if(!value)return value;const out=structuredClone(value),ids=new Set(usedIds);for(const group of ['facades','entrances','roofFeatures'])for(const p of out[group])p.sourcePhotoIds=p.sourcePhotoIds.filter(id=>ids.has(id));return out;}

/** Stable LOCAL edge IDs. They are not compass bearings or proof of photo orientation. */
export function envelopePolygons(spec){
  return spec.blocks.map((b,block)=>{
    const shapes=spec.mapped&&block===0?spec.mapped.polygons:[[[[0,0],[b.width,0],[b.width,b.depth],[0,b.depth]]]];
    const sx=spec.mapped?b.width/spec.mapped.baseWidth:1,sy=spec.mapped?b.depth/spec.mapped.baseDepth:1,a=b.rotation*Math.PI/180;
    const transform=p=>[b.x+p[0]*sx*Math.cos(a)-p[1]*sy*Math.sin(a),b.y+p[0]*sx*Math.sin(a)+p[1]*sy*Math.cos(a)];
    return {block,b,polygons:shapes.map(p=>p.map(r=>r.map(transform)))};
  });
}
export function edgesFor(envelope) {
  const edges=[];
  for(const [polygon,rings] of envelope.polygons.entries())for(const [ri,ring] of rings.entries()){
    const sign=(signedArea(ring)>0?1:-1)*(ri===0?1:-1);
    for(let i=0;i<ring.length;i++){
      const p=ring[i],q=ring[(i+1)%ring.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
      if(length<.001)continue;
      edges.push({id:edges.length,block:envelope.block,polygon,courtyard:ri>0,p,q,length,normal:[sign*dy/length,-sign*dx/length]});
    }
  }return edges;
}
export function describeEnvelope(spec){return {alignment:'Local edge indices only. Association to a photograph is uncertain, not a verified compass orientation.',blocks:envelopePolygons(spec).map(env=>({block:env.block,label:env.b.label,width:env.b.width,depth:env.b.depth,floors:env.b.floors,edges:edgesFor(env).map(e=>({edge:e.id,from:e.p.map(n=>+n.toFixed(2)),to:e.q.map(n=>+n.toFixed(2)),length:+e.length.toFixed(2),courtyard:e.courtyard}))}))};}
export function editArchitecture(spec,block,values){
  const next=structuredClone(spec),a=next.architecture||defaultArchitecture(next);
  let p=a.facades.find(p=>p.block===block&&p.edge===-1&&p.firstFloor===0&&p.lastFloor===24);
  if(!p){if(a.facades.length>=24)throw new Error('Too many elevation profiles; remove a profile before adding another.');p=defaultFacade(next.blocks[block],block);a.facades.unshift(p);}
  // A simple block-wide adjustment also updates its scoped profiles, not hidden overrides.
  for(const f of a.facades.filter(p=>p.block===block))for(const [k,v] of Object.entries(values)){
    if(['windowWidth','windowHeight','spacing','panesX','panesY'].includes(k))f[k]=Number(v);
    if(['frameColour','wallColour','windowStyle','surface'].includes(k))f[k]=v;
    f.sourcePhotoIds=[];f.note='User-adjusted facade. Placement and dimensions remain unmeasured.';
  }
  if(values.roofColour)a.roofColour=values.roofColour;
  next.architecture=validateArchitecture(a,next.blocks);return next;
}
