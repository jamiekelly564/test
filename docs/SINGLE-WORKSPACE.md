# One building workspace - v0.11.0

## Customer journey

Enter a postcode and choose Create my building. A building name is optional, inside a small expandable field. The existing bounded map/photo research creates or improves the estimate; an activity bar indicates work without inventing a completion percentage. An initial generic box is covered while its first research is running. A usable saved model is not removed if further research fails.

The same page then presents the interactive model and twelve manual tracking categories: Fire doors; Fire systems; Emergency lighting; Roof & building fabric; Water & leaks; Heating & ventilation; Electrical; Lifts & access; Cleaning & waste; Grounds & outside areas; Documents & certificates; Other maintenance.

Categories are capabilities, not assets found from a postcode. They begin empty. Choosing a category opens its records and a short form below the cards. Users can enable or pause a category, add records with a title, location, responsible person/company, notes and a due date, and change To do / In progress / Awaiting review / Done. There are open/overdue counts and open/done filters. A recorded task being Done is not a compliance verdict. Pausing a category does not delete records.

These are real saved local task records, not sample figures. This release does not add automatic fault detection, live sensors, legal inspection schedules, outgoing reminders, emails, contractor assignment messages or asset recognition. Due dates are user-entered and highlighted on screen; an owner field is a record, not an invitation.

## One page, optional panels

Photos & floor plans opens as an in-page panel. Existing file selection, drag/drop, camera picker, permission confirmation, image resizing, original-plan retention, real upload progress, private thumbnails and selected-photo rebuilding are retained. Explicit Find photos online provides the previous yes/no photo choice inside this panel. Neither photo confirmation nor a document form is a required step in postcode-only creation. Uploading a file alone does not start AI.

Model tools is a panel containing the existing adjustment/source controls. The full-width model retains architectural detail, camera/floor/cutaway controls, invented interior examples, exports, edit/discard/undo and the existing safeguards against overwriting newer geometry. Real plans continue to hide invented interior examples. This is a navigation upgrade, not a new reconstruction algorithm or an accuracy claim.

Survey requirements can be saved in an in-page form through the existing local request API. This does not send a request outside the PC, book a survey or collect payment.

`/`, `/index.html`, `/start`, `/instant` and `/build` now serve the same workspace. An old `/build?building=...` link opens the existing building and the photo panel without a second customer page. Saved models reopen on the same page. Staff/legacy tools remain available at `/admin`, `/photo-tools`, `/advanced-build` and `/studio`; they have not been deleted. Old `/#/...` administrative links are routed to `/admin#...` for compatibility, but are not part of the normal customer navigation.

## Postcode matching and costs

A postcode can cover several buildings. The open-map provider still selects a likely footprint near the postcode centre, not a verified exact address. No building name or identity is invented: unknown records are labelled Building at [postcode]. Providing an optional name can help the existing photo research. With exactly one saved building at a postcode, that record is reused. Several saved matches produce a choice on the same page; this is not a UK-wide address directory.

Existing previews reopen without new research. Creating a genuinely new preview uses the existing map/AI pipeline and configured budget. Additional photo research/rebuilding requires an explicit action. Refreshing, uploading, manual tracking and local model edits do not start paid inference. No additional service subscription, key or runtime dependency is introduced.

## Persistence and safety

Three additive tables (`workspace_requests`, `workspace_modules`, `workspace_tracked_tasks`) store idempotency, category settings and tracking metadata. Tracking records use the existing tasks table, so the old task workspace sees their status updates. Existing unrelated tasks are not automatically assigned to a category. Category/task writes are transactional, version checked and create workspace events. Record creation keys reject changed payloads; a lost creation response can be recovered by GET without repeating work.

All workspace APIs use the existing host/session/CSRF guards. The server checks categories, statuses, dates, text lengths, selected building identity and record versions. Cross-building record updates are rejected. Sources/keys are not copied into tracking responses. Document lists omit storage names and file hashes; download routes retain their existing session checks. This is still one local-owner workspace, not production organisation/tenant permissions.

Unsaved tracking forms and model edits warn before changing buildings. Status polling preserves the entered form. Reconnect refreshes saved state, not paid requests. A completed photo rebuild uses the original selected image inputs and the existing optimistic model-publication guard. Private `.env`, `.data`, original Marketfield, evidence models, uploads, inspected assets, notes and existing surveys remain untouched. Backups include the new SQLite tables.

## Update

Stop the running server with Ctrl+C. In the existing propertychecked-platform directory run separately, stopping on errors:

```powershell
npm run backup
git pull --ff-only
npm run dev
```

Open http://localhost:3000/start in the browser and hard-refresh. The version is 0.11.0. No new ZIP or dependency installation is needed; Start-PropertyChecked.cmd remains compatible. Keep the terminal open. The existing model can be used immediately without rebuilding it merely to enable tracking.

## Validation

The complete current repository passed 382 tests locally on Node 22.16.0 (366 existing plus sixteen postcode-workspace/HTTP/SQLite tests), together with syntax/private-data checks. Tests cover postcode-only creation, idempotency/recovery, duplicate saved choices, session/CSRF, category versions, saved tasks/dates, cross-building protection, old task interoperability, pause/no deletion, restarts and one-page route aliases. The previous /build static assertion was updated to check the same-page photo tools rather than a now-obsolete standalone page.

The actual UI and geometry modules were exercised in offline Chromium with synthetic building data and mocked HTTP/history/upload responses. Checks covered postcode creation, all twelve categories, add/status, unsaved drafts, in-page model tools, photo upload/search/rejection/rebuild, welcome-page polling and 320/390/768/1500-pixel widths. No JavaScript errors or horizontal page overflow were observed. Screenshots depict a synthetic fixture, not a real building match.

The agent-browser CLI was unavailable and Chromium navigation to localhost was blocked by administrator policy. Those restrictions were not bypassed. Node HTTP/SQLite endpoints were tested directly; the browser test was not a live browser-to-server run. No paid OpenAI call, real building similarity, physical phone/Windows test, sensor integration, public hosting or production security certification is claimed. Full Node 22/24 GitHub checks must pass before merge.
