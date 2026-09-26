import { signedArea, insideRing, onSegment, bounds, meshModel, glb } from '../auto-model/geometry.mjs';

export const SCENARIOS=['existing','proposed','as-built-record','unknown'];
export const KINDS=['slab','wall','door','window','stair','lift','balcony','roof'];
export const BASES=['drawing','estimated','user-traced'];
const fail=message=>{throw new Error(message);};
const str=(v,n,max=600)=>typeof v==='string'&&v.trim()&&v.length<=max?v.trim():fail(`${n} is missing or too long.`);
const number=(v,n,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail(`${n} is outside ${min} to ${max}.`);
const arr=(v,n,max)=>Array.isArray(v)&&v.length<=max?v:fail(`${n} has too many items or is not an array.`);
const choose=(v,allowed,n)=>allowed.includes(v)?v:fail(`Invalid ${n}.`);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b);}
function ring(input){
  const r=arr(input,'Polygon ring',64).map(p=>{if(!Array.isArray(p)||p.length!==2)fail('Use XY pairs.');return p.map(v=>number(v,'Coordinate',-1000,1000));});
  if(r.length>3&&Math.hypot(r[0][0]-r.at(-1)[0],r[0][1]-r.at(-1)[1])<1e-6)r.pop();
  if(r.length<3||Math.abs(signedArea(r))<0.0001)fail('Polygon is degenerate.');
  for(let i=0;i<r.length;i++){
    if(Math.hypot(r[i][0]-r[(i+1)%r.length][0],r[i][1]-r[(i+1)%r.length][1])<0.001)fail('Duplicate polygon point.');
    for(let j=i+1;j<r.length;j++)if(j!==i+1&&!(i===0&&j===r.length-1)&&intersects(r[i],r[(i+1)%r.length],r[j],r[(j+1)%r.length]))fail('Polygon crosses itself.');
  }return r;
}
export function polygon(input){
  const rings=arr(input,'Rings',8).map(ring);if(!rings.length)fail('Polygon required.');
  for(let i=1;i<rings.length;i++){
    if(!insideRing(rings[i][0],rings[0]))fail('Void lies outside its floor.');
    for(let j=0;j<i;j++){
      if(j&& (insideRing(rings[i][0],rings[j])||insideRing(rings[j][0],rings[i])))fail('Voids overlap.');
      for(let k=0;k<rings[i].length;k++)for(let l=0;l<rings[j].length;l++)if(intersects(rings[i][k],rings[i][(k+1)%rings[i].length],rings[j][l],rings[j][(l+1)%rings[j].length]))fail('Polygon rings intersect.');
    }
  }return rings;
}
/** Shared strict normalisation. Only documented fields survive; no AI code executes. */
export function validateGraph(input,sources){
  if(!input||input.schemaVersion!==1||input.units!=='metres')fail('Use the version 1 metre-based graph.');
  const sourceMap=new Map(sources.map(s=>[s.id,s]));let points=0,components=0;const ids=new Set();
  const id=v=>{str(v,'ID',80);if(!/^[a-zA-Z0-9_-]+$/.test(v)||ids.has(v))fail('Component and floor IDs must be unique safe identifiers.');ids.add(v);return v;};
  const ref=(v,page,geometry=true)=>{const s=sourceMap.get(v);if(!s||s.rights==='pending'||!s.documentId||!s.buildingConfirmed)fail('A source is unapproved or does not belong to this building.');
    if(geometry&&s.role==='photo')fail('A photograph alone cannot establish floor geometry.');
    number(page,'Source page',1,500);if(!Number.isInteger(page)||(s.mime!=='application/pdf'&&page!==1))fail('Invalid source page.');return s;};
  const scenario=choose(input.scenario,SCENARIOS,'scenario');
  const graph={schemaVersion:1,units:'metres',title:str(input.title,'Title',160),scenario,
    scaleBasis:choose(input.scaleBasis,['dimensioned-drawing','user-calibrated','unknown'],'scale basis'),scaleNote:str(input.scaleNote,'Scale note'),
    alignment:str(input.alignment,'Floor alignment'),unknowns:arr(input.unknowns,'Unknowns',40).map(v=>str(v,'Unknown')),conflicts:arr(input.conflicts,'Conflicts',40).map(v=>str(v,'Conflict')),
    floors:arr(input.floors,'Floors',20).map(f=>{
      const s=ref(f.sourceId,f.page);if(s.scenario!==scenario)fail('Do not combine existing, proposed or unknown drawing schemes.');
      const out={id:id(f.id),label:str(f.label,'Floor label',80),elevationM:number(f.elevationM,'Floor elevation',-50,350),heightM:number(f.heightM,'Floor height',0.5,12),
        verticalBasis:choose(f.verticalBasis,['drawing','estimated','user-entered'],'vertical basis'),sourceId:s.id,page:f.page,note:str(f.note,'Floor note'),
        components:arr(f.components,'Floor components',150).map(c=>{
          if(++components>600)fail('Use at most 600 components per draft.');
          const evidence=ref(c.sourceId,c.page);if(evidence.scenario!==scenario)fail('Component uses a different drawing scenario.');
          const rings=polygon(c.rings);points+=rings.flat().length;if(points>8192)fail('Draft has too many vertices.');
          const bottomM=number(c.bottomM,'Component bottom',0,12),topM=number(c.topM,'Component top',0.01,12);
          if(topM<=bottomM||topM>f.heightM+0.01)fail('Component heights must fit within their floor.');
          const finish=choose(c.finish,['unknown','brick','render','concrete','glass','timber','metal'],'finish');
          if(finish!=='unknown')ref(c.finishSourceId,c.finishPage,false);
          else if(c.finishSourceId!==null||c.finishPage!==null)fail('Unknown finish must not claim a source.');
          return {id:id(c.id),kind:choose(c.kind,KINDS,'component kind'),label:str(c.label,'Component label',120),rings,bottomM,topM,
            basis:choose(c.basis,BASES,'geometry basis'),sourceId:c.sourceId,page:c.page,note:str(c.note,'Component note'),finish,finishSourceId:c.finishSourceId,finishPage:c.finishPage};
        })};return out;
    })};
  if(graph.floors.length&&graph.scaleBasis==='unknown')fail('Establish scale before making metric geometry; return empty floors when scale is unknown.');
  if(graph.floors.some(f=>!f.components.length))fail('Omit empty floors; describe missing information in Unknowns.');
  if(graph.floors.length)meshModel(toModel(graph));return graph;
}
export function toModel(graph,{floor='all',cutaway=false,explode=false}={}){
  const floors=graph.floors.filter(f=>floor==='all'||f.id===floor),volumes=[];
  for(const [i,f]of floors.entries())for(const c of f.components){
    if(cutaway&&c.kind==='roof')continue;
    const base=f.elevationM+(explode?i*2:0),top=cutaway&&c.kind==='wall'?Math.min(c.topM,c.bottomM+0.65):c.topM;
    volumes.push({id:c.id,parentId:f.id,title:c.label,rings:c.rings,minHeightM:base+c.bottomM,heightM:base+top,storeys:1,sourceUrl:`source:${c.sourceId}:page:${c.page}`,
      provenance:{height:{source:c.basis==='estimated'||f.verticalBasis==='estimated'?'estimated':'drawing',detail:c.note}},evidence:{...c,floorLabel:f.label,verticalBasis:f.verticalBasis}});
  }
  if(!volumes.length)throw new Error('There is no supported geometry in this draft yet.');
  return {schemaVersion:1,kind:'evidence-draft',title:graph.title,volumes,extent:bounds(volumes.map(v=>v.rings)),
    origin:{coordinateSystem:'local-metres',georeferenced:false},attribution:{text:'User-authorised evidence. Rights remain with source owners.'},
    provenance:{status:'Unverified reconstruction',scenario:graph.scenario,scale:graph.scaleNote,alignment:graph.alignment,unknowns:graph.unknowns,conflicts:graph.conflicts,components:volumes.map(v=>({id:v.id,...v.evidence}))}};
}
export const exportGLB=graph=>glb(toModel(graph));

// API Structured Outputs: every property required, unknown values explicit.
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const txt={type:'string'},num={type:'number'},nullableNum={type:['number','null']},nullableText={type:['string','null']};
const list=items=>({type:'array',items});const en=values=>({type:'string',enum:values});
export const graphSchema=obj({schemaVersion:{type:'integer',enum:[1]},units:{type:'string',enum:['metres']},title:txt,scenario:en(SCENARIOS),scaleBasis:en(['dimensioned-drawing','user-calibrated','unknown']),scaleNote:txt,alignment:txt,unknowns:list(txt),conflicts:list(txt),
  floors:list(obj({id:txt,label:txt,elevationM:num,heightM:num,verticalBasis:en(['drawing','estimated','user-entered']),sourceId:txt,page:{type:'integer'},note:txt,
    components:list(obj({id:txt,kind:en(KINDS),label:txt,rings:list(list(list(num))),bottomM:num,topM:num,basis:en(BASES),sourceId:txt,page:{type:'integer'},note:txt,finish:en(['unknown','brick','render','concrete','glass','timber','metal']),finishSourceId:nullableText,finishPage:nullableNum}))}))});
