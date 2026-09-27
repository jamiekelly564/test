import { ReviewNeeded } from '../../apps/api/concierge/policy.mjs';

const centre = c => c.rings[0].reduce((sum,p,_,a)=>[sum[0]+p[0]/a.length,sum[1]+p[1]/a.length],[0,0]);
const area = c => Math.abs(c.rings[0].reduce((s,p,i,a)=>s+p[0]*a[(i+1)%a.length][1]-a[(i+1)%a.length][0]*p[1],0)/2);
function cores(floor) {
  const lift=floor.components.filter(c=>c.kind==='lift'),stair=floor.components.filter(c=>c.kind==='stair');
  if(lift.length!==1||stair.length!==1)throw new ReviewNeeded('ALIGNMENT_REVIEW','Separate floor groups lack a unique lift and stair pair. Staff must confirm their alignment.');
  return [lift[0],stair[0]];
}
/** Conservative rigid registration only. No rescaling or inferred elevations. */
export function alignGraphs(graphs) {
  if(!graphs.length)throw new ReviewNeeded('EMPTY_DRAFT','No supported floor groups were returned.');
  if(graphs.length===1)return structuredClone(graphs[0]);
  const result=structuredClone(graphs[0]);result.floors=[];
  const labels=new Set(),elevations=[];
  if(!graphs[0].floors.length)throw new ReviewNeeded('EMPTY_DRAFT','A floor group has no supported geometry.');
  const target=cores(graphs[0].floors[0]),[a,b]=target.map(centre),distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(distance<1)throw new ReviewNeeded('ALIGNMENT_REVIEW','The reference cores are too close to define an orientation.');
  for(const [batch,g] of graphs.entries()){
    if(g.scenario!==result.scenario||!g.floors.length||g.conflicts.length)throw new ReviewNeeded('ALIGNMENT_REVIEW','Floor groups are empty, conflicting or use different drawing schemes.');
    const input=cores(g.floors[0]),[c,d]=input.map(centre),span=Math.hypot(d[0]-c[0],d[1]-c[1]);
    if(Math.abs(span-distance)>.10||input.some((v,i)=>Math.abs(area(v)-area(target[i]))>Math.max(.05,area(target[i])*.05)))throw new ReviewNeeded('ALIGNMENT_REVIEW','Structural core dimensions disagree. No scale adjustment was made.');
    const angle=Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(d[1]-c[1],d[0]-c[0]),co=Math.cos(angle),si=Math.sin(angle);
    const transform=p=>[a[0]+(p[0]-c[0])*co-(p[1]-c[1])*si,a[1]+(p[0]-c[0])*si+(p[1]-c[1])*co];
    for(let i=0;i<input.length;i++){
      const moved=input[i].rings[0].map(transform),reference=target[i].rings[0];
      const fits=(left,right)=>left.every(p=>right.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<=.10));
      if(!fits(moved,reference)||!fits(reference,moved))throw new ReviewNeeded('ALIGNMENT_REVIEW','Core outlines do not agree after registration. Staff must align these drawings.');
    }
    for(const floor of structuredClone(g.floors)){
      const label=floor.label.toLowerCase().replace(/\s+/g,' ').trim();
      if(labels.has(label)||elevations.some(z=>Math.abs(z-floor.elevationM)<.10))throw new ReviewNeeded('LEVEL_CONFLICT','Separate drafts duplicate a floor label or elevation. Staff must resolve the levels.');
      labels.add(label);elevations.push(floor.elevationM);floor.id=`b${batch}_${floor.id}`;
      for(const component of floor.components){component.id=`b${batch}_${component.id}`;component.rings=component.rings.map(r=>r.map(transform));}
      result.floors.push(floor);
    }
  }
  result.floors.sort((a,b)=>a.elevationM-b.elevationM);
  result.unknowns=[...new Set([...graphs.flatMap(g=>g.unknowns),'Separate drawing groups were aligned using a unique lift/stair pair. This inferred registration still needs drawing review.'])];
  result.alignment='Automatic rigid XY registration using a unique lift/stair pair and agreeing core geometry. Original source elevations retained; no rescaling; not site verified.';
  return result;
}
