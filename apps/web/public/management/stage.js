import { buildLayerView, tones, systemColours, layerGroups, referenceTypes, viewModes } from '/modules/management/layers.mjs';
import { categories } from '/modules/management/catalog.mjs';
import { escapeHtml as esc } from '/api.js';

/** Full-viewport shell. It only visualises the application's existing authorised snapshot. */
export function installStage({state,kindGroups,renderPanel,postModel,selectedLocation,toast}) {
  const $=id=>document.getElementById(id),abort=new AbortController();
  const ui={mode:'all',colourBy:'status',references:[],enabled:true,labels:false,dim:false,focus:false,
    left:innerWidth>600,right:innerWidth>1180,first:true,stale:false};
  let signature='',lastData=null,lastView=null,lastKey='',lastSent='',lastFloors='',lastSystems='',lastRefs='',lastStatus='';
  const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
  function filter(){return {mode:ui.mode,colourBy:ui.colourBy,referenceTypes:ui.references,floor:state.floor,
    category:state.category,kind:state.kind,kinds:kindGroups[state.tab]||[],query:state.query,
    location:state.location,includeClosed:$('include-closed').checked};}
  function view(){if(!state.data)return {matches:[],highlights:[],unlocated:[],counts:{},floors:[],systems:{},locatedRecords:0,locatedPlaces:0,referenceCount:0};
    const f=filter(),k=JSON.stringify(f);if(state.data!==lastData||k!==lastKey){lastData=state.data;lastKey=k;lastView=buildLayerView(state.data,f);}return lastView;}
  function panes(){
    document.body.classList.toggle('no-layers',!ui.left);document.body.classList.toggle('no-records',!ui.right);document.body.classList.toggle('focus-mode',ui.focus);
    for(const [id,open] of [['layers-toggle',ui.left&&!ui.focus],['records-toggle',ui.right&&!ui.focus]])$(id).setAttribute('aria-expanded',String(open));
    $('layer-panel').inert=!ui.left||ui.focus;$('records-dock').inert=!ui.right||ui.focus;
    $('focus-toggle').setAttribute('aria-pressed',String(ui.focus));$('focus-toggle').textContent=ui.focus?'Show panels':'Focus model';
  }
  function toggle(which,value){ui.focus=false;ui[which]=value??!ui[which];if(innerWidth<=1180&&ui[which])ui[which==='left'?'right':'left']=false;panes();}
  const redraw=()=>renderPanel();
  function reset(){ui.mode='all';state.category='';state.kind='';state.query='';state.location='';state.tab='overview';$('search').value='';$('include-closed').checked=false;
    selectedLocation('');postModel('clearSelection');redraw();}
  $('highlight-mode').innerHTML=viewModes.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  listen($('highlight-mode'),'change',()=>{ui.mode=$('highlight-mode').value;state.location='';postModel('clearSelection');if(ui.mode==='unlocated'){state.floor='all';postModel('floor','all');}redraw();});
  listen($('colour-by'),'change',()=>{ui.colourBy=$('colour-by').value;redraw();});
  for(const [id,key] of [['highlights-on','enabled'],['labels-on','labels'],['dim-model','dim']])listen($(id),'change',()=>{ui[key]=$(id).checked;sync();});
  for(const [id,which,value] of [['layers-toggle','left'],['records-toggle','right'],['layers-close','left',false],['records-close','right',false]])listen($(id),'click',()=>{toggle(which,value);if(value===false)$(which==='left'?'layers-toggle':'records-toggle').focus();});
  listen($('focus-toggle'),'click',()=>{ui.focus=!ui.focus;panes();});
  listen($('reset-layers'),'click',reset);
  listen($('scope-open'),'click',()=>{$('catalogue-dialog').showModal();document.querySelector('.more-menu').open=false;});
  listen($('system-layers'),'click',e=>{const b=e.target.closest('[data-layer]');if(!b)return;const id=b.dataset.layer;if(id&&!categories.some(c=>c.id===id))return;
    state.category=state.category===id?'':id;state.location='';state.kind='';state.tab='overview';postModel('clearSelection');redraw();});
  listen($('reference-types'),'change',()=>{ui.references=[...$('reference-types').querySelectorAll('input:checked')].map(c=>c.value);redraw();});
  listen($('floor-rail'),'click',e=>{const b=e.target.closest('[data-layer-floor]');if(!b)return;$('floor').value=b.dataset.layerFloor;$('floor').dispatchEvent(new Event('change'));});
  listen($('scope-summary'),'click',e=>{if(e.target.closest('[data-not-located]')){ui.mode='unlocated';state.location='';state.floor='all';state.tab='overview';state.kind='';postModel('floor','all');redraw();}});
  listen($('selection-chip'),'click',()=>{selectedLocation('');postModel('clearSelection');});
  listen($('full-screen'),'click',async()=>{
    try {if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Browser fullscreen is unavailable. The workspace already fills this browser window.');}
    catch {toast('Browser fullscreen was not allowed. The full-window workspace remains available.');}
  });
  listen(document,'fullscreenchange',()=>{const on=!!document.fullscreenElement;$('full-screen').textContent=on?'Exit full screen':'Full screen';$('full-screen').setAttribute('aria-pressed',String(on));});
  listen(window,'keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&ui.focus){ui.focus=false;panes();$('focus-toggle').focus();}});
  listen(window,'pagehide',()=>abort.abort());
  listen(window,'resize',()=>{if(innerWidth<=1180&&ui.left&&ui.right)ui.right=false;panes();});
  listen(window,'message',event=>{
    if(event.origin!==location.origin||event.source!==$('model').contentWindow||event.data?.source!=='propertychecked-viewer')return;
    const m=event.data;
    if(m.type==='ready'){lastSent='';sync();}
    if(m.type==='highlight-select'&&state.data?.locations.some(l=>l.id===m.locationId)){
      selectedLocation(m.locationId);toggle('right',true);
      // All matching records at this point stay accessible, including several systems sharing a location.
      $('panel-title').focus({preventScroll:true});
    }
    if(m.type==='highlight-visibility'){
      const {shown,total,hidden}=m;
      if(![shown,total,hidden].every(n=>Number.isInteger(n)&&n>=0&&n<=1000))return;
      $('visibility-summary').textContent=ui.enabled?`${shown} markers projected / ${total} in this view${hidden?' - close panels, zoom or use the record list':''}`:'Highlights hidden';
    }
  });
  function sync(){
    if(!state.data)return;
    if(ui.first){ui.first=false;if(state.data.records.length===0){ui.references=['door','lift','riser'];$('reference-section').open=true;}lastKey='';}
    const data=view();$('highlight-mode').value=ui.mode;
    const scope=data.matches.length,counts=data.counts;
    $('stage-summary').textContent=`${state.data.summary.assets} assets registered / ${counts.attention||0} need attention`;
    $('scope-summary').innerHTML=`${scope} records in view / ${data.locatedPlaces} linked model locations${data.unlocated.length?` / <button data-not-located>${data.unlocated.length} not located</button>`:''}${state.floor!=='all'?' / Selected floor only':''}`;
    const current=state.data.locations.find(l=>l.id===state.location);
    $('selection-chip').className='selection-chip';$('selection-chip').hidden=!current;
    if(current)$('selection-chip').innerHTML=`<span>${esc(current.floor_key)} / ${esc(current.title)}</span><button aria-label="Clear selected location">&#215;</button>`;
    const systemSignature=JSON.stringify([data.systems,state.category]);
    if(systemSignature!==lastSystems){const firstSystems=!lastSystems;lastSystems=systemSignature;const opened=new Set([...$('system-layers').querySelectorAll('details[open]')].map(d=>d.dataset.group));
      const row=id=>{const c=categories.find(c=>c.id===id);return `<button class="system-layer" data-layer="${id}" aria-pressed="${state.category===id}" title="${esc(c.examples)}"><i style="--dot:${systemColours[id]}"></i><span>${esc(c.label)}</span><strong>${data.systems[id]||0}</strong></button>`;};
      $('system-layers').innerHTML=`<button class="system-layer" data-layer="" aria-pressed="${!state.category}"><i></i><span>All responsibilities</span><strong>${counts.all||0}</strong></button>`+layerGroups.map((g,i)=>`<details class="system-group" data-group="${i}" ${firstSystems?i<3?'open':'':opened.has(String(i))?'open':''}><summary>${g.label}</summary>${g.ids.map(row).join('')}</details>`).join('');}
    const refCounts=Object.fromEntries(Object.keys(referenceTypes).map(t=>[t,state.data.locations.filter(l=>l.type===t).length]));
    const refSig=JSON.stringify([refCounts,ui.references]);if(refSig!==lastRefs){lastRefs=refSig;$('reference-types').innerHTML=Object.entries(referenceTypes).map(([id,label])=>`<label class="reference-option"><input type="checkbox" value="${id}" ${ui.references.includes(id)?'checked':''}>${label}<span>${refCounts[id]}</span></label>`).join('');}
    $('reference-total').textContent=`${data.referenceCount} displayed`;
    const floorSig=JSON.stringify([data.floors,state.floor]);if(floorSig!==lastFloors){lastFloors=floorSig;
      $('floor-rail').innerHTML=`<button data-layer-floor="all" aria-pressed="${state.floor==='all'}" title="Whole building">All</button>`+[...data.floors].reverse().map(f=>`<button data-layer-floor="${f.id}" aria-pressed="${String(f.id)===state.floor}" class="${['estimated','interpolated'].includes(f.coverage)?'estimated-floor':''}" title="${esc(f.name)} / ${f.count} active records${f.attention?' / '+f.attention+' need attention':''}">${esc(f.key)}${f.attention?`<span class="floor-count">${f.attention}</span>`:''}</button>`).join('');}
    // Side-panel records and map highlights use the same predicate and snapshot.
    const byId=new Map(data.matches.map(e=>[e.record.id,e]));
    for(const row of $('panel-content').querySelectorAll('[data-record]')){const e=byId.get(row.dataset.record);if(e)row.style.setProperty('--record-colour',ui.colourBy==='system'?systemColours[e.record.category]||systemColours.other:tones[e.flags.tone].colour);}
    const visibleTones=[...new Set(data.highlights.map(h=>h.tone))];
    const keyRows=ui.colourBy==='system'?
      [...new Set(data.matches.filter(e=>e.location).map(e=>e.record.category))].map(id=>({colour:systemColours[id]||systemColours.other,label:categories.find(c=>c.id===id)?.label||'Other'})):
      visibleTones.filter(t=>t!=='reference').map(t=>tones[t]);
    if(ui.colourBy==='system'&&data.highlights.some(h=>!h.reference&&h.label==='Multiple systems'))keyRows.unshift({colour:'#45667d',label:'Multiple systems'});
    if(data.referenceCount)keyRows.push({...tones.reference,reference:true});
    $('highlight-key').innerHTML=keyRows.map(t=>`<span class="key-item ${t.reference?'reference':''}"><i style="--dot:${t.colour}"></i>${esc(t.label)}</span>`).join('');
    $('highlight-caption').textContent=state.basis?'Amber surfaces = estimated geometry; markers = saved record locations.':'Location markers show through walls. Colours are not a safety score.';
    const payload={enabled:ui.enabled,labels:ui.labels,dim:ui.dim,selected:state.location,items:data.highlights.map(({id,title,colour,symbol,count,label,reference})=>({id,title,colour,symbol,count,label,reference}))};
    const next=JSON.stringify(payload);
    if(state.ready&&next!==lastSent){postModel('highlights',payload);lastSent=next;}
    const dataStamp=state.data.today+'|'+state.data.records.map(r=>r.id+':'+r.version).join(',');
    if(dataStamp!==lastStatus){lastStatus=dataStamp;signature=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
    $('stale-warning').hidden=!ui.stale;
    $('scope-summary').title='Snapshot '+signature+'. Grouped location counts are not installed-equipment or inspection counts.';
  }
  panes();
  return {view,sync,filterRecords:records=>{const ids=new Set(view().matches.map(e=>e.record.id));return records.filter(r=>ids.has(r.id));},
    get mode(){return ui.mode;},showRecords:()=>toggle('right',true),stale:value=>{ui.stale=value;$('stale-warning').hidden=!value;},
    reset,dispose:()=>abort.abort()};
}
