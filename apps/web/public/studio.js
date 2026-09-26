import { api,json,setCsrf,escapeHtml as e } from './api.js';
import { toModel } from '/modules/evidence/graph.mjs';
import { EvidenceViewer } from '/modules/evidence/viewer.mjs';
const $=id=>document.getElementById(id);
const state={bid:null,sources:[],draft:null,viewer:null,config:null,poll:null,load:0,trace:{cal:[],points:[],url:null,source:null}};
const uuid=()=>globalThis.crypto?.randomUUID?.()||`request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const message=text=>{$('notice').textContent=text||'';};
async function action(button,fn){button.disabled=true;message('');try{await fn();}catch(error){message(error.message);$('notice').scrollIntoView({block:'nearest',behavior:'smooth'});}finally{button.disabled=false;}}
const endpoint=(part='')=>`/api/evidence/buildings/${state.bid}${part?'/' + part:''}`;
const option=(value,label)=>`<option value="${e(value)}">${e(label)}</option>`;
function dispose(){state.viewer?.dispose();state.viewer=null;}
function resetTrace(){const t=state.trace;if(t.url)URL.revokeObjectURL(t.url);state.trace={cal:[],points:[],url:null,source:null};$('trace-image').hidden=true;$('trace-image').removeAttribute('src');$('trace-svg').replaceChildren();$('trace-help').textContent='Select and load a plan image.';}
async function loadBuilding(){
  const token=++state.load;clearTimeout(state.poll);dispose();resetTrace();state.draft=null;state.bid=$('building').value||null;$('workspace').hidden=!state.bid;$('draft-area').hidden=true;$('no-draft').hidden=false;$('references').replaceChildren();$('job').replaceChildren();
  if(!state.bid)return;const data=await api(endpoint());if(token!==state.load)return;
  $('query').value=[data.building.name,data.building.address,data.building.postcode].filter(Boolean).join(', ');await refresh();
}
async function refresh(){
  const bid=state.bid,data=await api(endpoint());if(bid!==state.bid)return;
  state.sources=data.sources;
  const registered=new Set(data.sources.map(s=>s.documentId));$('existing-document').innerHTML=option('','Select an already uploaded file')+data.documents.filter(d=>!registered.has(d.id)).map(d=>option(d.id,d.name)).join('');
  $('source-list').innerHTML=data.sources.length?data.sources.map(s=>`<div class="source"><label class="check"><input type="checkbox" data-source="${e(s.id)}" ${s.rights==='pending'?'disabled':''}><span><strong>${e(s.title)}</strong><small>${e(s.role)} / ${e(s.scenario)} / revision ${e(s.revision||'not stated')} / ${e(s.floorLabel||'floor not stated')}</small><span class="tag">${e(s.rights==='pending'?'Permission pending - excluded':s.rights+' (user declared)')}</span></span></label><a href="/api/documents/${e(s.documentId)}" download>View file</a></div>`).join(''):'<p class="muted">No evidence registered yet. Add a drawing above to begin.</p>';
  $('trace-source').innerHTML=option('','Select an approved PNG/JPEG plan')+data.sources.filter(s=>s.rights!=='pending'&&s.mime.startsWith('image/')&&s.role!=='photo').map(s=>option(s.id,s.title)).join('');
  $('draft-list').innerHTML=data.drafts.map((d,i)=>`<button class="secondary" data-draft="${e(d.id)}">Draft ${data.drafts.length-i} / ${e(d.method.startsWith('openai:')?'AI':'manual')} / ${e(d.review_state)}</button>`).join('');
  $('draft-list').querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>action(b,()=>openDraft(b.dataset.draft)));
  const recent=data.jobs.find(j=>j.kind==='discover'&&j.status==='succeeded');if(recent)showReferences(recent.result);
  const running=data.jobs.find(j=>j.status==='running');if(running)watchJob(running.id,bid);
}
function showReferences(result){$('references').innerHTML=`<p class="muted">${e(result.notice||'Candidates only; check property and rights.')}</p><pre>${e(result.summary||'No indexed references found.')}</pre>`+(result.references||[]).map(r=>`<div class="reference"><a href="${e(r.url)}" target="_blank" rel="noopener noreferrer">${e(r.title)}</a><small class="muted"> Permission not established</small></div>`).join('');}
async function watchJob(id,bid){
  clearTimeout(state.poll);if(bid!==state.bid)return;
  try{const job=await api('/api/evidence/jobs/'+id);if(bid!==state.bid)return;
    if(job.status==='running'){$('job').innerHTML=`${job.kind==='discover'?'Searching public references':'Interpreting selected evidence'}... You may continue using the workspace. <button id="cancel-job" class="secondary">Cancel job</button>`;$('cancel-job').onclick=()=>action($('cancel-job'),async()=>{await api('/api/evidence/jobs/'+id+'/cancel',json('POST',{}));await watchJob(id,bid);});state.poll=setTimeout(()=>watchJob(id,bid),1700);return;}
    $('job').textContent=job.status==='succeeded'?'Completed. Results are ready for review.':`${job.status}: ${job.error||'No model was saved.'}`;
    if(job.status==='succeeded'){if(job.kind==='discover')showReferences(job.result);else if(job.result?.draftId){await refresh();await openDraft(job.result.draftId);}}
  }catch(error){$('job').textContent=error.message+' Reload to check the job before starting another.';}
}
async function openDraft(id){
  const bid=state.bid,d=await api(endpoint('drafts/'+id));if(bid!==state.bid)return;dispose();state.draft=d;
  $('draft-area').hidden=false;$('no-draft').hidden=true;$('graph-editor').value=JSON.stringify(d.graph,null,2);
  $('floor-view').innerHTML=option('all','Whole draft')+d.graph.floors.map(f=>option(f.id,f.label)).join('');
  $('draft-info').innerHTML=`<strong>${e(d.graph.title)} / ${e(d.graph.scenario)} / ${e(d.review_state)}</strong><p>Scale: ${e(d.graph.scaleNote)}<br>Alignment: ${e(d.graph.alignment)}</p><p><strong>Unknowns:</strong> ${e(d.graph.unknowns.join(' | ')||'None recorded - this is not a completeness guarantee.')}</p><p><strong>Conflicts:</strong> ${e(d.graph.conflicts.join(' | ')||'None recorded.')}</p>`;
  $('export-glb').href=endpoint('drafts/'+id+'/export.glb');$('export-json').href=endpoint('drafts/'+id+'/export.json');$('export-glb').hidden=!d.graph.floors.length;
  rebuild();$('review').scrollIntoView({behavior:'smooth',block:'start'});
}
function rebuild(){
  if(!state.draft)return;const g=state.draft.graph;
  if(!g.floors.length){dispose();$('evidence-viewer').textContent='No metric geometry supported yet. Check Unknowns below and add a dimensioned drawing.';$('component').innerHTML='';$('component-info').textContent='Nothing invented in place of missing information.';return;}
  const model=toModel(g,{floor:$('floor-view').value,cutaway:$('cutaway').checked,explode:$('explode').checked});
  if(state.viewer)state.viewer.update(model);else state.viewer=new EvidenceViewer($('evidence-viewer'),model);
  state.viewer.select(null);state.viewer.note.textContent='Evidence draft / not site verified';state.viewer.onSelect=id=>showComponent(id);state.viewer.estimates($('estimates').checked);state.viewer.reset();
  $('component').innerHTML=option('','Select a component or click the model')+model.volumes.map(v=>option(v.id,`${v.evidence.floorLabel} / ${v.title}`)).join('');$('component-info').textContent='Click a wall, door or floor to see its drawing source.';
}
function showComponent(id){
  const g=state.draft?.graph,f=g?.floors.find(f=>f.components.some(c=>c.id===id)),c=f?.components.find(c=>c.id===id);if(!c)return;
  $('component').value=id;state.viewer?.select(id);const source=state.draft.sources.find(s=>s.id===c.sourceId),finish=state.draft.sources.find(s=>s.id===c.finishSourceId);
  $('component-info').innerHTML=`<h3>${e(c.label)}</h3><p>${e(f.label)} / ${e(c.kind)}<br>Geometry: ${e(c.basis)}<br>Vertical dimensions: ${e(f.verticalBasis)}<br>Drawing status: ${e(g.scenario)}</p><p>${e(c.note)}</p><p><strong>${e(source?.title||c.sourceId)}</strong><br>Page ${e(c.page)} / Revision ${e(source?.revision||'not stated')}</p>${source?`<a href="/api/documents/${e(source.documentId)}" download>Open source document</a>`:''}<p>Finish: ${e(c.finish)}${finish?'<br>Appearance source: '+e(finish.title)+' / page '+e(c.finishPage):''}</p><span class="tag">Not site verified</span>`;
}
function drawTrace(){const t=state.trace;if(!t.source)return;const svg=$('trace-svg');svg.setAttribute('viewBox',`0 0 ${t.width} ${t.height}`);const radius=t.width/150;
  svg.innerHTML=(t.points.length?`<polygon points="${t.points.map(p=>p.join(',')).join(' ')}" fill="#12776522" stroke="#137767" stroke-width="${radius/2}"/>`:'')+(t.cal.length===2?`<line x1="${t.cal[0][0]}" y1="${t.cal[0][1]}" x2="${t.cal[1][0]}" y2="${t.cal[1][1]}" stroke="#bd6e2c" stroke-width="${radius/2}"/>`:'')+[...t.cal,...t.points].map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${radius}" fill="${i<t.cal.length?'#bd6e2c':'#137767'}"/>`).join('');
  $('trace-help').textContent=t.cal.length<2?`Calibration: click ${t.cal.length===0?'the first':'the second'} end of your known dimension.`:`Outline: ${t.points.length} points. Click corners around the perimeter, then Save. Reset starts again.`;
}
function tracedGraph(){
  const t=state.trace;if(!t.source||t.cal.length!==2||t.points.length<3)throw new Error('Load a plan, mark two calibration points and at least three outline corners.');
  const length=Number($('trace-length').value),pixels=Math.hypot(t.cal[1][0]-t.cal[0][0],t.cal[1][1]-t.cal[0][1]);if(!(length>0)||pixels<5)throw new Error('Use a positive dimension and two distinct calibration points.');
  const scale=length/pixels,origin=t.points[0],ring=t.points.map(p=>[(p[0]-origin[0])*scale,(origin[1]-p[1])*scale]),height=Number($('trace-height').value),thickness=Number($('trace-thickness').value);
  if(thickness<.05||thickness>1)throw new Error('Wall thickness must be 0.05 to 1 metre.');
  const base={basis:'user-traced',sourceId:t.source.id,page:1,finish:'unknown',finishSourceId:null,finishPage:null,note:'Manually traced from the authorised plan image; geometry and dimensions need review.'};
  const components=[{...base,id:'traced-floor',kind:'slab',label:'Traced floor slab',rings:[ring],bottomM:0,topM:.15}];
  ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<.05)throw new Error('Two outline points are too close.');const nx=-dy/l*thickness/2,ny=dx/l*thickness/2;
    components.push({...base,id:'perimeter-'+i,kind:'wall',label:'Perimeter wall '+(i+1),rings:[[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]],bottomM:.15,topM:height,note:'Outline traced; wall thickness and height are user assumptions. Doors/windows have not been cut out.'});});
  return {schemaVersion:1,units:'metres',title:$('building').selectedOptions[0].textContent,scenario:t.source.scenario,scaleBasis:'user-calibrated',scaleNote:`User-calibrated ${length} m between image points ${t.cal.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' and ')}. Image pixel coordinates retained for checking.`,alignment:'Origin at first traced outline corner; image up is local +Y. Not georeferenced. Align other floors manually.',unknowns:['Internal partitions, openings, actual heights and finishes not established.','Perimeter walls assume user-entered height and thickness; not an exact wall take-off.'],conflicts:[],floors:[{id:'traced-level',label:$('trace-label').value,elevationM:Number($('trace-elevation').value),heightM:height,verticalBasis:'estimated',sourceId:t.source.id,page:1,note:'User-entered elevation and height are not survey measurements.',components}]};
}

$('new-building').onclick=()=>{$('new-form').hidden=!$('new-form').hidden;};
$('new-form').onsubmit=event=>{event.preventDefault();action(event.submitter,async()=>{const values=Object.fromEntries(new FormData(event.target)),b=await api('/api/buildings',json('POST',values));$('building').insertAdjacentHTML('beforeend',option(b.id,b.name));$('building').value=b.id;$('new-form').hidden=true;await loadBuilding();});};
$('building').onchange=()=>action($('new-building'),loadBuilding);
$('source-form').onsubmit=event=>{event.preventDefault();action(event.submitter,async()=>{
  if(!state.bid)throw new Error('Choose a building first.');const file=$('source-file').files[0];let docId=$('existing-document').value;
  if(file&&docId)throw new Error('Choose either a new file or an existing document, not both.');
  if(!$('source-confirm').checked)throw new Error('Confirm the source belongs to this building.');
  if($('source-rights').value!=='pending'&&!$('source-rights-note').value.trim())throw new Error('Record your rights or permission basis first.');
  if(file){if(file.size>25*1024*1024)throw new Error('File exceeds 25 MB.');const result=await api(`/api/buildings/${state.bid}/documents`,{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:await file.arrayBuffer()});docId=result.id;}
  if(!docId)throw new Error('Choose a PDF or image document.');
  await api(endpoint('sources'),json('POST',{documentId:docId,role:$('source-role').value,scenario:$('source-scenario').value,revision:$('source-revision').value,floorLabel:$('source-floor').value,sourceUrl:$('source-url').value,rights:$('source-rights').value,rightsNote:$('source-rights-note').value,notes:$('source-notes').value,buildingConfirmed:true}));$('source-file').value='';await refresh();message('Source registered locally. No file has been sent to AI.');
});};
$('discover-button').onclick=()=>action($('discover-button'),async()=>{if(!$('search-consent').checked)throw new Error('Approve the search before continuing.');const job=await api(endpoint('discover'),json('POST',{query:$('query').value,domain:$('domain').value,allowExternal:true,buildingConfirmed:true,requestKey:uuid()}));watchJob(job.id,state.bid);});
$('reconstruct-button').onclick=()=>action($('reconstruct-button'),async()=>{if(!$('analysis-consent').checked)throw new Error('Approve sending the selected files for AI analysis first.');const job=await api(endpoint('reconstruct'),json('POST',{sourceIds:[...document.querySelectorAll('[data-source]:checked')].map(c=>c.dataset.source),scenario:$('build-scenario').value,notes:$('build-notes').value,allowExternal:true,buildingConfirmed:true,requestKey:uuid()}));watchJob(job.id,state.bid);});
$('floor-view').onchange=rebuild;$('cutaway').onchange=rebuild;$('explode').onchange=rebuild;$('estimates').onchange=()=>state.viewer?.estimates($('estimates').checked);$('view-reset').onclick=()=>state.viewer?.reset();$('view-top').onclick=()=>state.viewer?.top();$('component').onchange=()=>showComponent($('component').value);
$('review-button').onclick=()=>action($('review-button'),async()=>{if(!confirm('Record review against the drawings, acknowledging unknowns and conflicts? This is NOT a site survey or safety approval.'))return;await api(endpoint('drafts/'+state.draft.id+'/review'),json('POST',{version:state.draft.version,acknowledge:true}));await refresh();await openDraft(state.draft.id);});
$('save-edited').onclick=()=>action($('save-edited'),async()=>{let graph;try{graph=JSON.parse($('graph-editor').value);}catch{throw new Error('Invalid JSON. The previous draft is unchanged.');}const d=await api(endpoint('drafts'),json('POST',{graph,requestKey:uuid()}));await refresh();await openDraft(d.id);});
$('trace-load').onclick=()=>action($('trace-load'),async()=>{const source=state.sources.find(s=>s.id===$('trace-source').value);if(!source)throw new Error('Select an authorised image plan.');resetTrace();const response=await fetch('/api/documents/'+source.documentId,{credentials:'same-origin'});if(!response.ok)throw new Error('Plan image could not be opened.');const url=URL.createObjectURL(await response.blob()),img=$('trace-image');state.trace.url=url;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Image could not be decoded.'));img.src=url;});img.hidden=false;state.trace={cal:[],points:[],url,source,width:img.naturalWidth,height:img.naturalHeight};drawTrace();});
$('trace-reset').onclick=()=>{state.trace.cal=[];state.trace.points=[];drawTrace();};$('trace-undo').onclick=()=>{const t=state.trace;t.points.length?t.points.pop():t.cal.pop();drawTrace();};
$('trace-svg').onclick=event=>{const t=state.trace;if(!t.source)return;const r=$('trace-svg').getBoundingClientRect(),p=[(event.clientX-r.left)/r.width*t.width,(event.clientY-r.top)/r.height*t.height];if(t.cal.length<2)t.cal.push(p);else if(t.points.length<60)t.points.push(p);drawTrace();};
$('trace-save').onclick=()=>action($('trace-save'),async()=>{const d=await api(endpoint('drafts'),json('POST',{graph:tracedGraph(),requestKey:uuid()}));await refresh();await openDraft(d.id);});
window.addEventListener('beforeunload',()=>{clearTimeout(state.poll);dispose();resetTrace();});
try{const session=await api('/api/session');if(!session.csrf)throw new Error('Sign in through the main workspace first, then reopen Evidence Studio.');setCsrf(session.csrf);const [config,buildings]=await Promise.all([api('/api/evidence/config'),api('/api/buildings')]);state.config=config;$('connection').textContent='Saved on this PC';$('ai-status').textContent=config.configured?`AI connected: ${config.model}. Search results still require property and rights review.`:'AI not connected. Set OPENAI_API_KEY in .env on the PC, restart the server, then reload this page. Manual tracing works without an API key.';$('building').innerHTML=option('','Choose a building')+buildings.map(b=>option(b.id,b.name)).join('');const wanted=new URLSearchParams(location.search).get('building');if(buildings.some(b=>b.id===wanted)){$('building').value=wanted;await loadBuilding();}}catch(error){message(error.message);$('connection').textContent='Connection needs attention';}
