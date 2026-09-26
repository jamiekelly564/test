# PropertyChecked 0.4.0

Local building-management and evidence-to-3D workspace. Real interactive geometry, source records and explicit estimates; not generated pictures or an automated safety assessment.

## Start or update on your PC

Open this repository folder in VS Code. Use Node.js 24 LTS (minimum 22.16). No runtime dependency installation is required.

For an existing checkout, stop the running server with Ctrl+C first:

```sh
npm run backup
git pull --ff-only
npm run dev
```

Stop and review any Git conflict rather than resetting your records or edits. Keep `.data`, `.env`, `private-assets` and backups. Open **http://localhost:3000** in a browser, not in PowerShell. Run only one server per port.

## Build from plans

Choose **Build from plans** or open **http://localhost:3000/build**.

The connected workflow is **confirm building -> find references -> add authorised evidence -> generate draft -> review -> use in the building workspace**. Planning-reference search and drawing interpretation are optional OpenAI API requests. Local uploads, geometry review, explicit floor assembly, export and model selection run on your PC.

- Batch-upload PDF/PNG/JPEG evidence and record roles, floors, revisions, drawing status and reuse permission.
- Import an approved public direct drawing/photo link with public-address validation, bounded retrieval and policy checks. No login, CAPTCHA or access-block bypass.
- Select up to six sources / 16 MB for each explicitly approved AI job. The response becomes a bounded, validated editable graph, not executable code.
- Explore floor/cutaway/exploded views and click components for sources and document previews.
- Combine separately processed floors using explicitly confirmed metric offsets/rotations. Shared drawing anchors must be checked; the software does not guess alignment.
- Review and select a working evidence model in the normal property dashboard. The previous model and all records remain available; restore is reversible.
- Download actual GLB/JSON geometry and source metadata.

Detailed instructions, safety boundaries and test limitations: **[Building workflow](docs/BUILD-WORKFLOW.md)**. The advanced `/studio` tracing/JSON workspace is retained; [v0.3 Evidence Studio](docs/EVIDENCE-STUDIO.md) documents its controls.

## Connect AI privately

```sh
npm run setup:ai
```

The local terminal wizard hides the API key, checks model-entry access and preserves other .env settings. Restart the server after setup. The browser receives configuration status only, not the key. Existing OPENAI_API_KEY and OPENAI_RECONSTRUCTION_MODEL settings continue to work.

Model-entry access is not proof of available credit or reconstruction accuracy. Search and reconstruction are separately approved API calls; no paid call runs merely because the app starts. No real key is included. Do not paste credentials into chat or GitHub. No paid live AI request was made during development tests.

## Existing functionality preserved

Marketfield Court's private plan-based/estimated model and its controls remain unchanged. Buildings, source documents, notes, tasks, history, backups, Bronze/Silver/Gold survey configuration and local unsent survey requests are retained. Drawing reviews and closed tasks do not create inspection passes. Evidence-model components are not automatically treated as site-verified assets.

The older **Create 3D model** workflow uses postcode/pin resolution and a configured footprint provider for coarse exterior geometry. Shared public Overpass may refuse this application. Access denials are not bypassed; see [406 diagnostics](docs/LOOKUP-406.md). The new drawing route does not depend on Overpass. Saved models reopen without contacting a footprint provider.

## Boundaries

This is a single local-owner development workspace built with browser ES modules, native Node HTTP and SQLite, not yet the future production Next.js/PostgreSQL deployment. It is not a guaranteed address-only UK planning crawler or an accurate as-built reconstruction without source review. Publicly viewable plans/photos do not automatically carry commercial reuse rights. Unknown or conflicting dimensions and revisions need human review.

There is no production tenant authentication, subscription enforcement, payments, contractor messaging, cloud deployment, automatic services inspection or safety certification. AI can misread drawings even when the graph validates. Do not expose this local server to the public internet. No remote provider, private client file or paid API job is needed for the automated tests.

## Private files and GitHub

Work only in this separate repository. `firechecked_app` and `firechecked_portal` are not part of it. Never commit real .env files, uploaded drawings, private models, .data or backups. The private Marketfield pack stays in `private-assets/marketfield` and must be copied separately onto a new computer. This code repository does not contain the client model pack.

## Trusted-Wi-Fi preview

```sh
npm run dev:lan
```

Use the PC address printed in the terminal on the phone, not localhost. Enter the startup access code. Keep the PC running. This is HTTP on a trusted private network, not public hosting. Physical iPhone testing is still required.

## Checks

```sh
npm run check
npm test
npm run backup
```

Tests use synthetic evidence and mocked external services; real local HTTP API tests are included. GitHub CI runs Node 22 and 24. See [v0.4 validation and limitations](docs/BUILD-WORKFLOW.md#validation), [Architecture](docs/ARCHITECTURE.md) and [Security](docs/SECURITY.md).
