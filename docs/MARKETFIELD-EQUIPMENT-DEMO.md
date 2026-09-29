# Marketfield populated demonstration and 3D equipment

## Open the populated building

Open `/marketfield?demo=1` on the existing local server, or use **Populated demo** on `/marketfield`. This is an explicit demonstration workspace over the original recovered model, not an inspection or an automatic population of real management records. **Real records** closes the demonstration and restores the normal management workspace.

A separate SQLite table, `marketfield_equipment_demo`, holds the fictional records and simulation history. Normal management assets, tasks, inspections, costs, documents, residents, evidence acceptance and reports are neither overwritten nor mixed into it. Opening the normal workspace does not seed this table. Viewing the demo requires the existing private model; a missing model produces a restoration message, not a replacement building. The existing startup auto-restoration remains unchanged.

## Population and coverage

The demonstration adds 30 procedural equipment styles: fire alarm panels, smoke/heat detectors, manual call points, sounder/beacons, extinguishers, riser outlets, emergency lighting, exit signs, smoke-control panels, communal lights, distribution boards, utility meters, backup-battery cabinets, intercoms, CCTV cameras, access readers, lift-controller cabinets, water pumps/tanks, isolation valves, leak sensors, boilers, ventilation fans, radiators, waste/recycling bins, benches, information boxes and EV chargers. These are schematic multi-part 3D meshes, not pictures or identical point markers. There are no actual device/product claims or surveyed installation positions.

The original recovered Marketfield pack generated 148 fictional equipment records, 30 communal-area records, 30 illustrative area checks and 40 example issues during local validation. Every one of the existing 171 tracking-library topics receives a separate unassessed scope card with its original scope text. These include fabric, roof/drainage, doors, services, cleaning, grounds, contractors, finance, contracts, safety information and engagement administration. Scope cards raise questions, not confirmed defects. All original non-void model locations are available as demonstration references. No reference is marked inspected or safe.

A representative issue is associated with each of the 30 equipment styles, plus communal cleaning, finish-damage and decoration scenarios. Example dates and assignments are explicitly fictional, not activated statutory schedules. The demonstration does not claim to enumerate every possible defect in every building. Other catalogue responsibilities remain scoping prompts rather than fabricated incident reports, bank transactions, contractor appointments or certificates.

The real recovered model provided suitable bounded display positions for 116 of those 148 equipment symbols across all ten source levels. The other 32 remain associated with their source area in the directory without a forced physical position; many are shaft/stair anchors without an available solid floor region. The UI reports the actual placed/unplaced totals. Placement uses existing floor regions and avoids holes and a basic spacing margin; it is schematic, not an engineering installation design. Nominal/enhanced/large symbol modes alter display size. Cutaway symbols adapt to the displayed wall height. Enhanced symbols can still overlap architectural detail, and no exact mounting or route has been surveyed.

## Interaction

Normal equipment is actual triangle geometry. Hovering a visible object shows a transient silhouette highlight and a DEMO label; clicking opens its separate record. The picker rejects objects occluded by the existing building meshes. Issues use persistent numbered/exclamation markers and only active fictional issues appear. Those markers are location cues and may be visible through walls. They are not live sensor readings or verified fault findings.

Choose a system, floor, record tab or search term. `Locate in 3D model` isolates the relevant floor and faces the selected equipment. Areas retain their original model references. Ordinary equipment, future-only checks and closed demo issues do not get permanent dots. Existing records and their location hover remain unchanged when leaving the demo.

Issue/check statuses can be changed with a required simulation note. Resolution removes the demo issue marker. These are simulation transitions, not real completion evidence or legal sign-off. Version conflicts reject stale changes. Reset requires explicit confirmation and removes only the fictional table row before recreating the example. The last 1,000 simulation-history entries are retained. No deletion or reclassification of real management records occurs.

The DEMO metadata export is named accordingly. The DEMO GLB exports only the added fictional equipment layer, marked as unverified in node/document metadata, with no external textures. Original building GLB/USDZ exports and private authoring files are unchanged. Exported schematic coordinates must not be used for installation or construction.

## Security and operation

The existing session, Host/origin and CSRF checks protect all demonstration API endpoints. The viewer accepts only known model location IDs, supported equipment styles, bounded arrays and fixed symbol scales. It does not accept remote URLs, executable code or parent-supplied equipment coordinates. Labels are text nodes/escaped HTML. The layer uses independent buffers/groups and restores the original renderer arrays on exit, without writing to PLAN or the source model files.

No third-party package, paid AI, online search, reminder, government report, resident health data or live sensor connection is introduced. A local-only demonstrator is not production multi-tenant software. Do not expose the local server publicly.

## Update

Stop the old server with Ctrl+C. Run separately in the existing project, stopping on errors:

```powershell
cd "C:\Users\jamie\Documents\PropertyChecked"
npm.cmd run backup
git pull --ff-only
npm.cmd run dev
```

Open `http://localhost:3000/marketfield?demo=1` in the browser and hard-refresh. No new API key or replacement model pack is required when Marketfield is already restored. New code is delivered by Git; original private assets remain excluded.

## Verification

53 tests are added: catalogue scoping, all 30 finite/outward meshes, geometry/source preservation, bounded placement and holes, symbol height fitting, GLB provenance, explicit population, separate persistence, idempotent initialization, optimistic version conflicts, forbidden real statuses, required notes, reset preservation, and real Node HTTP/session/CSRF/static serving. The existing full 171-topic default-loader test must run against current main in GitHub CI.

The available local snapshot contains the older 400 tests plus these 53. It passed 452 tests, with the single default-loader integration test skipped because that older artifact lacks the later catalogue. Full current-main Node 22 and 24 CI is required before merge; a partial local suite does not replace it.

Offline Chromium exercised the actual preserved model and new equipment geometry using the renderer's software-compatibility mode. The check verified 116 rendered groups, a real alarm-panel pointer hover, object focus and unchanged PLAN/groups after disabling the layer. A wrong-origin display message was ignored. The actual new frontend was separately exercised with simulated API/iframe transport for search, system filters, area directory, details, fictional resolution and 320/390/768/1500px widths without horizontal overflow or JS errors. The surrounding local UI harness was simplified, so this is not a live full-app browser acceptance test.

agent-browser was attempted but is not installed. Real Chromium navigation to the local server returned ERR_BLOCKED_BY_ADMINISTRATOR; that policy was not bypassed. Node HTTP/SQLite tests ran independently. WebGL hardware rendering, physical Windows/iPhone and a live browser-to-server end-to-end pass are not claimed. No real assets were inspected and no paid request ran. No private model, plan, screenshot or demo-generated location data is included in the code commit.
