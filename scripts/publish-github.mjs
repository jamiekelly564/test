/** Creates only the named private repository, after local interactive approval. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
const expected='jamiekelly564/propertychecked-platform',root=process.cwd();
function capture(cmd,args){return spawnSync(cmd,args,{cwd:root,encoding:'utf8',stdio:['inherit','pipe','pipe']});}
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:root,stdio:'inherit'});if(r.error||r.status!==0)throw new Error(`${cmd} did not complete. No force-push is attempted.`);}
function stop(message){console.error('\n'+message);process.exit(1);}
if(!existsSync('package.json')||JSON.parse(readFileSync('package.json','utf8')).name!=='propertychecked-platform')stop('Run this from the PropertyChecked project folder, not an existing FireChecked repository.');
if(capture('git',['--version']).status!==0)stop('Install Git, restart VS Code, and try again.');
if(capture('gh',['--version']).status!==0)stop('GitHub CLI is not installed. Use VS Code: Ctrl+Shift+P > Publish to GitHub > PRIVATE. Name the repository propertychecked-platform. Alternatively install GitHub CLI and rerun this command.');
const existingRoot=capture('git',['rev-parse','--show-toplevel']);
if(existingRoot.status===0&&resolve(existingRoot.stdout.trim())!==resolve(root))stop('This folder is inside another Git repository. Move it out before publishing; existing apps will not be modified.');
if(capture('gh',['auth','status','--hostname','github.com']).status!==0)run('gh',['auth','login','--hostname','github.com','--git-protocol','https','--web']);
const identity=capture('gh',['api','user','--jq','.login']);
if(identity.status!==0||identity.stdout.trim()!=='jamiekelly564')stop('Sign into the GitHub account jamiekelly564 first. This script will not create a repository under a different account.');
const remote=capture('git',['remote','get-url','origin']);
if(remote.status===0)stop('This local project already has an origin remote. Use VS Code Sync Changes or git push after reviewing it. No remote has been changed.');
const found=capture('gh',['repo','view',expected,'--json','nameWithOwner,isPrivate']);
if(found.status===0)stop('That repository already exists. Clone it in VS Code, review its contents, then copy the starter into the clone. This script will not overwrite or merge an existing repository.');
console.log(`\nTarget: ${expected}\nVisibility: PRIVATE\nExcluded: private-assets, .data, backups and .env files.\nNo website deployment or purchase will be made.`);
const rl=createInterface({input:process.stdin,output:process.stdout});
const answer=await rl.question('Type PUBLISH to create this repository and upload the code: ');rl.close();
if(answer!=='PUBLISH'){console.log('Cancelled.');process.exit(0);}
if(!existsSync('.git'))run('git',['init','-b','main']);
for(const item of ['private-assets/marketfield/viewer.html','.data/workspace.sqlite','.env'])if(capture('git',['check-ignore',item]).status!==0)stop(`Safety check failed: ${item} is not ignored.`);
const tracked=capture('git',['ls-files']).stdout.split('\n');
if(tracked.some(p=>p.startsWith('.data/')||p.startsWith('backups/')||(p.startsWith('private-assets/')&&p!=='private-assets/README.md')||p==='.env'||(p.startsWith('.env.')&&p!=='.env.example')))stop('Private files are already tracked. Remove them from Git before continuing.');
run('git',['add','.']);
const staged=capture('git',['diff','--cached','--quiet']);
if(staged.status!==0)run('git',['-c','user.name=PropertyChecked starter','-c','user.email=local-builder@localhost','commit','-m','Build PropertyChecked local development foundation']);
run('gh',['auth','setup-git']);
run('gh',['repo','create',expected,'--private','--source=.','--remote=origin','--push','--description','PropertyChecked 3D building workspace and survey workflow']);
const verification=capture('gh',['repo','view',expected,'--json','nameWithOwner,isPrivate,url']);
if(verification.status!==0)stop('The command completed, but repository visibility could not be verified. Check GitHub before continuing.');
const info=JSON.parse(verification.stdout);if(info.isPrivate!==true)stop('Repository visibility needs checking immediately. No further changes will be pushed.');
console.log(`\nVerified private repository: ${info.url}\nThe private Marketfield model pack remains on your PC, not on GitHub.`);
