import './app.js';
// Companion workspace entry; keep the existing app and Marketfield viewer untouched.
function mount(){const nav=document.querySelector('.sidebar nav');if(!nav)return false;if(!nav.querySelector('[data-evidence-link]')){const a=document.createElement('a');a.href='/studio';a.dataset.evidenceLink='true';a.textContent='Build from plans';nav.insertBefore(a,nav.children[2]||null);}return true;}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.getElementById('app'),{childList:true,subtree:true});}
