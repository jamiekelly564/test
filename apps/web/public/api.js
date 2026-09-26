let csrf='';
export function setCsrf(value){csrf=value||'';}
export async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(options.body&&typeof options.body==='string'&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(options.method&&!['GET','HEAD'].includes(options.method))headers.set('X-CSRF-Token',csrf);
  let response;try{response=await fetch(path,{...options,headers,credentials:'same-origin'});}catch{throw new Error('The PC server cannot be reached. Check the terminal is still running.');}
  const type=response.headers.get('content-type')||'';
  const result=type.includes('json')?await response.json():await response.text();
  if(!response.ok){const error=new Error(result.error||`Request failed (${response.status}).`);error.lookup=result.lookup;throw error;}
  return result;
}
export const json=(method,body)=>({method,body:JSON.stringify(body)});
export function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
