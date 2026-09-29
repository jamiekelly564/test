/* Adapts the existing viewer; geometry is not regenerated or replaced. */
(() => {
  const embedded = new URLSearchParams(location.search).get('embed') === '1' || document.documentElement.classList.contains('pc-embed');
  if (!embedded) return;
  document.documentElement.classList.add('pc-embed');
  const target = location.origin;
  function post(data) { if(target === 'null') return; parent.postMessage({ source:'propertychecked-viewer', ...data }, target); }
  /** Overlay markers use only positions already in the private model, never parent-supplied coordinates. */
  function createHighlights(pc) {
    const assets=new Map(pc.assets.map(a=>[a.id,a])),root=document.createElement('div');
    root.id='pc-management-highlights';root.setAttribute('aria-label','Model-linked record highlights');
    pc.viewer.canvas.parentElement.append(root);
    let settings={enabled:false,labels:false,dim:false,selected:'',items:[]},pins=[],lastFrame=0,lastCounts='';
    const typeLetters={door:'D',space:'S',lift:'L',stairs:'St',riser:'R',window:'W',void:'V'};
    const previous=pc.viewer.onFrame;
    function set(value) {
      if(!value||typeof value!=='object'||!Array.isArray(value.items)||value.items.length>1000)return false;
      const seen=new Set();
      const items=value.items.flatMap(p=>{
        if(!p||!assets.has(p.id)||seen.has(p.id)||!/^#[a-f\d]{6}$/i.test(p.colour||''))return [];
        if(!Number.isInteger(p.count)||p.count<0||p.count>10000)return [];
        seen.add(p.id);return [{id:p.id,colour:p.colour,count:p.count,title:String(p.title||assets.get(p.id).title).slice(0,180),
          symbol:String(p.symbol||'+').slice(0,2),label:String(p.label||'Saved record').slice(0,100),reference:p.reference===true}];
      });
      settings={enabled:value.enabled===true,labels:value.labels===true,dim:value.dim===true,selected:assets.has(value.selected)?value.selected:'',items};
      root.replaceChildren();pins=items.map(p=>{
        const a=assets.get(p.id),b=document.createElement('button');b.type='button';
        b.className='pc-marker'+(p.reference?' pc-reference':'');b.style.setProperty('--pin-colour',p.colour);
        const icon=document.createElement('span');icon.className='pc-marker-icon';icon.textContent=p.reference?typeLetters[a.type]||'o':p.count>1?String(p.count):p.symbol;
        const caption=document.createElement('span');caption.className='pc-marker-label';caption.textContent=p.title;
        b.append(icon,caption);b.title=p.title+' / '+(p.reference?'Drawing location only, not a registered asset':p.count+' record(s): '+p.label);
        b.setAttribute('aria-label',b.title);b.addEventListener('click',e=>{e.stopPropagation();post({type:'highlight-select',locationId:p.id});});
        b.addEventListener('focus',()=>b.classList.add('pc-keyboard'));b.addEventListener('blur',()=>b.classList.remove('pc-keyboard'));
        root.append(b);return {a,p,b};
      });
      document.documentElement.classList.toggle('pc-layer-dim',settings.enabled&&settings.dim);
      document.documentElement.classList.toggle('pc-layer-active',settings.enabled&&items.length>0);
      root.classList.toggle('pc-labels',settings.labels);root.hidden=!settings.enabled;lastFrame=0;lastCounts='';
      return true;
    }
    function draw(time) {
      previous?.call(pc.viewer,time);
      if(time-lastFrame<65)return;lastFrame=time;
      let shown=0,total=0;const occupied=[];
      const ordered=[...pins].sort((a,b)=>(b.p.id===settings.selected?1:0)-(a.p.id===settings.selected?1:0));
      for(const {a,p,b} of ordered){
        const inFloor=pc.state.floor==='all'||String(a.floor)===String(pc.state.floor);
        if(!inFloor){b.hidden=true;continue;}total++;
        const isolated=pc.state.floor!=='all',floor=pc.PLAN.floors.find(f=>f.id===a.floor);
        if(!floor){b.hidden=true;continue;}
        const off=isolated?-floor.y:a.floor*(pc.viewer.explode||0)*2.3;
        const y=Math.min(a.pos[1]+off,isolated?(pc.state.wallHeight||2.8)+.3:Infinity);
        const q=pc.viewer.project([a.pos[0],y,a.pos[2]]);
        let show=settings.enabled&&q&&[q.x,q.y,q.z].every(Number.isFinite)&&q.z>=-1&&q.z<=1&&q.x>18&&q.x<pc.viewer.width-18&&q.y>18&&q.y<pc.viewer.height-18;
        const selected=p.id===settings.selected||b===document.activeElement;
        if(show&&!selected&&occupied.some(v=>Math.hypot(v.x-q.x,v.y-q.y)<30))show=false;
        b.hidden=!show;b.classList.toggle('pc-selected',p.id===settings.selected);
        if(show){b.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%)`;occupied.push(q);shown++;}
      }
      const counts=JSON.stringify([shown,total]);if(counts!==lastCounts){lastCounts=counts;post({type:'highlight-visibility',shown,total,hidden:total-shown});}
    }
    pc.viewer.onFrame=draw;
    function dispose(){if(pc.viewer.onFrame===draw)pc.viewer.onFrame=previous;root.remove();document.documentElement.classList.remove('pc-layer-active','pc-layer-dim');}
    addEventListener('pagehide',dispose,{once:true});
    return {set,dispose};
  }
  let managementHighlights=null;
  window.addEventListener('message', event => {
    if(event.source !== parent || event.origin !== target || event.data?.source !== 'propertychecked-app')return;
    const pc=window.PC, cmd=event.data.command;
    if(!pc?.ready)return;
    if(cmd==='highlights'){managementHighlights||=createHighlights(pc);managementHighlights.set(event.data.value);return;}
    if(cmd==='clearSelection'){pc.state.selected=null;const detail=document.getElementById('detail'),overview=document.getElementById('overview');if(detail)detail.hidden=true;if(overview)overview.hidden=false;return;}
    if(cmd==='floor'&&(event.data.value==='all'||pc.PLAN.floors.some(f=>String(f.id)===String(event.data.value))))pc.setFloor(String(event.data.value));
    else if(cmd==='mode'&&['exterior','cutaway'].includes(event.data.value))pc.setMode(event.data.value);
    else if(cmd==='select'&&pc.assets.some(a=>a.id===event.data.value))pc.select(event.data.value);
    else if(cmd==='explode')pc.toggleExplode();
    else if(cmd==='plan')pc.togglePlan();
    else if(cmd==='basis')document.getElementById('basisToggle')?.click();
    else if(cmd==='reset')document.getElementById('reset')?.click();
    else if(cmd==='pins')document.getElementById('pinsToggle')?.click();
  });
  function fitWholeBuilding(){
    const pc=window.PC;if(!pc?.viewer||pc.state.floor!=='all'||pc.state.selected)return;
    // This viewer already widens its field of view in portrait; do not multiply distance by aspect again.
    pc.viewer.setCamera({theta:-.54,phi:1.01,radius:(pc.state.exploded?105:78)*(innerWidth<800?.72:1),target:[2.5,pc.state.exploded?21:11.5,1.6]});
  }
  let last='',started=false;
  function wireFraming(){
    const pc=window.PC;
    for(const name of ['setFloor','setMode','toggleExplode']){const original=pc[name];pc[name]=(...args)=>{const result=original(...args);requestAnimationFrame(fitWholeBuilding);return result;};}
    const reset=document.getElementById('reset'),originalReset=reset?.onclick;
    if(reset)reset.onclick=event=>{originalReset?.call(reset,event);fitWholeBuilding();};
    let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fitWholeBuilding,100);});
    fitWholeBuilding();
  }
  const interval=setInterval(()=>{
    const pc=window.PC;
    if(pc?.error){post({type:'error',message:pc.error});return;}
    if(!pc?.ready)return;
    if(!started){started=true;wireFraming();post({type:'ready',capabilities:['record-highlights']});}
    const s=pc.state, selected=s.selected||null;
    const current=JSON.stringify({floor:s.floor,mode:s.mode,selected,exploded:s.exploded,plan:s.plan,basis:s.basis});
    if(current!==last){last=current;post({type:'state',state:JSON.parse(current)});}
  },350);
  addEventListener('pagehide',()=>clearInterval(interval),{once:true});
})();
