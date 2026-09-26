import { HttpError } from '../validation.mjs';
export function accountSettings(){return {configured:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_RECONSTRUCTION_MODEL||process.env.OPENAI_MODEL||'gpt-6-astra'};}
export async function checkAccount({key=process.env.OPENAI_API_KEY,model=accountSettings().model,fetcher=fetch}={}){
  if(!key)throw new HttpError(503,'AI is not configured on this PC. Run npm run setup:ai in the VS Code terminal. Never paste the key into chat.');
  if(!/^[a-zA-Z0-9._-]{1,120}$/.test(model))throw new HttpError(400,'Invalid model ID in the server configuration.');
  let response;try{response=await fetcher('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(502,'Could not check the OpenAI connection. Check your internet connection or approved network configuration.');}
  const status=response.status;await response.body?.cancel();
  if(status!==200)throw new HttpError(502,status===401?'OpenAI did not accept this API key. Create or check a project API key on your account.':status===404?'This account cannot access the configured model. Check OPENAI_RECONSTRUCTION_MODEL.':`OpenAI access check returned HTTP ${status}. Check your account permissions or limits.`);
  return {configured:true,model,accountAccessChecked:true,checkedAt:new Date().toISOString(),notice:'The key can access this model entry. This did not run inference or verify billing, vision quality, web search or reconstruction capability.'};
}
