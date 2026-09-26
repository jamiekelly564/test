import { createProviders } from '../apps/api/auto-model/providers.mjs';

// Explicit invocation only; never run a remote probe on startup or in npm test.
const input=process.argv.slice(2).join(' ').trim();
if(!input){
  console.log('Usage: npm run check:data -- "postcode or Google Maps link"');
  console.log('This sends the supplied input to the same public providers as Create 3D model. No plans, keys or resident records are sent.');
  process.exitCode=1;
}else{
  const started=Date.now();
  try{
    console.log('Checking public location and footprint data. No building will be saved.');
    const providers=createProviders();
    const location=await providers.resolve(input);
    console.log('Location resolved ('+location.basis+'). Looking for building outlines...');
    const result=await providers.buildings(location);
    console.log('Success: '+result.candidates.length+' usable mapped outlines; provider '+result.provider.host+'.');
    for(const warning of result.warnings)console.log(warning);
    console.log('Elapsed: '+((Date.now()-started)/1000).toFixed(1)+' seconds.');
    if(!result.candidates.length)console.log('No mapped building is available here; no substitute geometry has been generated.');
  }catch(error){
    console.error(error.message);
    if(error.diagnostic)console.error(JSON.stringify(error.diagnostic,null,2));
    process.exitCode=1;
  }
}
