import { randomBytes, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { HttpError } from './validation.mjs';

export function createSecurity({ lan = false, accessCode }) {
  const sessions = new Map(), failures = new Map();
  const code = accessCode || randomBytes(12).toString('base64url');
  const allowedHosts = new Set(['localhost','127.0.0.1','[::1]']);
  if (lan) for (const addresses of Object.values(networkInterfaces())) for (const a of addresses || []) if (!a.internal && a.family === 'IPv4') allowedHosts.add(a.address);
  function checkHost(req) {
    let host; try { host = new URL(`http://${req.headers.host || ''}`).hostname; } catch { throw new HttpError(403,'Invalid local host.'); }
    if (!allowedHosts.has(host)) throw new HttpError(403,'This preview only accepts its local PC or LAN address.');
  }
  function origin(req) {
    if (req.headers.origin !== `http://${req.headers.host}`) throw new HttpError(403,'Cross-site requests are not permitted.');
  }
  function get(req) {
    const cookies = String(req.headers.cookie || '').split(';').map(s=>s.trim());
    const id = cookies.find(c=>c.startsWith('pc_session='))?.slice(11);
    const session = id && sessions.get(id);
    if (!session || session.expires < Date.now()) { if(id) sessions.delete(id); return null; }
    return session;
  }
  function mint(res) {
    // Session data is kept in memory. Restarting the server logs LAN users out.
    for(const [id,s] of sessions) if(s.expires<Date.now()) sessions.delete(id);
    if(sessions.size>1000) throw new HttpError(429,'Too many local sessions. Restart the preview.');
    const id=randomBytes(32).toString('hex');
    const session={csrf:randomBytes(24).toString('hex'),expires:Date.now()+12*60*60*1000};
    sessions.set(id,session);
    res.setHeader('Set-Cookie',`pc_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
    return session;
  }
  function authenticate(req,res,supplied) {
    origin(req);
    const ip=req.socket.remoteAddress || 'unknown', now=Date.now();
    for(const [key,attempt] of failures) if(attempt.until<now) failures.delete(key);
    const entry=failures.get(ip) || {count:0,until:now+10*60*1000};
    if(entry.count>=5) throw new HttpError(429,'Too many attempts. Wait ten minutes.');
    const a=Buffer.from(String(supplied||'')), b=Buffer.from(code);
    if(a.length!==b.length || !timingSafeEqual(a,b)){entry.count++;failures.set(ip,entry);throw new HttpError(401,'Access code not recognised. Use the code in your PC terminal.');}
    failures.delete(ip);return mint(res);
  }
  function requireSession(req,mutation=false) {
    const s=get(req);if(!s)throw new HttpError(401,'Open the workspace and sign in before continuing.');
    if(mutation){origin(req);if(req.headers['x-csrf-token']!==s.csrf)throw new HttpError(403,'Session token invalid. Refresh this page.');}
    return s;
  }
  function session(req,res){let s=get(req);if(!s&&!lan)s=mint(res);return{authenticated:!!s,csrf:s?.csrf,mode:lan?'trusted-lan':'local-pc'};}
  return { code,allowedHosts,checkHost,origin,requireSession,session,authenticate };
}
