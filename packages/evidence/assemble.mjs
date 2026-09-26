import { validateGraph } from './graph.mjs';
/** Combine reviewed coordinate alignments, never infer an alignment from floor names. */
export function assembleDrafts(drafts,placements,{title,alignmentNote}){
  if(drafts.length<2||drafts.length>12||placements.length!==drafts.length)throw new Error('Choose 2 to 12 drafts with an alignment for each.');
  const scenario=drafts[0].graph.scenario,sources=new Map(),labels=new Set();
  const graph={schemaVersion:1,units:'metres',title,scenario,scaleBasis:drafts.every(d=>d.graph.scaleBasis==='dimensioned-drawing')?'dimensioned-drawing':'user-calibrated',scaleNote:'Individual draft scale retained. Assembly offsets and rotations were supplied and confirmed by the user; see floor notes.',alignment:alignmentNote,unknowns:[],conflicts:[],floors:[]};
  const prefixNote=(v,p)=>`${p}: ${v}`.slice(0,600);
  drafts.forEach((draft,i)=>{
    const g=draft.graph,p=placements[i];if(g.scenario!==scenario||g.scaleBasis==='unknown'||!g.floors.length)throw new Error('All drafts must have geometry, scale and the same existing/proposed scenario.');
    if(![p.x,p.y,p.z,p.rotation].every(Number.isFinite)||Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))>500||Math.abs(p.rotation)>360)throw new Error('Alignment values must be finite metres and degrees within the allowed range.');
    for(const s of draft.sources){const old=sources.get(s.id);if(old&&old.sha256!==s.sha256)throw new Error('Source revisions conflict.');sources.set(s.id,s);}
    const radians=p.rotation*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
    for(const f of g.floors){
      const label=f.label.trim().toLowerCase();if(labels.has(label))throw new Error(`Duplicate floor label ${f.label}. Choose non-overlapping drafts or edit the floor graph before combining.`);labels.add(label);
      graph.floors.push({...f,id:`d${i}_${f.id}`.slice(0,80),elevationM:f.elevationM+p.z,verticalBasis:p.z!==0?'user-entered':f.verticalBasis,
        note:prefixNote(f.note,`Aligned by user: X ${p.x} m, Y ${p.y} m, Z ${p.z} m, rotation ${p.rotation} degrees`),
        components:f.components.map(c=>({...c,id:`d${i}_${c.id}`.slice(0,80),rings:c.rings.map(r=>r.map(([x,y])=>[x*cos-y*sin+p.x,x*sin+y*cos+p.y]))}))});
    }
    graph.unknowns.push(...g.unknowns.map(v=>prefixNote(v,g.title)));graph.conflicts.push(...g.conflicts.map(v=>prefixNote(v,g.title)));
  });
  graph.unknowns=[...new Set(graph.unknowns)];graph.conflicts=[...new Set(graph.conflicts)];
  if(graph.unknowns.length>40||graph.conflicts.length>40)throw new Error('Too many unresolved items to combine safely. Resolve or consolidate them first.');
  graph.floors.sort((a,b)=>a.elevationM-b.elevationM);
  const list=[...sources.values()];return {graph:validateGraph(graph,list),sources:list};
}
