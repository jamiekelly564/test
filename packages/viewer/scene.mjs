import { prepareDisplayGroups, compileSurfaces, createSurfacePicker, modelGroupVisible, exteriorKinds, appearanceSettings, viewStamp } from './surfaces.mjs';
const scenes=new WeakMap();
const sub=(a,b)=>a.map((x,i)=>x-b[i]),norm=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const mul=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
function cameraMatrices(v){const c=v.current,z=norm(sub(v.eye,c.target)),x=norm(cross([0,1,0],z)),y=cross(z,x),a=v.width/v.height;v.view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,v.eye),-dot(y,v.eye),-dot(z,v.eye),1]);v.fov=2*Math.atan(Math.tan(Math.PI/7)*Math.max(1,1.3/a));const f=1/Math.tan(v.fov/2),n=.15,far=300;v.vp=mul(new Float32Array([f/a,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]),v.view);}
export function uploadGroup(v,g){
 const gl=v.gl;if(gl){g.vao=gl.createVertexArray();gl.bindVertexArray(g.vao);g.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.bufferData(gl.ARRAY_BUFFER,g.vertices,gl.STATIC_DRAW);for(const [i,s,o] of [[0,3,0],[1,3,12],[2,3,24],[3,1,36]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,s,gl.FLOAT,false,40,o);}return {g,arr:[]};}
 const arr=[],d=g.vertices;for(let i=0;i<d.length;i+=30){const n=[d[i+3],d[i+4],d[i+5]],light=.51+.13*n[1]+.56*Math.max(0,n[0]*-.456+n[1]*.776+n[2]*.383);arr.push({a:[d[i],d[i+1],d[i+2]],b:[d[i+10],d[i+11],d[i+12]],c:[d[i+20],d[i+21],d[i+22]],n,color:[d[i+6],d[i+7],d[i+8]].map(x=>Math.round(Math.max(0,Math.min(255,x*light*255))))});}return {g,arr};
}
function transparencyProgram(v){
 const gl=v.gl,shaders=gl.getAttachedShaders(v.program),program=gl.createProgram();
 try{for(const original of shaders){const type=gl.getShaderParameter(original,gl.SHADER_TYPE),s=gl.createShader(type);let text=gl.getShaderSource(original);
   if(type===gl.FRAGMENT_SHADER){if(!text.includes('outColor=vec4(result,1.);'))throw Error('Unrecognised legacy shader');text=text.replace('out vec4 outColor;','out vec4 outColor;uniform float uOpacity;').replace('outColor=vec4(result,1.);','outColor=vec4(result,uOpacity);');}
   gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Transparency shader compilation failed');}gl.attachShader(program,s);gl.deleteShader(s);
  }gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Transparency shader link failed');
 }catch(e){gl.deleteProgram(program);throw e;}
 const uniforms={};for(const k of ['uVP','uLightVP','uOffset','uEye','uShadow','uNight','uGhost','uCap','uOpacity'])uniforms[k]=gl.getUniformLocation(program,k);return {program,uniforms};
}
/** A single display owner. Original PLAN, exports and source buffers are never rewritten. */
export function getScene(pc){
 if(scenes.has(pc))return scenes.get(pc);
 const v=pc.viewer,original={groups:v.groups,tris:v.tris,frame:v.frame,visible:v.visible},prepared=prepareDisplayGroups(pc.PLAN,v.groups),shader=v.gl?transparencyProgram(v):null;
 const scene={groups:prepared.groups,compiled:compileSurfaces(pc.PLAN),audit:prepared.audit,regions:prepared.regions,settings:{exterior:'solid',opacity:.18,residences:true},stats:{draws:0,picks:0,geometryBuilds:1},revision:0,key:'',inMotion:false,hoverOwner:null};
 const uploaded=scene.groups.map(g=>uploadGroup(v,g));v.groups=scene.groups;if(v.tris)v.tris=uploaded;let lastKey='',disposed=false;
 scene.invalidate=()=>{v.redraw=true;v.shadowDirty=true;scene.revision++;};
 scene.alpha=g=>exteriorKinds.has(g.kind)&&scene.settings.exterior==='ghost'?scene.settings.opacity:1;
 v.visible=g=>modelGroupVisible(g,pc.state,scene.settings);
 scene.pickOptions=()=>({visible:g=>v.visible(g)&&scene.alpha(g)>=.95,offset:g=>v.offset(g),cap:()=>Infinity});
 scene.picker=createSurfacePicker(scene.groups);
 const assets=new Map(pc.PLAN.assets.map(a=>[a.id,a]));
 scene.isLocationVisible=id=>{const a=assets.get(id);return scene.settings.residences||!a||a.type!=='space'||!scene.regions.contains(a.floor,a.pos);};
 scene.set=value=>{const next=appearanceSettings(scene.settings,value);if(JSON.stringify(next)===JSON.stringify(scene.settings))return false;scene.settings=next;scene.invalidate();return true;};
 function drawGL(){
  const gl=v.gl,state=pc.state,visible=v.groups.filter(g=>v.visible(g)),opaque=visible.filter(g=>scene.alpha(g)===1),ghost=visible.filter(g=>scene.alpha(g)<1);
  function group(g,u,shadow=false){if(!shadow){gl.uniform1f(u.uGhost,state.basis&&g.basis==='estimated'?1:0);gl.uniform1f(u.uOpacity,scene.alpha(g));}gl.uniform1f(u.uOffset,v.offset(g));gl.uniform1f(u.uCap,0);
   if(g.kind==='finish'){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);}else gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindVertexArray(g.vao);gl.drawArrays(gl.TRIANGLES,0,g.count);
  }
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
  if(v.shadowDirty){const u=v.uniforms.shadow;gl.bindFramebuffer(gl.FRAMEBUFFER,v.shadowFB);gl.viewport(0,0,1536,1536);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(v.shadowProgram);gl.uniformMatrix4fv(u.uVP,false,v.lightVP);gl.uniformMatrix4fv(u.uLightVP,false,v.lightVP);for(const g of opaque)group(g,u,true);gl.bindFramebuffer(gl.FRAMEBUFFER,null);v.shadowDirty=false;}
  gl.viewport(0,0,v.canvas.width,v.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const u=shader.uniforms;gl.useProgram(shader.program);gl.uniformMatrix4fv(u.uVP,false,v.vp);gl.uniformMatrix4fv(u.uLightVP,false,v.lightVP);gl.uniform3fv(u.uEye,v.eye);gl.uniform1f(u.uNight,v.night);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,v.shadowTex);gl.uniform1i(u.uShadow,0);
  for(const g of opaque)group(g,u);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  const depth=g=>Math.abs((pc.PLAN.floors.find(f=>f.id===g.floor)?.y||0)+v.offset(g)-v.eye[1]);ghost.sort((a,b)=>depth(b)-depth(a));for(const g of ghost)group(g,u);
  gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.POLYGON_OFFSET_FILL);v.drawPlan?.();
 }
 function frame(time){
  if(!v.running||disposed)return;const dt=Math.min((time-v.lastTime)/1000,.05)||.016;v.lastTime=time;if(v.auto)v.camera.theta+=dt*.13;const t=1-Math.exp(-dt*10),c=v.current;
  let moving=false;const approach=(from,to)=>{const d=to-from;if(Math.abs(d)<.0001)return to;moving=true;return from+d*t;};for(const k of ['theta','phi','radius'])c[k]=approach(c[k],v.camera[k]);for(let i=0;i<3;i++)c.target[i]=approach(c.target[i],v.camera.target[i]);
  const old=v.explode;v.explode=approach(v.explode,pc.state.exploded&&pc.state.floor==='all'?1:0);if(v.explode!==old)v.shadowDirty=true;scene.inMotion=moving||v.interacting;
  v.eye=[c.target[0]+c.radius*Math.sin(c.phi)*Math.sin(c.theta),c.target[1]+c.radius*Math.cos(c.phi),c.target[2]+c.radius*Math.sin(c.phi)*Math.cos(c.theta)];cameraMatrices(v);
  const key=viewStamp(v,pc.state)+'|'+scene.revision+'|'+pc.state.furniture+'|'+v.night+'|'+scene.inMotion;scene.key=key;
  if(!document.hidden&&(key!==lastKey||v.redraw||v.shadowDirty||pc.state.plan)){if(v.gl)drawGL();else drawSoftware(v,pc,scene);lastKey=key;v.redraw=false;v.shadowDirty=false;scene.stats.draws++;}
  v.onFrame?.(time);requestAnimationFrame(frame);
 }
 v.frame=frame;scene.invalidate();scenes.set(pc,scene);
 const abort=new AbortController();
 addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='propertychecked-app'||e.data.command!=='modelAppearance')return;scene.set(e.data.value);parent.postMessage({source:'propertychecked-viewer',type:'appearance-state',settings:{...scene.settings}},location.origin);},{signal:abort.signal});
 addEventListener('pagehide',()=>{disposed=true;abort.abort();v.frame=original.frame;v.visible=original.visible;v.groups=original.groups;if(original.tris)v.tris=original.tris;for(const g of scene.groups)if(v.gl){v.gl.deleteBuffer(g.buffer);v.gl.deleteVertexArray(g.vao);}if(shader)v.gl.deleteProgram(shader.program);scenes.delete(pc);},{once:true});
 parent.postMessage({source:'propertychecked-viewer',type:'model-audit',audit:scene.audit,settings:{...scene.settings},missing:pc.PLAN.meta?.missing||[]},location.origin);
 return scene;
}

/** CPU fallback retains true heights and the same per-system alpha/depth policy. */
function drawSoftware(v,pc,scene){
 const scale=scene.inMotion?.65:Math.min(1.15,1500/v.width),W=Math.max(2,Math.round(v.width*scale)),H=Math.max(2,Math.round(v.height*scale)),m=v.vp;
 if(!v.rasterCanvas){v.rasterCanvas=document.createElement('canvas');v.rasterCtx=v.rasterCanvas.getContext('2d');}
 if(v.rasterCanvas.width!==W||v.rasterCanvas.height!==H){v.rasterCanvas.width=W;v.rasterCanvas.height=H;v.rasterImage=v.rasterCtx.createImageData(W,H);v.zbuffer=new Float32Array(W*H);}
 const pixels=v.rasterImage.data,zbuf=v.zbuffer;pixels.fill(0);zbuf.fill(Infinity);
 const project=([x,y,z])=>{const w=m[3]*x+m[7]*y+m[11]*z+m[15];return w<=.1?null:[(m[0]*x+m[4]*y+m[8]*z+m[12])/w*W/2+W/2,-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*H/2+H/2,(m[2]*x+m[6]*y+m[10]*z+m[14])/w,1/w];};
 function triangle(a,b,c,color,alpha=1,bias=0,texture=null,uv=null){
  if(!a||!b||!c)return;const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1]))),d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<.06)return;
  const ia=(b[1]-c[1])/d,ib=(c[0]-b[0])/d,ic=(c[1]-a[1])/d,id=(a[0]-c[0])/d;
  for(let y=y0;y<=y1;y++){let l0=ia*(x0+.5-c[0])+ib*(y+.5-c[1]),l1=ic*(x0+.5-c[0])+id*(y+.5-c[1]),index=y*W+x0;
   for(let x=x0;x<=x1;x++,index++,l0+=ia,l1+=ic){const l2=1-l0-l1;if(l0<-.00002||l1<-.00002||l2<-.00002)continue;const z=l0*a[2]+l1*b[2]+l2*c[2]-bias;if(z>=zbuf[index])continue;if(alpha===1)zbuf[index]=z;
    let col=color;if(texture){const inv=l0*a[3]+l1*b[3]+l2*c[3],u=(l0*uv[0][0]*a[3]+l1*uv[1][0]*b[3]+l2*uv[2][0]*c[3])/inv,vv=(l0*uv[0][1]*a[3]+l1*uv[1][1]*b[3]+l2*uv[2][1]*c[3])/inv,tx=Math.max(0,Math.min(texture.w-1,Math.floor(u*texture.w))),ty=Math.max(0,Math.min(texture.h-1,Math.floor(vv*texture.h))),ti=(ty*texture.w+tx)*4;col=[texture.data[ti],texture.data[ti+1],texture.data[ti+2]];}
    const i=index*4,old=pixels[i+3]/255,out=alpha+old*(1-alpha);for(let k=0;k<3;k++)pixels[i+k]=(col[k]*alpha+pixels[i+k]*old*(1-alpha))/out;pixels[i+3]=out*255;
   }
  }
 }
 const visible=(v.tris||[]).filter(({g})=>v.visible(g));visible.sort((a,b)=>scene.alpha(b.g)-scene.alpha(a.g));
 for(const {g,arr} of visible){const off=v.offset(g),alpha=scene.alpha(g);for(const tr of arr){const a=[tr.a[0],tr.a[1]+off,tr.a[2]],b=[tr.b[0],tr.b[1]+off,tr.b[2]],c=[tr.c[0],tr.c[1]+off,tr.c[2]];if(dot(tr.n,sub(v.eye,a))<-.001)continue;triangle(project(a),project(b),project(c),pc.state.basis&&g.basis==='estimated'?tr.color.map((x,i)=>x*.25+[212,152,68][i]*.75):tr.color,alpha,g.kind==='finish'?1e-6:0);}}
 if(pc.state.plan&&pc.state.floor!=='all'){
  const key=pc.state.floor,p=pc.PLAN.plans[key];v.planImages||={};let img=v.planImages[key];
  if(p&&!img){img=new Image();v.planImages[key]=img;img.onload=()=>{const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);try{img.pixels={w:img.width,h:img.height,data:ctx.getImageData(0,0,img.width,img.height).data};}catch{}scene.invalidate();};img.src=p.image;}
  if(img?.pixels){const [[x0,z0],[x1,z1]]=p.bounds,a=project([x0,.039,z0]),b=project([x1,.039,z0]),c=project([x1,.039,z1]),d=project([x0,.039,z1]);triangle(a,b,c,null,1,0,img.pixels,[[0,0],[1,0],[1,1]]);triangle(a,c,d,null,1,0,img.pixels,[[0,0],[1,1],[0,1]]);}
 }
 v.rasterCtx.putImageData(v.rasterImage,0,0);v.ctx.clearRect(0,0,v.width,v.height);v.ctx.drawImage(v.rasterCanvas,0,0,v.width,v.height);
}
