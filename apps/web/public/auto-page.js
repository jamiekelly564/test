import { api, json, escapeHtml as e } from './api.js';
import { icon } from './icons.js';
import { createModel, dimensions } from '/shared/geometry.mjs';
import { ExteriorViewer } from '/shared/exterior-viewer.mjs';
const attribution='<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap contributors / ODbL</a>';
const key=()=>globalThis.crypto?.randomUUID?.()||`save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sourceLabel=value=>({'public-data':'Public mapping','estimated':'Estimated','user-estimate':'Your estimate','ai-estimate':'AI estimate','unknown':'Unknown'}[value]||value);
export function autoPageHTML(initial=''){
  return `<section class="page auto-page"><div class="page-heading"><div><p class="eyebrow">FREE / EXTERIOR PREVIEW</p><h1>Find it. Select it. Explore it.</h1><p>Create a real, rotatable model from mapped building outlines. No scan or payment required.</p></div><span class="auto-version">AUTO MODEL / 01</span></div>
  <div class="auto-steps"><span class="active" id="step-find"><b>01</b>Find the location</span><span id="step-select"><b>02</b>Confirm the building</span><span id="step-save"><b>03</b>Save your model</span></div>
  <form class="auto-search-card" id="auto-search-form"><div class="auto-search-main"><label for="auto-input">Property postcode or Google Maps link</label><div class="auto-input-row">${icon('pin')}<input id="auto-input" name="input" value="${e(initial)}" maxlength="2200" required placeholder="Postcode, Maps link or latitude, longitude" autocomplete="off"/><button class="btn primary" type="submit" id="auto-search-button">Find building ${icon('arrow')}</button></div></div>
  <label class="auto-consent"><input type="checkbox" id="auto-consent" required/><span>Use public location and building data for this search.<small>Postcodes go to Postcodes.io; coordinates to Overpass. Short Maps links are expanded by Google. No plans or private records are sent.</small></span></label></form>
  <div id="auto-message" class="auto-message" role="status" aria-live="polite">The postcode locates an area, not one property. You choose the correct outline before saving.</div>
  <div class="auto-start" id="auto-start"><div class="auto-start-icon">${icon('cube')}</div><h2>Your building starts with its footprint.</h2><p>We turn the selected outline into 3D geometry. Public heights are used where recorded; missing heights become clearly labelled assumptions.</p><div><span>REAL GEOMETRY</span><span>NO INVENTED INTERIORS</span><span>FREE PREVIEW</span></div></div>
  <div id="auto-work" hidden><div class="auto-work-grid"><section class="auto-selection panel"><div class="auto-panel-head"><div><p class="eyebrow">SELECT THE RIGHT OUTLINE</p><h2 id="auto-location-title">Your location</h2></div><span class="auto-north">N &uarr;</span></div><p class="auto-caption" id="auto-map-note"></p><div class="auto-map" id="auto-map"></div><div class="auto-map-footer">${attribution}<span>Click outlines / up to 6 blocks</span></div><label class="auto-filter">${icon('search')}<input id="auto-filter" placeholder="Filter building names or streets" aria-label="Filter mapped buildings"/></label><div id="auto-candidates" class="auto-candidates"></div></section>
  <section class="auto-preview-panel panel"><div class="auto-panel-head"><div><p class="eyebrow">LIVE 3D PREVIEW</p><h2 id="auto-preview-title">Select your building</h2></div><span class="badge amber">Not surveyed</span></div><div id="auto-preview" class="auto-preview"><div class="auto-viewer-empty">${icon('cube')}<p>Click a building outline to create the preview.</p></div></div><div class="auto-viewer-tools" id="auto-viewer-tools" hidden><button type="button" data-auto-camera="reset">${icon('reset')}Reset</button><button type="button" data-auto-camera="top">${icon('layers')}Top view</button><button type="button" data-auto-camera="plus" aria-label="Zoom in">+</button><button type="button" data-auto-camera="minus" aria-label="Zoom out">&minus;</button><button type="button" id="auto-highlight" aria-pressed="false">${icon('info')}Estimates</button></div><div id="auto-preview-info" class="auto-preview-info">No building has been assumed from the postcode alone.</div></section></div>
  <form id="auto-save-form" class="auto-save panel" hidden><div class="auto-save-heading"><div><p class="eyebrow">MAKE IT YOUR WORKSPACE</p><h2>Review the assumptions.</h2><p>Missing measurements are not facts. Leave an override blank to retain its original basis.</p></div><span class="badge teal">No charge to save</span></div><div class="auto-details-inputs"><label>Building name<input id="auto-name" name="name" required maxlength="150"/></label><label>Address / reference (optional)<input id="auto-address" name="address" maxlength="400"/></label></div>
  <div class="auto-dimensions" id="auto-dimensions"></div><p class="auto-caption">Heights include the roof. Shapes are exterior envelopes, not detailed roof or facade reconstructions. No internal floors, doors, fire ratings or defects are generated.</p>
  <label class="auto-consent ai-consent"><input type="checkbox" id="auto-ai" disabled/><span>Use GPT-6 for optional missing-height suggestions<small id="auto-ai-note">Checking the server-side OpenAI connection. Suggestions remain estimates.</small></span></label>
  <div class="auto-save-footer"><label class="auto-consent"><input type="checkbox" id="auto-confirm" required/><span>I have selected the intended building and understand this is an estimated exterior, not a survey.</span></label><button class="btn primary" id="auto-save-button" type="submit">Save building &amp; open workspace ${icon('arrow')}</button></div></form>
  <div id="auto-warnings" class="auto-warnings"></div></div>
  <div class="auto-limit"><strong>What comes next?</strong> Choose Bronze, Silver or Gold for an agreed survey, interior capture and the inspections you need. The preview does not verify ownership or building condition.</div></section>`;
}
function mapHTML(search,selected){
  const max=320;const paths=search.candidates.map(c=>{const d=c.polygons.map(rings=>rings.map(r=>r.map((p,i)=>`${i?'L':'M'}${p[0]} ${-p[1]}`).join(' ')+'Z').join(' ')).join(' ');return `<path d="${e(d)}" fill-rule="evenodd" class="footprint ${selected.has(c.id)?'selected':''}" data-footprint="${e(c.id)}" tabindex="0" role="button" aria-label="Select ${e(c.name)}" aria-pressed="${selected.has(c.id)}"><title>${e(c.name)}</title></path>`;}).join('');
  const roads=(search.roads||[]).map(r=>{const d=r.points.map((p,i)=>`${i?'L':'M'}${p[0]} ${-p[1]}`).join(' '),mid=r.points[Math.floor(r.points.length/2)];return `<path class="auto-road" d="${e(d)}"/>${Math.abs(mid[0])<230&&Math.abs(mid[1])<230?`<text class="auto-road-label" x="${mid[0]}" y="${-mid[1]-6}" text-anchor="middle">${e(r.name)}</text>`:''}`;}).join('');
  return `<svg id="auto-map-svg" viewBox="-${max} -${max} ${max*2} ${max*2}" aria-label="Nearby mapped building outlines. Choose your building."><defs><pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e4e9e6" stroke-width=".6"/></pattern></defs><rect x="-5000" y="-5000" width="10000" height="10000" fill="#f4f6f3"/><rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#mapgrid)"/>${roads}${paths}<circle r="8" class="auto-pin"/><circle r="3" fill="white"/></svg><div class="auto-map-tools"><button type="button" data-map-zoom="in" aria-label="Zoom footprint map in">+</button><button type="button" data-map-zoom="out" aria-label="Zoom footprint map out">&minus;</button><button type="button" data-map-zoom="reset" aria-label="Reset footprint map">${icon('reset')}</button></div><div class="auto-map-legend"><i></i>Search point, not a confirmed address</div>`;
}
export function mountAutoPage(root,{initialQuery='',navigate,toast}){
  const $=id=>root.querySelector('#'+id),state={search:null,selected:new Set(),overrides:{},viewer:null,model:null,filter:'',requestKey:key(),busy:false,alive:true,highlight:false};
  const controller=new AbortController(),signal=controller.signal;
  const on=(el,type,fn)=>el?.addEventListener(type,fn,{signal});
  function message(text,error=false){$('auto-message').textContent=text;$('auto-message').className='auto-message'+(error?' error':'');$('auto-message').setAttribute('role',error?'alert':'status');}
  function clearViewer(){state.viewer?.dispose();state.viewer=null;state.model=null;}
  function renderCandidates(){const q=state.filter.toLowerCase();const rows=state.search.candidates.filter(c=>`${c.name} ${c.address}`.toLowerCase().includes(q));$('auto-candidates').innerHTML=rows.map(c=>`<button type="button" class="auto-candidate ${state.selected.has(c.id)?'active':''}" data-candidate="${e(c.id)}" aria-pressed="${state.selected.has(c.id)}"><span class="auto-checkbox">${state.selected.has(c.id)?'&#10003;':''}</span><span><strong>${e(c.name)}</strong><small>${e(c.address||c.id)} / ${c.areaM2.toLocaleString()} m&sup2; / approx. ${c.distanceM} m from search point</small></span></button>`).join('')||'<p class="auto-caption">No matching names. You can still select an outline on the map.</p>';}
  function selectedParts(){return [...state.selected].flatMap(id=>{const c=state.search.candidates.find(c=>c.id===id);return c.parts?.length?c.parts:[c];});}
  function renderDimensions(){
    $('auto-dimensions').innerHTML=selectedParts().map(p=>{const d=dimensions(p.tags,state.overrides[p.id]||{}),o=state.overrides[p.id]||{};return `<article class="auto-dimension"><div><strong>${e(p.name)}</strong><small>${e(p.id)}</small><span class="badge ${d.provenance.height.source==='public-data'?'teal':'amber'}">${e(sourceLabel(d.provenance.height.source))}</span><p>${e(d.provenance.height.detail)}</p></div><label>Override overall height (m)<input type="number" min="1" max="350" step="0.1" data-height="${e(p.id)}" value="${o.heightM??''}" placeholder="${d.heightM}"/></label><label>Override above-ground storeys<input type="number" min="1" max="80" step="1" data-storeys="${e(p.id)}" value="${o.storeys??''}" placeholder="${d.storeys??'Unknown'}"/></label></article>`;}).join('');
  }
  function refreshModel(){
    try{
      const model=createModel(state.search,[...state.selected],state.overrides);state.model=model;
      if(state.viewer){state.viewer.update(model);state.viewer.reset();}else state.viewer=new ExteriorViewer($('auto-preview'),model);
      state.viewer.estimates(state.highlight);$('auto-preview-title').textContent=$('auto-name').value||model.title;
      const known=model.volumes.filter(v=>v.provenance.height.source==='public-data').length;
      $('auto-preview-info').innerHTML=`<strong>${model.volumes.length} exterior ${model.volumes.length===1?'volume':'volumes'}</strong><span>${known} with mapped height / ${model.volumes.length-known} using an assumption</span><small>Public footprint &middot; Interiors unknown &middot; Condition not assessed</small>`;
      $('auto-save-button').disabled=false;
    }catch(error){clearViewer();$('auto-preview').innerHTML='<div class="auto-viewer-empty"><p>Correct the height assumptions to restore the preview.</p></div>';$('auto-save-button').disabled=true;message(error.message,true);}
  }
  function select(id){
    if(state.busy)return;if(state.selected.has(id))state.selected.delete(id);else{if(state.selected.size>=6){message('Select up to six outlines for one building group.',true);return;}state.selected.add(id);}
    state.requestKey=key();$('auto-confirm').checked=false;
    for(const el of root.querySelectorAll('[data-footprint]')){el.classList.toggle('selected',state.selected.has(el.dataset.footprint));el.setAttribute('aria-pressed',String(state.selected.has(el.dataset.footprint)));}
    renderCandidates();const has=state.selected.size>0;$('auto-save-form').hidden=!has;$('auto-viewer-tools').hidden=!has;
    if(!has){clearViewer();$('auto-preview').innerHTML='<div class="auto-viewer-empty"><p>Select a building outline to create its preview.</p></div>';$('auto-preview-title').textContent='Select your building';return;}
    const first=state.search.candidates.find(c=>c.id===[...state.selected][0]);$('auto-name').value=first.name;$('auto-address').value=first.address;
    const valid=new Set(selectedParts().map(p=>p.id));for(const k of Object.keys(state.overrides))if(!valid.has(k))delete state.overrides[k];
    renderDimensions();refreshModel();message('Preview ready. Check the selected outlines and height assumptions, then save your building.');$('step-save').classList.add('active');
  }
  on($('auto-search-form'),'submit',async event=>{
    event.preventDefault();if(state.busy)return;state.busy=true;$('auto-search-button').disabled=true;$('auto-search-button').textContent='Finding outlines...';
    message('Resolving the location and loading nearby public building outlines. The provider may take a little time; no result is being guessed.');
    clearViewer();state.search=null;state.selected.clear();state.overrides={};$('auto-work').hidden=true;$('auto-start').hidden=true;
    try{
      const data=await api('/api/auto/search',{...json('POST',{input:$('auto-input').value,allowExternal:$('auto-consent').checked}),signal});if(!state.alive)return;
      state.search=data;
      if(!data.candidates.length){message('No usable building outlines were returned here. Try a more precise Maps pin, or add a manual building record and upload plans. No substitute building was generated.',true);$('auto-start').hidden=false;return;}
      $('auto-work').hidden=false;$('auto-save-form').hidden=true;$('auto-viewer-tools').hidden=true;
      $('auto-location-title').textContent=data.location.label;$('auto-map-note').textContent=`${data.candidates.length} nearby outlines / ${data.location.basis==='postcode-centroid'?'postcode area centre':data.location.basis==='maps-link-centre'?'Maps viewport centre - check carefully':'location pin'} / 250 m search radius`;
      $('auto-map').innerHTML=mapHTML(data,state.selected);bindMap();renderCandidates();$('auto-preview').innerHTML='<div class="auto-viewer-empty"><p>Select the outline of your building on the map or in the list.</p></div>';
      $('auto-warnings').textContent=data.warnings.join(' ');$('step-select').classList.add('active');$('step-save').classList.remove('active');
      message(`Found ${data.candidates.length} mapped outlines${data.cached?' (cached result)':''}. Select your building; the closest one is not automatically assumed to be yours.`);
    }catch(error){if(state.alive){message(error.message,true);$('auto-start').hidden=false;}}
    finally{if(state.alive){state.busy=false;$('auto-search-button').disabled=false;$('auto-search-button').innerHTML='Find building '+icon('arrow');}}
  });
  function bindMap(){
    const svg=$('auto-map-svg'),stateMap={x:-320,y:-320,w:640,down:null,moved:false};
    const apply=()=>svg.setAttribute('viewBox',`${stateMap.x} ${stateMap.y} ${stateMap.w} ${stateMap.w}`);
    on(svg,'pointerdown',ev=>{stateMap.down={x:ev.clientX,y:ev.clientY,viewX:stateMap.x,viewY:stateMap.y};stateMap.moved=false;svg.setPointerCapture(ev.pointerId);});
    on(svg,'pointermove',ev=>{if(!stateMap.down)return;const dx=ev.clientX-stateMap.down.x,dy=ev.clientY-stateMap.down.y;if(Math.hypot(dx,dy)>5)stateMap.moved=true;if(stateMap.moved){const scale=stateMap.w/svg.getBoundingClientRect().width;stateMap.x=stateMap.down.viewX-dx*scale;stateMap.y=stateMap.down.viewY-dy*scale;apply();}});
    on(svg,'pointerup',ev=>{const moved=stateMap.moved;stateMap.down=null;if(!moved){const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-footprint]');if(target)select(target.dataset.footprint);}});
    on(svg,'pointercancel',()=>{stateMap.down=null;});
    on(svg,'keydown',ev=>{if(['Enter',' '].includes(ev.key)&&ev.target.dataset.footprint){ev.preventDefault();select(ev.target.dataset.footprint);}});
    for(const btn of $('auto-map').querySelectorAll('[data-map-zoom]'))on(btn,'click',()=>{const t=btn.dataset.mapZoom;if(t==='reset'){Object.assign(stateMap,{x:-320,y:-320,w:640});}else{const w=Math.min(1400,Math.max(60,stateMap.w*(t==='in'?.72:1.4)));stateMap.x+=(stateMap.w-w)/2;stateMap.y+=(stateMap.w-w)/2;stateMap.w=w;}apply();});
  }
  on($('auto-candidates'),'click',ev=>{const b=ev.target.closest('[data-candidate]');if(b)select(b.dataset.candidate);});
  on($('auto-filter'),'input',ev=>{state.filter=ev.target.value;renderCandidates();});
  on($('auto-dimensions'),'input',ev=>{const el=ev.target,id=el.dataset.height||el.dataset.storeys;if(!id)return;const field=el.dataset.height?'heightM':'storeys';state.overrides[id]||={};const v=el.value.trim();if(v==='')delete state.overrides[id][field];else{const n=Number(v);if(!el.checkValidity()||!Number.isFinite(n)){message('Enter a valid height or whole-number storey count.',true);$('auto-save-button').disabled=true;return;}state.overrides[id][field]=n;}state.requestKey=key();refreshModel();if(state.model){const p=selectedParts().find(p=>p.id===id),d=dimensions(p.tags,state.overrides[id]||{}),card=el.closest('.auto-dimension');card.querySelector('.badge').textContent=sourceLabel(d.provenance.height.source);card.querySelector('.badge').className='badge '+(d.provenance.height.source==='public-data'?'teal':'amber');card.querySelector('p').textContent=d.provenance.height.detail;}});
  on($('auto-name'),'input',ev=>{$('auto-preview-title').textContent=ev.target.value;state.requestKey=key();});
  on($('auto-address'),'input',()=>{state.requestKey=key();});
  on($('auto-ai'),'change',()=>{state.requestKey=key();});
  for(const b of root.querySelectorAll('[data-auto-camera]'))on(b,'click',()=>{const v=state.viewer;if(!v)return;const mode=b.dataset.autoCamera;if(mode==='plus')v.zoom(.8);else if(mode==='minus')v.zoom(1.25);else v[mode]();});
  on($('auto-highlight'),'click',()=>{state.highlight=!state.highlight;$('auto-highlight').setAttribute('aria-pressed',String(state.highlight));state.viewer?.estimates(state.highlight);});
  on($('auto-save-form'),'submit',async event=>{
    event.preventDefault();if(state.busy||!state.model)return;state.busy=true;$('auto-save-button').disabled=true;$('auto-search-button').disabled=true;
    message($('auto-ai').checked?'Asking GPT for missing-height suggestions, then saving the exterior. No safety assessment is being made.':'Saving your selected building and its source records to this PC...');
    try{
      const b=await api('/api/auto/generate',{...json('POST',{searchId:state.search.id,candidateIds:[...state.selected],overrides:state.overrides,name:$('auto-name').value,address:$('auto-address').value,requestKey:state.requestKey,confirmBuilding:$('auto-confirm').checked,useAI:$('auto-ai').checked}),signal});
      if(state.alive){toast('Estimated exterior saved. No inspection results have been created.');navigate('/building/'+b.id);}
    }catch(error){if(state.alive)message(error.message,true);}finally{if(state.alive){state.busy=false;$('auto-save-button').disabled=false;$('auto-search-button').disabled=false;}}
  });
  api('/api/auto/config',{signal}).then(c=>{if(!state.alive)return;$('auto-ai').disabled=!c.ai.configured;$('auto-ai-note').textContent=c.ai.configured?`${c.ai.model} configured. Sends public building-type tags and areas to OpenAI. API charges may apply. Suggestions are not verified and do not change mapped measurements.`:'Optional. Add OPENAI_API_KEY to your private .env to enable GPT-6. Automatic footprint models work without an API key.';}).catch(()=>{if(state.alive)$('auto-ai-note').textContent='OpenAI connection could not be checked. Footprint previews do not require AI.';});
  return ()=>{state.alive=false;controller.abort();clearViewer();};
}
export function savedExteriorHTML(building){
  const m=building.model.document;
  return `<div class="auto-saved-grid"><section class="panel"><div id="saved-auto-viewer" class="auto-preview auto-saved-preview"></div><div class="auto-viewer-tools"><button type="button" data-saved-camera="reset">${icon('reset')}Reset</button><button type="button" data-saved-camera="top">${icon('layers')}Top view</button><button type="button" data-saved-camera="plus" aria-label="Zoom in">+</button><button type="button" data-saved-camera="minus" aria-label="Zoom out">&minus;</button><button id="saved-estimates" type="button" aria-pressed="false">${icon('info')}Highlight estimates</button></div><div class="auto-map-footer">${attribution}<span>Data retrieved ${e(new Date(m.attribution.dataRetrievedAt).toLocaleDateString('en-GB'))}</span></div></section>
  <aside class="panel auto-evidence"><p class="eyebrow">MODEL EVIDENCE</p><h2>An exterior, not a survey.</h2><p>${e(m.provenance.footprint)}</p><div class="auto-evidence-row"><strong>Interior &amp; condition</strong><span>Unknown / not assessed</span></div><div class="auto-evidence-row"><strong>Roof &amp; finishes</strong><span>Envelope only / details unknown</span></div><h3>Height assumptions</h3>${m.volumes.map(v=>`<div class="auto-evidence-row"><strong>${e(v.id)} &middot; ${v.heightM} m</strong><span class="${v.provenance.height.source==='public-data'?'':'estimate-text'}">${e(sourceLabel(v.provenance.height.source))}</span><small>${e(v.provenance.height.detail)}</small></div>`).join('')}
  ${m.ai.used?`<div class="auto-ai-result"><strong>GPT suggestions used / unverified</strong>${m.ai.suggestions.map(s=>`<p>${e(s.id)}: ${e(s.reason)}</p>`).join('')}</div>`:m.ai.requested?'<p>AI was requested but supplied no usable additional assumptions.</p>':''}
  <div class="auto-export-links"><a class="btn secondary" href="/api/buildings/${e(building.id)}/auto-model.glb">${icon('download')}Download 3D GLB</a><a class="text-link" href="/api/buildings/${e(building.id)}/auto-model.geojson">Download footprint &amp; provenance</a></div><p class="auto-caption">${e(m.provenance.parts)}</p><button class="btn primary wide" data-route="/survey?building=${e(building.id)}">Choose a detailed survey ${icon('arrow')}</button></aside></div>`;
}
export function mountSavedExterior(root,model){
  const viewer=new ExteriorViewer(root.querySelector('#saved-auto-viewer'),model),abort=new AbortController();let highlight=false;
  for(const b of root.querySelectorAll('[data-saved-camera]'))b.addEventListener('click',()=>{const a=b.dataset.savedCamera;if(a==='plus')viewer.zoom(.8);else if(a==='minus')viewer.zoom(1.25);else viewer[a]();},{signal:abort.signal});
  root.querySelector('#saved-estimates').addEventListener('click',event=>{highlight=!highlight;event.currentTarget.setAttribute('aria-pressed',String(highlight));viewer.estimates(highlight);},{signal:abort.signal});
  return ()=>{abort.abort();viewer.dispose();};
}
