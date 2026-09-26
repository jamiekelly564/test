import { HttpError } from '../validation.mjs';

const UA = 'PropertyChecked-Local-Preview/0.2.2 (+https://github.com/jamiekelly564/test)';
const labels = { maps: 'Google Maps link resolution', postcode: 'Postcodes.io postcode lookup', footprints: 'Building-outline lookup', data: 'Data lookup' };

/** Safe diagnostics only: never include URLs, response bodies, keys or user input. */
export class ProviderError extends HttpError {
  constructor(context, code, reason, { status = 503, httpStatus = null, retryAfterSeconds = 0, transient = false, actionRequired = false } = {}) {
    const { stage = 'data', provider = 'data service' } = context;
    const hint = stage === 'maps' ? 'Open the link in your browser and paste the full Maps URL, postcode or pin coordinates.'
      : stage === 'postcode' ? 'You can also paste precise latitude, longitude to skip postcode lookup.'
      : stage === 'footprints' ? 'The location was found, but no building model has been generated.' : '';
    super(status, `${labels[stage] || labels.data}: ${reason}${httpStatus ? ` (HTTP ${httpStatus})` : ''}. ${hint}`.trim());
    this.code = code;
    this.transient = transient;
    this.diagnostic = { stage, provider, code, httpStatus, retryAfterSeconds, ...(actionRequired ? { actionRequired: true } : {}) };
  }
}

export async function cancelBody(response) {
  try { await response.body?.cancel(); } catch { /* A closed/aborted body is already released. */ }
}

export function retrySeconds(header, now = Date.now()) {
  if (!header) return 0;
  const seconds = /^\d+$/.test(header.trim()) ? Number(header) : Math.ceil((Date.parse(header) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function transportError(error, context) {
  if (error instanceof HttpError) return error;
  const codes = [error?.code, error?.cause?.code, ...(error?.cause?.errors || []).map(e => e.code)];
  if (['TimeoutError', 'AbortError'].includes(error?.name) || codes.some(c => ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(c))) {
    return new ProviderError(context, 'TIMEOUT', 'the service took too long to respond', { transient: true });
  }
  if (codes.some(c => ['ENOTFOUND', 'EAI_AGAIN'].includes(c))) {
    return new ProviderError(context, 'DNS', 'your PC could not resolve the service address; check the internet connection and DNS', { transient: true });
  }
  if (codes.some(c => /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(c || ''))) {
    return new ProviderError(context, 'TLS', 'the secure connection could not be verified; check your PC clock or approved network certificates. Do not disable certificate checks');
  }
  return new ProviderError(context, 'NETWORK', 'the internet connection to the service failed; check your PC connection, firewall or approved proxy', { transient: true });
}

export async function request(fetcher, url, options = {}, context = {}) {
  try {
    return await fetcher(url, { ...options, redirect: options.redirect || 'error',
      headers: { 'User-Agent': UA, Accept: 'application/json', ...options.headers },
      signal: options.signal || AbortSignal.timeout(35000) });
  } catch (error) { throw transportError(error, context); }
}

export async function checkStatus(response, context = {}, now = Date.now()) {
  if (response.ok) return;
  await cancelBody(response);
  const httpStatus = response.status, retry = retrySeconds(response.headers.get('retry-after'), now);
  // This host's operator documents 406 as a manual access block, not 429.
  // Other services may use the normal HTTP content-negotiation meaning.
  // Never invent a retry interval, change identity or fail over on a refusal.
  if (httpStatus === 406) {
    const overpassBlock = context.stage === 'footprints' &&
      (context.provider === 'overpass-api.de' || context.provider?.endsWith('.overpass-api.de'));
    throw new ProviderError(context, overpassBlock ? 'ACCESS_DENIED' : 'NOT_ACCEPTABLE',
      overpassBlock
        ? 'this Overpass service rejected application access, not a normal rate limit. Stop retrying; resolve access with the operator or configure a data service that authorises this use'
        : 'the service rejected this request as not acceptable. Check its request requirements and access policy before retrying',
      { status: 502, httpStatus, retryAfterSeconds: retry, actionRequired: true });
  }
  if (httpStatus === 429) {
    const wait = Math.max(30, retry);
    throw new ProviderError(context, 'RATE_LIMIT', `the service asked us to pause; wait at least ${wait} seconds before retrying`, { status: 429, httpStatus, retryAfterSeconds: wait });
  }
  if ([401, 403].includes(httpStatus)) throw new ProviderError(context, 'ACCESS_DENIED', 'the service refused access; check the configured provider or network policy before retrying', { httpStatus, retryAfterSeconds: retry, actionRequired: true });
  if (httpStatus >= 500) throw new ProviderError(context, 'UPSTREAM', retry ? `the service is temporarily unavailable; wait at least ${retry} seconds` : 'the service is temporarily unavailable', { httpStatus, retryAfterSeconds: retry, transient: !retry });
  throw new ProviderError(context, 'HTTP', 'the service rejected this request', { httpStatus, status: 502 });
}

export async function readJson(response, max = 3 * 1024 * 1024, context = {}) {
  await checkStatus(response, context);
  if (Number(response.headers.get('content-length')) > max) {
    await cancelBody(response);
    throw new ProviderError(context, 'TOO_LARGE', 'the response was too large; try a more precise pin', { status: 502 });
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError(context, 'EMPTY', 'the response was empty', { status: 502, transient: true });
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) { await reader.cancel(); throw new ProviderError(context, 'TOO_LARGE', 'the response was too large; try a more precise pin', { status: 502 }); }
      chunks.push(value);
    }
  } catch (error) { throw transportError(error, context); }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ProviderError(context, 'INVALID_JSON', 'the service returned an error page instead of usable map data', { status: 502, transient: true }); }
}
