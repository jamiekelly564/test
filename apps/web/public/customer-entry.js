// Keep staff and building routes intact; make the customer journey the default.
const creationRoute=()=>!location.hash||/^#\/create(?:\?|$)/.test(location.hash);
if(creationRoute())location.replace('/start');
else {
  document.addEventListener('click',event=>{const link=event.target.closest('[data-route]');if(link?.dataset.route?.startsWith('/create')){event.preventDefault();event.stopImmediatePropagation();location.href='/start';}},true);
  document.addEventListener('submit',event=>{if(event.target.id==='auto-entry-form'){event.preventDefault();event.stopImmediatePropagation();location.href='/start';}},true);
  function navigation(){
    const nav=document.querySelector('.sidebar nav');if(!nav)return;
    const create=nav.querySelector('[data-nav="/create"]');if(create){if(create.getAttribute('href')!=='/start')create.href='/start';const label=create.querySelector('span');if(label&&label.textContent!=='Create my building')label.textContent='Create my building';}
    const drawings=nav.querySelector('[data-evidence-link]');if(drawings&&drawings.textContent!=='Staff: drawings')drawings.textContent='Staff: drawings';
    if(!nav.querySelector('[data-operations]')){const a=document.createElement('a');a.href='/operations';a.dataset.operations='true';a.textContent='Staff: review queue';nav.append(a);}
  }
  new MutationObserver(navigation).observe(document.getElementById('app'),{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>{if(creationRoute())location.replace('/start');});
  await import('./workspace-entry.js');navigation();
}
