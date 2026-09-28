import { escapeHtml as e } from './api.js';
import { trackingCategories, trackingStatuses } from '/modules/domain/tracking.mjs';

const $=id=>document.getElementById(id);
const uuid=()=>globalThis.crypto?.randomUUID?.()||`record-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const iconPaths={door:'M6 21V3h12v18M3 21h18M14 12h1',shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z',bulb:'M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0l-1 3H9z',building:'M4 21V7l8-4 8 4v14M8 9h1m6 0h1M8 13h1m6 0h1M10 21v-4h4v4',drop:'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z',air:'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5',bolt:'M13 2L4 14h7l-1 8 10-13h-8z',key:'M14 14a6 6 0 1 1 2-5l6 6-3 3-2-2-2 2-2-2',spark:'M12 3l2 6 7 3-7 2-2 7-2-7-7-2 7-3z',leaf:'M20 3C5 2 2 11 6 16s14 2 14-13zM4 21l11-12',file:'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h8',tools:'M14 5a5 5 0 0 0-6 6l-5 7 3 3 7-7a5 5 0 0 0 6-6l-3 3-3-3z'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]||iconPaths.tools}"/></svg>`;
const urlSafe=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const showDialog=id=>{if(!$(id).open)$(id).showModal();};

/** Same-page controllers. Only explicit user actions send mutations. */
export function createWorkspaceUI({request,getState,onPreview,onPlanChange,confirmAction,beforeModelChange,onPhotoActive,notice}){
  let visible=false,current=null,data=null,category=null,busy=false,dirty=false,recordKey=uuid(),recordSignature='',job=null,photoIndex=0,photoLoaded=false,photoSrc='',fileBusy=false,fileTimer=0,token=0;
  document.body.insertAdjacentHTML('beforeend',`
  <dialog id="files-dialog" class="workspace-dialog" aria-labelledby="files-title"><div class="dialog-head"><h2 id="files-title">Photos &amp; floor plans</h2><button class="text-button" type="button" data-close="files-dialog">Close</button></div><div class="dialog-body">
  <p id="file-property" class="muted"></p><p id="files-error" class="field-error" role="alert"></p>
  <div id="file-running" hidden><div class="activity-bar" role="progressbar" aria-label="Building photo processing"></div><p id="file-stage" role="status"></p><button id="file-pause" class="text-button" type="button">Pause</button></div>
  <section id="file-confirm" class="photo-choice" hidden><h3>Is this your building?</h3><img id="file-candidate" alt="Candidate building photo"><p id="file-caption"></p><a id="file-source" target="_blank" rel="noopener noreferrer">Original source</a><div id="file-candidates" class="files-control-row"></div><div class="button-row"><button id="file-yes" type="button">Yes, use this photo</button><button id="file-no" class="secondary" type="button">No, I will add a photo</button></div></section>
  <div class="file-actions"><div id="photo-drop" class="file-drop"><strong>Add building photos</strong><small>Drop exterior photos here or choose a file.</small><label for="photo-files">Choose photos<input id="photo-files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label for="camera-file">Take a photo<input id="camera-file" type="file" accept="image/*" capture="environment"></label></div>
  <div id="plan-drop" class="file-drop"><strong>Add floor plans</strong><small>PDF or image plans. Original drawing files are retained.</small><label for="plan-files">Choose plans<input id="plan-files" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple></label></div></div>
  <label class="check file-permission"><input id="file-permission" type="checkbox">I have permission to use these files for this building.</label>
  <div id="file-transfer" hidden><p id="file-transfer-label" role="status"></p><progress id="file-progress" max="100" value="0"></progress></div>
  <div id="file-uploads" class="uploads-grid"></div><p id="file-plan-note" class="dialog-message" hidden>Plans saved for processing and review. Invented interior examples are hidden; these files have not yet been converted into measured rooms.</p>
  <div class="files-control-row"><button id="file-build" type="button">Improve model with my photos</button><button id="file-search" class="secondary" type="button">Find photos online</button></div><p class="muted">Uploading and viewing files do not use AI credit. Building from photos or searching again uses the configured API account. Up to four recent uploaded photos are used. Unsupported HEIC photos need converting to JPEG.</p><div id="file-documents"></div>
  </div></dialog>
  <dialog id="survey-dialog" class="workspace-dialog" aria-labelledby="survey-title"><div class="dialog-head"><h2 id="survey-title">Improve this building with a survey</h2><button type="button" data-close="survey-dialog" class="text-button">Close</button></div><form id="survey-form" class="dialog-body"><p class="muted">Save your requirements in this workspace. This does not send a booking, take payment or contact a surveyor.</p><label for="survey-tier">Survey level<select id="survey-tier"><option value="bronze">Bronze</option><option value="silver" selected>Silver</option><option value="gold">Gold</option></select></label><fieldset id="survey-modules"><legend>What should be checked?</legend></fieldset><label for="survey-scope">Areas and requirements<textarea id="survey-scope" rows="4" maxlength="3000" required></textarea></label><p id="survey-feedback" role="status"></p><button type="submit">Save survey request locally</button></form></dialog>`);
  for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>{if(b.dataset.close==='files-dialog'&&fileBusy){$('files-error').textContent='Wait for this upload to finish before closing.';return;}$(b.dataset.close).close();};
  $('files-dialog').addEventListener('cancel',ev=>{if(fileBusy)ev.preventDefault();});
  function render(){
    if(!data)return;
    $('tracking').hidden=!visible;$('tracking-notice').textContent=data.notice;
    $('tracking-total').textContent=`${data.summary.open} open records${data.summary.overdue?' / '+data.summary.overdue+' overdue':''} / ${data.summary.enabled} categories tracked`;
    $('tracking-grid').innerHTML=data.categories.map(c=>`<button type="button" class="tracking-card" data-category="${e(c.id)}" aria-pressed="${category===c.id}"><span class="category-icon">${icon(c.icon)}</span><strong>${e(c.title)}</strong><small>${e(c.description)}</small><span class="category-status">${c.enabled?(c.count?`${c.open} open / ${c.count} records`:'Tracking on / no records yet'):(c.count?`Paused / ${c.count} saved records`:'Start tracking')} &rarr;</span></button>`).join('');
    for(const b of $('tracking-grid').querySelectorAll('button'))b.onclick=async()=>{
      if(busy)return;if(dirty&&category!==b.dataset.category&&!await confirmAction('Discard this unsaved record?','Your previously saved records will not change.','Discard draft'))return;
      if(category!==b.dataset.category){$('record-form').reset();dirty=false;recordSignature='';$('record-feedback').textContent='';}
      category=b.dataset.category;render();$('tracking-detail').scrollIntoView({block:'nearest'});$('tracking-category-title').focus({preventScroll:true});
    };
    $('tracking-detail').hidden=!category;
    if(!category)return;const c=data.categories.find(c=>c.id===category);if(!c)return;
    $('tracking-category-title').textContent=c.title;$('tracking-category-examples').textContent=c.examples.join(' / ');
    $('tracking-toggle').textContent=c.enabled?'Pause this category':'Start tracking';$('tracking-toggle').disabled=busy;$('record-save').disabled=busy;
    const filter=$('record-filter').value,records=data.records.filter(r=>r.category===category&&(filter==='all'||(filter==='open'?r.status!=='closed':r.status==='closed')));
    $('record-list').innerHTML=records.length?records.map(r=>`<article class="record ${r.status!=='closed'&&r.due_date&&r.due_date<new Date().toISOString().slice(0,10)?'overdue':''}"><h4>${e(r.title)}</h4><p>${e([r.place,r.owner].filter(Boolean).join(' / '))}</p>${r.description?`<p>${e(r.description)}</p>`:''}<footer><span class="due">${r.due_date?'Due '+e(r.due_date):'No due date'}</span><label class="sr-only" for="status-${r.id}">Status for ${e(r.title)}</label><select id="status-${r.id}" data-record="${e(r.id)}" ${busy?'disabled':''}>${trackingStatuses.map(s=>`<option value="${s.id}" ${s.id===r.status?'selected':''}>${s.label}</option>`).join('')}</select></footer></article>`).join(''):'<p class="empty-records">No records here yet. Add your first record to start keeping track. No inspection or asset has been assumed.</p>';
    for(const s of $('record-list').querySelectorAll('select'))s.onchange=()=>run(async()=>{const r=data.records.find(r=>r.id===s.dataset.record);data=await request(`/api/workspace/buildings/${current}/records/${r.id}`,{method:'PATCH',body:{version:r.version,status:s.value}});});
  }
  async function refresh(bid=current){
    if(!bid)return;const result=await request('/api/workspace/buildings/'+encodeURIComponent(bid));if(current!==bid)return;
    data=result;render();return result;
  }
  async function run(fn){if(busy)return;busy=true;render();$('record-feedback').textContent='';try{await fn();}catch(err){$('record-feedback').textContent=err.message;try{await refresh();}catch{}}finally{busy=false;render();}}
  $('tracking-toggle').onclick=()=>run(async()=>{const c=data.categories.find(c=>c.id===category);data=await request(`/api/workspace/buildings/${current}/modules/${category}`,{method:'PUT',body:{enabled:!c.enabled,version:c.version}});});
  $('record-filter').onchange=render;
  $('record-form').addEventListener('input',()=>{dirty=true;});
  $('record-form').onsubmit=ev=>{ev.preventDefault();run(async()=>{
    const body={category,title:$('record-title').value,place:$('record-place').value,owner:$('record-owner').value,dueDate:$('record-due').value,description:$('record-notes').value};
    const signature=JSON.stringify([current,body]);if(signature!==recordSignature){recordSignature=signature;recordKey=uuid();}
    data=await request('/api/workspace/buildings/'+current+'/records',{method:'POST',body:{...body,requestKey:recordKey}});
    dirty=false;recordSignature='';$('record-form').reset();$('record-feedback').textContent='Record saved.';
  });};
  const fileError=s=>{$('files-error').textContent=s||'';};
  function fileControls(){
    const running=['searching','building'].includes(job?.state),disabled=fileBusy||running;
    for(const id of ['photo-files','camera-file','plan-files','file-build','file-search','file-yes','file-no'])$(id).disabled=disabled;
    $('file-build').disabled=disabled||!job?.uploads?.some(p=>p.kind==='photo');
    $('file-yes').disabled=disabled||!photoLoaded;
    $('file-pause').disabled=fileBusy;$('file-running').hidden=!running;
    onPhotoActive(running,job?.message||'');
  }
  function renderFiles(p){
    if(p.buildingId!==current)return;job=p;$('file-property').textContent=p.name+' / '+p.postcode;
    $('file-stage').textContent=p.message;$('file-confirm').hidden=p.state!=='confirm'||!p.candidates.length;
    if(p.state==='confirm'&&p.candidates.length){
      photoIndex=Math.min(photoIndex,p.candidates.length-1);const c=p.candidates[photoIndex];
      if(photoSrc!==c.imageUrl){photoLoaded=false;photoSrc=c.imageUrl;$('file-candidate').src=c.imageUrl;}
      $('file-caption').textContent=c.description||c.title||'';const safe=urlSafe(c.url);$('file-source').hidden=!safe;if(safe)$('file-source').href=safe;
      $('file-candidates').innerHTML=p.candidates.length>1?p.candidates.map((_,i)=>`<button type="button" class="secondary" data-photo="${i}" aria-pressed="${i===photoIndex}">Photo ${i+1}</button>`).join(''):'';
      for(const b of $('file-candidates').querySelectorAll('button'))b.onclick=()=>{photoIndex=Number(b.dataset.photo);renderFiles(job);};
    }
    const signature=JSON.stringify(p.uploads.map(a=>a.id));
    if($('file-uploads').dataset.signature!==signature){$('file-uploads').dataset.signature=signature;
      $('file-uploads').innerHTML=p.uploads.map(a=>`<article class="uploaded-file">${a.kind==='photo'?`<img src="${e(a.imageUrl)}" alt="Uploaded building photo" loading="lazy">`:icon('file')}<strong>${e(a.title)}</strong><small>${a.kind==='photo'?'Photo':'Plan awaiting review'}</small><a href="/api/documents/${encodeURIComponent(a.documentId)}" download>Download</a></article>`).join('');}
    $('file-plan-note').hidden=!p.hasPlans;onPlanChange(p.hasPlans);
    if(p.error)fileError(p.error.message);
    fileControls();
  }
  async function loadJob(){
    if(!current)return;const bid=current,context=await request('/api/photo-flow/buildings/'+bid);if(bid!==current)return;
    if(context.job)renderFiles(context.job);else {job=null;$('file-property').textContent=context.building.name+' / '+context.building.postcode;$('file-confirm').hidden=true;$('file-uploads').innerHTML='';$('file-uploads').dataset.signature='';$('file-plan-note').hidden=!context.hasPlans;fileControls();}
    const known=new Set((context.uploads||[]).map(a=>a.documentId));
    $('file-documents').innerHTML=(data?.documents||[]).filter(d=>!known.has(d.id)).map(d=>`<p><a href="/api/documents/${encodeURIComponent(d.id)}" download>${e(d.name)}</a> <small>Saved document</small></p>`).join('');
    scheduleFile();
  }
  async function ensureJob(){
    if(job)return job;if(!current)throw new Error('Create or open a building first.');
    const created=await request('/api/photo-flow/jobs',{method:'POST',body:{buildingId:current,search:false,allowProcessing:true,requestKey:uuid()}});renderFiles(created);return job;
  }
  const action=(path,extra={})=>request(`/api/photo-flow/jobs/${job.id}/${path}`,{method:'POST',body:{version:job.version,requestKey:uuid(),...extra}});
  async function fileAction(fn){if(fileBusy)return;fileBusy=true;clearTimeout(fileTimer);fileControls();fileError();try{await fn();}catch(err){fileError(err.message);if($('survey-dialog').open)$('survey-feedback').textContent=err.message;try{await loadJob();}catch{}}finally{fileBusy=false;fileControls();scheduleFile();}}
  function scheduleFile(){clearTimeout(fileTimer);if(!job||document.hidden)return;const t=token;fileTimer=setTimeout(()=>pollFile(t),['searching','building'].includes(job.state)?1800:15000);}
  async function pollFile(t){
    if(t!==token||fileBusy||!job)return;const oldState=job.state;
    try{const p=await request('/api/photo-flow/jobs/'+job.id);if(t!==token)return;renderFiles(p);
      if(p.state==='ready'&&p.previewId&&oldState==='building'){const model=await request('/api/previews/'+p.previewId);if(t!==token)return;if(visible)onPreview(model);await refresh();fileError(p.error?.message||'Your updated model is saved. Close this panel to explore it.');}}
    catch(err){fileError(err.message);}finally{if(t===token)scheduleFile();}
  }
  async function buildSelected(assetIds){
    if(!await beforeModelChange())return;
    if(!await confirmAction('Improve the model with these photos?','These selected photos will be sent to the configured AI service. This uses API credit; the model remains an estimate.','Build from photos'))return;
    if(getState().current?.status==='refining')throw new Error('Pause the current model research before starting a photo rebuild.');
    renderFiles(await action('build',{assetIds,allowProcessing:true}));
  }
  $('file-candidate').onload=()=>{photoLoaded=true;fileControls();};$('file-candidate').onerror=()=>{photoLoaded=false;fileError('This photo could not be displayed. Choose another or upload your own.');fileControls();};
  $('file-yes').onclick=()=>fileAction(()=>buildSelected([job.candidates[photoIndex].id]));
  $('file-no').onclick=()=>fileAction(async()=>{renderFiles(await action('reject'));$('photo-files').focus();});
  $('file-pause').onclick=()=>fileAction(async()=>renderFiles(await action('stop')));
  $('file-search').onclick=()=>fileAction(async()=>{await ensureJob();if(!await confirmAction('Search for building photos?','This starts an additional online search using the configured API account.','Search for photos'))return;renderFiles(await action('search',{allowProcessing:true}));});
  $('file-build').onclick=()=>fileAction(()=>buildSelected(job.uploads.filter(a=>a.kind==='photo').slice(0,4).map(a=>a.id)));
  async function resized(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPEG, PNG or WebP photographs. Convert HEIC to JPEG first.');
    if(file.size>40*1024*1024)throw new Error('This image is too large. Export a smaller photo.');
    const src=URL.createObjectURL(file),im=new Image();
    try{im.src=src;await im.decode();if(im.naturalWidth*im.naturalHeight>40000000)throw new Error('This photo is too large to process.');const ratio=Math.min(1,1800/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(im.naturalWidth*ratio);canvas.height=Math.round(im.naturalHeight*ratio);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.86));if(!blob||blob.size>2*1024*1024)throw new Error('Please choose a smaller photograph.');return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});}finally{URL.revokeObjectURL(src);}
  }
  function transfer(file,kind){return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',`/api/photo-flow/jobs/${job.id}/upload`);xhr.timeout=90000;
    for(const [k,v] of Object.entries({'Content-Type':file.type,'X-CSRF-Token':getState().csrf,'X-File-Name':encodeURIComponent(file.name),'X-File-Kind':kind,'X-File-Permission':'yes','X-Request-Key':uuid()}))xhr.setRequestHeader(k,v);
    xhr.upload.onprogress=ev=>{if(ev.lengthComputable)$('file-progress').value=ev.loaded/ev.total*100;};
    xhr.onload=()=>{try{const p=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300)resolve(p);else reject(new Error(p.error||'Upload failed.'));}catch{reject(new Error('Unexpected upload response.'));}};
    xhr.onerror=xhr.ontimeout=()=>reject(new Error('Upload not confirmed. Reopen this panel to check saved files before trying again.'));xhr.send(file);
  });}
  async function upload(files,kind){if(!files.length)return;await fileAction(async()=>{
    if(!$('file-permission').checked)throw new Error('Confirm file permission before uploading.');if(files.length>12)throw new Error('Add up to twelve files at a time.');await ensureJob();$('file-transfer').hidden=false;
    try{for(const [i,original] of files.entries()){$('file-transfer-label').textContent=`Uploading ${i+1} of ${files.length}: ${original.name}`;$('file-progress').value=0;
      if(kind==='plan'&&(!['application/pdf','image/jpeg','image/png','image/webp'].includes(original.type)||original.size>25*1024*1024))throw new Error('Use PDF or image plans up to 25 MB each.');
      renderFiles(await transfer(kind==='plan'?original:await resized(original),kind));}
      await refresh();fileError('Files saved. Uploading has not started paid research.');
    }finally{$('file-transfer').hidden=true;}
  });}
  for(const [id,kind] of [['photo-files','photo'],['camera-file','photo'],['plan-files','plan']])$(id).onchange=()=>{const files=[...$(id).files];$(id).value='';upload(files,kind);};
  for(const [id,kind] of [['photo-drop','photo'],['plan-drop','plan']]){const z=$(id);z.ondragover=ev=>{ev.preventDefault();z.classList.add('drag');};z.ondragleave=()=>z.classList.remove('drag');z.ondrop=ev=>{ev.preventDefault();z.classList.remove('drag');if(!fileBusy)upload([...ev.dataTransfer.files],kind);};}
  let surveyKey=uuid();
  $('survey-form').onsubmit=ev=>{ev.preventDefault();fileAction(async()=>{const mods=[...$('survey-modules').querySelectorAll('input:checked')].map(i=>i.value);await request(`/api/buildings/${current}/surveys`,{method:'POST',body:{requestKey:surveyKey,tier:$('survey-tier').value,modules:mods,coverage:$('survey-scope').value,preferredDate:'',notes:''}});$('survey-feedback').textContent='Request saved locally. No email, appointment or payment was made.';});};
  $('survey-form').oninput=()=>{surveyKey=uuid();};
  document.addEventListener('visibilitychange',()=>{clearTimeout(fileTimer);if(!document.hidden)scheduleFile();});
  return {
    setCurrent(p){visible=getState().screen==='model';if(current===p.building_id){$('tracking').hidden=!visible;return;}current=p.building_id;token++;clearTimeout(fileTimer);job=null;data=null;category=null;dirty=false;$('record-form').reset();photoSrc='';onPhotoActive(false,'');refresh().catch(err=>notice(err.message));},
    async setBuilding(bid){visible=true;current=bid;token++;job=null;category=null;dirty=false;$('record-form').reset();return refresh();},
    refresh,
    isDirty:()=>dirty,
    isBusy:()=>busy||fileBusy,
    discard(){dirty=false;$('record-form').reset();},
    hide(){visible=false;$('tracking').hidden=true;},
    async openFiles(){if(!current)return;if(!await beforeModelChange())return;$('model-settings').close();showDialog('files-dialog');fileError();try{await loadJob();}catch(err){fileError(err.message);}},
    async openSurvey(){if(!current)return;$('model-settings').close();showDialog('survey-dialog');try{const c=await request('/api/catalog');$('survey-modules').innerHTML=c.modules.map(m=>`<label class="check"><input type="checkbox" value="${e(m.id)}">${e(m.name)}</label>`).join('');}catch(err){$('survey-feedback').textContent=err.message;}},
    focusTracking(){$('model-settings').close();$('tracking').scrollIntoView({block:'start'});document.querySelector('#tracking-grid button')?.focus();},
    dispose(){clearTimeout(fileTimer);token++;}
  };
}
