// Media-library folder scanner: walks a root folder, finds every album, and files it in the chosen format libraries
// (artwork + release info are downloaded by Library.resolve, in the right format for each library).
const fs = require('fs');
const path = require('path');
const { isAudio, scanFolder } = require('./playlists');
const { scan, readTags, mapLimit } = require('./scan');

const DISC_DIR = /^(cd|disc|disk|side)\s*[-_ ]?\s*\d+\b/i;

// -> [{ dir, files:[...], recursive }]  One entry per album: a folder with audio files in it (multi-disc sub-folders
// like "CD1"/"Disc 2" are folded into their parent album).
function findAlbumDirs(root) {
  const direct = new Map(); // dir -> audio files directly inside
  const walk = d => {
    let items = [];
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    const files = [];
    for (const it of items) {
      const full = path.join(d, it.name);
      if (it.isDirectory()) { if (!it.name.startsWith('.') && !/^(@eaDir|\$RECYCLE\.BIN|System Volume Information)$/i.test(it.name)) walk(full); }
      else if (isAudio(full)) files.push(full);
    }
    if (files.length) direct.set(d, files);
  };
  walk(root);
  const albums = new Map();
  for (const [dir, files] of direct) {
    let key = dir, merged = false;
    if (DISC_DIR.test(path.basename(dir)) && path.dirname(dir) !== dir) { key = path.dirname(dir); merged = true; }
    if (!albums.has(key)) albums.set(key, { dir: key, files: [], recursive: false });
    const a = albums.get(key); a.files.push(...files); if (merged) a.recursive = true;
  }
  return [...albums.values()].map(a => ({ ...a, files: a.files.sort((x, y) => x.localeCompare(y, undefined, { numeric: true })) }));
}

// cheap change-detector so a re-scan only touches new / modified folders
function signature(files) {
  let newest = 0, size = 0;
  for (const f of files) { try { const st = fs.statSync(f); newest = Math.max(newest, st.mtimeMs); size += st.size; } catch {} }
  return `${files.length}:${Math.round(newest)}:${size}`;
}

class LibraryScanner {
  constructor({ library, indexFile, cacheDir, emit }) {
    this.library = library; this.indexFile = indexFile; this.cacheDir = cacheDir; this.emit = emit || (() => {});
    this.running = false; this.cancelled = false;
    try { this.index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { this.index = {}; }
  }
  _save() { try { fs.writeFileSync(this.indexFile, JSON.stringify(this.index)); } catch {} }
  cancel() { this.cancelled = true; }

  // A normal album folder -> one scan. A folder that mixes songs from several albums is split by album tag.
  async scansFor(alb, label) {
    const first = await scan({ kind: alb.recursive ? 'folder' : 'files', paths: alb.recursive ? [alb.dir] : alb.files, recursive: alb.recursive }, this.cacheDir);
    if (first.kind !== 'set') return [first];
    const tags = await mapLimit(alb.files, 6, f => readTags(f, this.cacheDir));
    const groups = new Map();
    for (const t of tags) { const k = (t.album || '').trim().toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t.path); }
    if (groups.size <= 1) { first.title = first.title === 'Untitled Mix' ? label : first.title; first.name = label; return [first]; }
    const out = [];
    for (const [k, paths] of groups) {
      if (!k) { const loose = await scan({ kind: 'files', paths }, this.cacheDir); loose.name = loose.title = label; out.push(loose); }
      else out.push(await scan({ kind: 'files', paths }, this.cacheDir));
    }
    return out;
  }

  /**
   * @param {{roots:string[], formats:string[], force?:boolean}} o
   */
  async run({ roots, formats, force = false }) {
    if (this.running) throw new Error('A library scan is already running.');
    this.running = true; this.cancelled = false;
    const res = { albums: 0, added: 0, unchanged: 0, failed: 0, cancelled: false };
    try {
      this.emit({ phase: 'finding', message: 'Looking for albums…' });
      const found = [];
      for (const r of roots) { if (r && fs.existsSync(r)) found.push(...findAlbumDirs(r)); }
      res.albums = found.length;
      let n = 0;
      for (const alb of found) {
        if (this.cancelled) { res.cancelled = true; break; }
        n++;
        const sig = signature(alb.files);
        const todo = formats.filter(f => force || this.index[f + '|' + alb.dir] !== sig);
        const label = path.basename(alb.dir);
        if (!todo.length) { res.unchanged++; this.emit({ phase: 'scan', done: n, total: found.length, current: label, ...res }); continue; }
        this.emit({ phase: 'scan', done: n - 1, total: found.length, current: label, message: `Reading ${label}`, ...res });
        try {
          const scans = await this.scansFor(alb, label);
          for (const f of todo) {
            for (const sc of scans) {
              if (this.cancelled) break;
              this.emit({ phase: 'scan', done: n - 1, total: found.length, current: label, message: `${sc.title || label} → ${f}`, ...res });
              await this.library.resolve({ mode: f, scan: sc, force: false });
              res.added++;
            }
            if (!this.cancelled) this.index[f + '|' + alb.dir] = sig;
          }
        } catch (e) { res.failed++; this.emit({ phase: 'error', current: label, message: `${label}: ${e.message}`, ...res }); }
        if (n % 5 === 0) this._save();
      }
      this._save();
      this.emit({ phase: 'done', done: n, total: found.length, ...res });
    } finally { this.running = false; }
    return res;
  }
}

module.exports = { LibraryScanner, findAlbumDirs, signature };
