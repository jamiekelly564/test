import {escapeHtml as esc} from './api.js';
import {propertyInput} from '/modules/preview/ux.mjs';
const $=id=>document.getElementById(id),uuid=()=>crypto.randomUUID?.()||`photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const S={job:null,building:null,csrf:'',online:false,busy:false,timer:0,index:0,photoLoaded:false};
function error(message=''){$('error').textContent=message;$('error').hidden=!message;}
function controls(){const active=['searching','building'].includes(S.job?.state),disabled=S.busy||!S.online||active;
  for(const id of ['find','search-again','yes','no','without-photo'])$(id).disabled=disabled;
  if(S.job?.state==='confirm')$('yes').disabled=disabled||!S.photoLoaded;
  $('build-upload').disabled=disabled||!(S.job?.uploads||[]).some(a=>a.kind==='photo');$('pause').disabled=!S.online||S.busy;
  for(const id of ['photo-files','plan-files','camera-file'])$(id).disabled=S.busy||active||!S.online;
}
async function request(path,method='GET',body){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
  try{const r=await fetch(path,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':S.csrf}:{})},body:body?JSON.stringify(body):undefined,signal:c.signal});const data=await r.json();
    if(!r.ok){if(r.status===401||r.status===403){S.online=false;controls();}throw Object.assign(new Error(data.error||'The request could not be completed.'),{status:r.status});}return data;
  }catch(e){if(!e.status){S.online=false;$('connection').textContent='PC disconnected';$('reconnect').hidden=false;controls();throw new Error('The PC did not confirm this action. Keep its terminal open and reconnect. Paid actions are not automatically repeated.');}throw e;}finally{clearTimeout(t);}
}
async function session(){const s=await request('/api/session');S.csrf=s.csrf;S.online=s.authenticated;$('login').hidden=s.authenticated;$('connection').textContent=s.authenticated?'PC connected':'Access code needed';$('reconnect').hidden=s.authenticated;controls();return s.authenticated;}
function sourceLink(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function render(job){
  S.job=job;const active=['searching','building'].includes(job.state),confirm=job.state==='confirm'&&job.candidates.length>0;
  $('name').value=job.name;$('postcode').value=job.postcode;$('title').textContent=job.name;$('subtitle').textContent=`${job.postcode} / Photos & floor plans`;
  $('address-form').hidden=true;$('loading').hidden=!active;$('confirmation').hidden=!confirm;$('result').hidden=job.state!=='ready';$('upload-section').hidden=active;
  $('load-title').textContent=job.state==='searching'?'Finding your building photo':'Creating your building';$('load-message').textContent=job.message;
  for(const [id,state] of [['step-photo','searching'],['step-confirm','confirm'],['step-model','building']])$(id).classList.toggle('current',job.state===state);
  if(confirm){S.index=Math.min(S.index,job.candidates.length-1);const p=job.candidates[S.index];if($('candidate').getAttribute('src')!==p.imageUrl){S.photoLoaded=false;$('candidate').src=p.imageUrl;}$('candidate').alt='Candidate photo of '+job.name+' - identity not confirmed';$('caption').textContent=p.description||p.title||'';
    const url=sourceLink(p.url);$('source').hidden=!url;if(url)$('source').href=url;
    $('candidate-options').innerHTML=job.candidates.length>1?job.candidates.map((p,i)=>`<button type="button" data-candidate="${i}" aria-label="Show photo ${i+1}" aria-pressed="${i===S.index}">${i+1}</button>`).join(''):'';
    for(const b of $('candidate-options').querySelectorAll('button'))b.onclick=()=>{S.index=Number(b.dataset.candidate);render(S.job);};
  }
  $('upload-message').textContent=['needs_photo','paused'].includes(job.state)?job.message:'A few clear exterior photographs help us make a closer estimate.';$('search-again').hidden=!job.aiConfigured||active;
  $('uploads').innerHTML=job.uploads.map(a=>`<article class="upload-item">${a.kind==='photo'?`<img src="${esc(a.imageUrl)}" alt="Your uploaded building photo" loading="lazy">`:'<div class="upload-icon" aria-hidden="true">&#9638;</div>'}<strong>${esc(a.title)}</strong><small>${a.kind==='photo'?'Building photo / saved':'Floor plan / awaiting processing'}</small><a href="/api/documents/${encodeURIComponent(a.documentId)}">Download your file</a></article>`).join('');
  $('plan-note').hidden=!job.hasPlans;$('advanced').href='/advanced-build?building='+encodeURIComponent(job.buildingId);
  if(job.previewId){$('back-model').hidden=false;$('back-model').href='/start?preview='+encodeURIComponent(job.previewId);$('open-model').href=$('back-model').href;}
  $('result-message').textContent=job.message;$('result-title').textContent=job.error?'Your estimate is saved; photo refinement needs attention':'Your building estimate is ready';if(job.error)error(job.error.message);controls();
}
function schedule(){clearTimeout(S.timer);if(document.hidden)return;S.timer=setTimeout(poll,['searching','building'].includes(S.job?.state)?1800:15000);}
async function poll(){if(S.busy)return;try{if(!S.online&&!await session())return;if(S.job)render(await request('/api/photo-flow/jobs/'+S.job.id));}catch(e){error(e.message);}finally{schedule();}}
async function act(fn){if(S.busy)return;S.busy=true;clearTimeout(S.timer);controls();error();try{await fn();}catch(e){error(e.message);if(e.status===409&&S.job){try{render(await request('/api/photo-flow/jobs/'+S.job.id));}catch{}}}finally{S.busy=false;controls();schedule();}}
async function ensureJob(search=false){
  if(S.job)return S.job;
  const v=S.building?{name:S.building.name,postcode:S.building.postcode,errors:{}}:propertyInput($('name').value,$('postcode').value);if(Object.keys(v.errors).length)throw new Error(v.errors.name||v.errors.postcode);
  let pending;try{pending=JSON.parse(sessionStorage.getItem('pc-photo-pending')||'null');}catch{}
  const name=v.name,postcode=v.postcode,k=pending?.name===name&&pending.postcode===postcode&&pending.search===search?pending.requestKey:uuid();
  try{sessionStorage.setItem('pc-photo-pending',JSON.stringify({name,postcode,search,requestKey:k}));}catch{}
  const job=await request('/api/photo-flow/jobs','POST',{name,postcode,...(S.building?{buildingId:S.building.id}:{}),search,requestKey:k,allowProcessing:true});
  window.history.replaceState(null,'','/build?job='+encodeURIComponent(job.id));try{sessionStorage.removeItem('pc-photo-pending');}catch{}render(job);return job;
}
const action=(path,extra={})=>request('/api/photo-flow/jobs/'+S.job.id+'/'+path,'POST',{version:S.job.version,requestKey:uuid(),...extra});
$('candidate').onload=()=>{S.photoLoaded=true;controls();};
$('candidate').onerror=()=>{S.photoLoaded=false;error('This photo could not be displayed. Choose another photo or add your own.');controls();};
$('address-form').onsubmit=e=>{e.preventDefault();act(()=>ensureJob(true));};
$('search-again').onclick=()=>act(async()=>{await ensureJob();if(!confirm('Search online for building photographs? This can use API credit.'))return;render(await action('search',{allowProcessing:true}));});
$('yes').onclick=()=>act(async()=>{const p=S.job.candidates[S.index];render(await action('build',{assetIds:[p.id],allowProcessing:true}));});
$('no').onclick=()=>act(async()=>{render(await action('reject'));$('upload-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});$('permission').focus({preventScroll:true});});
$('pause').onclick=()=>act(async()=>render(await action('stop')));
$('build-upload').onclick=()=>act(async()=>{const photos=S.job.uploads.filter(a=>a.kind==='photo').slice(0,4);if(!confirm('Use these uploaded photos to create or update the model? Selected photos will be sent to the configured AI service and can use API credit.'))return;render(await action('build',{assetIds:photos.map(a=>a.id),allowProcessing:true}));});
$('without-photo').onclick=()=>act(async()=>{if(!confirm('Create an estimated exterior without a confirmed photograph? It may not resemble the real building. This can use API credit.'))return;await ensureJob();render(await action('build',{assetIds:[],withoutPhoto:true,allowProcessing:true}));});
$('reconnect').onclick=()=>act(async()=>{if(await session()&&S.job)render(await request('/api/photo-flow/jobs/'+S.job.id));});
$('login-form').onsubmit=e=>{e.preventDefault();act(async()=>{await request('/api/session','POST',{code:$('code').value});$('code').value='';await boot();});};
async function resized(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Convert this photo to JPEG, PNG or WebP before uploading. HEIC is not supported here.');
  if(file.size>40*1024*1024)throw new Error('This image is too large. Export a smaller image first.');const url=URL.createObjectURL(file),im=new Image();
  try{im.src=url;await im.decode();if(im.naturalWidth*im.naturalHeight>40000000)throw new Error('This image is too large to process safely.');const ratio=Math.min(1,1800/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(im.naturalWidth*ratio);canvas.height=Math.round(im.naturalHeight*ratio);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(!blob||blob.size>2*1024*1024)throw new Error('Please choose a smaller photograph.');return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
  }finally{URL.revokeObjectURL(url);}
}
function transfer(file,kind,k){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/photo-flow/jobs/'+S.job.id+'/upload');xhr.timeout=90000;xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-CSRF-Token',S.csrf);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-File-Kind',kind);xhr.setRequestHeader('X-File-Permission','yes');xhr.setRequestHeader('X-Request-Key',k);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)$('upload-progress').value=e.loaded/e.total*100;};
  xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(Object.assign(new Error(data.error||'Upload failed.'),{status:xhr.status}));}catch{reject(new Error('The PC returned an unexpected upload response.'));}};
  xhr.onerror=xhr.ontimeout=()=>reject(new Error('The upload was not confirmed. Reconnect before trying again. Files already saved will be retained.'));xhr.send(file);
});}
async function upload(files,kind){if(!files.length)return;await act(async()=>{
  if(!$('permission').checked)throw new Error('Tick the file-permission box before adding photos or plans.');if(files.length>12)throw new Error('Add up to 12 files at a time.');
  await ensureJob(false);$('upload-progress-section').hidden=false;
  try{for(let i=0;i<files.length;i++){const original=files[i];$('upload-status').textContent=`Preparing ${i+1} of ${files.length}: ${original.name}`;$('upload-progress').value=0;
    if(kind==='plan'&&(!['application/pdf','image/jpeg','image/png','image/webp'].includes(original.type)||original.size>25*1024*1024))throw new Error('Use PDF, JPEG, PNG or WebP plans up to 25 MB each.');
    const file=kind==='plan'?original:await resized(original);$('upload-status').textContent=`Uploading ${i+1} of ${files.length}: ${file.name}`;render(await transfer(file,kind,uuid()));}
    error();$('upload-status').textContent='Files saved. Choose Use my photos to create the model when ready.';
  }finally{$('upload-progress-section').hidden=true;}
});}
for(const [id,kind] of [['photo-files','photo'],['camera-file','photo'],['plan-files','plan']])$(id).onchange=async()=>{const files=[...$(id).files];$(id).value='';await upload(files,kind);};
for(const [id,kind] of [['photo-drop','photo'],['plan-drop','plan']]){const z=$(id);z.ondragover=e=>{e.preventDefault();z.classList.add('drag');};z.ondragleave=()=>z.classList.remove('drag');z.ondrop=e=>{e.preventDefault();z.classList.remove('drag');if(!S.busy)upload([...e.dataTransfer.files],kind);};}
async function boot(){if(!await session())return;const q=new URL(location.href).searchParams,id=q.get('job'),bid=q.get('building');
  if(id&&/^[a-zA-Z0-9-]+$/.test(id))render(await request('/api/photo-flow/jobs/'+id));
  else if(bid&&/^[a-zA-Z0-9-]+$/.test(bid)){const context=await request('/api/photo-flow/buildings/'+bid);S.building=context.building;$('name').value=S.building.name;$('postcode').value=S.building.postcode;$('title').textContent=S.building.name;$('subtitle').textContent=S.building.postcode+' / Add photos and plans';if(context.job)render(context.job);else{$('address-form').hidden=true;$('search-again').hidden=false;}}
  else{if(q.get('name'))$('name').value=q.get('name');if(q.get('postcode'))$('postcode').value=q.get('postcode');}controls();schedule();
}
document.addEventListener('visibilitychange',()=>{clearTimeout(S.timer);if(!document.hidden)poll();});window.addEventListener('pagehide',()=>clearTimeout(S.timer));boot().catch(e=>{error(e.message);schedule();});
