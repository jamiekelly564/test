# HTTP 406: access refusal, not a normal rate limit (v0.2.2)

## What the reported error establishes

The lookup reached the footprint stage at overpass-api.de and received HTTP 406. Location resolution had already succeeded. No footprint was returned and no model was generated.

The v0.2.1 classifier incorrectly grouped 406 with HTTP 429 and invented a minimum 30-second wait when no Retry-After header was supplied. This is corrected.

The overpass-api.de operator documents 406 as a manually blocked client/access response, whereas Overpass's ordinary rate limiter uses 429. The status alone does not establish whether rejection concerned an IP, an application identifier, provider policy or an intermediary. It is not evidence that this user made too many requests.

The request already supplies an identifying PropertyChecked User-Agent and project contact URL. Impersonating a browser or another program, rotating mirrors, disabling TLS verification or repeatedly retrying is not an appropriate fix.

## Behaviour of this patch

- A footprint HTTP 406 from overpass-api.de or its subdomains is ACCESS_DENIED.
- A 406 from other services is NOT_ACCEPTABLE, without guessing its cause.
- These errors require action, are not transient, and do not trigger failover.
- A real Retry-After is preserved; an absent header no longer becomes 30 seconds.
- After a footprint access/request refusal, subsequent footprint calls are suppressed for that provider instance (the current server session). This also covers 401/403 and a refusal from a backup following a genuine primary outage.
- Restart only after resolving provider access/configuration; restarting is not an unblocking method. This in-memory guard is not a persistent account policy.
- Existing 429 backoff, timeout recovery, byte limits, consent, secret redaction, CSRF checks, geometry, provenance and private data are unchanged.

## What actually restores automatic generation

Use a building-data source that authorises the intended workload. Either obtain operator approval for the configured service, use a contracted/self-hosted Overpass service, or build an independent local footprint dataset from a permitted open-data distribution. This patch does not grant external access, create a provider account or integrate a new data source.

An authorised HTTPS Overpass interpreter can already be configured with OVERPASS_API_URL in the local, Git-ignored .env file. No public backup is silently added to a custom endpoint. Only use a URL issued by the chosen operator; do not paste credentials in chat, Git or browser-side code. Restart after configuration changes. See .env.example and LOOKUP-TROUBLESHOOTING.md.

A future open-data route could use Overture's buildings distribution, retaining source attribution, release date and geometry provenance. Overture provides GeoJSON area downloads and cloud-hosted GeoParquet. That pipeline is not part of v0.2.2 and should not be presented in the UI as connected.

## Updating the local code

Stop the running server using Ctrl+C, then use:

    git pull --ff-only
    npm run dev

Refresh the browser with Ctrl+F5. The version should read 0.2.2. There is no need to reinstall Node, replace the project folder, or delete the local database.

## Validation

89 tests pass locally. Tests are offline or use a loopback HTTP server and synthetic data. Coverage includes classification, actual request headers, HTTP API responses, no invented Retry-After, and suppression after refusal. No denied provider was repeatedly probed. Upstream access and physical-device behaviour are not established by these tests.

## Primary references, checked 2026-09-26

- Operator on HTTP 406 versus 429: https://community.openstreetmap.org/t/overpass-api-performance-issues/140598/100
- Overpass rate-limiting and usage documentation: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- Overture data access (future route, not an implemented provider): https://docs.overturemaps.org/getting-data/
