# Architecture: v0.2 local foundation and automatic exterior creation

## Modules

- `apps/web/public`: responsive browser application, hash routes, reusable UI helpers and API client.
- `apps/api/server.mjs`: bounded HTTP router, static allowlist, session-gated records/files and optional postcode provider.
- `apps/api/database.mjs`: SQLite schema, prepared statements, transactions, seed import and event history.
- `apps/api/security.mjs`: local host allowlist, session cookies, same-origin/CSRF checks, optional LAN access code.
- `apps/api/validation.mjs`: field lengths, enums, postcode formatting, dates and record-version checks.
- `packages/domain/catalog.mjs`: proposed commercial tiers, scope modules, labels and honest implementation status.
- `apps/api/auto-model`: postcode/link validation, bounded public providers, optional OpenAI schema adapter, caches and save orchestration.
- `packages/auto-model`: shared deterministic polygon/mesh/GLB functions and a small local interactive viewer.
- `packages/viewer`: adapter and embed styles for the already-created model. Geometry is not regenerated.
- `private-assets/marketfield`: Git-ignored HTML viewer, GLB/USDZ files and drawing/estimate manifest.
- `.data/workspace.sqlite` and `.data/uploads`: Git-ignored runtime data on the PC.
- `tests`: unit and real HTTP integration tests without network dependencies.

## Data relationships

Building -> model / locations / survey requests / documents / tasks / events.
Task -> optional location within the same building.
Location -> floor key, source reference, geometry basis, drawing-review status, notes and version.
Survey request -> selected tier, modules, scope, preferred date, access notes and idempotency key.
Generated model -> building ID, JSON geometry/provenance/source document, creation date and unique save request/hash. Schema v2 adds this table without resetting existing records.

The model's viewer IDs are retained as working location IDs. They are not presented as verified site asset identifiers. The imported building has no fabricated inspection results or operational defects.

## Rendering

The existing model is served at `/api/models/marketfield/viewer?embed=1` after session validation. It is not stored in `public`. The adapter accepts only same-origin messages from its parent and validates the command. Selected locations are linked to the outer workspace. The raw viewer contains embedded plan-comparison images; treat the entire file as private building information.

Original standalone viewer notes, if accessed outside the embedded mode, remain the old viewer's browser-local notes. New workspace notes are distinct and live in SQLite. No historical browser-local notes are silently imported.

## Persisted operations

Creation, note changes, tasks, documents and requests are written through the API to SQLite. Critical mutations use transactions. Task/location updates require the current version; stale edits get HTTP 409. Survey submissions use a unique request key and reject reuse with changed details. File names are never used as storage paths. Uploads are assigned random internal names and checked against allowed MIME types and signatures.

## Local ownership model

This is one local owner's development workspace. It has no tenant or customer role boundary. LAN mode is a convenience access code, not a production authentication system. Public hosting is intentionally not configured and the default startup refuses `NODE_ENV=production`.

## Migration path

The originally proposed Next.js / TypeScript / PostgreSQL stack is a later production step, not the runtime shipped here. Preserve API contracts and provenance rules when migrating. Move records to PostgreSQL, models/documents to authorised object storage, and add organisation membership and server-enforced entitlements before customer access. The viewport can initially remain an isolated module while the rest of the UI moves to Next.js. Do not replace the measured/model source with an illustration during that migration.

## Principal endpoints

`GET/POST /api/session`, `GET /api/status`, `GET /api/catalog`, `PATCH /api/settings`, `GET /api/postcodes/:postcode`, `GET/POST /api/buildings`, `GET /api/buildings/:id`, `GET /api/buildings/:id/locations`, `PATCH /api/locations/:id`, `GET/POST /api/buildings/:id/surveys`, `GET/POST /api/buildings/:id/tasks`, `PATCH /api/tasks/:id`, `GET/POST /api/buildings/:id/documents`, `GET /api/documents/:id`, `GET /api/buildings/:id/events`, `GET /api/buildings/:id/export`, and the three session-gated model routes.

Additional routes: `GET /api/auto/config`, `POST /api/auto/search`, `POST /api/auto/generate`, `GET /api/buildings/:id/auto-model`, `/auto-model.glb` and `/auto-model.geojson`. All API/private model reads remain session-gated; mutations require CSRF.

The Create 3D flow calls only the allowlisted/configured providers after explicit user consent. An optional server-side OpenAI call is made only when the user selects it and the server key exists. No Stripe, map tiles, image generation or email API is called. See AUTO-MODELS.md.

Generated exterior views use a separate `auto-exterior` model kind and never route to the Marketfield iframe. Deterministic footprint extrusion runs in both the browser preview and server validation. The GLB contains real geometry, metre units and embedded source notes. The viewport defaults to WebGL with a software compatibility fallback; the flat source selector uses SVG vector outlines, not a screenshot or commercial map tile.
