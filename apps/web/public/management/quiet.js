import { trackingItems, trackingSections, communalLocation, trackingSuggestions, searchTracking, trackingPreset, trackingActions } from '/modules/management/tracking-library.mjs';
import { escapeHtml as esc } from '/api.js';

/** UI-only additions. Saving still uses the existing validated management forms/API. */
export function installQuietTracking({state,postModel,selectedLocation,showRecords,toast}) {
 const $=id=>document.getElementById(id),abort=new AbortController();
 const listen=(el,name,fn)=>el?.addEventListener(name,fn,{signal:abort.signal});
 const css=document.createElement('link');css.rel='stylesheet';css.href='/management-quiet.css';document.head.append(css);
 document.body.classList.add('quiet-tracking');
 $('reference-section').hidden=true;
 const ref=$('reference-section'),areas=document.createElement('section');areas.id='communal-locations';
 areas.innerHTML='<div class="layer-heading"><h3>Communal areas</h3><span id="communal-total" class="quiet-count"></span></div><p class="quiet-help">Hover to identify an area. Select it to track cleaning, repairs, checks and evidence.</p><input id="communal-search" type="search" placeholder="Find a corridor, lobby, store..." aria-label="Search communal model areas"><div id="communal-list"></div><button id="tracking-library-open" class="secondary full">Browse '+trackingItems.length+' things to track</button>';
 ref.before(areas);
 const selection=document.createElement('section');selection.id='quiet-selection';selection.hidden=true;$('panel-content').before(selection);
 const dialog=document.createElement('dialog');dialog.id='tracking-library-dialog';dialog.setAttribute('aria-labelledby','tracking-library-title');
 dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">CHOOSE WHAT YOU NEED</p><h2 id="tracking-library-title">Property tracking library</h2></div><button type="button" class="circle" id="tracking-library-close" aria-label="Close tracking library">&#215;</button></div><p id="tracking-library-location" class="muted"></p><div class="quiet-library-search"><input id="tracking-library-search" type="search" placeholder="Search cleaning, gutters, valves, contracts..." aria-label="Search tracking library"><select id="tracking-library-category" aria-label="Tracking system"><option value="">All systems</option>${trackingSections.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></div><p class="notice small">These are suggested record types, not equipment detected at Marketfield. Register only what is present. Planned checks start paused, with no frequency or next due date activated automatically.</p><p id="tracking-library-count" role="status" class="small muted"></p><div id="tracking-library-list"></div>`;
 document.body.append(dialog);
 const choice=document.createElement('dialog');choice.id='quiet-region-choice';choice.setAttribute('aria-label','Choose the area to track');document.body.append(choice);
 listen(choice,'click',e=>{const b=e.target.closest('[data-quiet-choice]');if(b){choice.close();choose(b.dataset.quietChoice);}if(e.target.closest('[data-choice-close]'))choice.close();});
 let last='',lastContext='',lastSelection='',selectedItemLocation=null;
 const loc=id=>state.data?.locations.find(l=>l.id===id),current=()=>loc(state.location);
 function openLibrary(){selectedItemLocation=current()||null;$('tracking-library-location').textContent=selectedItemLocation?'For '+selectedItemLocation.floor_key+' / '+selectedItemLocation.title:'Building-wide; select a model location when it is known.';drawLibrary();dialog.showModal();}
 function drawLibrary(){const items=searchTracking($('tracking-library-search').value,$('tracking-library-category').value);$('tracking-library-count').textContent=items.length+' tracking types';$('tracking-library-list').innerHTML=items.map(i=>`<article class="quiet-topic"><div><small>${esc(i.group)}</small><h3>${esc(i.label)}</h3><p>${esc(i.scope)}</p></div><div class="quiet-topic-actions">${trackingActions(i).map(a=>`<button class="secondary" data-quiet-item="${i.id}" data-quiet-action="${a.kind}">${a.label}</button>`).join('')}</div></article>`).join('')||'<p class="empty">No matching type. Try fewer words or use Other equipment or responsibility.</p>';}
 function proxy(data){const b=document.createElement('button');b.type='button';Object.assign(b.dataset,data);b.hidden=true;document.body.append(b);b.click();b.remove();}
 function prepare(itemId,kind,l=current()){
  const item=trackingItems.find(i=>i.id===itemId);if(!item)return;
  if(!state.data)return toast('Open the Marketfield register first.');
  if(document.querySelector('#record-dialog[open]'))return toast('Save or close your current record form first.');
  const area=state.data.records.find(r=>r.kind==='asset'&&r.status!=='retired'&&r.locationId===l?.id&&r.data?.equipment==='Communal area');
  if(item.id==='cleaning-communal-area'&&kind==='asset'&&area){dialog.close();showRecords();proxy({record:area.id});return;}
  const p=trackingPreset(item,kind,l);if(item.id==='cleaning-communal-area'&&l)p.title=l.title+' / '+l.floor_key;
  dialog.close();if(l)selectedLocation(l.id);proxy({add:kind});
  const form=$('record-form');if(!$('record-dialog').open)return;
  const set=(name,value)=>{const f=form.elements.namedItem(name);if(f&&'value'in f){f.value=value??'';f.dispatchEvent(new Event('input',{bubbles:true}));}};
  for(const key of ['title','category','status','locationId','notes'])set(key,p[key]);
  for(const [key,value] of Object.entries(p.data))set('data.'+key,value);
  if(area&&kind!=='asset')set('assetId',area.id);
  if(kind==='schedule')set('dueDate','');
  $('dialog-title').textContent=kind==='asset'&&item.id==='cleaning-communal-area'?'Track this communal area':({asset:'Register ',work:'Add task: ',schedule:'Plan check: ',cost:'Add cost: ',contract:'Add contract: ',document:'Add document: ',responsibility:'Record responsibility: ',safety:'Add safety record: ',resident:'Add anonymised case: '}[kind]+item.label);
 }
 function choose(id){if(!loc(id))return;selectedLocation(id);showRecords();sync();}
 listen($('communal-search'),'input',()=>{last='';sync();});
 listen($('communal-list'),'mouseover',e=>{const b=e.target.closest('[data-quiet-location]');if(b)postModel('hoverLocation',b.dataset.quietLocation);});
 listen($('communal-list'),'mouseout',e=>{if(!e.relatedTarget||!$('communal-list').contains(e.relatedTarget))postModel('hoverLocation','');});
 listen($('communal-list'),'focusin',e=>{const b=e.target.closest('[data-quiet-location]');if(b)postModel('hoverLocation',b.dataset.quietLocation);});
 listen($('communal-list'),'focusout',()=>postModel('hoverLocation',''));
 listen($('communal-list'),'click',e=>{const b=e.target.closest('[data-quiet-location]');if(b)choose(b.dataset.quietLocation);});
 listen($('tracking-library-open'),'click',openLibrary);listen($('tracking-library-close'),'click',()=>dialog.close());
 listen($('tracking-library-search'),'input',drawLibrary);listen($('tracking-library-category'),'change',drawLibrary);
 listen(dialog,'click',e=>{const b=e.target.closest('[data-quiet-item]');if(b)prepare(b.dataset.quietItem,b.dataset.quietAction,selectedItemLocation);});
 listen(selection,'click',e=>{if(e.target.closest('[data-quiet-browse]'))return openLibrary();const b=e.target.closest('[data-quiet-item]');if(b)prepare(b.dataset.quietItem,b.dataset.quietAction);});
 listen(window,'message',e=>{
  if(e.origin!==location.origin||e.source!==$('model').contentWindow||e.data?.source!=='propertychecked-viewer')return;
  if(e.data.type==='surface-select'&&loc(e.data.locationId))choose(e.data.locationId);
  if(e.data.type==='surface-choice'&&Array.isArray(e.data.locationIds)&&e.data.locationIds.length<=4){
   const candidates=e.data.locationIds.map(loc).filter(Boolean);if(candidates.length<2)return;
   choice.innerHTML='<div class="dialog-heading"><h2>Choose the area to track</h2><button class="circle" data-choice-close aria-label="Close">&#215;</button></div><p class="muted small">The current model does not resolve a separate boundary between these locations. They remain separate tracking references; no extra dividing wall has been invented.</p>'+candidates.map(l=>`<button class="quiet-area" data-quiet-choice="${esc(l.id)}"><span><strong>${esc(l.title)}</strong><small>${esc(l.floor_key)} / ${esc(l.source)}</small></span></button>`).join('');if(!choice.open)choice.showModal();
  }
  if(e.data.type==='hover-ready'){lastContext='';sync();}
 });
 function sync(){
  if(!state.data)return;
  const data=state.data,floor=data.floors.find(f=>String(f.id)===state.floor),all=data.locations.filter(communalLocation),q=$('communal-search').value.trim().toLowerCase();
  const found=all.filter(l=>(!floor||l.floor_key===floor.key)&&(!q||(l.title+' '+l.floor_key).toLowerCase().includes(q)));
  const areaAssets=data.records.filter(r=>r.kind==='asset'&&r.status!=='retired'&&r.data?.equipment==='Communal area');
  const sig=JSON.stringify([found.map(l=>[l.id,l.title,l.basis]),state.location,areaAssets.map(a=>[a.locationId,a.id]),data.attention]);
  $('communal-total').textContent=found.length+' model areas';
  if(sig!==last){last=sig;$('communal-list').innerHTML=found.map(l=>{
   const registered=areaAssets.some(a=>a.locationId===l.id),estimated=/estimated|interpolated/.test(l.basis||'');
   return `<button class="quiet-area ${state.location===l.id?'chosen':''}" data-quiet-location="${esc(l.id)}"><span class="quiet-area-icon" aria-hidden="true">&#9633;</span><span><strong>${esc(l.title)}</strong><small>${esc(l.floor_key)} / ${estimated?'Estimated location':'Model location'} / ${registered?'Tracking enabled':'Not yet registered'}</small></span><span aria-hidden="true">&#8250;</span></button>`;
  }).join('')||'<p class="quiet-help">No named communal model areas in this view. Choose another floor or keep unlocated responsibilities building-wide; no missing area has been invented.</p>';}
  const l=current(),selSig=JSON.stringify([l?.id,areaAssets.map(a=>a.id),data.records.map(r=>r.id+':'+r.version)]);
  selection.hidden=!l;
  if(l&&selSig!==lastSelection){lastSelection=selSig;const common=communalLocation(l),suggestions=trackingSuggestions(l,6);
   selection.innerHTML=`<p class="eyebrow">${common?'COMMUNAL AREA':'MODEL LOCATION'}</p><h3>${esc(l.title)}</h3><p class="quiet-help">${esc(l.floor_key)} / ${esc(l.source)} / ${esc(l.basis)}. This is a location reference, not confirmation of installed equipment or condition.</p>${common?'<button class="primary full" data-quiet-item="cleaning-communal-area" data-quiet-action="asset">'+(areaAssets.some(a=>a.locationId===l.id)?'Open area record':'Track this communal area')+'</button>':''}<div class="quiet-suggestions">${suggestions.filter(i=>i.id!=='cleaning-communal-area').slice(0,5).map(i=>`<button data-quiet-item="${i.id}" data-quiet-action="work">+ ${esc(i.label)}</button>`).join('')}</div><button class="plain full" data-quiet-browse>See all tracking types for this location</button>`;
  }
  if(!l)lastSelection='';
  const context={items:data.locations.slice(0,1000).map(l=>({id:l.id,title:l.title,basis:l.basis,communal:communalLocation(l)}))};
  const cs=JSON.stringify(context);if(state.ready&&cs!==lastContext){lastContext=cs;postModel('hoverContext',context);}
 }
 return {sync,dispose:()=>{abort.abort();dialog.remove();choice.remove();}};
}
