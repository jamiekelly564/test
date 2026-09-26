# PropertyChecked coding instructions

Read README.md, docs/ARCHITECTURE.md and docs/SECURITY.md first.

- Work only in this repository. Never modify firechecked_app or firechecked_portal without a separate explicit instruction.
- Run npm run check and npm test for every change. No external APIs or secrets are needed for tests.
- Keep private-assets, .data, backups and real environment variables out of Git and public assets. Use synthetic test fixtures.
- Preserve the existing interactive 3D geometry and its drawing/estimate provenance. Do not substitute a rendered image.
- No pass/fail, fire rating, defect, sensor reading or compliance score may be inferred from appearance or drawing geometry.
- Do not call an external provider, collect payments, publish a website or send communications just because an interface button exists.
- All current survey requests are local, unsent records. Automatic exterior geometry and optional bounded GPT height suggestions are implemented in v0.2; detailed reconstruction, production billing/auth and a full address directory remain separate milestones. Preserve provider consent and keep mock providers restricted to tests.
- Validate input on the server. Preserve concurrency, idempotency, same-origin, CSRF and private-route checks.
- Record browser/device test limitations honestly. A mobile viewport is not physical iPhone testing.
- Prefer focused reviewable commits. Never force-push, rewrite remote history or replace an existing repo as part of setup.
