import { ExteriorViewer } from '../auto-model/viewer.mjs';
const shades={slab:[.76,.78,.75],wall:[.84,.86,.82],door:[.55,.36,.22],window:[.38,.64,.69],stair:[.59,.64,.63],lift:[.53,.59,.62],balcony:[.69,.73,.70],roof:[.40,.46,.45]};
const finish={brick:[.64,.39,.28],render:[.87,.84,.76],concrete:[.65,.67,.64],glass:[.36,.65,.71],timber:[.61,.42,.27],metal:[.55,.63,.65]};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>a.map(v=>v/(Math.hypot(...a)||1));
function hit(ray,dir,a,b,c){const edge1=sub(b,a),edge2=sub(c,a),p=cross(dir,edge2),det=dot(edge1,p);if(Math.abs(det)<1e-9)return null;const t=sub(ray,a),u=dot(t,p)/det;if(u<0||u>1)return null;const q=cross(t,edge1),v=dot(dir,q)/det;if(v<0||u+v>1)return null;const distance=dot(edge2,q)/det;return distance>0?distance:null;}
export class EvidenceViewer extends ExteriorViewer{
  build(model){this.catalog=new Map(model.volumes.map(v=>[v.id,v.evidence]));super.build(model);const low=Math.min(...model.volumes.map(v=>v.minHeightM)),high=Math.max(...model.volumes.map(v=>v.heightM));this.baseTarget[1]=(low+high)/2;this.high=high-low;const ground=this.objects[0];for(let i=1;i<ground.positions.length;i+=3)ground.positions[i]=low-.08;this.pack();}
  pack(){
    const flat=[];
    for(const o of this.objects){const c=this.catalog?.get(o.id);let tint=c?(finish[c.finish]||shades[c.kind]):null;if(this.highlight&&c&&(c.basis==='estimated'||c.verticalBasis==='estimated'))tint=[.92,.62,.22];if(this.selected===o.id)tint=[.08,.63,.52];
      for(let i=0;i<o.positions.length;i+=3)flat.push(...o.positions.slice(i,i+3),...o.normals.slice(i,i+3),...(tint||o.colors.slice(i,i+3)));
    }this.vertices=new Float32Array(flat);this.count=flat.length/9;
  }
  select(id){this.selected=id;this.estimates(this.highlight);}
  bind(){super.bind();let down;
    this.canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];},{signal:this.abort.signal});
    this.canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
      const r=this.canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*2-1,y=1-(e.clientY-r.top)/r.height*2;
      const eye=[this.target[0]+this.radius*Math.sin(this.phi)*Math.sin(this.theta),this.target[1]+this.radius*Math.cos(this.phi),this.target[2]+this.radius*Math.sin(this.phi)*Math.cos(this.theta)];
      const forward=norm(sub(this.target,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),f=Math.tan(Math.PI/8);
      const dir=norm(forward.map((v,i)=>v+right[i]*x*f*r.width/r.height+up[i]*y*f));let nearest=Infinity,id=null;
      for(const o of this.objects){if(o.id==='ground')continue;for(let i=0;i<o.positions.length;i+=9){const distance=hit(eye,dir,o.positions.slice(i,i+3),o.positions.slice(i+3,i+6),o.positions.slice(i+6,i+9));if(distance!==null&&distance<nearest){nearest=distance;id=o.id;}}}
      if(id){this.select(id);this.onSelect?.(id);}down=null;
    },{signal:this.abort.signal});
  }
}
