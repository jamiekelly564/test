# Building workflow - v0.4.0

This release connects authorised building evidence to the main property workspace. It is a local development workflow, not a production service or a guaranteed postcode-only reconstruction of every UK building.

## Update and start

In the terminal running PropertyChecked, press Ctrl+C. In the existing repository folder run `npm run backup`, then `git pull --ff-only`. Stop on a Git error rather than resetting local work. Start with `npm run dev`. Open `http://localhost:3000/build` in the browser, or choose **Build from plans** in the sidebar. No new folder or dependency installation is needed. Keep the private model pack, .data, .env and backups.

## One-time AI setup

Run `npm run setup:ai` in the local VS Code terminal while the app is stopped. The key input is hidden. The wizard checks the configured OpenAI model entry, then saves the key and reconstruction model in .env, preserving other settings. Never paste a real key into chat, GitHub or a source file. Existing .env settings continue to work.

The app also has **Check OpenAI access**. It calls the model metadata endpoint only after consent. Success proves the configured account can access that entry; it does not verify billing, vision quality, web-search support or a reconstruction job. No document is sent during this check. Later search and reconstruction jobs are explicitly approved and can incur API charges. A ChatGPT subscription does not configure API credentials on your PC.

## Connected workflow

1. Select a saved building or create a named address/postcode record. An optional postcode/Maps location lookup is separate from footprint retrieval and never contacts Overpass. A postcode centroid or shared pin is a location reference, not proof of the exact property.
2. Optionally search for cited planning references. Open and check candidates. Search does not guarantee coverage, retrieve every council record, or establish rights. Login/CAPTCHA/prohibited access is not bypassed.
3. Add evidence. Batch-select up to 20 local PDFs/PNGs/JPEGs; assign role, revision and floor per file, and a common drawing scenario and rights basis. Files are uploaded/registered sequentially and remain private on the PC. This is not an AI request. The 25 MB upload limit is per file. Do not mix revisions or existing/proposed schemes indiscriminately.
4. A public direct PDF/image URL can be imported after separately confirming building identity, reuse permission and external retrieval. This is one explicitly selected file, not a planning-site crawler. The importer checks robots rules, pins validated public DNS addresses for TLS requests, bounds size/time, identifies the app honestly, and refuses private addresses, credentials, unsupported files, access denials and cross-host redirects. There is no mirror rotation or retry on refusal. Sites requiring a normal authenticated download need a user-authorised local upload instead. Public visibility and permissive robots rules do not establish commercial reuse rights.
5. Select up to six authorised sources / 16 MB total and approve AI analysis. This uses the existing v0.3 graph interpreter and validation. PDFs are sent whole; page cropping/selection is not implemented. Start with clear dimensioned drawings. Photos can inform visible material colours, not unseen rooms or safety findings. Unknown scale yields no metric geometry.
6. Review the real 3D draft using floor, cutaway, explode, component and source controls. Source previews use private same-origin routes; browser PDF support varies and original downloads remain available. Review all unknowns, conflicts, alignment and dimensions. JSON/schema validity does not establish reconstruction accuracy.
7. To combine separately processed floors, select 2-12 drafts and explicitly enter/confirm XY/Z offsets in metres and rotation in degrees against shared drawing anchors. This does not automatically align unrelated plans. Duplicate floor labels or mixed schemes are rejected instead of silently duplicated. Existing elevations are retained and Z is an additional offset. The combined graph is a new unreviewed draft with source provenance. The existing 20-floor / 600-component / vertex bounds still apply.
8. Mark a draft reviewed against the evidence, then **Use model in property workspace**. Review is not a site survey. Only a reviewed, nonempty, validated draft can be selected. Source hashes are checked before a new selection; concurrent changes return a conflict instead of silently overwriting another tab. The building's normal 3D tab now opens the selected evidence geometry. The previous model remains in a collapsible section and can be restored without deleting either model, documents, tasks or notes.

## Persistence and exports

Sources, jobs and draft graphs remain in SQLite; the additional evidence_active table points to the selected working draft. It does not overwrite the legacy building model_key. Source documents stay in .data/uploads. Existing backups include the new tables and files. Main building record exports include selected evidence graph/source metadata, not document bytes or API keys. GLB and JSON downloads remain available in the model panel. Evidence components are not silently inserted as verified inspected assets into the legacy locations table.

Imports and saves use request references and content hashes. Repeating an acknowledged import does not fetch or register it again. A request with the same reference and different details is rejected. One remote import runs at a time, at most twelve per hour. External AI jobs retain the existing cancellation, idempotency and restart handling. Cancellation may not reverse provider charges already incurred. Do not start a second job just because a tab reloads; check the persisted job first.

## What is still not automatic or production-ready

No nationwide guaranteed planning inventory, automatic rights acquisition, council login/CAPTCHA handling, autonomous choice of the correct built revision, image-to-photoreal mesh, automatic floor registration, detailed services inference or surveying accuracy certification. No new tenant accounts, production hosting, live payments or subscription enforcement. Public footprint access failures remain respected. The old Overpass workflow is not a dependency of this drawing-based route and is not silently re-enabled after refusal.

A real API key and account access are necessary for live AI work. No paid OpenAI request or live council-document import was made during this build. Browser/device, data availability and real-drawing interpretation need acceptance testing before client use. Keep this preview on loopback or a trusted LAN; do not expose it publicly.

## Validation

28 new offline unit and real local HTTP tests cover URL/address validation, policy checking, refused responses, file import/deduplication, permissions/CSRF, metadata access checks, .env preservation, floor assembly, model selection/review/restore, source tampering and record exports. The new tests plus the original 52-test local starter baseline pass (80 total locally). GitHub CI runs these with the current repository's additional evidence/provider regression suites.

Offline Chromium UI tests used real UI modules and actual rendered geometry with synthetic plans and mocked API responses: file upload/registration, source selection, job completion, floor/cutaway/component controls, review, workspace activation and mobile layout. No JavaScript errors or mobile-width overflow were observed. Browser-to-localhost navigation was blocked by this environment; local HTTP endpoints were tested separately in Node. This was not a physical iPhone or live AI accuracy test.
