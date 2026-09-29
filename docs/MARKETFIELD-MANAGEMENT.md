# Marketfield management workspace - v0.12.0

## What is implemented

Open `/marketfield` on the existing PC server. This is a single Marketfield screen with the recovered private model, location selection and management records. It does not replace the model, restart a public-data reconstruction or involve paid AI.

The 18 proposed responsibility areas plus Other are available as a catalogue. These cover fire doors/compartmentation, detection/protection, escape provisions, structure, fabric, lifts/accessibility, water, HVAC/gas, electrical/energy, security, cleaning/waste, grounds/shared facilities, health and safety, residents/engagement, repairs/contractors, costs/insurance, major works, and building safety. Categories are not assertions that those assets exist at Marketfield.

Ten typed record forms are implemented:
- Assets with site ID/NFC reference text, model location, equipment/manufacturer, specification/source, provenance, checker/date, installation, warranty and replacement allowance.
- Work orders with priority, owner, interim measures, approval reference, contractor, evidence submission, a distinct named completion-acceptance action and reopening.
- Recurring checks with interval, source of frequency, first due date, scope, owner and immutable occurrence logs. No-access, defect and skipped outcomes retain the due date. Only an evidenced, named accepted completion advances ONE occurrence. Late completion does not silently skip all missed periods. Calendar-month dates preserve their original day, clamped to month end.
- Documents with actual private file links, reference, revision, issue, expiry and supersession. Superseding a current record preserves its history; cyclic revision references are rejected.
- Cost records with separate forecast, quotation, commitment and paid amounts. Amounts are GBP including VAT and summed in integer pence. The totals are separate stage registers, not a reconciled accounting/service-charge ledger.
- Contracts/warranties/insurance records with supplier, scope, dates, notice deadline and allowance.
- Responsibilities with distinct dutyholder/manager/contractor roles, organisational scope and appointment/lease references. Naming someone does not authenticate their identity or establish their legal appointment.
- Safety records for building classification, registration, safety case, FRA, structure, external walls, firefighter information, engagement, evacuation-process administration, MOR processes and correspondence.
- Incidents/outages with identification time, immediate measures, dutyholder-set notification deadline, external reference and restoration record. The software does not decide reportability or send notifications.
- Anonymised engagement/access cases with case type, date, reference and outcome. This is not a resident health, financial or personal-evacuation database.

The model remains interactive: floor selection, inside/exterior, separated floors, source comparison, highlighting estimates and selecting existing drawing/model locations. Registering a new asset is deliberate, not automatic from every rendered door. A location may remain unconfirmed. Void references must not be mistaken for occupied rooms or equipment. No new geometry or fabricated inspection findings are introduced.

## Workflow and evidence

Records are saved in the existing SQLite workspace, not browser-only demonstration storage. A record can link to an asset, model location and uploaded PDF/JPEG/PNG files. The existing private upload/download endpoints are reused. Uploaded files remain original workspace documents; uploads do not call AI. A cancelled form can leave an unlinked file, visible under Workspace files for later association.

A normal edit cannot mark a work order closed. Submit completion first, with a document or substantive external evidence reference. The record then awaits review. Accept completion records a named reviewer and review note. This is self-declared human acceptance, not an authenticated digital signature, independent inspection or compliance verdict. Full before/after record snapshots remain in revision history.

Scheduled check outcome 'completed' similarly requires evidence and a reviewer. Failed access is a logged attempt, not a completed inspection. Frequency and applicability remain the dutyholder's decision. Reference templates are optional, require a first due date and are not activated on installation. The next date is advanced from the previous scheduled occurrence, not reset from the day someone clicks a button.

The dashboard flags overdue records, out-of-service assets, work awaiting evidence acceptance, failed-access work, non-completed checks, open incidents, recorded notification deadlines, document expiry and contract notice/end dates. These are management prompts, not a safety score. Due dates are compared using the Europe/London calendar. The local 'identified/notified/deadline' timestamps are explicitly entered as local wall times.

## Building-safety boundaries

The software does not assume Marketfield's height or HRB classification from its model. The user asked about an 18 m building; applicability still needs documentary confirmation under the relevant regime. Templates point to official guidance reviewed on 29 September 2026; they are not a complete legal-compliance programme.

Official references used for OPTIONAL template text:
- Communal/flat entrance door checks: https://www.gov.uk/government/publications/fire-safety-england-regulations-2022/fact-sheet-fire-doors-regulation-10
- Door access records: https://www.gov.uk/government/publications/fire-safety-england-regulations-2022-fire-door-guidance/fire-safety-england-regulations-2022-fire-door-guidance
- High-rise equipment checks: https://www.gov.uk/government/publications/check-your-fire-safety-responsibilities-under-the-fire-safety-england-regulations-2022/check-your-fire-safety-responsibilities-under-the-fire-safety-england-regulations-2022
- Building information: https://www.gov.uk/guidance/keeping-information-about-a-higher-risk-building-the-golden-thread
- Mandatory occurrence notices/reports: https://www.gov.uk/guidance/submit-a-mandatory-occurrence-notice-and-report
- Residential evacuation arrangements: https://www.gov.uk/government/publications/residential-personal-emergency-evacuation-plans-residential-peeps

No MOR/FRS submission, email, SMS, appointment, payment, live sensor reading, automatic defect detection, government registration, safety certificate or legal schedule is generated. Immediate incidents require action through the building's actual procedures; do not wait for software reminders. Financial records do not provide arrears management, banking or statutory consultation automation.

## Privacy, preservation and operation

Host/session/same-origin/CSRF protections are retained for every API; selected assets, locations, superseded records and evidence IDs are checked against their building. Writes are transactional, idempotency-keyed and version-checked. No delete endpoint is offered. Statuses can pause/retire records without erasing history. The additive tables are management_records, management_history, management_requests and management_check_logs. Existing locations, geometry, estimates, documents, tasks, notes, workspaces and API settings remain intact. This management register is distinct from earlier generic tasks, which are preserved rather than silently reclassified.

The recovery pack is still required on a new PC to display Marketfield. Private model files are not in Git. With no model pack, the page offers an empty Marketfield register and explains restoration; it does not substitute a generic building. `npm.cmd run backup` includes new tables and uploaded documents. The model pack remains a separate private backup. Export records downloads metadata, all management history and all check logs; it is not a backup of uploaded file bytes.

This remains a SINGLE LOCAL-OWNER development application. An authorised LAN session can access the workspace. There is no per-resident/per-contractor/organisation role isolation, no production TLS or operational security certification, and history is not tamper-proof against someone with database access. Do not expose the server to the internet or store medical/PEEP details, access credentials or payment credentials. Resident case forms are deliberately limited to anonymised operational references; no automatic text filter should be relied on as privacy enforcement.

## Update

Stop the old server. In your existing propertychecked-platform folder run separately, stopping on errors:

```powershell
npm.cmd run backup
git pull --ff-only
npm.cmd run dev
```

Open `http://localhost:3000/marketfield` in the browser. The original `/start` remains and includes a Marketfield link. `Start-Marketfield.cmd` provides a folder-correct subsequent launch; it does not pull updates or stop a running server. No additional API key or dependency installation is required. Reopening this page starts no paid inference.

## Validation

The complete local repository passes 429 tests on Node 22.16.0: all 400 prior tests plus 29 management tests. New coverage includes empty startup, all ten record forms, optimistic concurrency, cross-building rejection, uploads, evidence and completion review, failed access, recurrence/date boundaries, cost precision, document supersession/cycles, history/export, persistence/restart and actual Node HTTP/session/CSRF/static route tests. Syntax/private-data checks pass for 97 JavaScript modules. Final GitHub Node 22 and Node 24 checks are required before merging.

The actual UI/catalogue modules and the recovered original private viewer were exercised in offline Chromium with synthetic QA records. The browser/API transport and iframe messaging were simulated; rendering used the actual preserved model, not a new picture. The test covered asset entry, record details, templates, schedule/document forms, floor/cutaway controls and 320/390/768/1500-pixel widths without observed JavaScript errors or horizontal overflow. A missing crypto.randomUUID in insecure contexts was corrected with a cryptographic getRandomValues fallback.

agent-browser was attempted but not installed. A real browser navigation to the local dev server was attempted and blocked by administrator policy (ERR_BLOCKED_BY_ADMINISTRATOR); that policy was not altered. Node HTTP tests ran independently. No live browser-to-server, physical iPhone/Windows, real inspection, legal certification, paid AI or real contractor notification test is claimed. QA screenshots show conspicuously labelled synthetic DEMO records which are not seeded into the user's database. No private models, plans, snapshots or QA records are included in this public code change.
