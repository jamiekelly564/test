/** Read-only model interaction: no records, inferred equipment or source geometry writes. */
const EPS=1e-8;
export function pointInRing(p,r){let b=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],z=r[j];if((a[1]>p[1])!==(z[1]>p[1])&&p[0]<(z[0]-a[0])*(p[1]-a[1])/(z[1]-a[1])+a[0])b=!b;}return b;}
export const inRings=(p,rings)=>!!rings.length&&pointInRing(p,rings[0])&&!rings.slice(1).some(r=>pointInRing(p,r));
const area=r=>Math.abs(r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function rayTriangle(ray,a,b,c){const e1=sub(b,a),e2=sub(c,a),h=cross(ray.dir,e2),d=dot(e1,h);if(Math.abs(d)<EPS)return null;const s=sub(ray.origin,a),u=dot(s,h)/d;if(u<0||u>1)return null;const q=cross(s,e1),v=dot(ray.dir,q)/d;if(v<0||u+v>1)return null;const t=dot(e2,q)/d;return t>EPS?t:null;}
function bounds(points){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}return {lo,hi};}
function rayBox(ray,b,max){let near=0,far=max;for(let i=0;i<3;i++){const d=ray.dir[i],o=ray.origin[i];if(Math.abs(d)<EPS){if(o<b.lo[i]-EPS||o>b.hi[i]+EPS)return false;continue;}let a=(b.lo[i]-o)/d,z=(b.hi[i]-o)/d;if(a>z)[a,z]=[z,a];near=Math.max(near,a);far=Math.min(far,z);if(near>far+EPS)return false;}return far>=0;}
function tree(tris,depth=0){const box=bounds(tris.flatMap(t=>[t.a,t.b,t.c]));if(tris.length<=24||depth>=22)return {...box,tris};const span=box.hi.map((x,i)=>x-box.lo[i]),axis=span.indexOf(Math.max(...span));tris.sort((a,b)=>a.mid[axis]-b.mid[axis]);const n=tris.length>>1;return {...box,left:tree(tris.slice(0,n),depth+1),right:tree(tris.slice(n),depth+1)};}
export function createSurfacePicker(groups){
 const cache=new WeakMap();
 return function pick(ray,{visible=()=>true,offset=()=>0,cap=()=>Infinity,maxDistance=Infinity}={}){
  if(!ray||![...ray.origin,...ray.dir].every(Number.isFinite))return null;
  let best=maxDistance,result=null;
  for(const g of groups){if(!visible(g)||g.kind==='site')continue;const limit=cap(g),dy=offset(g);if(!Number.isFinite(dy))continue;
   let c=cache.get(g);if(!c||c.limit!==limit){const raw=g.vertices||g.data||[],tris=[];if(raw.length>9000000)continue;
    for(let i=0;i+29<raw.length;i+=30){const points=[0,10,20].map(k=>[raw[i+k],Math.min(raw[i+k+1],limit),raw[i+k+2]]);if(!points.flat().every(Number.isFinite))continue;tris.push({a:points[0],b:points[1],c:points[2],mid:[0,1,2].map(j=>(points[0][j]+points[1][j]+points[2][j])/3)});}
    c={limit,tree:tris.length?tree(tris):null};cache.set(g,c);}
   if(!c.tree)continue;const local={origin:[ray.origin[0],ray.origin[1]-dy,ray.origin[2]],dir:ray.dir};
   const visit=n=>{if(!rayBox(local,n,best))return;if(n.tris){for(const t of n.tris){const hit=rayTriangle(local,t.a,t.b,t.c);if(hit!==null&&hit<best){best=hit;result={group:g,distance:hit,point:ray.origin.map((v,i)=>v+ray.dir[i]*hit)};}}}else{visit(n.left);visit(n.right);}};visit(c.tree);
  }return result;
 };
}
function distanceToSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function segmentRing(s){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],len=Math.hypot(dx,dz)||1,w=Math.max(.06,s.w||.12)/2,n=[-dz/len*w,dx/len*w];return [[s.a[0]+n[0],s.a[1]+n[1]],[s.b[0]+n[0],s.b[1]+n[1]],[s.b[0]-n[0],s.b[1]-n[1]],[s.a[0]-n[0],s.a[1]-n[1]]];}
function objectRing(o){const c=Math.cos(o.rot*Math.PI/180),s=Math.sin(o.rot*Math.PI/180);return [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]].map(([x,z])=>[o.p[0]+x*c-z*s,o.p[1]+x*s+z*c]);}
/** Raster segmentation uses existing wall/door segments as closed boundaries.
 * It is a display approximation, never an inferred survey or a new floor plan.
 */
export function partitionFloor(plan,floor,step=.20){
 const slabs=plan.shapes.filter(s=>s.f===floor.id&&s.kind==='slab'),rings=slabs.map(s=>[s.p,...(s.holes||[])]);if(!rings.length)return null;
 const points=rings.flat(2),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),x=Math.floor(Math.min(...xs)/step)*step,z=Math.floor(Math.min(...zs)/step)*step;
 const w=Math.ceil((Math.max(...xs)-x)/step)+1,h=Math.ceil((Math.max(...zs)-z)/step)+1;if(w*h>160000)return null;
 const grid=new Int32Array(w*h);grid.fill(-1);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const p=[x+(i+.5)*step,z+(j+.5)*step];if(rings.some(r=>inRings(p,r)))grid[j*w+i]=0;}
 const wallKinds=new Set(['facade','partition','core-wall','door','internal-door','window']);
 for(const s of plan.segments.filter(s=>s.f===floor.id&&wallKinds.has(s.kind))){const pad=Math.max(.09,(s.w||.15)/2)+step*.60;
  const i0=Math.max(0,Math.floor((Math.min(s.a[0],s.b[0])-pad-x)/step)),i1=Math.min(w-1,Math.ceil((Math.max(s.a[0],s.b[0])+pad-x)/step));
  const j0=Math.max(0,Math.floor((Math.min(s.a[1],s.b[1])-pad-z)/step)),j1=Math.min(h-1,Math.ceil((Math.max(s.a[1],s.b[1])+pad-z)/step));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(distanceToSegment([x+(i+.5)*step,z+(j+.5)*step],s.a,s.b)<pad)grid[j*w+i]=-1;
 }
 const components=new Map();let index=0;
 for(let at=0;at<grid.length;at++){if(grid[at]!==0)continue;const id=++index,q=[at];grid[at]=id;for(let a=0;a<q.length;a++){const v=q[a],i=v%w;for(const n of [i>0?v-1:-1,i<w-1?v+1:-1,v-w,v+w])if(n>=0&&n<grid.length&&grid[n]===0){grid[n]=id;q.push(n);}}components.set(id,q);}
 function seed(p){const i=Math.floor((p[0]-x)/step),j=Math.floor((p[1]-z)/step);let best=0,dist=Infinity;for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){const ii=i+dx,jj=j+dz;if(ii<0||ii>=w||jj<0||jj>=h)continue;const v=grid[jj*w+ii],d=Math.hypot(x+(ii+.5)*step-p[0],z+(jj+.5)*step-p[1]);if(v>0&&d<dist&&d<.85){dist=d;best=v;}}return best;}
 const point=id=>[x+(id%w)*step,z+Math.floor(id/w)*step];
 function outlines(id){const cells=components.get(id)||[],strips=[],edgeSegments=[];
  const rows=new Map();for(const a of cells){const j=Math.floor(a/w);if(!rows.has(j))rows.set(j,[]);rows.get(j).push(a%w);
   const [xx,zz]=point(a);for(const [di,dj,a1,b1] of [[-1,0,[xx,zz],[xx,zz+step]],[1,0,[xx+step,zz+step],[xx+step,zz]],[0,-1,[xx+step,zz],[xx,zz]],[0,1,[xx,zz+step],[xx+step,zz+step]]]){const i=a%w,jj=Math.floor(a/w),ni=i+di,nj=jj+dj;if(ni<0||ni>=w||nj<0||nj>=h||grid[nj*w+ni]!==id)edgeSegments.push([a1,b1]);}}
  for(const [j,cols] of rows){cols.sort((a,b)=>a-b);let first=cols[0],prev=first;const add=()=>{const xa=x+first*step,xb=x+(prev+1)*step,za=z+j*step;strips.push([[xa,za],[xb,za],[xb,za+step],[xa,za+step]]);};for(const i of cols.slice(1)){if(i!==prev+1){add();first=i;}prev=i;}add();}
  return {strips,edgeSegments,size:cells.length*step*step};
 }
 return {grid,w,h,x,z,step,seed,components,outlines,contains:(id,p)=>{const i=Math.floor((p[0]-x)/step),j=Math.floor((p[1]-z)/step);return i>=0&&i<w&&j>=0&&j<h&&grid[j*w+i]===id;}};
}
export function compileSurfaces(plan){
 const result=[],byId=new Map(),floors=new Map(plan.floors.map(f=>[f.id,f])),grids=new Map();
 const all=plan.assets.filter(a=>a.type!=='void');
 const add=(a,shape)=>{const s={id:a.id,title:a.title,type:a.type,floor:a.floor,source:a.source,basis:a.basis||'drawing-derived',anchor:[...a.pos],...shape};result.push(s);byId.set(a.id,s);};
 for(const a of all){const floor=floors.get(a.floor);if(!floor)continue;
  if(['door','window'].includes(a.type)){
   const candidates=plan.segments.filter(s=>s.f===a.floor&&(a.type==='window'?s.kind==='window':['door','internal-door'].includes(s.kind))).map(s=>({s,d:distanceToSegment(a.pos,s.a,s.b)})).sort((x,y)=>x.d-y.d);
   if(candidates[0]?.d<1.0){const s=candidates[0].s,r=segmentRing(s);add(a,{polygons:[[r]],lines:[],y:s.y,top:s.y+s.h,segment:s,boundaryBasis:'Existing model segment; dimensions unverified',contains:p=>distanceToSegment(p,s.a,s.b)<Math.max(.20,(s.w||.1)/2)});}continue;
  }
  if(a.type==='stairs'){
   const o=plan.objects.filter(o=>o.f===a.floor&&o.t==='stairs').map(o=>({o,d:Math.hypot(o.p[0]-a.pos[0],o.p[1]-a.pos[1])})).sort((x,y)=>x.d-y.d)[0];
   if(o?.d<3){const ring=objectRing(o.o);add(a,{polygons:[[ring]],y:o.o.y+.06,top:o.o.y+(o.o.rise||1.45)*2,boundaryBasis:'Existing schematic stair footprint',contains:p=>pointInRing(p,ring)});continue;}
  }
  const shapes=plan.shapes.filter(s=>s.f===a.floor&&s.kind==='finish'&&inRings(a.pos,[s.p,...(s.holes||[])]));
  const exact=shapes.filter(s=>all.filter(b=>b.floor===a.floor&&b.type==='space'&&inRings(b.pos,[s.p,...(s.holes||[])])).length===1).sort((s,t)=>area(s.p)-area(t.p))[0];
  if(exact){const rings=[exact.p,...(exact.holes||[])];add(a,{polygons:[rings],y:exact.y+exact.h+.045,top:exact.y+exact.h+.045,boundaryBasis:'Existing model floor-zone outline',contains:p=>inRings(p,rings)});continue;}
  if(a.type==='space'){
   const slabs=plan.shapes.filter(s=>s.f===a.floor&&s.kind==='slab'&&inRings(a.pos,[s.p,...(s.holes||[])])&&all.filter(b=>b.floor===a.floor&&b.type==='space'&&inRings(b.pos,[s.p,...(s.holes||[])])).length===1).sort((s,t)=>area(s.p)-area(t.p));
   if(slabs.length){const s=slabs[0],rings=[s.p,...(s.holes||[])];add(a,{polygons:[rings],y:s.y+s.h+.045,top:s.y+s.h+.045,boundaryBasis:'Existing separately modelled floor plate; internal boundaries remain unverified',contains:p=>inRings(p,rings)});continue;}
  }
  if(['lift','riser','stairs'].includes(a.type)){
   const holes=plan.shapes.filter(s=>s.f===a.floor&&s.kind==='slab').flatMap(s=>(s.holes||[]).filter(h=>pointInRing(a.pos,h)).map(h=>({s,h}))).sort((a,b)=>area(a.h)-area(b.h));
   if(holes.length){const {s,h}=holes[0];add(a,{polygons:[[h]],y:s.y+s.h+.05,top:s.y+s.h+2.1,boundaryBasis:'Modelled shaft/opening footprint; not an equipment survey',contains:p=>pointInRing(p,h)});continue;}
  }
  if(!grids.has(a.floor))grids.set(a.floor,partitionFloor(plan,floor));const grid=grids.get(a.floor);if(!grid)continue;const id=grid.seed(a.pos);if(!id)continue;
  const peers=all.filter(b=>b.floor===a.floor&&['space','lift','riser'].includes(b.type)&&grid.seed(b.pos)===id);const region=grid.outlines(id);
  // Do not label an entire connected floor as one small room or invent partitions between names.
  if(region.size<.25||region.size>300||peers.length>4)continue;
  add(a,{polygons:region.strips.map(r=>[r]),lines:region.edgeSegments,y:floor.y+.06,top:floor.y+.06,sharedIds:peers.length>1?peers.map(b=>b.id):[],sharedTitles:peers.length>1?peers.map(b=>b.title):[],boundaryBasis:peers.length>1?'Shared model region; separate area boundary is not resolved':'Approximate region from existing model partitions (0.20 m display grid)',contains:p=>grid.contains(id,p)});
 }
 return {surfaces:result,byId,unbounded:all.filter(a=>!byId.has(a.id)).map(a=>a.id)};
}
export function resolveSurfaceHit(compiled,hit){
 if(!hit||hit.group.floor<0)return null;const p=[hit.point[0],hit.point[2]],kind=hit.group.kind;
 const surfaces=compiled.surfaces.filter(s=>s.floor===hit.group.floor&&s.contains(p));
 if(['door','internal-door'].includes(kind))return surfaces.find(s=>s.type==='door')||null;
 if(['window','window-frame'].includes(kind))return surfaces.find(s=>s.type==='window')||null;
 if(kind==='stairs')return surfaces.find(s=>s.type==='stairs')||null;
 if(['facade','roof','roof-parapet','balcony-rail','void-line'].includes(kind))return null;
 return surfaces.filter(s=>!['door','window'].includes(s.type)).sort((a,b)=>(a.type==='space'?0:1)-(b.type==='space'?0:1))[0]||null;
}
