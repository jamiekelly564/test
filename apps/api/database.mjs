import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from './validation.mjs';

export function openWorkspace(filename, assetsDir) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS buildings(id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL DEFAULT '', model_key TEXT, basis TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS locations(id TEXT PRIMARY KEY, building_id TEXT NOT NULL REFERENCES buildings(id), title TEXT NOT NULL, type TEXT NOT NULL, floor_key TEXT NOT NULL, source TEXT NOT NULL, basis TEXT NOT NULL, summary TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', review_status TEXT NOT NULL DEFAULT 'not_reviewed', version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS surveys(id TEXT PRIMARY KEY, building_id TEXT NOT NULL REFERENCES buildings(id), tier TEXT NOT NULL, modules TEXT NOT NULL, coverage TEXT NOT NULL, preferred_date TEXT NOT NULL, notes TEXT NOT NULL, request_key TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, building_id TEXT NOT NULL REFERENCES buildings(id), location_id TEXT REFERENCES locations(id), title TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, building_id TEXT NOT NULL REFERENCES buildings(id), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, storage_name TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, building_id TEXT NOT NULL REFERENCES buildings(id), event_type TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generated_models(building_id TEXT PRIMARY KEY REFERENCES buildings(id), document TEXT NOT NULL, request_key TEXT UNIQUE NOT NULL, request_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    PRAGMA user_version=2;`);
  const now = () => new Date().toISOString();
  const event = (id, type, summary) => db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(randomUUID(), id, type, summary, now());
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  let manifest = null;
  const manifestPath = join(assetsDir, 'marketfield', 'manifest.json');
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    transaction(() => {
      const already = db.prepare('SELECT id FROM buildings WHERE id=?').get('marketfield');
      db.prepare('INSERT OR IGNORE INTO buildings VALUES(?,?,?,?,?,?,?)').run('marketfield', 'Marketfield Court', 'Marketfield Court - supplied model', '', 'marketfield', 'plan-derived + estimated', now());
      const insert = db.prepare('INSERT OR IGNORE INTO locations(id, building_id, title, type, floor_key, source, basis, summary) VALUES(?,?,?,?,?,?,?,?)');
      for (const a of manifest.assets) insert.run(a.id, 'marketfield', a.title, a.type, manifest.floors[a.floor]?.key || String(a.floor), a.source, a.basis, a.summary);
      if (!already) event('marketfield', 'model_imported', 'Imported the supplied plan-derived model and its separately identified estimates. No inspection results imported.');
    });
  }
  const building = id => {
    const row = db.prepare('SELECT * FROM buildings WHERE id=?').get(id);
    if (!row) throw new HttpError(404, 'Building not found.');
    return row;
  };
  const location = id => { const row = db.prepare('SELECT * FROM locations WHERE id=?').get(id); if (!row) throw new HttpError(404, 'Location not found.'); return row; };
  const task = id => { const row = db.prepare('SELECT * FROM tasks WHERE id=?').get(id); if (!row) throw new HttpError(404, 'Task not found.'); return row; };
  return {
    db, manifest, building, location, task,
    generatedRequest: key => db.prepare('SELECT building_id,request_hash FROM generated_models WHERE request_key=?').get(key),
    generatedModel: id => { building(id); const row=db.prepare('SELECT document FROM generated_models WHERE building_id=?').get(id); if(!row)throw new HttpError(404,'No generated exterior exists for this building.'); return JSON.parse(row.document); },
    addGeneratedBuilding: b => transaction(() => {
      const id=randomUUID(), time=now();
      db.prepare('INSERT INTO buildings VALUES(?,?,?,?,?,?,?)').run(id,b.name,b.address,b.postcode,'auto-exterior','public-data exterior + estimates',time);
      db.prepare('INSERT INTO generated_models VALUES(?,?,?,?,?)').run(id,JSON.stringify(b.model),b.requestKey,b.requestHash,time);
      event(id,'model_generated','Created an exterior from selected public footprints. Heights retain their own provenance. Interiors and condition not assessed.');
      return building(id);
    }),
    buildings: () => db.prepare(`SELECT b.*, (SELECT count(*) FROM locations l WHERE l.building_id=b.id) AS location_count, (SELECT count(*) FROM tasks t WHERE t.building_id=b.id AND t.status!='closed') AS open_tasks FROM buildings b ORDER BY b.created_at ASC`).all(),
    addBuilding: b => transaction(() => { const id = randomUUID(); db.prepare('INSERT INTO buildings VALUES(?,?,?,?,?,?,?)').run(id, b.name, b.address, b.postcode, null, 'user-entered / model pending', now()); event(id, 'building_created', 'Building record created. Geometry and address not verified.'); return building(id); }),
    locations: id => { building(id); return db.prepare('SELECT * FROM locations WHERE building_id=? ORDER BY floor_key,title').all(id); },
    updateLocation: (id, b) => transaction(() => { const before = location(id); const result = db.prepare('UPDATE locations SET notes=?,review_status=?,version=version+1 WHERE id=? AND version=?').run(b.notes, b.reviewStatus, id, b.version); if (!result.changes) throw new HttpError(409, 'This location changed in another window. Reopen it before saving.'); event(before.building_id, 'location_updated', `Updated notes / drawing review for ${id}. This is not an inspection pass.`); return location(id); }),
    surveys: id => { if (id) building(id); return db.prepare(`SELECT s.*,b.name AS building_name FROM surveys s JOIN buildings b ON b.id=s.building_id ${id?'WHERE building_id=?':''} ORDER BY s.created_at DESC`).all(...(id?[id]:[])).map(r => ({...r, modules:JSON.parse(r.modules), status:'saved_locally'})); },
    addSurvey: (buildingId, s) => transaction(() => { building(buildingId); const prior = db.prepare('SELECT * FROM surveys WHERE request_key=?').get(s.requestKey); if (prior) { if (prior.building_id !== buildingId || prior.tier !== s.tier || prior.coverage !== s.coverage || prior.modules !== JSON.stringify(s.modules) || prior.notes !== s.notes || prior.preferred_date !== s.preferredDate) throw new HttpError(409,'This request key was already used for different details.'); return { ...prior, modules:JSON.parse(prior.modules), status:'saved_locally', duplicate:true }; } const id = randomUUID(); const time = now(); db.prepare('INSERT INTO surveys VALUES(?,?,?,?,?,?,?,?,?)').run(id, buildingId, s.tier, JSON.stringify(s.modules), s.coverage, s.preferredDate, s.notes, s.requestKey, time); event(buildingId, 'survey_requested', `${s.tier} scope saved locally. No appointment, payment or email sent.`); return {...db.prepare('SELECT * FROM surveys WHERE id=?').get(id), modules:s.modules, status:'saved_locally', duplicate:false}; }),
    tasks: id => { if (id) building(id); return db.prepare(`SELECT t.*,b.name AS building_name,l.title AS location_title FROM tasks t JOIN buildings b ON b.id=t.building_id LEFT JOIN locations l ON l.id=t.location_id ${id?'WHERE t.building_id=?':''} ORDER BY t.created_at DESC`).all(...(id?[id]:[])); },
    addTask: (buildingId, t) => transaction(() => { building(buildingId); if (t.locationId && location(t.locationId).building_id !== buildingId) throw new HttpError(400, 'Location does not belong to this building.'); const id = randomUUID(), time = now(); db.prepare('INSERT INTO tasks(id,building_id,location_id,title,description,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,buildingId,t.locationId,t.title,t.description,t.priority,time,time); event(buildingId,'task_created',`Task created: ${t.title}`); return task(id); }),
    updateTask: (id,t) => transaction(() => { const before = task(id); if (!db.prepare('UPDATE tasks SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(t.status,now(),id,t.version).changes) throw new HttpError(409,'This task changed elsewhere. Refresh before updating.'); event(before.building_id,'task_updated',`Task ${before.title}: ${t.status}. No asset assessment changed.`); return task(id); }),
    documents: id => { building(id); return db.prepare('SELECT id,building_id,name,mime,size,sha256,created_at FROM documents WHERE building_id=? ORDER BY created_at DESC').all(id); },
    addDocument: (id,d) => transaction(() => { building(id); const documentId=randomUUID(); db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)').run(documentId,id,d.name,d.mime,d.size,d.storageName,d.sha256,now()); event(id,'document_uploaded',`Uploaded ${d.name}; stored only, not automatically assessed.`); return {id:documentId,name:d.name,size:d.size}; }),
    document: id => { const d=db.prepare('SELECT * FROM documents WHERE id=?').get(id); if(!d) throw new HttpError(404,'Document not found.'); return d; },
    events: id => { building(id); return db.prepare('SELECT * FROM events WHERE building_id=? ORDER BY created_at DESC LIMIT 100').all(id); },
    setting: (key, fallback) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? fallback,
    setSetting: (key,value) => db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value),
    close: () => db.close(),
  };
}
