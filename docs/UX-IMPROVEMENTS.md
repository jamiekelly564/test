# Easier building previews - v0.7.0

This release improves the existing instant-estimate journey. It does not add a new imagery provider, improve measured accuracy, spend API credit during installation, or make the local app a production customer portal.

## Start and update

Stop the running server with Ctrl+C. In your existing propertychecked-platform folder run each command separately: `npm run backup`, `git pull --ff-only`, `npm run dev`. Stop on any error. Open `http://localhost:3000/start` in the browser and refresh. Keep .env, .data, private-assets and backups. No dependency installation is required.

On Windows, `Start-PropertyChecked.cmd` can also be double-clicked from the project folder after updating. It changes to its own folder and starts the existing npm development command, avoiding parent-folder mistakes. Keep its terminal open and stop the previous server first. This helper does not install Node, update Git, change .env or kill another process. It has not been tested on a physical Windows PC in the build environment.

## Customer-facing changes

- A two-field welcome screen becomes a model-focused workspace after creation. Input errors are inline, postcodes are formatted, and saved estimates have searchable cards. Starting a preview still immediately creates estimated geometry; no new source-approval gate is introduced.
- Large Exterior, Cutaway and Floors apart controls, floor selection, zoom buttons, top view and Fit view. Expand uses an in-page large viewer, not a browser-specific fullscreen dependency. Escape restores the page. Portrait screens and isolated upper floors are fitted and centred independently.
- Overview, Adjust and Sources tabs separate the useful actions from detailed provenance. Estimate labels distinguish a generic starting concept, research-informed estimate, uncertain match and user adjustment. A completed research pass is not shown as a verified building. Skipped or failed research is not falsely marked complete.
- Adjust any building section: storeys, roof, finish and balconies, with dimensions and window columns in a collapsible section. Changes render locally before saving. Save and Discard are explicit. Neither editing nor undo calls AI.
- Unsaved edits survive status polling and connection loss. If research changes the underlying geometry, saving is blocked until the user discards the stale edit and checks the latest model. Metadata-only updates do not unnecessarily discard edits. Leaving a dirty page warns the user.
- The last saved manual correction has a persistent Undo. It is version checked, restores its source/basis metadata and survives a normal server restart. It is one undo point, not a full revision timeline. A later research/model revision invalidates it rather than restoring over newer work.
- Additional AI refinement explains that it is another operator-funded job before starting. The existing automatic first refinement remains covered by the creation notice. Existing research budgets are unchanged.
- A reconnect banner keeps the model visible, retries reads only, and can establish a new session after a PC restart. It never automatically replays a paid POST. Pending create references help recover a lost response without another research submission.
- Export offers the saved GLB and a PNG of the current view stamped Estimated / not surveyed. Unsaved visual edits must be saved before GLB export; PNG snapshots identify an unsaved view. Copy link explicitly means a link to this PC, not a public share link.
- A wrong-building action returns to the name/postcode entry without deleting the existing estimate. Adding plans/photos and exploring survey options remain linked to the existing workflows; no payment or appointment is taken.

## Keyboard and responsive behaviour

The interface has a skip link, visible focus, labelled fields, live status feedback, keyboard-operable tabs, expanded-view focus containment and reduced-motion styles. The 320px and 390px viewport checks had no horizontal page overflow. This is not a claim of a complete accessibility audit or physical iPhone testing.

## Server and data changes

`GET /api/previews/config` returns configuration presence and processing limits, never credentials. Saved-card summaries omit the full model and source metadata. `POST /api/previews/:id/undo` uses the existing host/session/CSRF guards and optimistic version checks.

`quick_preview_undo` is an additive SQLite table. Editing saves the checkpoint and geometry atomically. Epoch guards stop cancelled or superseded AI responses from overwriting a saved adjustment. No table of inspected assets, primary evidence model, Marketfield pack, account configuration or provider-access policy is replaced. Backups cover the additional table.

## Validation and remaining limits

29 new unit and real local HTTP/SQLite tests cover input formatting, honest stage labels, local edits, versioned undo, restart persistence, late AI responses, session/CSRF, safe diagnostics, card data and viewport fitting. All 81 tests available in the mounted starter-plus-preview workspace passed, as did syntax and private-data checks. Full current-repository regressions must pass in GitHub CI before merging.

The agent-browser command was attempted but is unavailable. Browser navigation to localhost was blocked by administrator policy, so it was not bypassed. Offline Chromium checks used the real UI and geometry modules with synthetic building data and mocked API/history responses; real Node HTTP endpoints were tested separately. Tested interactions include creation, live edits, save/undo, camera controls, research-update conflicts, connection recovery, saved-building search, export and keyboard tabs. No browser JavaScript errors were observed. Screenshots show a synthetic example, not a verified reconstruction.

No live paid OpenAI request, real imagery match, physical phone, Windows launch or production permission boundary was acceptance-tested. This release improves usability and error recovery, not building-data coverage. Keep the preview on loopback or trusted LAN.

## Suggested next work, not included

1. Improve geographic matching and first-shape fidelity with an authorised footprint/imagery feed and a small wrong-building pin correction.
2. Let users provide a facade photo plus a plain-language correction directly beside the model, with a clear permission and processing notice.
3. Add a before/after comparison and version timeline beyond the single manual undo point.
4. Add secure hosted view-only sharing and a simple survey quote journey after tenant authentication, permissions and deployment are implemented.
