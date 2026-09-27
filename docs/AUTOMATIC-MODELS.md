# Automatic building requests - v0.5.0

## Customer journey

Open `/start`. Enter a building name and postcode, then choose **Create my 3D building**. The button explicitly authorises the configured processing and creates one persistent request. There is no customer file picker, API-key field, floor-batching form or separate planning-search button. Keep the local PC server running.

The server matches local records and operator-approved aliases, reuses an existing model, creates geometry from an approved licensed footprint, or interprets approved drawings automatically. An ambiguous match or a legacy record without a postcode asks the customer to confirm the intended property. A postcode alone is not treated as a unique building identity.

Actual stages are saved, not simulated percentage bars. Refreshing a page, repeating a click or using another request key for the same name/postcode does not submit a second paid job. Recent requests reopen saved results. Cancellation stops further processing; provider usage already incurred may still be billed. A server restart puts interrupted work into staff review instead of replaying paid calls.

Results are **Building preview ready**, **Exterior preview ready**, or **PropertyChecked review required**. No generic box or invented interior replaces unavailable evidence. A drawing preview remains explicitly unverified. Floor/component selection, cutaway/exploded views and actual GLB export are supported. Survey options link to the existing Bronze/Silver/Gold scope flow; no payment or appointment is made.

## Staff operations

Open `/operations`. Missing information, ambiguous matches, source conflicts, AI-configuration issues and completed automatic drawing previews enter the internal queue. Staff can inspect planning references, open the existing `/build` drawing workspace, approve a source pack, record a review note and explicitly resume processing. This is a local queue, not an email notification or a promise that someone is monitoring it.

A successful AI reconstruction is an **unreviewed preview** and is also queued for quality review. It is not silently promoted to a reviewed primary workspace model, an inspection pass or a site survey. Staff can use the existing review/activation workflow when appropriate. Existing Marketfield geometry and all documents, notes and tasks remain available.

**The customer-style and staff-style screens currently share one authorised local-owner session.** They are not separate production roles or tenant boundaries. Do not expose this development app publicly. Organisation authentication, private storage and per-record entitlements remain necessary before a client launch.

## What runs automatically

1. Existing local model reuse after the property match. Selected evidence sources are hash-checked.
2. Operator-approved GeoJSON footprint to actual local 3D geometry, with the dataset's own attribution and height assumptions. No Overpass request or AI key is needed for this path.
3. Exact approved public PDF/image URLs are collected from an operator catalogue through the bounded, policy-checked downloader. Each source is pinned to a SHA-256 hash; changed bytes stop before registration or AI interpretation. Login, CAPTCHA, access denials and robots restrictions are not bypassed.
4. Registered permission-checked drawings are deduplicated and grouped automatically. Existing/proposed/unknown schemes and conflicting revisions are not silently combined. Each AI call remains bounded to six sources / 16 MB; up to four floor groups fit a request. Oversized files or larger jobs go to staff rather than asking the customer to split them.
5. Separate groups can be rigidly aligned when a unique lift/stair pair has agreeing spacing, area and polygon geometry. No scale distortion or new elevation inference is used. Missing cores, repeated floors or conflicting elevations require staff review. Registration remains an estimate to check, not a survey measurement.
6. If no approved geometry is available and operator AI is configured, one bounded postcode/locality and planning-reference search runs. References are saved for staff, not presented as an accomplished reconstruction. Empty results become an explicit review item.
7. When a usable licensed exterior exists but detailed interpretation needs attention, the exterior is shown while the issue remains in the staff queue.

Server limits: one automatic request at a time, ten new requests per ten minutes, up to five AI calls per request lifetime, twelve automatic AI requests and twelve automatic imports per hour, and three explicit staff resumes. Existing manual workflow limits remain independent. These are request limits, not monetary spending caps; configure account usage controls separately.

## Data availability

**A nationwide approved drawing or footprint catalogue is not bundled or connected.** An arbitrary new building, including Queensgate, can still enter staff review when usable approved geometry is unavailable. Search citations alone do not establish the exact built revision, scale or commercial reuse permission. This release does not scrape every council drawing or derive owned geometry from Google imagery.

For automatic delivery without staff intervention on each new property, PropertyChecked must populate a centrally permission-checked catalogue or connect an appropriately licensed data source. This release implements that catalogue's importer and the orchestration, not national data coverage or rights acquisition. Existing approved source records can already be used without duplication.

## Approved property packs

Import one JSON file under 512 KB through **Staff workspace > Approved property catalogue**. The pack is stored in local SQLite, not Git. Confirm the exact property and reuse basis first. The minimum metadata is `name`, `postcode`, `identityConfirmed: true`, `rightsConfirmed: true`, `rightsNote`. Optional: `address`, `aliases` (at most ten), `allowProposed` (false by default). Replacing a pack requires its current `expectedVersion` to avoid overwriting a concurrent approval.

Supply one or more of:

- `sourceIds`: source-register IDs belonging to this property, not arbitrary document IDs.
- `remoteSources`: entries with `url`, `sha256`, `name`, `role`, `scenario`, `floorLabel`, `revision`. Only approved public direct files, not planning-index pages. Roles/scenarios match the evidence register. Verify the hash and reuse basis before approval.
- `footprint`: `geometry` (closed WGS84 longitude/latitude GeoJSON Polygon or MultiPolygon), `sourceUrl`, `attribution`, `licence`, `retrievedAt`, `heightM` or null, `storeys` or null. Preserve courtyard holes. Missing height uses a labelled estimate, not a claimed measurement.

No real-building footprint is invented as an example. Use licensed datasets or authorised survey material. Installing a source pack does not automatically restart an earlier paid job; review it and explicitly choose Resume.

## Update

Stop the existing server with Ctrl+C. In the same project folder run `npm run backup`, then `git pull --ff-only`. Stop on a Git error. Run `npm run dev` and open `http://localhost:3000/start` in the browser. No new ZIP, project folder or dependency installation is required. Keep `.env`, `.data`, private-assets and backups. API credentials remain the operator's responsibility, not a field in the customer form.

## Verification boundaries

New tests exercise actual SQLite, the real application HTTP/session/CSRF boundary, deterministic geometry and GLB, approved-source imports using synthetic bytes, mocked AI, source hashes, scenario/revision constraints, automatic grouping, alignment, review/resume/cancellation, deduplication and persistence. Existing provider/evidence regression suites run alongside these in GitHub CI.

Browser layout/geometry checks used actual modules in an offline page with synthetic API responses; browser navigation to local servers was blocked in the build environment. Separate Node tests exercise real local HTTP. No paid live AI request, council-document import, nationwide data-coverage check or physical iPhone test was performed. Passing tests is not a certification of real-drawing accuracy.
