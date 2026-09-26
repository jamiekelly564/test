# Evidence Studio - v0.3.0

A separate, working path from authorised evidence to reviewable geometry. It does not call Overpass and does not replace the existing Marketfield model.

## Open it

Stop the app with Ctrl+C. From the existing project folder, run `git pull --ff-only` and then `npm run dev`. In the browser refresh with Ctrl+F5 and select **Build from plans** in the sidebar. The direct local route is `/studio`.

No new installation is required. Use the same Node version as the current app. Continue keeping `.data`, `.env`, private-assets and backups out of Git. The new source register, jobs and draft graphs are stored in the existing local SQLite database. Uploaded files use the existing private upload directory, so the existing backup command includes them.

## Working workflow

1. Select an existing building or create a named address/postcode record. Confirm the actual building before any external job. A postcode alone is not a unique building identity.
2. Optional **Find planning references with AI**: provide the exact address and optionally the council planning hostname. The server uses OpenAI web search with a bounded number of calls. It saves a short summary and citation links only. This is an index search, not a nationwide planning-register crawler. It may return no suitable results. It does not download plans, access private council records or circumvent CAPTCHAs.
3. Add PDFs, PNGs or JPEGs you are authorised to use. Existing building documents can be registered without reuploading. Record the source URL, revision/date, floor label, role, proposed/existing status and reuse basis. A permission-pending source is stored but excluded from reconstruction. The declarations are user statements, not automatic licence validation.
4. Select up to six authorised sources, with a combined size up to 16 MB. Choose one drawing scenario and explicitly approve sending the selected file bytes to OpenAI. Start with one clearly dimensioned floor plan. PDFs are sent whole; this version has no PDF page selector. Existing and proposed geometries are not mixed; photographs can inform material hints but not hidden floor geometry.
5. AI returns a bounded building graph. Server-side validation checks coordinates, polygons/voids, references to selected sources, unique IDs, heights and complexity. Invalid, incomplete or refused output fails without publishing partial geometry. Unknown scale yields an empty draft with unknowns, not an invented model.
6. Inspect the real 3D draft: rotate, zoom, isolate floors, shorten walls for a cutaway, separate floors and click components for source/page/revision details. Download actual GLB geometry or the JSON graph/provenance. The graph editor validates and saves a separate revision. Drawing review is a separate status and never a site verification or safety assessment.

## Connect AI privately on the PC

Open `.env` beside package.json, preserving existing settings. Add your own API key (never paste it into chat, a browser file or Git):

```dotenv
OPENAI_API_KEY=your_own_key
OPENAI_RECONSTRUCTION_MODEL=gpt-6-astra
```

Restart the server and refresh the page. The UI reports whether a key is present; this is not a live verification of account access, credit or model permissions. Both search and reconstruction use this configurable model. API access and charges are separate from ChatGPT. Responses requests set `store: false`, which is not a promise of zero provider retention; your OpenAI account's data terms still apply. No paid request runs automatically on startup.

The fixed server-side endpoint is `https://api.openai.com/v1/responses`. Structured Outputs constrain the graph shape; semantic and geometric checks run independently. PDFs are sent as input_file data; images as input_image. No browser API key, arbitrary code execution or third-party image-generation request is involved.

## Local fallback without a key

Expand **Trace a calibrated floor locally**. Select an authorised PNG/JPEG plan, load it, mark the ends of a known dimension and enter that length in metres. Then click the outline corners. Enter the level elevation, height and wall thickness, and save. This creates a floor slab and simple perimeter walls, with those user-supplied heights/thicknesses marked as assumptions. It does not infer inside walls, cut openings, stair geometry or fire-safety assets. For PDFs, export a clear page crop to an image using your normal PDF software.

The first outline point is the local XY origin. Separate traced floor drafts do not automatically align or merge: that requires common reference points and editing the graph or a subsequent AI interpretation. The JSON editor is an advanced tool, not a visual CAD editor.

## Jobs and safe recovery

Jobs are persisted with request-key idempotency. Duplicate requests with the same reference do not resubmit paid calls. Only one AI job runs at a time in the local workspace; a local limit of five jobs per ten minutes applies. Cancellation stops the local request and prevents saving a late result but may not cancel charges already incurred. A server restart marks running jobs interrupted; it does not automatically retry them. Review the job status before submitting a new paid request.

Every new draft snapshots source metadata and file hashes. File hashes are checked before transmission. Graphs cannot reference documents belonging to another building. Sources are immutable in this version; upload/register a new revision instead of altering an old record. Rights revocation workflows, malware scanning and full tenant isolation remain future work; do not deploy this local preview publicly.

## Accuracy and scope

This is an evidence-assisted prototype, not a validated automated surveying product. Planning-search coverage is not guaranteed. Drawings can be outdated, proposed, incomplete or illegible. AI can misread dimension strings, openings, floor alignment or revision history even when JSON validates. Review all dimensions and source pages. Geometric validation is not an accuracy certification.

Supported components are extruded slabs, walls, door/window volumes, balcony/roof envelopes and schematic stair/lift envelopes. Roofs are not reconstructed as detailed pitched surfaces. Finishes are indicative material colours; no photo textures, unseen plumbing, furnishings, inferred defects, fire ratings or compliance scores are added. Appearance is not survey evidence. Main workspace models and inspection records remain unchanged; evidence drafts are opened in Evidence Studio rather than replacing their primary model.

## Tests and limitations

- 23 new offline unit/real local HTTP tests cover permissions, source ownership, geometry, export, draft review, cancellation, restart, idempotency, AI request structure and failed output handling.
- Local regression run: 52 pre-existing tests plus the new suite. The remote repository's additional provider-recovery tests are retained unchanged and run in GitHub CI.
- Offline Chromium UI checks use a synthetic plan and mock API responses: source form, calibration, real geometry, 3D picking, review state and responsive layout. Browser-to-localhost navigation was blocked by the build environment; real HTTP endpoint tests ran separately in Node.
- No paid live OpenAI request, live council search or physical iPhone test was performed in the build environment. The API adapter is implemented, not claimed live-verified.

## Official implementation references

- OpenAI file inputs: https://developers.openai.com/api/docs/guides/file-inputs
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI web search and citations/domain filters: https://developers.openai.com/api/docs/guides/tools-web-search
- Model capabilities: https://developers.openai.com/api/docs/models/gpt-6-astra

## Files

`apps/api/evidence/{router,store,ai}.mjs`; `packages/evidence/{graph,viewer}.mjs`; `apps/web/public/studio.{html,css,js}`. A small workspace-entry module adds the companion workspace link after the existing shell mounts. The original app/viewer and its data-source access-refusal handling are not replaced.
