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
      front: '', back: '', jcard: '', ...Object.fromEntries(ART_SLOTS.filter(x => /^(label|pic)_/.test(x)).map(x => [x, ''])), color: '', picture_disc: false, release_type: '', disc_size: '', sides: 0, side_minutes: 0, is_generic: scan.kind === 'set',
      tracks: scan.tracks.map(t => ({ ...t }))
    };
    // keep hand-edited art when force-refreshing
    if (existing) {
      for (const s of ART_SLOTS) base[s] = existing[s];
      for (const k of ['color', 'picture_disc', 'release_type', 'disc_size', 'sides', 'side_minutes']) base[k] = existing[k];
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

    const saved = this.store.save(mode, base);
    this.status('');
    return saved;
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

  async _own(file) { // copy a user/local image into the app's art folder so the library survives file moves
    if (!file) return '';
    if (/^https?:/i.test(file)) return this.providers.cache(file);
    if (file.startsWith(this.artDir) || file.startsWith(this.providers.cacheDir)) return file;
    const dest = path.join(this.artDir, 'user', `${Date.now().toString(36)}-${path.basename(file).replace(/[^\w.-]+/g, '_')}`);
    fs.copyFileSync(file, dest);
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
