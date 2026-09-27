# Open map-derived building estimates - v0.8.0

## Customer journey

The two fields remain building name and postcode. Clicking Create immediately saves the original illustrative starting shape, then automatically attempts an independent open-data outline and optional scan-height check. No plan upload, customer API key, source picker or approval gate is added. Existing previews do not automatically start new research after an update: open one and deliberately use Run another research pass.

This is not Google 3D Tiles extraction. Google's standard Map Tiles policies prohibit machine interpretation and objects otherwise derived from its photorealistic tiles, not merely exact tracing. This implementation does not fetch Google or Bing rendered map tiles. It uses Microsoft's independently released open building dataset and optional Environment Agency numeric elevation rasters.

## Sources and geometry

Postcodes.io resolves the UK postcode to a centroid. This is an area reference, not a building-name match.

Microsoft Global ML Building Footprints supplies GeoJSON polygons and, where available, estimated heights in metres. The pinned index release is 2026-07-24 at bfppub.blob.core.windows.net. Index quadkeys are normalised to nine digits. Regional gzipped files contain GeoJSON lines even when their extension is .csv.gz. Invalid or missing heights are unknown, not silently used.

For a supported English footprint, the Environment Agency 2022 composite DSM and DTM WCS endpoints are queried for a small numeric GeoTIFF window. Approximate building height is surface minus terrain inside the outline. No colour-map screenshot is analysed. Missing/unsupported coverage, insufficient valid pixels and excessive height variation cannot become a made-up scan result. Substantial scan/map height disagreement is recorded rather than averaged silently.

A usable Microsoft outline is retained when LiDAR or AI fails. The source polygon becomes the floor and roof footprint, retaining concavities and courtyards instead of replacing them with rectangular boxes. One editable envelope represents the selected feature, not all its neighbours. Heights inform the total envelope; storey divisions, facade material, window placement, balconies and roof style remain illustrative. Pitched roof geometry is an estimated envelope clipped to the footprint, not observed roof planes.

The existing bounded AI pipeline can refine appearance but cannot erase the source polygon or add unrelated rectangular wings. Editing, undo, cutaway, isolated floors, camera fitting and GLB export remain. Manual controls can transform the envelope, not fabricate its source dataset. Source links, release, retrieval time, height basis, scan notes and licence text accompany the model. Primary drawing-based models and inspected-asset records are untouched.

## Matching and accuracy limits

This release selects the nearest supported structure to the postcode centroid, prioritising containment. Microsoft data has no building-name field used here. The name informs separate appearance research but does not verify the chosen outline. Several blocks at the same postcode can therefore select the same building or a neighbour. The interface labels this Map-based estimate / unconfirmed match. Exact-address selection remains future work.

Supported UK Polygon/MultiPolygon features fit within 120 by 100 metres and 64 retained vertices, with 1-25 estimated storeys. Unsupported shapes retain the previous estimate. The first regional download may be sizeable and slower than a cached lookup. This is not a full-country data download on installation.

Environment Agency composites are historic, not live scans. Trees, annexes, roofs, source-date differences and approximate alignment can contaminate heights. WGS84 to OSGB36 uses a Helmert approximation, not OSTN15. Only bounded single-band classic GeoTIFF encodings are decoded; other encodings safely retain the existing height estimate. No interior layout, textured photogrammetric mesh, condition assessment or fire-safety conclusion is created from these data.

## Network, costs and persistence

Map requests occur only after explicit creation or refinement, not startup, GET requests or page reloads. They do not use OpenAI tokens. Optional appearance research retains the existing operator-funded AI budget.

Native Node code uses fixed public hosts, no credentials or redirects, honest application identification, size/feature/time limits and no mirror switching. Access refusals stop requests to that provider for the process; 429 pauses honour bounded Retry-After. Existing previews remain usable.

Location, index and selected geometry are cached for up to 30 days in the additive map_data_cache SQLite table. Cache entries are bounded; raw regional files are not committed or stored as project sources. Backups include new metadata. Optional .env settings MAP_DATA_ENABLED=false and MAP_LIDAR_ENABLED=false disable the map route or scan-height step. No new key or runtime dependency is required.

## Updating and diagnostics

Stop the running server with Ctrl+C. In the existing propertychecked-platform folder run each command separately: npm run backup, git pull --ff-only, npm run dev. Open http://localhost:3000/start in the browser. The Windows launcher remains compatible. Keep .env, .data, private-assets and backups.

A one-off diagnostic is available: npm run check:map -- "Queensgate" "RH1 1RT". It contacts the public datasets, reports source/height status, spends no AI credit and saves no model. Do not repeatedly run it after refusal. An optional manually dispatched GitHub workflow performs the same check without secrets; it is not scheduled and is separate from offline unit tests.

## Validation

43 new offline unit and real local HTTP/SQLite tests cover URL policy, CSV/quadkeys, compressed GeoJSON, polygon/courtyard preservation, height bounds, TIFF decoding, DSM-DTM subtraction, coordinate conversion, WCS requests, provider pauses, caching, fallback retention, sessions/CSRF, exports, undo and late-result protection. The prior local harness passed these alongside 52 mounted starter tests (95 total). Its unchanged paid-research adapter was replaced only inside that local harness. GitHub CI runs the actual complete repository with the real unchanged adapter and all earlier regression tests before merging.

Browser localhost navigation was blocked by administrator policy and agent-browser was unavailable. Offline Chromium geometry checks used actual model functions and equivalent current viewer code with synthetic courtyard geometry. Roofs, cutaways, upper-floor isolation and a 390px viewport were exercised without observed JavaScript errors or horizontal overflow. This was not the complete live customer UI or physical iPhone testing.

Live regional data and numeric LiDAR coverage were not verified by the offline tests. Public source metadata and licences were researched; provider responses in unit tests are synthetic. A successful offline suite is not proof of Queensgate's correct identity or scan availability. Consult any separately recorded live-check outcome rather than assuming a real property was reconstructed. No paid OpenAI request was made during development. This remains a local-owner development application, not a production multi-tenant portal.

## Primary references

Google policies: https://developers.google.com/maps/documentation/tile/policies
Microsoft dataset/index: https://github.com/microsoft/GlobalMLBuildingFootprints
Microsoft data licence: https://cdla.dev/permissive-2-0/
EA DSM: https://environment.data.gov.uk/dataset/9ba4d5ac-d596-445a-9056-dae3ddec0178
EA DTM: https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc
