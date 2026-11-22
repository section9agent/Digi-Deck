// Library backup and restore.
// A backup is a folder: one database per player (a consistent copy made with VACUUM INTO), every picture the libraries use
// (covers, labels, J-cards, adjusted images ... wherever they are on disk) copied into files/, and a manifest. The copied
// databases point at those copies, so a backup can be restored on another computer. Music files are not copied; their paths
// are kept as they are.
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const IMG = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
const TOKEN = 'ddbackup:';
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`; };
const asPath = v => { if (typeof v !== 'string' || v.length > 1000) return null; let p = v; if (/^file:\/\//i.test(p)) { try { p = decodeURIComponent(new URL(p).pathname); if (/^\/[a-z]:/i.test(p)) p = p.slice(1); } catch { return null; } } return IMG.test(p) && path.isAbsolute(p) ? p : null; };
const textCols = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().filter(c => !c.type || /TEXT|CHAR|CLOB/i.test(c.type)).map(c => c.name);
const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);

async function backup(store, modes, outDir, appVersion) {
  const dir = path.join(outDir, `Digi-Deck backup ${stamp()}`);
  fs.mkdirSync(path.join(dir, 'db'), { recursive: true }); fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const copied = new Map(), counts = {}; let images = 0, missing = 0;
  for (const m of modes) {
    const file = path.join(dir, 'db', m + '.db');
    store.db(m).exec(`VACUUM INTO ${q(file)}`);
    const db = new DatabaseSync(file);
    try {
      counts[m] = db.prepare('SELECT COUNT(*) AS n FROM albums').get().n;
      for (const t of tables(db)) {
        const cols = textCols(db, t); if (!cols.length) continue;
        const rows = db.prepare(`SELECT rowid AS _r, ${cols.map(c => `"${c}"`).join(',')} FROM "${t}"`).all();
        for (const row of rows) for (const c of cols) {
          const p = asPath(row[c]); if (!p) continue;
          let rel = copied.get(p);
          if (rel === undefined) {
            rel = null;
            if (fs.existsSync(p)) { rel = 'files/' + crypto.createHash('sha1').update(p).digest('hex').slice(0, 20) + path.extname(p).toLowerCase(); await fs.promises.copyFile(p, path.join(dir, rel)); images++; }
            else missing++;
            copied.set(p, rel);
          }
          if (rel) db.prepare(`UPDATE "${t}" SET "${c}"=? WHERE rowid=?`).run(TOKEN + rel, row._r);
        }
      }
    } finally { db.close(); }
  }
  const manifest = { app: 'Digi-Deck', kind: 'library-backup', version: 1, appVersion, created: new Date().toISOString(), players: counts, images, missingImages: missing };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, 'README.txt'), `Digi-Deck library backup (${manifest.created})\r\n\r\nEvery player's library (${Object.entries(counts).map(([m, n]) => `${m}: ${n}`).join(', ')}) with all of its pictures (${images}).\r\nTo restore it: Settings > General > Restore from backup..., and choose this folder.\r\nYour music files are not included - the libraries point at them where they are.\r\n`);
  return { dir, players: counts, images, missing };
}

function readManifest(dir) {
  try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); return m && m.kind === 'library-backup' ? m : null; } catch { return null; }
}

// Restore: the current libraries are first saved to <userData>/backups/before-restore ..., then every player's albums and tracks
// are replaced by the backup's. Pictures are copied to <userData>/art/restored/.
async function restore(store, modes, dir, userData, appVersion) {
  const man = readManifest(dir); if (!man) throw new Error('That folder is not a Digi-Deck library backup (no manifest.json).');
  const safety = await backup(store, modes, path.join(userData, 'backups'), appVersion).catch(() => null);
  const artDir = path.join(userData, 'art', 'restored'); fs.mkdirSync(artDir, { recursive: true });
  const files = path.join(dir, 'files');
  if (fs.existsSync(files)) for (const f of fs.readdirSync(files)) { const dst = path.join(artDir, f); if (!fs.existsSync(dst)) await fs.promises.copyFile(path.join(files, f), dst); }
  const out = {};
  for (const m of modes) {
    const src = path.join(dir, 'db', m + '.db'); if (!fs.existsSync(src)) continue;
    const live = store.db(m);
    // work on a temporary copy, so the backup folder itself is never changed
    const tmp = path.join(userData, `restore-${m}.tmp.db`); try { fs.unlinkSync(tmp); } catch {}
    fs.copyFileSync(src, tmp);
    const b = new DatabaseSync(tmp); let bTables = [];
    try {
      bTables = tables(b);
      for (const t of tables(b)) for (const c of textCols(b, t)) b.prepare(`UPDATE "${t}" SET "${c}"=? || substr("${c}", ?) WHERE "${c}" LIKE ?`).run(artDir + path.sep, TOKEN.length + 'files/'.length + 1, TOKEN + 'files/%');
    } finally { b.close(); }
    live.exec('PRAGMA foreign_keys = OFF');
    try {
      live.exec(`ATTACH DATABASE ${q(tmp)} AS bk`);
      live.transaction(() => {
        const have = new Set(tables(live));
        for (const t of ['tracks', 'albums']) live.exec(`DELETE FROM main."${t}"`);
        const order = ['albums', 'tracks', ...bTables.filter(t => t !== 'albums' && t !== 'tracks')];
        for (const t of order) {
          if (!have.has(t)) continue;
          const mine = new Set(live.prepare(`PRAGMA main.table_info("${t}")`).all().map(c => c.name));
          const theirs = live.prepare(`PRAGMA bk.table_info("${t}")`).all().map(c => c.name).filter(c => mine.has(c));
          if (!theirs.length) continue;
          if (t !== 'albums' && t !== 'tracks') live.exec(`DELETE FROM main."${t}"`);
          const cl = theirs.map(c => `"${c}"`).join(',');
          live.exec(`INSERT INTO main."${t}" (${cl}) SELECT ${cl} FROM bk."${t}"`);
        }
      })();
      out[m] = live.prepare('SELECT COUNT(*) AS n FROM albums').get().n;
    } finally { try { live.exec('DETACH DATABASE bk'); } catch {} live.exec('PRAGMA foreign_keys = ON'); try { fs.unlinkSync(tmp); } catch {} }
  }
  return { players: out, safety: safety && safety.dir, created: man.created };
}

module.exports = { backup, restore, readManifest };
