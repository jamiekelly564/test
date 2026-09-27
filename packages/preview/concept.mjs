import { triangulate, bounds } from '../auto-model/geometry.mjs';
export const CONCEPT_NOTICE='ILLUSTRATIVE LAYOUT - INVENTED, NOT AN ACTUAL FLOOR PLAN';
// Clip hypothetical zones to supported footprints, including courtyard holes.
function clip(points,axis,limit,above){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=x=>above?x[axis]>=limit:x[axis]<=limit,ia=inside(a),ib=inside(b);if(ia)out.push(a);if(ia!==ib){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+t*(b[j]-v)));}}return out;}
export function conceptZones(model){
  const slabs=model.volumes.filter(v=>['floor slab','mapped floor envelope'].includes(v.preview?.kind)),zones=[];
  for(const [si,slab] of slabs.entries()){
    const b=bounds([slab.rings]),w=b.maxX-b.minX,h=b.maxY-b.minY,cols=Math.max(1,Math.min(5,Math.round(w/8))),tris=triangulate(slab.rings),rows=[b.minY,b.minY+h*.43,b.minY+h*.57,b.maxY];
    for(let r=0;r<3;r++)for(let c=0;c<(r===1?1:cols);c++){
      const x0=r===1?b.minX:b.minX+c*w/cols,x1=r===1?b.maxX:b.minX+(c+1)*w/cols;
      const pieces=tris.map(t=>clip(clip(clip(clip(t,0,x0,true),0,x1,false),1,rows[r],true),1,rows[r+1],false)).filter(p=>p.length>=3&&Math.abs(p.reduce((n,a,i)=>{const z=p[(i+1)%p.length];return n+a[0]*z[1]-z[0]*a[1];},0))>.02);
      if(pieces.length)zones.push({id:`concept-${si}-${r}-${c}`,label:r===1?'Illustrative circulation zone':'Example area '+(r*cols+c+1),pieces,level:slab.preview.level,height:slab.heightM+.03,colour:r===1?[.74,.79,.77]:[(c%2?.74:.83),.84,.77],fictional:true});
    }
  }return zones;
}
function zoneEdges(zones){const result=new Map(),point=p=>p.map(x=>Math.round(x*1e6)).join(',');for(const z of zones){const edges=new Map();for(const p of z.pieces)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],k=[point(a),point(b)].sort().join('|'),e=edges.get(k);if(e)e.count++;else edges.set(k,{a,b,count:1,level:z.level,height:z.height});}for(const [k,e] of edges)if(e.count===1)result.set(z.level+'|'+k,e);}return [...result.values()].filter(e=>Math.hypot(e.a[0]-e.b[0],e.a[1]-e.b[1])>.1);}
export function withConcept(model){
  const zones=conceptZones(model),volumes=[...model.volumes];
  for(const z of zones)for(const [i,p] of z.pieces.entries())volumes.push({id:z.id+'-'+i,title:z.label+' / INVENTED',parentId:'concept-floor-'+z.level,rings:[p],minHeightM:z.height,heightM:z.height+.035,storeys:1,sourceUrl:'',provenance:{height:{source:'fictional',detail:CONCEPT_NOTICE}},preview:{kind:'fictional layout zone',colour:z.colour,level:z.level,label:z.label+' / INVENTED'}});
  for(const [i,e] of zoneEdges(zones).entries()){const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],l=Math.hypot(dx,dy),nx=-dy/l*.045,ny=dx/l*.045,ring=[[e.a[0]+nx,e.a[1]+ny],[e.b[0]+nx,e.b[1]+ny],[e.b[0]-nx,e.b[1]-ny],[e.a[0]-nx,e.a[1]-ny]];
    volumes.push({id:'concept-wall-'+i,title:'Invented zone divider',parentId:'concept-floor-'+e.level,rings:[ring],minHeightM:e.height+.04,heightM:e.height+.6,storeys:1,sourceUrl:'',provenance:{height:{source:'fictional',detail:CONCEPT_NOTICE}},preview:{kind:'fictional divider',colour:[.76,.79,.72],level:e.level,label:'INVENTED divider'}});
  }
  if(volumes.length>5000)throw new Error('Select one floor to view the example layout.');
  return {...model,volumes,kind:'fictional-interior-concept',provenance:{...model.provenance,interior:CONCEPT_NOTICE},conceptZones:zones};
}
export function conceptSVG(model){const zones=conceptZones(model),b=model.extent,pad=2;
  const polygons=zones.flatMap(z=>z.pieces.map(p=>`<polygon points="${p.map(q=>q.join(',')).join(' ')}" fill="${z.label.startsWith('Illustrative')?'#c0cfcb':'#e3e9dc'}"/>`)).join('');
  const lines=zoneEdges(zones).map(e=>`<line x1="${e.a[0]}" y1="${e.a[1]}" x2="${e.b[0]}" y2="${e.b[1]}" stroke="#627e79" stroke-width="0.12"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Invented example layout, not an actual floor plan" viewBox="${b.minX-pad} ${b.minY-pad} ${b.maxX-b.minX+2*pad} ${b.maxY-b.minY+2*pad}">${polygons}${lines}</svg>`;
}
