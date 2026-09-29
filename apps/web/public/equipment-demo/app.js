import { api, json, setCsrf, escapeHtml as esc } from '/api.js';
import { categories } from '/modules/management/catalog.mjs';
import { openIssue } from '/modules/equipment-demo/model.mjs';
const $=id=>document.getElementById(id),state={active:false,data:null,tab:'equipment',category:'',floor:'all',query:'',size:1.5,objects:true,markers:true,ready:false,busy:false,selected:'',placement:null,poll:null};
const endpoint='/api/equipment-demo';
function frame(){return $('model');}
function send(command,extra={}){frame()?.contentWindow?.postMessage({source:'propertychecked-equipment-demo',command,...extra},location.origin);}
function message(s){$('equipment-message').textContent=s;$('equipment-message').hidden=!s;}
function label(s){return String(s||'').replaceAll('_',' ');}
const titleCategory=id=>categories.find(c=>c.id===id)?.label||'Other';
function start(){
 if(!$('model')||!document.querySelector('.top-actions'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='/equipment-demo.css';document.head.append(css);
 const button=document.createElement('button');button.type='button';button.id='equipment-demo-open';button.className='secondary';button.textContent='Populated demo';button.onclick=()=>state.active?leave():enter();document.querySelector('.top-actions').prepend(button);
 const shell=document.createElement('section');shell.id='equipment-demo-ui';shell.hidden=true;shell.innerHTML=`
 <div class="equipment-demo-banner"><div><strong>DEMONSTRATION ONLY</strong><span>Illustrative equipment and potential issues. These are not Marketfield inspection findings.</span></div><button id="demo-exit" type="button">Real records</button></div>
 <aside class="equipment-demo-tools"><div class="equipment-demo-heading"><p>POPULATED BUILDING</p><h2>Explore the systems</h2></div><div id="demo-stats" class="equipment-demo-stats"></div>
 <label for="demo-system">Building system</label><select id="demo-system"><option value="">All systems</option>${categories.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select>
 <label for="demo-floor">Floor</label><select id="demo-floor"><option value="all">Whole building</option></select>
 <label for="demo-size">Illustrative symbol size</label><select id="demo-size"><option value="1">Nominal schematic size</option><option value="1.5" selected>Enhanced visibility</option><option value="2">Large demonstration symbols</option></select>
 <label class="demo-check"><input type="checkbox" id="demo-objects" checked> Show 3D equipment</label><label class="demo-check"><input type="checkbox" id="demo-markers" checked> Show example issue markers</label>
 <p id="demo-placement" class="demo-note">Opening the model layer...</p><p class="demo-note">Select a floor and Inside to explore equipment. Hover identifies an object; click opens its demonstration record.</p>
 <button id="demo-object-export" class="secondary">Export DEMO equipment GLB</button><button id="demo-data-export" class="plain">Export DEMO records</button><button id="demo-reset" class="plain">Reset demonstration</button>
 </aside><aside class="equipment-demo-records"><div class="equipment-demo-heading"><p>SEPARATE FROM REAL RECORDS</p><h2>Building demonstration</h2><button id="demo-collapse" type="button" aria-label="Collapse demonstration records">-</button></div>
 <nav id="demo-tabs" aria-label="Demonstration records"><button data-demo-tab="equipment" class="selected">Equipment</button><button data-demo-tab="issues">Issues</button><button data-demo-tab="areas">Areas</button><button data-demo-tab="scope">Scope &amp; checks</button></nav>
 <input id="demo-search" type="search" placeholder="Search equipment, areas or potential issues" aria-label="Search demonstration records"><div id="demo-list-count" class="demo-note"></div><div id="demo-list"></div></aside>
 <div id="equipment-message" role="status" hidden></div><button id="demo-mobile-tools" type="button">Systems</button><button id="demo-mobile-records" type="button">Records</button>`;
 $('main').append(shell);
 const dialog=document.createElement('dialog');dialog.id='demo-detail';dialog.setAttribute('aria-labelledby','demo-detail-title');document.body.append(dialog);
 $('demo-exit').onclick=leave;$('demo-system').onchange=()=>{state.category=$('demo-system').value;render();display();};$('demo-search').oninput=()=>{state.query=$('demo-search').value.trim().toLowerCase();renderList();};
 $('demo-floor').onchange=()=>{state.floor=$('demo-floor').value;sendFloor(state.floor);renderList();};$('demo-size').onchange=()=>{state.size=Number($('demo-size').value);display();};
 $('demo-objects').onchange=()=>{state.objects=$('demo-objects').checked;display();};$('demo-markers').onchange=()=>{state.markers=$('demo-markers').checked;display();};
 $('demo-tabs').onclick=e=>{const b=e.target.closest('[data-demo-tab]');if(b){state.tab=b.dataset.demoTab;renderList();}};
 $('demo-list').onclick=e=>{const b=e.target.closest('[data-demo-id]');if(b)details(b.dataset.demoId);};
 dialog.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='demo-detail-close')dialog.close();if(b.dataset.demoId)details(b.dataset.demoId);if(b.dataset.demoFocus){dialog.close();locate(b.dataset.demoFocus);}if(b.id==='demo-save-simulation')saveSimulation();};
 dialog.addEventListener('cancel',e=>{if(state.busy)e.preventDefault();});
 $('demo-collapse').onclick=()=>shell.classList.toggle('demo-records-collapsed');
 $('demo-mobile-tools').onclick=()=>{shell.classList.toggle('demo-tools-open');shell.classList.remove('demo-records-open');};
 $('demo-mobile-records').onclick=()=>{shell.classList.toggle('demo-records-open');shell.classList.remove('demo-tools-open');shell.classList.remove('demo-records-collapsed');};
 $('demo-data-export').onclick=()=>download(JSON.stringify({...state.data,exportNotice:'DEMONSTRATION ONLY. Not real building records.'},null,2),'DEMO-Marketfield-fictional-records.json','application/json');
 $('demo-object-export').onclick=()=>{if(!state.ready)return message('Wait for the model to finish loading.');send('export');};
 $('demo-reset').onclick=async()=>{if(state.busy||!confirm('Reset ONLY the fictional demonstration records and simulation history? Your real records and original model are not changed.'))return;try{state.busy=true;await api(endpoint+'/reset',json('POST',{version:state.data.version,confirm:'RESET DEMO'}));state.data=await api(endpoint,json('POST',{demonstration:true}));render();display();message('Demonstration reset. Real records unchanged.');}catch(e){message(e.message);}finally{state.busy=false;}};
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
function leave(){if(state.busy)return;send('display',{value:{enabled:false}});clearInterval(state.poll);$('demo-detail').close();state.active=false;document.body.classList.remove('equipment-demo-active');$('equipment-demo-ui').hidden=true;$('equipment-demo-open').textContent='Populated demo';for(const id of ['layer-panel','records-dock'])if($(id))$(id).inert=false;
 const url=new URL(location.href);url.searchParams.delete('demo');history.replaceState(null,'',url);$('refresh')?.click();}
function sendFloor(floor){frame()?.contentWindow?.postMessage({source:'propertychecked-app',command:'floor',value:floor},location.origin);}
function display(){if(!state.active||!state.data)return;send('display',{value:{enabled:true,showObjects:state.objects,objects:state.data.objects,issues:[],category:state.category,size:state.size}});}
function render(){const d=state.data;if(!d)return;const c=d.counts;$('demo-stats').innerHTML=`<div><strong>${c.equipment}</strong><span>Example equipment</span></div><div><strong>${c.issues}</strong><span>Example issues</span></div><div><strong>${c.areas}</strong><span>Communal references</span></div><div><strong>${c.topics}</strong><span>Tracking topics</span></div>`;
 $('demo-floor').innerHTML='<option value="all">Whole building</option>'+d.floors.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');$('demo-floor').value=state.floor;renderList();}
function filtered(){const d=state.data;if(!d)return [];const key=d.floors.find(f=>String(f.id)===state.floor)?.key;
 const tabKinds={equipment:['equipment','reference'],issues:['issue'],areas:['area'],scope:['scope','check']};
 return d.records.filter(r=>tabKinds[state.tab].includes(r.kind)&&(!state.category||r.category===state.category)&&(!key||d.locations.find(l=>l.id===r.locationId)?.floor_key===key)&&(!state.query||(r.title+' '+r.notes+' '+(d.locations.find(l=>l.id===r.locationId)?.title||'')).toLowerCase().includes(state.query)));}
function renderList(){if(!state.data)return;document.querySelectorAll('[data-demo-tab]').forEach(b=>{b.classList.toggle('selected',state.tab===b.dataset.demoTab);b.setAttribute('aria-pressed',String(state.tab===b.dataset.demoTab));});const items=filtered();$('demo-list-count').textContent=items.length+' demonstration records in view';$('demo-list').innerHTML=items.map(r=>{const l=state.data.locations.find(l=>l.id===r.locationId);return `<button class="demo-record ${openIssue(r)?'demo-record-issue':''}" data-demo-id="${esc(r.id)}"><strong>${esc(r.title)}</strong><span>${esc(l?l.floor_key+' / '+l.title:'Building-wide / position unconfirmed')}</span><small>${esc(label(r.status))} / ${esc(titleCategory(r.category))}</small></button>`;}).join('')||'<p class="demo-note">No matching examples. Choose another floor or system. No records have been removed.</p>';}
function locate(id){const r=state.data?.records.find(r=>r.id===id);if(!r)return;const object=r.kind==='equipment'?r:state.data.records.find(a=>a.id===r.assetId&&a.kind==='equipment');
 if(object){if(state.placement?.unplacedIds?.includes(object.id)){message('No suitable 3D display position was found for this example. Its area association is retained; no equipment position has been invented.');return;}send('focus',{id:object.id});return;}
 const l=state.data.locations.find(l=>l.id===r.locationId),f=l&&state.data.floors.find(f=>f.key===l.floor_key);if(!l)return message('This record is building-wide or has no model location.');if(f)sendFloor(String(f.id));frame()?.contentWindow?.postMessage({source:'propertychecked-app',command:'select',value:l.id},location.origin);}
function details(id){const r=state.data?.records.find(r=>r.id===id);if(!r)return;state.selected=id;const l=state.data.locations.find(l=>l.id===r.locationId);const related=state.data.records.filter(x=>x.id!==id&&(x.assetId===id||r.kind==='area'&&x.locationId===r.locationId));const statusOptions=r.kind==='issue'?['open','in_progress','awaiting_review','resolved']:r.kind==='check'?['planned','in_progress','illustrated_complete']:[];
 $('demo-detail').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">FICTIONAL DEMONSTRATION RECORD</p><h2 id="demo-detail-title">${esc(r.title)}</h2></div><button type="button" class="circle" id="demo-detail-close" aria-label="Close demonstration record">&#215;</button></div><p class="demo-detail-warning">Not an inspection finding, installed-equipment confirmation or compliance result.</p><dl class="detail-grid"><div><dt>Model association</dt><dd>${esc(l?l.floor_key+' / '+l.title:'Building-wide / unconfirmed')}</dd></div><div><dt>Record status</dt><dd>${esc(label(r.status))}</dd></div><div><dt>Responsible party</dt><dd>Demonstration team (not appointed)</dd></div><div><dt>Example date</dt><dd>${esc(r.dueDate||'No programme activated')}</dd></div></dl><p class="detail-notes">${esc(r.notes)}</p>${r.locationId?`<button class="secondary" data-demo-focus="${esc(id)}">Locate in 3D model</button>`:''}${r.style?'<p class="demo-note">Equipment is procedural 3D geometry. Placement, mounting and symbol scale are illustrative. In cutaway views symbols adapt to the displayed wall height.</p>':''}${related.length?'<h3 class="demo-related-title">Linked demonstration records</h3>'+related.map(x=>`<button class="demo-related" data-demo-id="${esc(x.id)}">${esc(x.title)} <small>${esc(label(x.status))}</small></button>`).join(''):''}${statusOptions.length?`<div class="form-section"><h3>Simulate an update</h3><label for="demo-sim-status">Demonstration status</label><select id="demo-sim-status">${statusOptions.map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${esc(label(s))}</option>`).join('')}</select><label for="demo-sim-note">Simulation note (required)</label><textarea id="demo-sim-note" maxlength="1000" placeholder="What is happening in this hypothetical scenario?"></textarea><button type="button" class="primary" id="demo-save-simulation">Save DEMO update</button><p id="demo-save-message" role="status"></p></div>`:''}`;
 if(!$('demo-detail').open)$('demo-detail').showModal();}
async function saveSimulation(){if(state.busy)return;const note=$('demo-sim-note').value.trim();if(!note)return $('demo-save-message').textContent='Enter a simulation note. This is not real completion evidence.';
 state.busy=true;$('demo-save-simulation').disabled=true;try{state.data=await api(endpoint,json('PATCH',{id:state.selected,status:$('demo-sim-status').value,note,version:state.data.version}));render();display();details(state.selected);$('demo-save-message').textContent='DEMO update saved. Real records are unchanged.';}catch(e){$('demo-save-message').textContent=e.message;}finally{state.busy=false;if($('demo-save-simulation'))$('demo-save-simulation').disabled=false;}}
function download(content,name,type){if(!state.active||!state.data)return;const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
// Capture only DEMO selection while active; original live records never receive these clicks.
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==frame()?.contentWindow)return;const m=e.data;
 if(m?.source==='propertychecked-equipment-viewer'){
  if(m.type==='ready'){state.ready=true;display();}
  if(m.type==='placement'&&Number.isInteger(m.placed)&&Number.isInteger(m.unplaced)&&m.placed>=0&&m.unplaced>=0&&m.placed+m.unplaced<=400){state.placement={...m,unplacedIds:Array.isArray(m.unplacedIds)?m.unplacedIds.filter(id=>typeof id==='string').slice(0,400):[]};$('demo-placement').textContent=`${m.placed} 3D symbols positioned / ${m.unplaced} without a suitable display position. All positions are indicative.`;}
  if(state.active&&m.type==='select'&&typeof m.id==='string')details(m.id);
 }
 if(!state.active||m?.source!=='propertychecked-viewer')return;
 if(['surface-select','surface-choice','highlight-select'].includes(m.type)){
  e.stopImmediatePropagation();const id=m.locationId||m.locationIds?.[0],r=state.data.records.find(r=>r.locationId===id&&['area','reference'].includes(r.kind));if(r)details(r.id);
 }
 if(m.type==='state'){state.floor=String(m.state.floor);if($('demo-floor'))$('demo-floor').value=state.floor;renderList();}
},true);
window.addEventListener('pagehide',()=>clearInterval(state.poll),{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();


// --- Marketfield RAG navigation v0.14 ---
// Visual three-stage interpretation for the explicitly fictional populated demo only.
// Persisted workflow values remain the existing demo values; this does not write real inspection results.
const ragStageFor=r=>{
 if(r?.kind!=='issue')return {key:'unknown',label:'Condition not recorded',colour:'#667085',rank:0};
 if(r.status==='open')return {key:'found',label:'Issue found',colour:'#D92D20',rank:3};
 if(r.status==='in_progress'||r.status==='awaiting_review')return {key:'progress',label:'In progress',colour:'#F4C430',rank:2};
 if(r.status==='resolved')return {key:'working',label:'Working correctly',colour:'#16804A',rank:1};
 return {key:'unknown',label:'Condition not recorded',colour:'#667085',rank:0};
};
const ragGlyphFor=(r,asset)=>{
 const t=String(r?.title||'').toLowerCase(), style=asset?.style||'';
 if(/leak|flood/.test(t))return 'water'; if(/battery/.test(t))return 'battery';
 if(/floor finish|flooring|trip/.test(t))return 'floor'; if(/decorat|paint/.test(t))return 'paint';
 if(/cleaning|housekeeping/.test(t))return 'clean'; if(/collection|waste|refuse|bin/.test(t))return 'bin';
 return ({'alarm-panel':'alarm','smoke-detector':'detector','heat-detector':'detector','call-point':'callpoint',sounder:'sounder',extinguisher:'extinguisher','riser-outlet':'valve','emergency-light':'light','exit-sign':'exit','smoke-vent':'fan',light:'light','electrical-board':'electric',meter:'electric',battery:'battery',intercom:'access',cctv:'camera','access-reader':'access','lift-controller':'lift',pump:'water',tank:'water',valve:'valve','leak-sensor':'water',boiler:'heat',fan:'fan',radiator:'heat',bin:'bin',recycling:'bin',bench:'seat','information-box':'document','ev-charger':'electric'}[style]||'tool');
};
const ragIconPaths=Object.freeze({
 alarm:'M4 3h16v18H4z M7 6h10v5H7z M7 15h1m3 0h1m3 0h1 M7 18h1m3 0h1m3 0h1',
 detector:'M5 9h14l2 5-3 4H6l-3-4z M7 12h10 M8 15h8 M8 3v3m4-3v3m4-3v3',
 callpoint:'M4 4h16v16H4z M8 8h8v8H8z M12 9v4m0 2v.1',
 sounder:'M8 16V9a4 4 0 0 1 8 0v7 M6 16h12 M10 19h4 M3 9v5m18-5v5',
 battery:'M3 6h16v12H3z M19 10h2v4h-2 M7 12h4m-2-2v4 M14 12h2',
 light:'M8 15a7 7 0 1 1 8 0l-1 3H9z M9 21h6 M12 2v1',
 emergency:'M7 12h10v8H7z M8 12l5 8m11-4 3-4 M2 4h6v5H2z M16 4h6v5h-6z',
 exit:'M3 3h11v18H3z M10 12h12m-4-4 4 4-4 4 M6 18h1',
 extinguisher:'M8 9h8v12H8z M10 9V5h4v4 M10 5V3h7 M16 7h3v8',
 water:'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13z M8 15a4 4 0 0 0 4 4',
 valve:'M3 10h18v5H3z M12 10V5 M7 5h10 M9 2v3m6-3v3',
 fan:'M12 12c-7 2-10-3-6-7 5-4 7 0 6 7z M12 12c2-7 8-6 9-1 0 6-5 6-9 1z M12 12c5 5 2 10-3 9-5-1-4-6 3-9z',
 electric:'M5 3h14v18H5z M13 6 8 13h4l-1 5 6-8h-5z',
 camera:'M3 6h13v12H3z M16 10l5-3v10l-5-3 M6 9h3',
 access:'M7 2h10v20H7z M10 6h4 M10 10h4 M10 15h1m2 0h1 M10 18h1m2 0h1',
 lift:'M3 3h18v18H3z M8 18V8m-3 3 3-3 3 3 M16 8v10m-3-3 3 3 3-3',
 bin:'M5 7h14l-1 14H6z M3 7h18 M9 7V3h6v4 M10 10v7m4-7v7',
 clean:'M15 3 9 13 M7 12l7 4-3 5H3z M7 16l-2 4m5-3-1 4',
 floor:'M3 3h18v18H3z M13 3l-4 7 6 3-4 8 M3 12h7m5 0h6',
 paint:'M4 3h13v7H4z M17 5h4v8h-9v4 M10 17h4v5h-4z',
 document:'M5 2h10l4 4v16H5z M15 2v5h4 M8 11h8m-8 4h8m-8 4h5',
 seat:'M4 5h16v8H4z M3 13h18v4H3z M5 17v5m14-5v5',
 heat:'M4 6h16v15H4z M8 9v9m4-9v9m4-9v9 M8 2v1m4-1v1m4-1v1',
 tool:'M14 3a5 5 0 0 0-6 6L2 17l5 5 8-8a5 5 0 0 0 6-6l-5 3-3-3 3-5z'
});
const ragIconSvg=key=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(ragIconPaths[key]||ragIconPaths.tool)+'"/></svg>';
let ragOnly='',ragShowGreen=true,ragSelected='';
const ragShell=()=>document.getElementById('equipment-demo-ui');
function ragEnsureUi(){
 const shell=ragShell(); if(!shell||document.getElementById('demo-rag-summary'))return;
 const tools=shell.querySelector('.equipment-demo-tools'), marker=tools?.querySelector('#demo-placement');
 if(tools){
  const block=document.createElement('div');block.id='demo-rag-summary';block.innerHTML='<p class="demo-note"><strong>Issue status</strong><br>Red = issue found · Yellow = in progress · Green = working correctly.</p><div class="demo-status-summary"><button type="button" data-rag="found"><strong>0</strong><span>Issue found</span></button><button type="button" data-rag="progress"><strong>0</strong><span>In progress</span></button><button type="button" data-rag="working"><strong>0</strong><span>Working correctly</span></button></div><label class="demo-check"><input type="checkbox" id="demo-show-green" checked> Show green / working outcomes</label><button type="button" class="plain" id="demo-rag-clear">Show all statuses</button>';
  marker?.after(block);
  block.onclick=e=>{const b=e.target.closest('[data-rag]');if(b){ragOnly=ragOnly===b.dataset.rag?'':b.dataset.rag;ragSync(true);} if(e.target.closest('#demo-rag-clear')){ragOnly='';ragSync(true);}};
  block.querySelector('#demo-show-green').onchange=e=>{ragShowGreen=e.target.checked;ragSync(true);};
 }
 const card=document.createElement('aside');card.id='demo-focus-card';card.className='demo-focus-card';card.hidden=true;
 card.innerHTML='<button class="plain demo-focus-close" type="button" aria-label="Close selected issue">×</button><p class="eyebrow">SELECTED ISSUE</p><div class="demo-focus-heading"><span class="demo-row-icon" id="demo-focus-icon"></span><div><h2 id="demo-focus-title"></h2><span id="demo-focus-stage" class="demo-rag-badge"></span></div></div><p id="demo-focus-location" class="demo-focus-location"></p><div class="demo-view-buttons"><button type="button" data-view="aerial">Aerial floor</button><button type="button" data-view="eye">Eye-level</button><button type="button" id="demo-focus-open">Open record</button></div>';
 shell.append(card);
 card.querySelector('.demo-focus-close').onclick=()=>{ragSelected='';card.hidden=true;ragSync(true);};
 card.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>ragCamera(b.dataset.view));
 card.querySelector('#demo-focus-open').onclick=()=>{const r=state.data?.records.find(x=>x.id===ragSelected);if(r)details(r.id);};
}
function ragIssues(){
 if(!state.active||!state.data)return [];
 const assets=new Map(state.data.records.filter(r=>r.kind==='equipment').map(r=>[r.id,r]));
 return state.data.records.filter(r=>r.kind==='issue').map(r=>{
  const stage=ragStageFor(r),asset=assets.get(r.assetId);
  return {id:r.id,title:r.title,status:r.status,stage:stage.key,stageLabel:stage.label,colour:stage.colour,locationId:r.locationId,assetId:r.assetId||'',style:asset?.style||'',glyph:ragGlyphFor(r,asset),category:r.category||'other'};
 }).filter(r=>(ragShowGreen||r.stage!=='working')&&(!ragOnly||r.stage===ragOnly)&&(!state.category||r.category===state.category));
}
function ragSync(force=false){
 if(!state.active||!state.data||!state.ready)return;
 ragEnsureUi();
 const issues=ragIssues(), counts={found:0,progress:0,working:0};issues.forEach(r=>{if(counts[r.stage]!==undefined)counts[r.stage]++;});
 document.querySelectorAll('#demo-rag-summary [data-rag]').forEach(b=>{b.querySelector('strong').textContent=String(counts[b.dataset.rag]||0);b.setAttribute('aria-pressed',String(ragOnly===b.dataset.rag));b.className='rag-'+b.dataset.rag;});
 const sig=JSON.stringify([state.data.version,state.category,state.floor,ragOnly,ragShowGreen,state.markers,issues.map(r=>[r.id,r.status])]);
 if(!force&&ragSync.last===sig)return;ragSync.last=sig;
 frame()?.contentWindow?.postMessage({source:'propertychecked-rag',command:'display',value:{enabled:state.markers!==false,issues}},location.origin);
 if(ragSelected&&!issues.some(r=>r.id===ragSelected)&&!state.data.records.some(r=>r.id===ragSelected)){ragSelected='';const c=document.getElementById('demo-focus-card');if(c)c.hidden=true;}
}
function ragSelect(id){
 const r=state.data?.records.find(x=>x.id===id&&x.kind==='issue');if(!r)return;
 ragSelected=id; locate(id); ragEnsureUi();
 const asset=state.data.records.find(x=>x.id===r.assetId),stage=ragStageFor(r),loc=state.data.locations.find(l=>l.id===r.locationId),card=document.getElementById('demo-focus-card');
 card.hidden=false;card.querySelector('#demo-focus-title').textContent=r.title;card.querySelector('#demo-focus-location').textContent=loc?loc.floor_key+' / '+loc.title:'Building-wide / position unconfirmed';
 const icon=card.querySelector('#demo-focus-icon');icon.className='demo-row-icon rag-'+stage.key;icon.innerHTML=ragIconSvg(ragGlyphFor(r,asset));
 const badge=card.querySelector('#demo-focus-stage');badge.className='demo-rag-badge rag-'+stage.key;badge.textContent=stage.label;
 card.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));
}
function ragCamera(view){
 const r=state.data?.records.find(x=>x.id===ragSelected),loc=r&&state.data.locations.find(l=>l.id===r.locationId);if(!r||!loc)return message('This issue has no model location to focus.');
 const floor=state.data.floors.find(f=>f.key===loc.floor_key);if(floor)sendFloor(String(floor.id));
 frame()?.contentWindow?.postMessage({source:'propertychecked-rag',command:'camera',value:{id:r.id,locationId:r.locationId,view}},location.origin);
 document.querySelectorAll('#demo-focus-card [data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
function ragDecorateList(){
 if(!state.active||!state.data)return;const assets=new Map(state.data.records.filter(r=>r.kind==='equipment').map(r=>[r.id,r]));
 document.querySelectorAll('#demo-list [data-demo-id]').forEach(b=>{const r=state.data.records.find(x=>x.id===b.dataset.demoId);if(!r||b.dataset.ragDecorated===String(state.data.version))return;
  b.dataset.ragDecorated=String(state.data.version);const stage=r.kind==='issue'?ragStageFor(r):null;if(stage){b.classList.remove('demo-record-issue');b.classList.add('rag-'+stage.key);}
  if(!b.querySelector('.demo-row-icon')){const icon=document.createElement('span');icon.className='demo-row-icon'+(stage?' rag-'+stage.key:'');icon.innerHTML=ragIconSvg(ragGlyphFor(r,assets.get(r.assetId)||r));b.prepend(icon);}
  if(stage){const text=b.querySelector('small');if(text){text.textContent=stage.label+' / '+titleCategory(r.category);}}
 });
}
const ragObserver=new MutationObserver(()=>{ragEnsureUi();ragDecorateList();const sel=document.getElementById('demo-sim-status');if(sel&&!sel.dataset.rag){sel.dataset.rag='1';const current=sel.value==='awaiting_review'?'in_progress':sel.value;sel.innerHTML='<option value="open">Red — Issue found</option><option value="in_progress">Yellow — In progress</option><option value="resolved">Green — Working correctly</option>';sel.value=['open','in_progress','resolved'].includes(current)?current:'open';}});
ragObserver.observe(document.documentElement,{subtree:true,childList:true});
setInterval(()=>{if(state.active){ragEnsureUi();ragDecorateList();ragSync();}},500);
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame()?.contentWindow)return;const m=e.data;if(state.active&&m?.source==='propertychecked-rag-viewer'&&m.type==='select'&&typeof m.id==='string')ragSelect(m.id);if(state.active&&m?.source==='propertychecked-rag-viewer'&&m.type==='camera-note'&&typeof m.message==='string')message(m.message);},true);
