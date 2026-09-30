import { api, json, setCsrf, escapeHtml as esc } from '/api.js';
import { categories } from '/modules/management/catalog.mjs';
import { openIssue, issueStage, issueStages, recordStage, issueCounts, issueGlyph, issueIconSVG } from '/modules/equipment-demo/model.mjs';
const $=id=>document.getElementById(id),state={active:false,data:null,tab:'equipment',category:'',floor:'all',query:'',size:1,objects:true,markers:true,ready:false,busy:false,selected:'',placement:null,poll:null,stageFilter:'',showWorking:true,view:'aerial',focusRecord:''};
const endpoint='/api/equipment-demo';
const appearance={exterior:'solid',opacity:.18,residences:true};
function frame(){return $('model');}
function send(command,extra={}){frame()?.contentWindow?.postMessage({source:'propertychecked-equipment-demo',command,...extra},location.origin);}
function message(s){$('equipment-message').textContent=s;$('equipment-message').hidden=!s;}
function label(s){return String(s||'').replaceAll('_',' ');}
const titleCategory=id=>categories.find(c=>c.id===id)?.label||'Other';
function start(){
 if(!$('model')||!document.querySelector('.top-actions'))return;
 installAppearance();
 const css=document.createElement('link');css.rel='stylesheet';css.href='/equipment-demo.css';document.head.append(css);
 const button=document.createElement('button');button.type='button';button.id='equipment-demo-open';button.className='secondary';button.textContent='Populated demo';button.onclick=()=>state.active?leave():enter();document.querySelector('.top-actions').prepend(button);
 const shell=document.createElement('section');shell.id='equipment-demo-ui';shell.hidden=true;shell.innerHTML=`
 <div class="equipment-demo-banner"><div><strong>DEMONSTRATION ONLY</strong><span>Illustrative equipment and potential issues. These are not Marketfield inspection findings.</span></div><button id="demo-exit" type="button">Real records</button></div>
 <aside class="equipment-demo-tools"><div class="equipment-demo-heading"><p>POPULATED BUILDING</p><h2>Explore the systems</h2></div><div id="demo-stats" class="equipment-demo-stats"></div><div id="demo-status-summary" class="demo-status-summary" aria-label="Issue status summary"></div>
 <label for="demo-system">Building system</label><select id="demo-system"><option value="">All systems</option>${categories.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select>
 <label for="demo-floor">Floor</label><select id="demo-floor"><option value="all">Whole building</option></select>
 <label for="demo-status-filter">Status</label><select id="demo-status-filter"><option value="">All statuses</option><option value="found">Red - Issue found</option><option value="progress">Yellow - In progress</option><option value="working">Green - Working correctly</option></select>
 <label for="demo-click-view">Open icons in</label><select id="demo-click-view"><option value="aerial">Aerial floor view</option><option value="eye">Eye-level close-up</option></select>
 <label for="demo-size">Illustrative symbol size</label><select id="demo-size"><option value="1" selected>Nominal schematic size</option><option value="1.5">Enhanced visibility (may not fit)</option><option value="2">Large demonstration symbols</option></select>
 <label class="demo-check"><input type="checkbox" id="demo-objects" checked> Show 3D equipment</label><label class="demo-check"><input type="checkbox" id="demo-markers" checked> Show status icons</label><label class="demo-check"><input type="checkbox" id="demo-working" checked> Include green / working outcomes</label>
 <p id="demo-placement" class="demo-note">Opening the model layer...</p><p class="demo-note">Select a floor and Inside to explore equipment. Click an icon to jump to its floor. Switch between an aerial view and an eye-level close-up without opening a form.</p>
 <button id="demo-object-export" class="secondary">Export DEMO equipment GLB</button><button id="demo-data-export" class="plain">Export DEMO records</button><button id="demo-reset" class="plain">Reset demonstration</button>
 </aside><aside class="equipment-demo-records"><div class="equipment-demo-heading"><p>SEPARATE FROM REAL RECORDS</p><h2>Building demonstration</h2><button id="demo-collapse" type="button" aria-label="Collapse demonstration records">-</button></div>
 <nav id="demo-tabs" aria-label="Demonstration records"><button data-demo-tab="equipment" class="selected">Equipment</button><button data-demo-tab="issues">Issues</button><button data-demo-tab="areas">Areas</button><button data-demo-tab="scope">Scope &amp; checks</button></nav>
 <input id="demo-search" type="search" placeholder="Search equipment, areas or potential issues" aria-label="Search demonstration records"><div id="demo-list-count" class="demo-note"></div><div id="demo-list"></div></aside>
 <section id="demo-focus-card" class="demo-focus-card" aria-label="Selected model item" hidden></section><div id="equipment-message" role="status" hidden></div><button id="demo-mobile-tools" type="button">Systems</button><button id="demo-mobile-records" type="button">Records</button>`;
 $('main').append(shell);
 $('demo-status-filter').onchange=()=>{state.stageFilter=$('demo-status-filter').value;render();display();};
 $('demo-working').onchange=()=>{state.showWorking=$('demo-working').checked;display();};
 $('demo-click-view').onchange=()=>{state.view=$('demo-click-view').value;if(state.focusRecord)locate(state.focusRecord);else display();};
 $('demo-status-summary').onclick=e=>{const b=e.target.closest('[data-rag-filter]');if(!b)return;state.stageFilter=state.stageFilter===b.dataset.ragFilter?'':b.dataset.ragFilter;$('demo-status-filter').value=state.stageFilter;state.tab='issues';render();display();};
 $('demo-focus-card').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.focusView){state.view=b.dataset.focusView;$('demo-click-view').value=state.view;locate(state.focusRecord);}if(b.id==='demo-focus-details')details(state.focusRecord);if(b.id==='demo-focus-close'){state.focusRecord='';drawFocus();send('clearFocus');}};

 const dialog=document.createElement('dialog');dialog.id='demo-detail';dialog.setAttribute('aria-labelledby','demo-detail-title');document.body.append(dialog);
 $('demo-exit').onclick=leave;$('demo-system').onchange=()=>{state.category=$('demo-system').value;render();display();};$('demo-search').oninput=()=>{state.query=$('demo-search').value.trim().toLowerCase();renderList();};
 $('demo-floor').onchange=()=>{state.floor=$('demo-floor').value;sendFloor(state.floor);renderList();};$('demo-size').onchange=()=>{state.size=Number($('demo-size').value);display();};
 $('demo-objects').onchange=()=>{state.objects=$('demo-objects').checked;display();};$('demo-markers').onchange=()=>{state.markers=$('demo-markers').checked;display();};
 $('demo-tabs').onclick=e=>{const b=e.target.closest('[data-demo-tab]');if(b){state.tab=b.dataset.demoTab;renderList();}};
 $('demo-list').onclick=e=>{const b=e.target.closest('[data-demo-id]');if(b)inspect(b.dataset.demoId);};
 dialog.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='demo-detail-close')dialog.close();if(b.dataset.demoId)details(b.dataset.demoId);if(b.dataset.demoFocus){dialog.close();inspect(b.dataset.demoFocus);}if(b.id==='demo-save-simulation')saveSimulation();};
 dialog.addEventListener('cancel',e=>{if(state.busy)e.preventDefault();});
 $('demo-collapse').onclick=()=>shell.classList.toggle('demo-records-collapsed');
 $('demo-mobile-tools').onclick=()=>{shell.classList.toggle('demo-tools-open');shell.classList.remove('demo-records-open');};
 $('demo-mobile-records').onclick=()=>{shell.classList.toggle('demo-records-open');shell.classList.remove('demo-tools-open');shell.classList.remove('demo-records-collapsed');};
 $('demo-data-export').onclick=()=>download(JSON.stringify({...state.data,exportNotice:'DEMONSTRATION ONLY. Not real building records.'},null,2),'DEMO-Marketfield-fictional-records.json','application/json');
 $('demo-object-export').onclick=()=>{if(!state.ready)return message('Wait for the model to finish loading.');send('export');};
 $('demo-reset').onclick=async()=>{if(state.busy||!confirm('Reset ONLY the fictional demonstration records and simulation history? Your real records and original model are not changed.'))return;try{state.busy=true;await api(endpoint+'/reset',json('POST',{version:state.data.version,confirm:'RESET DEMO'}));state.data=await api(endpoint,json('POST',{demonstration:true}));state.focusRecord='';render();display();message('Demonstration reset. Real records unchanged.');}catch(e){message(e.message);}finally{state.busy=false;}};
 if(new URLSearchParams(location.search).get('demo')==='1')enter();
}
async function enter(){
 if(state.busy)return;
 if(document.querySelector('dialog[open]')){alert('Save or close the current form before opening the populated demonstration.');return;}
 state.busy=true;
 try{const s=await api('/api/session');if(!s.authenticated)throw Error('Connect to the PC workspace first, then choose Populated demo.');setCsrf(s.csrf);
  const result=await api(endpoint,json('POST',{demonstration:true}));state.data=result;state.active=true;state.floor='all';document.body.classList.add('equipment-demo-active');$('equipment-demo-ui').hidden=false;$('equipment-demo-open').textContent='Return to real records';
  for(const id of ['layer-panel','records-dock'])if($(id))$(id).inert=true;
  const url=new URL(location.href);url.searchParams.set('demo','1');history.replaceState(null,'',url);render();display();sendFloor('all');clearInterval(state.poll);
  state.poll=setInterval(async()=>{if(!state.active||document.hidden||state.busy||$('demo-detail').open)return;try{const d=await api(endpoint);if(!d.records)throw Error('This demonstration was reset in another window. Exit and open it again.');if(d.version!==state.data.version){state.data=d;render();display();}message('');}catch(e){message('DEMO OFFLINE / last saved snapshot: '+e.message);}},20000);
 }catch(e){$('equipment-demo-ui').hidden=false;message(e.message);$('equipment-demo-open').textContent='Try populated demo';}
 finally{state.busy=false;}
}
function leave(){if(state.busy)return;send('display',{value:{enabled:false}});clearInterval(state.poll);$('demo-detail').close();state.active=false;state.focusRecord='';drawFocus();document.body.classList.remove('equipment-demo-active');$('equipment-demo-ui').hidden=true;$('equipment-demo-open').textContent='Populated demo';for(const id of ['layer-panel','records-dock'])if($(id))$(id).inert=false;
 const url=new URL(location.href);url.searchParams.delete('demo');history.replaceState(null,'',url);$('refresh')?.click();}
function sendFloor(floor){frame()?.contentWindow?.postMessage({source:'propertychecked-app',command:'floor',value:floor},location.origin);}
function display(){if(!state.active||!state.data)return;send('display',{value:{enabled:true,showObjects:state.objects,objects:state.data.objects,issues:state.data.records.filter(r=>r.kind==='issue'&&issueStage(r).rank),showMarkers:state.markers,showWorking:state.showWorking,stageFilter:state.stageFilter,view:state.view,category:state.category,size:state.size}});}
function render(){const d=state.data;if(!d)return;const c=d.counts;$('demo-stats').innerHTML=`<div><strong>${c.equipment}</strong><span>Example equipment</span></div><div><strong>${c.issues}</strong><span>Example issues</span></div><div><strong>${c.areas}</strong><span>Communal references</span></div><div><strong>${c.topics}</strong><span>Tracking topics</span></div>`;
 $('demo-floor').innerHTML='<option value="all">Whole building</option>'+d.floors.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');$('demo-floor').value=state.floor;
 const counts=issueCounts(state.data.records);$('demo-status-summary').innerHTML=['found','progress','working'].map(key=>`<button type="button" data-rag-filter="${key}" class="rag-${key}" aria-pressed="${state.stageFilter===key}"><strong>${counts[key]}</strong><span>${issueStages[key].label}</span></button>`).join('');
 renderList();drawFocus();}
function filtered(){const d=state.data;if(!d)return [];const key=d.floors.find(f=>String(f.id)===state.floor)?.key;
 const tabKinds={equipment:['equipment','reference'],issues:['issue'],areas:['area'],scope:['scope','check']};
 return d.records.filter(r=>tabKinds[state.tab].includes(r.kind)&&(!state.stageFilter||recordStage(r,d.records).key===state.stageFilter)&&(!state.category||r.category===state.category)&&(!key||d.locations.find(l=>l.id===r.locationId)?.floor_key===key)&&(!state.query||(r.title+' '+r.notes+' '+(d.locations.find(l=>l.id===r.locationId)?.title||'')).toLowerCase().includes(state.query)));}
function badge(r){const stage=recordStage(r,state.data.records);return `<span class="demo-rag-badge rag-${stage.key}">${stage.key==='found'?'!':stage.key==='progress'?'&#8230;':stage.key==='working'?'&#10003;':'?'} ${esc(stage.label)}</span>`;}
function glyph(r){return issueIconSVG(issueGlyph(r,state.data.records.find(a=>a.id===r.assetId)));}
function renderList(){
 if(!state.data)return;
 document.querySelectorAll('[data-demo-tab]').forEach(b=>{b.classList.toggle('selected',state.tab===b.dataset.demoTab);b.setAttribute('aria-pressed',String(state.tab===b.dataset.demoTab));});
 const items=filtered();$('demo-list-count').textContent=items.length+' demonstration records in view';
 $('demo-list').innerHTML=items.map(r=>{const l=state.data.locations.find(l=>l.id===r.locationId),stage=recordStage(r,state.data.records);return `<button class="demo-record rag-${stage.key}" data-demo-id="${esc(r.id)}"><i class="demo-row-icon">${glyph(r)}</i><div><strong>${esc(r.title)}</strong><span>${esc(l?l.floor_key+' / '+l.title:'Building-wide / position unconfirmed')}</span>${['equipment','area','reference','issue'].includes(r.kind)?badge(r):`<small>${esc(label(r.status))}</small>`}<small>${esc(titleCategory(r.category))}</small></div></button>`;}).join('')||'<p class="demo-note">No matching examples. Choose another status, floor or system. No records have been removed.</p>';
}
function drawFocus(){
 const el=$('demo-focus-card'),r=state.data?.records.find(r=>r.id===state.focusRecord);if(!el)return;el.hidden=!r;if(!r)return;
 const l=state.data.locations.find(l=>l.id===r.locationId),stage=recordStage(r,state.data.records);
 el.innerHTML=`<button class="demo-focus-close" id="demo-focus-close" type="button" aria-label="Close selected item">&#215;</button><p class="eyebrow">SELECTED IN MODEL / DEMO</p><div class="demo-focus-heading"><i class="demo-row-icon rag-${stage.key}">${glyph(r)}</i><h2>${esc(r.title)}</h2></div>${badge(r)}<p class="demo-focus-location">${esc(l?l.floor_key+' / '+l.title:'Location unconfirmed')}</p><div class="demo-view-buttons"><button type="button" data-focus-view="aerial" aria-pressed="${state.view==='aerial'}">Aerial floor</button><button type="button" data-focus-view="eye" aria-pressed="${state.view==='eye'}">Eye-level</button><button type="button" id="demo-focus-details">Open record</button></div>`;
}
function inspect(id){
 const r=state.data?.records.find(r=>r.id===id);if(!r||!state.active)return;
 state.focusRecord=id;drawFocus();
 if(!r.locationId){details(id);return;}
 const shell=$('equipment-demo-ui');shell.classList.remove('demo-tools-open','demo-records-open');
 locate(id);
}
function locate(id){
 const r=state.data?.records.find(r=>r.id===id);if(!r)return;
 if(!state.ready)return message('The model is still loading. Use Aerial floor or Eye-level once it is ready.');
 const object=r.kind==='equipment'?r:state.data.records.find(a=>a.id===r.assetId&&a.kind==='equipment');
 const l=state.data.locations.find(l=>l.id===r.locationId);if(!l)return message('This record is building-wide or has no model location.');
 if(state.category&&state.category!==r.category){state.category='';$('demo-system').value='';}
 state.objects=true;$('demo-objects').checked=true;display();
 if(object&&!state.placement?.unplacedIds?.includes(object.id))send('focus',{id:object.id,view:state.view});
 else send('focusLocation',{id:l.id,view:state.view});
 message(object&&state.placement?.unplacedIds?.includes(object.id)?'Showing the associated area. The equipment itself has no confirmed display position.':'');
 drawFocus();
}
function details(id){const r=state.data?.records.find(r=>r.id===id);if(!r)return;state.selected=id;const l=state.data.locations.find(l=>l.id===r.locationId);const related=state.data.records.filter(x=>x.id!==id&&(x.assetId===id||r.kind==='area'&&x.locationId===r.locationId));const statusOptions=r.kind==='issue'?['open','in_progress','resolved']:r.kind==='check'?['planned','in_progress','illustrated_complete']:[];
 $('demo-detail').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">FICTIONAL DEMONSTRATION RECORD</p><h2 id="demo-detail-title">${esc(r.title)}</h2></div><button type="button" class="circle" id="demo-detail-close" aria-label="Close demonstration record">&#215;</button></div><p class="demo-detail-warning">Not an inspection finding, installed-equipment confirmation or compliance result.</p><dl class="detail-grid"><div><dt>Model association</dt><dd>${esc(l?l.floor_key+' / '+l.title:'Building-wide / unconfirmed')}</dd></div><div><dt>Record status</dt><dd>${r.kind==='issue'?badge(r):esc(label(r.status))}${r.status==='awaiting_review'?'<small> Awaiting review; not yet working correctly</small>':''}</dd></div><div><dt>Responsible party</dt><dd>Demonstration team (not appointed)</dd></div><div><dt>Example date</dt><dd>${esc(r.dueDate||'No programme activated')}</dd></div></dl><p class="detail-notes">${esc(r.notes)}</p>${state.placement?.reasons?.[r.id]?`<p class="demo-detail-warning">Placement review: ${esc(state.placement.reasons[r.id])}</p>`:''}${r.locationId?`<button class="secondary" data-demo-focus="${esc(id)}">Locate in 3D model</button>`:''}${r.style?'<p class="demo-note">Equipment is procedural 3D geometry. Placement, mounting and symbol scale are illustrative. Objects retain their full height. Room association and wall backing are schematic, not measured installations.</p>':''}${related.length?'<h3 class="demo-related-title">Linked demonstration records</h3>'+related.map(x=>`<button class="demo-related" data-demo-id="${esc(x.id)}">${esc(x.title)} <small>${esc(x.kind==='issue'?issueStage(x).label:label(x.status))}</small></button>`).join(''):''}${statusOptions.length?`<div class="form-section"><h3>Simulate an update</h3><label for="demo-sim-status">Demonstration status</label><select id="demo-sim-status">${statusOptions.map(s=>`<option value="${s}" ${s===r.status||s==='in_progress'&&r.status==='awaiting_review'?'selected':''}>${esc(r.kind==='issue'?({open:'Red - Issue found',in_progress:'Yellow - In progress',resolved:'Green - Working correctly'})[s]:label(s))}</option>`).join('')}</select><p class="demo-note">${r.kind==='issue'?'Red: issue found. Yellow: work or review in progress. Green: simulated working outcome. Unknown equipment is never automatically green.':'A completed example check is not confirmation of equipment condition.'}</p><label for="demo-sim-note">Simulation note (required)</label><textarea id="demo-sim-note" maxlength="1000" placeholder="What is happening in this hypothetical scenario?"></textarea><button type="button" class="primary" id="demo-save-simulation">Save DEMO update</button><p id="demo-save-message" role="status"></p></div>`:''}`;
 if(!$('demo-detail').open)$('demo-detail').showModal();}
async function saveSimulation(){if(state.busy)return;const note=$('demo-sim-note').value.trim();if(!note)return $('demo-save-message').textContent='Enter a simulation note. This is not real completion evidence.';
 state.busy=true;$('demo-save-simulation').disabled=true;try{state.data=await api(endpoint,json('PATCH',{id:state.selected,status:state.data.records.find(r=>r.id===state.selected)?.status==='awaiting_review'&&$('demo-sim-status').value==='in_progress'?'awaiting_review':$('demo-sim-status').value,note,version:state.data.version}));render();display();details(state.selected);$('demo-save-message').textContent='DEMO update saved. Real records are unchanged.';}catch(e){$('demo-save-message').textContent=e.message;}finally{state.busy=false;if($('demo-save-simulation'))$('demo-save-simulation').disabled=false;}}
function download(content,name,type){if(!state.active||!state.data)return;const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
// Capture only DEMO selection while active; original live records never receive these clicks.
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==frame()?.contentWindow)return;const m=e.data;
 if(m?.source==='propertychecked-equipment-viewer'){
  if(m.type==='ready'){state.ready=true;display();sendAppearance();}
  if(m.type==='error'&&typeof m.message==='string')message(m.message);
  if(m.type==='placement'&&Number.isInteger(m.placed)&&Number.isInteger(m.unplaced)&&m.placed>=0&&m.unplaced>=0&&m.placed+m.unplaced<=400){state.placement={...m,unplacedIds:Array.isArray(m.unplacedIds)?m.unplacedIds.filter(id=>typeof id==='string').slice(0,400):[]};$('demo-placement').textContent=`${m.placed} room-constrained symbols / ${m.unplaced} need a suitable room or placement review. No arbitrary fallback positions.`;}
  if(state.active&&m.type==='select'&&typeof m.id==='string')inspect(m.id);
  if(state.active&&m.type==='focused'&&['aerial','eye'].includes(m.view)){state.view=m.view;$('demo-click-view').value=m.view;drawFocus();if(m.fallback)message('An unobstructed eye-level position was not found. Showing the selected floor from above instead.');}
  if(state.active&&m.type==='focus-error')message('No suitable model position is available for this selection. The record remains accessible.');
 }
 if(m?.source==='propertychecked-viewer'&&['appearance-state','model-audit'].includes(m.type))updateAppearance(m);
 if(!state.active||m?.source!=='propertychecked-viewer')return;
 if(m.type==='surface-choice'){e.stopImmediatePropagation();message('This model region has multiple possible area names. Choose the required area in the Areas directory.');return;}
 if(['surface-select','highlight-select'].includes(m.type)){
  e.stopImmediatePropagation();const id=m.locationId||m.locationIds?.[0],r=state.data.records.find(r=>r.locationId===id&&['area','reference'].includes(r.kind));if(r)inspect(r.id);
 }
 if(m.type==='state'){state.floor=String(m.state.floor);if($('demo-floor'))$('demo-floor').value=state.floor;
 const counts=issueCounts(state.data.records);$('demo-status-summary').innerHTML=['found','progress','working'].map(key=>`<button type="button" data-rag-filter="${key}" class="rag-${key}" aria-pressed="${state.stageFilter===key}"><strong>${counts[key]}</strong><span>${issueStages[key].label}</span></button>`).join('');
 renderList();drawFocus();}
},true);
window.addEventListener('pagehide',()=>clearInterval(state.poll),{once:true});


function sendAppearance(){frame()?.contentWindow?.postMessage({source:'propertychecked-app',command:'modelAppearance',value:{...appearance}},location.origin);}
function installAppearance(){
 const toolbar=document.querySelector('.model-toolbar');if(!toolbar||$('model-display-controls'))return;
 const panel=document.createElement('details');panel.id='model-display-controls';panel.className='model-display-controls';
 panel.innerHTML='<summary>Model display</summary><div class="model-display-panel"><h3>See inside the building</h3><label for="model-shell">Exterior shell</label><select id="model-shell"><option value="solid">Solid exterior</option><option value="ghost">Transparent exterior</option><option value="hidden">Hide exterior</option></select><label for="model-opacity">Exterior opacity <output id="model-opacity-value">18%</output></label><input id="model-opacity" type="range" min="5" max="70" value="18" disabled><label class="demo-check"><input id="model-residences" type="checkbox" checked> Private residence interiors</label><p class="demo-note">Visual filter only. Shared slabs, communal doors and boundary walls are retained. Unresolved areas remain visible.</p><p class="demo-note">Walls retain their full height. Select a floor to remove upper storeys, or hide the exterior to see inside.</p><details><summary>Model quality &amp; source review</summary><p id="model-quality" class="demo-note">Waiting for the recovered model...</p><p class="demo-note">Drawing-derived does not mean surveyed. Missing sheets and unresolved room boundaries are not replaced with guessed walls. Compare drawing remains available under More.</p></details></div>';
 toolbar.append(panel);
 $('model-shell').onchange=()=>{appearance.exterior=$('model-shell').value;$('model-opacity').disabled=appearance.exterior!=='ghost';sendAppearance();};
 $('model-opacity').oninput=()=>{appearance.opacity=Number($('model-opacity').value)/100;$('model-opacity-value').textContent=$('model-opacity').value+'%';sendAppearance();};
 $('model-residences').onchange=()=>{appearance.residences=$('model-residences').checked;sendAppearance();};
}
function updateAppearance(message){
 if(message.settings){for(const key of Object.keys(appearance))if(Object.hasOwn(message.settings,key))appearance[key]=message.settings[key];}
 if($('model-shell')){$('model-shell').value=appearance.exterior;$('model-opacity').value=String(Math.round(appearance.opacity*100));$('model-opacity-value').textContent=Math.round(appearance.opacity*100)+'%';$('model-opacity').disabled=appearance.exterior!=='ghost';$('model-residences').checked=appearance.residences;}
 if(message.audit&&$('model-quality')){const a=message.audit;$('model-quality').textContent=`Display mesh: ${a.inputTriangles} input triangles; ${a.duplicates} duplicate and ${a.degenerate} degenerate faces removed. ${a.privateTriangles} interior triangles can be hidden. ${a.unboundedAreas} locations have no resolved area outline. Original drawing geometry remains unchanged.`;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
