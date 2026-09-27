# Open map-derived building estimates - v0.8.0

## Customer journey

The two fields remain building name and postcode. Clicking Create immediately saves the original illustrative starting shape, then automatically attempts an independent open-data outline and optional scan-height check. No plan upload, customer API key, source picker or approval gate is added. Existing previews do not automatically start new research after an update: open one and deliberately use Run another research pass.

This is not Google 3D Tiles extraction. Google's standard Map Tiles policies prohibit machine interpretation and objects otherwise derived from its photorealistic tiles, not merely exact tracing. This implementation does not fetch Google or Bing rendered map tiles. It uses Microsoft's independently released open building dataset and optional Environment Agency numeric elevation rasters.

## Sources and geometry

Postcodes.io resolves the UK postcode to a centroid. This is an area reference, not a building-name match.

Microsoft Global ML Building Footprints supplies GeoJSON polygons and, where available, estimated heights in metres. The pinned index release is 2026-07-24 at bfppub.blob.core.windows.net. The current index also publishes regional files at bfppub.z5.web.core.windows.net; only those two exact Microsoft hosts are allowed. They are treated as one provider for refusal/rate-limit handling, not rotating fallback mirrors. Index quadkeys are normalised to nine digits. Regional gzipped files contain GeoJSON lines even when their extension is .csv.gz. Invalid or missing heights remain unknown.

For a supported English footprint, the Environment Agency 2022 composite DSM and DTM WCS endpoints are queried for a small numeric GeoTIFF window. Approximate height is surface minus terrain inside the outline. No colour-map screenshot is analysed. Missing/unsupported coverage, insufficient valid pixels and excessive height variation cannot become a made-up scan result. Substantial scan/map height disagreement is recorded rather than averaged silently. The live test below did not yield a usable LiDAR height.

A usable Microsoft outline is retained when LiDAR or AI fails. The source polygon becomes the floor and roof footprint, retaining concavities and courtyards instead of replacing them with rectangular boxes. One editable envelope represents the selected feature, not all its neighbours. Heights inform the total envelope; storey divisions, facade material, window placement, balconies and roof style remain illustrative. Pitched roofs are estimated envelopes clipped to the footprint, not observed roof planes.

The existing bounded AI pipeline can refine appearance but cannot erase the source polygon or add unrelated rectangular wings. Editing, undo, cutaway, isolated floors, camera fitting and GLB export remain. Manual controls can transform the envelope, not fabricate its source dataset. Source links, release, retrieval time, height basis, scan notes and licence text accompany the model. Primary drawing-based models and inspected-asset records are untouched.

## Matching and accuracy limits

This release selects the nearest supported structure to the postcode centroid, prioritising containment. Microsoft data has no building-name field used here. The name informs separate appearance research but does not verify the chosen outline. Several blocks at the same postcode can therefore select the same building or a neighbour. The interface labels this Map-based estimate / unconfirmed match. Exact-address selection remains future work.

Supported UK Polygon/MultiPolygon features fit within 120 by 100 metres and 64 retained vertices, with 1-25 estimated storeys. Unsupported shapes retain the previous estimate. No interior layout, photorealistic textured mesh, condition assessment or fire-safety conclusion is created from these data.

Environment Agency composites are historic, not live scans. Trees, annexes, roof shape, survey dates and approximate alignment can contaminate heights. WGS84 to OSGB36 uses a Helmert approximation, not OSTN15. Only bounded single-band classic GeoTIFF encodings are decoded; other encodings safely retain the existing height estimate.

## Live source check: 27 September 2026

An isolated GitHub Actions diagnostic ran the actual provider against Queensgate / RH1 1RT. Source-check run 36338023944, job 108672519253, completed successfully. It returned 215 supported nearby footprints and automatically selected an outline containing the postcode centroid, with a Microsoft dataset height estimate of 9.729179382324219 metres. Retrieval took about ten seconds on that runner, not a promised PC performance target.

This proves the live postcode/index/regional-data path returned usable source geometry. It does NOT prove the selected outline is Queensgate. No manual building-identity comparison was performed, and no model was saved or paid OpenAI request made by the diagnostic. The optional numeric LiDAR check returned unavailable/unsupported; no LiDAR-derived height is claimed. Diagnostic PR #8 was closed without merging its one-off workflow.

That live check exposed two issues missed by synthetic tests: the additional official static host and a 113.4 MB compressed regional file. Both were addressed before release. The provider now streams compressed input and discards unrelated features without holding the full decompressed region in memory. It supports at most 192 MB input per file / 256 MB per lookup, 2 GB decoded streaming work and four million feature lines; oversized or interrupted responses retain the previous model. A cold regional lookup may take minutes on a slower PC or connection. Cached postcode results avoid repeat downloads.

## Network, costs and persistence

Map requests occur only after explicit creation or refinement, not startup, GET requests or page reloads. They do not use OpenAI tokens. Optional appearance research retains the existing operator-funded AI budget.

Native Node code uses fixed public hosts, no credentials or redirects, honest application identification, size/feature/time limits and no mirror switching. Access refusals stop requests to that provider for the process; 429 pauses honour bounded Retry-After. Existing previews remain usable.

Location, index and selected geometry are cached for up to 30 days in the additive map_data_cache SQLite table. Cache entries are bounded; raw regional files are not committed or stored as project sources. Backups include new metadata. Optional .env settings MAP_DATA_ENABLED=false and MAP_LIDAR_ENABLED=false disable the map route or scan-height step. No new key or runtime dependency is required.

## Updating and diagnostics

Stop the running server with Ctrl+C. In the existing propertychecked-platform folder run each command separately: npm run backup, git pull --ff-only, npm run dev. Open http://localhost:3000/start in the browser. The Windows launcher remains compatible. Keep .env, .data, private-assets and backups.

A one-off diagnostic is available: npm run check:map -- "Queensgate" "RH1 1RT". It contacts public datasets, reports safe source/height status, spends no AI credit and saves no model. Do not repeatedly run it after refusal. An optional workflow_dispatch diagnostic is available for deliberate operator use; it is not scheduled and is separate from offline unit tests.

## Validation

The original 43 new map tests cover URL policy, CSV/quadkeys, GeoJSON, polygon/courtyard preservation, height bounds, TIFF decoding, DSM-DTM subtraction, coordinate conversion, WCS requests, provider pauses, caching, fallback retention, sessions/CSRF, exports, undo and late-result protection. Nine additional streaming tests cover the published host, split gzip headers, already-decompressed responses, byte and line bounds, incomplete input, cancellation and live-format large-file metadata.

GitHub CI runs the actual complete repository on Node 22 and Node 24, including the unchanged paid-research adapter with mocked network responses. The earlier local harness ran the 43 map tests alongside 52 mounted starter tests; it substituted that adapter only in the local test harness. No such substitution is committed to the production repository.

Browser localhost navigation was blocked by administrator policy and agent-browser was unavailable. Offline Chromium geometry checks used actual model functions and equivalent current viewer code with synthetic courtyard geometry. Roofs, cutaways, upper-floor isolation and a 390px viewport were exercised without observed JavaScript errors or horizontal overflow. This was not a complete live customer UI or physical iPhone test.

Live source retrieval succeeded as documented above; exact building identity, real model similarity and live paid AI refinement remain unverified. This is a local-owner development application, not a publicly deployed multi-tenant portal.

## Primary references

Google policies: https://developers.google.com/maps/documentation/tile/policies
Microsoft dataset/index: https://github.com/microsoft/GlobalMLBuildingFootprints
Microsoft data licence: https://cdla.dev/permissive-2-0/
EA DSM: https://environment.data.gov.uk/dataset/9ba4d5ac-d596-445a-9056-dae3ddec0178
EA DTM: https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc
