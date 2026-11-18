// Resolves a scan into a library album for a given mode: DB hit -> reuse, else look up online and store.
const fs = require('fs');
const path = require('path');
const { Providers } = require('./providers');
const { norm, albumKey, assignSides, sidesCount, sideLetter } = require('./sides');
const { ART_SLOTS } = require('./db');

const { FORMAT_RE } = require('./providers');

function scoreRelease(r, want, mode, trackCount) {
  let s = 0;
  const t = norm(r.title), wt = norm(want.title);
  if (t && t === wt) s += 50; else if (t && wt && (t.includes(wt) || wt.includes(t))) s += 25;
  const a = norm(r.artist), wa = norm(want.artist);
  if (!wa || !a) s += 10; else if (a === wa) s += 30; else if (a.includes(wa) || wa.includes(a)) s += 15;
  if (r.format) s += FORMAT_RE[mode].test(r.format) ? 35 : -20; // prefer the release in the format we are building
  if (r.trackCount && r.trackCount === trackCount) s += 10;
  if (r.source === 'discogs') s += 5;
  return s;
}

// colour names from the spreadsheet -> tape colour ids (a '#rrggbb' value is kept as a custom colour)
const TAPE_IDS = ['tan', 'black', 'white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'clear', 'smoke', 'gold', 'silver', 'bronze', 'copper'];
function tapeColor(v) {
  v = String(v || '').trim().toLowerCase(); if (!v) return '';
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (v === 'grey') v = 'gray'; if (v === 'transparent') v = 'clear'; if (v === 'copper ' || v === 'coper') v = 'copper';
  return TAPE_IDS.includes(v) ? v : '';
}

class Library {
  constructor({ store, providers, artDir, onStatus }) {
    this.store = store; this.providers = providers; this.artDir = artDir; this.status = onStatus || (() => {});
    fs.mkdirSync(path.join(artDir, 'user'), { recursive: true });
  }

  async resolve({ mode, scan, force = false }) {
    const key = albumKey(scan);
    const existing = this.store.getByKey(mode, key);
    if (existing && !force) return this._refreshPaths(mode, existing, scan);

    this.status(`Building ${mode} entry…`);
    const base = {
      id: existing?.id, key, kind: scan.kind, artist: scan.artist || '', title: scan.title || scan.name || '', year: scan.year || '',
      label: '', catno: '', discogs_id: '', mbid: '', source_path: scan.source || '',
      front: '', back: '', jcard: '', spine: '', reel_type: '', reel_full: '', ...Object.fromEntries(ART_SLOTS.filter(x => /^(label|pic)_/.test(x)).map(x => [x, ''])), color: '', picture_disc: false, release_type: '', disc_size: '', sides: 0, side_minutes: 0, is_generic: scan.kind === 'set',
      tracks: scan.tracks.map(t => ({ ...t }))
    };
    // keep hand-edited art when force-refreshing
    if (existing) {
      for (const s of ART_SLOTS) base[s] = existing[s];
      for (const k of ['jcard_adj', 'reel_type', 'reel_full', 'color', 'picture_disc', 'release_type', 'disc_size', 'sides', 'side_minutes']) base[k] = existing[k];
    }

    let tracklist = null, release = null, art = { candidates: [] };
    if (scan.kind !== 'set') {
      try {
        const want = scan.kind === 'single' ? { artist: scan.artist, title: scan.albumTag || scan.title } : { artist: scan.artist, title: scan.title };
        this.status('Searching MusicBrainz / Discogs…');
        const list = await this.providers.searchReleases({ ...want, mode });
        const scored = list.map(r => ({ r, s: scoreRelease(r, want, mode, scan.tracks.length) })).sort((a, b) => b.s - a.s);
        const best = scored[0];
        if (best && best.s >= 60) {
          release = best.r;
          this.status(`Found: ${release.artist} – ${release.title}`);
          const full = await this.providers.fetchRelease(release);
          tracklist = full.tracklist;
          if (!full.meta.discogs_id && release.source === 'musicbrainz' && mode !== 'cd') { /* no discogs link on MB release */ }
          // Prefer Discogs for side information on vinyl/cassette
          if (mode !== 'cd' && full.meta.discogs_id && release.source === 'musicbrainz' && this.providers.getSettings().discogsToken !== undefined) {
            try { const d = await this.providers.fetchRelease({ source: 'discogs', id: full.meta.discogs_id }); if (d.tracklist.length) tracklist = d.tracklist; full.images = d.images; } catch {}
          }
          if (scan.kind === 'album') { base.artist = base.artist || full.meta.artist; }
          Object.assign(base, { year: base.year || full.meta.year, label: full.meta.label, catno: full.meta.catno, discogs_id: full.meta.discogs_id, mbid: full.meta.mbid });
          this.status('Fetching cover art…');
          art = await this.providers.findArt({ artist: full.meta.artist, title: full.meta.title, mbid: full.meta.mbid, rgid: release.rgid, discogsImages: full.images, mode, format: full.meta.format || release.format });
        } else {
          this.status('No matching release found — checking art sources…');
          art = await this.providers.findArt({ artist: want.artist, title: want.title, mode });
        }
      } catch (e) { this.status('Online lookup failed: ' + e.message); }
    }

    // reel to reel: albums with information go on a retail reel (1200 ft, 32 min a side); playlists / unknown albums on the generic 7" reel (1800 ft, 48 min a side)
    if (mode === 'reel' && !base.reel_type) { base.reel_type = (scan.kind === 'set' || !release) ? 'generic' : 'retail'; base.side_minutes = base.reel_type === 'retail' ? 32 : 48; }
    { const sd = assignSides(mode, base.tracks, tracklist, base.sides || 0, base.side_minutes || 0); base.tracks.forEach((t, i) => { t.side = sd[i]; }); base.sides = base.sides || sidesCount(sd, mode); }
    base.is_generic = scan.kind === 'set' || !release;

    // Art priority: local files next to the music > online picks > embedded tag art (front only)
    const picks = this.providers.autoPick(art.candidates || [], mode, base.sides || 2);
    for (const slot of ART_SLOTS) {
      if (base[slot]) continue;
      if (scan.localArt?.[slot]) { base[slot] = await this._own(scan.localArt[slot]); continue; }
      const pick = picks[slot];
      if (pick) { try { base[slot] = await this.providers.cache(pick.url); } catch {} }
    }
    if (!base.front && scan.embedded) base.front = await this._own(scan.embedded);

    await this.applyGenerics(mode, base).catch(() => {});
    this.status('');
    // Playlists / folders with no album information are only filed automatically when the user chose "always save";
    // otherwise they are returned unsaved (pending) and the app asks when the playlist is cleared or changed.
    const policy = (this.providers.getSettings() || {}).unidentifiedSave || 'ask';
    if (base.is_generic && !existing && policy !== 'always') return { ...base, id: null, pending: true, is_generic: true, tracks: base.tracks };
    return this.store.save(mode, base);
  }

  _refreshPaths(mode, existing, scan) {
    // Reuse everything stored (titles, sides, art) but point at the files that were just opened.
    if (existing.tracks.length === scan.tracks.length) {
      existing.tracks = existing.tracks.map((t, i) => ({ ...t, path: scan.tracks[i].path, duration: scan.tracks[i].duration || t.duration }));
    } else {
      const sides = assignSides(mode, scan.tracks, null, 0, existing.side_minutes || 0);
      existing.sides = Math.max(existing.sides || 0, sidesCount(sides, mode));
      existing.tracks = scan.tracks.map((t, i) => ({ ...t, side: sides[i] }));
    }
    return this.store.save(mode, existing);
  }

  // ---- generic cassette art -------------------------------------------------------------------------------------------
  // Tapes with no album information get a random generic J-card, and random generic side labels (chosen from the supplied labels
  // plus the built-in generated label). The choice is copied into the app's art folder and saved in the database (jcard / label_x).
  genericDirs() {
    const own = (this.providers.getSettings() || {}).genericsDir;
    return [own, 'C:\\Users\\secti\\Desktop\\digi-deck MediaPlayer\\dont delete\\Cassette Generics', path.join(__dirname, '..', '..', 'assets', 'generics', 'cassette')].filter(Boolean);
  }
  genericFiles(kind) {                    // kind: 'jcards' | 'labels' - the first folder that has images wins
    for (const d of this.genericDirs()) {
      try {
        const sub = fs.readdirSync(d).find(n => n.toLowerCase() === kind && fs.statSync(path.join(d, n)).isDirectory()); if (!sub) continue;
        const files = fs.readdirSync(path.join(d, sub)).filter(n => /\.(png|jpe?g|webp)$/i.test(n)).map(n => path.join(d, sub, n));
        if (files.length) return files;
      } catch { /* folder not there */ }
    }
    return [];
  }
  async applyGenerics(mode, a) {
    if (mode !== 'cassette' || !a.is_generic || a.jcard) return false;
    const js = this.genericFiles('jcards'); if (!js.length) return false;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    a.jcard = await this._own(pick(js));
    const ls = this.genericFiles('labels');
    for (let i = 0; i < Math.max(2, a.sides || 2); i++) {
      const slot = 'label_' + String.fromCharCode(97 + i); if (!ART_SLOTS.includes(slot) || a[slot]) continue;
      const n = Math.floor(Math.random() * (ls.length + 1));                       // the last option is the built-in label we already had
      if (n < ls.length) a[slot] = await this._own(ls[n]);
    }
    return true;
  }
  async backfillGenerics(mode) {
    if (mode !== 'cassette') return;
    for (const row of this.store.list(mode)) {
      if (!row.is_generic || row.jcard) continue;
      const a = this.store.getById(mode, row.id); if (!a) continue;
      if (await this.applyGenerics(mode, a)) this.store.save(mode, a); else return;      // no generics folder yet: nothing to do
    }
  }

  // ---- microcassette pre-built database (assets/micro/prebuilt/albums.json + images) ---------------------------------------
  prebuiltDirs() {
    const own = (this.providers.getSettings() || {}).prebuiltDir;
    const res = process.resourcesPath ? path.join(process.resourcesPath, 'prebuilt-micro') : '';   // installed copy (the installer can leave it out)
    return [own, res, path.join(__dirname, '..', '..', 'assets', 'micro', 'prebuilt'), 'C:\\Users\\secti\\Desktop\\digi-deck MediaPlayer\\dont delete\\Microcassette pre built database'].filter(Boolean);
  }
  prebuiltEnabled() {
    try { if (require('./build-flags.json').noPrebuilt) return false; } catch {}   // a build made without the pre-made database
    if ((this.providers.getSettings() || {}).usePrebuilt === false) return false;
    try { if (process.execPath && fs.existsSync(path.join(path.dirname(process.execPath), 'no-prebuilt.flag'))) return false; } catch {}   // written by the installer when the option is unticked
    return true;
  }
  async importPrebuilt(mode = 'micro') {
    if (mode !== 'micro' || !this.prebuiltEnabled()) return 0;
    const dirs = this.prebuiltDirs();
    let list = null;
    for (const d of dirs) { try { list = JSON.parse(fs.readFileSync(path.join(d, 'albums.json'), 'utf8')); break; } catch {} }
    if (!list) return 0;
    const find = n => { if (!n) return ''; for (const d of dirs) { const f = path.join(d, n); try { if (fs.statSync(f).isFile()) return f; } catch {} } return ''; };
    const markFile = path.join(this.artDir, 'prebuilt-micro.json');
    let done = {}; try { done = JSON.parse(fs.readFileSync(markFile, 'utf8')); } catch {}
    let n = 0;
    // titles with edition words stripped, so "Hysteria (Deluxe)", "Hysteria - Special Edition" and "Hysteria 25th Anniversary Edition" all match
    const EDN = /\b(super |special |deluxe |expanded |collector'?s? |limited |anniversary |remastered |remaster |bonus |reissue |legacy |platinum |tour |digital |explicit |clean |original |international |us |uk |japan(ese)? |\d+(st|nd|rd|th) )*(edition|version|remaster(ed)?|reissue|deluxe|anniversary|bonus tracks?)\b.*$/;
    const base = t => norm(String(t || '').replace(/\s[-–—:]\s.*$/, m => EDN.test(norm(m)) ? '' : m)).replace(EDN, '').trim();
    let existing = []; try { existing = this.store.list(mode) || []; } catch {}
    for (const e of list) {
      if (!e.artist || !e.title) continue;
      const key = albumKey({ kind: 'album', artist: e.artist, title: e.title, tracks: [] });
      const targets = [{ key, create: true }];
      const bt = base(e.title), ba = norm(e.artist);
      for (const x of existing) if (x.key !== key && x.kind === 'album' && norm(x.artist) === ba && base(x.title) === bt) targets.push({ key: x.key, create: false });
      for (const tg of targets) {
        const k2 = tg.key;
        const want = { jcard: e.jcard, ...Object.fromEntries((e.labels || []).map((f, i) => ['label_' + String.fromCharCode(97 + i), f])) };
        const mine = (done[k2] = done[k2] || {});
        const todo = Object.entries(want).filter(([slot, f]) => f && !mine[slot] && find(f));
        const col = tapeColor(e.color), colorTodo = col && !mine.color, adjTodo = e.jcard_adj && !mine.adj;
        if (!todo.length && !colorTodo && !adjTodo) continue;
        let a = this.store.getByKey(mode, k2);
        if (!a) { if (!tg.create) continue; a = { key: k2, kind: 'album', artist: e.artist, title: e.title, year: '', label: '', catno: '', discogs_id: '', mbid: '', source_path: '', front: '', back: '', jcard: '', color: '', release_type: 'album', disc_size: '', sides: Math.max(2, Math.ceil((e.labels || []).length / 2) * 2), side_minutes: 0, is_generic: false, picture_disc: false, tracks: [] }; }
        for (const [slot, f] of todo) { try { if (!a[slot]) a[slot] = await this._own(find(f)); mine[slot] = 1; } catch {} }
        if (colorTodo) { if (!a.color) a.color = col; mine.color = 1; }
        if (adjTodo) { if (!a.jcard_adj) a.jcard_adj = typeof e.jcard_adj === 'string' ? e.jcard_adj : JSON.stringify(e.jcard_adj); mine.adj = 1; }
        this.store.save(mode, a); n++;
      }
    }
    try { fs.writeFileSync(markFile, JSON.stringify(done)); } catch {}
    return n;
  }

  // Writes what the user adjusted in the microcassette library into a folder, ready to go back into the pre-made database:
  //   albums.json         the pre-made list with each album's shelf spine/cover adjustment (jcard_adj) and tape colour added
  //   adjusted-images/    every J-card / side label whose stored image differs from the supplied one, under the supplied file name
  //   adjustments.json    just the changes, for reading
  async exportAdjustments(outDir, mode = 'micro') {
    const dirs = this.prebuiltDirs(); let list = null, listDir = '';
    for (const d of dirs) { try { list = JSON.parse(fs.readFileSync(path.join(d, 'albums.json'), 'utf8')); listDir = d; break; } catch {} }
    if (!list) throw new Error('The pre-made albums.json was not found');
    const find = n => { if (!n) return ''; for (const d of dirs) { const f = path.join(d, n); try { if (fs.statSync(f).isFile()) return f; } catch {} } return ''; };
    const imgDir = path.join(outDir, 'adjusted-images'); fs.mkdirSync(imgDir, { recursive: true });
    const merged = [], changes = []; let images = 0, adjusted = 0;
    for (const e of list) {
      const out = { ...e }; merged.push(out);
      if (!e.artist || !e.title) continue;
      const a = this.store.getByKey(mode, albumKey({ kind: 'album', artist: e.artist, title: e.title, tracks: [] }));
      if (!a) continue;
      const ch = { artist: e.artist, title: e.title };
      if (a.jcard_adj) { try { out.jcard_adj = ch.jcard_adj = JSON.parse(a.jcard_adj); adjusted++; } catch {} }
      if (a.color && !e.color) out.color = ch.color = a.color;
      const slots = { jcard: e.jcard, ...Object.fromEntries((e.labels || []).map((f, i) => ['label_' + String.fromCharCode(97 + i), f])) };
      for (const [slot, f] of Object.entries(slots)) {
        const cur = a[slot]; if (!f || !cur || /^https?:/i.test(cur) || !fs.existsSync(cur)) continue;
        const orig = find(f); let same = false;
        try { same = !!orig && fs.readFileSync(orig).equals(fs.readFileSync(cur)); } catch {}
        if (same) continue;
        fs.copyFileSync(cur, path.join(imgDir, f)); (ch.images = ch.images || []).push(f); images++;
      }
      if (ch.jcard_adj || ch.images || ch.color) changes.push(ch);
    }
    fs.writeFileSync(path.join(outDir, 'albums.json'), JSON.stringify(merged, null, 1));
    fs.writeFileSync(path.join(outDir, 'adjustments.json'), JSON.stringify(changes, null, 1));
    fs.writeFileSync(path.join(outDir, 'README.txt'), 'Copy albums.json and everything in adjusted-images into assets/micro/prebuilt (replace the existing files), then build.\r\nadjustments.json lists only what changed.\r\n');
    return { albums: changes.length, images, shelf: adjusted, dir: outDir };
  }

  async _own(file) { // copy a user/local image into the app's art folder so the library survives file moves
    if (!file) return '';
    if (/^https?:/i.test(file)) return this.providers.cache(file);
    if (file.startsWith(this.artDir) || file.startsWith(this.providers.cacheDir)) return file;
    const dest = path.join(this.artDir, 'user', `${Date.now().toString(36)}-${path.basename(file).replace(/[^\w.-]+/g, '_')}`);
    fs.copyFileSync(file, dest);
    return dest;
  }

  // ---- image adjust (crop / zoom / pan in the editor) ----
  async readData(file) {                       // any slot image (local path or URL) as a data: URL, so the canvas is never tainted
    if (!file) return '';
    const p = /^https?:/i.test(file) ? await this.providers.cache(file) : file;
    const ext = path.extname(p).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,` + fs.readFileSync(p).toString('base64');
  }
  async saveData(dataUrl, name = 'adjusted') {  // adjusted image from the editor -> a file in the app's art folder
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl || ''); if (!m) throw new Error('Bad image data');
    const dest = path.join(this.artDir, 'user', `${Date.now().toString(36)}-${name.replace(/[^\w.-]+/g, '_')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
    fs.writeFileSync(dest, Buffer.from(m[2], 'base64'));
    return dest;
  }

  async saveEdited(mode, album) {
    const a = { ...album };
    for (const s of ART_SLOTS) { try { a[s] = a[s] ? await this._own(a[s]) : ''; } catch { a[s] = ''; } }
    return this.store.save(mode, a);
  }

  load(mode, id) {
    const a = this.store.getById(mode, id);
    if (!a) return null;
    a.tracks = a.tracks.map(t => ({ ...t, missing: !!t.path && !fs.existsSync(t.path) }));
    this.store.touch(mode, id);
    return a;
  }

  async fetchRelease({ mode, source, id, artist, title }) {
    const full = await this.providers.fetchRelease({ source, id });
    let images = full.images;
    if (source === 'musicbrainz' && full.meta.discogs_id) {
      try { const d = await this.providers.fetchRelease({ source: 'discogs', id: full.meta.discogs_id }); images = d.images; if (mode !== 'cd' && d.tracklist.length) full.tracklist = d.tracklist; } catch {}
    }
    const art = await this.providers.findArt({ artist: full.meta.artist || artist, title: full.meta.title || title, mbid: full.meta.mbid, rgid: full.rgid, discogsImages: images, mode, format: full.meta.format });
    full.meta.mbid = full.meta.mbid || art.mbid;
    const sides = mode === 'vinyl' && full.tracklist.length ? sidesCount(full.tracklist.map(t => sideLetter(t.position) || 'A')) : mode === 'cd' ? 1 : 2;
    const picks = this.providers.autoPick(art.candidates, mode, sides);
    return { meta: full.meta, tracklist: full.tracklist, candidates: art.candidates, picks, sides };
  }
}

module.exports = { Library, scoreRelease };
