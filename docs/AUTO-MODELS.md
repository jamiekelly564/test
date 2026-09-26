# Automatic exterior creation: version 0.2

## What is actually built

A manually initiated online location/footprint lookup, a user-confirmed source outline selection, deterministic polygon extrusion, optional bounded GPT height suggestions, and a saved interactive exterior. These are working code paths, not a pre-generated image for every address.

The retained Marketfield plan model remains separate. A new auto-model never uses its interiors.

## Inputs

- **Complete UK postcode**: Postcodes.io returns an area centroid, not a full address list or ownership/building boundary. Search 250 m around that point.
- **Google Maps URL**: accept only allowlisted HTTPS Google Maps hosts. Coordinates encoded as a destination pin take priority over the camera centre. Coordinate query parameters and postcode text are also accepted. A camera-centre fallback is explicitly labelled, and still requires outline confirmation.
- **Short Maps link**: follow up to four HTTP Location redirects on allowed Google hosts. Cancel bodies; do not scrape Google HTML, imagery, Street View or 3D tiles. Opaque links without usable coordinates/postcode fail with instructions rather than a guessed building.
- **Latitude, longitude**: accept a bounded UK location. A precise pin is often more useful than a postcode covering several properties.

Not every Maps sharing format can be resolved. An unsupported link should be replaced with a postcode or the pin coordinates; this build does not include Google Places billing or address geocoding.

## Source geometry

Overpass returns OpenStreetMap building ways, multipolygon relations, building parts and named roads for orientation. The normaliser joins split relation members, retains valid courtyard holes and concave outlines, removes duplicate member outlines, and links contained parts to parent buildings. Invalid/incomplete/oversized geometry is skipped with a warning. A timed-out partial query is rejected rather than modelled.

The outline selector shows up to 100 nearby candidates. Select 1-6 outlines. No nearest-centroid selection is silently treated as the property. Where a site includes multiple buildings, select the relevant outlines; missing ones cannot be reconstructed from no evidence.

Mapped `building:part` geometry is modelled as separate volumes where available, without a full-height parent box covering the parts. Gaps between parts are left unfilled. Source dates, element URLs, original polygons/tags and per-volume assumptions are saved. There is no automatic ground-elevation or surveyed vertical datum.

## Height and provenance rules

1. A usable mapped `height` is used as the total height including the roof. It is **public data**, not a verified measurement.
2. Otherwise, mapped `building:levels` times an assumed 3 m floor height (plus mapped roof height if supplied) creates an **estimated height**.
3. Optional GPT suggestions are considered only where height/storey evidence is missing and the user has not overridden it. They are labelled **AI estimates**.
4. Without height evidence, a visible **9 m preview assumption** is used. Storey count remains **unknown**, not silently asserted as three.
5. User-entered overall heights or storeys are labelled **user estimates**. A storey override alone uses an assumed 3 m per storey.
6. A mapped minimum height is retained. A minimum-level conversion is explicitly estimated. Invalid total/minimum-height combinations are refused.

Roof shape tags are retained but this version creates an envelope, not a detailed roof mesh. Pitched roofs, windows, balconies, finishes, internal floors, rooms, doors, services, fire ratings and defects are **not generated** from the footprint. It is not an as-built survey or safety assessment. No invented confidence percentages are used.

## Optional OpenAI adapter

Private environment settings:

```dotenv
OPENAI_API_KEY=your_private_api_key_here
OPENAI_MODEL=gpt-6-astra
```

The Responses API request is server-side, uses a strict structured-output schema and `store:false`, and requests conservative missing-height/storey suggestions. This is an API setting, not a promise about every category of provider retention. Your organisation's API data controls still apply.

Only a selected element ID, building-type tag, footprint area and optional roof-type tag are sent. No postcode, coordinates, building name, resident information, plans or photographs are included. The prompt treats tags as untrusted data and allows null when evidence is insufficient. Validation rejects unknown IDs, duplicate IDs and heights/storeys outside bounds. No arbitrary tool calls or code execution are requested from the model.

This first AI integration is deliberately limited: it does not inspect photographs or recover a building's actual height from its area. Human review is needed for useful assumptions. Where data is too weak, no usable AI suggestion may be returned. Model access and API billing must be enabled on your own account; a chat subscription does not populate the app's server key.

## Performance and failure handling

The outline is extruded locally as soon as selected after data arrives. No fixed seconds-to-model promise is made. Lookup time depends on the network, public service load and geometry complexity. The app has loading/error states and never leaves failed searches as a fake completed model.

- One outward footprint search at a time; four new searches per minute.
- Identical search cache: 30 minutes, bounded to 60 entries in memory.
- Optional AI: three requests per minute; up to 12 missing-height suggestions.
- Explicit timeouts, redirect limits, JSON size bounds and geometry complexity limits.
- Retry-safe/idempotent model saves; expired search references require another search.
- Demand-rendered WebGL viewer with no animation running when idle, capped pixel ratio, and a Canvas2D triangle-rendered compatibility fallback. A complex fallback scene may still be slow and the software depth ordering is approximate; use a WebGL-capable browser for best results.

## Privacy and persistence

The UI requests public-data consent before lookup and separate opt-in before an AI call. Sessions and CSRF validation apply. Generated models and original source data are stored in the private local SQLite database; files served from model/export routes require a session. They are included in local record exports and database backups, not automatically uploaded anywhere.

The server-side Overpass endpoint is an owner-controlled environment setting, not a browser-supplied URL. The default endpoint is the shared public instance, for occasional interactive local development only. Build or contract suitable geospatial infrastructure before a customer launch. Do not launch the customer app using the public endpoint as its production backend.

OpenStreetMap attribution and ODbL licence references are shown in the UI and embedded in exports. Review licence obligations before public redistribution/combination of derived databases. Google imagery/tiles are not used to derive these meshes.

## Offline tests versus live acceptance

Unit and real localhost HTTP tests use injected synthetic responses, so CI does not need internet access, private building data or a paid API key. Browser interaction tests use the production UI modules with explicit fixtures because managed browser policy blocks localhost navigation in this environment. No fixture mode is switched on in the shipped app.

The build environment could not resolve provider hosts, so a real postcode-to-Overpass round trip and a paid GPT request have **not been verified**. On the user's PC: start the app, approve a single live search, confirm an outline, rotate/save/reopen and export its model. Test an unsupported link and a no-data location as well. No measured geometry, Windows or physical iPhone performance claim follows from the fixture tests.

## Primary source references checked for implementation

- Postcodes.io documentation: https://postcodes.io/docs/api/
- Overpass public service policy: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- OpenStreetMap attribution/licence: https://www.openstreetmap.org/copyright
- OpenAI GPT-6 Astra model/API: https://developers.openai.com/api/docs/models/gpt-6-astra
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Google Maps URL syntax: https://developers.google.com/maps/documentation/urls/guide

These sources describe the APIs and policies. They do not verify a particular building or assert that credentials/production services are connected.
