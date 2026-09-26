/** Deterministic, dependency-free building geometry. XY points are east/north metres.
 * Maps/AI are never used as evidence of an interior, defect or fire rating.
 */
export const EARTH_RADIUS = 6378137;
export const round = (n, dp = 3) => Math.round(n * 10 ** dp) / 10 ** dp;
export function project(lon, lat, origin) {
  return [round((lon-origin.longitude)*Math.PI/180*EARTH_RADIUS*Math.cos(origin.latitude*Math.PI/180)),
    round((lat-origin.latitude)*Math.PI/180*EARTH_RADIUS)];
}
export function unproject(x, y, origin) {
  return [origin.longitude+x/(EARTH_RADIUS*Math.cos(origin.latitude*Math.PI/180))*180/Math.PI,
    origin.latitude+y/EARTH_RADIUS*180/Math.PI];
}
export function signedArea(ring) {
  let a=0; for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];a+=p[0]*q[1]-q[0]*p[1];} return a/2;
}
export function polygonArea(rings) {return Math.abs(signedArea(rings[0]))-rings.slice(1).reduce((s,r)=>s+Math.abs(signedArea(r)),0);}
export function bounds(polygons) {
  const points=polygons.flat(2);if(!points.length)throw new Error('No footprint coordinates.');
  return {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))};
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function onSegment(p,a,b){return Math.abs(cross(a,b,p))<1e-5&&p[0]>=Math.min(a[0],b[0])-1e-5&&p[0]<=Math.max(a[0],b[0])+1e-5&&p[1]>=Math.min(a[1],b[1])-1e-5&&p[1]<=Math.max(a[1],b[1])+1e-5;}
export function insideRing(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[j],b=r[i];if(onSegment(p,a,b))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function insidePolygon(p,rings){return insideRing(p,rings[0])&&!rings.slice(1).some(r=>insideRing(p,r));}
function segmentsCross(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y < -1e-8 && z*w < -1e-8 || onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b);}
export function cleanRing(points){
  if(!Array.isArray(points)||points.length<4||points.length>513)throw new Error('Unsupported footprint ring.');
  const pts=[];for(const p of points){if(!Array.isArray(p)||p.length<2||p.some(v=>!Number.isFinite(v))||Math.max(...p.map(Math.abs))>3000)throw new Error('Invalid footprint point.');if(!pts.length||Math.hypot(p[0]-pts.at(-1)[0],p[1]-pts.at(-1)[1])>.001)pts.push(p.slice(0,2));}
  if(Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])>.01)throw new Error('Open footprint ring.');pts.pop();
  if(pts.length<3||Math.abs(signedArea(pts))<1)throw new Error('Degenerate footprint.');
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){if(j===i+1||(i===0&&j===pts.length-1))continue;if(segmentsCross(pts[i],pts[(i+1)%pts.length],pts[j],pts[(j+1)%pts.length]))throw new Error('Self-intersecting footprint.');}
  return pts;
}
export function validatePolygon(rings){
  if(!rings.length||rings.length>20)throw new Error('Unsupported footprint.');
  for(let i=1;i<rings.length;i++){
    if(!insideRing(rings[i][0],rings[0]))throw new Error('Courtyard outside footprint.');
    for(let j=0;j<i;j++){
      if(j>0&&(insideRing(rings[i][0],rings[j])||insideRing(rings[j][0],rings[i])))throw new Error('Overlapping courtyards.');
      for(let k=0;k<rings[i].length;k++)for(let l=0;l<rings[j].length;l++)if(segmentsCross(rings[i][k],rings[i][(k+1)%rings[i].length],rings[j][l],rings[j][(l+1)%rings[j].length]))throw new Error('Intersecting footprint rings.');
    }
  }
  if(polygonArea(rings)<2)throw new Error('Footprint is too small.');return rings;
}
/** Horizontal trapezoid decomposition uses even-odd fill, retaining concavities and holes.
 * Unlike a triangle fan this never bridges a courtyard or concave recess.
 */
export function triangulate(rings){
  const ys=[...new Set(rings.flat().map(p=>p[1]))].sort((a,b)=>a-b),triangles=[];
  const edges=rings.flatMap(r=>r.map((a,i)=>[a,r[(i+1)%r.length]]));
  for(let s=0;s<ys.length-1;s++){
    const low=ys[s],high=ys[s+1],mid=(low+high)/2;
    if(high-low<1e-7)continue;
    const active=edges.filter(([a,b])=>Math.min(a[1],b[1])<mid&&Math.max(a[1],b[1])>mid)
      .map(([a,b])=>({at:y=>a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1])})).sort((a,b)=>a.at(mid)-b.at(mid));
    if(active.length%2)throw new Error('Invalid footprint fill.');
    for(let i=0;i<active.length;i+=2){const a=[active[i].at(low),low],b=[active[i+1].at(low),low],c=[active[i+1].at(high),high],d=[active[i].at(high),high];if(Math.abs(cross(a,b,c))>1e-7)triangles.push([a,b,c]);if(Math.abs(cross(a,c,d))>1e-7)triangles.push([a,c,d]);}
  }
  return triangles;
}
export function metres(value){
  if(typeof value!=='string')return null;
  let m=value.trim().match(/^(\d+(?:\.\d+)?)\s*(m|metres|meters|ft|feet|')?$/i);if(!m)return null;
  let n=Number(m[1]);if(['ft','feet',"'"].includes(m[2]?.toLowerCase()))n*=.3048;return Number.isFinite(n)&&n>=0&&n<=350?round(n):null;
}
export function levels(value){if(typeof value!=='string'||!/^\d{1,3}$/.test(value.trim()))return null;const n=Number(value);return n>=1&&n<=80?n:null;}
const basis = (value,source,detail)=>({value,source,detail});
export function dimensions(tags={},override={},ai=null){
  let storeys=levels(tags['building:levels']),height=metres(tags.height);
  const mappedMinimum=metres(tags.min_height), minimumLevel=levels(tags['building:min_level'])||0;
  const minHeight=mappedMinimum??minimumLevel*3;
  const roofHeight=metres(tags['roof:height']);
  let sb=storeys?basis(storeys,'public-data','OpenStreetMap building:levels; not site verified.'):basis(null,'unknown','Storey count is not recorded.');
  let hb=height!==null&&height>=1?basis(height,'public-data','OpenStreetMap height (including roof); not site verified.'):null;
  if(!hb&&storeys){height=storeys*3+(roofHeight||0);hb=basis(height,'estimated','Mapped storeys x assumed 3.0 m, plus mapped roof height when present.');}
  if(!hb&&ai&&Number.isFinite(ai.heightM)){height=ai.heightM;hb=basis(height,'ai-estimate','GPT suggestion from limited public tags; not a measurement.');}
  if(!storeys&&ai?.storeys){sb=basis(ai.storeys,'ai-estimate','GPT-suggested storeys; not site verified.');storeys=ai.storeys;}
  if(!hb&&ai?.storeys){height=ai.storeys*3;hb=basis(height,'ai-estimate','GPT-suggested storeys x assumed 3.0 m; not a measurement.');}
  if(!hb){height=9;hb=basis(9,'estimated','Preview default of 9 m because no height evidence is available.');}
  if(override.storeys!=null){storeys=override.storeys;sb=basis(storeys,'user-estimate','User-entered estimate; not verified.');if(override.heightM==null){height=storeys*3;hb=basis(height,'user-estimate','User-entered storeys x assumed 3.0 m.');}}
  if(override.heightM!=null){height=override.heightM;hb=basis(height,'user-estimate','User-entered overall height; not a surveyed measurement.');}
  if(height<=minHeight||height>350||height<1)throw new Error('Height must exceed the mapped minimum height and be between 1 and 350 metres.');
  return {heightM:round(height),minHeightM:minHeight,storeys,provenance:{height:hb,storeys:sb,minimumHeight:basis(minHeight,mappedMinimum!==null?'public-data':'estimated',mappedMinimum!==null?'OpenStreetMap min_height; not site verified.':minimumLevel?'Mapped building:min_level x assumed 3.0 m.':'Local ground plane assumed at zero; terrain not surveyed.'),roof:basis(tags['roof:shape']||null,tags['roof:shape']?'public-data':'unknown','Rendered as an exterior envelope. Roof shape, windows and finishes are not reconstructed in this version.')}};
}
export function createModel(search,ids,overrides={},suggestions=[]){
  const chosen=ids.map(id=>search.candidates.find(c=>c.id===id));if(!chosen.length||chosen.some(c=>!c))throw new Error('Choose an available footprint.');
  const volumes=[];
  for(const c of chosen){
    const parts=c.parts?.length?c.parts:[c];
    for(const part of parts){const ai=suggestions.find(s=>s.id===part.id);const d=dimensions(part.tags,overrides[part.id]||{},ai);for(let i=0;i<part.polygons.length;i++)volumes.push({id:part.id+(part.polygons.length>1?`-${i}`:''),parentId:c.id,title:part.name||c.name,rings:part.polygons[i],...d,sourceUrl:part.sourceUrl});}
  }
  if(volumes.length>80)throw new Error('This building has too many parts for the preview.');
  const extent=bounds(volumes.map(v=>v.rings));
  return {schemaVersion:1,kind:'auto-exterior',title:chosen[0].name,createdAt:new Date().toISOString(),origin:search.location,
    sourceIds:ids,sourceKey:ids.slice().sort().join(','),volumes,extent,
    sources:chosen.flatMap(c=>[{id:c.id,url:c.sourceUrl,polygons:c.polygons,tags:c.tags},...(c.parts||[]).map(p=>({id:p.id,parentId:c.id,url:p.sourceUrl,polygons:p.polygons,tags:p.tags}))]),sourceTimestamp:search.sourceTimestamp||null,
    provenance:{footprint:'OpenStreetMap community mapping, not a measured site survey.',interior:'Unknown - no rooms, doors, services or safety findings generated.',location:search.location.basis,
      height:'Each volume records its own height basis.',roof:'Exterior envelope only; roof shapes and exterior finishes are not reconstructed.',parts:chosen.some(c=>c.parts?.length)?'Mapped building parts used where present; gaps between parts have not been filled.':'One envelope per selected outline. Setbacks absent from mapping remain unknown.'},
    attribution:{text:'\u00a9 OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',licence:'ODbL 1.0',dataRetrievedAt:search.retrievedAt},
    warnings:[...(search.warnings||[]),'Estimated exterior model only. Not an as-built survey, ownership boundary or safety assessment.'],
    ai:{used:suggestions.length>0,suggestions}};
}
export function meshModel(model){
  const objects=[];let totalVertices=0;
  for(const v of model.volumes){
    const positions=[],normals=[],colors=[];
    const color=v.provenance.height.source==='public-data'?[.38,.64,.65]:[.72,.77,.78];
    const add=(pts,n,c)=>{for(const p of pts){positions.push(...p);normals.push(...n);colors.push(...c);}};
    const xyz=(p,h)=>[p[0],h,-p[1]];
    for(const tri of triangulate(v.rings)){
      add(tri.map(p=>xyz(p,v.heightM)),[0,1,0],[.32,.42,.46]);
      add([...tri].reverse().map(p=>xyz(p,v.minHeightM)),[0,-1,0],color);
    }
    for(let r=0;r<v.rings.length;r++){
      const ring=v.rings[r],area=signedArea(ring),sign=(area>0?1:-1)*(r===0?1:-1);
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<1e-6)continue;
        const n=[sign*dy/l,0,sign*dx/l];const A=xyz(a,v.minHeightM),B=xyz(b,v.minHeightM),C=xyz(b,v.heightM),D=xyz(a,v.heightM);
        if(sign===1){add([A,B,C],n,color);add([A,C,D],n,color);}else{add([A,C,B],n,color);add([A,D,C],n,color);}
      }
    }
    totalVertices+=positions.length/3;if(positions.length/3>100000||totalVertices>180000)throw new Error('Footprint too complex for preview. Choose fewer outlines or simpler parts.');
    objects.push({id:v.id,positions,normals,colors,extras:{source:v.sourceUrl,heightBasis:v.provenance.height.source,heightM:v.heightM,notSurveyed:true}});
  }
  return objects;
}
export function geojson(model){return {type:'FeatureCollection',attribution:model.attribution,provenance:model.provenance,features:model.volumes.map(v=>({type:'Feature',id:v.id,properties:{height:v.heightM,min_height:v.minHeightM,storeys:v.storeys,height_basis:v.provenance.height.source,source_url:v.sourceUrl,not_surveyed:true},geometry:{type:'Polygon',coordinates:v.rings.map(r=>[...r,r[0]].map(p=>unproject(...p,model.origin)))}}))};}
/** Minimal glTF 2.0 binary export: metres, Y up; no provider textures or private drawings. */
export function glb(model){
  const objects=meshModel(model),chunks=[],bufferViews=[],accessors=[];let length=0;
  const add=(array,type,minmax=false)=>{const a=new Float32Array(array),bytes=new Uint8Array(a.buffer);const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length,target:34962});chunks.push(bytes);length+=bytes.length;const acc={bufferView:view,componentType:5126,count:array.length/3,type};if(minmax){acc.min=[0,1,2].map(k=>Math.min(...array.filter((_,i)=>i%3===k)));acc.max=[0,1,2].map(k=>Math.max(...array.filter((_,i)=>i%3===k)));}accessors.push(acc);return accessors.length-1;};
  const meshes=objects.map(o=>({name:o.id,extras:o.extras,primitives:[{attributes:{POSITION:add(o.positions,'VEC3',true),NORMAL:add(o.normals,'VEC3'),COLOR_0:add(o.colors,'VEC3')},material:0}]}));
  const doc={asset:{version:'2.0',generator:'PropertyChecked exterior preview 0.2.0',copyright:model.attribution.text},scene:0,scenes:[{nodes:objects.map((_,i)=>i)}],nodes:objects.map((o,i)=>({name:o.id,mesh:i})),meshes,materials:[{name:'Unverified exterior envelope',doubleSided:true,pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.85}}],buffers:[{byteLength:length}],bufferViews,accessors,extras:{attribution:model.attribution,provenance:model.provenance,origin:model.origin}};
  const raw=new TextEncoder().encode(JSON.stringify(doc)),jl=(raw.length+3)&~3,bl=(length+3)&~3,total=12+8+jl+8+bl;
  const out=new Uint8Array(total),dv=new DataView(out.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,jl,true);dv.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jl);out.set(raw,20);dv.setUint32(20+jl,bl,true);dv.setUint32(24+jl,0x004e4942,true);let pos=28+jl;for(const c of chunks){out.set(c,pos);pos+=c.length;}return out;
}
