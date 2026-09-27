import { createMapProvider, MapDataError } from '../apps/api/map-data/provider.mjs';
const [name,postcode,...rest]=process.argv.slice(2);
if(!name||!postcode||rest.length){console.log('Usage: npm run check:map -- "Building name" "UK postcode"');console.log('Explicit public-data diagnostic only. No AI request, model save or payment.');process.exitCode=1;}
else{
  console.log('Checking open building data and optional numeric LiDAR. This can take up to two minutes. No API credit is used.');
  try{
    const r=await createMapProvider().lookup(name,postcode,AbortSignal.timeout(120000));
    console.log(JSON.stringify({available:!!r.mapped,candidates:r.candidates||0,source:r.mapped?.source||null,release:r.mapped?.release||null,heightM:r.mapped?.heightM??null,heightBasis:r.mapped?.heightBasis||'unknown',match:r.mapped?.matchNote||r.reason,scan:r.mapped?.scanNote||null},null,2));
    if(!r.mapped)process.exitCode=1;
  }catch(error){console.error(error instanceof MapDataError?`${error.code}: ${error.message}`:'Open-map lookup did not complete. No model was changed.');process.exitCode=1;}
}
