import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError, text, choice } from '../validation.mjs';
import { evidenceStore, digest } from './store.mjs';
import { createEvidenceAI, aiSettings } from './ai.mjs';
import { exportGLB, SCENARIOS } from '../../../packages/evidence/graph.mjs';

export function createEvidenceRouter({workspace,uploadDir,send,jsonBody,readBody,ai=createEvidenceAI()}){
  const store=evidenceStore(workspace),active=new Map();let calls=[],closing=false;
  const key=v=>{const s=text(v,'Request reference',70);if(!/^[a-zA-Z0-9-]{12,70}$/.test(s))throw new HttpError(400,'Invalid request reference.');return s;};
  function start(buildingId,kind,input,operation){
    const requestKey=key(input.requestKey),hash=digest({buildingId,kind,input}),prior=store.priorJob(requestKey,hash);
    if(prior)return prior;
    if(active.size)throw new HttpError(429,'An evidence job is already running. Wait or cancel it before starting another.');
    calls=calls.filter(t=>Date.now()-t<600000);if(calls.length>=5)throw new HttpError(429,'Five AI jobs per ten minutes are allowed in this local preview. Wait before retrying.');
    const job=store.startJob(buildingId,kind,requestKey,hash),controller=new AbortController();calls.push(Date.now());
    const promise=Promise.resolve().then(()=>operation(controller.signal,job.id)).then(result=>{if(!controller.signal.aborted)store.finishJob(job.id,'succeeded',result);}).catch(e=>{store.finishJob(job.id,controller.signal.aborted?'cancelled':'failed',null,e instanceof HttpError?e.message:'Evidence processing failed safely. Try fewer or clearer documents; no model was published.');}).finally(()=>active.delete(job.id));
    active.set(job.id,{controller,promise});return job;
  }
  return {
    store,
    async close(){closing=true;for(const a of active.values())a.controller.abort();await Promise.allSettled([...active.values()].map(a=>a.promise));},
    async handle(req,res,path,method){
      if(!path.startsWith('/api/evidence/'))return false;
      if(closing)throw new HttpError(503,'The PC server is stopping.');
      // Called ONLY after the host/session/CSRF checks in server.mjs.
      if(path==='/api/evidence/config'&&method==='GET'){send(req,res,200,{...aiSettings(),version:'0.4.0',limits:{sourcesPerJob:6,inputMegabytes:16},notice:'AI requests are opt-in and separately billed by OpenAI. Tracing, review and GLB export run locally.'});return true;}
      const jm=path.match(/^\/api\/evidence\/jobs\/([a-zA-Z0-9-]+)(?:\/(cancel))?$/);
      if(jm){const job=store.job(jm[1]);if(method==='GET'&&!jm[2])send(req,res,200,job);else if(method==='POST'&&jm[2]){active.get(job.id)?.controller.abort();store.finishJob(job.id,'cancelled',null,'Cancelled by the user. Provider usage already incurred may still be charged.');send(req,res,200,store.job(job.id));}else throw new HttpError(405,'Method not allowed.');return true;}
      const m=path.match(/^\/api\/evidence\/buildings\/([a-zA-Z0-9-]+)(?:\/(sources|discover|reconstruct|drafts)(?:\/([a-zA-Z0-9-]+)(?:\/(review|export\.glb|export\.json))?)?)?$/);
      if(!m)throw new HttpError(404,'Evidence route not found.');
      const [,bid,part,id,action]=m,building=workspace.building(bid);
      if(!part&&method==='GET'){send(req,res,200,{building,...store.list(bid),documents:workspace.documents(bid)});return true;}
      if(part==='sources'&&method==='POST'){send(req,res,201,store.addSource(bid,await jsonBody(req)));return true;}
      if(part==='drafts'&&id){
        const d=store.draft(bid,id);
        if(method==='POST'&&action==='review'){send(req,res,200,store.review(bid,id,await jsonBody(req)));return true;}
        if(method==='GET'){
          if(action==='export.glb'){
            if(!d.graph.floors.length)throw new HttpError(422,'There is no supported geometry to export.');
            res.setHeader('Content-Disposition','attachment; filename="propertychecked-evidence-draft.glb"');send(req,res,200,Buffer.from(exportGLB(d.graph)),'model/gltf-binary');
          }else if(action==='export.json'){res.setHeader('Content-Disposition','attachment; filename="propertychecked-evidence-draft.json"');send(req,res,200,{...d,notice:'Unverified reconstruction. Proposed drawings do not establish current built conditions.'});}
          else send(req,res,200,d);return true;
        }
      }
      if(part==='drafts'&&!id&&method==='POST'){
        if(!String(req.headers['content-type']).startsWith('application/json'))throw new HttpError(415,'Expected JSON.');
        let input;try{input=JSON.parse((await readBody(req,512*1024)).toString('utf8'));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid graph JSON.');}
        send(req,res,201,store.saveDraft(bid,input.graph,'manual-trace-or-edit',key(input.requestKey)));return true;
      }
      if(['discover','reconstruct'].includes(part)&&method==='POST'){
        const input=await jsonBody(req);
        if(input.allowExternal!==true)throw new HttpError(400,'Explicitly approve the external AI request.');
        if(input.buildingConfirmed!==true)throw new HttpError(400,'Confirm the exact building/address before searching or reconstructing.');
        if(part==='discover'){
          const query=text(input.query,'Property address/query',500),domain=text(input.domain,'Council domain',200,false);
          if(domain&&!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain))throw new HttpError(400,'Use a domain only, such as planning.yourcouncil.gov.uk.');
          const job=start(bid,'discover',input,signal=>ai.discover({query,domain},signal));send(req,res,202,job);return true;
        }
        const all=store.sources(bid),selected=input.sourceIds;
        if(!Array.isArray(selected)||!selected.length||selected.length>6||new Set(selected).size!==selected.length)throw new HttpError(400,'Choose 1 to 6 distinct authorised sources.');
        const sources=selected.map(id=>all.find(s=>s.id===id));
        if(sources.some(s=>!s||s.rights==='pending'||!s.buildingConfirmed))throw new HttpError(400,'All selected sources must belong to this building and have declared reuse permission.');
        if(!sources.some(s=>s.role!=='photo'))throw new HttpError(400,'Add a dimensioned drawing. Photos alone cannot establish the internal layout.');
        const scenario=choice(input.scenario,'scheme',SCENARIOS),notes=text(input.notes,'Interpretation notes',2500,false);
        if(sources.some(s=>s.role!=='photo'&&s.scenario!==scenario))throw new HttpError(400,'Choose drawings from one scenario; existing and proposed layouts cannot be merged.');
        if(sources.reduce((n,s)=>n+s.size,0)>16*1024*1024)throw new HttpError(413,'Selected documents exceed 16 MB. Split the batch.');
        const job=start(bid,'reconstruct',input,async(signal,jobId)=>{
          const buffers=await Promise.all(sources.map(s=>readFile(join(uploadDir,workspace.document(s.documentId).storage_name))));
          if(buffers.some((b,i)=>createHash('sha256').update(b).digest('hex')!==sources[i].sha256))throw new HttpError(409,'A stored source changed on disk. Upload it again as a new revision.');
          if(buffers.reduce((n,b)=>n+b.length,0)>16*1024*1024)throw new HttpError(413,'Source files are too large.');
          const {graph,model}=await ai.reconstruct({title:building.name,scenario,notes,sources,buffers},signal);
          if(signal.aborted)throw new HttpError(409,'Cancelled; no draft saved.');
          if(graph.scenario!==scenario)throw new HttpError(422,'AI returned a different drawing scenario; no draft saved.');
          const d=store.saveDraft(bid,graph,'openai:'+model,jobId,sources);return {draftId:d.id,notice:'Draft only. Review scale, alignment, missing areas and conflicts before use.'};
        });send(req,res,202,job);return true;
      }
      throw new HttpError(405,'Method not allowed.');
    }
  };
}
