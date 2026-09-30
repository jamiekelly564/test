# Marketfield display foundation

This change repairs the display/interaction layer over the recovered Marketfield model. It does not replace the source drawings, rewrite the original PLAN, publish private geometry, or populate real inspection findings.

## Implemented

- One shared display scene and one RAG icon implementation replace the second appended icon/camera controller. Icon paths, status precedence and camera helpers are shared rather than duplicated.
- Runtime anchors consistently use `[x,height,z]`. An equipment issue marker uses that equipment mesh's anchor and one floor offset. Unplaced equipment does not get a floating marker at an unrelated room label.
- The display mesh removes exact duplicate and zero-area faces while preserving source/estimate metadata and original exports. The recovered model test removed 684 duplicate faces and eight degenerate faces from 83,688 input triangles. This is mesh hygiene, not a new architectural survey or complete retrace.
- Equipment placement requires an appropriate existing named space, a usable solid floor region, physical footprint clearance, and wall backing for wall-mounted devices. Door/window openings and source voids are excluded. Symbols are nominal size by default. A missing electrical cupboard, lift machine room or parking area is not invented. The recovered model test positioned 105 symbols; 43 remain unplaced with reasons. Shared unresolved regions remain explicitly schematic.
- Equipment buffers rebuild only when the object catalogue or symbol size changes, not when a status, floor or camera changes. Source-region compilation is cached. Stationary hover does not repeatedly raycast or rebuild outlines. The renderer stops redrawing an unchanged scene; normal camera/pointer work resumes on change.
- Walls and equipment retain their full heights. The old vertex-collapse clipping control is hidden in the embedded workspace. Selecting a floor removes other storeys instead of flattening triangles into a horizontal plane.
- **Model display** provides Solid exterior, Transparent exterior, Hide exterior, an opacity control, and Private residence interiors. Transparent shells use blending and an opaque depth pass; they do not block interior picking. The software renderer follows the same visibility policy. Shared floor slabs, communal doors and boundary walls are retained. This is a visual filter, not resident-data access control.
- Existing red/yellow/green demonstration workflow, eye-level/aerial navigation, same-origin messaging, private routes, versioned updates and real evidence-acceptance workflows are retained. RAG counts are no longer incorrectly computed from only the selected colour.

## Drawing accuracy remains distinct

The recovered plan trace is an approximate manual interpretation. This update does not claim that every room, wall or floor has been redrawn accurately from the supplied sheets. Upper-first sheets BR07/BR08 and other previously recorded missing coverage remain estimated. In particular, some lower-ground named areas share an unresolved outline; devices stay near the appropriate area label without creating a fictional separating partition. Compare drawing and the original source/estimate notes remain available. Physical installation positions still need a site survey or authoritative equipment drawings.

## Verification

The complete current repository passed `npm run check` and 627 Node tests locally, including all earlier tests and new RAG/foundation tests. The old test requiring equipment to shrink below a 1.05 m clipping plane was replaced by a full-height invariance test because that behavior was explicitly removed. Strict placement fixtures now supply valid rooms and wall dimensions; absent room outlines are rejected instead of receiving fallback equipment.

The real recovered private model was loaded into offline Chromium. Checks covered all ten floor selections, exterior transparency, private-interior filtering, issue anchors, explicit green simulation state, eye-level focus, and returning to the original renderer arrays. Original PLAN content remained unchanged. Repeated floor and status changes created zero additional equipment builds. At rest, render and pick counters remained unchanged over a 1.5-second interval. Visible icon centres agreed with the renderer projection within 0.001 CSS pixel in the checked view. These are controlled regression measurements, not a promised frame rate on another device.

A separate offline DOM harness exercised the shipped frontend's opacity/private-interior controls and 1500/850/390/320 px reflow without observed JavaScript errors or horizontal overflow. It used simulated API/iframe transport. Node HTTP/session/CSRF integration tests ran independently. Agent-browser is unavailable; Chromium navigation to localhost is blocked by administrative policy and was not bypassed. Rendering exercised the software fallback; native WebGL is covered by controller/shader-contract tests, not a hardware GPU acceptance run. Physical Windows/iPhone and live full-app end-to-end acceptance remain unverified.

GitHub CI must pass on Node 22 and 24 before merge. No paid inference, reminders, sensors, external map request, deployment or private-file upload is part of this update.

## Local update

Stop the existing server with Ctrl+C. In the actual project on this PC, run separately:

```powershell
cd "C:\Users\jamie\Downloads\PropertyChecked-Auto-Models-Full\propertychecked-platform"
npm.cmd run backup
git pull --ff-only
npm.cmd run dev
```

Open `http://localhost:3000/marketfield?demo=1` and hard-refresh. No updater download or replacement private-model pack is required for an already restored installation. Do not delete `.data`, `.env`, private-assets or backups. Model display controls are also available in the normal `/marketfield` workspace.
