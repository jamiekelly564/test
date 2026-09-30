import { getScene, uploadGroup } from '/modules/viewer/scene.mjs';
import { createSurfacePicker, displayPoint } from '/modules/viewer/surfaces.mjs';
import { typeById, issueStage, issueGlyph, issueIconSVG, primaryIssue, aerialCamera, eyeLevelCandidates } from '/modules/equipment-demo/model.mjs';
import { placeEquipment, buildEquipmentGroups, equipmentGLB } from '/modules/equipment-demo/geometry.mjs';
const embedded=new URLSearchParams(location.search).get('embed')==='1';
if(embedded&&location.origin!=='null'){
 let timer=setInterval(()=>{if(window.PC?.ready){clearInterval(timer);setTimeout(()=>install(window.PC),350);}},150);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
function install(pc){
 const scene=getScene(pc);
 const viewer=pc.viewer,canvas=viewer.canvas,origin=location.origin,abort=new AbortController();
 const send=m=>parent.postMessage({source:'propertychecked-equipment-viewer',...m},origin);
 const listen=(t,n,f,opts={})=>t.addEventListener(n,f,{signal:abort.signal,...opts});
 const originalGroups=viewer.groups,originalTris=viewer.tris,originalPick=viewer.onPick,originalFrame=viewer.onFrame;
 const originalVisible=viewer.visible,known=new Map(pc.assets.map(a=>[a.id,a]));
 let showObjects=true,enabled=false,objects=[],issues=[],category='',selected='',size=1,groups=[],placements=[],unplaced=[],signature='',hover=null,mouse=null,lastTime=0,compiled=null,basePicker=null,objectPicker=null,showMarkers=true,showWorking=true,stageFilter='',cameraView='aerial',geometryKey='',pinKey='',drawKey='',hoverKey='',outlineKey='',reasons={};
 const root=document.createElement('div');root.id='pc-equipment-overlays';root.hidden=true;root.innerHTML='<div class="pc-demo-watermark">DEMO EQUIPMENT / POSITIONS NOT SURVEYED</div><div class="pc-demo-issue-pins"></div><div class="pc-demo-hover" hidden></div>';
 canvas.parentElement.append(root);const pins=root.querySelector('.pc-demo-issue-pins'),tip=root.querySelector('.pc-demo-hover');
 const ns='http://www.w3.org/2000/svg',outline=document.createElementNS(ns,'svg'),shape=document.createElementNS(ns,'path');outline.classList.add('pc-demo-object-outline');outline.append(shape);root.prepend(outline);outline.setAttribute('hidden','');
 function showOutline(g){const key=(g?.demoId||'')+'|'+scene.key;if(key===outlineKey)return;outlineKey=key;if(!g||!viewer.visible(g)){outline.setAttribute('hidden','');return;}const pts=[],off=viewer.offset(g);for(const x of [g.bounds.lo[0],g.bounds.hi[0]])for(const y of [g.bounds.lo[1],g.bounds.hi[1]])for(const z of [g.bounds.lo[2],g.bounds.hi[2]]){const p=viewer.project([x,y+off,z]);if(p&&p.z>=-1&&p.z<=1)pts.push([p.x,p.y]);}pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const half=points=>{const h=[];for(const p of points){while(h.length>1&&turn(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};const lo=half(pts),hi=half([...pts].reverse()),hull=[...lo.slice(0,-1),...hi.slice(0,-1)];outline.toggleAttribute('hidden',hull.length<3);outline.setAttribute('viewBox',`0 0 ${viewer.width} ${viewer.height}`);shape.setAttribute('d',hull.length?'M'+hull.map(p=>p.join(',')).join('L')+'Z':'');}
 let markers=[];
 viewer.visible=function(g){if(g.kind==='demo-equipment')return enabled&&showObjects&&(!category||g.category===category)&&(pc.state.floor==='all'||String(g.floor)===String(pc.state.floor))&&!pc.state.plan;return originalVisible.call(this,g);};
 function release(){for(const g of groups)if(viewer.gl){viewer.gl.deleteBuffer(g.buffer);viewer.gl.deleteVertexArray(g.vao);}groups=[];viewer.groups=originalGroups;if(viewer.tris)viewer.tris=originalTris;geometryKey='';scene.invalidate();}
 function rebuild(){
  if(!enabled)return;const key=JSON.stringify([objects,size]);if(key===geometryKey)return;
  compiled=scene.compiled;basePicker=scene.picker;const result=placeEquipment(pc.PLAN,objects,compiled,{size}),next=buildEquipmentGroups(result.placed,{size});
  for(const g of next)g.category=typeById.get(objects.find(o=>o.id===g.demoId).style).category;
  const extra=next.map(g=>uploadGroup(viewer,g));release();placements=result.placed;unplaced=result.unplaced;reasons=result.reasons;groups=next;
  viewer.groups=[...originalGroups,...groups];if(originalTris)viewer.tris=[...originalTris,...extra];objectPicker=createSurfacePicker(groups);
  geometryKey=key;pinKey='';drawKey='';outlineKey='';hoverKey='';hover=null;tip.hidden=true;scene.stats.geometryBuilds++;scene.invalidate();
 }
 function makePins(){
  const key=JSON.stringify([issues,category,stageFilter,showMarkers,showWorking,geometryKey]);if(key===pinKey)return;pinKey=key;drawKey='';pins.replaceChildren();markers=[];if(!showMarkers)return;const buckets=new Map();
  for(const i of issues){
   const stage=issueStage(i);if(!stage.rank||!showWorking&&stage.key==='working'||stageFilter&&stage.key!==stageFilter||category&&i.category!==category)continue;
   const g=groups.find(g=>g.demoId===i.assetId),a=known.get(i.locationId);if(objects.some(o=>o.id===i.assetId)&&!g||!g&&!a)continue;
   const key=g?.demoId||a.id;if(!buckets.has(key))buckets.set(key,{g,a,items:[]});buckets.get(key).items.push(i);
  }
  for(const v of buckets.values()){
   const primary=primaryIssue(v.items),stage=issueStage(primary),asset=objects.find(o=>o.id===primary.assetId);
   const b=document.createElement('button');b.type='button';b.className='pc-demo-issue rag-'+stage.key;
   b.innerHTML=issueIconSVG(issueGlyph(primary,asset));
   const status=document.createElement('span');status.className='pc-rag-state';status.textContent=stage.key==='working'?'\u2713':stage.key==='progress'?'\u2026':'!';b.append(status);
   if(v.items.length>1){const n=document.createElement('span');n.className='pc-rag-count';n.textContent=String(v.items.length);b.append(n);}
   b.title='DEMO / '+stage.label+' / '+primary.title+(asset?' / '+typeById.get(asset.style).label:'')+(v.items.length>1?' / '+v.items.length+' linked issues':'');
   b.setAttribute('aria-label',b.title);b.dataset.issueId=primary.id;b.dataset.stage=stage.key;
   b.onclick=e=>{e.stopPropagation();send({type:'select',id:primary.id});};pins.append(b);markers.push({...v,b});
  }
 }
 function focus(id,view='aerial',locationOnly=false){
  if(!enabled||!['aerial','eye'].includes(view))return;
  const p=locationOnly?null:placements.find(p=>p.id===id),obj=objects.find(o=>o.id===id);
  const a=known.get(locationOnly?id:p?.locationId||obj?.locationId),floor=pc.PLAN.floors.find(f=>f.id===(p?.floor??a?.floor));
  if(!floor||(!p&&!a)){send({type:'focus-error'});return;}
  const wasFloor=pc.state.floor;selected=p?.id||a.id;hover=null;mouse=null;tip.hidden=true;viewer.auto=false;
  pc.setFloor(String(floor.id));pc.setMode('cutaway');pc.state.plan=false;pc.state.exploded=false;pc.state.wallHeight=2.8;
  pc.state.selected=p?null:a.id;
  const heightControl=document.getElementById('wallHeight');if(heightControl)heightControl.value=String(pc.state.wallHeight);
  const heightLabel=document.getElementById('wallValue');if(heightLabel)heightLabel.textContent=pc.state.wallHeight.toFixed(2)+' m';
  // Focusing an issue deliberately reveals its object, even after its layer was hidden.
  if(p){showObjects=true;const cat=typeById.get(obj?.style)?.category;if(category&&cat!==category)category='';}
  rebuild();makePins();
  const g=groups.find(g=>g.demoId===p?.id),raw=g?.anchor||a.pos,anchor=[raw[0],g?raw[1]-floor.y:.65,raw[2]];
  const points=pc.PLAN.shapes.filter(s=>s.f===floor.id&&s.kind==='slab').flatMap(s=>s.p),top=()=>aerialCamera(anchor,points,viewer.width,viewer.height);
  let camera=top(),actual='aerial';
  if(view==='eye'){
   const region=compiled?.byId.get(p?.locationId||obj?.locationId||a?.id);
   const candidate=eyeLevelCandidates(anchor,p?.rotation||0).find(c=>{
    if(!region||![[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([x,z])=>region.contains([c.eye[0]+x,c.eye[2]+z])))return false;
    const delta=anchor.map((v,i)=>v-c.eye[i]),distance=Math.hypot(...delta);
    return !basePicker({origin:c.eye,dir:delta.map(v=>v/distance)},{...opts(),maxDistance:distance-.15});
   });
   if(candidate){camera=candidate.camera;actual='eye';}
   // No collision-free eye-level position: keep a full-height aerial view.
  }
  if(heightControl)heightControl.value=String(pc.state.wallHeight);if(heightLabel)heightLabel.textContent=pc.state.wallHeight.toFixed(2)+' m';
  cameraView=actual;viewer.setCamera(camera,wasFloor!==String(floor.id)||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  signature='';drawKey='';outlineKey='';scene.invalidate();
  send({type:'focused',id,view:actual,fallback:actual!==view});
 }
 listen(window,'message',e=>{
  if(e.source!==parent||e.origin!==origin||e.data?.source!=='propertychecked-equipment-demo')return;
  const m=e.data;
  if(m.command==='focus'&&typeof m.id==='string')return focus(m.id,m.view||'aerial');
  if(m.command==='focusLocation'&&typeof m.id==='string'&&known.has(m.id))return focus(m.id,m.view||'aerial',true);
  if(m.command==='clearFocus'){selected='';pc.state.selected=null;hover=null;mouse=null;tip.hidden=true;return;}
  if(m.command==='export'&&enabled){const bytes=equipmentGLB(buildEquipmentGroups(placements,{size:1}));const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='DEMO-Marketfield-illustrative-equipment.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);return;}
  if(m.command!=='display'||!m.value||typeof m.value.enabled!=='boolean')return;
  const v=m.value;
  if(!v.enabled){enabled=false;release();root.hidden=true;document.documentElement.classList.remove('pc-equipment-demo-active','pc-demo-object-hover');hover=null;selected='';mouse=null;scene.hoverOwner=null;outline.setAttribute('hidden','');return;}
  if(!Array.isArray(v.objects)||v.objects.length>400||!Array.isArray(v.issues)||v.issues.length>500||![1,1.5,2].includes(v.size))return;
  const ids=new Set(),safe=[];for(const o of v.objects){if(!o||typeof o.id!=='string'||!/^demo-equipment-[a-zA-Z0-9-]{1,150}$/.test(o.id)||ids.has(o.id)||!typeById.has(o.style)||!known.has(o.locationId)||!Number.isInteger(o.slot)||o.slot<0||o.slot>50)return;ids.add(o.id);safe.push({id:o.id,style:o.style,locationId:o.locationId,slot:o.slot});}
  const oldVisibility=JSON.stringify([showObjects,category]);enabled=true;showObjects=v.showObjects!==false;objects=safe;size=v.size;showMarkers=v.showMarkers!==false;showWorking=v.showWorking!==false;stageFilter=['found','progress','working'].includes(v.stageFilter)?v.stageFilter:'';cameraView=['aerial','eye'].includes(v.view)?v.view:'aerial';category=typeof v.category==='string'?v.category.slice(0,32):'';
  const seenIssues=new Set();
  issues=v.issues.filter(i=>{if(!i||typeof i.id!=='string'||!/^demo-issue-[a-zA-Z0-9-]{1,150}$/.test(i.id)||seenIssues.has(i.id)||!known.has(i.locationId)||!['open','in_progress','awaiting_review','resolved'].includes(i.status))return false;seenIssues.add(i.id);return true;}).map(i=>({kind:'issue',status:i.status,id:i.id,assetId:ids.has(i.assetId)?i.assetId:null,locationId:i.locationId,title:String(i.title||'Illustrative issue').slice(0,240),category:String(i.category||'other').slice(0,32)}));
  rebuild();makePins();root.hidden=false;document.documentElement.classList.add('pc-equipment-demo-active');
  if(oldVisibility!==JSON.stringify([showObjects,category]))scene.invalidate();drawKey='';outlineKey='';
  send({type:'placement',placed:placements.length,unplaced:unplaced.length,unplacedIds:unplaced,reasons});
 });
 // The stock orbit wheel has a nine-metre minimum; keep eye-level zoom local instead.
 listen(canvas,'wheel',e=>{if(!enabled||cameraView!=='eye'||!selected)return;e.preventDefault();e.stopImmediatePropagation();viewer.auto=false;viewer.camera.radius=Math.max(.8,Math.min(15,viewer.camera.radius*Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015)));mouse=null;hover=null;tip.hidden=true;},{capture:true,passive:false});
 function opts(){return scene.pickOptions();}
 function hitAt(x,y){if(!enabled||!objectPicker||!viewer.eye)return null;scene.stats.picks++;const ray=viewer.ray(x,y),o=opts(),hit=objectPicker(ray,o);if(!hit)return null;const base=basePicker(ray,{...o,maxDistance:hit.distance-.01});return base?null:hit.group;}
 const pick=(x,y)=>{const hit=hitAt(x,y);if(hit){selected=hit.demoId;send({type:'select',id:hit.demoId});return;}originalPick?.call(viewer,x,y);};viewer.onPick=pick;
 listen(canvas,'pointermove',e=>{if(!enabled||e.buttons||e.pointerType==='touch'){mouse=null;hover=null;return;}const r=canvas.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];});
 for(const event of ['pointerleave','pointerdown','wheel'])listen(canvas,event,()=>{mouse=null;hover=null;tip.hidden=true;});
 function frame(t){
  if(!enabled){scene.hoverOwner=null;originalFrame?.call(viewer,t);return;}
  const hk=scene.key+'|'+mouse?.join(',');
  if(mouse&&hk!==hoverKey&&!scene.inMotion){hoverKey=hk;hover=hitAt(...mouse);if(hover){const title=typeById.get(objects.find(o=>o.id===hover.demoId).style).label;tip.replaceChildren();const h=document.createElement('strong');h.textContent=title;const p=document.createElement('span');p.textContent='DEMO / click for equipment, checks and example faults';tip.append(h,p);tip.style.left=Math.max(8,Math.min(viewer.width-280,mouse[0]+15))+'px';tip.style.top=Math.max(8,Math.min(viewer.height-80,mouse[1]+16))+'px';tip.hidden=false;canvas.style.cursor='pointer';}else tip.hidden=true;}
  scene.hoverOwner=hover?'equipment':null;originalFrame?.call(viewer,t);document.documentElement.classList.toggle('pc-demo-object-hover',!!hover);showOutline(hover||groups.find(g=>g.demoId===selected));
  const dk=scene.key+'|'+selected+'|'+document.activeElement?.dataset.issueId;if(dk===drawKey)return;drawKey=dk;
  let shown=0;const spots=[];const ordered=[...markers].sort((a,b)=>Number(b.g?.demoId===selected||b.a?.id===selected||b.b===document.activeElement)-Number(a.g?.demoId===selected||a.a?.id===selected||a.b===document.activeElement));for(const m of ordered){const floor=m.g?.floor??m.a.floor;if(!scene.isLocationVisible(m.g?.locationId||m.a.id)||pc.state.plan||pc.state.floor!=='all'&&String(floor)!==String(pc.state.floor)){m.b.hidden=true;continue;}
   const point=displayPoint(viewer,floor,m.g?.anchor||m.a.pos),q=point&&viewer.project(point);let show=q&&[q.x,q.y,q.z].every(Number.isFinite)&&q.z>=-1&&q.z<=1&&q.x>15&&q.y>20&&q.x<viewer.width-20&&q.y<viewer.height-20;
   const chosen=m.g?.demoId===selected||m.a?.id===selected||m.b===document.activeElement;m.b.classList.toggle('is-selected',chosen);if(show&&!chosen&&spots.some(p=>Math.hypot(q.x-p.x,q.y-p.y)<42))show=false;m.b.hidden=!show;if(show){m.b.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%)`;spots.push(q);shown++;}}
  root.dataset.visibleIssues=String(shown);
 }
 viewer.onFrame=frame;
 listen(window,'pagehide',()=>{release();viewer.visible=originalVisible;if(viewer.onPick===pick)viewer.onPick=originalPick;if(viewer.onFrame===frame)viewer.onFrame=originalFrame;root.remove();abort.abort();});
 send({type:'ready'});
}
