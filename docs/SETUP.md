# Local setup in VS Code

## Open the app

1. Install Node.js 24 LTS. Node.js 22.16 or newer is also supported by this starter.
2. Extract the entire ZIP. Do not open `index.html` directly and do not run inside the ZIP preview.
3. In VS Code use **File > Open Folder** and choose the folder containing `package.json`.
4. Select **Terminal > New Terminal** and run `npm run dev`.
5. Open `http://localhost:3000` in the browser on the PC.

There are no third-party runtime packages to install. `npm ci` is supported for CI, but is not required for this preview. `npm run dev` starts a real local web server; the old phone HTML-attachment preview is not used.

`F5` also runs the server through the supplied VS Code launch configuration. Do not start both F5 and `npm run dev` on the same port. Backend changes restart automatically in dev mode; refresh the browser after front-end changes.

## First walkthrough

Open Marketfield Court. Choose 7F, then Compare plan. Select a location, add a note, and save it. The note is stored in the PC database, not just browser storage. Create a task and review it in Tasks. Open Configure survey, choose a package and modules, enter the scope and save the local request. No email or payment occurs.

Use **Create 3D model** to search by postcode, Maps link or pin coordinates. Approve the public lookup, select the intended outline, review heights and save. New exterior models are generated from selected public outlines, not from the Marketfield interior. Ordinary manual records without a generated model still start with model pending. See AUTO-MODELS.md for source limits and optional GPT settings.

## GitHub

GitHub has not been changed remotely by this delivery. In VS Code, open the Command Palette (`Ctrl+Shift+P`) and choose **Publish to GitHub**. Select private visibility. The intended repo name is `propertychecked-platform` under `jamiekelly564`.

Review the file list. `.env`, `.data`, `private-assets/marketfield`, uploads and backups must not be published. `.gitignore` already excludes them. If a repo already exists, clone it into a new folder and review before copying this starter. Do not put the app inside `firechecked_app` or `firechecked_portal`.

The optional `npm run github:publish` script requires Git and GitHub CLI. It does not require credentials in any project file. Account login happens in a browser through `gh auth login --web`.

## Phone preview

Use `npm run dev:lan` only on trusted home or office Wi-Fi. It binds to the LAN and requires a randomly generated access code, printed on the PC. Enter the printed LAN address in Safari; `localhost` on the phone means the phone itself, not the PC. The phone and PC must be on the same reachable network. Guest networks may block device-to-device traffic.

If asked by the PC firewall, restrict access to the private network. Do not disable the firewall globally, use public Wi-Fi, forward a router port, or publish this app as a public site. LAN mode uses HTTP, not TLS. The generated code changes at server restart unless `LOCAL_ACCESS_CODE` is set privately in `.env`.

## Updating an existing installation

Follow [UPDATING.md](UPDATING.md). Stop the server and back up first. Copy updated code into the existing project without replacing `.data`, `.env` or `private-assets`. Refresh the browser with Ctrl+F5.

## Optional postcode lookup

In Setup & connections, enable live postcode lookup only when you want entered postcodes sent to `api.postcodes.io`. It supplies postcode-level geographic data, not building boundaries or an address list. A failed external request is reported rather than replaced with invented geometry. This older setting controls the manual-record lookup only. The new Create 3D model page requests its own explicit lookup consent and uses the internet for new postcode/footprint searches. Previously saved models remain local.

## Troubleshooting

- `npm` is not recognised: install Node.js, close VS Code and reopen it.
- SQLite import error: use Node 24 LTS or at least 22.16, then rerun.
- An experimental SQLite warning on Node 22 is expected; it is not a failed startup.
- Port 3000 is occupied: stop the previous app, or copy `.env.example` to `.env` and set `PORT=3001`.
- Missing model pack after cloning: restore `private-assets/marketfield` from the private starter download and restart.
- Model loads slowly: open the standalone viewer from its fallback link, or test one level rather than the whole building. Physical iPhone performance has not been verified here.
- PowerShell blocks `npm.ps1`: use `npm.cmd run dev` instead of weakening execution policy.
- No outlines returned: try a more precise building pin. Mapping coverage varies; no substitute shape is generated.
- Maps link unsupported: paste its postcode or the exact latitude, longitude instead.
- Footprint service busy: wait a minute and retry once. Do not repeatedly hammer the public API.
- GPT checkbox disabled: add OPENAI_API_KEY privately to .env, then restart. This is optional.
- Unsaved task conflict: reopen the record and review the latest value before saving again.

## Backups

Run `npm run backup`. Backups are local and Git-ignored. For the most consistent database-and-files backup, stop active editing first. To restore, stop the server, keep a copy of the current `.data`, restore `workspace.sqlite` and `uploads` into `.data`, and restart. Keep the original private model pack separately.

## Official setup references

- Node.js downloads: https://nodejs.org/en/download
- Node SQLite support: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- VS Code repository publishing: https://code.visualstudio.com/docs/sourcecontrol/repos-remotes
- GitHub CLI private repository creation: https://cli.github.com/manual/gh_repo_create
- Postcode-area API: https://postcodes.io/docs/postcode/lookup/

These references describe the tools, not a claim that your accounts have been connected to the application.
