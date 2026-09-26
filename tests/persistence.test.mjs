import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openWorkspace } from '../apps/api/database.mjs';
test('building, task and survey records survive closing and reopening SQLite',()=>{
 const root=mkdtempSync(join(tmpdir(),'propertychecked-persist-')),filename=join(root,'workspace.sqlite');
 let db=openWorkspace(filename,join(root,'absent-model-pack'));
 try{
  const b=db.addBuilding({name:'Persistence test building',address:'Test-only address',postcode:'RH2 9QQ'});
  db.addTask(b.id,{title:'Persistent task',description:'Fixture',priority:'normal',locationId:null});
  db.addSurvey(b.id,{tier:'bronze',modules:['condition'],coverage:'Test common areas',preferredDate:'',notes:'No email',requestKey:'persistent-test-key-123'});
  db.close();db=openWorkspace(filename,join(root,'absent-model-pack'));
  assert.equal(db.building(b.id).name,'Persistence test building');
  assert.equal(db.tasks(b.id).length,1);assert.equal(db.surveys(b.id).length,1);
  assert.equal(db.building(b.id).model_key,null);
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});
