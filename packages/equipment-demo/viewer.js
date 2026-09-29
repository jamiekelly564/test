import { compileSurfaces, createSurfacePicker } from '/modules/viewer/surfaces.mjs';
import { typeById } from '/modules/equipment-demo/model.mjs';
import { placeEquipment, buildEquipmentGroups, equipmentGLB } from '/modules/equipment-demo/geometry.mjs';
const embedded=new URLSearchParams(location.search).get('embed')==='1';
if(embedded&&location.origin!=='null'){
 let timer=setInterval(()=>{if(window.PC?.ready){clearInterval(timer);setTimeout(()=>install(window.PC),350);}},150);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
function install(pc){
 const viewer=pc.viewer,canvas=viewer.canvas,origin=location.origin,abort=new AbortController();
 const send=m=>parent.postMessage({source:'propertychecked-equipment-viewer',...m},origin);
 const listen=(t,n,f,opts={})=>t.addEventListener(n,f,{signal:abort.signal,...opts});
 const originalGroups=viewer.groups,originalTris=viewer.tris,originalPick=viewer.onPick,originalFrame=viewer.onFrame;
 const originalVisible=viewer.visible,known=new Map(pc.assets.map(a=>[a.id,a]));
 let showObjects=true,enabled=false,objects=[],issues=[],category='',selected='',size=1.5,groups=[],placements=[],unplaced=[],signature='',hover=null,mouse=null,lastTime=0,compiled=null,basePicker=null,objectPicker=null;
 const root=document.createElement('div');root.id='pc-equipment-overlays';root.hidden=true;root.innerHTML='<div class="pc-demo-watermark">DEMO EQUIPMENT / POSITIONS NOT SURVEYED</div><div class="pc-demo-issue-pins"></div><div class="pc-demo-hover" hidden></div>';
 canvas.parentElement.append(root);const pins=root.querySelector('.pc-demo-issue-pins'),tip=root.querySelector('.pc-demo-hover');
 const ns='http://www.w3.org/2000/svg',outline=document.createElementNS(ns,'svg'),shape=document.createElementNS(ns,'path');outline.classList.add('pc-demo-object-outline');outline.append(shape);root.prepend(outline);outline.setAttribute('hidden','');
 function showOutline(g){if(!g||!viewer.visible(g)){outline.setAttribute('hidden','');return;}const pts=[],off=viewer.offset(g);for(let i=0;i<g.vertices.length;i+=10){const p=viewer.project([g.vertices[i],g.vertices[i+1]+off,g.vertices[i+2]]);if(p&&p.z>=-1&&p.z<=1)pts.push([p.x,p.y]);}pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const half=points=>{const h=[];for(const p of points){while(h.length>1&&turn(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};const lo=half(pts),hi=half([...pts].reverse()),hull=[...lo.slice(0,-1),...hi.slice(0,-1)];outline.toggleAttribute('hidden',hull.length<3);outline.setAttribute('viewBox',`0 0 ${viewer.width} ${viewer.height}`);shape.setAttribute('d',hull.length?'M'+hull.map(p=>p.join(',')).join('L')+'Z':'');}
 let markers=[];
 viewer.visible=function(g){if(g.kind==='demo-equipment')return enabled&&showObjects&&(!category||g.category===category)&&(pc.state.floor==='all'||String(g.floor)===String(pc.state.floor))&&!pc.state.plan;return originalVisible.call(this,g);};
 function release(){for(const g of groups){if(viewer.gl){viewer.gl.deleteBuffer(g.buffer);viewer.gl.deleteVertexArray(g.vao);}}groups=[];viewer.groups=originalGroups;if(viewer.tris)viewer.tris=originalTris;viewer.shadowDirty=true;viewer.redraw=true;}
 function prepareGroup(g){
  const gl=viewer.gl;if(gl){g.vao=gl.createVertexArray();gl.bindVertexArray(g.vao);g.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.bufferData(gl.ARRAY_BUFFER,g.vertices,gl.STATIC_DRAW);for(const [i,s,o] of [[0,3,0],[1,3,12],[2,3,24],[3,1,36]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,s,gl.FLOAT,false,40,o);}}
  const arr=[],d=g.vertices;for(let i=0;i<d.length;i+=30){const n=[d[i+3],d[i+4],d[i+5]],intensity=.51+.13*n[1]+.56*Math.max(0,n[0]*-.456+n[1]*.776+n[2]*.383);arr.push({a:[d[i],d[i+1],d[i+2]],b:[d[i+10],d[i+11],d[i+12]],c:[d[i+20],d[i+21],d[i+22]],n,color:[d[i+6],d[i+7],d[i+8]].map(v=>Math.round(Math.min(255,Math.max(0,v*intensity*255))))});}return {g,arr};
 }
 function rebuild(){
  release();if(!enabled)return;
  const output=buildEquipmentGroups(placements,{size,capFloor:pc.state.floor,wallHeight:pc.state.wallHeight||2.8});groups=output;for(const g of groups)g.category=typeById.get(objects.find(o=>o.id===g.demoId).style).category;
  const extra=groups.map(prepareGroup);viewer.groups=[...originalGroups,...groups];if(originalTris)viewer.tris=[...originalTris,...extra];
  objectPicker=createSurfacePicker(groups);viewer.shadowDirty=true;viewer.redraw=true;hover=null;tip.hidden=true;
 }
 function makePins(){pins.replaceChildren();markers=[];const buckets=new Map();
  for(const i of issues){if(category&&i.category!==category)continue;const g=groups.find(g=>g.demoId===i.assetId),a=known.get(i.locationId);if(!g&&!a)continue;const key=g?.demoId||a.id;if(!buckets.has(key))buckets.set(key,{g,a,items:[]});buckets.get(key).items.push(i);}
  for(const v of buckets.values()){
   const b=document.createElement('button');b.type='button';b.className='pc-demo-issue';b.textContent=v.items.length>1?String(v.items.length):'!';b.title='DEMO: '+v.items[0].title;b.setAttribute('aria-label',b.title);b.onclick=e=>{e.stopPropagation();send({type:'select',id:v.items[0].id});};pins.append(b);markers.push({...v,b});
  }
 }
 function focus(id){const p=placements.find(p=>p.id===id);if(!p)return;selected=id;pc.setFloor(String(p.floor));pc.setMode('cutaway');pc.state.selected=null;rebuild();makePins();
  const g=groups.find(g=>g.demoId===id),a=g.anchor;viewer.setCamera({theta:p.rotation,phi:.66,radius:6.5,target:[a[0],Math.max(.35,a[1]-p.floorY),a[2]]});signature=JSON.stringify([pc.state.floor,pc.state.wallHeight,size]);send({type:'focused',id});
 }
 listen(window,'message',e=>{
  if(e.source!==parent||e.origin!==origin||e.data?.source!=='propertychecked-equipment-demo')return;
  const m=e.data;
  if(m.command==='focus'&&typeof m.id==='string')return focus(m.id);
  if(m.command==='export'&&enabled){const bytes=equipmentGLB(buildEquipmentGroups(placements,{size:1}));const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='DEMO-Marketfield-illustrative-equipment.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);return;}
  if(m.command!=='display'||!m.value||typeof m.value.enabled!=='boolean')return;
  const v=m.value;
  if(!v.enabled){enabled=false;release();root.hidden=true;document.documentElement.classList.remove('pc-equipment-demo-active','pc-demo-object-hover');hover=null;return;}
  if(!Array.isArray(v.objects)||v.objects.length>400||!Array.isArray(v.issues)||v.issues.length>500||![1,1.5,2].includes(v.size))return;
  const ids=new Set(),safe=[];for(const o of v.objects){if(!o||typeof o.id!=='string'||!/^demo-equipment-[a-zA-Z0-9-]{1,150}$/.test(o.id)||ids.has(o.id)||!typeById.has(o.style)||!known.has(o.locationId)||!Number.isInteger(o.slot)||o.slot<0||o.slot>50)return;ids.add(o.id);safe.push({id:o.id,style:o.style,locationId:o.locationId,slot:o.slot});}
  const same=JSON.stringify(objects)===JSON.stringify(safe);enabled=true;showObjects=v.showObjects!==false;objects=safe;size=v.size;category=typeof v.category==='string'?v.category.slice(0,32):'';
  issues=v.issues.filter(i=>i&&typeof i.id==='string'&&/^demo-issue-/.test(i.id)&&known.has(i.locationId)).map(i=>({id:i.id,assetId:ids.has(i.assetId)?i.assetId:null,locationId:i.locationId,title:String(i.title||'Illustrative issue').slice(0,240),category:String(i.category||'other').slice(0,32)}));
  compiled||=compileSurfaces(pc.PLAN);basePicker||=createSurfacePicker(originalGroups);
  if(!same||!placements.length){const p=placeEquipment(pc.PLAN,objects,compiled);placements=p.placed;unplaced=p.unplaced;}
  rebuild();makePins();root.hidden=false;document.documentElement.classList.add('pc-equipment-demo-active');signature='';
  send({type:'placement',placed:placements.length,unplaced:unplaced.length,unplacedIds:unplaced});
 });
 function opts(){return {visible:g=>viewer.visible(g),offset:g=>viewer.offset(g),cap:g=>pc.state.floor!=='all'&&g.floor>=0?pc.PLAN.floors.find(f=>f.id===g.floor).y+(pc.state.wallHeight||2.8):Infinity};}
 function hitAt(x,y){if(!enabled||!objectPicker||!viewer.eye)return null;const ray=viewer.ray(x,y),o=opts(),hit=objectPicker(ray,o);if(!hit)return null;const base=basePicker(ray,{...o,maxDistance:hit.distance-.01});return base?null:hit.group;}
 const pick=(x,y)=>{const hit=hitAt(x,y);if(hit){selected=hit.demoId;send({type:'select',id:hit.demoId});return;}originalPick?.call(viewer,x,y);};viewer.onPick=pick;
 listen(canvas,'pointermove',e=>{if(!enabled||e.buttons||e.pointerType==='touch'){mouse=null;hover=null;return;}const r=canvas.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];});
 for(const event of ['pointerleave','pointerdown','wheel'])listen(canvas,event,()=>{mouse=null;hover=null;tip.hidden=true;});
 function frame(t){
  originalFrame?.call(viewer,t);if(!enabled||t-lastTime<90)return;lastTime=t;
  const sig=JSON.stringify([pc.state.floor,pc.state.wallHeight,size]);if(signature!==sig){signature=sig;rebuild();makePins();}
  if(mouse&&!viewer.interacting){hover=hitAt(...mouse);if(hover){const title=typeById.get(objects.find(o=>o.id===hover.demoId).style).label;tip.replaceChildren();const h=document.createElement('strong');h.textContent=title;const p=document.createElement('span');p.textContent='DEMO / click for equipment, checks and example faults';tip.append(h,p);tip.style.left=Math.max(8,Math.min(viewer.width-280,mouse[0]+15))+'px';tip.style.top=Math.max(8,Math.min(viewer.height-80,mouse[1]+16))+'px';tip.hidden=false;canvas.style.cursor='pointer';}else tip.hidden=true;}
  document.documentElement.classList.toggle('pc-demo-object-hover',!!hover);showOutline(hover||groups.find(g=>g.demoId===selected));
  let shown=0;const spots=[];for(const m of markers){const floor=m.g?.floor??m.a.floor;if(pc.state.floor!=='all'&&String(floor)!==String(pc.state.floor)){m.b.hidden=true;continue;}
   const a=m.g?.anchor||m.a.pos,off=viewer.offset({floor}),point=[a[0],a[1]+off+.2,a[2]],q=viewer.project(point);let show=q&&[q.x,q.y,q.z].every(Number.isFinite)&&q.z>=-1&&q.z<=1&&q.x>15&&q.y>20&&q.x<viewer.width-20&&q.y<viewer.height-20;
   if(show&&spots.some(p=>Math.hypot(q.x-p.x,q.y-p.y)<28))show=false;m.b.hidden=!show;if(show){m.b.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%)`;spots.push(q);shown++;}}
  root.dataset.visibleIssues=String(shown);
 }
 viewer.onFrame=frame;
 listen(window,'pagehide',()=>{release();viewer.visible=originalVisible;if(viewer.onPick===pick)viewer.onPick=originalPick;if(viewer.onFrame===frame)viewer.onFrame=originalFrame;root.remove();abort.abort();});
 send({type:'ready'});
}
