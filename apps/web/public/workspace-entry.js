import './app.js';
import { api,json,escapeHtml as e } from './api.js';
import { mountModelPanel } from './model-panel.js';
// Extend the existing workspace without replacing the original Marketfield viewer.
const style=document.createElement('link');style.rel='stylesheet';style.href='/model-panel.css';document.head.append(style);
let lastPage=null,lastGrid=null,panel=null,queued=false,token=0;
async function markCards(){
  const grid=document.querySelector('#main .building-grid');if(!grid||grid===lastGrid)return;lastGrid=grid;
  try{const active=new Set((await api('/api/workflow/active')).map(r=>r.building_id));if(!grid.isConnected)return;
    for(const card of grid.querySelectorAll('.building-card')){const id=card.querySelector('[data-route]')?.dataset.route?.split('/').at(-1);if(!active.has(id))continue;
      const badge=card.querySelector('.building-card-top .badge');if(badge){badge.textContent='Evidence model available';badge.className='badge teal';}
      const note=card.querySelector('.card-foot span');if(note)note.textContent='Reviewed drawing / not site verified';
    }
  }catch{/* Building records still work when model status cannot be fetched. */}
}
async function mount(){
  const nav=document.querySelector('.sidebar nav');if(nav&&!nav.querySelector('[data-evidence-link]')){const a=document.createElement('a');a.href='/build';a.dataset.evidenceLink='true';a.textContent='Build from plans';nav.insertBefore(a,nav.children[2]||null);}
  markCards();
  const page=document.querySelector('#main .building-page');if(page===lastPage)return;lastPage=page;panel?.dispose();panel=null;const current=++token;
  const route=/^#\/building\/([a-zA-Z0-9-]+)(?:\?(.*))?$/.exec(location.hash);if(!page||!route)return;
  const bid=route[1],tab=new URLSearchParams(route[2]||'').get('tab');if(tab&&tab!=='model')return;
  try{const state=await api('/api/workflow/buildings/'+bid+'/active');if(current!==token||!page.isConnected)return;
    const tabs=page.querySelector('.tabs'),section=document.createElement('section');section.className='pc-published-panel';
    if(!state.draft){section.innerHTML=`<p>Build a detailed model from authorised drawings, then connect it here.</p><a class="btn secondary" href="/build?building=${e(bid)}">Open building reconstruction</a>`;tabs?.after(section);return;}
    const summary=page.querySelector('.building-summary > span');if(summary){summary.replaceChildren();const strong=document.createElement('strong');strong.textContent=state.draft.graph.floors.length;summary.append(strong,' evidence model levels');}
    const original=document.createElement('details');original.className='pc-legacy-view';original.innerHTML='<summary>Original model / previous preview (preserved)</summary>';while(tabs?.nextSibling)original.append(tabs.nextSibling);tabs.after(section,original);
    section.innerHTML=`<div class="section-header"><div><p class="eyebrow">EVIDENCE MODEL / ${e(state.draft.graph.scenario)}</p><h2>Reviewed drawing reconstruction</h2><p>Connected to this building. Not verified on site.</p></div><a class="btn secondary" href="/build?building=${e(bid)}">Manage sources and revisions</a></div><div data-active-model></div><button class="btn secondary" data-restore>Restore original model view</button>`;
    panel=mountModelPanel(section.querySelector('[data-active-model]'),bid,state.draft);
    section.querySelector('[data-restore]').onclick=async event=>{event.target.disabled=true;try{await api('/api/workflow/buildings/'+bid+'/active',json('DELETE',{expectedVersion:state.version}));location.reload();}catch(error){event.target.disabled=false;const p=document.createElement('p');p.textContent=error.message;section.append(p);}};
  }catch(error){if(current===token&&page.isConnected){const p=document.createElement('p');p.className='small-notice';p.textContent='Evidence model could not load: '+error.message;page.append(p);}}
}
const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount();});};
new MutationObserver(schedule).observe(document.getElementById('app'),{childList:true,subtree:true});window.addEventListener('hashchange',schedule);window.addEventListener('pagehide',()=>panel?.dispose());schedule();
