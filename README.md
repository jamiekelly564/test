# PropertyChecked 0.10.0

Local building-management workspace with photo-first 3D estimates and a separate evidence-based reconstruction workflow. Models are interactive geometry, not generated pictures. They are not surveys or automated fire-safety assessments.

## Architectural detail

v0.10 adds per-elevation photo-informed window, facade, entrance and roof geometry, editable architectural colours and proportions, and richer explicitly fictional furnished interior examples. Existing models need an explicit photo-based rebuild to acquire detailed observations. See [Architectural detail and validation](docs/ARCHITECTURAL-DETAIL.md).

## Update and open

Stop the running server with Ctrl+C. In the existing project folder, run these commands separately:

```sh
npm run backup
git pull --ff-only
npm run dev
```

Stop on a Git error instead of resetting local work. Use the existing Node installation (minimum 22.16). No new runtime dependency installation is required. Keep `.data`, `.env`, `private-assets` and backups. Open **http://localhost:3000/start** in a browser, not PowerShell. Run one server per port and keep its terminal open.

Windows users can subsequently double-click **Start-PropertyChecked.cmd** inside this folder. It starts the same local app from the correct directory. It does not update Git, alter keys or stop another server.

## Photo-first creation

Enter the building name and postcode. A loading bar shows the online photo search. Check the returned photo and choose **Yes, create my building** or **No, I'll add a photo**. Missing photos lead to a simple upload area, not another technical source-management form. You may explicitly continue without a photo, but the resulting exterior remains an estimate.

`/build?building=...` now opens **Photos & floor plans**. Add photos with a file picker, drag-and-drop or supported camera picker; add real plans separately. Uploading alone does not invoke AI. Building from your selected photos explicitly supplies those image pixels to both visual passes. Original plan bytes are saved for later processing/review, not converted automatically into verified rooms.

The existing model page retains camera controls, source notes, searchable saved models, section corrections and one-step manual undo. **Example layout** adds explicitly invented floor zones/dividers until real plans are uploaded. It never creates inspected assets or claims an actual interior. See [Photo-first workflow and limits](docs/PHOTO-FIRST.md).

## Map and photo evidence

Independently reusable Microsoft footprints provide supported polygon outlines and available height estimates; optional Environment Agency numeric LiDAR checks may improve height. The postcode-selected footprint is not a verified building-name match. Missing data or failed interpretation preserves a usable estimate. See [Map-derived models](docs/MAP-DERIVED-MODELS.md).

Online appearance research uses actual web image results and supplies retrieved photographs as pixels, with original source links. This is not a direct Google Images connection, photographic texture transfer, Google Maps scan extraction or a guarantee of building identity. The facade renderer remains simplified. See [Photo research](docs/PHOTO-RESEARCH.md).

No manual adjustment or page refresh starts paid inference. New searches and confirmed builds use bounded operator-funded API calls; there is no automatic paid retry. Existing saved previews can be improved from **Add floor plans or photos** without deleting them.

## Evidence, operations and the original model

`/advanced-build` retains the previous authorised batch document registration, approved imports, AI drawing interpretation, floor assembly, review and workspace activation. `/studio` retains calibrated tracing and graph editing. `/operations` retains the internal automatic-request review queue. See [Building workflow](docs/BUILD-WORKFLOW.md), [Evidence Studio](docs/EVIDENCE-STUDIO.md) and [Automatic model requests](docs/AUTOMATIC-MODELS.md).

The Marketfield private model, documents, tasks, notes, history, backups and local unsent Bronze/Silver/Gold survey requests are retained. Estimated or invented components never become verified inspected assets. Survey links do not take payments or make bookings.

## Operator setup and privacy

AI uses the operator's private `.env` configuration. Existing `OPENAI_API_KEY`, `OPENAI_PREVIEW_MODEL` and reconstruction model settings are reused; restart after editing them. Never paste a key into chat or commit it. Configuration presence is not proof of account access, credit or reconstruction accuracy. The browser never receives the key. No paid call runs on server startup or installation.

Keep client plans, models and `.data` out of Git. The private Marketfield pack remains at `private-assets/marketfield` and is copied separately when moving PCs. Work only in this repository; FireChecked app/portal repositories are separate. Temporary candidate images are session-protected; their active expiry does not delete older database backups.

## Local development boundary

Customer-style and staff-style screens share one authorised local-owner workspace; they are not production tenants or roles. No public hosting, production authentication, subscription enforcement or payment service is configured. Do not expose this server to the internet. For trusted Wi-Fi testing, `npm run dev:lan` prints the PC address and access code; use that address on a phone, not localhost. Physical device acceptance testing is still necessary.

Factual reconstruction depends on available evidence. A planning proposal does not establish the built condition, public visibility is not a commercial reuse licence, and valid model JSON is not surveying accuracy certification. Invented layouts are explicitly hypothetical, not safety or occupancy plans. Read [Architecture](docs/ARCHITECTURE.md) and [Security](docs/SECURITY.md).

## Checks

```sh
npm run check
npm test
npm run backup
```

Tests use synthetic evidence and mocked external providers with real local HTTP and SQLite. GitHub CI runs the complete suite on Node 22 and Node 24. Live paid AI, actual building similarity, physical phone behaviour and Windows launcher behaviour remain separate acceptance tests.
