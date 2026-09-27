# PropertyChecked 0.5.0

Local building-management workspace with a **building name + postcode** customer journey, automatic processing of approved evidence, and a staff review queue. Models contain actual interactive geometry, not generated pictures or inferred safety assessments.

## Start or update

Open this repository folder in VS Code. Use the existing Node.js installation (minimum 22.16). No new runtime dependencies are required.

Stop the running server with Ctrl+C, then run these commands separately:

```sh
npm run backup
git pull --ff-only
npm run dev
```

Stop on a Git error instead of resetting files. Keep `.data`, `.env`, `private-assets` and backups. Open `http://localhost:3000/start` in the **browser**, not PowerShell. Run only one server per port.

## Customer journey

Enter the building name and postcode, then choose **Create my 3D building**. Processing automatically reuses an existing matched model, generates an exterior from an approved footprint, or collects and interprets authorised drawings. The customer sees real progress and a ready preview, an exterior-only preview, or a clear PropertyChecked review status. Ambiguous records require a building choice; technical source selection and batching belong to staff.

Requests, progress and models are saved. Refreshing does not resubmit paid work. Supported results include floor selection, cutaway/exploded views, source notes and GLB export. Survey links open the existing Bronze/Silver/Gold scope flow; no payment or booking is made.

**National data coverage is not included.** A new property without approved geometry may still require staff to obtain drawings or licensed footprints. The software does not turn search citations into reuse permission, infer an as-built design from a planning proposal, or show invented interiors as fact. See [Automatic building requests](docs/AUTOMATIC-MODELS.md).

## Staff workflow

Open `http://localhost:3000/operations` for requests needing source acquisition, identity checks, conflict resolution or drawing quality review. Install centrally approved property-source packs, open the drawing workspace and explicitly resume processing after correcting the issue. The queue is local; no email alert or background monitoring service is configured.

The existing `/build` workflow remains available for batch document registration, approved direct-file imports, evidence review, explicit floor alignment and primary workspace model activation. `/studio` retains calibrated tracing and graph editing. Read [Building workflow](docs/BUILD-WORKFLOW.md) and [Evidence Studio](docs/EVIDENCE-STUDIO.md).

Automatic drawing results are unreviewed previews. They are not automatically marked site verified or silently substituted for the original primary model. Staff review and activation remain explicit.

## Operator AI configuration

AI credentials belong to the operator's private `.env`, never to a customer form or browser script. Existing `OPENAI_API_KEY` and `OPENAI_RECONSTRUCTION_MODEL` settings are reused. Restart after changing configuration. Configuration presence is not proof of account access, billing credit or reconstruction accuracy.

Creating an automatic request approves its bounded processing; later searches and interpretations may incur usage on the operator API account. No paid call runs merely because the server starts. Existing models, local approved footprint extrusion and manual review/tracing can work without an AI key. Never paste real credentials into chat or GitHub.

## Existing data is preserved

Marketfield Court's private plan-based/estimated model and controls are unchanged. Building records, documents, notes, tasks, history, backups and local unsent survey requests are retained. Drawing review and closed tasks do not create inspection passes. Private files remain excluded from Git.

The old public-footprint provider controls remain in the repository for compatible saved models. The new customer workflow never calls Overpass for geometry or bypasses its refusal. See [406 diagnostics](docs/LOOKUP-406.md).

## Development-only boundary

The customer-style and staff-style screens share the existing authorised **local-owner** session. They are not separate production roles or tenant boundaries. There is no production customer authentication, subscription enforcement, live payment processing or public deployment. Do not expose this local server to the internet. See [Security](docs/SECURITY.md).

This app uses browser ES modules, native Node HTTP and SQLite. A future production deployment needs authenticated organisations, per-record permissions, private object storage and appropriate data/processing licences. AI output validation is not surveying accuracy certification.

## Private files and GitHub

Work only in this repository; `firechecked_app` and `firechecked_portal` are separate. Never commit real `.env`, uploads, private models, `.data` or backups. Keep the Marketfield pack at `private-assets/marketfield` and copy it separately when moving PCs. This repository contains code and synthetic tests, not the client's building pack.

For trusted-Wi-Fi testing, `npm run dev:lan` prints the PC address and access code. Use that address on the phone, not its localhost. Keep the PC running. This is local HTTP, not internet hosting; physical iPhone testing remains necessary.

## Checks

```sh
npm run check
npm test
npm run backup
```

Tests exercise real local HTTP/SQLite and geometry using synthetic evidence and mocked external services. GitHub CI runs Node 22 and 24. Paid live AI, council document retrieval, arbitrary-building coverage and physical-device accuracy are not claimed by those tests. Implementation details and limitations are in [Automatic building requests](docs/AUTOMATIC-MODELS.md), [Architecture](docs/ARCHITECTURE.md) and [Security](docs/SECURITY.md).
