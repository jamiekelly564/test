/* PropertyChecked plan-study renderer. Real triangle geometry; no network or AI calls. */
(function(){
'use strict';
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=r=>r.reduce((n,p,i)=>n+p[0]*r[(i+1)%r.length][1]-r[(i+1)%r.length][0]*p[1],0)/2;
function inside(p,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
// Even-odd trapezoids retain irregular outlines and holes, unlike a triangle fan.
function triangulate(rings){
 const ys=[...new Set(rings.flat().map(p=>p[1]))].sort((a,b)=>a-b),edges=rings.flatMap(r=>r.map((p,i)=>[p,r[(i+1)%r.length]])),tri=[];
 for(let j=0;j<ys.length-1;j++){const a=ys[j],b=ys[j+1],mid=(a+b)/2;if(b-a<1e-6)continue;
 const active=edges.filter(([p,q])=>Math.min(p[1],q[1])<mid&&Math.max(p[1],q[1])>mid).map(([p,q])=>({at:y=>p[0]+(y-p[1])*(q[0]-p[0])/(q[1]-p[1])})).sort((x,y)=>x.at(mid)-y.at(mid));
 if(active.length%2)throw new Error('Invalid source polygon');
 for(let k=0;k<active.length;k+=2){const p=[active[k].at(a),a],q=[active[k+1].at(a),a],r=[active[k+1].at(b),b],s=[active[k].at(b),b];if(Math.abs(cross(p,q,r))>1e-8)tri.push([p,q,r]);if(Math.abs(cross(p,r,s))>1e-8)tri.push([p,r,s]);}}
 return tri;
}
const colours={wall:'#e5e1d8',cap:'#fffdf8',slab:'#c8c7be',room:'#ded4c0',service:'#c0ceca',circulation:'#eae6da',outdoor:'#bcc6b2',water:'#78a8ad',glass:'#83a1aa',frame:'#475b59',door:'#a38d72',furniture:'#8a9b95'};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const shade=(hex,v)=>{const c=rgb(hex).map(n=>Math.round(Math.min(1,n*v)*255));return `rgb(${c.join(',')})`;};
function geometry(p,{cutaway=true,furniture=false}={}){
 const objects=[],s=p.scale,origin=p.origin,H=cutaway?1.25:p.height,coord=pt=>[(pt[0]-origin[0])*s,(pt[1]-origin[1])*s];
 function prism(rings,bottom,top,colour,id,kind,cap=colour){
  if(top-bottom<.001)return;
  const faces=[],verts=[],normals=[];const add=(points,n,col)=>{faces.push({points,n,colour:col,id,kind});for(let j=1;j<points.length-1;j++)for(const point of [points[0],points[j],points[j+1]]){verts.push(...point);normals.push(...n);}};
  const xyz=(a,h)=>[a[0],h,a[1]];
  for(const t of triangulate(rings)){add([...t].reverse().map(a=>xyz(a,top)),[0,1,0],cap);add(t.map(a=>xyz(a,bottom)),[0,-1,0],colour);}
  for(const [ri,r] of rings.entries())for(let i=0;i<r.length;i++){
   const a=r[i],b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.001)continue;
   const sign=(area(r)>0?1:-1)*(ri===0?1:-1),n=[sign*dz/len,0,-sign*dx/len];
   const side=[xyz(a,bottom),xyz(b,bottom),xyz(b,top),xyz(a,top)];add(sign>0?side.reverse():side,n,colour);
  }objects.push({id,kind,faces,positions:verts,normals,colour});
 }
 const quad=(a,b,t)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/l*t/2,ny=(b[0]-a[0])/l*t/2;return [[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];};
 const box=(x,z,w,d,b,t,c,id,kind)=>prism([[[x,z],[x+w,z],[x+w,z+d],[x,z+d]]],b,t,c,id,kind);
 p.footprints.forEach((rs,i)=>prism(rs.map(r=>r.map(coord)),-.28,-.025,colours.slab,'base-'+i,'base'));
 for(const r of p.rooms){const rings=[r.polygon.map(coord)];prism(rings,-.02,r.kind==='water'?.035:.02,colours[r.kind]||colours.room,r.id,'space');}
 for(const [index,w] of p.walls.entries()){
  if(w.kind==='open')continue;
  const a=coord(w.a),b=coord(w.b),len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.01)continue;
  const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],id='wall-'+index;
  const chunk=(start,end,y0,y1,c=colours.wall,t=p.thickness,kind='wall')=>{if(end-start<.00001||y1-y0<.001)return;prism([quad(at(start),at(end),t)],y0,y1,c,id,kind,c===colours.wall?colours.cap:c);};
  if(w.kind==='glazing'){
   chunk(0,1,.12,H,colours.glass,.06,'glazing');chunk(0,1,0,.12,colours.frame,.1,'frame');chunk(0,1,H-.10,H,colours.frame,.11,'frame');
   const n=Math.max(1,Math.round(len/2.6));for(let k=0;k<=n;k++)chunk(Math.max(0,k/n-.045/len),Math.min(1,k/n+.045/len),0,H,colours.frame,.1,'frame');continue;
  }
  const gaps=w.openings.map(g=>({...g,start:Math.max(0,g.at-g.size/2),end:Math.min(1,g.at+g.size/2)})).sort((x,y)=>x.start-y.start);let previous=0;
  for(const g of gaps){chunk(previous,g.start,0,H);const sill=g.type==='window'?.83:0,lintel=g.type==='window'?2.14:2.12;
   chunk(g.start,g.end,0,Math.min(sill,H));chunk(g.start,g.end,Math.min(lintel,H),H);
   if(g.type==='window'&&H>sill){chunk(g.start,g.end,sill,Math.min(lintel,H),colours.glass,.04,'glazing');chunk(g.start,g.end,sill,sill+.055,colours.frame,.15,'frame');}
   else if(g.type==='door'){
    // Schematic open leaf at the gap, not a claimed installed/fire-rated doorset.
    const aa=at(g.start),bb=at(g.end),delta=[bb[0]-aa[0],bb[1]-aa[1]],a1=[aa[0]+delta[0]*.55-delta[1]*.60,aa[1]+delta[1]*.55+delta[0]*.60];
    prism([quad(aa,a1,.045)],.03,Math.min(H,2.05),colours.door,'opening-'+index+'-'+g.at,'door');
   }previous=Math.max(previous,g.end);
  }chunk(previous,1,0,H);
 }
 if(furniture)for(const r of p.rooms){
  if(r.kind!=='room')continue;const pts=r.polygon.map(coord),xs=pts.map(a=>a[0]),zs=pts.map(a=>a[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),cx=(x0+x1)/2,cz=(z0+z1)/2;
  const bed=/bed|sleep/i.test(r.name),w=bed?1.5:1.7,d=bed?1.95:.9;
  if(x1-x0<w+1||z1-z0<d+1||![[cx-w/2,cz-d/2],[cx+w/2,cz+d/2],[cx+w/2,cz-d/2],[cx-w/2,cz+d/2]].every(pt=>inside(pt,pts)))continue;
  box(cx-w/2,cz-d/2,w,d,.05,bed?.5:.65,colours.furniture,r.id+'-furnishing','furniture');
  if(bed)box(cx-w/2+.07,cz-d/2+.09,w-.14,.45,.5,.60,'#eeeade',r.id+'-pillow','furniture');
 }
 const pts=objects.flatMap(o=>o.faces.flatMap(f=>f.points)),bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(const a of pts){bounds.minX=Math.min(bounds.minX,a[0]);bounds.maxX=Math.max(bounds.maxX,a[0]);bounds.minZ=Math.min(bounds.minZ,a[2]);bounds.maxZ=Math.max(bounds.maxZ,a[2]);}
 return {objects,faces:objects.flatMap(o=>o.faces),bounds,height:H,property:p,coord};
}
function projection(scene,width,height,theta=-.60,elevation=.82,zoom=1){
 const b=scene.bounds,center=[(b.minX+b.maxX)/2,scene.height*.18,(b.minZ+b.maxZ)/2],right=[Math.cos(theta),0,-Math.sin(theta)],up=[-Math.sin(theta)*Math.sin(elevation),Math.cos(elevation),-Math.cos(theta)*Math.sin(elevation)],direction=[Math.sin(theta)*Math.cos(elevation),Math.sin(elevation),Math.cos(theta)*Math.cos(elevation)];
 const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),relative=p=>p.map((v,i)=>v-center[i]),raw=p=>{const v=relative(p);return [dot(v,right),-dot(v,up),dot(v,direction)];};
 const corners=[];for(const x of [b.minX,b.maxX])for(const z of [b.minZ,b.maxZ])for(const h of [-.28,scene.height])corners.push(raw([x,h,z]));
 const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(width*.82/(maxX-minX),height*.76/(maxY-minY))*zoom;
 const offset=[width/2-(minX+maxX)/2*scale,height/2-(minY+maxY)/2*scale];
 const project=p=>{const q=raw(p);return [offset[0]+q[0]*scale,offset[1]+q[1]*scale,q[2]];};
 const floorPoint=(x,y)=>{
  const dx=(x-offset[0])/scale,dy=-(y-offset[1])/scale-(.03-center[1])*up[1],det=right[0]*up[2]-right[2]*up[0];if(Math.abs(det)<.0001)return null;
  return [center[0]+(dx*up[2]-right[2]*dy)/det,center[2]+(right[0]*dy-dx*up[0])/det];
 };
 return {project,scale,direction,floorPoint};
}
function visibleFaces(scene,p){const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);return scene.faces.filter(f=>dot(f.n,p.direction)>.0001).map(f=>({...f,screen:f.points.map(p.project),depth:f.points.reduce((n,v)=>n+p.project(v)[2],0)/f.points.length,light:.77+.23*Math.max(0,dot(f.n,[-.35,.84,.42]))})).sort((a,b)=>(a.kind==='base'?0:a.kind==='space'?1:2)-(b.kind==='base'?0:b.kind==='space'?1:2)||(a.kind==='space'&&b.kind==='space'?Math.max(...a.points.map(v=>v[1]))-Math.max(...b.points.map(v=>v[1])):0)||a.depth-b.depth);}
function svgPreview(property,width=660,height=400){const scene=geometry(property),p=projection(scene,width,height),f=visibleFaces(scene,p);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${property.name.replace(/&/g,'&amp;')} floor-plan interpretation"><rect width="100%" height="100%" fill="#edf0e9"/>${f.map(a=>`<polygon points="${a.screen.map(v=>v.slice(0,2).map(x=>x.toFixed(2)).join(',')).join(' ')}" fill="${shade(a.colour,a.light)}" stroke="${shade(a.colour,a.light)}" stroke-width=".45"/>`).join('')}</svg>`;}
class Viewer{
 constructor(canvas,{onSelect=()=>{}}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onSelect=onSelect;this.theta=-.60;this.elevation=.82;this.zoom=1;this.raf=0;this.selected=null;this.options={cutaway:true,furniture:false};this.abort=new AbortController();this.pointers=new Map();
  const listen=(type,fn,opts={})=>canvas.addEventListener(type,fn,{signal:this.abort.signal,...opts});
  listen('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,[e.clientX,e.clientY]);this.down=[e.clientX,e.clientY];this.moved=false;this.last=this.gesture();});
  listen('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,[e.clientX,e.clientY]);const g=this.gesture(),last=this.last;this.last=g;this.moved||=Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>5;if(last.count!==g.count)return;if(g.count===1){this.theta+=(g.x-last.x)*.007;this.elevation=Math.max(.35,Math.min(1.56,this.elevation+(g.y-last.y)*.006));}else if(last.distance&&g.distance)this.zoom=Math.max(.55,Math.min(4,this.zoom*g.distance/last.distance));this.invalidate();});
  listen('pointerup',e=>{const clicked=!this.moved&&this.pointers.size===1;this.pointers.delete(e.pointerId);this.last=this.gesture();if(clicked)this.pick(e);});
  for(const event of ['pointercancel','lostpointercapture'])listen(event,e=>{this.pointers.delete(e.pointerId);this.last=this.gesture();});
  listen('wheel',e=>{e.preventDefault();this.zoomBy(Math.exp(-Math.max(-80,Math.min(80,e.deltaY))*.002));},{passive:false});
  listen('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')this.reset();if(e.key==='ArrowLeft')this.theta-=.1;if(e.key==='ArrowRight')this.theta+=.1;if(e.key==='ArrowUp')this.elevation=Math.min(1.56,this.elevation+.08);if(e.key==='ArrowDown')this.elevation=Math.max(.35,this.elevation-.08);if(e.key==='+')this.zoomBy(1.12);if(e.key==='-')this.zoomBy(.88);this.invalidate();});
  this.observer=new ResizeObserver(()=>this.invalidate());this.observer.observe(canvas);}
 gesture(){const a=[...this.pointers.values()];return {count:a.length,x:a.reduce((n,p)=>n+p[0],0)/(a.length||1),y:a.reduce((n,p)=>n+p[1],0)/(a.length||1),distance:a.length===2?Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]):0};}
 set(property,options={}){this.property=property;this.options={...this.options,...options};this.scene=geometry(property,this.options);this.invalidate();}
 reset(){this.theta=-.60;this.elevation=.82;this.zoom=1;this.invalidate();}
 top(){this.theta=0;this.elevation=1.56;this.zoom=1;this.invalidate();}
 zoomBy(f){this.zoom=Math.max(.55,Math.min(4,this.zoom*f));this.invalidate();}
 select(id){this.selected=id;this.invalidate();}
 pick(e){if(!this.projection)return;const r=this.canvas.getBoundingClientRect(),p=this.projection.floorPoint((e.clientX-r.left)*this.ratio,(e.clientY-r.top)*this.ratio);if(!p)return;const found=[...this.property.rooms].reverse().find(z=>inside(p,z.polygon.map(this.scene.coord)));this.onSelect(found?.id||null);}
 invalidate(){if(this.raf)return;this.raf=requestAnimationFrame(()=>{this.raf=0;this.draw();});}
 draw(){if(!this.scene||!this.ctx)return;const rect=this.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const ratio=Math.min(globalThis.devicePixelRatio||1,1.6),w=Math.max(2,Math.round(rect.width*ratio)),h=Math.max(2,Math.round(rect.height*ratio));this.ratio=ratio;this.canvas.width=w;this.canvas.height=h;const ctx=this.ctx,p=projection(this.scene,w,h,this.theta,this.elevation,this.zoom);this.projection=p;ctx.clearRect(0,0,w,h);ctx.fillStyle='#eef1eb';ctx.fillRect(0,0,w,h);
  // Ground-plane guide, not real landscaping or a surveyed grid.
  ctx.strokeStyle='#dfe5dc';ctx.lineWidth=.6*ratio;const b=this.scene.bounds;for(let a=Math.floor(b.minX)-4;a<b.maxX+4;a+=2){const c=p.project([a,-.35,b.minZ-4]),d=p.project([a,-.35,b.maxZ+4]);ctx.beginPath();ctx.moveTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.stroke();}for(let a=Math.floor(b.minZ)-4;a<b.maxZ+4;a+=2){const c=p.project([b.minX-4,-.35,a]),d=p.project([b.maxX+4,-.35,a]);ctx.beginPath();ctx.moveTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.stroke();}
  for(const f of visibleFaces(this.scene,p)){ctx.beginPath();f.screen.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();const color=f.id===this.selected&&f.kind==='space'?'#91b7a6':shade(f.colour,f.light);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.55;ctx.fill();ctx.stroke();}
  const room=this.property.rooms.find(r=>r.id===this.selected);if(room){const poly=room.polygon.map(this.scene.coord).map(q=>p.project([q[0],.05,q[1]]));ctx.beginPath();poly.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.lineWidth=2.2*ratio;ctx.strokeStyle='#177861';ctx.stroke();}
  ctx.font=`${10*ratio}px system-ui`;ctx.fillStyle='#5d706a';if(rect.width<500){ctx.textAlign='center';ctx.fillText('SOURCE-PLAN STUDY / NOT SURVEYED',w/2,h-28*ratio);ctx.fillText('HEIGHTS & FINISHES ASSUMED',w/2,h-13*ratio);}else{ctx.textAlign='left';ctx.fillText('PROPERTYCHECKED / SOURCE-PLAN STUDY',20*ratio,h-18*ratio);ctx.textAlign='right';ctx.fillText('HEIGHTS & FINISHES ASSUMED',w-20*ratio,h-18*ratio);}
 }
 dispose(){this.abort.abort();this.observer.disconnect();cancelAnimationFrame(this.raf);}
}
function glb(property){
 const scene=geometry(property,{cutaway:false,furniture:false}),views=[],accessors=[],chunks=[];let offset=0;
 const add=(a,position=false)=>{const bytes=new Uint8Array(new Float32Array(a).buffer),v=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});offset+=bytes.length;chunks.push(bytes);const acc={bufferView:v,componentType:5126,count:a.length/3,type:'VEC3'};if(position){acc.min=[Infinity,Infinity,Infinity];acc.max=[-Infinity,-Infinity,-Infinity];a.forEach((v,i)=>{acc.min[i%3]=Math.min(acc.min[i%3],v);acc.max[i%3]=Math.max(acc.max[i%3],v);});}accessors.push(acc);return accessors.length-1;};
 const objects=scene.objects,meshes=objects.map(o=>({name:o.id,extras:{kind:o.kind,sourcePlanStudy:true,geometryApproximate:true,heightAssumed:true,notSurveyed:true},primitives:[{attributes:{POSITION:add(o.positions,true),NORMAL:add(o.normals),COLOR_0:add(Array(o.positions.length/3).fill(rgb(o.colour)).flat())},material:0}]}));
 const source=property.source,doc={asset:{version:'2.0',generator:'PropertyChecked Plan Library',copyright:source.credit+'; model adaptation: PropertyChecked; '+source.modelLicence},scene:0,scenes:[{nodes:objects.map((_,i)=>i)}],nodes:objects.map((o,i)=>({name:o.id,mesh:i})),meshes,materials:[{doubleSided:true,pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.85}}],buffers:[{byteLength:offset}],bufferViews:views,accessors,extras:{property:property.name,source:source.url,credit:source.credit,licence:source.modelLicenceUrl,changes:source.alterations,scaleBasis:property.scaleBasis,limitations:property.limitations,scope:property.level,status:'Illustrative source-plan study. Not surveyed. Not for compliance, measurement or construction.'}};
 const raw=new TextEncoder().encode(JSON.stringify(doc)),jl=(raw.length+3)&~3,out=new Uint8Array(28+jl+offset),v=new DataView(out.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,jl,true);v.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jl);out.set(raw,20);v.setUint32(20+jl,offset,true);v.setUint32(24+jl,0x004e4942,true);let at=28+jl;for(const b of chunks){out.set(b,at);at+=b.length;}return out;
}
globalThis.PC_PLAN_ENGINE={geometry,projection,svgPreview,triangulate,inside,area,Viewer,glb,colours};
})();
