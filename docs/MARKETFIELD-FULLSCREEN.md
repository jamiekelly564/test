# Marketfield full-screen layers - v0.13.0

## One model-first screen

`/marketfield` fills the browser viewport. The existing private model sits behind collapsible Layers and Records panels. Focus model hides both panels; Escape restores them. Full screen requests the browser's native fullscreen mode, with a non-blocking fallback when it is unavailable. Dialogs remain inside the full-screen document. Phone layouts use one collapsible bottom panel at a time, rather than two narrow columns.

The saved asset, work, check, document, finance and safety workflows remain available. Existing source geometry, private plans, estimated areas, recurrence rules, evidence acceptance, record history, version checks and API permissions are unchanged. No new equipment or sample records are seeded.

## What the highlights mean

A marker is a **linked model location**, not an exact equipment outline, inspection result, sensor reading or claimed pipe route. Its position comes only from the existing private model's location coordinates. Several records at one point share a numbered marker. Selecting it opens the matching records; a work order can inherit the location of its explicitly linked asset.

Status colour mode uses red for recorded action/outages, amber for overdue/follow-up, purple for review, teal for dates within thirty days, blue for ordinary registered records and grey for unconfirmed information. Accepted/resolved records can be green when closed records are deliberately included; green is not a safety/compliance verdict. System colour mode groups the nineteen existing responsibility categories into four headings: fire/life safety; fabric/shared spaces; building services; management/projects. Mixed-system locations have their own neutral colour.

All records, Needs attention, Overdue, Outages, Awaiting review, Due in 30 days and Not located filters share their predicate with the record list. Search, record type, responsibility, selected location and floor narrow the view. Floor indicators show saved-record attention counts; estimated/interpolated source levels retain a dashed outline. Reference-only layers independently show existing model doors, rooms/areas, stairs, lifts, risers and windows. They use dashed neutral markers and zero registered-record counts. Voids are not offered as installed-equipment references. An empty register initially offers door/lift/riser references so the building can be explored without fabricating assets.

Missing/invalid/unconfirmed positions remain in Not located, including building-wide contracts and responsibilities. No position is guessed from names or category text. In a selected floor view, unlocated records are not allocated to that floor. Not located deliberately returns to whole-building scope.

Labels, Dim building, Hide highlights and Focus model are display-only controls. The reference geometry and exports are not recoloured or changed. Markers can show through walls and can be covered by floating panels; the legend says so. Off-screen and overlapping markers are suppressed for readability, with the selected point retained. Projected-marker counts are not total equipment counts. All matching records remain accessible in the record list.

## Data and messaging

No database migration, new write API or paid provider is introduced. The module reads the existing session-authorised management snapshot. Lost connections retain the last snapshot and display a stale-data warning, not a silently live-looking overlay. Viewing, filtering, fullscreen, source reference layers and manual edits do not invoke AI.

The iframe bridge validates exact parent/window origin and sender, accepts only existing asset IDs, bounded strings/counts and fixed hex colours, and rejects oversized payloads. It does not accept remote URLs, code or parent-supplied asset coordinates. Titles use text nodes. Positions follow the original viewer's floor isolation and exploded-floor transformation. Original frame callbacks are retained. The overlay is removed on page teardown. The original viewer already changes its field of view in portrait, so the bridge no longer increases camera distance a second time on narrow screens.

The prototype remains a single local-owner workspace, not production resident/contractor permissions. No personal evacuation/medical data, access credentials or banking details should be entered. Existing official guidance templates and applicability checks are unchanged by this visual update.

## Update

Stop the current server with Ctrl+C. In the existing project folder run separately, stopping on errors:

```powershell
npm.cmd run backup
git pull --ff-only
npm.cmd run dev
```

Open `http://localhost:3000/marketfield` and hard-refresh. No additional dependencies, API key or model rebuild is needed. The private Marketfield recovery pack is still required on a new PC. It is not included in GitHub.

## Verification

Thirty new automated tests cover responsibility coverage, status/date filters, explicit/inherited/missing locations, grouped priorities, neutral drawing references, shared record/marker filtering, archive semantics, source nonmutation, HTTP routes/session checks, message origin/sender rejection, bounded payloads, text-safe titles, original callback preservation, floor/explode projection and marker decluttering.

The local checkout was recovered from the previous tracked-code artifact and the current main management changes. It contained the 400 prior artifact tests plus these 30 tests: all 430 passed, along with syntax/private-data checks. The current main's 29 management tests remain on GitHub, rather than being reconstructed in that local checkout. Full Node 22/24 CI against the final PR must pass before merging; a local partial-suite result is not substituted for those checks.

Actual Node HTTP/SQLite serving was tested separately. Agent-browser was attempted but is unavailable. Chromium navigation to the local server returned ERR_BLOCKED_BY_ADMINISTRATOR; that policy was not altered. Offline Chromium used the actual updated UI, recovered private model and highlight bridge with deliberately simulated API/iframe transport and clearly labelled DEMO records. Tests exercised status/system filtering, unlocated records, labels/dimming, focus/panels, floor controls, retained unsaved form data and 320/390/768/1500-pixel reflow. No JavaScript errors or horizontal page overflow were observed. Real browser-to-server, native fullscreen on the user's device and physical Windows/iPhone acceptance are not claimed. Screenshots show temporary QA records, never seeded production records. No paid AI call was made.
