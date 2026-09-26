# Security boundary

This is a local development starter, not a production-ready public portal. Do not expose the server, model routes or database to the internet.

## Included safeguards

- Loopback-only default binding and local-host allowlist.
- Separate, explicit trusted-LAN mode with an unpredictable startup access code, memory-only sessions and login attempt limits.
- HttpOnly / SameSite=Strict session cookies, mutation CSRF tokens and exact same-origin checks.
- Prepared SQLite statements, bounded JSON requests, upload size/type/signature checks and generated storage names.
- Documents served as attachments; no arbitrary uploaded HTML execution.
- Private assets outside the public directory; all model/document reads require a session.
- No production auto-deployment, purchases or secret collection.
- CSP and other response headers. The trusted legacy viewer needs inline-script permission; the main app does not.
- Concurrency checks and request idempotency to reduce accidental duplicate operations.
- Git exclusions for model plans, runtime records, backups and secrets.

## Automatic-model provider boundary

- Public postcode/footprint lookups require explicit UI consent and server-side consent validation. AI is separate opt-in.
- No arbitrary URL fetch endpoint. Google sharing links require HTTPS, approved hosts/paths, no credentials/ports, and every redirect is checked. Page bodies/imagery are not scraped.
- External requests have timeouts, redirect/byte/complexity limits, a one-search concurrency limit and local per-minute limits. The owner may configure a trusted HTTPS Overpass service only through the private server environment.
- Source selection IDs and overrides must match a server-cached search. Models are triangulated and complexity-checked before being saved. Retry keys reject changed payloads.
- Provider text is escaped in the UI. Original tags are bounded and treated as untrusted by the AI prompt. AI output is schema-checked and independently validated; it is never executed as code.
- OPENAI_API_KEY stays on the server and is not returned in configuration responses or written to the model database. Provider errors omit raw response bodies and credentials.
- Raw plans/resident records are not part of these provider requests. Public postcode coordinates and building identifiers are still external disclosures; the UI describes them.

## Remaining limitations

A LAN session grants access to the whole local workspace. HTTP is not encrypted. Any person/process already authorised on the PC may be able to read its local database or files. The local events table is not append-only/tamper-evident evidence. Uploads are signature-checked, not malware-scanned. There is no production tenant isolation, user identity lifecycle, TLS termination, entitlement service, recovery policy, monitoring, vulnerability review or external penetration test. Browser administrative restrictions prevented a full live-browser end-to-end run in the build environment; a physical iPhone was not tested.

The backend guard that rejects NODE_ENV=production is a warning mechanism, not a replacement for access control. Removing it does not make public deployment safe.

## Before a public client pilot

Implement organisation/tenant membership, authenticated sessions and secure cookies, permissions for every record/object, private object storage with short-lived authorised delivery, rate limits, validated upload processing/malware controls, backups/restoration, TLS, audit requirements, privacy/retention settings and a tested payment/entitlement boundary. Scope all surveys explicitly. Do not infer fire ratings, pass/fail outcomes or operational defects from a drawing or guessed model geometry.

Keep raw plans and model geometry out of public repositories and public preview deployments. A private GitHub repository does not by itself make an attached public website private.
