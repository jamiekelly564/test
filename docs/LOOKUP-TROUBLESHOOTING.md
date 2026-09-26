# Public-data lookup recovery - 0.2.1

## What the reported error established

In 0.2.0, readJson converted unsuccessful HTTP responses other than 429 into
"The public data service is unavailable". It discarded the provider and status,
so the screenshot alone cannot distinguish an outage, rejected query, proxy
error or access denial. There was one Overpass endpoint and no fallback.
The exact response received on the user's Windows PC has not been observed.

## Changes

- Keep overpass-api.de as the default primary. Make at most one sequential
  request to overpass.private.coffee on eligible temporary server/network
  failure, invalid JSON or an incomplete-query response. No parallel retries.
- Preserve source geometry, attribution and empty-result semantics. Discard
  incomplete results; do not merge them into a guessed model.
- Increase the request deadline from 22 to 35 seconds to accommodate a queue
  wait and the existing 15-second query. Both requests remain bounded.
- Do not switch providers to bypass access denials, client errors, rate limits
  or Retry-After. Rate limits enforce a minimum 30-second pause. Failed
  endpoints cool down for 60 seconds. Existing search limits and caching remain.
- Identify Maps-link resolution, postcode lookup and building-outline lookup
  separately. DNS, TLS, network, timeout and HTTP errors have safe codes.
- Show Lookup details below the error and log the same diagnostic in the PC
  terminal. Exclude complete URLs, user input, response bodies and keys.
- Leave private model files, database records and geometry unchanged.
  No additional runtime dependency is required.

A custom OVERPASS_API_URL disables implicit public fallback. Its optional
backup must be explicitly set in private .env as OVERPASS_FALLBACK_URL.
Use OVERPASS_FALLBACK_URL=none to disable the default backup. Never commit
real provider keys, including keys embedded in a custom endpoint path.

## Updating through GitHub

In the existing project terminal, stop the development server with Ctrl+C:

```powershell
git pull --ff-only
npm run dev
```

Refresh the browser with Ctrl+F5. The terminal and sidebar should show 0.2.1.
No npm install or replacement of .data, private-assets or .env is needed.
If Git reports local changes or divergence, stop and review them; do not reset
or force-push. Publication must be verified against the actual GitHub branch.

## When a lookup still fails

Expand Lookup details and note stage, provider, code and HTTP status. The
message gives a relevant next action. A postcode/pin can skip failed Maps
link expansion; it cannot bypass a failed footprint service. Respect any wait
period. Do not disable HTTPS certificate checks or network policies.

For an explicit terminal test that contacts the public services without
saving a building:

```powershell
npm run check:data -- "YOUR POSTCODE OR GOOGLE MAPS LINK"
```

This script does not run automatically at startup, in tests or in CI.
Public providers have no availability guarantee. A private or contracted
service and appropriate data licences are needed for a production launch.

## Verification and limits

All 80 unit/local-HTTP tests pass in Node 22.16. The 28 added cases cover
fallback, sequential requests, cooldowns, Retry-After, status classification,
stream failures, partial queries, size limits, custom endpoints and safe API
diagnostics. Existing geometry, consent, CSRF and persistence tests pass.
Desktop/mobile component checks use offline synthetic responses; they are not
physical iPhone or Windows end-to-end tests. External DNS and browser
localhost navigation were unavailable in the build environment. The original
Google Maps link still needs to be retested on the user's PC.

## Operator references checked 2026-09-26

- Queue and resource policy:
  https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- HTTP response documentation:
  https://dev.overpass-api.de/command_line.html
- Backup service, fair-use terms and privacy:
  https://overpass.private.coffee/

This is a local development recovery patch, not a production availability SLA.
