import { meshModel } from './geometry.mjs';
const V={sub:(a,b)=>a.map((v,i)=>v-b[i]),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);}};
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function perspective(aspect,near=.15,far=5000){const f=1/Math.tan(Math.PI/8),n=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*n,-1,0,0,2*far*near*n,0]);}
function lookAt(eye,target){const z=V.norm(V.sub(eye,target)),x=V.norm(V.cross([0,1,0],z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);}
const transform=(m,p)=>[0,1,2,3].map(r=>p.reduce((s,v,c)=>s+v*m[c*4+r],m[12+r]));
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;
uniform mat4 uMatrix;varying vec3 vColor;varying vec3 vNormal;
void main(){vColor=aColor;vNormal=aNormal;gl_Position=uMatrix*vec4(aPosition,1.0);}`;
const fragment=`precision mediump float;varying vec3 vColor;varying vec3 vNormal;
void main(){vec3 n=normalize(vNormal);float light=.54+.38*max(dot(n,normalize(vec3(-.5,.9,.7))),0.0)+.12*max(n.y,0.0);gl_FragColor=vec4(vColor*light,1.0);}`;
/** Small real-geometry viewer. Local modules only; no CDN, image or map requests.
 * WebGL 1 with a software triangle-rendering fallback; no continuously running animation loop.
 */
export class ExteriorViewer {
  constructor(host,model){
    this.host=host;this.model=model;this.abort=new AbortController();this.pointers=new Map();this.highlight=false;this.disposed=false;this.raf=0;
    host.innerHTML='<canvas class="exterior-canvas" role="img" aria-label="Rotatable estimated exterior model" tabindex="0"></canvas><div class="exterior-engine" aria-live="polite"></div><div class="exterior-hint">Drag to rotate &middot; Pinch to zoom &middot; Two fingers to move</div>';
    this.canvas=host.querySelector('canvas');this.note=host.querySelector('.exterior-engine');this.build(model);this.setupGraphics();this.bind();this.reset();
    this.observer=new ResizeObserver(()=>this.invalidate());this.observer.observe(host);this.invalidate();
  }
  build(model){
    this.model=model;const b=model.extent;this.span=Math.max(10,b.maxX-b.minX,b.maxY-b.minY);this.high=Math.max(...model.volumes.map(v=>v.heightM));
    this.baseTarget=[(b.minX+b.maxX)/2,this.high*.38,-(b.minY+b.maxY)/2];this.objects=meshModel(model);
    const margin=Math.max(8,this.span*.24),x0=b.minX-margin,x1=b.maxX+margin,z0=-b.maxY-margin,z1=-b.minY+margin,y=-.08;
    const ground={id:'ground',positions:[x0,y,z0,x0,y,z1,x1,y,z1,x0,y,z0,x1,y,z1,x1,y,z0],normals:Array(6).fill([0,1,0]).flat(),colors:Array(6).fill([.87,.89,.87]).flat(),extras:{heightBasis:'ground'}};
    this.objects.unshift(ground);this.pack();
  }
  pack(){
    const flat=[];
    for(const o of this.objects){const estimated=!['public-data','ground'].includes(o.extras.heightBasis);for(let i=0;i<o.positions.length;i+=3){flat.push(...o.positions.slice(i,i+3),...o.normals.slice(i,i+3),...(this.highlight&&estimated?[.88,.61,.25]:o.colors.slice(i,i+3)));}}
    this.vertices=new Float32Array(flat);this.count=flat.length/9;
  }
  setupGraphics(){
    try{
      const gl=this.canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});if(!gl)throw new Error('WebGL unavailable');this.gl=gl;
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader compile failed');return s;};
      this.program=gl.createProgram();const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error('Shader link failed');
      gl.useProgram(this.program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.STATIC_DRAW);
      for(const [name,offset]of [['aPosition',0],['aNormal',12],['aColor',24]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}
      this.matrixLocation=gl.getUniformLocation(this.program,'uMatrix');gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.94,.95,.94,1);this.note.textContent='3D exterior / not surveyed';
    }catch{
      if(this.gl){this.gl=null;const next=this.canvas.cloneNode();this.canvas.replaceWith(next);this.canvas=next;}
      this.ctx=this.canvas.getContext('2d');this.note.textContent='Compatibility 3D / not surveyed';
      if(!this.ctx)this.note.textContent='Graphics unavailable. Download the GLB model or try another browser.';
    }
  }
  bind(){
    const listen=(type,fn,extra={})=>this.canvas.addEventListener(type,fn,{signal:this.abort.signal,...extra});
    listen('pointerdown',event=>{this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,[event.clientX,event.clientY]);this.lastGesture=this.gesture();});
    listen('pointermove',event=>{
      if(!this.pointers.has(event.pointerId))return;const old=this.lastGesture;this.pointers.set(event.pointerId,[event.clientX,event.clientY]);const g=this.gesture();
      if(old&&old.count===g.count){const dx=g.x-old.x,dy=g.y-old.y;
        if(g.count===1&&!event.shiftKey&&event.buttons!==2){this.theta-=dx*.006;this.phi=Math.min(1.49,Math.max(.025,this.phi+dy*.006));}
        else {const scale=this.radius*.0017;this.target[0]-=dx*Math.cos(this.theta)*scale;this.target[2]+=dx*Math.sin(this.theta)*scale;this.target[1]+=dy*scale;if(g.distance&&old.distance)this.radius=Math.min(2200,Math.max(3,this.radius*old.distance/g.distance));}
      }this.lastGesture=g;this.invalidate();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(type,event=>{this.pointers.delete(event.pointerId);this.lastGesture=this.gesture();});
    listen('wheel',event=>{event.preventDefault();this.radius=Math.max(3,Math.min(2200,this.radius*Math.exp(Math.max(-120,Math.min(120,event.deltaY))*.0018)));this.invalidate();},{passive:false});
    listen('contextmenu',event=>event.preventDefault());
    listen('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')this.reset();if(event.key==='ArrowLeft')this.theta-=.1;if(event.key==='ArrowRight')this.theta+=.1;if(event.key==='ArrowUp')this.phi=Math.max(.025,this.phi-.1);if(event.key==='ArrowDown')this.phi=Math.min(1.49,this.phi+.1);if(event.key==='+')this.zoom(.88);if(event.key==='-')this.zoom(1.12);this.invalidate();}});
    listen('webglcontextlost',event=>{event.preventDefault();this.note.textContent='Graphics paused. Tap Reset or reload this view.';});
    listen('webglcontextrestored',()=>{this.setupGraphics();this.invalidate();});
  }
  gesture(){const p=[...this.pointers.values()];return {count:p.length,x:p.reduce((s,a)=>s+a[0],0)/(p.length||1),y:p.reduce((s,a)=>s+a[1],0)/(p.length||1),distance:p.length===2?Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]):0};}
  reset(){this.theta=.65;this.phi=.99;this.radius=Math.max(22,this.span*1.8+this.high);this.target=[...this.baseTarget];this.invalidate();}
  top(){this.phi=.025;this.theta=0;this.target=[...this.baseTarget];this.invalidate();}
  zoom(factor){this.radius=Math.min(2200,Math.max(3,this.radius*factor));this.invalidate();}
  estimates(on){this.highlight=on;this.pack();if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.vertices,this.gl.STATIC_DRAW);}this.invalidate();}
  update(model){this.build(model);if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.vertices,this.gl.STATIC_DRAW);}this.invalidate();}
  invalidate(){if(this.disposed||this.raf)return;this.raf=requestAnimationFrame(()=>{this.raf=0;if(!this.disposed)this.draw();});}
  draw(){
    const r=this.host.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),width=Math.max(2,Math.round(r.width*ratio)),height=Math.max(2,Math.round(r.height*ratio));
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const eye=[this.target[0]+this.radius*Math.sin(this.phi)*Math.sin(this.theta),this.target[1]+this.radius*Math.cos(this.phi),this.target[2]+this.radius*Math.sin(this.phi)*Math.cos(this.theta)];
    const vp=multiply(perspective(width/height),lookAt(eye,this.target));
    if(this.gl){const gl=this.gl;if(gl.isContextLost())return;gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.matrixLocation,false,vp);gl.drawArrays(gl.TRIANGLES,0,this.count);}
    else if(this.ctx){
      // Draw the ground before sorted building faces; its huge triangles must not
      // cover near walls when their average depth crosses the building. Cull
      // back faces to keep bottom caps out of the software painter's pass.
      const ctx=this.ctx;ctx.fillStyle='#f0f3f0';ctx.fillRect(0,0,width,height);const tris=[],ground=[];const light=V.norm([-.5,.9,.7]);
      for(let i=0;i<this.vertices.length;i+=27){const normal=Array.from(this.vertices.slice(i+3,i+6));const centre=[0,1,2].map(k=>(this.vertices[i+k]+this.vertices[i+9+k]+this.vertices[i+18+k])/3);if(V.dot(normal,V.sub(eye,centre))<=0)continue;const vs=[0,9,18].map(k=>transform(vp,Array.from(this.vertices.slice(i+k,i+k+3))));if(vs.some(p=>p[3]<=0))continue;
        const p=vs.map(p=>[(p[0]/p[3]+1)*width/2,(1-p[1]/p[3])*height/2]);const n=Array.from(this.vertices.slice(i+3,i+6)),shade=.54+.38*Math.max(V.dot(n,light),0)+.12*Math.max(n[1],0);
        const color=Array.from(this.vertices.slice(i+6,i+9)).map(c=>Math.round(Math.min(1,c*shade)*255));(i<54?ground:tris).push({p,z:vs.reduce((s,v)=>s+v[2]/v[3],0),color});}
      tris.sort((a,b)=>b.z-a.z);for(const t of [...ground,...tris]){ctx.beginPath();t.p.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=`rgb(${t.color.join(',')})`;ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.35;ctx.stroke();}
    }
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.abort.abort();this.observer?.disconnect();if(this.gl){this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}}
}
