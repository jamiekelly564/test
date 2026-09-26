import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd();let count=0;
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','.data','private-assets','backups'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(/\.(mjs|js)$/.test(entry.name)){const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(result.status!==0)process.exit(1);count++;}}}
walk(root);
const ignore=readFileSync(resolve(root,'.gitignore'),'utf8');
for(const path of ['private-assets/*','.data/','.env','backups/'])if(!ignore.includes(path)){console.error('Missing private-data exclusion:',path);process.exit(1);}
console.log(`Checked ${count} JavaScript modules and private-data exclusions.`);
