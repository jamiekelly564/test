import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { candidateFeature } from '../../../packages/preview/map-shape.mjs';

export class TileDataError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
/** Regional files can exceed 100 MB compressed. Keep only bounded nearby
 * candidates; stream and discard every unrelated line without whole-file inflation. */
export async function streamTile(chunks,origin,tile,signal,maxBytes=192*1024*1024){
  let bytes=0;
  async function* limited(){
    for await(const chunk of chunks){
      signal.throwIfAborted();bytes+=chunk.length;
      if(bytes>maxBytes)throw new TileDataError('MAP_TOO_LARGE','Regional download exceeds the bounded byte budget.');
      yield chunk;
    }
  }
  const iterator=limited()[Symbol.asyncIterator](),prefix=[];let prefixSize=0;
  while(prefixSize<2){const next=await iterator.next();if(next.done)break;prefix.push(next.value);prefixSize+=next.value.length;}
  const first=Buffer.concat(prefix);
  async function* remaining(){
    try{if(first.length)yield first;while(true){const next=await iterator.next();if(next.done)break;yield next.value;}}
    finally{await iterator.return?.();}
  }
  const input=Readable.from(remaining());
  const sink=async decoded=>{
    const decoder=new TextDecoder('utf-8',{fatal:true}),candidates=[];let carry='',inflated=0,lines=0;
    const parse=line=>{
      const text=line.trim();if(!text)return;
      if(text.length>65536)throw new TileDataError('MAP_ROW','An individual feature exceeds its size limit.');
      if(++lines>4000000)throw new TileDataError('MAP_TOO_LARGE','Regional file exceeds its feature limit.');
      let value;try{value=JSON.parse(text);}catch{throw new TileDataError('MAP_FORMAT','Regional data contains incomplete GeoJSON.');}
      const candidate=candidateFeature(value,origin,lines);
      if(candidate){candidate.id=`ms-${tile}-${lines}`;candidates.push(candidate);}
      if(candidates.length>1600)throw new TileDataError('MAP_TOO_DENSE','Too many nearby outlines for this preview.');
    };
    for await(const chunk of decoded){
      signal.throwIfAborted();inflated+=chunk.length;
      if(inflated>2*1024*1024*1024)throw new TileDataError('MAP_TOO_LARGE','Regional decoded stream exceeds its limit.');
      carry+=decoder.decode(chunk,{stream:true});let start=0,end;
      while((end=carry.indexOf('\n',start))>=0){parse(carry.slice(start,end));start=end+1;if(lines&&lines%8192===0){await yieldTurn();signal.throwIfAborted();}}
      carry=carry.slice(start);
      if(carry.length>65536)throw new TileDataError('MAP_ROW','An individual feature exceeds its size limit.');
    }
    carry+=decoder.decode();parse(carry);signal.throwIfAborted();return {candidates,bytes};
  };
  return first[0]===31&&first[1]===139?pipeline(input,createGunzip(),sink,{signal}):pipeline(input,sink,{signal});
}
