import { escapeHtml as e } from './api.js';
import { defaultSpec, previewModel } from '/modules/preview/model.mjs';
import { PreviewViewer } from '/modules/preview/viewer.mjs';
import { RELEASE, propertyInput, postcodeValue, modelBasis, stageSteps, statusCopy, retryRemaining, editBlock, matchesSaved, safeSource, supportSummary } from '/modules/preview/ux.mjs';

const $ = id => document.getElementById(id);
const uuid = () => globalThis.crypto?.randomUUID?.() || `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const S = { current:null, viewer:null, rendered:'', shape:'', csrf:'', authenticated:false, online:false, busy:false, screen:'welcome', token:0, timer:0, failures:0, config:{researchConfigured:false}, saved:[], edit:null, editVersion:0, editBase:'', editError:'', dirty:false, block:0, mode:'exterior', expanded:false, pending:null };
const notice = value => { $('notice').textContent = value || ''; $('notice').hidden = !value; };
const sourceLink = (url,title) => { const safe=safeSource(url); return safe ? `<a href="${e(safe)}" target="_blank" rel="noopener noreferrer">${e(title)}</a>` : e(title); };
const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); };
function connection(online) {
  S.online=online;
  $('connection-pill').textContent=online?'PC connected':'PC disconnected';
  $('connection-pill').classList.toggle('offline',!online);
  $('connection-banner').hidden=online;
  controls();
}
// Only GET requests are repeated automatically. A failed mutation is never replayed.
async function request(path,{method='GET',body}={}) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(path,{method,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':S.csrf})}});
    if(!response.headers.get('content-type')?.includes('application/json'))throw Object.assign(new Error('The PC returned an unexpected response. Reconnect before trying again.'),{status:502});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error||'This action could not be completed.'),{status:response.status});
    return data;
  } catch(error) {
    if(!error.status){connection(false);throw Object.assign(new Error(method==='GET'?'Connection lost. Your visible model is retained.':'The PC did not confirm this action. Reconnect to check the saved result before trying again.'),{status:0});}
    if(error.status===401||error.status===403){S.authenticated=false;connection(false);}
    throw error;
  } finally { clearTimeout(timeout); }
}
async function session() {
  const data=await request('/api/session'); S.csrf=data.csrf||'';S.authenticated=!!data.authenticated;
  $('login').hidden=S.authenticated; connection(true);
  if(!S.authenticated)return false;
  S.config=await request('/api/previews/config');
  return true;
}
function controls() {
  const p=S.current,ready=S.online&&S.authenticated&&!S.busy,refining=p?.status==='refining',conflict=S.dirty&&S.editVersion!==p?.version;
  $('create').disabled=!ready;
  $('stop').hidden=!p?.id||!refining;$('stop').disabled=!ready||S.dirty;
  $('refine').hidden=!p?.id||refining;
  const wait=retryRemaining(p);$('refine').disabled=!ready||S.dirty||!S.config.researchConfigured||wait>0;
  $('refine').textContent=wait?`Research available in ${wait}s`:'Run another research pass';
  $('research-availability').textContent=!S.config.researchConfigured?'Online research is not connected on this PC. Local corrections still work.':S.dirty?'Save or discard changes before more research.':'An additional pass can use API credit; it is never started by reloading.';
  $('adjust').disabled=!ready||!p?.id||!S.dirty||!!S.editError||conflict;
  $('discard').disabled=!S.dirty||S.busy;
  $('undo').hidden=!p?.canUndo;$('undo').disabled=!ready||S.dirty;
  $('download-toggle').disabled=!p?.id;
  $('wrong-building').disabled=S.busy;
  $('block').disabled=!p?.id||S.busy;
  for(const id of ['floors-edit','width-edit','depth-edit','roof-edit','finish-edit','balconies-edit','columns-edit','fewer-floors','more-floors'])$(id).disabled=!p?.id||S.busy;
  $('edit-conflict').hidden=!conflict;
  $('view-draft').hidden=!S.dirty;
  $('save-state').textContent=S.dirty?'Unsaved changes':!p?.id?'Not yet saved':!S.online?'Last saved on this PC':`Saved on this PC${p.updated_at?' / '+date(p.updated_at):''}`;
  $('export').setAttribute('aria-disabled',String(S.dirty||!ready));
}
async function confirmAction(title,copy,yes) {
  const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;$('confirm-yes').textContent=yes;
  dialog.returnValue='';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='yes'),{once:true}));
}
function setTab(name,focus=false) {
  for(const key of ['overview','adjust','evidence']){
    const selected=key===name,tab=$('tab-'+key);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$('panel-'+key).hidden=!selected;
  }
  if(focus)$('tab-'+name).focus();
}
function clearEdits() { S.edit=null;S.dirty=false;S.editError='';S.editBase='';$('edit-error').textContent=''; }
function editFields() {
  const spec=S.edit||S.current?.spec;if(!spec)return;
  if(S.block>=spec.blocks.length)S.block=0;
  $('block').innerHTML=spec.blocks.map((b,i)=>`<option value="${i}">${e(b.label||'Section '+(i+1))}</option>`).join('');$('block').value=String(S.block);
  const b=spec.blocks[S.block];
  for(const [id,key] of [['floors-edit','floors'],['width-edit','width'],['depth-edit','depth'],['roof-edit','roof'],['finish-edit','finish'],['columns-edit','columns']])$(id).value=b[key];
  $('balconies-edit').checked=b.balconies;
}
function renderModel(force=false,fit=false) {
  const p=S.current;if(!p)return;
  const spec=S.edit||p.spec,n=Math.max(...spec.blocks.map(b=>b.floors)),old=$('floor').value;
  if($('floor').options.length!==n+1){$('floor').innerHTML='<option value="all">All floors</option>'+Array.from({length:n},(_,i)=>`<option value="${i}">${i===0?'Ground':'Level '+i} (est.)</option>`).join('');$('floor').value=old==='all'||Number(old)<n?old:'all';}
  const key=JSON.stringify([spec,$('floor').value,S.mode]);if(key===S.rendered&&!force)return;
  try{
    const model=previewModel(spec,{floor:$('floor').value,cutaway:S.mode==='cutaway',explode:S.mode==='exploded'});
    const shape=JSON.stringify(spec),changed=shape!==S.shape;
    if(S.viewer)S.viewer.update(model);else S.viewer=new PreviewViewer($('viewer'),model);
    if(fit)S.viewer.reset();else if(changed)S.viewer.fit();
    S.shape=shape;S.rendered=key;
    $('stats').innerHTML=`<div><strong>~${n}</strong>Estimated storeys</div><div><strong>${spec.blocks.length}</strong>Building sections</div><div><strong>Unknown</strong>Internal layout</div>`;
    $('view-help').textContent=S.mode==='cutaway'?'Empty floor envelopes only. Rooms and escape routes are unknown.':'Drag to rotate. Pinch or scroll to zoom. Arrow keys also rotate.';
  }catch{notice('This view could not render. Try Fit or a different floor. The saved model is unchanged.');}
}
function show(p,{activate=false,fit=false}={}) {
  if(S.current?.id&&S.current.id!==p.id){clearEdits();S.block=0;S.viewer?.dispose();S.viewer=null;S.rendered='';S.mode='exterior';setModeButtons();}
  S.current=p;
  if(activate){S.screen='model';$('welcome').hidden=true;$('result').hidden=false;document.body.classList.add('has-model');$('return-current').hidden=false;}
  // Metadata-only progress may advance the version. Never rebase over changed geometry.
  if(S.dirty&&JSON.stringify(p.spec)===S.editBase)S.editVersion=p.version;
  $('title').textContent=p.name;$('property-location').textContent=p.postcode||'';$('basis').textContent=modelBasis(p);
  $('match-heading').textContent=p.spec.matchBasis==='likely'?'Our best building match':p.spec.matchBasis==='ambiguous'?'The match is uncertain':'A starting point, not a match';
  $('summary').textContent=p.spec.summary;
  $('match').textContent=p.spec.matchLabel;
  const status=statusCopy(p);$('status-title').textContent=status.title;$('message').textContent=status.detail;
  $('progress').innerHTML=stageSteps(p).map(s=>`<li class="${s.state}" ${s.state==='active'?'aria-current="step"':''}>${e(s.label)}<span class="sr-only"> / ${s.state}</span></li>`).join('');
  const refs=[...(p.meta?.references||[]),...(p.meta?.photos||[])];
  $('facts').innerHTML=(p.spec.facts||[]).map(f=>{const s=refs.find(s=>s.id===f.sourceId);return `<p>${e(f.detail)} ${s?sourceLink(s.url,'Source'):''}</p>`;}).join('')||'<p class="muted">No sourced observations recorded yet. The current shape may be a generic estimate.</p>';
  $('assumptions').innerHTML=(p.spec.assumptions||[]).map(v=>`<li>${e(v)}</li>`).join('');
  $('sources').innerHTML=(p.meta?.references||[]).map(s=>`<div class="source-item">${sourceLink(s.url,s.title)}</div>`).join('')+(p.meta?.photos||[]).map(s=>`<div class="source-item">${sourceLink(s.url,s.title)}<small>${e(s.artist)} / ${sourceLink(s.licenceUrl,s.licence)} / ${p.spec.usedPhotoIds.includes(s.id)?'Used as an appearance reference':'Candidate only; not used in this estimate'}.</small></div>`).join('')||'<p>No public sources were recorded.</p>';
  const u=p.meta?.usage||{};$('usage').textContent=`Latest refinement: ${u.responses||0} AI calls, ${u.searchCalls||0} searches, ${u.inputTokens||0} input and ${u.outputTokens||0} output tokens reported. Up to 3 AI calls and 24,000 maximum output tokens per pass; this is not a fixed money limit.`;
  $('diagnostic').textContent=p.meta?.error?`${p.meta.error.code}: ${p.meta.error.message}`:'No processing error recorded.';
  if(p.id){$('export').href=`/api/previews/${encodeURIComponent(p.id)}/model.glb`;$('plans').href='/build?building='+encodeURIComponent(p.building_id);$('survey').href='/#/survey?building='+encodeURIComponent(p.building_id)+'&tier=silver';$('workspace').href='/#/building/'+encodeURIComponent(p.building_id);}
  if(!S.dirty)editFields();renderModel(false,fit);controls();
}
function setModeButtons() { for(const mode of ['exterior','cutaway','exploded']){$('view-'+mode).classList.toggle('selected',S.mode===mode);$('view-'+mode).setAttribute('aria-pressed',String(S.mode===mode));} }
function renderSaved() {
  const items=matchesSaved(S.saved,$('history-search').value);
  $('history-section').hidden=!S.saved.length;
  $('history-count').textContent=`${items.length} of ${S.saved.length} saved building${S.saved.length===1?'':'s'} on this PC. Reopening does not start new research.`;
  $('history').innerHTML=items.map(p=>`<a class="saved-card" href="/start?preview=${encodeURIComponent(p.id)}" data-preview="${e(p.id)}"><span class="saved-icon" aria-hidden="true">&#x25A5;</span><span class="saved-copy"><strong>${e(p.name)}</strong><small>${e(p.postcode)}${p.storeys?' / ~'+e(p.storeys)+' storeys':''}</small><span class="badge">${e(p.status==='refining'?'Research in progress':modelBasis(p))}</span><small>${e(date(p.updated_at))}</small></span><span class="arrow" aria-hidden="true">&rarr;</span></a>`).join('')||'<p class="empty-saved">No saved buildings match. Try a name or postcode.</p>';
  for(const a of $('history').querySelectorAll('[data-preview]'))a.onclick=event=>{if(event.ctrlKey||event.metaKey||event.shiftKey)return;event.preventDefault();act(async()=>{if(!await mayLeave())return;await openPreview(a.dataset.preview,true);});};
}
async function history() { S.saved=await request('/api/previews');renderSaved(); }
function schedule(delay=2500) {clearTimeout(S.timer);if(document.hidden)return;const token=S.token;S.timer=setTimeout(()=>poll(token),delay);}
async function poll(token) {
  if(token!==S.token||S.busy)return;
  try{
    if(!S.online||!S.authenticated){if(!await session())return;}
    if(S.current?.id){const p=await request('/api/previews/'+encodeURIComponent(S.current.id));if(token!==S.token)return;show(p);}
    S.failures=0;connection(true);
    if(S.current?.status==='refining'||retryRemaining(S.current)>0)schedule();
    else {await history();schedule(15000);}
  }catch(error){if(token!==S.token)return;if(error.status===404){notice('This saved preview was not found. Your other saved buildings are unchanged.');return;}S.failures++;schedule(Math.min(30000,3000*2**Math.min(S.failures,4)));}
}
async function act(fn) {
  if(S.busy)return;S.busy=true;clearTimeout(S.timer);++S.token;controls();notice('');
  try{await fn();}
  catch(error){notice(error.message);if(error.status===409&&S.current?.id){try{show(await request('/api/previews/'+S.current.id));}catch{}}}
  finally{S.busy=false;controls();schedule(S.current?.status==='refining'?1800:15000);}
}
async function mayLeave() {
  if(!S.dirty)return true;
  if(!await confirmAction('Discard unsaved adjustments?','Your last saved model will remain. These local adjustments have not been saved.','Discard adjustments'))return false;
  clearEdits();return true;
}
async function openPreview(id,push=false) {
  const p=await request('/api/previews/'+encodeURIComponent(id));
  clearEdits();$('name').value=p.name;$('postcode').value=p.postcode;
  if(push)window.history.pushState(null,'','/start?preview='+encodeURIComponent(id));
  show(p,{activate:true,fit:true});$('title').focus({preventScroll:true});$('result').scrollIntoView({block:'start'});await history();
}
function returnWelcome() {
  S.screen='welcome';$('welcome').hidden=false;$('result').hidden=true;document.body.classList.remove('has-model');$('return-current').hidden=!S.current;window.history.pushState(null,'','/start');$('name').focus();window.scrollTo({top:0});
}
function rememberPending(value) {S.pending=value;try{value?sessionStorage.setItem('pc-pending-preview',JSON.stringify(value)):sessionStorage.removeItem('pc-pending-preview');}catch{}}
try{const value=JSON.parse(sessionStorage.getItem('pc-pending-preview')||'null');if(value&&typeof value.name==='string'&&typeof value.postcode==='string'&&/^[a-zA-Z0-9-]{12,80}$/.test(value.requestKey))S.pending=value;}catch{}
$('create-form').onsubmit=event=>{event.preventDefault();const input=propertyInput($('name').value,$('postcode').value);
  for(const id of ['name','postcode']){$(id+'-error').textContent=input.errors[id]||'';$(id).setAttribute('aria-invalid',String(!!input.errors[id]));}
  if(Object.keys(input.errors).length){$(Object.keys(input.errors)[0]).focus();return;}
  $('postcode').value=input.postcode;
  act(async()=>{
    if(!await mayLeave())return;
    const saved=S.saved.find(p=>p.name.trim().toLowerCase()===input.name.toLowerCase()&&p.postcode===input.postcode);if(saved){await openPreview(saved.id,true);return;}
    const key=S.pending?.name===input.name&&S.pending.postcode===input.postcode?S.pending.requestKey:uuid();rememberPending({...input,errors:undefined,requestKey:key});
    S.viewer?.dispose();S.viewer=null;S.current=null;S.rendered='';S.block=0;clearEdits();
    show({...input,spec:defaultSpec(input.name),meta:{basis:'generic-starting-estimate'},status:'ready',stage:'initial'},{activate:true});$('result').scrollIntoView({block:'start'});
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const p=await request('/api/previews',{method:'POST',body:{name:input.name,postcode:input.postcode,requestKey:key,allowProcessing:true}});
    rememberPending(null);window.history.pushState(null,'','/start?preview='+encodeURIComponent(p.id));show(p,{activate:true});$('title').focus({preventScroll:true});await history();
  });
};
$('postcode').onblur=()=>{const v=postcodeValue($('postcode').value);if(v)$('postcode').value=v;};
for(const id of ['name','postcode'])$(id).oninput=()=>{$(id+'-error').textContent='';$(id).removeAttribute('aria-invalid');};
$('nav-new').onclick=()=>act(async()=>{if(await mayLeave()){returnWelcome();$('name').value='';$('postcode').value='';}});
$('wrong-building').onclick=()=>act(async()=>{if(await mayLeave()){returnWelcome();notice('Try a more specific building name, including its street. The current estimate stays in Saved buildings.');$('name').select();}});
$('nav-saved').onclick=()=>act(async()=>{await history();if(!S.saved.length){notice('Create your first estimate to see it here.');return;} $('history-section').scrollIntoView({block:'start'});$('history-search').focus({preventScroll:true});});
$('return-model').onclick=()=>{if(S.current)show(S.current,{activate:true});};
$('history-search').oninput=renderSaved;
for(const name of ['overview','adjust','evidence'])$('tab-'+name).onclick=()=>setTab(name);
$('quick-edit').onclick=()=>{setTab('adjust',true);$('tab-adjust').scrollIntoView({block:'nearest'});};
document.querySelector('.side-tabs').addEventListener('keydown',event=>{
  const names=['overview','adjust','evidence'],index=names.findIndex(n=>$('tab-'+n)===event.target);
  if(index<0)return;let next;
  if(event.key==='ArrowRight')next=(index+1)%3;if(event.key==='ArrowLeft')next=(index+2)%3;if(event.key==='Home')next=0;if(event.key==='End')next=2;
  if(next!==undefined){event.preventDefault();setTab(names[next],true);}
});
function captureEdits() {
  if(!S.current?.id)return;
  if(!S.dirty){S.edit=structuredClone(S.current.spec);S.editVersion=S.current.version;S.editBase=JSON.stringify(S.current.spec);}
  S.dirty=true;
  try {
    S.edit=editBlock(S.edit,S.block,{floors:$('floors-edit').value,width:$('width-edit').value,depth:$('depth-edit').value,columns:$('columns-edit').value,roof:$('roof-edit').value,finish:$('finish-edit').value,balconies:$('balconies-edit').checked});
    S.editError='';$('edit-error').textContent='';
    if(JSON.stringify(S.edit)===S.editBase){clearEdits();}
    renderModel();
  }catch{S.editError='Use storeys 1-25, width 4-120 m, depth 4-100 m, and window columns 1-12.';$('edit-error').textContent=S.editError;}
  controls();
}
for(const id of ['floors-edit','width-edit','depth-edit','columns-edit','roof-edit','finish-edit','balconies-edit']){
  $(id).addEventListener('input',captureEdits);
}
$('block').onchange=()=>{if(S.editError){$('block').value=String(S.block);notice('Correct the invalid dimension or discard your changes before changing section.');return;}S.block=Number($('block').value);editFields();};
for(const [id,delta] of [['fewer-floors',-1],['more-floors',1]])$(id).onclick=()=>{$('floors-edit').value=Math.max(1,Math.min(25,Number($('floors-edit').value)+delta));captureEdits();};
$('adjust-form').onsubmit=event=>{event.preventDefault();act(async()=>{
  if(!S.dirty||S.editError)return;
  const p=await request('/api/previews/'+S.current.id,{method:'PATCH',body:{version:S.editVersion,spec:S.edit}});
  clearEdits();show(p);await history();
});};
$('discard').onclick=()=>{clearEdits();show(S.current);};
$('undo').onclick=()=>act(async()=>{const p=await request('/api/previews/'+S.current.id+'/undo',{method:'POST',body:{version:S.current.version}});clearEdits();show(p);await history();});
$('stop').onclick=()=>act(async()=>{show(await request('/api/previews/'+S.current.id+'/stop',{method:'POST',body:{}}));});
$('refine').onclick=()=>act(async()=>{
  if(!await confirmAction('Start another research pass?','This uses the operator\'s API credit: up to 3 AI calls, 8 search calls and 24,000 maximum output tokens. It is not a fixed money limit. The saved estimate remains available.','Start research'))return;
  const p=await request('/api/previews/'+S.current.id+'/refine',{method:'POST',body:{version:S.current.version,requestKey:uuid(),allowProcessing:true}});show(p);
});
for(const mode of ['exterior','cutaway','exploded'])$('view-'+mode).onclick=()=>{S.mode=mode;setModeButtons();renderModel();S.viewer?.fit();};
$('floor').onchange=()=>{renderModel();S.viewer?.fit();};$('reset').onclick=()=>S.viewer?.reset();$('top').onclick=()=>S.viewer?.top();
$('zoom-in').onclick=()=>S.viewer?.zoom(.82);$('zoom-out').onclick=()=>S.viewer?.zoom(1.22);
const outsideModel=()=>[document.querySelector('.top'),$('connection-banner'),$('welcome'),document.querySelector('.result-heading'),document.querySelector('.research-strip'),document.querySelector('.side-card'),document.querySelector('.model-boundary'),$('history-section'),document.querySelector('footer')];
function expanded(on){S.expanded=on;document.body.classList.toggle('model-expanded',on);$('expand').setAttribute('aria-pressed',String(on));$('expand').setAttribute('aria-label',on?'Close expanded model view':'Expand model view');$('expand').textContent=on?'\u00d7':'\u26f6';for(const node of outsideModel())if(node)node.inert=on;requestAnimationFrame(()=>S.viewer?.invalidate());if(!on)$('expand').focus();}
$('expand').onclick=()=>expanded(!S.expanded);
window.addEventListener('keydown',event=>{
  if(!S.expanded)return;if(event.key==='Escape'){event.preventDefault();expanded(false);}
  if(event.key==='Tab'){const all=[...$('model-card').querySelectorAll('button,select,canvas[tabindex]')].filter(n=>!n.disabled),i=all.indexOf(document.activeElement);if(event.shiftKey&&i<=0){event.preventDefault();all.at(-1)?.focus();}else if(!event.shiftKey&&i===all.length-1){event.preventDefault();all[0]?.focus();}}
});
$('reconnect').onclick=()=>act(async()=>{
  if(!await session())return;
  if(S.current?.id)show(await request('/api/previews/'+S.current.id));
  await history();
  if(!S.current?.id&&S.pending){const saved=S.saved.find(p=>p.name.trim().toLowerCase()===S.pending.name.toLowerCase()&&p.postcode===S.pending.postcode);if(saved){await openPreview(saved.id);rememberPending(null);}}
  connection(true);notice('Reconnected. No research or save request was repeated.');
});
async function copyText(text,target) {
  try{await navigator.clipboard.writeText(text);return true;}
  catch{const box=document.createElement('textarea');box.value=text;box.readOnly=true;box.setAttribute('aria-label','Text to copy');target.append(box);box.focus();box.select();return false;}
}
$('copy-diagnostic').onclick=async()=>{const done=await copyText(supportSummary(S.current,S.online),$('panel-evidence'));notice(done?'Safe diagnostic summary copied. No API key or address was included.':'Copy the selected diagnostic text. No API key or address is included.');};
$('download-toggle').onclick=()=>{$('export-message').textContent=S.dirty?'The 3D download uses the saved version. Save your adjustments first. A picture captures your current view.':'GLB contains actual estimated geometry. The PNG includes an estimated-model label.';$('export-dialog').showModal();};
$('export').onclick=event=>{if(S.dirty||!S.online||!S.authenticated){event.preventDefault();$('export-message').textContent=S.dirty?'Save or discard your changes before downloading the 3D model.':'Reconnect to the PC before downloading.';}};
$('copy-link').onclick=async()=>{
  const text=location.origin+'/start?preview='+encodeURIComponent(S.current.id);
  const done=await copyText(text,$('export-dialog'));$('export-message').textContent=done?'Local link copied. It only works with this PC server running and an authorised browser; it is not a public share link.':'Copy the selected link. This is a local PC link, not public sharing.';
};
$('snapshot').onclick=async()=>{
  if(!S.viewer)return;
  try{
    S.viewer.draw();const source=S.viewer.canvas,out=document.createElement('canvas'),scale=Math.min(1,1500/source.width);out.width=Math.round(source.width*scale);out.height=Math.round(source.height*scale)+94;
    const ctx=out.getContext('2d');ctx.drawImage(source,0,0,out.width,out.height-94);ctx.fillStyle='#ffffff';ctx.fillRect(0,out.height-94,out.width,94);ctx.fillStyle='#143637';ctx.font='bold 17px sans-serif';ctx.fillText(S.current.name.slice(0,65)+' / '+S.current.postcode,18,out.height-65,out.width-36);ctx.font='12px sans-serif';ctx.fillText('PropertyChecked: illustrative estimate, not surveyed. '+(S.dirty?'Unsaved adjustments.':'Saved model view.'),18,out.height-41,out.width-36);ctx.fillText('Building match and dimensions may be wrong. Not for safety or construction.',18,out.height-20,out.width-36);
    const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw new Error('No image');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='propertychecked-estimated-view.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$('export-message').textContent='Current view saved with its estimated-model label.';
  }catch{$('export-message').textContent='The current browser could not export a picture. The 3D download remains available.';}
};
$('login-form').onsubmit=event=>{event.preventDefault();act(async()=>{const data=await request('/api/session',{method:'POST',body:{code:$('access-code').value}});S.csrf=data.csrf;$('access-code').value='';await boot();});};
async function boot() {
  if(!await session())return;
  await history();
  const id=new URL(location.href).searchParams.get('preview');
  if(id&&/^[a-zA-Z0-9-]{1,80}$/.test(id))await openPreview(id);
  else if(S.pending){$('name').value=S.pending.name;$('postcode').value=S.pending.postcode;const saved=S.saved.find(p=>p.name.toLowerCase()===S.pending.name.toLowerCase()&&p.postcode===S.pending.postcode);if(saved){await openPreview(saved.id);rememberPending(null);}}
  controls();schedule();
}
window.addEventListener('popstate',()=>act(async()=>{if(!await mayLeave()){if(S.current?.id)window.history.pushState(null,'','/start?preview='+encodeURIComponent(S.current.id));return;}const id=new URL(location.href).searchParams.get('preview');if(id)await openPreview(id);else{S.screen='welcome';$('welcome').hidden=false;$('result').hidden=true;}}));
document.addEventListener('visibilitychange',()=>{clearTimeout(S.timer);if(!document.hidden)schedule(200);});
window.addEventListener('online',()=>schedule(200));
window.addEventListener('beforeunload',event=>{if(S.dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{clearTimeout(S.timer);++S.token;S.viewer?.dispose();S.viewer=null;S.rendered='';});
window.addEventListener('pageshow',event=>{if(event.persisted){renderModel(true);schedule(200);}});
$('release').textContent=RELEASE;
boot().catch(error=>{notice(error.message);schedule(5000);});
