import { detailVertex, detailFragment } from './materials.mjs';
import { ExteriorViewer } from '../auto-model/viewer.mjs';
import { previewMeshes } from './model.mjs';
export class PreviewViewer extends ExteriorViewer {
  constructor(host,model){
    super(host,model);
    let aspect=host.clientWidth/Math.max(1,host.clientHeight);
    this.resizeFit=new ResizeObserver(()=>{
      const next=host.clientWidth/Math.max(1,host.clientHeight);
      if(next>0&&Math.abs(next/aspect-1)>.1){aspect=next;this.fit();}
    });
    this.resizeFit.observe(host);
  }
  build(model){
    this.model=model;const b=model.extent;this.span=Math.max(10,b.maxX-b.minX,b.maxY-b.minY);
    this.objects=previewMeshes(model);this.high=-Infinity;this.low=Infinity;
    for(const o of this.objects)for(let i=1;i<o.positions.length;i+=3){this.high=Math.max(this.high,o.positions[i]);this.low=Math.min(this.low,o.positions[i]);}
    this.baseTarget=[(b.minX+b.maxX)/2,this.low+(this.high-this.low)*.42,-(b.minY+b.maxY)/2];
    const m=Math.max(8,this.span*.24),x0=b.minX-m,x1=b.maxX+m,z0=-b.maxY-m,z1=-b.minY+m,y=this.low-.08;
    this.objects.unshift({id:'ground',positions:[x0,y,z0,x0,y,z1,x1,y,z1,x0,y,z0,x1,y,z1,x1,y,z0],normals:Array(6).fill([0,1,0]).flat(),colors:Array(6).fill([.87,.89,.87]).flat(),extras:{material:8,heightBasis:'ground'}});
    this.pack();
  }
  pack(){
    const count=this.objects.reduce((n,o)=>n+o.positions.length/3,0);
    this.vertices=new Float32Array(count*9);this.surfaceData=new Float32Array(count);let at=0,si=0;
    for(const o of this.objects)for(let i=0;i<o.positions.length;i+=3){
      const col=this.highlight&&o.id!=='ground'?[.88,.61,.25]:null;
      for(let k=0;k<3;k++)this.vertices[at+k]=o.positions[i+k];
      for(let k=0;k<3;k++)this.vertices[at+3+k]=o.normals[i+k];
      for(let k=0;k<3;k++)this.vertices[at+6+k]=col?col[k]:o.colors[i+k];
      this.surfaceData[si++]=o.extras.material||0;at+=9;
    }this.count=count;
  }
  syncSurfaces(){if(this.gl&&this.surfaceBuffer){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.surfaceBuffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.surfaceData,this.gl.STATIC_DRAW);}}
  setupGraphics(){
    if(this.gl&&this.surfaceBuffer)this.gl.deleteBuffer(this.surfaceBuffer);
    this.surfaceBuffer=null;this.eyeLocation=null;
    super.setupGraphics();this.note.textContent='ESTIMATED / NOT SURVEYED';
    if(!this.gl)return;
    const gl=this.gl;let program,vs,fs;
    try{
      const shader=(type,source)=>{const x=gl.createShader(type);gl.shaderSource(x,source);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS)){gl.deleteShader(x);throw new Error('Material unavailable');}return x;};
      vs=shader(gl.VERTEX_SHADER,detailVertex);fs=shader(gl.FRAGMENT_SHADER,detailFragment(!!gl.getExtension('OES_standard_derivatives')));
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Material unavailable');
      gl.deleteProgram(this.program);this.program=program;gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      for(const [name,offset]of [['aPosition',0],['aNormal',12],['aColor',24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}
      this.surfaceBuffer=gl.createBuffer();this.syncSurfaces();const sl=gl.getAttribLocation(program,'aSurface');gl.enableVertexAttribArray(sl);gl.vertexAttribPointer(sl,1,gl.FLOAT,false,4,0);
      this.matrixLocation=gl.getUniformLocation(program,'uMatrix');this.eyeLocation=gl.getUniformLocation(program,'uEye');
    }catch{if(program&&this.program!==program)gl.deleteProgram(program);this.eyeLocation=null;}
    finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
  }
  update(model){super.update(model);this.syncSurfaces();}
  draw(){
    if(this.gl||!this.ctx){if(this.gl&&this.eyeLocation){const gl=this.gl;gl.useProgram(this.program);gl.uniform3f(this.eyeLocation,this.target[0]+this.radius*Math.sin(this.phi)*Math.sin(this.theta),this.target[1]+this.radius*Math.cos(this.phi),this.target[2]+this.radius*Math.sin(this.phi)*Math.cos(this.theta));}super.draw();return;}
    const r=this.host.getBoundingClientRect(),scale=Math.min(1,900/Math.max(r.width,r.height)),w=Math.max(2,Math.round(r.width*scale)),h=Math.max(2,Math.round(r.height*scale));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    const image=this.ctx.createImageData(w,h),pixels=image.data,depth=new Float32Array(w*h);
    for(let i=0;i<pixels.length;i+=4){pixels[i]=240;pixels[i+1]=243;pixels[i+2]=240;pixels[i+3]=255;}
    const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
    const eye=[this.target[0]+this.radius*Math.sin(this.phi)*Math.sin(this.theta),this.target[1]+this.radius*Math.cos(this.phi),this.target[2]+this.radius*Math.sin(this.phi)*Math.cos(this.theta)];
    const forward=norm(sub(this.target,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),f=Math.tan(Math.PI/8),light=norm([-.5,.9,.7]);
    const project=p=>{const d=sub(p,eye),z=dot(d,forward);return [(1+dot(d,right)/(z*f*w/h))*w/2,(1-dot(d,up)/(z*f))*h/2,z];};
    for(let i=0;i<this.vertices.length;i+=27){
      const [a,b,c]=[0,9,18].map(k=>project(Array.from(this.vertices.slice(i+k,i+k+3))));if([a,b,c].some(p=>p[2]<=.15))continue;
      const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<.001)continue;
      const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
      const n=Array.from(this.vertices.slice(i+3,i+6)),shade=.54+.38*Math.max(dot(n,light),0)+.12*Math.max(n[1],0),rgb=Array.from(this.vertices.slice(i+6,i+9)).map(v=>Math.round(Math.min(1,v*shade)*255));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const wa=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,wb=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,wc=1-wa-wb;
        if(wa<0||wb<0||wc<0)continue;const iz=wa/a[2]+wb/b[2]+wc/c[2],at=y*w+x;if(iz<=depth[at])continue;depth[at]=iz;pixels[at*4]=rgb[0];pixels[at*4+1]=rgb[1];pixels[at*4+2]=rgb[2];
      }
    }
    this.ctx.putImageData(image,0,0);
  }
  fit(){
    const rect=this.host.getBoundingClientRect(),aspect=Math.max(.25,rect.width/Math.max(1,rect.height)),tanV=Math.tan(Math.PI/8),tanH=tanV*aspect;
    const b=this.model.extent,theta=this.theta??.65,phi=this.phi??.99,dir=[Math.sin(phi)*Math.sin(theta),Math.cos(phi),Math.sin(phi)*Math.cos(theta)];
    const right=[Math.cos(theta),0,-Math.sin(theta)],up=[-Math.cos(phi)*Math.sin(theta),Math.sin(phi),-Math.cos(phi)*Math.cos(theta)],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
    this.target=[...this.baseTarget];let distance=0;
    for(const x of [b.minX,b.maxX])for(const y of [this.low||0,this.high])for(const z of [-b.maxY,-b.minY]){
      const p=[x-this.target[0],y-this.target[1],z-this.target[2]],near=dot(p,dir);
      distance=Math.max(distance,Math.abs(dot(p,right))/tanH+near,Math.abs(dot(p,up))/tanV+near);
    }
    this.radius=Math.max(12,distance*1.14);this.invalidate();
  }
  reset(){super.reset();this.fit();}
  dispose(){this.resizeFit?.disconnect();if(this.gl&&this.surfaceBuffer)this.gl.deleteBuffer(this.surfaceBuffer);super.dispose();}
}
