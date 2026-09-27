# Exterior photo research - v0.8.1

## The gap this fixes

The previous appearance pipeline searched ordinary web descriptions and queried Wikimedia Commons for photos using only the building name. Its final check received photo captions, not image pixels. A mapped footprint could therefore be correct while the facade remained a generic estimate. This release requests broader web image results and supplies retrieved photographs to both visual passes.

## What now happens

The existing name-and-postcode flow and immediate geometry are unchanged. During the automatic research job, the OpenAI Responses web-search tool requests image and text results. Its instructions use building name plus full postcode, followed by street/town and name variants. Independent developer, architect, property-listing and street photographs can be candidates. This is OpenAI web image search, not a direct Google Images connection or Google Maps/Street View capture.

Only actual provider-returned image_result records are eligible for downloading. URLs written in generated prose are not accepted as image results. The original publisher page and image link are retained. Candidate captions are bounded and obvious interiors, floor plans, map screenshots and proposed CGI are filtered. The model is instructed to reject other buildings with the same name, nearby properties and non-photographic proposals. These checks do not guarantee the identity of a surviving photograph.

The loader attempts at most eight of twelve candidates and delivers up to four unique photographs. It validates public HTTPS URLs, checks source/image robots rules, uses the existing DNS-pinned public-address downloader, and permits only bounded same-origin redirects. Refusals and rate limits stop requests to that host within the job; there is no login, CAPTCHA, mirror or access-block bypass. PNG/JPEG/WebP headers and dimensions are checked. Images are at most 2 MB each; total image-download budget is 8 MB and the loader deadline is 45 seconds. Commons remains a name-and-postcode-scoped fallback.

Actual image bytes are then supplied as high-detail input_image items to the appearance pass AND the final consistency check. The selected finish, roof style, indicative window columns and balconies can respond to those photographs. A source id alone is not described as seeing pixels. Fabricated photo ids are removed, and observations attributed to a rejected photo are not retained as supported facts.

## What the user sees

Overview shows eligible web candidates, retrieved photos, photos supplied to a completed appearance pass, and the number used by the current saved model. These are operational counts, not an accuracy score. The model summary explicitly says whether retrieved photos were used or whether the facade remains text-informed/generic. Sources retains original publisher links and identifies used versus candidate-only photos.

The exact independently mapped polygon remains enforced by the existing map adapter. Photo research does not replace it with a generic rectangle. The adapter now preserves the photo-use explanation in its summary. Intermediate research progress also preserves the last saved model's source metadata until a successful replacement model is available. Failed research retains usable geometry and does not repeat paid requests automatically.

## Boundaries

This improves the evidence supplied to appearance estimation, not the detail available in the rendering engine. The renderer still has a small selection of facade finishes and simplified windows, balconies and roof envelopes. This is not photographic texturing, photogrammetry or an exact reconstruction of each elevation. The postcode-selected footprint and the photo identity can still be wrong. Unseen sides, interiors, fire ratings and condition remain unknown.

Independent publisher photographs are transient research references, not a licensed texture library. They are not saved to the database, included as image bytes in exports or republished in a gallery. Source links and reference-only status are saved. Public visibility and robots access do not establish commercial reuse rights; publisher terms and appropriate permissions remain an operator consideration, particularly before a public service. The existing authorised drawing-import workflow is unchanged.

Google Maps/Street View/3D tile imagery and map-image proxies remain excluded. No Google account, Google API key, extra search subscription or runtime package is required for this implementation. Availability depends on the configured OpenAI model supporting the documented web image-search fields and on publishers making usable images accessible. No returned images means an explicit estimated appearance, not a hidden claim of photo analysis.

## Budget and update

The existing maximum three Responses requests, eight web tool calls and 24,000 output-token allowance are unchanged. The final pass now receives images as well, so image-input usage can increase; this is not a fixed currency cap. Creating/refining a model uses the operator's configured API account. Installing the update, opening a saved model, polling and manual edits do not trigger paid inference.

Stop the server with Ctrl+C. From the existing propertychecked-platform folder, run each command separately:

```powershell
npm run backup
git pull --ff-only
npm run dev
```

Open http://localhost:3000/start in the browser and refresh. For a saved Queensgate model, choose Run another research pass. Existing saved previews do not regenerate just because the app was updated. The visible version is 0.8.1. Preserve .env, .data, private-assets and backups.

## Validation

The full current repository, obtained as a tracked-code-only GitHub artifact, passed 311 offline unit and actual local HTTP/SQLite tests on Node 22.16.0 after these changes. This includes 27 new tests for image-result parsing, URL/policy checks, image dimensions, deduplication, delivered pixel payloads, rejected-photo provenance, mapped polygon preservation, status persistence and no paid replay. Final GitHub Node 22 and Node 24 checks must pass before merge.

No live paid AI request, real Queensgate photo match or appearance similarity has been acceptance-tested during development. The browser helper was attempted but unavailable; Chromium navigation to the actual local server was blocked by administrator policy. That restriction was not bypassed. HTTP endpoints were tested directly, but this release does not claim live browser-to-server or physical iPhone acceptance. The temporary code-snapshot workflow is removed from the final product tree.

## Primary API reference

OpenAI web search image results: https://developers.openai.com/api/docs/guides/tools-web-search

The implementation uses search_content_types, image_settings, web_search_call.results, and the returned image_url/source_website_url fields. Those image URLs are independently checked before retrieval; generated prose is not a download instruction.
