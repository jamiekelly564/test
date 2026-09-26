# PropertyChecked 0.2.1

Local property-management workspace with **postcode / Maps link -> outline selection -> interactive 3D exterior -> saved building**.

## Start on your PC

Extract the project, open the folder containing `package.json` in VS Code, then use **Terminal > New Terminal**:

```sh
npm run dev
```

Open **http://localhost:3000**. Use Node.js 24 LTS (minimum 22.16). No `npm install`, API key, cloud database or payment account is required for the basic application. New automatic models need an internet connection for public location and footprint data; saved models reopen locally.

**Already running v0.1?** Read [Updating without losing your data](docs/UPDATING.md). Stop the server, back up, and copy only the update files into the existing project. Do not replace `.data`, `.env` or `private-assets`.

## Public-data recovery update (0.2.1)

A temporary failure of the default mapping service now permits one sequential backup request. Rate limits, access denials and Retry-After are not bypassed. The UI and terminal show the failed stage and a safe error code instead of the old generic message. Custom endpoints do not silently fall back to public ones. See [lookup troubleshooting](docs/LOOKUP-TROUBLESHOOTING.md).

## Automatic models

Open **Create 3D model** in the sidebar.

1. Enter a complete UK postcode, supported Google Maps sharing link, or latitude, longitude.
2. Approve the public-data lookup. The app identifies a search area and requests nearby mapped building outlines.
3. Select the correct outline on the plan or in the list. Up to six blocks can be selected. The nearest building is **not** automatically assumed to be yours.
4. Rotate/zoom the 3D exterior. Review sourced heights and labelled assumptions; optionally supply your own height/storey estimate.
5. Confirm and save. The model, provenance, original source outlines/tags and any AI suggestions are stored in the local database. Export a real GLB model or footprint GeoJSON.

This is **coarse exterior geometry**, not photoreal reconstruction. Mapped building parts create different heights where available; absent setbacks, windows, roof shapes, rooms and services are not invented. No source data means no substitute building.

### Optional GPT-6

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` privately on your PC. `OPENAI_MODEL` defaults to `gpt-6-astra`. Restart the server, then explicitly select the optional GPT checkbox before saving. API access/billing are separate from the local app. No key is shipped or requested in chat.

The adapter asks for **missing-height suggestions only**, from limited building-type/area tags. Suggestions remain estimates; AI does not overwrite mapped heights or create interiors, defects or compliance scores. The request path has been tested with simulated responses, not a paid live API call.

## Existing features retained

- Marketfield Court's existing plan-based and estimated interactive model, unchanged.
- Whole-building, individual-floor, cutaway, separated-floor, plan comparison and estimate controls for that model.
- Building/location notes and drawing-review states; tasks, private PDF/image uploads and event history.
- Bronze / Silver / Gold scope configuration and locally saved survey requests.
- Building-record exports and private local backups.
- Trusted-Wi-Fi preview with startup access code, plus VS Code tasks and GitHub CI.

Survey requests remain **unsent local records**, not booked visits or payments. Reviewing a drawing or closing a task is not an inspection pass.

## Not implemented

A full address/UPRN directory; automatic detailed floor-plan/scan reconstruction; measured terrain; realistic roof/facade reconstruction; live inspections; production customer accounts, permissions, billing or subscription enforcement; contractor email/appointments; cloud hosting. Manual building records without an auto-model remain **model pending**, never copies of Marketfield.

## How this build runs

Browser ES modules, a native Node.js HTTP API and local SQLite. This is not the proposed future Next.js/PostgreSQL deployment. Auto-model geometry is deterministic; a small local WebGL viewer includes a software-rendered compatibility fallback. No image-generation service, Google imagery, map tiles, browser CDN or third-party runtime package is required.

Live searches use Postcodes.io and an Overpass endpoint. Public Overpass is shared and can time out or rate-limit; configure a self-hosted/contracted service before a customer launch. [Full provider and provenance notes](docs/AUTO-MODELS.md).

## Private model pack and source control

The full starter contains `private-assets/marketfield`. It is ignored by Git and served behind local session checks. Keep it separately when cloning to another PC. Runtime `.data`, `.env`, uploads and backups must remain out of Git and public deployments.

This repository contains the separate PropertyChecked codebase. Neither `firechecked_app` nor `firechecked_portal` is part of this update. Keep the model pack and records private. Use `git pull --ff-only` in your existing checkout to receive published updates; stop and review any local-change or divergence error rather than resetting your work.

## iPhone preview on trusted Wi-Fi

```sh
npm run dev:lan
```

Open the PC address printed in the terminal, not `localhost` on the phone; enter the startup code. The PC must remain running. Use trusted private Wi-Fi only. Do not expose the HTTP development server to the internet. Physical iPhone testing is still outstanding.

```sh
npm run check   # Syntax and private-data ignore checks
npm test        # Offline unit / real local HTTP API tests
npm run backup  # Copy database and uploads to a private local backup
```

[Setup](docs/SETUP.md) | [Update instructions](docs/UPDATING.md) | [Auto-model details](docs/AUTO-MODELS.md) | [Architecture](docs/ARCHITECTURE.md) | [Security](docs/SECURITY.md) | [Test status](docs/STATUS.md) | [Roadmap](docs/ROADMAP.md)
