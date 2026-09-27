import { bounds, insidePolygon } from '../auto-model/geometry.mjs';
import { envelopePolygons, edgesFor, defaultFacade, rgb } from './architecture.mjs';

const MATERIAL = {plain:0,brick:1,horizontal:2,vertical:3,glass:4,metal:5,roof:6,ground:8};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

/** Real recesses and separate architectural parts. No photo textures, image planes,
 * arbitrary meshes, room claims or modification of the source footprint. */
export function detailedModel(spec, options, base) {
  const architecture=spec.architecture, envelopes=envelopePolygons(spec),volumes=[],warnings=[];
  const roofs=base.roofs.map(r=>({...r,colour:rgb(architecture.roofColour),material:MATERIAL.roof}));
  const facadeCount=envelopes.reduce((n,e)=>n+edgesFor(e).length*e.b.floors,0);
  const compact=options.detail==='balanced'||facadeCount>350;
  let overflow=false;
  const budget={windows:0,maxWindows:compact?420:700,parts:0,maxParts:10500};
  const add=(rings,bottom,top,kind,colour,level,block,material=0,sourcePhotoIds=[])=>{
    if(top<=bottom+.0001)return;
    if(volumes.length>=budget.maxParts){overflow=true;return;}
    const id='detail-'+budget.parts++;
    volumes.push({id,title:kind+' / estimated',parentId:`block-${block}-floor-${level}`,rings,minHeightM:bottom,heightM:top,storeys:1,sourceUrl:'',
      provenance:{height:{source:'estimated',detail:'Architectural proportions inferred from references or user edits; not measured.'}},
      preview:{kind,colour,level,block,material,sourcePhotoIds:[...sourcePhotoIds],label:kind+' / estimated'}});
  };
  const rect=(x,y,w,d)=>[[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
  for(const env of envelopes) {
    const {block,b,polygons}=env,edges=edgesFor(env),fallback=defaultFacade(b,block);
    const profiles=architecture.facades.filter(p=>p.block===block).sort((a,b)=>Number(a.edge>=0)-Number(b.edge>=0));
    const profileAt=(edge,f,pos)=>profiles.filter(p=>(p.edge===-1||p.edge===edge)&&f>=p.firstFloor&&f<=p.lastFloor&&pos>=p.start-1e-6&&pos<=p.end+1e-6).at(-1)||fallback;
    for(let f=0;f<b.floors;f++) {
      if(options.floor!=='all'&&Number(options.floor)!==f)continue;
      const bottom=f*b.floorHeight+(options.explode?f*1.8:0),top=bottom+b.floorHeight,wallTop=options.cutaway?bottom+.8:top;
      for(const polygon of polygons)add(polygon,bottom,bottom+.14,spec.mapped?'mapped floor envelope':'floor slab',[.83,.83,.79],f,block);
      for(const e of edges) {
        const len=e.length,dx=(e.q[0]-e.p[0])/len,dy=(e.q[1]-e.p[1])/len,[nx,ny]=e.normal;
        const point=(s,d)=>[e.p[0]+dx*s+nx*d,e.p[1]+dy*s+ny*d];
        const quad=(s,t,out=0,inside=-.24)=>[point(s,out),point(t,out),point(t,inside),point(s,inside)];
        const box=(s,t,out,inside,y0,y1,kind,colour,mat=0,ids=[])=>{if(t-s>.009&&Math.abs(out-inside)>.003)add([quad(s,t,out,inside)],y0,y1,kind,colour,f,block,mat,ids);};
        const mid=point(len/2,.02);
        if(envelopes.some(other=>other.block!==block&&top<=other.b.floors*other.b.floorHeight&&other.polygons.some(p=>insidePolygon(mid,p)&&insidePolygon(point(.02,.02),p)&&insidePolygon(point(len-.02,.02),p))))continue;
        const active=profiles.filter(p=>(p.edge===-1||p.edge===e.id)&&f>=p.firstFloor&&f<=p.lastFloor);
        const breaks=[...new Set([0,len,...active.flatMap(p=>[p.start*len,p.end*len])])].sort((a,b)=>a-b);
        const entrances=f===0&&!e.courtyard&&len>=1?architecture.entrances.filter(p=>p.block===block&&p.edge===e.id).map(p=>({
          ...p,start:clamp(p.position*len-p.width/2,.12,Math.max(.12,len-.9)),end:clamp(p.position*len+p.width/2,.82,len-.12),bottom:bottom+.14,top:Math.min(top-.2,bottom+p.height),door:true})).filter(p=>p.end-p.start>=.6):[];
        const openings=[];
        for(let k=0;k<breaks.length-1;k++) {
          const s=breaks[k],t=breaks[k+1],p=profileAt(e.id,f,(s+t)/2/len);
          if(options.cutaway) {box(s,t,0,-.24,bottom+.14,wallTop,'cutaway facade',rgb(p.wallColour),MATERIAL[p.surface],p.sourcePhotoIds);continue;}
          if(p.windowStyle==='none'||t-s<.85)continue;
          const n=Math.max(1,Math.min(24,Math.floor((t-s)/p.spacing))),step=(t-s)/n;
          for(let j=0;j<n;j++) {
            if(budget.windows>=budget.maxWindows){if(!warnings.includes('Small window details are reduced on large buildings.'))warnings.push('Small window details are reduced on large buildings.');break;}
            const ww=Math.min(p.windowStyle==='ribbon'?step-.18:p.windowWidth,step-.4),start=s+(j+.5)*step-ww/2,end=start+ww;
            if(ww<.4||entrances.some(d=>start<d.end+.15&&end>d.start-.15))continue;
            const sill=clamp(p.sillHeight,.18,b.floorHeight-.8),height=Math.min(p.windowHeight,b.floorHeight-sill-.18);
            openings.push({start,end,bottom:bottom+sill,top:bottom+sill+height,profile:p,index:j});budget.windows++;
          }
        }
        if(options.cutaway)continue;
        openings.push(...entrances);
        // Subtract actual opening rectangles, rather than pasting windows on a wall.
        const xs=[...new Set([0,len,...breaks,...openings.flatMap(o=>[o.start,o.end])])].sort((a,b)=>a-b);
        for(let j=0;j<xs.length-1;j++) {
          const s=xs[j],t=xs[j+1],mid=(s+t)/2,p=profileAt(e.id,f,mid/len);
          const gaps=openings.filter(o=>mid>=o.start&&mid<=o.end).sort((a,b)=>a.bottom-b.bottom);
          let cursor=bottom+.14;
          for(const o of gaps){box(s,t,0,-.24,cursor,o.bottom,'facade wall',rgb(p.wallColour),MATERIAL[p.surface],p.sourcePhotoIds);cursor=Math.max(cursor,o.top);}
          box(s,t,0,-.24,cursor,top,'facade wall',rgb(p.wallColour),MATERIAL[p.surface],p.sourcePhotoIds);
        }
        for(const o of openings) {
          const p=o.profile||profileAt(e.id,f,(o.start+o.end)/2/len),s=o.start,t=o.end,y0=o.bottom,y1=o.top,ww=t-s,hh=y1-y0;
          const frame=o.door?rgb(o.colour):rgb(p.frameColour),glass=rgb(p.glassColour),ids=o.sourcePhotoIds||p.sourcePhotoIds;
          const bay=!o.door&&p.windowStyle==='bay',depth=bay?.55:-.065,rail=.065;
          box(s,t,depth,depth-.04,y0,y1,o.door?'entrance glazing':'recessed glazing',glass,MATERIAL.glass,ids);
          for(const [a,z] of [[s,s+rail],[t-rail,t]])box(a,z,depth+.035,depth-.06,y0,y1,o.door?'door jamb':'window jamb',frame,MATERIAL.metal,ids);
          for(const [a,z] of [[y0,y0+rail],[y1-rail,y1]])box(s,t,depth+.035,depth-.06,a,z,o.door?'door transom':'window surround',frame,MATERIAL.metal,ids);
          const px=o.door?(o.doubleDoor?2:1):p.windowStyle==='picture'?1:p.panesX,py=o.door?1:p.windowStyle==='sash'?2:p.panesY;
          if(!compact||o.door) {
            for(let i=1;i<px;i++)box(s+ww*i/px-.024,s+ww*i/px+.024,depth+.045,depth-.02,y0,y1,'window mullion',frame,MATERIAL.metal,ids);
            for(let i=1;i<py;i++)box(s,t,depth+.045,depth-.02,y0+hh*i/py-.024,y0+hh*i/py+.024,'window transom',frame,MATERIAL.metal,ids);
          }
          if(!o.door)box(s-.04,t+.04,Math.max(.13,depth+.09),-.13,y0-.07,y0,'projecting sill',rgb(p.accentColour),0,ids);
          if(bay) {
            box(s,t,.6,-.22,y1,y1+.1,'bay roof',rgb(architecture.roofColour),MATERIAL.roof,ids);
            box(s,t,.6,-.22,y0-.13,y0,'bay base',rgb(p.accentColour),0,ids);
            for(const a of [s,t-.07])box(a,a+.07,.57,-.18,y0,y1,'bay side glazing',glass,MATERIAL.glass,ids);
          }
          if(o.door) {
            const knob=o.doubleDoor?(s+t)/2:s+ww*.85;
            box(knob-.025,knob+.025,depth+.11,depth+.05,y0+.85,y0+1.18,'entrance handle',[.55,.58,.57],MATERIAL.metal);
            if(o.canopyDepth>0) {box(s-.25,t+.25,o.canopyDepth,-.16,y1+.12,y1+.27,'entrance canopy',rgb(architecture.roofColour),MATERIAL.roof,ids);
              if(!compact&&o.canopyDepth>1)for(const a of [s-.12,t+.08])box(a,a+.04,o.canopyDepth*.65,.05,y1+.03,y1+.12,'canopy bracket',frame,MATERIAL.metal,ids);}
            continue;
          }
          if(f>0&&p.balcony!=='none'&&o.index%p.balconyEvery===0&&!e.courtyard) {
            const d=p.balcony==='juliet'?.18:p.balconyDepth,bs=Math.max(.03,s-.18),bt=Math.min(len-.03,t+.18),z0=p.balcony==='juliet'?y0-.1:bottom+.25,z1=z0+1.03;
            if(p.balcony==='projecting')box(bs,bt,d,-.07,bottom+.12,bottom+.25,'balcony slab',[.71,.72,.70]);
            box(bs,bt,d,d-.05,z1-.05,z1,'balcony handrail',frame,MATERIAL.metal,ids);
            if(p.railing==='glass')box(bs+.04,bt-.04,d-.01,d-.035,z0+.08,z1-.07,'balcony glass',rgb(p.glassColour),MATERIAL.glass,ids);
            else {const count=compact?2:Math.min(12,Math.ceil((bt-bs)/.22));for(let i=0;i<=count;i++){const a=bs+(bt-bs)*i/count;box(a,a+.025,d,d-.035,z0,z1,'balcony baluster',frame,MATERIAL.metal,ids);}}
            if(p.balcony==='projecting')for(const a of [bs,bt-.04])box(a,a+.04,d,.04,z1-.06,z1,'balcony side rail',frame,MATERIAL.metal,ids);
          }
        }
        for(let k=0;k<breaks.length-1;k++) {
          const s=breaks[k],t=breaks[k+1],p=profileAt(e.id,f,(s+t)/2/len);
          if(p.band!=='none') {const z=p.band==='floor'?top-.17:bottom+clamp(p.sillHeight,.18,b.floorHeight-.8)-.13;box(s,t,.06,-.03,z,z+.12,'facade band',rgb(p.accentColour),0,p.sourcePhotoIds);}
        }
        if(f===b.floors-1) {
          const p=profileAt(e.id,f,.5),roof=rgb(architecture.roofColour);
          box(0,len,.12,-.1,top-.09,top+.06,'eaves trim',roof,MATERIAL.metal);
          if(b.roof==='flat'&&architecture.parapetHeight>0) {
            box(0,len,0,-.18,top,top+architecture.parapetHeight,'parapet',rgb(p.wallColour),MATERIAL[p.surface]);
            box(0,len,.055,-.22,top+architecture.parapetHeight,top+architecture.parapetHeight+.07,'parapet coping',roof,MATERIAL.metal);
          }
        }
      }
      if(!options.cutaway&&f===b.floors-1&&b.roof==='flat')for(const polygon of polygons)add(polygon,top,top+.12,'flat roof',rgb(architecture.roofColour),f,block,MATERIAL.roof);
    }
    if(!options.cutaway&&(options.floor==='all'||Number(options.floor)===b.floors-1)) {
      const level=b.floors-1,roofBase=b.floors*b.floorHeight+(options.explode?level*1.8:0),a=b.rotation*Math.PI/180;
      const transform=([x,y])=>[b.x+x*Math.cos(a)-y*Math.sin(a),b.y+x*Math.sin(a)+y*Math.cos(a)];
      const surfaceAt=(x,y)=>{
        if(b.roof==='flat')return roofBase+.12;
        let z=null;
        for(const roof of roofs)for(const tri of roof.triangles){const [p,q,r]=tri.map(p=>[p[0],-p[2],p[1]]),den=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1]);if(Math.abs(den)<1e-8)continue;
          const u=((q[1]-r[1])*(x-r[0])+(r[0]-q[0])*(y-r[1]))/den,v=((r[1]-p[1])*(x-r[0])+(p[0]-r[0])*(y-r[1]))/den;
          if(u>=-1e-5&&v>=-1e-5&&u+v<=1+1e-5)z=Math.max(z??-Infinity,u*p[2]+v*q[2]+(1-u-v)*r[2]);}
        return z??roofBase;
      };
      for(const feature of architecture.roofFeatures.filter(p=>p.block===block)) {
        const w=feature.width,d=feature.depth,x=feature.u*b.width-w/2,y=feature.v*b.depth-d/2;
        const ring=rect(x,y,w,d).map(transform),tests=[...ring,...ring.map((p,i)=>lerp(p,ring[(i+1)%4],.5))];
        const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
        const crossing=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10;
        const poly=polygons.find(p=>tests.every(q=>insidePolygon(q,p))&&!p.some(r=>r.some((q,i)=>ring.some((a,j)=>crossing(a,ring[(j+1)%4],q,r[(i+1)%r.length]))))&&!p.slice(1).some(r=>insidePolygon(r[0],[ring])));
        if(!poly){warnings.push('A roof feature outside the usable roof was omitted.');continue;}
        const heights=ring.map(p=>surfaceAt(...p)),bottom=Math.min(...heights)-.03,top=Math.max(...heights)+feature.height,colour=rgb(feature.colour),ids=feature.sourcePhotoIds;
        add([ring],bottom,top,feature.kind,colour,level,block,feature.kind==='rooflight'?MATERIAL.glass:feature.kind==='chimney'?1:0,ids);
        if(feature.kind==='chimney')add([rect(x-.08,y-.08,w+.16,d+.16).map(transform)],top,top+.1,'chimney cap',[.55,.55,.52],level,block);
        if(feature.kind==='dormer') {
          add([rect(x-.1,y-.1,w+.2,d+.2).map(transform)],top,top+.12,'dormer roof',rgb(architecture.roofColour),level,block,MATERIAL.roof,ids);
          add([rect(x+.12,y-.035,Math.max(.12,w-.24),.025).map(transform)],Math.max(...heights)+.12,top-.1,'dormer window',[.37,.50,.55],level,block,MATERIAL.glass,ids);
        }
      }
    }
  }
  if(overflow)return {...base,detail:{mode:'simple',windows:0,parts:base.volumes.length,facades:architecture.facades.length,warnings:['Full building detail exceeded the display budget. Select one floor for detail.']},provenance:{...base.provenance,detailFallback:'Envelope retained; select one floor for detail.'}};
  return {...base,volumes,roofs,kind:spec.mapped?'detailed-map-preview':'detailed-exterior-preview',
    extent:bounds(volumes.map(v=>v.rings)),detail:{mode:compact?'balanced':'detailed',windows:budget.windows,parts:volumes.length,facades:architecture.facades.length,warnings:[...new Set(warnings)]},
    provenance:{...base.provenance,architecture:{version:1,status:'Photo-informed or user-estimated architectural detail; not a survey.',surfacePatterns:'Procedural display patterns, not photographic textures.',alignment:'Photo-to-edge placement is estimated.',profiles:architecture.facades},detailWarnings:[...new Set(warnings)]}};
}
