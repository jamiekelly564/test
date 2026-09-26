# Build status: PropertyChecked 0.2.0

Local-development source delivery; not a public production deployment.

## Implemented in the update

- Complete postcode, supported Maps-link and UK-coordinate input flow with explicit external-data consent.
- Allowlisted short-link redirects, postcode geolocation, Overpass outline/part normalisation, source map/list selection and provenance.
- Rotatable exterior geometry, concave footprints, multipolygon courtyards, mapped part heights, bounded user overrides and estimate highlighting.
- Optional GPT-6 server adapter with structured-output validation; requests missing-height suggestions only.
- SQLite persistence and non-destructive v2 schema addition, idempotent model saves, source and model export, GLB and GeoJSON downloads.
- Existing Marketfield geometry, tasks, documents, notes and survey configuration retained.
- No new third-party runtime dependencies.

## Test results

- `npm run check`: all application/support/test JavaScript syntax and required private-data exclusions checked.
- `npm test`: 52 tests passed: the existing 27 plus 25 auto-model tests.
- Real local HTTP API tests cover consent, sessions, CSRF, input validation, cached source selection, persistence across restart, save retry/conflict handling and exports.
- Geometry tests cover concavity, courtyard area preservation, multipolygon joining, mapped parts, invalid polygons, provenance and GLB headers/attributes.
- Provider/AI tests use mocked network responses to check request schemas, redirect safety, unsupported inputs, limits, errors and secret handling.
- Offline browser tests exercised the production front-end modules with synthetic data: search, selection, rotation (pixel output changes), override, save/reopen, estimate highlighting, top view, no-data messaging, desktop and 390px mobile layout. No console errors or horizontal mobile overflow were observed. Software 3D compatibility rendering was exercised.

## Limits of that testing

Provider-host DNS/network access was unavailable in the build container. No real postcode/Maps/Overpass round trip or paid GPT request was made. The browser blocks localhost navigation by administrator policy; it was not bypassed. Browser tests instead used in-memory documents/API fixtures, separate from actual local HTTP API tests. This is not a full live browser-to-server-to-provider test.

WebGL hardware output, actual Windows startup, physical iPhone/Safari performance, live OpenAI account access/billing, GitHub push and remote CI still require testing outside this environment. The starter has not been published as a website.

## Account / repository status

The connected GitHub account still exposes `firechecked_app` and `firechecked_portal`; `propertychecked-platform` was not listed. Available connector operations are read-only. Neither existing repository was changed. The delivered ZIPs are local code updates, not claims of remote commits. The optional publishing helper remains a user-run operation with its own confirmation.

## Current boundaries

This is an approximate exterior-creation MVP. Detailed roof/facade/interior reconstruction, full address/UPRN selection, terrain, customer accounts, payments, entitlements, real survey booking, contractor communication and production hosting are not live. A saved survey request stays on the PC. No geometry or task update becomes an inspection pass.

Private runtime records, environment secrets and build-time test fixtures are not bundled. Full installation includes the unchanged private Marketfield model pack. The update-only ZIP excludes private assets and runtime data.
