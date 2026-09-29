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
function display(){if(!state.active||!state.data)return;send('display',{value:{enabled:true,showObjects:state.objects,objects:state.data.objects,issues:state.markers?state.data.records.filter(openIssue):[],category:state.category,size:state.size}});}
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
