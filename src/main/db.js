// Completely separate SQLite databases, one per player: vinyl.db, cd.db, cassette.db, micro.db, reel.db (every new player gets its own).
// Same schema in each, but nothing is shared between them.
const path = require('path');
const fs = require('fs');
// Node's built-in SQLite (Electron 35+ / Node 22.5+): no native module to compile.
const { DatabaseSync } = require('node:sqlite');

// Tiny wrapper adding the one helper we use (transactions).
class DB {
  constructor(file) {
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
  exec(sql) { return this.raw.exec(sql); }
  prepare(sql) { return this.raw.prepare(sql); }
  transaction(fn) {
    return (...args) => {
      this.raw.exec('BEGIN');
      try { const r = fn(...args); this.raw.exec('COMMIT'); return r; }
      catch (e) { try { this.raw.exec('ROLLBACK'); } catch {} throw e; }
    };
  }
}

const MODES = ['vinyl', 'cd', 'cassette', 'micro', 'reel'];
// vinyl: one label (and, for picture discs, one full-disc image) per side, A-H = up to four records
const SIDE_KEYS = 'abcdefgh'.split('');
const ART_SLOTS = ['front', 'back', 'jcard', 'spine', ...SIDE_KEYS.map(k => 'label_' + k), ...SIDE_KEYS.map(k => 'pic_' + k)];

// Columns added after v0.1.0 - added to existing databases on startup.
//   color        vinyl colour (vinyl.db) or cassette shell colour (cassette.db): preset id or #rrggbb
//   picture_disc 1 = vinyl is a picture disc; pic_a / pic_b are the full-disc images
//   release_type '' (auto) | album | single | maxi
//   disc_size    '' (auto) | 5 | 3   (CD only)
const EXTRA_COLUMNS = {
  color: "TEXT DEFAULT ''", picture_disc: 'INTEGER DEFAULT 0', pic_a: "TEXT DEFAULT ''", pic_b: "TEXT DEFAULT ''",
  release_type: "TEXT DEFAULT ''", disc_size: "TEXT DEFAULT ''",
  spine: "TEXT DEFAULT ''",                        // reel to reel: the box spine
  reel_full: "TEXT DEFAULT ''",                     // reel to reel: '1' when the label picture covers the whole reel face
  reel_type: "TEXT DEFAULT ''",                    // reel to reel: 'generic' (7" plastic reel, 48 min a side) or 'retail' (1200 ft, 32 min a side)
  jcard_adj: "TEXT DEFAULT ''",                   // J-card: {z,ox,oy} pan/zoom used for the shelf spine + cover (the stored image itself stays whole)
  side_minutes: 'INTEGER DEFAULT 0',            // vinyl: playing-time limit per side in minutes (0 = default 25)
  sides: 'INTEGER DEFAULT 0',                       // vinyl / cassette: number of sides (2 = one record or tape, 4 = double ...); CD: number of discs; 0 = from the tracks
  ...Object.fromEntries(SIDE_KEYS.slice(2).flatMap(k => [['label_' + k, "TEXT DEFAULT ''"], ['pic_' + k, "TEXT DEFAULT ''"]]))
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS albums(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'album',      -- album | set | single
  artist TEXT DEFAULT '', title TEXT DEFAULT '', year TEXT DEFAULT '',
  label TEXT DEFAULT '', catno TEXT DEFAULT '',
  discogs_id TEXT DEFAULT '', mbid TEXT DEFAULT '',
  front TEXT DEFAULT '', back TEXT DEFAULT '', jcard TEXT DEFAULT '',
  label_a TEXT DEFAULT '', label_b TEXT DEFAULT '',
  is_generic INTEGER DEFAULT 0,
  source_path TEXT DEFAULT '',
  added INTEGER, updated INTEGER, last_played INTEGER
);
CREATE TABLE IF NOT EXISTS tracks(
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT DEFAULT '', artist TEXT DEFAULT '',
  duration REAL DEFAULT 0, side TEXT DEFAULT 'A', path TEXT DEFAULT '',
  PRIMARY KEY(album_id, idx)
);
`;

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.dbs = {};
    for (const m of MODES) {
      const db = new DB(path.join(dir, `${m}.db`));
      db.exec(SCHEMA);
      const have = new Set(db.prepare('PRAGMA table_info(albums)').all().map(c => c.name));
      for (const [col, type] of Object.entries(EXTRA_COLUMNS)) if (!have.has(col)) db.exec(`ALTER TABLE albums ADD COLUMN ${col} ${type}`);
      this.dbs[m] = db;
    }
  }
  db(mode) {
    if (!this.dbs[mode]) throw new Error('Unknown mode ' + mode);
    return this.dbs[mode];
  }
  _hydrate(mode, row) {
    if (!row) return null;
    const tracks = this.db(mode).prepare('SELECT idx,title,artist,duration,side,path FROM tracks WHERE album_id=? ORDER BY idx').all(row.id);
    return { ...row, is_generic: !!row.is_generic, picture_disc: !!row.picture_disc, tracks };
  }
  getByKey(mode, key) {
    return this._hydrate(mode, this.db(mode).prepare('SELECT * FROM albums WHERE key=?').get(key));
  }
  getById(mode, id) {
    return this._hydrate(mode, this.db(mode).prepare('SELECT * FROM albums WHERE id=?').get(id));
  }
  list(mode) {
    return this.db(mode).prepare(
      `SELECT a.id,a.key,a.kind,a.artist,a.title,a.year,a.front,a.back,a.jcard,a.spine,a.reel_type,a.reel_full,a.jcard_adj,a.is_generic,a.last_played,a.release_type,a.disc_size,a.sides,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id=a.id) AS track_count,
              (SELECT COALESCE(SUM(t.duration),0) FROM tracks t WHERE t.album_id=a.id) AS total_sec
       FROM albums a ORDER BY lower(a.artist), lower(a.title)`).all();
  }
  save(mode, album) {
    const db = this.db(mode);
    const now = Date.now();
    const f = ['kind', 'artist', 'title', 'year', 'label', 'catno', 'discogs_id', 'mbid', 'front', 'back', 'jcard', 'spine', 'reel_type', 'reel_full', 'jcard_adj', 'source_path', 'color', 'release_type', 'disc_size', ...SIDE_KEYS.map(k => 'label_' + k), ...SIDE_KEYS.map(k => 'pic_' + k)];
    const tx = db.transaction(() => {
      let id = album.id;
      if (id) {
        db.prepare(`UPDATE albums SET ${f.map(x => x + '=@' + x).join(',')}, sides=@sides, side_minutes=@side_minutes, is_generic=@is_generic, picture_disc=@picture_disc, updated=@updated WHERE id=@id`)
          .run({ ...Object.fromEntries(f.map(x => [x, album[x] ?? ''])), sides: album.sides | 0, side_minutes: album.side_minutes | 0, is_generic: album.is_generic ? 1 : 0, picture_disc: album.picture_disc ? 1 : 0, updated: now, id });
      } else {
        const r = db.prepare(`INSERT INTO albums(key,${f.join(',')},sides,side_minutes,is_generic,picture_disc,added,updated) VALUES(@key,${f.map(x => '@' + x).join(',')},@sides,@side_minutes,@is_generic,@picture_disc,@added,@updated)`)
          .run({ key: album.key, ...Object.fromEntries(f.map(x => [x, album[x] ?? ''])), sides: album.sides | 0, side_minutes: album.side_minutes | 0, is_generic: album.is_generic ? 1 : 0, picture_disc: album.picture_disc ? 1 : 0, added: now, updated: now });
        id = Number(r.lastInsertRowid);
      }
      db.prepare('DELETE FROM tracks WHERE album_id=?').run(id);
      const ins = db.prepare('INSERT INTO tracks(album_id,idx,title,artist,duration,side,path) VALUES(?,?,?,?,?,?,?)');
      (album.tracks || []).forEach((t, i) => ins.run(id, i, t.title || '', t.artist || '', t.duration || 0, t.side || 'A', t.path || ''));
      return id;
    });
    return this.getById(mode, tx());
  }
  touch(mode, id) {
    this.db(mode).prepare('UPDATE albums SET last_played=? WHERE id=?').run(Date.now(), id);
  }
  remove(mode, id) {
    this.db(mode).prepare('DELETE FROM albums WHERE id=?').run(id);
  }
}

module.exports = { Store, MODES, ART_SLOTS, EXTRA_COLUMNS };
