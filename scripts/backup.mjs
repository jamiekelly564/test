import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, cpSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const data=resolve(process.env.PROPERTYCHECKED_DATA_DIR||'.data'),source=join(data,'workspace.sqlite');
if(!existsSync(source)){console.log('No workspace database exists yet. Start the app first.');process.exit(0);}
const target=resolve('backups',new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(target,{recursive:true});
const db=new DatabaseSync(source);db.prepare('VACUUM INTO ?').run(join(target,'workspace.sqlite'));db.close();
if(existsSync(join(data,'uploads')))cpSync(join(data,'uploads'),join(target,'uploads'),{recursive:true});
writeFileSync(join(target,'README.txt'),'Private local backup. Keep it out of Git and public hosting. Stop the app before restoring workspace.sqlite and uploads into .data. Original model assets are not duplicated; keep the supplied private model pack separately.\n');
console.log(`Private backup created at ${target}\nNo data has been uploaded anywhere.`);
