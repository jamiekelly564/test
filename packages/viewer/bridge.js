/* Adapts the existing viewer; geometry is not regenerated or replaced. */
(() => {
  const embedded = new URLSearchParams(location.search).get('embed') === '1' || document.documentElement.classList.contains('pc-embed');
  if (!embedded) return;
  document.documentElement.classList.add('pc-embed');
  const target = location.origin;
  function post(data) { if(target === 'null') return; parent.postMessage({ source:'propertychecked-viewer', ...data }, target); }
  window.addEventListener('message', event => {
    if(event.source !== parent || event.origin !== target || event.data?.source !== 'propertychecked-app')return;
    const pc=window.PC, cmd=event.data.command;
    if(!pc?.ready)return;
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
    const aspect=Math.max(.45,innerWidth/Math.max(1,innerHeight));
    pc.viewer.setCamera({theta:-.54,phi:1.01,radius:(pc.state.exploded?105:78)*Math.max(1,.95/aspect),target:[2.5,pc.state.exploded?21:11.5,1.6]});
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
    if(!started){started=true;wireFraming();post({type:'ready'});}
    const s=pc.state, selected=s.selected||null;
    const current=JSON.stringify({floor:s.floor,mode:s.mode,selected,exploded:s.exploded,plan:s.plan,basis:s.basis});
    if(current!==last){last=current;post({type:'state',state:JSON.parse(current)});}
  },350);
  addEventListener('pagehide',()=>clearInterval(interval),{once:true});
})();
