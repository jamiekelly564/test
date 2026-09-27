import { defaultSpec } from '../../packages/preview/model.mjs';
import { defaultArchitecture, defaultFacade } from '../../packages/preview/architecture.mjs';

// Entirely synthetic, not Foundation House, Queensgate or a reconstructed client.
export function architecturalFixture() {
  const spec=defaultSpec('Synthetic architecture demonstration');
  spec.blocks[0]={...spec.blocks[0],width:28,depth:16,floors:5,finish:'brick',roof:'flat'};
  spec.blocks.push({...spec.blocks[0],label:'Illustrative side wing',x:28,y:3,width:12,depth:13,floors:3,roof:'gable',roofHeight:2.3,columns:3});
  spec.architecture=defaultArchitecture(spec);
  const a=spec.architecture,base=defaultFacade(spec.blocks[0]);
  a.facades[0]={...base,frameColour:'#303f44',wallColour:'#a06b53',windowWidth:1.7,windowHeight:1.8,spacing:3.8,band:'sill'};
  a.facades.push({...a.facades[0],edge:0,firstFloor:0,lastFloor:0,surface:'plain',wallColour:'#c0b8a5',windowStyle:'ribbon',sillHeight:.3,windowHeight:2.35,band:'none'});
  a.facades.push({...a.facades[0],edge:0,firstFloor:1,lastFloor:4,balcony:'projecting',balconyEvery:2,balconyDepth:1.25,railing:'metal',sourcePhotoIds:['synthetic-photo']});
  a.facades.push({...a.facades[0],edge:1,surface:'plain',wallColour:'#d6d0c0',windowStyle:'bay',windowWidth:1.65,spacing:3.5});
  a.facades.push({...a.facades[0],edge:0,start:.0,end:.09,windowStyle:'none',band:'none'});
  a.facades[1]={...a.facades[1],wallColour:'#d2c6ad',surface:'plain',frameColour:'#546368',windowStyle:'sash',windowHeight:1.7,panesX:2,panesY:2};
  a.entrances=[{block:0,edge:0,position:.52,width:2.5,height:2.6,canopyDepth:1.8,doubleDoor:true,colour:'#304348',sourcePhotoIds:['synthetic-photo']}];
  a.roofFeatures=[{block:0,kind:'plant',u:.7,v:.7,width:3.2,depth:2,height:1.15,colour:'#7c8381',sourcePhotoIds:[]},
    {block:1,kind:'chimney',u:.7,v:.5,width:.65,depth:.8,height:1.2,colour:'#aa775c',sourcePhotoIds:[]},
    {block:1,kind:'dormer',u:.3,v:.23,width:1.5,depth:1.6,height:1.1,colour:'#b0a999',sourcePhotoIds:[]}];
  spec.usedPhotoIds=['synthetic-photo'];spec.matchBasis='ambiguous';
  spec.summary='Synthetic demonstration of architectural features. Not a real property reconstruction.';
  return spec;
}
