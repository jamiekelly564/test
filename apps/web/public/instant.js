import { api,json,setCsrf,escapeHtml as e } from './api.js';
import { defaultSpec,previewModel } from '/modules/preview/model.mjs';
import { PreviewViewer } from '/modules/preview/viewer.mjs';
const $=id=>document.getElementById(id),uuid=()=>globalThis.crypto?.randomUUID?.()||`preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let current=null,viewer=null,timer=null,rendered='',loading=false,token=0;
const notice=value=>{$('notice').textContent=value||'';$('notice').hidden=!value;};
const link=(url,title)=>{try{const u=new URL(url);return u.protocol==='https:'?`<a href="${e(u.href)}" target="_blank" rel="noopener noreferrer">${e(title)}</a>`:e(title);}catch{return e(title);}};
function controls(){const active=current?.status==='refining';$('refine').hidden=!current?.id||active;$('stop').hidden=!current?.id||!active;$('adjust').disabled=!current?.id;}
function view(){if(!current)return;try{const model=previewModel(current.spec,{floor:$('floor').value,cutaway:$('cutaway').checked,explode:$('explode').checked});if(viewer)viewer.update(model);else viewer=new PreviewViewer($('viewer'),model);}catch{notice('The preview could not render. Your saved estimate remains available for export.');}}
function show(p){
  const previous=current;current=p;$('result').hidden=false;$('title').textContent=p.name||$('name').value;$('match').textContent=p.spec.matchLabel+' / '+p.spec.matchBasis;
  $('basis').textContent=p.meta?.basis==='generic-starting-estimate'?'INITIAL CONCEPT / BUILDING NOT YET MATCHED':p.meta?.basis==='user-adjusted-estimate'?'YOUR ESTIMATE / NOT MEASURED':'AI-ESTIMATED PREVIEW / UNVERIFIED';
  const version=JSON.stringify(p.spec);if(version!==rendered){rendered=version;const old=$('floor').value,n=Math.max(...p.spec.blocks.map(b=>b.floors));$('floor').innerHTML='<option value="all">Whole building</option>'+Array.from({length:n},(_,i)=>`<option value="${i}">${i===0?'Ground':'Level '+i} (estimated)</option>`).join('');if([...$('floor').options].some(o=>o.value===old))$('floor').value=old;
    const b=p.spec.blocks[0];$('floors-edit').value=b.floors;$('width-edit').value=b.width;$('depth-edit').value=b.depth;$('roof-edit').value=b.roof;view();
    $('stats').innerHTML=`<div><strong>~${n}</strong>ESTIMATED STOREYS</div><div><strong>${p.spec.blocks.length}</strong>MODEL BLOCKS</div><div><strong>Unknown</strong>INTERNAL LAYOUT</div>`;
  }
  $('summary').textContent=p.spec.summary;
  const sources=[...(p.meta?.references||[]),...(p.meta?.photos||[])];
  $('facts').innerHTML=(p.spec.facts||[]).map(f=>{const s=sources.find(s=>s.id===f.sourceId);return `<p>${e(f.detail)} ${s?link(s.url,'[source]'):''}</p>`;}).join('');
  $('assumptions').innerHTML=p.spec.assumptions.map(v=>`<li>${e(v)}</li>`).join('');
  $('sources').innerHTML=(p.meta?.references||[]).map(s=>`<div class="source-item">${link(s.url,s.title)}</div>`).join('')+(p.meta?.photos||[]).map(s=>`<div class="source-item">${link(s.url,s.title)}<small>${e(s.artist)} / ${link(s.licenceUrl,s.licence)} / ${p.spec.usedPhotoIds.includes(s.id)?'Used as an appearance reference':'Candidate photo; not used in the final estimate'}. Geometry is an interpretation, not a traced survey.</small></div>`).join('')||'<p>No source-backed building appearance has been established yet.</p>';
  const steps=[['initial','Initial model ready'],['research','Researching the building'],['appearance','Refining its appearance'],['checking','Checking the estimate']];let index=steps.findIndex(s=>s[0]===p.stage);if(p.stage==='complete')index=4;
  $('progress').innerHTML=steps.map(([key,label],i)=>`<li class="${i===0||i<index?'done':i===index&&p.status==='refining'?'active':''}">${label}</li>`).join('');
  $('message').textContent=p.message;const u=p.meta?.usage||{};$('usage').textContent=`This refinement: ${u.responses||0} AI requests, ${u.searchCalls||0} searches, ${u.inputTokens||0} input tokens and ${u.outputTokens||0} output tokens reported. Maximum 3 AI requests and 24,000 output tokens per refinement. This is a token budget, not an exact currency cap.`;
  $('diagnostic').textContent=p.meta?.error?`${p.meta.error.code}: ${p.meta.error.message}`:'No processing error recorded.';
  if(p.id){$('export').href=`/api/previews/${p.id}/model.glb`;$('export').hidden=false;$('plans').href='/build?building='+encodeURIComponent(p.building_id);$('survey').href='/#/survey?building='+encodeURIComponent(p.building_id)+'&tier=silver';$('workspace').href='/#/building/'+encodeURIComponent(p.building_id);}
  controls();
}
async function history(){const all=await api('/api/previews');$('history-section').hidden=!all.length;$('history').innerHTML=all.map(p=>`<a href="/start?preview=${encodeURIComponent(p.id)}">${e(p.name)} / ${e(p.postcode)}</a>`).join('');}
async function poll(id,t){clearTimeout(timer);if(t!==token)return;try{const p=await api('/api/previews/'+id);if(t!==token)return;show(p);if(p.status==='refining')timer=setTimeout(()=>poll(id,t),1600);else await history();}catch(error){notice(error.message+' The visible model is retained.');timer=setTimeout(()=>poll(id,t),5000);}}
async function act(button,fn){if(loading)return;loading=true;button.disabled=true;notice('');try{await fn();}catch(error){notice(error.message);}finally{loading=false;button.disabled=false;controls();}}
$('create-form').onsubmit=event=>{event.preventDefault();act($('create'),async()=>{
  clearTimeout(timer);const t=++token;const name=$('name').value.trim(),postcode=$('postcode').value.trim().toUpperCase();
  if(!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode))throw new Error('Enter a complete UK postcode.');
  current=null;rendered='';viewer?.dispose();viewer=null;$('export').hidden=true;
  show({name,postcode,spec:defaultSpec(name),meta:{basis:'generic-starting-estimate'},stage:'initial',status:'ready',message:'Initial concept generated locally. Saving and starting public research...'});
  // Let the browser paint the usable geometry before waiting for the server.
  await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  const p=await api('/api/previews',json('POST',{name,postcode,requestKey:uuid(),allowProcessing:true}));if(t!==token)return;
  window.history.replaceState(null,'','/start?preview='+encodeURIComponent(p.id));show(p);poll(p.id,t);history().catch(()=>{});
});};
$('refine').onclick=()=>act($('refine'),async()=>{const p=await api('/api/previews/'+current.id+'/refine',json('POST',{version:current.version,requestKey:uuid(),allowProcessing:true}));show(p);poll(p.id,++token);});
$('stop').onclick=()=>act($('stop'),async()=>{clearTimeout(timer);++token;show(await api('/api/previews/'+current.id+'/stop',json('POST',{})));});
$('adjust-form').onsubmit=event=>{event.preventDefault();act($('adjust'),async()=>{const spec=structuredClone(current.spec),b=spec.blocks[0];b.floors=Number($('floors-edit').value);b.width=Number($('width-edit').value);b.depth=Number($('depth-edit').value);b.roof=$('roof-edit').value;b.roofHeight=b.roof==='flat'?0:Math.max(1.5,b.roofHeight);const p=await api('/api/previews/'+current.id,json('PATCH',{version:current.version,spec}));clearTimeout(timer);++token;show(p);});};
for(const id of ['floor','cutaway','explode'])$(id).onchange=view;
$('reset').onclick=()=>viewer?.reset();$('top').onclick=()=>viewer?.top();
async function boot(){const session=await api('/api/session');setCsrf(session.csrf);if(!session.authenticated){$('login').hidden=false;return;}$('login').hidden=true;$('create').disabled=false;await history();const id=new URL(location.href).searchParams.get('preview');if(id&&/^[a-zA-Z0-9-]+$/.test(id)){const p=await api('/api/previews/'+id);$('name').value=p.name;$('postcode').value=p.postcode;show(p);poll(id,++token);}}
$('login-form').onsubmit=event=>{event.preventDefault();act(event.submitter,async()=>{const result=await api('/api/session',json('POST',{code:$('access-code').value}));setCsrf(result.csrf);$('access-code').value='';await boot();});};
window.addEventListener('pagehide',()=>{++token;clearTimeout(timer);viewer?.dispose();});
boot().catch(error=>notice(error.message));
