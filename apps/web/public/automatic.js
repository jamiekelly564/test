import {api,json,setCsrf,escapeHtml as e} from './api.js';
import {ExteriorViewer} from '/modules/auto-model/viewer.mjs';
import {EvidenceViewer} from '/modules/evidence/viewer.mjs';
import {toModel} from '/modules/evidence/graph.mjs';
const $=id=>document.getElementById(id),running=new Set(['queued','identifying','preparing','importing','searching','reconstructing','validating']);
let request=null,timer=null,viewer=null,modelData=null,modelKey=null,loadToken=0,pendingKey=null;
const uuid=()=>globalThis.crypto?.randomUUID?.()||`request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const notice=t=>{$('notice').textContent=t||'';$('notice').hidden=!t;};
function dispose(){viewer?.dispose();viewer=null;modelData=null;modelKey=null;$('model-viewer').replaceChildren();}
function stopPoll(){clearTimeout(timer);timer=null;}
function newBuilding(){++loadToken;stopPoll();dispose();request=null;$('result').hidden=true;$('start').hidden=false;history.replaceState(null,'','/start');refreshRecent();}
async function refreshRecent(){try{const items=await api('/api/concierge/requests');$('recent-section').hidden=!items.length;$('recent').innerHTML=items.slice(0,8).map(r=>`<a class="request-row" href="/start?request=${e(r.id)}"><span><strong>${e(r.name)}</strong><small>${e(r.postcode)}</small></span><span class="pill">${e(r.title)}</span></a>`).join('');}catch(error){notice(error.message);}}
function rebuild(){
  if(!modelData)return;const model=modelData.graph?toModel(modelData.graph,{floor:$('floor').value,cutaway:$('cutaway').checked,explode:$('explode').checked}):modelData.model;
  if(viewer)viewer.update(model);else viewer=modelData.graph?new EvidenceViewer($('model-viewer'),model):new ExteriorViewer($('model-viewer'),model);
  viewer.reset();if(modelData.graph)viewer.onSelect=id=>{const f=modelData.graph.floors.find(f=>f.components.some(c=>c.id===id)),c=f?.components.find(c=>c.id===id);$('component-detail').textContent=c?`${f.label} / ${c.label}. Geometry: ${c.basis}; heights: ${f.verticalBasis}; source page ${c.page}. ${c.note} Not site surveyed.`:'';};
}
async function showModel(r,token){
  const key=r.id+':'+r.result.kind+':'+r.result.revision;if(modelKey===key)return;
  const data=await api(`/api/concierge/requests/${r.id}/model`);if(token!==loadToken)return;dispose();modelData=data;
  $('model-panel').hidden=false;$('model-label').textContent=data.label;$('download-model').hidden=!data.model;$('download-model').href=`/api/concierge/requests/${r.id}/model.glb`;
  for(const id of ['floor','cutaway','explode'])$(id).closest('label').hidden=!data.graph;
  $('reset-view').hidden=data.kind==='marketfield';$('component-detail').textContent='';
  $('model-unknowns').textContent=data.graph?`Drawing status: ${data.graph.scenario}. ${data.graph.unknowns.join(' ')}`:data.kind==='marketfield'?'Existing model retains its drawing-derived and estimated geometry. Not a site survey.':'Exterior shape only; interiors and condition have not been inferred.';
  if(data.kind==='marketfield'){const frame=document.createElement('iframe');frame.src=data.viewerUrl;frame.title='Existing interactive building preview';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-downloads');$('model-viewer').append(frame);modelKey=key;return;}
  $('floor').innerHTML='<option value="all">Whole building</option>'+(data.graph?.floors||[]).map(f=>`<option value="${e(f.id)}">${e(f.label)}</option>`).join('');$('cutaway').checked=false;$('explode').checked=false;rebuild();modelKey=key;
}
async function refresh(){
  if(!request)return;const id=request.id,token=++loadToken;stopPoll();
  try{
    const r=await api('/api/concierge/requests/'+id);if(token!==loadToken)return;request=r;notice('');
    $('start').hidden=true;$('result').hidden=false;$('property-title').textContent=r.name;$('property-subtitle').textContent=r.postcode;
    $('status-title').textContent=r.title;$('status-description').textContent=r.message;$('request-reference').textContent='Reference: '+r.id;
    $('timeline').innerHTML=r.steps.map(s=>`<li>${e(s.title)}</li>`).join('')||'<li>Request saved</li>';
    const ready=['ready','exterior_ready'].includes(r.status);$('waiting').hidden=ready||r.status==='choosing';$('choices').hidden=r.status!=='choosing';$('cancel').hidden=!running.has(r.status)&&r.status!=='choosing';
    $('waiting-title').textContent=r.title;$('waiting-description').textContent=r.message;$('state-icon').textContent=r.status==='review_required'?'PC':'...';$('staff-review-link').hidden=r.status!=='review_required';
    $('choice-list').innerHTML=r.candidates.map(c=>`<button class="choice" data-choice="${e(c.id)}"><strong>${e(c.name)}</strong><small>${e(c.address)} ${e(c.postcode||'Postcode not recorded')}</small></button>`).join('');
    $('choice-list').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>act(b,async()=>{request=await api('/api/concierge/requests/'+r.id+'/choose',json('POST',{version:r.version,buildingId:b.dataset.choice,confirm:true}));await refresh();}));
    $('upgrade').hidden=!ready;if(ready){$('survey-link').href='/#/survey?building='+encodeURIComponent(r.buildingId);await showModel(r,token);}else{$('model-panel').hidden=true;if(modelKey)dispose();}
    if(running.has(r.status))timer=setTimeout(refresh,1800);
  }catch(error){notice(error.message+' Your request has not been resubmitted. Use Refresh status to reconnect.');}
}
async function act(button,fn){button.disabled=true;notice('');try{await fn();}catch(error){notice(error.message);}finally{button.disabled=false;}}
$('create-form').onsubmit=event=>{event.preventDefault();act($('create-button'),async()=>{
  const name=$('building-name').value.trim(),postcode=$('postcode').value.trim(),signature=name+'|'+postcode;
  if(pendingKey?.signature!==signature)pendingKey={signature,key:uuid()};
  request=await api('/api/concierge/requests',json('POST',{name,postcode,requestKey:pendingKey.key,allowProcessing:true}));pendingKey=null;
  history.replaceState(null,'','/start?request='+encodeURIComponent(request.id));await refresh();
});};
$('another').onclick=newBuilding;$('refresh-status').onclick=()=>act($('refresh-status'),refresh);
$('cancel').onclick=()=>act($('cancel'),async()=>{request=await api('/api/concierge/requests/'+request.id+'/cancel',json('POST',{version:request.version}));await refresh();});
$('reset-view').onclick=()=>viewer?.reset();for(const id of ['floor','cutaway','explode'])$(id).onchange=()=>{try{rebuild();}catch(error){notice(error.message);}};
async function boot(){
  const session=await api('/api/session');setCsrf(session.csrf);$('login').hidden=session.authenticated;$('start').hidden=!session.authenticated;if(!session.authenticated)return;
  const config=await api('/api/concierge/config');$('version').textContent='v'+config.version;$('consent').textContent=config.consent;
  const id=new URL(location.href).searchParams.get('request');if(id){request={id};await refresh();}else await refreshRecent();
}
$('login-form').onsubmit=event=>{event.preventDefault();act(event.submitter,async()=>{await api('/api/session',json('POST',{code:$('access-code').value}));$('access-code').value='';await boot();});};
window.addEventListener('pagehide',()=>{stopPoll();dispose();});boot().catch(error=>notice(error.message));
