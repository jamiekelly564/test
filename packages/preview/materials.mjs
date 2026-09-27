// Procedural display finishes, not photographs copied onto a building.
export const detailVertex = `
attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; attribute float aSurface;
uniform mat4 uMatrix;
varying vec3 vColor; varying vec3 vNormal; varying vec3 vPosition; varying float vSurface;
void main(){vColor=aColor;vNormal=aNormal;vPosition=aPosition;vSurface=aSurface;gl_Position=uMatrix*vec4(aPosition,1.0);}`;
export function detailFragment(derivatives){return `${derivatives?'#extension GL_OES_standard_derivatives : enable':''}
precision mediump float;
varying vec3 vColor; varying vec3 vNormal; varying vec3 vPosition; varying float vSurface;
uniform vec3 uEye;
float edge(float x,float width){${derivatives?'float aa=max(0.012,fwidth(x));':'float aa=0.045;'}return smoothstep(width-aa,width+aa,x)*(1.0-smoothstep(1.0-width-aa,1.0-width+aa,x));}
void main(){
 vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
 vec3 sun=normalize(vec3(-.5,.9,.7)),view=normalize(uEye-vPosition);
 vec3 col=vColor;
 vec2 axis=normalize(vec2(n.z+0.00001,-n.x));
 float u=dot(vPosition.xz,axis),v=vPosition.y;
 if(vSurface>.5&&vSurface<1.5&&abs(n.y)<.3){
   float course=floor(v/.082),x=fract(u/.255+mod(course,2.0)*.5),y=fract(v/.082);
   float mortar=edge(x,.028)*edge(y,.055);
   float noise=fract(sin(floor(u/.255)*12.13+course*5.74)*415.54);
   col=mix(mix(col,vec3(.67,.65,.59),.34),col*(.94+.1*noise),mortar);
 }else if(vSurface>1.5&&vSurface<3.5&&abs(n.y)<.3){
   float t=vSurface<2.5?v/.2:u/.22;
   col*=.84+.16*edge(fract(t),.035);
 }else if(vSurface>6.5&&vSurface<7.5){
   float t=vPosition.x*.8+vPosition.z*.2;
   col*=.92+.06*sin(t*8.0)+.02*sin(t*37.0);
 }
 float diffuse=max(dot(n,sun),0.0),light=.67+.30*diffuse+.08*max(n.y,0.0);
 col*=light;
 if(vSurface>3.5&&vSurface<5.5){
   float spec=pow(max(dot(reflect(-sun,n),view),0.0),vSurface<4.5?40.0:22.0);
   float fresnel=pow(1.0-max(dot(n,view),0.0),3.0);
   col+=vec3(.30,.35,.37)*spec+vec3(.13,.17,.19)*fresnel;
 }
 gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}`;}
