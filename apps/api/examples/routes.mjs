// Only the source-attributed public demonstration files are exposed here.
const root='apps/web/public/examples/';
const names=['index.html','style.css','data.js','engine.js','app.js','sources.json'];
const ids=['farnsworth','radlett','beverley','simon','walsh','mccraith','schmidt','cambridge','belton','lancaster'];
export const exampleFiles=Object.freeze(Object.fromEntries([
  ['/examples/',root+'index.html'],
  ...names.map(n=>['/examples/'+n,root+n]),
  ...ids.map(id=>['/examples/assets/'+id+'.webp',root+'assets/'+id+'.webp'])
]));
export function exampleMime(path){
  if(!Object.hasOwn(exampleFiles,path))return null;
  if(path.endsWith('.webp'))return 'image/webp';
  if(path.endsWith('.json'))return 'application/json; charset=utf-8';
  if(path.endsWith('.js'))return 'text/javascript; charset=utf-8';
  if(path.endsWith('.css'))return 'text/css; charset=utf-8';
  return 'text/html; charset=utf-8';
}
