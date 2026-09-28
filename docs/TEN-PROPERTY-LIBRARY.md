# Ten-property plan library / collection 01

## Open it

At the existing local server, open `/examples/`. The original postcode/AI workspace at `/start` is unchanged. No new runtime package or API key is required. The static demo can also be copied as a standalone folder and opened from `index.html`; browser-local file storage support varies, and a visible warning is shown when it is unavailable.

This is a portfolio of ten distinct public plan sources, with one selected-floor study for each. It is not ten complete surveyed buildings, an automatic plan-conversion service, or a set of current UK apartment-block drawings. It intentionally spans England, Australia and the USA to demonstrate different available layouts.

| Property | Modelled scope |
|---|---|
| Edith Farnsworth House | House and terraces from the HABS plan sheet |
| House at Radlett | Ground floor, historical 1907 drawing |
| Beverley Hills Apartments | One apartment, number 8/61; not the whole block |
| Simon House | Courtyard and principal floor arrangement |
| Walsh Street House | First floor from the Boyd House II drawing |
| McCraith House | First-level living floor; lower level and roof omitted |
| Schmidt-Lademann House | Ground floor; source is a reconstructed sketch |
| Cambridge Cottage | Major spaces from the historical ground-floor drawing |
| Belton House | Source-author's explicitly unscaled illustrative sketch |
| York / Lancaster House | Early 1827 scheme; not the finished/current layout |

## What is real and what is approximate

The original online drawings were actually downloaded and reviewed, not fabricated or substituted with generated plans. Major boundaries, spaces and a subset of openings were manually traced from the displayed source. Most presentation scale, all heights/finishes, wall thickness and minor details are assumed or simplified. Farnsworth's platform scale uses the marked 23.57 m dimension, but remains an approximate trace. The original source, selected scope and limitations are always available under Drawing/Compare.

Source drawings have their own limitations: Belton explicitly is an unscaled sketch; York House is an early scheme changed during construction. Source room names/letters are retained where practical; they do not establish current occupancy or building condition. These models are not appropriate for fire-safety decisions, measurements, construction or pricing remedial works.

## Included interactions

- Search/filter ten properties, open a study, orbit/zoom, top view, low or full-height walls.
- Select a schematic space in the 3D view or 2D trace, compare with the actual plan preview, and follow the original full-resolution source link.
- Export real self-contained GLB triangle geometry with source credit, licence, scope and assumption metadata. Source images are not copied onto the model as textures.
- Twelve tracking capability categories, empty initially. Add browser-local demo tasks with location, owner, due date, notes and status. Export CSV; formula-like values are escaped. Nothing sends email or asserts a compliance pass.
- Start/stop a per-property hands-on timer by stage; it pauses when the tab is hidden or another building opens. Export raw sessions and view a portfolio summary. No historical hours or production promises are invented.

Records and time logs are isolated in localStorage under `propertychecked-plan-library-01`. They do not become records in `.data/workspace.sqlite`, are not synchronised between browsers, and should be exported before clearing browser storage. The site performs no runtime network search, paid inference, upload, payment or sensor request.

## Sources and licences

Full credits, original links, licence links, retrieval date, source SHA-256 and changes are in `apps/web/public/examples/sources.json` and `SOURCES.md`. The sources are public-domain or CC BY-SA. Corresponding model adaptations retain CC BY-SA 3.0/4.0; models derived from public-domain plans are CC0. Licences remain per source/model, not a blanket claim over unrelated software.

`scripts/prepare-example-plans.py` is an explicit developer-only import of the ten hash-pinned source images. It is not run on app startup, installation or the ordinary offline test suite. Images are committed locally as WebP previews; no source-site runtime availability is required. The temporary source collection/publication workflow is removed before merge.

## Validation

All 400 Node tests pass locally on Node 22.16.0 (382 earlier tests plus 18 plan-library tests). Syntax/private-data checks pass. New tests cover ten unique sources, geometry and triangle normals, nonmutating display/export, courtyard area, projection picking, GLB provenance, preview signatures, static allowlisting/MIME, no inference and actual HTTP serving with bad-host checks.

Offline Chromium exercises the real application and geometry with actual source preview bytes, not mock building models. Browser-local storage is simulated only in that offline test harness. Search/filter, all ten source-image views, 2D selection, tracking add/status, timer, export, and 320/390/768/1440px reflow are checked. The environment has no agent-browser CLI, and browser URL navigation is blocked by administrator policy; that restriction was not removed. HTTP serving is tested independently in Node. This is not physical iPhone testing or a live browser-to-server test.

The traces have been visually compared with source previews but not independently surveyed or dimensionally certified. This work is not an empirical measurement of complete building-production labour. Existing Marketfield geometry and private evidence remain untouched. The repo's full Node 22/24 checks must pass before merging this addition.
