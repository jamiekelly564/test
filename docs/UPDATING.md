# Update v0.1 to v0.2 without losing your building records

## Use the update-only ZIP for an existing workspace

1. In the VS Code terminal running PropertyChecked, press **Ctrl+C** to stop the server.
2. In that same project folder, run **npm run backup**. It snapshots the database and uploaded files. Keep the original model pack separately.
3. Extract `PropertyChecked-Auto-Models-Update.zip` into a temporary folder.
4. Inside the extracted `propertychecked-platform` folder, select **all its contents**, including the `apps`, `packages`, `docs` and `tests` folders, and copy them **into your existing project folder** (the one containing `package.json`). Allow Windows to replace the code files. Do not create a nested project inside it.
5. Leave your existing `.data`, `.env`, `private-assets` and `backups` folders/files where they are. The update ZIP does not contain replacements for them.
6. In VS Code, open the existing project and run **npm run dev**. Refresh the browser, using **Ctrl+F5** once to discard the old JavaScript.
7. Open **Create 3D model** from the sidebar. The sidebar version should say **v0.2.0**.

No `npm install` is needed. Use Node.js 24 LTS or 22.16+.

The new database migration adds a separate `generated_models` table. Existing buildings, documents, tasks, requests and the Marketfield model are retained. Keep a backup before any update; do not edit SQLite manually.

## New installation

Use `PropertyChecked-Auto-Models-Full.zip`, extract it and open its `propertychecked-platform` folder in VS Code. Run `npm run dev` and open http://localhost:3000. This contains the original private Marketfield pack but no personal runtime database or test fixtures.

Do not run a fresh extracted folder expecting your old notes to appear there: each folder has its own `.data` unless configured otherwise. For existing work, the update-only route above is recommended.

## Optional GPT setup

In the project root, create `.env` from `.env.example` only if `.env` does not already exist. Add or edit:

```dotenv
OPENAI_API_KEY=your_private_api_key_here
OPENAI_MODEL=gpt-6-astra
```

Use your actual key only in that private file. Do not put it in browser JavaScript, GitHub or chat. Preserve any existing PORT/data-path/LAN settings. Restart PropertyChecked after editing the environment. The GPT checkbox is optional and model generation without AI remains available.

If PowerShell blocks npm.ps1, use `npm.cmd run dev`, not a weaker execution policy. An ENOENT for package.json means the terminal is not in the project folder.
