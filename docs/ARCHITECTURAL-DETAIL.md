# Architectural detail - PropertyChecked v0.10.0

## Exterior upgrade

The photo-first journey remains: name and postcode, find or upload photographs, confirm, then build. The existing two visual passes now return a bounded architecture object rather than reducing every photograph to a finish and window-column count. The exact selected image pixels are still used. No additional paid pass, imagery provider or Google Maps extraction was introduced.

New models can represent different facade sections and floor ranges; wall, frame and accent colours; procedural brick or cladding finishes; recessed casement, sash, picture, ribbon or bay windows; window proportions and pane divisions; projecting/Juliet balconies with rails; entrances, handles and canopies; parapets; and optional chimneys, rooflights, dormers and rooftop plant. Distinctive features are requested only where supported by photographs. Unknown elevations remain estimated, not automatic copies of the front. Supplied source-photo IDs are validated against the actual visual inputs.

These are real geometric components. Window and door rectangles are removed from the wall strips, not pasted over an uninterrupted box. The independent mapped polygon and courtyard holes remain intact. A local edge table helps the AI assign facade profiles, but photo-to-edge orientation is not verified. Proportions, materials, heights and unseen details remain estimates, not a survey or safety assessment.

Roof geometry remains a simplified envelope. Roof features outside the available roof or over a courtyard are omitted. A mapped source still uses one height envelope; stepped heights within a single mapped footprint are not reconstructed by this release.

## Rendering and controls

Detailed, Balanced and Simple modes control the current view. Large models reduce small features; a reached part budget falls back to a complete simple envelope instead of leaving an incomplete building. Selecting one floor can expose more detail. The camera fits the projected building bounds rather than leaving excessive empty space.

The preview-specific WebGL shader adds procedural brick/cladding/wood patterns and approximate glass/metal highlights. These are not copied source photographs. The software compatibility renderer shows the detailed geometry and colours without shader-only patterns. GLB exports retain the detailed geometry, colours, source metadata and separate surface/glazing/metal PBR materials. Tiny shader patterns are not baked into exported textures. Glazing is opaque tinted geometry, not optically accurate transparent glass.

Adjust includes window style, width, height, spacing, panes, surface treatment and wall/frame/roof colours. Controls apply to the chosen building section. Unchanged basic fields no longer overwrite photo-specific facade colours. Saving a manual correction removes photo-observation claims from altered detail. Existing optimistic concurrency, undo and protection against late AI results remain.

Older saved models remain compatible but do not contain the new historical detail observations. Open Add floor plans or photos and explicitly rebuild using exterior photos to obtain the new structured detail. Updating or reopening the app never starts a paid job.

## Richer interior examples

Interior example offers Residential, Workspace and Open-space presets, larger/medium/smaller spaces, dollhouse or full-height partitions and optional furnishings. Examples have doorway gaps, schematic door leaves, dividers and furniture such as sofas, beds, tables, desks/monitors and cabinets. The matching 2D diagram shows partitions, schematic door swings and furniture footprints.

All these arrangements are fictional design examples, NOT interiors recovered from exterior photographs. They remain labelled ILLUSTRATIVE LAYOUT - INVENTED, NOT AN ACTUAL FLOOR PLAN. They do not assert actual occupancy, room use, stairs, lifts, fire doors or escape routes. They are not written to inspection/evidence records or silently added to the ordinary exterior GLB. Furniture and partitions are fitted/clipped to supported floor regions, including courtyard exclusions.

Uploading real plans still hides the invented examples. It does not automatically convert a PDF into verified rooms. The advanced drawing workflow remains available for source-based processing and review. No manual facade adjustment or interior-example control uses AI credit.

## Update and preservation

Stop the running server with Ctrl+C. In the existing project directory run separately, stopping on any error:

```powershell
npm run backup
git pull --ff-only
npm run dev
```

Open http://localhost:3000/start in the browser and hard-refresh. Rebuild an existing model through Add floor plans or photos using the correct exterior photographs. No new API key, package installation or replacement folder is required. The original Marketfield model, drawings, registered assets, notes, tasks, surveys, backups and private settings are retained. This remains a local-owner development application, not a public tenant-isolated portal.

## Validation and limitations

The full local repository passed 366 tests on Node 22.16.0: 333 existing tests plus 33 architectural/detail/interior tests. Syntax and private-data checks also passed. New tests cover schema limits, source claims, actual openings, mapped courtyards, roof exclusions, mesh/material/GLB content, display modes, prepared visual payloads, edits, API persistence and undo. The complete suite must also pass on GitHub Node 22 and Node 24 before merging.

The agent-browser CLI was unavailable. Chromium navigation to localhost was blocked by administrator policy; that restriction was not bypassed. Offline Chromium checks exercised the actual application modules with synthetic building data and mocked API/history responses: exterior/interior modes, furnishings and wall switches, facade editing/save/undo, and 320/390/768/1500px layouts. No JavaScript errors or horizontal page overflow were observed. These screenshots are synthetic demonstrations, not Foundation House or another real property.

This Chromium environment used the software renderer. The new WebGL material path requires real-browser/device acceptance testing. No paid live AI reconstruction, real-building likeness, measured interior reconstruction, physical iPhone/Windows acceptance or public deployment is claimed. The richer renderer makes more features representable; a wrong or missing photograph can still produce a poor match.

Primary structured-output API reference: https://developers.openai.com/api/docs/guides/structured-outputs
