import { triangulate, bounds, signedArea, insidePolygon } from '../auto-model/geometry.mjs';
export const CONCEPT_NOTICE='ILLUSTRATIVE LAYOUT - INVENTED, NOT AN ACTUAL FLOOR PLAN';
const colour={wall:[.89,.87,.81],wood:[.67,.51,.36],fabric:[.30,.47,.49],paper:[.91,.92,.87],metal:[.27,.31,.32]};
export function conceptOptions(value={}) {return {layout:['residential','office','open'].includes(value.layout)?value.layout:'residential',density:[2,3,4].includes(Number(value.density))?Number(value.density):3,furniture:value.furniture!==false,fullWalls:value.fullWalls===true};}
function clip(points,axis,limit,above){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=x=>above?x[axis]>=limit:x[axis]<=limit,ia=inside(a),ib=inside(b);if(ia)out.push(a);if(ia!==ib){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+t*(b[j]-v)));}}return out;}
const crop=(points,r)=>clip(clip(clip(clip(points,0,r[0],true),0,r[2],false),1,r[1],true),1,r[3],false);
const area=p=>Math.abs(signedArea(p));
const rectangle=([x,y,x1,y1])=>[[x,y],[x1,y],[x1,y1],[x,y1]];
const toWorld=(basis,p)=>[basis.origin[0]+p[0]*basis.x[0]+p[1]*basis.y[0],basis.origin[1]+p[0]*basis.x[1]+p[1]*basis.y[1]];
function floorBasis(slab){
  const r=slab.rings[0];let longest=0,x=[1,0];
  for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d>longest){longest=d;x=[(b[0]-a[0])/d,(b[1]-a[1])/d];}}
  return {origin:r[0],x,y:[-x[1],x[0]]};
}
function layouts(model,options){
  const out=[];
  for(const [si,slab] of model.volumes.filter(v=>['floor slab','mapped floor envelope'].includes(v.preview?.kind)).entries()){
    const basis=floorBasis(slab),local=slab.rings.map(r=>r.map(p=>{const d=[p[0]-basis.origin[0],p[1]-basis.origin[1]];return [d[0]*basis.x[0]+d[1]*basis.x[1],d[0]*basis.y[0]+d[1]*basis.y[1]];}));
    const b=bounds([local]),w=b.maxX-b.minX,h=b.maxY-b.minY,cols=options.layout==='open'?1:Math.max(1,Math.min(7,Math.round(w/(options.density===2?10:options.density===4?5:7))));
    const corridor=Math.min(2.2,h*.22),rows=options.layout==='open'?[b.minY,b.maxY]:[b.minY,(b.minY+b.maxY-corridor)/2,(b.minY+b.maxY+corridor)/2,b.maxY];
    out.push({si,slab,basis,local,b,cols,rows,tris:triangulate(local)});
  }return out;
}
/** A user-selected design illustration, never a room inference from photos. */
export function conceptZones(model,value={}){
  const options=conceptOptions(value),zones=[];
  for(const l of layouts(model,options)) {
    for(let r=0;r<l.rows.length-1;r++)for(let c=0;c<(r===1?1:l.cols);c++){
      const w=l.b.maxX-l.b.minX,x0=r===1?l.b.minX:l.b.minX+c*w/l.cols,x1=r===1?l.b.maxX:l.b.minX+(c+1)*w/l.cols,cell=[x0,l.rows[r],x1,l.rows[r+1]];
      const pieces=l.tris.map(t=>crop(t,cell)).filter(p=>p.length>=3&&area(p)>.0001);
      if(pieces.length)zones.push({id:`concept-${l.si}-${r}-${c}`,label:r===1?'Illustrative circulation zone':options.layout==='open'?'Example open space':'Example room '+(zones.filter(z=>!z.circulation).length+1),circulation:r===1,
        pieces:pieces.map(p=>p.map(q=>toWorld(l.basis,q))),localPieces:pieces,cell,basis:l.basis,level:l.slab.preview.level,height:l.slab.heightM+.03,
        colour:r===1?[.82,.80,.72]:options.layout==='office'?[.74,.79,.80]:c%2?[.82,.75,.64]:[.86,.81,.72],fictional:true});
    }
  }return zones;
}
function intervals(rings,axis,value,lo,hi){
  const other=1-axis,points=[lo,hi];
  for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];if((a[axis]<=value&&b[axis]>value)||(b[axis]<=value&&a[axis]>value))points.push(a[other]+(b[other]-a[other])*(value-a[axis])/(b[axis]-a[axis]));}
  const sorted=[...new Set(points.filter(x=>x>=lo-1e-7&&x<=hi+1e-7).map(x=>+x.toFixed(7)))].sort((a,b)=>a-b),out=[];
  for(let i=0;i<sorted.length-1;i++){const mid=(sorted[i]+sorted[i+1])/2,p=axis===0?[value,mid]:[mid,value];if(insidePolygon(p,rings))out.push([sorted[i],sorted[i+1]]);}return out;
}
function partitionWalls(model,options){
  const walls=[],doors=[];
  if(options.layout==='open')return {walls,doors};
  for(const l of layouts(model,options)){
    const w=l.b.maxX-l.b.minX,cellWidth=w/l.cols,height=l.slab.heightM+.07,level=l.slab.preview.level;
    const add=(a,b)=>{if(Math.hypot(b[0]-a[0],b[1]-a[1])>.12)walls.push({a:toWorld(l.basis,a),b:toWorld(l.basis,b),height,level,local:[a,b],layout:l});};
    for(const line of [l.rows[1],l.rows[2]])for(const [a,b] of intervals(l.local,1,line,l.b.minX,l.b.maxX)){
      let start=a;
      for(let c=0;c<l.cols;c++){
        const centre=l.b.minX+(c+.5)*cellWidth,half=Math.min(.48,cellWidth*.13);
        if(centre-half<a+.2||centre+half>b-.2)continue;
        const swingY=line+(line===l.rows[1]?-1:1)*2*half,clearance=[centre-half-.05,Math.min(line,swingY)-.05,centre+half+.05,Math.max(line,swingY)+.05];
        const expected=(clearance[2]-clearance[0])*(clearance[3]-clearance[1]);
        if(Math.abs(l.tris.reduce((n,t)=>n+area(crop(t,clearance)),0)-expected)>.0001)continue;
        add([start,line],[centre-half,line]);start=centre+half;
        doors.push({a:toWorld(l.basis,[centre-half,line]),b:toWorld(l.basis,[centre+half,line]),height,level,
          swing:toWorld(l.basis,[centre-half,swingY]),width:2*half,fictional:true});
      }
      add([start,line],[b,line]);
    }
    for(let c=1;c<l.cols;c++)for(const [lo,hi] of [[l.rows[0],l.rows[1]],[l.rows[2],l.rows[3]]]){
      const x=l.b.minX+c*cellWidth;
      for(const [a,b] of intervals(l.local,0,x,lo,hi))add([x,a],[x,b]);
    }
  }return {walls,doors};
}
function roomFits(z,r){const target=(r[2]-r[0])*(r[3]-r[1]);return target>0&&Math.abs(z.localPieces.reduce((n,p)=>n+area(crop(p,r)),0)-target)<.0001;}
function furnitureFor(z,layout){
  if(z.circulation)return [];
  const [x,y,x1,y1]=z.cell,items=[],margin=.55,w=x1-x,h=y1-y;
  const attempt=(r,type)=>{if(roomFits(z,r)&&!items.some(o=>r[0]<o.r[2]+.15&&r[2]>o.r[0]-.15&&r[1]<o.r[3]+.15&&r[3]>o.r[1]-.15))items.push({r,type,z});};
  if(layout==='office'){
    for(let i=0;i<Math.min(3,Math.floor(w/2));i++)attempt([x+margin+i*2,y+margin,x+margin+i*2+1.4,y+margin+.8],'desk');
    attempt([x1-1.1,y1-1.9,x1-.4,y1-.4],'cabinet');
  }else{
    attempt([x+margin,y+margin,x+margin+2.1,y+margin+.85],'sofa');
    attempt([x+w*.48,y+h*.45,x+w*.48+1.2,y+h*.45+.7],'table');
    if(w>5&&h>4)attempt([x1-2.1,y1-2.7,x1-.6,y1-.6],'bed');
    else attempt([x1-1.2,y1-1.7,x1-.45,y1-.45],'cabinet');
  }return items;
}
export function withConcept(model,value={}){
  const options=conceptOptions(value),zones=conceptZones(model,options),volumes=[...model.volumes],partitions=partitionWalls(model,options),wallHeight=options.fullWalls?2.25:.95;
  const add=(rings,bottom,top,kind,colour,level,material=0)=>volumes.push({id:'concept-part-'+volumes.length,title:kind+' / INVENTED',parentId:'concept-floor-'+level,rings,minHeightM:bottom,heightM:top,storeys:1,sourceUrl:'',
    provenance:{height:{source:'fictional',detail:CONCEPT_NOTICE}},preview:{kind,colour,level,material,fictional:true,label:kind+' / INVENTED'}});
  for(const z of zones)for(const p of z.pieces)add([p],z.height,z.height+.035,'fictional layout zone',z.colour,z.level,options.layout==='office'?0:7);
  function panel(a,b,width=.09){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*width/2,ny=dx/l*width/2;return [[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];}
  for(const w of partitions.walls){
    const l=w.layout,local=w.local,dx=local[1][0]-local[0][0],dy=local[1][1]-local[0][1],vertical=Math.abs(dx)<Math.abs(dy),r=vertical?[local[0][0]-.045,Math.min(local[0][1],local[1][1]),local[0][0]+.045,Math.max(local[0][1],local[1][1])]:[Math.min(local[0][0],local[1][0]),local[0][1]-.045,Math.max(local[0][0],local[1][0]),local[0][1]+.045];
    for(const tri of l.tris){const piece=crop(tri,r);if(piece.length>2&&area(piece)>.00001)add([piece.map(p=>toWorld(l.basis,p))],w.height,w.height+wallHeight,'fictional divider',colour.wall,w.level);}
  }
  for(const d of partitions.doors){
    add([panel(d.a,d.swing,.04)],d.height,d.height+Math.min(2.05,wallHeight),'fictional door leaf',colour.wood,d.level,7);
    if(options.fullWalls)add([panel(d.a,d.b)],d.height+2.05,d.height+2.25,'fictional doorway lintel',colour.wall,d.level);
  }
  const furniture=options.furniture?zones.flatMap(z=>furnitureFor(z,options.layout)):[];
  for(const item of furniture){
    const {r,z,type}=item,[x,y,x1,y1]=r,h=z.height+.04;
    const box=(a,bottom,top,kind,c,mat=0)=>add([rectangle(a).map(p=>toWorld(z.basis,p))],h+bottom,h+top,kind,c,z.level,mat);
    if(type==='sofa'){
      box(r,.1,.37,'fictional sofa base',colour.fabric);box([x,y,x1,y+.17],.37,.8,'fictional sofa back',colour.fabric);
      box([x,y,x+.16,y1],.35,.63,'fictional sofa arm',colour.fabric);box([x1-.16,y,x1,y1],.35,.63,'fictional sofa arm',colour.fabric);
      for(let c=0;c<2;c++)box([x+.18+(x1-x-.36)*c/2,y+.2,x+.18+(x1-x-.36)*(c+1)/2-.025,y1-.04],.37,.48,'fictional cushion',[.5,.64,.62]);
    }else if(type==='bed'){
      box(r,.12,.33,'fictional bed frame',colour.wood,7);box([x+.04,y+.04,x1-.04,y1-.04],.33,.52,'fictional mattress',colour.paper);
      box([x+.12,y+.12,x1-.12,y+.48],.52,.64,'fictional pillow',colour.paper);box([x+.04,y+.75,x1-.04,y1-.05],.52,.55,'fictional bed cover',[.46,.62,.63]);
    }else if(type==='desk'||type==='table'){
      const top=type==='desk'?.76:.46;box(r,top-.07,top,'fictional '+type,colour.wood,7);
      for(const xx of [x+.08,x1-.13])for(const yy of [y+.08,y1-.13])box([xx,yy,xx+.05,yy+.05],.04,top-.07,'fictional furniture leg',colour.metal,5);
      if(type==='desk'){box([x+.4,y+.13,x+.95,y+.2],top+.1,top+.48,'fictional monitor',colour.metal);box([x+.56,y+.15,x+.72,y+.35],top,top+.1,'fictional monitor stand',colour.metal);}
    }else box(r,.03,1.0,'fictional cabinet',colour.wood,7);
  }
  if(volumes.length>14000)throw new Error('Select one floor or switch off furnishings for this example.');
  return {...model,volumes,kind:'fictional-interior-concept',provenance:{...model.provenance,interior:CONCEPT_NOTICE,concept:{...options,rooms:zones.filter(z=>!z.circulation).length,neverSurveyed:true}},conceptZones:zones,conceptDoors:partitions.doors};
}
export function conceptSVG(model,value={}){
  const options=conceptOptions(value),zones=conceptZones(model,options),b=model.extent,pad=2,walls=partitionWalls(model,options);
  const polygons=zones.flatMap(z=>z.pieces.map(p=>`<polygon points="${p.map(q=>q.join(',')).join(' ')}" fill="${z.circulation?'#ddd5c0':options.layout==='office'?'#d6e2e6':'#e9dfcd'}"/>`)).join('');
  const lines=walls.walls.map(e=>`<line x1="${e.a[0]}" y1="${e.a[1]}" x2="${e.b[0]}" y2="${e.b[1]}" stroke="#526766" stroke-width="0.14"/>`).join('');
  const doors=walls.doors.map(d=>`<path d="M ${d.a.join(' ')} L ${d.swing.join(' ')} M ${d.b.join(' ')} Q ${d.b[0]+d.swing[0]-d.a[0]} ${d.b[1]+d.swing[1]-d.a[1]} ${d.swing.join(' ')}" fill="none" stroke="#a37c4b" stroke-width="0.075"/>`).join('');
  const furniture=options.furniture?zones.flatMap(z=>furnitureFor(z,options.layout)).map(({r,z})=>`<polygon points="${rectangle(r).map(p=>toWorld(z.basis,p).join(',')).join(' ')}" fill="#a2b9b4" stroke="#536f68" stroke-width="0.04"/>`).join(''):'';
  const labels=zones.filter(z=>!z.circulation).map((z,i)=>{const p=z.localPieces.slice().sort((a,b)=>area(b)-area(a))[0],centre=p.reduce((n,q)=>[n[0]+q[0]/p.length,n[1]+q[1]/p.length],[0,0]),v=toWorld(z.basis,centre);return `<text x="${v[0]}" y="${v[1]}" text-anchor="middle" font-size="0.48" fill="#445654">Example ${i+1}</text>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Invented example layout, not an actual floor plan" viewBox="${b.minX-pad} ${b.minY-pad} ${b.maxX-b.minX+2*pad} ${b.maxY-b.minY+2*pad}"><title>${CONCEPT_NOTICE}</title>${polygons}${furniture}${lines}${doors}${labels}</svg>`;
}
