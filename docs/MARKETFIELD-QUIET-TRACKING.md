# Marketfield: issue-only markers, hover areas and a practical tracking library

## User-facing changes

Open the existing `/marketfield` workspace. Ordinary drawing-reference blobs are hidden. The full-window model and existing controls, record forms, data, source plans and exports remain intact. Persistent location markers now represent active issues/follow-up or open work orders only. Ordinary assets, unconfirmed information by itself, future-only checks and closed work have no persistent dot. A routine open work order is labelled open work, not misrepresented as overdue. The record list can still show all records; filters do not delete any data.

Hover visible model surfaces to identify the associated named area or door. A transient tinted outline/fill follows the existing model zone, rather than showing a white point. Clicking selects that location. Touch users select by tapping or using the area directory. There is a searchable Communal areas directory and a contextual panel with Track this communal area, relevant work prompts and the full tracking library.

The recovered pack exposes 30 named communal-area references (corridors, entrance/circulation areas, stairs, stores, plant/bin and community areas). These are working model references, not a certification that the current building has exactly 30 independently surveyed communal rooms. Each can be deliberately registered as an ordinary asset record with equipment type Communal area and its original location ID. Subsequent tasks/checks can link to that area record. Existing area records reopen rather than intentionally duplicating them. Concurrent creation still uses the existing general record API; this is not a new server-side uniqueness constraint.

## Tracking catalogue

There are 171 named tracking prompts across the existing 19 responsibility categories. Each prompt includes the record scope, not fabricated installed equipment or results. Search by item/system and prepare a relevant existing record form. Finance, contract, document, responsibility, safety and anonymised engagement topics open those respective forms instead of falsely registering all of them as physical assets. Add task and Plan check remain available. The operator reviews and saves the normal form; hovering, browsing and selecting never writes records or calls AI.

Coverage includes doors and compartmentation; fire detection/protection; smoke control, lighting and escape provisions; structure/balconies; roofs, facade, windows and finishes; lifts/accessibility; water, hygiene, plumbing and drainage; heating/ventilation/gas; electrical/energy; security/access; communal cleaning/waste/pests; grounds/parking/shared facilities; health and safety; anonymised engagement; contractors/repair control; budgets/contracts/insurance; major works; and building governance.

A prepared check starts PAUSED with no due date and no active repeat interval. It is an operational prompt, not a legal inspection programme. Presence, scope, responsibility and frequency must be established from building records, the relevant assessment, manufacturer, competent advice or the user's agreed programme. The existing official guidance templates and server validation are unchanged.

## Model evidence and boundaries

The picker casts against actual visible mesh triangles, respects isolated/exploded floor positions and the viewer's wall-height clipping, and selects the closest visible surface. It does not pick a hidden corridor just because its point is near the cursor behind a facade. Plan geometry, dimensions, materials and export bytes are not rebuilt or changed.

Highlight geometry prefers existing finish polygons, separately modelled floor plates, shaft openings, stairs and door/window segments. Where a closed room boundary is not explicitly available, an approximately 0.20 m display grid is segmented by existing model partitions. These highlights carry an approximate-boundary label and dashed outlines. This is not a new measured floor plan.

Some named references share an unresolved existing region: notably the lower-ground cycle-store/plant-room pair and bin/sub-station pair. The highlight says that the separate boundary is unresolved; clicking offers a choice of reference. No wall is invented to pretend the two areas were independently traced. Voids are excluded. Missing equipment positions and pipe/cable routes are not guessed from catalogue labels; keep these records building-wide or location unconfirmed until evidence supports placement.

The selection fill is a screen overlay and can extend behind partitions after selecting a whole zone. It is not a fully depth-clipped CAD material highlight. Use Inside and an isolated floor for interior work. Some roof/exterior elements have no separate saved location ID, so not every rendered triangle becomes a trackable installed asset. The existing model limitations and estimated floors remain.

## Persistence, privacy and scope

The library prepares the existing form through its existing UI action; changes mark the form dirty and preserve unsaved-form protection. Saves use the same session/CSRF/version-checked management API and SQLite tables. No database migration, new provider, production role boundary, paid request, safety judgement, resident health data, notification or invented record is introduced. Evidence acceptance, check outcomes, recurrence, history and backups remain as before.

Messages validate exact iframe/parent origin and source. Only known model IDs are accepted. Hover labels use text nodes, bounded context strings and source identifiers. Picking/highlighting reads private geometry only inside the already session-authorised viewer. New public code routes contain no private model, plan or record data. The private recovery pack remains separate from GitHub; startup auto-restoration remains in place.

## Update

Stop the running server with Ctrl+C. Run commands separately in the existing checkout, stopping on errors:

```powershell
cd "C:\Users\jamie\Documents\PropertyChecked"
npm.cmd run backup
git pull --ff-only
npm.cmd run dev
```

Open `http://localhost:3000/marketfield` and hard-refresh. No new runtime package, API key, replacement model or new ZIP is needed when Marketfield is already restored. Select a floor, choose Inside, then hover a corridor or select it from Communal areas.

## Verification and limitations

28 new tests cover catalogue coverage, typed record defaults, communal/private/void distinctions, issue-only markers, active work, unchanged record lists, source geometry nonmutation, triangle picking/occlusion, wall clipping, floor/explode transforms, holes, unresolved shared regions, safe messaging and actual session-protected HTTP serving/MIME. The available recovered local snapshot passed its 400 prior tests plus these 28 tests (428 total), along with syntax/private-data checks. That snapshot is older than current main: all current-main management/fullscreen/auto-restore tests must additionally pass in final GitHub Node 22 and 24 CI before merging.

Offline Chromium exercised the recovered original private viewer and the actual new picker/hover code, with outgoing parent messages captured by the test harness. Actual pointer hover selected the corridor polygon and click selected its original ID. Floor/explode operations left PLAN unchanged; no original white reference pins remained. All 220 non-void original locations received model-based or explicitly approximate/shared interaction surfaces; the 30 communal references were covered. A separate synthetic form-contract harness exercised communal selection/registration defaults, 171-topic search, paused checks, typed contracts, dirty-form handling and 320/390/768/1500px reflow with no JavaScript errors observed.

The browser URL-navigation policy blocks localhost in this environment and was not bypassed. agent-browser was unavailable. Node HTTP tests run separately. Browser transport/form handling in the offline harness was simulated; a live browser-to-server end-to-end or physical Windows/iPhone test is not claimed. No private model, screenshot or QA record is committed. The model was not surveyed or made more accurate by this interaction update.
