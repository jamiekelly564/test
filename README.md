# PropertyChecked 0.8.1

Local building-management workspace with instant estimated 3D previews and a separate evidence-based reconstruction workflow. Models are interactive geometry, not generated pictures. They are not surveys or automated fire-safety assessments.

## Update and open

Stop the running server with Ctrl+C. In the existing project folder, run these commands separately:

```sh
npm run backup
git pull --ff-only
npm run dev
```

Stop on a Git error instead of resetting local work. Use the existing Node installation (minimum 22.16). No new runtime dependency installation is required. Keep `.data`, `.env`, `private-assets` and backups. Open **http://localhost:3000/start** in a browser, not PowerShell. Run one server per port and keep its terminal open.

Windows users can subsequently double-click **Start-PropertyChecked.cmd** inside this folder. It starts the same local app from the correct directory. It does not update Git, alter keys or stop another server.

## Instant estimated preview

Enter the building name and postcode. A generic estimated exterior appears immediately; the operator-configured AI can then research public descriptions and reusable photo candidates to refine it. Missing plans or a failed API call do not remove the last usable model. A starting shape is not proof that the real building has been found.

v0.7 adds a model-focused responsive interface, searchable saved estimates, clear source/status labels, section-by-section live corrections, persistent one-step manual undo, connection recovery and expanded camera controls. Export saved GLB geometry or a labelled PNG of the current view. See [UX improvements and validation](docs/UX-IMPROVEMENTS.md).

No manual adjustment or page refresh starts a paid AI request. Additional refinement is explicitly confirmed. The existing research allowance remains bounded, with no automatic paid retry. The app does not include a high-resolution satellite subscription or scrape Google Maps imagery. Details: [Instant previews](docs/INSTANT-PREVIEWS.md).

## Photo-informed exterior research

v0.8.1 adds actual web image results and passes retrieved photographs to both appearance checks, with visible photo-use counts and original source links. The independently mapped outline remains intact. This is not Google Images scraping, photographic textures or a guarantee of building identity. Existing saved previews need an explicit new research pass. See [Photo research and validation](docs/PHOTO-RESEARCH.md).

## Evidence, operations and the original model

`/build` retains authorised batch document registration, approved imports, AI drawing interpretation, floor assembly, review and workspace activation. `/studio` retains calibrated tracing and graph editing. `/operations` retains the internal automatic-request review queue. See [Building workflow](docs/BUILD-WORKFLOW.md), [Evidence Studio](docs/EVIDENCE-STUDIO.md) and [Automatic model requests](docs/AUTOMATIC-MODELS.md).

The Marketfield private model, documents, tasks, notes, history, backups and local unsent Bronze/Silver/Gold survey requests are retained. Estimated preview components never become verified inspected assets. Survey links do not take payments or make bookings.

## Operator setup and privacy

AI uses the operator's private `.env` configuration. Existing `OPENAI_API_KEY`, `OPENAI_PREVIEW_MODEL` and reconstruction model settings are reused; restart after editing them. Never paste a key into chat or commit it. Configuration presence is not proof of account access, credit or reconstruction accuracy. The browser never receives the key. No paid call runs on server startup or installation.

Keep client plans, models and `.data` out of Git. The private Marketfield pack remains at `private-assets/marketfield` and is copied separately when moving PCs. Work only in this repository; FireChecked app/portal repositories are separate.

## Local development boundary

Customer-style and staff-style screens share one authorised local-owner workspace; they are not production tenants or roles. No public hosting, production authentication, subscription enforcement or payment service is configured. Do not expose this server to the internet. For trusted Wi-Fi testing, `npm run dev:lan` prints the PC address and access code; use that address on a phone, not localhost. Physical device acceptance testing is still necessary.

Factual reconstruction depends on available evidence. A planning proposal does not establish the built condition, public visibility is not a commercial reuse licence, and valid model JSON is not surveying accuracy certification. Read [Architecture](docs/ARCHITECTURE.md) and [Security](docs/SECURITY.md).

## Checks

```sh
npm run check
npm test
npm run backup
```

Tests use synthetic evidence and mocked external providers with real local HTTP and SQLite tests. GitHub CI runs the complete suite on Node 22 and Node 24. Live paid AI, actual building similarity, phone hardware and Windows launcher behaviour remain separate acceptance tests.
