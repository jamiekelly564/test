import { typeById } from './model.mjs';
const meshCache=new Map();
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Vertex stride matches the preserved renderer. The returned mesh is separate from PLAN. */
export function equipmentMesh(style){
 if(!typeById.has(style))throw Error('Unknown illustrative equipment style.');
 if(meshCache.has(style))return meshCache.get(style).slice();
 const data=[];
 const tri=(a,b,c,colour)=>{let n=cross(sub(b,a),sub(c,a)),l=Math.hypot(...n);if(l<1e-10)return;n=n.map(x=>x/l);for(const p of [a,b,c])data.push(...p,...n,...rgb(colour),0);};
 const quad=(a,b,c,d,col)=>{tri(a,b,c,col);tri(a,c,d,col);};
 function box(x,y,z,w,h,d,col){const X=x-w/2,Y=y-h/2,Z=z-d/2,A=x+w/2,B=y+h/2,C=z+d/2;
  quad([X,Y,C],[A,Y,C],[A,B,C],[X,B,C],col);quad([A,Y,Z],[X,Y,Z],[X,B,Z],[A,B,Z],col);
  quad([A,Y,C],[A,Y,Z],[A,B,Z],[A,B,C],col);quad([X,Y,Z],[X,Y,C],[X,B,C],[X,B,Z],col);
  quad([X,B,C],[A,B,C],[A,B,Z],[X,B,Z],col);quad([X,Y,Z],[A,Y,Z],[A,Y,C],[X,Y,C],col);
 }
 function cyl(x,y,z,r,h,col,axis='y',n=16){
  const p=(a,t)=>axis==='y'?[x+r*Math.cos(a),y+t,z+r*Math.sin(a)]:axis==='x'?[x+t,y+r*Math.cos(a),z+r*Math.sin(a)]:[x+r*Math.cos(a),y+r*Math.sin(a),z+t];
  const center=t=>axis==='y'?[x,y+t,z]:axis==='x'?[x+t,y,z]:[x,y,z+t];
  for(let i=0;i<n;i++){const a=i/n*2*Math.PI,b=(i+1)/n*2*Math.PI;
   const A=p(a,-h/2),B=p(b,-h/2),C=p(b,h/2),D=p(a,h/2);
   // Axis y uses a different handedness to the other local planes.
   if(axis==='y'){quad(B,A,D,C,col);tri(center(h/2),C,D,col);tri(center(-h/2),A,B,col);}
   else {quad(A,B,C,D,col);tri(center(h/2),D,C,col);tri(center(-h/2),B,A,col);}
  }
 }
 const red='#bf3e38',white='#f0efe5',dark='#273b43',steel='#909c9e',blue='#326f99',green='#267c5e',yellow='#e4bc50';
 const grille=(x,y,z,w,h)=>{for(let i=0;i<6;i++)box(x,y-h/2+(i+.5)*h/6,z,w,.015,.008,dark);};
 const buttons=(y,z)=>{for(let i=0;i<4;i++)box(-.09+i*.06,y,z,.027,.027,.02,i===0?red:dark);};
 switch(style){
 case 'alarm-panel': box(0,.25,0,.56,.50,.13,white);box(0,.25,.073,.51,.45,.018,steel);box(-.055,.33,.086,.27,.115,.012,dark);box(-.055,.33,.094,.235,.07,.008,'#82b8a1');buttons(.20,.09);box(.19,.37,.09,.05,.05,.014,red);break;
 case 'smoke-detector': case 'heat-detector': cyl(0,.035,0,.14,.07,white);cyl(0,.085,0,.115,.055,style==='heat-detector'?steel:white);for(let i=0;i<12;i++){const a=i/12*2*Math.PI;box(Math.cos(a)*.10,.082,Math.sin(a)*.10,.013,.024,.025,dark);}box(.04,.118,0,.018,.008,.018,red);break;
 case 'call-point': box(0,.11,0,.23,.22,.08,red);box(0,.11,.045,.15,.10,.012,white);box(0,.075,.052,.09,.012,.006,dark);box(0,.185,.05,.14,.01,.005,white);break;
 case 'sounder': box(0,.12,0,.26,.25,.07,red);cyl(0,.11,.065,.102,.06,red,'z');grille(0,.11,.098,.14,.13);cyl(0,.27,0,.07,.08,'#e59a54');break;
 case 'extinguisher': cyl(0,.33,0,.125,.52,red);cyl(0,.615,0,.038,.07,dark);box(0,.67,0,.21,.035,.055,dark);box(.13,.40,.01,.035,.40,.035,dark);box(0,.38,.13,.13,.22,.009,white);cyl(0,.13,0,.13,.035,dark);break;
 case 'riser-outlet': box(0,.20,0,.44,.40,.16,red);box(0,.20,.09,.37,.33,.015,white);cyl(0,.15,.16,.08,.16,steel,'z');cyl(0,.31,.17,.10,.022,red,'z');break;
 case 'emergency-light': box(0,.10,0,.42,.20,.13,white);for(const x of [-.19,.19]){box(x,.23,.02,.055,.14,.055,steel);cyl(x,.30,.045,.095,.12,white,'z');cyl(x,.30,.11,.077,.012,'#fff1c5','z');}box(.12,.08,.08,.02,.02,.01,green);break;
 case 'exit-sign': box(0,.14,0,.56,.28,.055,white);box(0,.14,.033,.51,.23,.011,green);box(-.12,.14,.041,.018,.14,.009,white);box(-.06,.20,.041,.13,.02,.009,white);box(.04,.13,.041,.20,.024,.009,white);tri([.19,.13,.05],[.08,.20,.05],[.08,.06,.05],white);cyl(-.02,.18,.045,.02,.008,white,'z');break;
 case 'smoke-vent': box(0,.20,0,.40,.40,.14,steel);box(0,.20,.08,.32,.31,.025,white);box(0,.28,.10,.22,.09,.018,dark);buttons(.12,.11);break;
 case 'light': box(0,.035,0,.76,.065,.18,white);box(0,0,0,.67,.015,.13,'#fff5d6');break;
 case 'electrical-board': case 'lift-controller': case 'battery': box(0,.55,0,.65,1.1,.28,steel);box(0,.56,.153,.57,1.0,.025,white);box(.22,.53,.18,.025,.20,.025,dark);tri([0,.78,.19],[-.115,.57,.19],[.115,.57,.19],yellow);box(0,.66,.20,.013,.09,.008,dark);if(style==='battery')grille(0,.28,.18,.35,.21);break;
 case 'meter': box(0,.18,0,.32,.36,.13,white);box(0,.23,.08,.21,.10,.025,dark);box(0,.23,.096,.17,.065,.006,'#8ab7a0');buttons(.10,.085);break;
 case 'intercom': box(0,.23,0,.26,.46,.075,steel);box(0,.36,.05,.16,.105,.02,dark);grille(0,.25,.05,.16,.06);for(let y=0;y<3;y++)for(let x=0;x<3;x++)box(-.06+x*.06,.08+y*.04,.05,.03,.022,.01,dark);break;
 case 'cctv': box(0,.12,0,.13,.24,.07,steel);box(0,.18,.18,.055,.055,.31,steel);cyl(0,.24,.35,.085,.24,white,'z');cyl(0,.24,.48,.069,.02,dark,'z');cyl(0,.24,.494,.04,.009,blue,'z');break;
 case 'access-reader': box(0,.11,0,.12,.22,.045,dark);box(0,.185,.028,.06,.012,.005,'#79b59b');break;
 case 'pump': box(0,.08,0,1.0,.16,.55,steel);cyl(-.20,.30,0,.18,.45,blue,'x');for(let i=0;i<5;i++)cyl(-.36+i*.075,.30,0,.19,.025,dark,'x');cyl(.2,.30,0,.19,.23,steel,'x');cyl(.24,.54,0,.06,.33,steel);cyl(.47,.29,0,.06,.30,steel,'x');break;
 case 'tank': cyl(0,.75,0,.52,1.4,'#7b959a', 'y',24);cyl(0,1.47,0,.40,.055,steel);box(0,.85,.524,.22,.32,.012,white);cyl(.45,.20,0,.055,.25,steel,'x');break;
 case 'valve': cyl(0,.22,0,.055,.53,steel,'x');box(0,.22,0,.15,.15,.16,blue);cyl(0,.31,.1,.023,.2,steel,'z');cyl(0,.31,.215,.11,.025,red,'z');cyl(0,.31,.23,.082,.011,dark,'z');box(0,.31,.243,.20,.024,.01,red);box(0,.31,.243,.024,.20,.01,red);break;
 case 'leak-sensor': box(0,.028,0,.16,.055,.16,white);box(0,.06,0,.035,.008,.035,blue);break;
 case 'boiler': box(0,.65,0,.58,1.3,.46,white);box(0,.68,.24,.50,1.15,.018,steel);box(0,.8,.256,.26,.12,.015,dark);cyl(0,1.39,0,.1,.24,steel);buttons(.68,.26);for(const x of [-.15,.15])cyl(x,.07,0,.025,.25,steel);break;
 case 'fan': box(0,.25,0,.52,.50,.14,white);cyl(0,.25,.10,.21,.04,steel,'z');for(let i=0;i<7;i++)box(-.18+i*.06,.25,.13,.018,.32,.01,dark);break;
 case 'radiator': box(0,.36,0,.85,.72,.13,white);for(let i=0;i<10;i++)box(-.39+i*.085,.36,.078,.015,.60,.018,steel);cyl(.48,.15,0,.025,.18,steel,'x');break;
 case 'bin': case 'recycling': box(0,.42,0,.5,.76,.48,'#455f59');box(0,.82,0,.56,.10,.55,style==='recycling'?blue:green);for(const x of [-.23,.23])cyl(x,.07,-.19,.07,.045,dark,'x');box(0,.52,.247,.20,.22,.008,white);break;
 case 'bench': for(const x of [-.48,.48])box(x,.2,0,.055,.4,.44,steel);for(const z of [-.18,-.06,.06,.18])box(0,.44,z,1.22,.07,.09,'#a7805a');box(0,.73,-.23,1.22,.33,.06,'#a7805a');break;
 case 'information-box': box(0,.28,0,.52,.56,.18,red);box(0,.3,.10,.41,.40,.015,white);box(.17,.18,.119,.035,.055,.015,dark);box(0,.36,.119,.26,.025,.008,red);box(0,.28,.119,.26,.012,.008,steel);break;
 case 'ev-charger': box(0,.30,0,.30,.60,.15,dark);box(0,.38,.085,.23,.20,.015,white);box(0,.41,.098,.13,.075,.01,blue);box(.19,.18,0,.045,.34,.035,dark);cyl(.1,.02,0,.045,.22,dark,'x');break;
 }
 const mesh=new Float32Array(data);meshCache.set(style,mesh);return mesh.slice();
}
function inRing(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const inShape=(p,s)=>inRing(p,s.p)&&!(s.holes||[]).some(h=>inRing(p,h));
const distanceSegment=(p,s)=>{const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],v=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dz)/(dx*dx+dz*dz||1)));const q=[s.a[0]+dx*v,s.a[1]+dz*v];return {q,d:Math.hypot(q[0]-p[0],q[1]-p[1]),angle:Math.atan2(dx,dz)};};
/** Schematic equipment must fit its saved named area. Missing cupboards are never invented. */
export function compatibleLocation(style,a){
 if(!a||!['space','riser','stairs'].includes(a.type)||/apartment|bedroom|private|living\s*\/|\bflat\b/i.test(a.title))return false;
 const rule={
  'electrical-board':/sub.?station|electrical|meter|switch|riser|plant/i,meter:/sub.?station|electrical|meter|riser|plant/i,
  battery:/sub.?station|electrical|battery|plant/i,'lift-controller':/lift.*(machine|plant|control)|(machine|plant).*lift/i,
  pump:/plant|pump|water/i,tank:/plant|tank|water/i,boiler:/plant|boiler|heating/i,'leak-sensor':/plant|pump|water|riser/i,
  valve:/riser|plant|water|service/i,bin:/bin|refuse|waste/i,recycling:/bin|refuse|waste/i,
  bench:/community|lounge|garden|grounds|shared room/i,'ev-charger':/parking|garage|charging/i,
  'alarm-panel':/entrance|lobby|control|concierge/i,'information-box':/entrance|lobby|concierge/i,
  radiator:/community|lounge|corridor/i
 }[style];return !rule||rule.test(a.title);
}
export function meshBounds(data){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i+=10)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],data[i+j]);hi[j]=Math.max(hi[j],data[i+j]);}return {lo,hi};}
function footprint(x,z,w,d,angle){const c=Math.cos(angle),s=Math.sin(angle);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*c+v*s,z-u*s+v*c]);}
export function placeEquipment(plan,objects,surfaces,{size=1}={}){
 if(![1,1.5,2].includes(size))throw Error('Unsupported symbol scale.');
 const areas=new Map(plan.assets.map(a=>[a.id,a])),floors=new Map(plan.floors.map(f=>[f.id,f])),occupied=[],placed=[],unplaced=[],reasons={},byFloor=new Map();
 const reject=(id,reason)=>{unplaced.push(id);reasons[id]=reason;};
 for(const o of objects.slice(0,400)){
  const a=areas.get(o.locationId),t=typeById.get(o.style),f=a&&floors.get(a.floor);
  if(!a||!t||!f){reject(o.id,'Source location unavailable');continue;}
  if(!compatibleLocation(o.style,a)){reject(o.id,'No compatible named room or cupboard at the saved location');continue;}
  const region=surfaces?.byId?.get(a.id);
  if(!region||a.type==='stairs'){reject(o.id,'A bounded usable equipment area is not established');continue;}
  if(!byFloor.has(f.id))byFloor.set(f.id,{
   slabs:plan.shapes.filter(s=>s.f===f.id&&s.kind==='slab'),
   walls:plan.segments.filter(s=>s.f===f.id&&['partition','facade','core-wall'].includes(s.kind)),
   openings:plan.segments.filter(s=>s.f===f.id&&['door','internal-door','window'].includes(s.kind)),furniture:(plan.objects||[]).filter(p=>p.f===f.id)
  });
  const {slabs,walls,openings,furniture}=byFloor.get(f.id),bounds=meshBounds(equipmentMesh(o.style)),w=(bounds.hi[0]-bounds.lo[0])*size,d=(bounds.hi[2]-bounds.lo[2])*size,h=(bounds.hi[1]-bounds.lo[1])*size;
  const solid=p=>slabs.some(s=>inShape(p,s)),peers=(region.sharedIds||[]).map(id=>areas.get(id)).filter(Boolean);
  const inRegion=p=>region.contains(p)&&(!peers.length||peers.every(b=>b.id===a.id||Math.hypot(p[0]-a.pos[0],p[1]-a.pos[1])+.12<Math.hypot(p[0]-b.pos[0],p[1]-b.pos[1])));
  const candidates=[];
  function consider(p,angle,backing=null){
   if(Math.hypot(p[0]-a.pos[0],p[1]-a.pos[1])>(a.type==='riser'?1.1:4))return;
   const n=[Math.sin(angle),Math.cos(angle)],probe=backing?[p[0]+n[0]*.22,p[1]+n[1]*.22]:p;if(!inRegion(probe))return;
   const corners=footprint(p[0],p[1],w+.04,d+.04,angle);if(!corners.every(solid))return;
   const ceiling=backing?Math.min(3.1,backing.y+backing.h-f.y):2.65;
   const base=t.mount==='ceiling'?ceiling-h-.025:t.mount==='wall'?Math.min(/emergency-light|sounder|exit-sign|smoke-vent|cctv/.test(o.style)?1.9:1.1,ceiling-h-.04):.035;
   if(!Number.isFinite(base)||base<.025)return;const low=f.y+base,high=low+h,r=Math.hypot(w,d)/2;
   if(walls.some(s=>s!==backing&&distanceSegment(p,s).d<(s.w||.15)/2+.02&&low<s.y+s.h&&high>s.y))return;
   if(corners.some(c=>walls.some(s=>s!==backing&&distanceSegment(c,s).d<(s.w||.15)/2+.02&&low<s.y+s.h&&high>s.y)))return;
   if(openings.some(s=>distanceSegment(p,s).d<r+.25&&low<s.y+s.h&&high>s.y))return;
   if(occupied.some(q=>q.floor===f.id&&low<q.high+.08&&high>q.low-.08&&Math.hypot(p[0]-q.x,p[1]-q.z)<r+q.r+.12))return;
   if(base<1.9&&furniture.some(q=>Math.hypot(p[0]-q.p[0],p[1]-q.p[1])<r+Math.min(q.w,q.d)/2+.05))return;
   candidates.push({p,angle,base,low,high,r,score:Math.hypot(p[0]-a.pos[0],p[1]-a.pos[1])+(t.mount==='floor'?Math.min(...walls.map(s=>distanceSegment(p,s).d),4)*.3:0),backing});
  }
  if(t.mount==='wall'){
   for(const wall of walls){const dx=wall.b[0]-wall.a[0],dz=wall.b[1]-wall.a[1],length=Math.hypot(dx,dz);if(length<w+.12||wall.h<h+.1)continue;
    const start=(w/2+.06)/length,end=1-start,steps=Math.max(1,Math.ceil((length-w)/.35));
    for(let k=0;k<=steps;k++)for(const side of [-1,1]){const u=start+(end-start)*k/steps,n=[-dz/length*side,dx/length*side],gap=(wall.w||.15)/2+d/2+.025;consider([wall.a[0]+dx*u+n[0]*gap,wall.a[1]+dz*u+n[1]*gap],Math.atan2(n[0],n[1]),wall);}
   }
  }else{
   for(let row=-7;row<=7;row++)for(let col=-7;col<=7;col++){const p=[a.pos[0]+col*.45,a.pos[1]+row*.45],near=walls.map(s=>({s,...distanceSegment(p,s)})).sort((x,y)=>x.d-y.d)[0];consider(p,near?Math.atan2(p[0]-near.q[0],p[1]-near.q[1]):0);}
  }
  candidates.sort((a,b)=>a.score-b.score||a.p[0]-b.p[0]||a.p[1]-b.p[1]);const c=candidates[0];
  if(!c){reject(o.id,'Insufficient clear space or suitable wall backing in the named area');continue;}
  occupied.push({floor:f.id,x:c.p[0],z:c.p[1],low:c.low,high:c.high,r:c.r});
  placed.push({...o,floor:f.id,floorY:f.y,x:c.p[0],z:c.p[1],baseY:c.base,rotation:c.angle,mount:t.mount,scale:size,placement:region.sharedIds?.length?'SCHEMATIC / local to area label; separating boundary unresolved':'SCHEMATIC / within named space; NOT surveyed',backing:c.backing?{a:[...c.backing.a],b:[...c.backing.b],w:c.backing.w}:null});
 }
 return {placed,unplaced,reasons};
}
export function buildEquipmentGroups(placements,{size=1}={}){
 if(![1,1.5,2].includes(size))throw Error('Unsupported symbol scale.');
 return placements.map(p=>{
  const src=equipmentMesh(p.style),out=new Float32Array(src.length),b=meshBounds(src),factor=size,baseY=p.baseY??(p.mount==='ceiling'?2.5-(b.hi[1]-b.lo[1])*factor:p.mount==='wall'?1.1:.035),cos=Math.cos(p.rotation),sin=Math.sin(p.rotation),cx=(b.lo[0]+b.hi[0])/2,cz=(b.lo[2]+b.hi[2])/2;
  for(let i=0;i<src.length;i+=10){const x=src[i]-cx,z=src[i+2]-cz;out[i]=p.x+factor*(x*cos+z*sin);out[i+1]=p.floorY+baseY+factor*(src[i+1]-b.lo[1]);out[i+2]=p.z+factor*(-x*sin+z*cos);out[i+3]=src[i+3]*cos+src[i+5]*sin;out[i+4]=src[i+4];out[i+5]=-src[i+3]*sin+src[i+5]*cos;for(let k=6;k<10;k++)out[i+k]=src[i+k];}
  const bounds=meshBounds(out);return {name:'DEMO '+p.style+' '+p.id,kind:'demo-equipment',floor:p.floor,basis:'illustrative-equipment',demoId:p.id,locationId:p.locationId,vertices:out,data:out,count:out.length/10,bounds,anchor:bounds.lo.map((v,i)=>(v+bounds.hi[i])/2)};
 });
}
/** Export only the fictional layer. The original building/export remains untouched. */
export function equipmentGLB(groups){
 const views=[],accessors=[],meshes=[],nodes=[],chunks=[];let length=0;
 for(const g of groups){const data=g.vertices,vi=views.length,ai=accessors.length;views.push({buffer:0,byteOffset:length,byteLength:data.byteLength,byteStride:40,target:34962});chunks.push(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));length+=data.byteLength;
  accessors.push({bufferView:vi,byteOffset:0,componentType:5126,count:g.count,type:'VEC3',min:g.bounds.lo,max:g.bounds.hi},{bufferView:vi,byteOffset:12,componentType:5126,count:g.count,type:'VEC3'},{bufferView:vi,byteOffset:24,componentType:5126,count:g.count,type:'VEC3'});
  meshes.push({name:g.name,primitives:[{attributes:{POSITION:ai,NORMAL:ai+1,COLOR_0:ai+2},material:0}]});nodes.push({name:g.name,mesh:meshes.length-1,extras:{demo:true,locationId:g.locationId,position:'Illustrative only - NOT a surveyed asset',id:g.demoId}});
 }
 const doc={asset:{version:'2.0',generator:'PropertyChecked DEMO equipment layer'},scene:0,scenes:[{name:'FICTIONAL EQUIPMENT - NOT AS BUILT',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:[{doubleSided:true,pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.8}}],buffers:[{byteLength:length}],bufferViews:views,accessors,extras:{demonstration:true,notice:'Fictional asset library and indicative positions. Not an installation design, compliance model or site inventory.'}};
 const text=new TextEncoder().encode(JSON.stringify(doc)),jl=Math.ceil(text.length/4)*4,bytes=new Uint8Array(28+jl+length),v=new DataView(bytes.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.length,true);v.setUint32(12,jl,true);v.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+jl);bytes.set(text,20);v.setUint32(20+jl,length,true);v.setUint32(24+jl,0x004e4942,true);let at=28+jl;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;
}
