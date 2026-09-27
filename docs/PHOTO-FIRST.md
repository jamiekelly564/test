# Photo-first building creation - v0.9.0

## The customer journey

New building name + postcode submissions now open a saved photo-search session instead of displaying a generic block as though it were the identified building. An indeterminate loading bar and actual stage messages show that work is in progress; percentages are not invented.

The user sees a retrieved candidate photograph and its original source link, then chooses **Yes, create my building** or **No, I'll add a photo**. Several candidates can be inspected. Yes is disabled until the chosen photo has loaded. No excludes those candidates and opens the upload area. The user may also deliberately continue without a photograph; that outcome stays an estimate.

`/build?building=...` is now the simple Photos & floor plans page. An existing building opens directly at the upload area without making the customer re-enter its name or postcode. The old technical drawing-management page remains at `/advanced-build`.

## Uploads and actual image inputs

Photos can be added by file picker, drag-and-drop or a supported phone camera picker. Supported photographs are JPEG, PNG and WebP. Large photos are resized on the device to a maximum 1800-pixel side and converted to JPEG, with a 2 MB processing limit. HEIC conversion is not implemented; convert unsupported photos to JPEG first. Physical iPhone camera behaviour still needs device testing.

PDF or image floor plans may be up to 25 MB per file. **Original plan bytes are retained; drawings are not resized or recompressed as facade photos.** The simple interface accepts up to twelve files per batch and forty files per building. Larger document packs still belong in the document workspace.

Uploads require the user to confirm permission and are saved as private workspace documents with unreviewed source metadata. Uploading alone never invokes AI. **Use my photos to create the model** explicitly sends up to four recent uploaded exterior photos to the configured AI service. Both appearance and consistency passes receive the exact selected photo inputs. There is no second automatic photo search that substitutes a different building after confirmation. Rejected web-photo notes are excluded from user-photo-only builds.

The existing Microsoft map outline can still be used. A customer's photo confirmation does not verify the postcode-selected footprint. Shape, facade, height and unseen sides may remain inaccurate. No Google Maps/Street View/3D tile extraction is added. Online photo discovery uses the configured OpenAI web image search with the existing Commons fallback, not a direct Google Images connection.

The rendering engine is still procedural: simplified finishes, windows, balconies and roof envelopes. This update improves the workflow and the supplied photographic evidence; it does not create photogrammetry or Google-quality textured models.

## Illustrative floor layouts

**Example layout** on the model page adds invented zones and low dividers inside the selected floor envelope, with a corresponding 2D layout. Supported courtyard holes remain empty. These are hypothetical arrangements, not rooms discovered from photographs. The page, viewer and PNG capture explicitly label them **ILLUSTRATIVE LAYOUT - INVENTED, NOT AN ACTUAL FLOOR PLAN**.

These concepts contain no asserted room identities, occupancy, stairs, fire doors or escape routes. They are not suitable for safety, compliance, construction or costing. No conceptual component is written to the inspected-asset register or evidence graph. The ordinary GLB export remains the saved exterior; invented interiors are not silently inserted into it.

Once a floor-plan source has been uploaded, the example-layout control is disabled and an open example view returns to the exterior on the next status refresh. **That does not mean an uploaded PDF has already been converted into measured rooms.** Real drawings are stored for processing and review in the preserved advanced workflow.

## Persistence, budgets and failure handling

New additive SQLite tables track photo sessions, temporary image candidates, file associations, request idempotency and processing starts. Existing models, Marketfield data, documents, notes, tasks, surveys and manual undo are preserved. Private user files remain in the existing upload directory and backups.

Retrieved web-image pixels are temporarily cached in session-protected SQLite for one hour and become unavailable after expiry. Expired records are removed on restart or the next processing start. Normal database backups can contain earlier cached records; active-cache expiry is not a promise of deletion from backups. Candidate images are not committed to GitHub or exported as model textures. Access checks and a building-identity confirmation do not grant a copyright licence; publisher permissions and terms remain relevant.

A search uses at most one existing Responses request, eight web tools and 8,000 output tokens. A confirmed build uses at most two visual requests with 16,000 combined maximum output tokens. This is not a fixed currency cap. The local photo workflow runs one worker at a time and permits twelve phase starts per hour. Repeated explicit searches or builds can incur additional usage. API Retry-After is retained and checked before another attempt on the session.

GETs, uploads, reconnects, manual edits and conceptual layouts do not start paid inference. Restart pauses unfinished work instead of replaying it. Selected photo IDs are private, building-bound records rather than arbitrary remote proxy URLs. Host, session, CSRF, size, signature and optimistic-version checks remain. A late visual result cannot overwrite a newer manual correction. Failed new photo interpretation preserves the prior appearance and its source metadata, with an explicit error; a successful first visual pass can survive failure of the final consistency check.

## Update

Stop the running terminal with Ctrl+C. In the existing propertychecked-platform folder, run `npm run backup`, then `git pull --ff-only`, then `npm run dev`, stopping if a command fails. Open `http://localhost:3000/start` in the browser and refresh. Existing `/build?building=...` links now open the simpler page. No new API key, dependency installation or replacement folder is needed.

For a saved Foundation House estimate, use **Add floor plans or photos**, add an exterior photograph, then choose **Use my photos to create the model**. Adding a file or reopening the page alone does not trigger AI.

## Validation and limits

The complete local repository passed 333 tests on Node 22.16.0: the previous 311 tests plus 22 new photo-first, upload, privacy, concurrency, retry and illustrative-layout tests. These use synthetic sources and mocked external services with real Node HTTP and SQLite. GitHub Node 22/24 checks must also pass before merging.

Browser navigation to localhost was blocked by administrator policy, and agent-browser was unavailable; those restrictions were not changed. Offline Chromium UI checks use actual application modules and synthetic photos/models with mocked API/history/upload responses. Real HTTP endpoints are tested separately. The earlier UI pass covered loading, photo confirmation, rejection/upload/build, invented layouts and hiding them after plan upload, with no observed JavaScript errors or horizontal overflow at 320/390px.

No paid live OpenAI request, actual Foundation House image match, measured similarity, physical iPhone/Windows acceptance test or public deployment is claimed. The product remains a single local-owner development workspace, not a production tenant-isolated portal.

Official image-search API reference: https://developers.openai.com/api/docs/guides/tools-web-search
