import { typeById } from './model.mjs';
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Vertex stride matches the preserved renderer. The returned mesh is separate from PLAN. */
export function equipmentMesh(style){
 if(!typeById.has(style))throw Error('Unknown illustrative equipment style.');
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
 return new Float32Array(data);
}
function inRing(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const inShape=(p,s)=>inRing(p,s.p)&&!(s.holes||[]).some(h=>inRing(p,h));
const distanceSegment=(p,s)=>{const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],v=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dz)/(dx*dx+dz*dz||1)));const q=[s.a[0]+dx*v,s.a[1]+dz*v];return {q,d:Math.hypot(q[0]-p[0],q[1]-p[1]),angle:Math.atan2(dx,dz)};};
/** Approximate, collision-spaced display positions. No parent coordinates or PLAN changes. */
export function placeEquipment(plan,objects,surfaces){
 const areas=new Map(plan.assets.map(a=>[a.id,a])),floors=new Map(plan.floors.map(f=>[f.id,f]));
 const occupied=[],placed=[],unplaced=[];
 for(const o of objects.slice(0,400)){
  const a=areas.get(o.locationId),t=typeById.get(o.style),f=a&&floors.get(a.floor);if(!a||!t||!f){unplaced.push(o.id);continue;}
  const shape=surfaces?.byId?.get(a.id),slabs=plan.shapes.filter(s=>s.f===a.floor&&s.kind==='slab');
  const walls=plan.segments.filter(s=>s.f===a.floor&&['partition','facade','core-wall'].includes(s.kind));
  const anchor=[a.pos[0],a.pos[1]],candidates=[];
  for(let ring=0;ring<12;ring++)for(let i=0;i<(ring?20:1);i++){
   const angle=(i/20+(o.slot||0)*.17)*Math.PI*2,rad=ring*.38,p=[anchor[0]+Math.cos(angle)*rad,anchor[1]+Math.sin(angle)*rad];
   if(!slabs.some(s=>inShape(p,s))||shape&&!shape.contains(p))continue;
   const near=walls.map(w=>({...distanceSegment(p,w),w})).sort((x,y)=>x.d-y.d)[0];
   const radius=['tank','pump','boiler','bench'].includes(o.style)?.62:.29;
   if(near?.d<radius*.6||occupied.some(v=>v.floor===a.floor&&Math.hypot(p[0]-v.p[0],p[1]-v.p[1])<radius+v.r))continue;
   if(radius>.5&&![[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([x,z])=>slabs.some(s=>inShape([p[0]+x,p[1]+z],s))))continue;
   const score=t.mount==='wall'?(near?.d||4)+rad*.13:rad+(t.mount==='ceiling'?0:.2);
   candidates.push({p,near,radius,score});
  }
  candidates.sort((x,y)=>x.score-y.score);const c=candidates[0];if(!c){unplaced.push(o.id);continue;}
  const angle=t.mount==='wall'&&c.near?Math.atan2(c.p[0]-c.near.q[0],c.p[1]-c.near.q[1]):.15;
  occupied.push({floor:a.floor,p:c.p,r:c.radius});placed.push({...o,floor:a.floor,floorY:f.y,x:c.p[0],z:c.p[1],rotation:angle,mount:t.mount,placement:'SCHEMATIC DEMONSTRATION POSITION - not a measured installation point'});
 }
 return {placed,unplaced};
}
export function buildEquipmentGroups(placements,{size=1.5,capFloor=null,wallHeight=2.8}={}){
 if(![1,1.5,2].includes(size))throw Error('Unsupported symbol scale.');
 return placements.map(p=>{
  const src=equipmentMesh(p.style),out=new Float32Array(src.length);let maxY=0,minY=0;
  for(let i=1;i<src.length;i+=10){maxY=Math.max(maxY,src[i]);minY=Math.min(minY,src[i]);}
  const cap=String(capFloor)===String(p.floor)?wallHeight:2.8;
  const factor=Math.min(size,Math.max(.1,(cap-.09)/(maxY-minY||1)));
  const physicalY=p.mount==='ceiling'?2.45:p.mount==='wall'?1.1:0.03;
  const baseY=Math.max(.025,Math.min(physicalY,cap-(maxY-minY)*factor-.04));
  const cos=Math.cos(p.rotation),sin=Math.sin(p.rotation);
  for(let i=0;i<src.length;i+=10){out[i]=p.x+factor*(src[i]*cos+src[i+2]*sin);out[i+1]=p.floorY+baseY+factor*(src[i+1]-minY);out[i+2]=p.z+factor*(-src[i]*sin+src[i+2]*cos);out[i+3]=src[i+3]*cos+src[i+5]*sin;out[i+4]=src[i+4];out[i+5]=-src[i+3]*sin+src[i+5]*cos;for(let k=6;k<10;k++)out[i+k]=src[i+k];}
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i+=10)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],out[i+j]);hi[j]=Math.max(hi[j],out[i+j]);}
  return {name:'DEMO '+p.style+' '+p.id,kind:'demo-equipment',floor:p.floor,basis:'illustrative-equipment',demoId:p.id,locationId:p.locationId,vertices:out,data:out,count:out.length/10,bounds:{lo,hi},anchor:lo.map((v,i)=>(v+hi[i])/2)};
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
