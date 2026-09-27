import { ExteriorViewer } from '../auto-model/viewer.mjs';
import { previewMeshes } from './model.mjs';
export class PreviewViewer extends ExteriorViewer {
  build(model){
    super.build(model);const ground=this.objects[0];this.objects=[ground,...previewMeshes(model)];this.pack();
    this.high=0;for(const o of this.objects)for(let i=1;i<o.positions.length;i+=3)this.high=Math.max(this.high,o.positions[i]);
    this.baseTarget[1]=this.high*.42;
  }
  setupGraphics(){super.setupGraphics();this.note.textContent='ESTIMATED / NOT SURVEYED';}
  draw(){
    if(this.gl||!this.ctx){super.draw();return;}
    // Depth-buffered software fallback: large wall triangles must not paint
    // over the smaller windows merely because their average depths cross.
    const r=this.host.getBoundingClientRect(),w=Math.max(2,Math.round(r.width)),h=Math.max(2,Math.round(r.height));
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
  reset(){super.reset();this.radius=Math.max(20,this.span*1.4+this.high*.65);this.invalidate();}
}
