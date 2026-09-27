import { meshModel, bounds } from '../auto-model/geometry.mjs';
import { validateMapped, mappedModel } from './map-shape.mjs';

export const PREVIEW_NOTICE = 'Illustrative estimate - not surveyed. Building identity, dimensions, windows and unseen elevations may be wrong. Not for fire safety, compliance or construction.';
export const FINISHES = ['brick','cream-brick','render','concrete','metal'];
export const ROOFS = ['flat','gable','hip'];
const colours={brick:[.57,.31,.23],'cream-brick':[.74,.65,.49],render:[.87,.85,.79],concrete:[.62,.65,.64],metal:[.46,.51,.53],glass:[.22,.43,.49],trim:[.88,.87,.80],roof:[.25,.28,.29],ground:[.85,.87,.84]};
const text=(v,max=700)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';
const num=(v,lo,hi,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error('Invalid estimated '+label+'.');return v;};
export function defaultSpec(name='Building'){
  // A visible starting hypothesis, NOT a building identified from its name.
  const small=/\b(cottage|bungalow)\b/i.test(name);
  return {schemaVersion:1,matchLabel:'Building not identified yet',matchBasis:'unresolved',summary:'Generic starting shape. Public research has not yet established this building\'s appearance.',
    blocks:[{label:'Main block',x:0,y:0,width:small?12:28,depth:small?9:16,rotation:0,floors:small?1:4,floorHeight:3,roof:small?'gable':'flat',roofHeight:small?2:0,finish:'brick',columns:small?3:7,balconies:false}],
    facts:[],assumptions:['Initial footprint, number of floors, facade and window pattern are placeholders.','Interiors and all safety-related features are unknown.'],usedPhotoIds:[]};
}
/** Deliberately separate from the evidence graph: estimates can exist without drawings. */
export function validateSpec(value){
  if(!value||value.schemaVersion!==1||!Array.isArray(value.blocks)||value.blocks.length<1||value.blocks.length>6)throw new Error('Use 1 to 6 estimated building blocks.');
  if(!['unresolved','likely','ambiguous'].includes(value.matchBasis))throw new Error('Invalid building match basis.');
  const blocks=value.blocks.map(b=>{
    const floors=num(b.floors,1,25,'floors'),columns=num(b.columns,1,12,'window columns');
    if(!Number.isInteger(floors)||!Number.isInteger(columns)||!ROOFS.includes(b.roof)||!FINISHES.includes(b.finish)||typeof b.balconies!=='boolean')throw new Error('Invalid estimated facade or roof.');
    return {label:text(b.label,80)||'Estimated block',x:num(b.x,-200,200,'X'),y:num(b.y,-200,200,'Y'),width:num(b.width,4,120,'width'),depth:num(b.depth,4,100,'depth'),rotation:num(b.rotation,-180,180,'rotation'),floors,columns,
      floorHeight:num(b.floorHeight,2.4,5,'storey height'),roof:b.roof,roofHeight:num(b.roofHeight,0,12,'roof height'),finish:b.finish,balconies:b.balconies};
  });
  const list=(v,max)=>{if(!Array.isArray(v)||v.length>max)throw new Error('Too many preview notes.');return v;};
  if(value.mapped && blocks.length!==1)throw new Error('A mapped outline uses one editable envelope.');
  return {schemaVersion:1,matchLabel:text(value.matchLabel,250)||'Unconfirmed building',matchBasis:value.matchBasis,summary:text(value.summary),blocks,
    facts:list(value.facts||[],30).map(f=>({detail:text(f.detail,400),sourceId:text(f.sourceId,80)})).filter(f=>f.detail),
    assumptions:list(value.assumptions||[],30).map(v=>text(v,400)).filter(Boolean),usedPhotoIds:list(value.usedPhotoIds||[],4).map(v=>text(v,80)),
    ...(value.mapped?{mapped:validateMapped(value.mapped)}:{})};
}
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str={type:'string'},number={type:'number'},integer={type:'integer'},list=items=>({type:'array',items});
export const specSchema=obj({schemaVersion:{type:'integer',enum:[1]},matchLabel:str,matchBasis:{type:'string',enum:['unresolved','likely','ambiguous']},summary:str,
  blocks:list(obj({label:str,x:number,y:number,width:number,depth:number,rotation:number,floors:integer,floorHeight:number,roof:{type:'string',enum:ROOFS},roofHeight:number,finish:{type:'string',enum:FINISHES},columns:integer,balconies:{type:'boolean'}})),
  facts:list(obj({detail:str,sourceId:str})),assumptions:list(str),usedPhotoIds:list(str)});

/** Procedural exterior with floors, glazing, frames, balconies and actual pitched roof triangles. */
export function previewModel(spec,{floor='all',explode=false,cutaway=false}={}){
  spec=validateSpec(spec);
  if(spec.mapped)return mappedModel(spec,{floor,explode,cutaway},colours);
  const volumes=[],roofs=[];let sequence=0,windows=0;
  const transform=(b,x,y)=>{const a=b.rotation*Math.PI/180;return [b.x+x*Math.cos(a)-y*Math.sin(a),b.y+x*Math.sin(a)+y*Math.cos(a)];};
  function box(b,x,y,w,d,bottom,top,kind,colour,level){
    if(top<=bottom)return;
    const id='estimate-'+sequence++,rings=[[transform(b,x,y),transform(b,x+w,y),transform(b,x+w,y+d),transform(b,x,y+d)]];
    volumes.push({id,title:b.label+' / '+kind,parentId:'floor-'+level,rings,minHeightM:bottom,heightM:top,storeys:1,sourceUrl:'',
      provenance:{height:{source:'estimated',detail:'Procedural, unmeasured preview'}},preview:{kind,colour,level,label:b.label+' / '+kind}});
  }
  for(const [bi,b] of spec.blocks.entries()){
    const w=b.width,d=b.depth,h=b.floorHeight;
    const tint=colours[b.finish];
    for(let f=0;f<b.floors;f++){
      if(floor!=='all'&&Number(floor)!==f)continue;
      const y0=f*h+(explode?f*1.8:0),y1=y0+h;
      box(b,0,0,w,d,y0,y0+.16,'floor slab',colours.trim,f);
      const wallTop=cutaway?y0+.8:y1;
      box(b,0,0,w,.20,y0+.16,wallTop,'facade',tint,f);
      box(b,0,d-.20,w,.20,y0+.16,wallTop,'facade',tint,f);
      box(b,0,.2,.20,d-.4,y0+.16,wallTop,'facade',tint,f);
      box(b,w-.20,.2,.20,d-.4,y0+.16,wallTop,'facade',tint,f);
      if(cutaway)continue;
      box(b,-.04,-.04,w+.08,d+.08,y1-.13,y1,'storey band',colours.trim,f);
      for(let face=0;face<4;face++){
        const length=face<2?w:d,n=Math.min(b.columns,Math.max(1,Math.floor(length/2.4))),step=length/n,ww=Math.min(1.7,step*.6),wh=h*.49;
        for(let j=0;j<n;j++){
          if(windows++>=800)break;
          const p=step*(j+.5)-ww/2;
          const xf=face<2?p:face===2?-.07:w-.03,yf=face<2?(face===0?-.07:d-.03):p;
          box(b,xf,yf,face<2?ww:.1,face<2?.1:ww,y0+.85,y0+.85+wh,'window frame',colours.trim,f);
          const gx=face<2?xf+.08:face===2?-.085:w+.055,gy=face<2?(face===0?-.085:d+.055):yf+.08;
          box(b,gx,gy,face<2?ww-.16:.025,face<2?.025:ww-.16,y0+.94,y0+.77+wh,'glazing',colours.glass,f);
          if(b.balconies&&f>0&&face===0&&j%2===0){
            box(b,xf-.25,-1.25,ww+.5,1.3,y0+.15,y0+.30,'balcony slab',colours.concrete,f);
            box(b,xf-.25,-1.25,ww+.5,.06,y0+.3,y0+1.2,'balcony rail',colours.metal,f);
          }
        }
      }
      if(f===0){
        box(b,w*.45,-.16,Math.min(2.5,w*.15),.15,.16,2.4,'entrance appearance',colours.glass,f);
        box(b,w*.43,-1.3,Math.min(3.6,w*.2),1.5,2.45,2.61,'entrance canopy',colours.roof,f);
      }
    }
    if(!cutaway&&(floor==='all'||Number(floor)===b.floors-1)){
      const base=b.floors*h+(explode?(b.floors-1)*1.8:0),height=Math.max(.2,b.roofHeight);
      if(b.roof==='flat'){
        box(b,-.15,-.15,w+.3,d+.3,base,base+.2,'flat roof',colours.roof,b.floors-1);
        for(const [x,y,bw,bd] of [[0,0,w,.17],[0,d-.17,w,.17],[0,0,.17,d],[w-.17,0,.17,d]])box(b,x,y,bw,bd,base+.2,base+.55,'parapet',tint,b.floors-1);
      }else{
        const pts=(x,y,z)=>{const p=transform(b,x,z);return [p[0],y,-p[1]];};
        const a=pts(-.2,base,-.2),c=pts(w+.2,base,d+.2),bb=pts(w+.2,base,-.2),dd=pts(-.2,base,d+.2);
        const inset=b.roof==='hip'?Math.min(d/2,w*.35):0;
        const e=pts(inset,base+height,d/2),ff=pts(w-inset,base+height,d/2);
        roofs.push({id:'roof-'+bi,triangles:[[a,bb,ff],[a,ff,e],[dd,e,ff],[dd,ff,c],[a,e,dd],[bb,c,ff]],colour:colours.roof,level:b.floors-1});
      }
    }
  }
  if(volumes.length>3000)throw new Error('Estimated exterior is too complex.');
  return {schemaVersion:1,kind:'illustrative-preview',volumes,roofs,extent:bounds(volumes.map(v=>v.rings)),origin:{coordinateSystem:'local estimated metres',georeferenced:false},
    attribution:{text:'PropertyChecked procedural estimate; source references are in provenance.'},provenance:{status:PREVIEW_NOTICE,matchBasis:spec.matchBasis,matchLabel:spec.matchLabel,facts:spec.facts,assumptions:spec.assumptions}};
}
export function previewMeshes(model){
  const catalog=new Map(model.volumes.map(v=>[v.id,v.preview]));
  const objects=meshModel(model).map(o=>{const p=catalog.get(o.id);return {...o,colors:Array(o.positions.length/3).fill(p.colour).flat(),extras:{...o.extras,...p,estimated:true,notSurveyed:true}};});
  for(const roof of model.roofs){
    const positions=[],normals=[],colors=[];
    for(const tri of roof.triangles){const [a,b,c]=tri,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];const l=Math.hypot(...n)||1;n=n.map(v=>v/l);if(n[1]<0)n=n.map(v=>-v);for(const p of tri){positions.push(...p);normals.push(...n);colors.push(...roof.colour);}}
    objects.push({id:roof.id,positions,normals,colors,extras:{estimated:true,notSurveyed:true,kind:'pitched roof',level:roof.level}});
  }
  return objects;
}
/** Self-contained glTF export keeps the same facade colours and pitched geometry as the viewer. */
export function previewGLB(spec,provenance={}){
  const model=previewModel(spec),objects=previewMeshes(model),chunks=[],bufferViews=[],accessors=[];let offset=0;
  const add=(data,position=false)=>{const bytes=new Uint8Array(new Float32Array(data).buffer),index=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});offset+=bytes.length;chunks.push(bytes);const a={bufferView:index,componentType:5126,count:data.length/3,type:'VEC3'};
    if(position){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];data.forEach((v,i)=>{a.min[i%3]=Math.min(a.min[i%3],v);a.max[i%3]=Math.max(a.max[i%3],v);});}accessors.push(a);return accessors.length-1;};
  const meshes=objects.map(o=>({name:o.id,extras:o.extras,primitives:[{attributes:{POSITION:add(o.positions,true),NORMAL:add(o.normals),COLOR_0:add(o.colors)},material:0}]}));
  const doc={asset:{version:'2.0',generator:'PropertyChecked illustrative preview 0.8.0'},scene:0,scenes:[{nodes:objects.map((_,i)=>i)}],nodes:objects.map((o,i)=>({name:o.id,mesh:i})),meshes,materials:[{doubleSided:true,pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.75}}],buffers:[{byteLength:offset}],bufferViews,accessors,extras:{...provenance,...model.provenance}};
  const j=new TextEncoder().encode(JSON.stringify(doc)),jl=(j.length+3)&~3,total=28+jl+offset,out=new Uint8Array(total),v=new DataView(out.buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,total,true);v.setUint32(12,jl,true);v.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jl);out.set(j,20);v.setUint32(20+jl,offset,true);v.setUint32(24+jl,0x004e4942,true);let p=28+jl;for(const c of chunks){out.set(c,p);p+=c.length;}return out;
}
