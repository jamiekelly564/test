import { randomUUID, createHash } from 'node:crypto';
import { HttpError, text } from '../validation.mjs';
import { createProviders } from './providers.mjs';
import { selectionInput } from './input.mjs';
import { createModel, meshModel, glb, geojson } from '../../../packages/auto-model/geometry.mjs';
import { suggestDimensions, aiConfig } from './ai.mjs';
export function createAutoService(workspace,options={}){
  const providers=options.providers||createProviders(),searches=new Map(),cache=new Map(),inflight=new Map();
  let busy=false,calls=[],aiCalls=[];
  const ttl=30*60*1000;
  function prune(){const now=Date.now();for(const [k,s]of searches)if(s.expires<now)searches.delete(k);for(const [k,s]of cache)if(s.expires<now)cache.delete(k);while(searches.size>60)searches.delete(searches.keys().next().value);while(cache.size>60)cache.delete(cache.keys().next().value);}
  function lookup(id){prune();const s=searches.get(id);if(!s)throw new HttpError(410,'This building search expired. Search again before saving.');return s.data;}
  return {
    config:()=>({available:true,ai:aiConfig(),radiusM:250,externalRequests:'Search sends a postcode to Postcodes.io, coordinates to the configured Overpass service, and short Maps links to Google for redirect resolution only. No private drawings are sent.',providerMode:'local-interactive-prototype',notes:'Public Overpass is for occasional development tests. Configure your own or a contracted endpoint before a customer launch.'}),
    async search(input){
      if(input.allowExternal!==true)throw new HttpError(400,'Approve the public-data lookup before searching.');
      const value=text(input.input,'Postcode or Maps link',2200);prune();const cacheKey=value.trim();
      if(cache.has(cacheKey))return {...cache.get(cacheKey).data,cached:true};
      if(busy)throw new HttpError(429,'A footprint search is already running. Wait for it to finish.');
      calls=calls.filter(t=>Date.now()-t<60000);if(calls.length>=4)throw new HttpError(429,'Four public-data searches per minute are allowed in this local preview. Wait before trying another location.');
      calls.push(Date.now());busy=true;
      try{
        const location=await providers.resolve(value),result=await providers.buildings(location),id=randomUUID();
        const data={...result,id,location,cached:false};searches.set(id,{expires:Date.now()+ttl,data});cache.set(cacheKey,{expires:Date.now()+ttl,data});return data;
      }finally{busy=false;}
    },
    async generate(input){
      const selection=selectionInput(input),{requestKey,searchId,candidateIds,overrides,name,address,useAI}=selection;
      const signature=createHash('sha256').update(JSON.stringify(selection)).digest('hex');
      const previous=workspace.generatedRequest(requestKey);if(previous){if(previous.request_hash!==signature)throw new HttpError(409,'This save reference was used for different details. Refresh and save again.');return {...workspace.building(previous.building_id),duplicate:true};}
      if(inflight.has(requestKey)){if(inflight.get(requestKey).signature!==signature)throw new HttpError(409,'Save already running with different details.');return inflight.get(requestKey).promise;}
      const search=lookup(searchId);
      const selected=candidateIds.map(id=>search.candidates.find(c=>c.id===id));if(selected.some(c=>!c))throw new HttpError(400,'The selection does not belong to this search.');
      const parts=selected.flatMap(c=>c.parts?.length?c.parts:[c]);const valid=new Set(parts.map(p=>p.id));if(Object.keys(overrides).some(id=>!valid.has(id)))throw new HttpError(400,'A height override does not belong to the selection.');
      const promise=(async()=>{
        let suggestions=[];
        if(useAI){aiCalls=aiCalls.filter(t=>Date.now()-t<60000);if(aiCalls.length>=3)throw new HttpError(429,'Wait before making another AI request.');aiCalls.push(Date.now());suggestions=await (options.suggest||suggestDimensions)(parts.filter(p=>overrides[p.id]?.heightM==null&&overrides[p.id]?.storeys==null));}
        let model;try{model=createModel(search,candidateIds,overrides,suggestions);meshModel(model);}catch(e){throw new HttpError(422,e.message);}
        model.title=name;model.ai={...model.ai,requested:useAI,model:useAI?aiConfig().model:null};
        return workspace.addGeneratedBuilding({name,address,postcode:search.location.postcode||'',model,requestKey,requestHash:signature});
      })();inflight.set(requestKey,{signature,promise});try{return await promise;}finally{inflight.delete(requestKey);}
    },
    model:id=>workspace.generatedModel(id),
    glb:id=>glb(workspace.generatedModel(id)),
    geojson:id=>geojson(workspace.generatedModel(id))
  };
}
