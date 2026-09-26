import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { checkAccount } from '../apps/api/evidence/account.mjs';

export async function saveAIConfig(file,key,model){
  if(!/^[A-Za-z0-9_\-]{12,600}$/.test(key)||!/^[A-Za-z0-9._-]{1,120}$/.test(model))throw new Error('Invalid key or model format. Nothing saved.');
  const info=await lstat(file).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});if(info?.isSymbolicLink())throw new Error('Refusing to overwrite a linked configuration file.');
  const old=info?await readFile(file,'utf8'):'';
  const keep=old.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?(OPENAI_API_KEY|OPENAI_RECONSTRUCTION_MODEL)\s*=/.test(line));
  const output=keep.join('\n').trimEnd()+`\nOPENAI_API_KEY=${key}\nOPENAI_RECONSTRUCTION_MODEL=${model}\n`;
  const temporary=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,output,{flag:'wx',mode:0o600});await rename(temporary,file);}catch(e){await unlink(temporary).catch(()=>{});throw e;}
}
async function main(){
  if(!process.stdin.isTTY)throw new Error('Run this command in your local VS Code terminal, not through redirected input.');
  console.log('PropertyChecked AI setup. Your key stays in .env on this PC. It is not uploaded to GitHub.');
  console.log('This checks access to the model entry on OpenAI. It does not submit plans or run paid inference.');
  console.log('API usage for later searches/reconstructions is separate from a ChatGPT subscription.');
  let muted=false;const output=new Writable({write(chunk,_encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
  const rl=createInterface({input:process.stdin,output,terminal:true});
  const ask=prompt=>new Promise(resolve=>rl.question(prompt,resolve));
  try{
    const proceed=await ask('Continue with the OpenAI access check? [y/N] ');if(!/^y(es)?$/i.test(proceed.trim()))return;
    process.stdout.write('Paste your project API key (input is hidden): ');muted=true;const key=(await ask('')).trim();muted=false;console.log('');
    const current=process.env.OPENAI_RECONSTRUCTION_MODEL||process.env.OPENAI_MODEL||'gpt-6-astra';
    const model=(await ask(`Model ID [${current}]: `)).trim()||current;
    await checkAccount({key,model});await saveAIConfig(resolve('.env'),key,model);
    console.log('Saved privately. Restart PropertyChecked with npm run dev, then use Build from plans.');
    console.log('Account access checked. Billing, reconstruction accuracy and web-search access still require a real approved job.');
  }finally{muted=false;rl.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
