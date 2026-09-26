import { escapeHtml as e } from './api.js';
import { toModel } from '/modules/evidence/graph.mjs';
import { EvidenceViewer } from '/modules/evidence/viewer.mjs';

export function mountModelPanel(host,bid,draft){
  const q=s=>host.querySelector(s),g=draft.graph;let viewer;
  host.innerHTML=`<div class="pc-model-toolbar"><label>Floor <select data-floor><option value="all">Whole building</option>${g.floors.map(f=>`<option value="${e(f.id)}">${e(f.label)}</option>`).join('')}</select></label><label class="check"><input type="checkbox" data-cut>Cutaway</label><label class="check"><input type="checkbox" data-explode>Separate floors</label><label class="check"><input type="checkbox" data-estimates>Show estimates</label><button type="button" class="secondary" data-top>Top view</button><button type="button" class="secondary" data-reset>Reset view</button></div><div class="pc-model-grid"><div><div class="pc-model-canvas" data-canvas></div><p class="muted">Drag to rotate. Scroll or pinch to zoom. Click a component to see its evidence.</p><label>Find component<select data-component><option value="">Select a component</option></select></label></div><aside class="pc-inspector" data-inspector><h3>Building evidence</h3><p>Select a wall, door, window or floor.</p><p>This is ${e(g.scenario)} drawing geometry, not a site survey or a safety assessment.</p></aside></div><details class="pc-source-preview"><summary>Source document preview</summary><div data-source-preview><p>Select a component to open its source.</p></div></details><div class="pc-provenance"><strong>${e(g.scenario)} / ${e(draft.review_state)}</strong><p><b>Scale:</b> ${e(g.scaleNote)}<br><b>Alignment:</b> ${e(g.alignment)}</p><p><b>Unknowns:</b> ${e(g.unknowns.join(' | ')||'None recorded; not a completeness guarantee.')}</p><p><b>Conflicts:</b> ${e(g.conflicts.join(' | ')||'None recorded.')}</p></div><div class="row"><a class="secondary" href="/api/evidence/buildings/${e(bid)}/drafts/${e(draft.id)}/export.glb">Download 3D GLB</a><a class="secondary" href="/api/evidence/buildings/${e(bid)}/drafts/${e(draft.id)}/export.json">Download graph and sources</a></div>`;
  function select(id){
    const f=g.floors.find(f=>f.components.some(c=>c.id===id)),c=f?.components.find(c=>c.id===id);if(!c)return;viewer?.select(id);q('[data-component]').value=id;
    const s=draft.sources.find(s=>s.id===c.sourceId),url=s?`/api/workflow/buildings/${bid}/sources/${s.id}/preview`:null;
    q('[data-inspector]').innerHTML=`<p class="eyebrow">${e(f.label)} / ${e(c.kind)}</p><h3>${e(c.label)}</h3><p>${e(c.note)}</p><dl><dt>Geometry</dt><dd>${e(c.basis)}</dd><dt>Vertical dimensions</dt><dd>${e(f.verticalBasis)}</dd><dt>Finish</dt><dd>${e(c.finish)}</dd><dt>Source</dt><dd>${e(s?.title||c.sourceId)}<br>Page ${e(c.page)} / Revision ${e(s?.revision||'not stated')}</dd></dl>${s?`<a href="/api/documents/${e(s.documentId)}">Open original file</a>`:''}<p class="tag">Not site verified</p>`;
    if(s){q('[data-source-preview]').innerHTML=s.mime==='application/pdf'?`<p class="muted">PDF preview depends on your browser. Use Open original file when unavailable.</p><iframe title="Source plan, page ${e(c.page)}" src="${e(url)}#page=${c.page}"></iframe>`:`<img src="${e(url)}" alt="Source drawing: ${e(s.title)}">`;}
  }
  function rebuild(){
    viewer?.dispose();viewer=null;
    if(!g.floors.length){q('[data-canvas]').textContent='No supported metric geometry yet. Check the scale and missing evidence.';return;}
    try{
      const m=toModel(g,{floor:q('[data-floor]').value,cutaway:q('[data-cut]').checked,explode:q('[data-explode]').checked});
      viewer=new EvidenceViewer(q('[data-canvas]'),m);viewer.onSelect=select;viewer.estimates(q('[data-estimates]').checked);
      q('[data-component]').innerHTML='<option value="">Select a component</option>'+m.volumes.map(v=>`<option value="${e(v.id)}">${e(v.evidence.floorLabel)} / ${e(v.title)}</option>`).join('');
    }catch(error){q('[data-canvas]').textContent='Viewer could not start: '+error.message;}
  }
  for(const s of ['[data-floor]','[data-cut]','[data-explode]'])q(s).onchange=rebuild;
  q('[data-estimates]').onchange=()=>viewer?.estimates(q('[data-estimates]').checked);q('[data-top]').onclick=()=>viewer?.top();q('[data-reset]').onclick=()=>viewer?.reset();q('[data-component]').onchange=()=>select(q('[data-component]').value);
  rebuild();return {dispose(){viewer?.dispose();viewer=null;}};
}
