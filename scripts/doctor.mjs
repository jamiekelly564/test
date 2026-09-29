const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<16)){console.error('PropertyChecked needs Node.js 22.16 or newer. Install Node.js 24 LTS, restart VS Code, then run npm run dev again.');process.exit(1);}
try{await import('node:sqlite');}catch{console.error('This Node.js installation does not include SQLite. Install Node.js 24 LTS.');process.exit(1);}
// Restore only a locally downloaded, hash-pinned recovery pack. No network or prompts.
try { const { autoRestoreMarketfield } = await import('./auto-restore-marketfield.mjs'); await autoRestoreMarketfield(); }
catch (error) { console.warn('[Marketfield] Local model setup could not finish: ' + error.message + ' Your existing files are preserved.'); }
