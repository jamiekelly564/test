// Surface estimates alongside, never instead of, the original evidence model.
let mounted=null,busy=false;
async function mount(){
  const page=document.querySelector('#main .building-page'),match=/^#\/building\/([a-zA-Z0-9-]+)/.exec(location.hash);
  if(!page||!match||page===mounted||busy)return;busy=true;
  try{
    const response=await fetch('/api/previews',{credentials:'same-origin'});if(!response.ok)return;
    const items=await response.json(),preview=items.find(p=>p.building_id===match[1]);if(!page.isConnected)return;mounted=page;
    if(preview){const box=document.createElement('section');box.className='form-card';const title=document.createElement('h3');title.textContent='Illustrative 3D estimate';const note=document.createElement('p');note.textContent='An estimated exterior is available. It does not replace this building\'s drawings, original model or inspection records.';const a=document.createElement('a');a.href='/start?preview='+encodeURIComponent(preview.id);a.className='btn secondary';a.textContent='Open estimated model';box.append(title,note,a);page.querySelector('.tabs')?.after(box);}
  }catch{/* Existing workspace stays usable if preview metadata is unavailable. */}
  finally{busy=false;}
}
const target=document.getElementById('app');if(target)new MutationObserver(()=>queueMicrotask(mount)).observe(target,{childList:true,subtree:true});window.addEventListener('hashchange',mount);mount();
