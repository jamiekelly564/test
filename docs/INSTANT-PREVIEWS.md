# Instant estimated buildings - v0.6.0

## What changed

The primary `/start` journey now makes an illustrative model immediately from a name and postcode. Floor plans, staff approval, successful web search and an OpenAI credit balance are not prerequisites for the initial geometry. An explicit creation click authorises the bounded automatic public research described beneath the button; it is not a silent startup job.

The starting shape is a **generic concept**, not a reconstruction from the postcode. A name and postcode alone cannot determine the real exterior. The later research pipeline produces a best-guess building-specific exterior when usable evidence exists. Missing evidence remains an estimate, not a claim of observation. The model does not infer rooms, fire ratings, defects, inspections or regulatory compliance.

## Update

Stop the running terminal with Ctrl+C. In the existing propertychecked-platform directory run `npm run backup`, `git pull --ff-only`, then `npm run dev`. Open `http://localhost:3000/start` in the browser. New npm dev/start and the VS Code debug launch use `apps/api/preview-server.mjs`, which layers the preview routes over the original app. It loads `.env` from the project directory. No dependency installation or new folder is required. The original API, evidence model, concierge requests and private files remain intact.

## Processing

1. Immediately render a local multi-storey concept and save it in SQLite. Rectangular building sections generate floor envelopes, windows/frames, entrances, optional balconies and actual flat/gable/hip roof geometry. Every dimension and repeated facade feature is approximate.
2. If the operator has an API key configured, search publicly indexed descriptions with the Responses API. The model chooses the most likely match; ambiguity is displayed, not an approval gate. Developers, architects, listings and council descriptions may support the appearance. No floor plan is required.
3. Automatically search Wikimedia Commons for candidate photographs. Only supported images with a recognised CC BY, CC BY-SA, CC0 or public-domain licence URL are downloaded. Only fixed Wikimedia API/image hosts are used, with size/time bounds, HTTPS and no redirect following. A namesake's photograph can be wrong: the interpretation prompt must reject unrelated candidates and list which image IDs it actually used. The UI and GLB keep source links, creator and licence details. Photos are references, not texture maps.
4. A structured vision/design request uses the research notes and downloaded candidate images to choose block positions, storeys, facade appearance, roof and indicative balconies. Deterministic code builds the actual geometry. Geometric/schema validation is separate from evidence-based drawing validation.
5. A final bounded review pass checks the estimate against the text research and recorded photo observations. It has no new search tools or image bytes and is not an independent photo inspection. The previous usable AI estimate is retained if this pass fails.
6. Save the result automatically. No staff approval is required for an **estimated preview**. Plans can subsequently be added through the existing `/build` workflow, or survey options opened from the preview. Those existing survey forms do not actually take payment or book a visit.

Search and visual research may take minutes, but the initial geometry does not wait for them. The page shows actual stages, not invented completion percentages. With no usable evidence the final outcome remains clearly labelled as a generic AI-estimated concept. This is not a photogrammetry system or an exact 3D scan.

## Imagery limits

This release does **not** scrape Google Images or derive geometry from Google Maps/Street View/satellite tiles. A Google image search listing is not a blanket commercial reuse licence. It automatically tries the supported reusable photo source instead. There is no new high-resolution satellite subscription or UK-wide imagery coverage in this release. Reusable aerial imagery returned by the supported photo source can be a reference, but availability is not guaranteed.

Google's Map Tiles policy excludes image analysis, machine interpretation and geodata extraction: https://developers.google.com/maps/documentation/tile/policies
Wikimedia metadata: https://www.mediawiki.org/wiki/API:Imageinfo
Reuse/attribution: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia

## Research budget and account failures

Default: up to **3 Responses calls**, **8 web-search tool calls**, **4 candidate photos**, and **24,000 combined maximum output tokens** (8,000 research + 10,000 design + 6,000 review). Reasoning uses high/high/medium. At most one preview refinement runs at a time and six refinement starts per hour are permitted in this local workspace. The total wall-clock deadline is seven minutes. This is a token/call budget, not an exact monetary cap. Search/image inputs and reasoning can have additional usage costs; actual response token usage is shown.

`OPENAI_PREVIEW_MODEL` overrides the preview model. Otherwise `OPENAI_RECONSTRUCTION_MODEL`, then `OPENAI_MODEL`, then `gpt-6-astra` is used. Existing private keys in `.env` are reused; no key is returned to the browser. No API credit has been spent by the development tests. Do not reuse a previously exposed key.

429 handling reads only an allowlisted safe error code, distinguishing credit/quota/spend-limit issues from temporary rate limits. It never returns or logs raw provider error text. There is no automatic paid retry. Retry-After is retained for the explicit refine action. Repeated creation for the same normalised property returns its saved preview, not another paid job. `Refine again with AI` deliberately starts an additional bounded job.

Official API references: https://developers.openai.com/api/docs/guides/tools-web-search ; https://developers.openai.com/api/docs/guides/error-codes ; https://developers.openai.com/api/docs/models/gpt-6-astra

## Persistence and controls

New `quick_previews`, `quick_preview_requests` and `quick_preview_runs` tables live in the existing SQLite database and are covered by the existing backup command. They do not write estimated components into the inspection/locations register or overwrite primary evidence models. The property page links to the separate illustrative preview.

Polling does not charge or restart work. Cancellation and manual adjustment invalidate the worker's generation number so a late AI response cannot overwrite the saved result. Stopping/restarting the PC retains the last usable model and does not automatically replay paid requests. A changed spec remains a user estimate. Existing source-backed model activation remains a separate reviewed workflow.

The UI provides floor isolation, cutaway/explode, rotation, zoom, exact rendered-mesh GLB export and simple main-block dimensions/roof adjustments. Cutaway reveals empty floor envelopes, not inferred flats or escape routes. The software-rendering fallback now uses a depth buffer for this preview so windows do not disappear behind large wall triangles.

## Validation / operational boundaries

30 new offline unit and real local HTTP/SQLite tests exercise geometry, roof export, empty-evidence creation, session/CSRF, duplicate charging protection, persistence, cancellation/edit races, safe 429 classification, photo licensing/host validation and the bounded three-pass research payload. Local tests run against the mounted original starter plus the new module; GitHub CI must run the full current repository before merge.

The agent-browser CLI is unavailable in the build environment and Chromium browser URL navigation is blocked by administrator policy. Offline Chromium checks used the real UI/geometry modules with synthetic API responses and a mocked history update; creation, manual adjustment, floor/cutaway/explode controls and a mobile viewport were checked without JavaScript errors or horizontal overflow. This is not live browser-to-server or physical iPhone testing. Real local HTTP endpoints were tested independently in Node.

Live paid OpenAI, Commons availability/precision and actual building similarity have not been acceptance-tested here. This remains a single local-owner development app, not a production service with customer/staff isolation, hosted worker uptime or payments. Keep it on loopback or a trusted LAN. The complete old workflow is retained; no provider refusal is bypassed.
