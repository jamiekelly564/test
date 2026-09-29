# Automatic local Marketfield recovery

This setup repair removes the need to select a project folder or run the old recovery launcher. It does not publish the private model to GitHub or require changing repository visibility.

## Normal startup

Keep the original `Marketfield-Court-Recovery-Pack.zip` in this PC's Downloads folder. Duplicate browser filenames such as `Marketfield-Court-Recovery-Pack (2).zip` are supported. An extracted Marketfield recovery folder in Downloads is supported too; no extraction is required for the ZIP route.

Stop the old server, then run these separately in your actual PropertyChecked project:

```powershell
cd "C:\Users\jamie\Documents\PropertyChecked"
git pull --ff-only
npm.cmd run dev
```

The existing `predev`/`prestart` doctor now checks for a missing private model. It searches only named Marketfield recovery packs in Downloads and the running project's root, verifies the original recovery manifest and every copied file, and installs into that project's `private-assets/marketfield`. The target project is resolved from the installed script, not a fixed Documents or Downloads project path. It works with either of the user's previously used project locations.

Successful first startup prints:

```
[Marketfield] Restored 33 verified files into this project's private-assets/marketfield. No folder selection needed. No files uploaded.
```

Open `http://localhost:3000/marketfield` in a browser. Once restored, subsequent starts do not need the downloaded ZIP. A Git pull supplies the installer code; the private model bytes still come from the local recovery pack, not GitHub.

## Preservation and failure handling

An existing model is left alone. A populated but incomplete model folder is preserved, not repaired over existing work. An empty folder from a previous failed attempt can be filled. No database, `.env`, application source, existing management record, source ZIP or other model is replaced. All 33 recovery files are copied unchanged, including the original authoring/source files. Existing model estimates and missing-plan limitations remain.

Missing packs produce a specific Downloads message and do not prevent opening the register. Altered/unrecognised packs fail verification. The old recovery `.cmd`/`.mjs` is never executed. Installation uses a bounded ZIP32 reader, a separately pinned SHA-256 for the original restore manifest, per-file hashes, symlink/path checks, private-asset Git exclusion checks, exclusive staging/locking and a final rename. Only a digest is stored in Git; no private model or download credential is embedded in the helper.

The installer does not make network requests, use AI credit, extract arbitrary archives, change PowerShell execution policy or edit GitHub settings. CI does not perform automatic restoration. Set the environment variable `PROPERTYCHECKED_AUTO_RESTORE=0` before startup to disable it. A stale setup lock after a crash is not silently stolen. Another running server still needs to be stopped normally before restarting.

## Verification

22 new synthetic tests cover ZIP parsing, stored/deflate entries, unsafe/duplicate paths, symbolic links, corrupt/oversized output, manifest trust, modified files, target preservation, locks, concurrent target creation, privacy exclusions, path-independent installation, duplicate download filenames, bounded discovery, no-pack messaging and disabled startup.

The available local code snapshot passed its 400 prior tests plus these 22 tests, and syntax/private-data checks. The full current-main suite must also pass in GitHub CI on Node 22 and Node 24 before this change is merged; the local snapshot does not include all later UI/management tests.

Separately, the actual supplied 33-file recovery ZIP was restored into a disposable custom project directory on Linux / Node 22.16.0. The existing server imported its 223 model locations and ten levels. Session-authorised HTTP requests returned the recovered viewer and GLB successfully; a second installer call kept the installed model. This was a file/HTTP integration check, not a new building survey, browser-rendering test, Windows device test or paid AI run. No actual recovery files or private test snapshots are committed with this repair.
