import { compileSurfaces, createSurfacePicker, resolveSurfaceHit } from '/modules/viewer/surfaces.mjs';

/** Transient hover layer over the preserved private model. No network/writes or new geometry. */
const embedded=new URLSearchParams(location.search).get('embed')==='1'||document.documentElement.classList.contains('pc-embed');
if(embedded&&location.origin!=='null'){
 const timer=setInterval(()=>{if(window.PC?.ready){clearInterval(timer);install(window.PC);}},150);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
function install(pc){
 const parentOrigin=location.origin,abort=new AbortController(),listen=(t,n,f)=>t.addEventListener(n,f,{signal:abort.signal});
 const post=m=>parent.postMessage({source:'propertychecked-viewer',...m},parentOrigin);
 const canvas=pc.viewer.canvas,compiled=compileSurfaces(pc.PLAN),picker=createSurfacePicker(pc.groups);
 const known=new Map(pc.assets.map(a=>[a.id,a])),meta=new Map();let external='',hover=null,mouse=null,lastTime=0,lastPick='',lastLabel='',priorSelected='';
 const wrap=document.createElement('div');wrap.id='pc-surface-layer';wrap.setAttribute('aria-hidden','true');
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),fill=document.createElementNS(NS,'path'),line=document.createElementNS(NS,'path');
 fill.setAttribute('fill-rule','evenodd');fill.classList.add('pc-surface-fill');line.classList.add('pc-surface-outline');svg.append(fill,line);wrap.append(svg);canvas.parentElement.append(wrap);
 const tip=document.createElement('div');tip.id='pc-surface-tip';tip.hidden=true;tip.setAttribute('role','status');
 const title=document.createElement('strong'),note=document.createElement('span');tip.append(title,note);canvas.parentElement.append(tip);
 document.documentElement.classList.add('pc-quiet-model');
 const originalPick=pc.viewer.onPick,originalFrame=pc.viewer.onFrame;
 const floorById=new Map(pc.PLAN.floors.map(f=>[f.id,f]));
 function options(){return {visible:g=>pc.viewer.visible(g),offset:g=>pc.viewer.offset(g),cap:g=>pc.state.floor!=='all'&&g.floor>=0?floorById.get(g.floor).y+(pc.state.wallHeight||2.8):Infinity};}
 function at(x,y){if(!pc.viewer.eye)return null;const hit=picker(pc.viewer.ray(x,y),options());return resolveSurfaceHit(compiled,hit);}
 function clear(){mouse=null;hover=null;lastPick='';}
 listen(canvas,'pointermove',e=>{if(e.pointerType==='touch'||e.buttons||pc.viewer.interacting){clear();return;}const r=canvas.getBoundingClientRect();mouse={x:e.clientX-r.left,y:e.clientY-r.top};external='';});
 listen(canvas,'pointerleave',clear);listen(canvas,'pointerdown',clear);listen(canvas,'wheel',clear);
 listen(window,'blur',clear);listen(window,'keydown',e=>{if(e.key==='Escape'){clear();external='';}});
 const onPick=(x,y)=>{
  const s=at(x,y);if(!s)return;
  if(s.sharedIds?.length>1){post({type:'surface-choice',locationIds:s.sharedIds.slice(0,4)});return;}
  pc.select(s.id,false);post({type:'surface-select',locationId:s.id});
 };
 pc.viewer.onPick=onPick;
 listen(window,'message',e=>{
  if(e.source!==parent||e.origin!==parentOrigin||e.data?.source!=='propertychecked-app')return;
  if(e.data.command==='hoverLocation'){external=typeof e.data.value==='string'&&known.has(e.data.value)?e.data.value:'';clear();}
  if(e.data.command==='hoverContext'&&e.data.value&&Array.isArray(e.data.value.items)&&e.data.value.items.length<=1000){
   meta.clear();for(const v of e.data.value.items){if(!v||!known.has(v.id))continue;meta.set(v.id,{title:String(v.title||known.get(v.id).title).slice(0,180),communal:v.communal===true,basis:String(v.basis||'unconfirmed').slice(0,60)});}
  }
  if(['floor','mode','explode','plan','reset','clearSelection'].includes(e.data.command)){clear();external='';}
 });
 function drawSurface(s,selected){
  const f=floorById.get(s.floor),isolated=pc.state.floor!=='all';if(!f||isolated&&String(s.floor)!==String(pc.state.floor)){wrap.hidden=true;tip.hidden=true;return;}
  const offset=pc.viewer.offset({floor:s.floor}),cap=isolated?f.y+(pc.state.wallHeight||2.8):Infinity;
  const y=Math.min(s.y,cap)+offset+.018,top=Math.min(s.top,cap)+offset+.02;
  const path=points=>{const projected=points.map(p=>pc.viewer.project(p));if(projected.some(p=>!p||p.z< -1||p.z>1))return '';return 'M'+projected.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join('L')+'Z';};
  let d='';for(const rings of s.polygons)for(const ring of rings)d+=path(ring.map(p=>[p[0],y,p[1]]));
  if(s.segment){const r=s.polygons[0][0];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];d+=path([[a[0],y,a[1]],[b[0],y,b[1]],[b[0],top,b[1]],[a[0],top,a[1]]]);}}
  let border=d;if(s.lines?.length)border=s.lines.map(([a,b])=>{const p=pc.viewer.project([a[0],y,a[1]]),q=pc.viewer.project([b[0],y,b[1]]);return p&&q?'M'+p.x+','+p.y+'L'+q.x+','+q.y:'';}).join('');
  svg.setAttribute('viewBox',`0 0 ${pc.viewer.width} ${pc.viewer.height}`);fill.setAttribute('d',d);line.setAttribute('d',border);wrap.hidden=!d;wrap.classList.toggle('pc-surface-selected',selected);wrap.classList.toggle('pc-surface-estimated',/estimated|interpolated/.test(s.basis)||/approximate|not resolved/i.test(s.boundaryBasis));
  const label=hover?.id===s.id&&s.sharedTitles?.length>1?s.sharedTitles.join(' / '):meta.get(s.id)?.title||s.title;
  const caption=(floorById.get(s.floor)?.key||'')+' / '+(/estimated|interpolated/.test(s.basis)?'Estimated location':'Model location')+' / '+s.boundaryBasis;
  if(lastLabel!==label+caption){lastLabel=label+caption;title.textContent=label;note.textContent=caption;}
  const pos=mouse||pc.viewer.project([s.anchor[0],y,s.anchor[1]]);tip.hidden=!pos||!d;
  if(pos){const xx=Math.min(pc.viewer.width-280,Math.max(10,pos.x+16)),yy=Math.min(pc.viewer.height-90,Math.max(10,pos.y+15));tip.style.left=Math.max(8,xx)+'px';tip.style.top=Math.max(8,yy)+'px';}
 }
 function frame(t){
  originalFrame?.call(pc.viewer,t);if(t-lastTime<70)return;lastTime=t;
  if(pc.viewer.interacting){clear();}
  const key=JSON.stringify([pc.state.floor,pc.state.mode,pc.state.wallHeight,pc.state.plan,pc.viewer.explode.toFixed(2),pc.viewer.current,mouse]);
  if(mouse&&key!==lastPick&&!pc.viewer.interacting){lastPick=key;hover=at(mouse.x,mouse.y);}
  if(priorSelected!==pc.state.selected){priorSelected=pc.state.selected;external='';if(!mouse)hover=null;}
  const surface=(external?compiled.byId.get(external):null)||hover||compiled.byId.get(pc.state.selected);
  canvas.style.cursor=hover?'pointer':pc.viewer.interacting?'grabbing':'grab';
  if(surface)drawSurface(surface,!hover||pc.state.selected===surface.id);else{wrap.hidden=true;tip.hidden=true;}
 }
 pc.viewer.onFrame=frame;
 listen(window,'pagehide',()=>{abort.abort();if(pc.viewer.onFrame===frame)pc.viewer.onFrame=originalFrame;if(pc.viewer.onPick===onPick)pc.viewer.onPick=originalPick;wrap.remove();tip.remove();document.documentElement.classList.remove('pc-quiet-model');});
 post({type:'hover-ready',bounded:compiled.surfaces.length,unbounded:compiled.unbounded.length});
}
