import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import { displayPoint } from '../packages/viewer/surfaces.mjs';
import {equipmentTypes,issueStage,issueStages,recordStage,issueCounts,issueGlyph,issueIconSVG,primaryIssue,cameraFromEye,aerialCamera,eyeLevelCandidates} from '../packages/equipment-demo/model.mjs';
const issue=(id,status='open',assetId='equipment-1')=>({id,kind:'issue',status,assetId,locationId:'area-1',title:'Example device fault',category:'fire'});
for(const [status,stage] of [['open','found'],['in_progress','progress'],['awaiting_review','progress'],['resolved','working']])test(`issue stage ${status} -> ${stage}`,()=>assert.equal(issueStage(issue('x',status)).key,stage));
test('uninspected, missing, cancelled and prototype-looking statuses are never green',()=>{
 for(const r of [null,{},issue('x','cancelled'),issue('x','unknown'),issue('x','toString'),issue('x','__proto__'),{kind:'equipment',status:'in_service'},{kind:'check',status:'illustrated_complete'}])assert.equal(issueStage(r).key,'unknown');
});
test('equipment with no recorded condition stays neutral',()=>assert.equal(recordStage({id:'a',kind:'equipment'},[]).key,'unknown'));
test('red wins over yellow and green on one device; another device cannot make it green',()=>{
 const a={kind:'equipment',id:'equipment-1'};
 const rows=[issue('green','resolved'),issue('yellow','in_progress'),issue('red','open'),issue('foreign','resolved','other')];
 assert.equal(recordStage(a,rows).key,'found');assert.equal(recordStage(a,rows.slice(0,2)).key,'progress');assert.equal(recordStage(a,[rows[0]]).key,'working');assert.equal(recordStage(a,[rows[3]]).key,'unknown');
});
test('area summaries include its linked issues but not unrelated areas',()=>{
 assert.equal(recordStage({kind:'area',id:'a',locationId:'area-1'},[issue('x')]).key,'found');
 assert.equal(recordStage({kind:'area',id:'a',locationId:'other'},[issue('x')]).key,'unknown');
});
test('counts and primary markers preserve input and include explicit working outcomes',()=>{
 const rows=[issue('b','resolved'),issue('c','in_progress'),issue('a','open')],before=JSON.stringify(rows);
 assert.deepEqual(issueCounts(rows),{found:1,progress:1,working:1});assert.equal(primaryIssue(rows).id,'a');assert.equal(JSON.stringify(rows),before);
});
for(const [title,key] of [['Pump leak reported','water'],['Panel battery fault','battery'],['Missed cleaning visit','clean'],['Floor finish damage','floor'],['Decoration work','paint'],['Missed collection','bin']])test(`problem icon: ${title}`,()=>assert.equal(issueGlyph({...issue('x'),title}),key));
test('all thirty equipment styles have safe local icons',()=>{
 const svgs=equipmentTypes.map(t=>issueIconSVG(issueGlyph({style:t.id,kind:'equipment'})));
 for(const svg of svgs){assert.match(svg,/<svg/);assert.match(svg,/<path d=/);assert.doesNotMatch(svg,/https?:|script|onload|image|foreignObject/);}
 assert.ok(new Set(svgs).size>=15);
});
test('untrusted icon requests cannot insert text, HTML or an external URL',()=>{
 for(const key of ['<img src=x onerror=alert(1)>','https://example.test/a.svg','__proto__','toString'])assert.equal(issueIconSVG(key),issueIconSVG('tool'));
});
test('eye and orbit conversions place the camera at the requested eye level',()=>{
 const eye=[2,1.6,3],target=[0,.5,0],c=cameraFromEye(eye,target),recreated=[c.target[0]+c.radius*Math.sin(c.phi)*Math.sin(c.theta),c.target[1]+c.radius*Math.cos(c.phi),c.target[2]+c.radius*Math.sin(c.phi)*Math.cos(c.theta)];
 recreated.forEach((v,i)=>assert.ok(Math.abs(v-eye[i])<1e-9));
});
test('aerial framing is finite on phone/desktop and isolates the zero-based floor plane',()=>{
 for(const [w,h] of [[320,800],[1500,900],[768,1024]]){const c=aerialCamera([3,.7,4],[[-10,-8],[10,8]],w,h);assert.ok(c.phi<.1&&c.radius>=12);assert.equal(c.target[1],0);assert.ok([c.theta,c.phi,c.radius,...c.target].every(Number.isFinite));}
});
test('eye candidates are at eye level and do not mutate a device anchor',()=>{
 const a=[2,2.4,5],before=[...a],candidates=eyeLevelCandidates(a,.8);assert.equal(candidates.length,24);for(const c of candidates)assert.equal(c.eye[1],1.6);assert.deepEqual(a,before);
});
test('invalid camera coordinates and excessive distances fail explicitly',()=>{
 for(const p of [[NaN,0,0],[1,2],null]){assert.throws(()=>aerialCamera(p));assert.throws(()=>eyeLevelCandidates(p));}
 assert.throws(()=>cameraFromEye([0,0,0],[0,0,0]));assert.throws(()=>cameraFromEye([1000,0,0],[0,0,0]));
});

// Exercise the shipped viewer controller with a deterministic renderer/DOM fixture.
// This is not a substitute for device WebGL or a full-app browser acceptance test.
function harness(){
 class Element{
  constructor(){this.children=[];this.attributes={};this.hidden=false;this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.className='';this.events={};this._classes=new Set();this.classList={add:(...a)=>a.forEach(x=>this._classes.add(x)),remove:(...a)=>a.forEach(x=>this._classes.delete(x)),toggle:(a,b)=>b===false?this._classes.delete(a):this._classes.add(a)};}
  append(...children){this.children.push(...children);}prepend(...children){this.children.unshift(...children);}replaceChildren(...children){this.children=children;}setAttribute(k,v){this.attributes[k]=v;}toggleAttribute(k,v){if(v)this.attributes[k]='';else delete this.attributes[k];}remove(){}addEventListener(n,f){(this.events[n]||=[]).push(f);}querySelector(s){this.queries||={};return this.queries[s]||=(new Element());}
 }
 const listeners={},sent=[],cameraCalls=[],root=new Element(),canvas=new Element();canvas.parentElement=root;
 const floor={id:2,y:6,key:'F2'},location={id:'area-1',floor:2,title:'Communal corridor',pos:[0,6.5,0]},originalGroups=[{floor:2,kind:'slab'}];
 const renderer={canvas,groups:originalGroups,tris:[],shadowDirty:false,width:1500,height:900,current:{},camera:{radius:10},explode:0,visible:()=>true,offset:()=>-6,project:()=>({x:700,y:450,z:0}),setCamera:c=>{cameraCalls.push(c);renderer.camera=c;},onFrame:()=>{},onPick:()=>{}};
 const pc={assets:[location],PLAN:{floors:[floor],shapes:[{kind:'slab',f:2,p:[[-8,-8],[8,-8],[8,8],[-8,8]]}]},viewer:renderer,state:{floor:'all',wallHeight:1.05,mode:'exterior'},setFloor:f=>{pc.state.floor=f;},setMode:m=>{pc.state.mode=m;}};
 let blocked=false;
 const placed={id:'demo-equipment-one',locationId:'area-1',floor:2,floorY:6,rotation:0};
 const build=()=>[{kind:'demo-equipment',floor:2,demoId:'demo-equipment-one',anchor:[0,7.2,0],bounds:{lo:[0,6,0],hi:[1,7,1]},vertices:new Float32Array([0,6,0,0,1,0,1,0,0,0,1,6,0,0,1,0,1,0,0,0,0,7,0,0,1,0,1,0,0,0])}];
 const document={documentElement:new Element(),activeElement:null,createElement:()=>new Element(),createElementNS:()=>new Element(),getElementById:()=>null};
 const compiled={byId:new Map([['area-1',{contains:()=>true}]])},scene={compiled,picker:()=>blocked?{distance:.3}:null,stats:{geometryBuilds:1,picks:0},key:'fixture',invalidate(){},isLocationVisible:()=>true,pickOptions:()=>({visible:()=>true,offset:()=>-6,cap:()=>Infinity})};
 const context=vm.createContext({getScene:()=>scene,displayPoint,uploadGroup:(v,g)=>({g,arr:[]}),console,URLSearchParams,AbortController,Float32Array,Map,Set,Math,Number,Array,JSON,Object,String,Infinity,document,location:{search:'',origin:'https://fixture.test'},parent:{postMessage:m=>sent.push(m)},addEventListener:(n,f)=>(listeners[n]||=[]).push(f),setInterval:()=>0,clearInterval(){},setTimeout(){},pc,typeById:new Map(equipmentTypes.map(t=>[t.id,t])),issueStage,issueGlyph,issueIconSVG,primaryIssue,aerialCamera,eyeLevelCandidates,compileSurfaces:()=>({byId:new Map([['area-1',{contains:()=>true}]])}),createSurfacePicker:()=>()=>blocked?{distance:.3}:null,placeEquipment:()=>({placed:[placed],unplaced:[]}),buildEquipmentGroups:build,equipmentGLB:()=>new Uint8Array()});
 context.window=context;context.matchMedia=()=>({matches:true});
 const source=readFileSync(new URL('../packages/equipment-demo/viewer.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(source+'\ninstall(pc);',context);
 const post=(command,extra={},origin='https://fixture.test')=>{for(const fn of listeners.message||[])fn({source:context.parent,origin,data:{source:'propertychecked-equipment-demo',command,...extra}});};
 const data={enabled:true,objects:[{id:'demo-equipment-one',style:'alarm-panel',locationId:'area-1',slot:0}],issues:[{...issue('demo-issue-one','open','demo-equipment-one'),title:'Panel battery fault'}],size:1.5};
 const pins=()=>root.children.find(e=>e.id==='pc-equipment-overlays').querySelector('.pc-demo-issue-pins').children;
 return {pc,renderer,sent,cameraCalls,post,data,pins,originalGroups,scene,setBlocked:v=>{blocked=v;}};
}
test('shipped viewer creates meaningful red/yellow/green icons, preserving resolved records',()=>{
 const h=harness();for(const [status,stage] of [['open','found'],['in_progress','progress'],['awaiting_review','progress'],['resolved','working']]){
  h.data.issues[0].status=status;h.post('display',{value:h.data});assert.equal(h.pins().length,1);const pin=h.pins()[0];assert.equal(pin.dataset.stage,stage);assert.match(pin.innerHTML,/<svg/);assert.match(pin.title,/Panel battery fault/);
 }
});
test('an icon click sends only its real demo ID; UI navigation is non-modal',()=>{
 const h=harness();h.post('display',{value:h.data});h.pins()[0].onclick({stopPropagation(){}});assert.equal(h.sent.at(-1).type,'select');assert.equal(h.sent.at(-1).id,'demo-issue-one');
 const app=readFileSync(new URL('../apps/web/public/equipment-demo/app.js',import.meta.url),'utf8');assert.match(app,/m\.type==='select'.*inspect\(m\.id\)/);assert.match(app,/function inspect\(id\)/);assert.match(app,/data-focus-view="eye"/);assert.match(app,/data-focus-view="aerial"/);
});
test('show-working and show-markers toggles hide icons without deleting data',()=>{
 const h=harness();h.data.issues[0].status='resolved';h.post('display',{value:{...h.data,showWorking:false}});assert.equal(h.pins().length,0);h.post('display',{value:h.data});assert.equal(h.pins().length,1);h.post('display',{value:{...h.data,showMarkers:false}});assert.equal(h.pins().length,0);assert.equal(h.data.issues.length,1);
});
test('mixed issues at a device keep the red primary icon until all are addressed',()=>{
 const h=harness();h.data.issues.push({...h.data.issues[0],id:'demo-issue-two',status:'resolved'});h.post('display',{value:h.data});assert.equal(h.pins().length,1);assert.equal(h.pins()[0].dataset.stage,'found');
});
test('focus isolates the requested floor and sets an aerial camera automatically',()=>{
 const h=harness();h.post('display',{value:h.data});h.post('focus',{id:'demo-equipment-one',view:'aerial'});assert.equal(h.pc.state.floor,'2');assert.equal(h.pc.state.mode,'cutaway');assert.equal(h.cameraCalls.length,1);assert.ok(h.cameraCalls[0].phi<.1);assert.equal(h.sent.at(-1).view,'aerial');
});
test('eye-level focus uses a clear position; a blocked position falls back to aerial',()=>{
 const h=harness();h.post('display',{value:h.data});h.post('focus',{id:'demo-equipment-one',view:'eye'});assert.equal(h.sent.at(-1).view,'eye');const c=h.cameraCalls.at(-1);assert.ok(Math.abs(c.target[1]+c.radius*Math.cos(c.phi)-1.6)<1e-7);
 h.setBlocked(true);h.post('focus',{id:'demo-equipment-one',view:'eye'});assert.equal(h.sent.at(-1).view,'aerial');assert.equal(h.sent.at(-1).fallback,true);assert.equal(h.pc.state.wallHeight,2.8);
});
test('area icons support aerial focus without a made-up equipment position',()=>{
 const h=harness();h.post('display',{value:h.data});h.post('focusLocation',{id:'area-1',view:'aerial'});assert.equal(h.pc.state.selected,'area-1');assert.equal(h.sent.at(-1).view,'aerial');
});
test('foreign origins, invalid view modes and unknown IDs cannot position a camera',()=>{
 const h=harness();h.post('display',{value:h.data});h.post('focus',{id:'demo-equipment-one',view:'eye'},'https://foreign.test');h.post('focus',{id:'demo-equipment-one',view:'not-a-view'});h.post('focusLocation',{id:'unknown',view:'aerial'});assert.equal(h.cameraCalls.length,0);
});
test('unknown issue states and duplicate issue IDs do not create misleading markers',()=>{
 const h=harness();h.data.issues[0].status='safe';h.post('display',{value:h.data});assert.equal(h.pins().length,0);h.data.issues[0].status='open';h.data.issues.push({...h.data.issues[0]});h.post('display',{value:h.data});assert.equal(h.pins().length,1);
});
test('disabling demonstration restores original rendering arrays without source writes',()=>{
 const h=harness();h.post('display',{value:h.data});assert.notEqual(h.renderer.groups,h.originalGroups);h.post('display',{value:{enabled:false}});assert.equal(h.renderer.groups,h.originalGroups);
});

function appHarness(){
 const elements=new Map(),calls=[],writes=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{id,value:'',checked:true,hidden:false,open:false,innerHTML:'',textContent:'',disabled:false,inert:false,classList:{remove(){},add(){},toggle(){}},setAttribute(){},close(){this.open=false;},showModal(){this.open=true;},click(){}});return elements.get(id);};
 el('model').contentWindow={postMessage:m=>calls.push(m)};
 const data={version:1,records:[{id:'demo-equipment-one',kind:'equipment',style:'alarm-panel',title:'Alarm panel',category:'fire',locationId:'area-1'}, {...issue('demo-issue-one','open','demo-equipment-one'),title:'Panel battery fault'}],objects:[{id:'demo-equipment-one',style:'alarm-panel',locationId:'area-1',slot:0}],locations:[{id:'area-1',title:'Corridor',floor_key:'F2'}],floors:[{id:2,key:'F2',name:'Second floor'}],counts:{equipment:1,issues:1,areas:1,topics:0}};
 let fail=false;
 const api=async(path,options)=>{const body=JSON.parse(options.body);writes.push(body);if(fail)throw Error('Fixture save rejected');data.records.find(r=>r.id===body.id).status=body.status;data.version++;return structuredClone(data);};
 const ctx=vm.createContext({console,Map,Set,URL,URLSearchParams,JSON,Object,String,Number,Array,document:{readyState:'complete',getElementById:el,querySelectorAll:()=>[],querySelector:()=>null},location:{origin:'https://fixture.test'},addEventListener(){},clearInterval(){},setTimeout(){},categories:[{id:'fire',label:'Fire'}],api,json:(method,body)=>({method,body:JSON.stringify(body)}),setCsrf(){},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),openIssue:r=>r.kind==='issue'&&r.status!=='resolved',issueStage,issueStages,recordStage,issueCounts,issueGlyph,issueIconSVG,fixture:data});
 ctx.window=ctx;
 const source=readFileSync(new URL('../apps/web/public/equipment-demo/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/if\(document.readyState==='loading'\).*else start\(\);\s*$/,'');
 vm.runInContext(source+"\nstate.data=fixture;state.active=true;state.ready=true;",ctx);
 return {ctx,el,calls,writes,data,run:s=>vm.runInContext(s,ctx),reject:()=>{fail=true;}};
}
test('actual frontend inspect handler focuses immediately without opening a modal',()=>{
 const h=appHarness();h.run("inspect('demo-issue-one')");assert.equal(h.calls.at(-1).command,'focus');assert.equal(h.calls.at(-1).id,'demo-equipment-one');assert.equal(h.calls.at(-1).view,'aerial');assert.equal(h.el('demo-detail').open,false);assert.match(h.el('demo-focus-card').innerHTML,/Panel battery fault/);
});
test('actual frontend supports eye-level selection and source-area fallback',()=>{
 const h=appHarness();h.run("state.view='eye';inspect('demo-issue-one')");assert.equal(h.calls.at(-1).view,'eye');h.run("state.placement={unplacedIds:['demo-equipment-one']};inspect('demo-issue-one')");assert.equal(h.calls.at(-1).command,'focusLocation');assert.equal(h.calls.at(-1).id,'area-1');
});
test('camera navigation waits for the model and cannot manufacture a position',()=>{
 const h=appHarness();h.run("state.ready=false;inspect('demo-issue-one')");assert.equal(h.calls.length,0);assert.match(h.el('equipment-message').textContent,/still loading/);
});
test('all stages reach the viewer; filters affect visibility rather than stored records',()=>{
 const h=appHarness();h.data.records[1].status='resolved';h.run("state.showWorking=false;display()");const v=h.calls.at(-1).value;assert.equal(v.issues[0].status,'resolved');assert.equal(v.showWorking,false);assert.equal(h.data.records.length,2);
});
test('green is applied only after a successful explicitly noted demo update',async()=>{
 const h=appHarness();h.run("state.selected='demo-issue-one'");h.el('demo-sim-status').value='resolved';h.el('demo-sim-note').value='Synthetic successful outcome';await h.run('saveSimulation()');assert.equal(h.writes[0].status,'resolved');assert.equal(h.data.records[1].status,'resolved');assert.match(h.el('demo-detail').innerHTML,/Working correctly/);
});
test('blank notes or rejected saves cannot make the selected issue green',async()=>{
 const h=appHarness();h.run("state.selected='demo-issue-one'");h.el('demo-sim-status').value='resolved';await h.run('saveSimulation()');assert.equal(h.writes.length,0);assert.equal(h.data.records[1].status,'open');h.el('demo-sim-note').value='Synthetic';h.reject();await h.run('saveSimulation()');assert.equal(h.data.records[1].status,'open');assert.match(h.el('demo-save-message').textContent,/rejected/);
});
test('legacy awaiting-review stays yellow and a note-only edit preserves its workflow status',async()=>{
 const h=appHarness();h.data.records[1].status='awaiting_review';h.run("state.selected='demo-issue-one'");h.el('demo-sim-status').value='in_progress';h.el('demo-sim-note').value='Still awaiting review';await h.run('saveSimulation()');assert.equal(h.writes[0].status,'awaiting_review');assert.equal(recordStage(h.data.records[1],h.data.records).key,'progress');
});

test('status updates and floor selections retain the same equipment buffers',()=>{
 const h=harness();h.post('display',{value:h.data});const groups=h.renderer.groups,builds=h.scene.stats.geometryBuilds;
 h.data.issues[0].status='in_progress';h.post('display',{value:h.data});assert.equal(h.renderer.groups,groups);assert.equal(h.scene.stats.geometryBuilds,builds);
 h.post('focus',{id:'demo-equipment-one',view:'aerial'});assert.equal(h.renderer.groups,groups);assert.equal(h.scene.stats.geometryBuilds,builds);
});
