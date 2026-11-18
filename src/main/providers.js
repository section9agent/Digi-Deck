// Release search + cover-art lookup across many sources:
//   MusicBrainz (+ Cover Art Archive), Discogs, TheAudioDB, fanart.tv, iTunes, Deezer
// Everything is best-effort: a failing source never blocks the others.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha1 = s => crypto.createHash('sha1').update(String(s)).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lucene = s => String(s || '').replace(/(["\\])/g, '\\$1');

function parseDuration(d) { // "3:45" | "1:02:03" | "" -> seconds
  if (!d) return 0;
  const p = String(d).split(':').map(Number);
  if (p.some(isNaN)) return 0;
  return p.reduce((a, n) => a * 60 + n, 0);
}

// Format-specific lookups: each mode wants the artwork of ITS release (12" LP vs CD vs cassette), not one shared cover.
const MB_FORMATS = { vinyl: ['Vinyl', '7" Vinyl', '10" Vinyl', '12" Vinyl'], cd: ['CD', 'CD-R', 'Enhanced CD', 'HDCD', 'SACD', 'Copy Control CD', 'DualDisc'], cassette: ['Cassette'], micro: ['Cassette'], reel: ['Reel-To-Reel'] };
const DISCOGS_FORMAT = { vinyl: 'Vinyl', cd: 'CD', cassette: 'Cassette', micro: 'Cassette', reel: 'Reel-To-Reel' };
const FORMAT_RE = { vinyl: /vinyl|\blp\b|12"|7"|10"|45 rpm|33 ⅓/i, cd: /\bcd\b|compact disc|sacd|hdcd/i, cassette: /cassette|\btape\b|\bmc\b/i, micro: /micro-?cassette|cassette|\btape\b|\bmc\b/i, reel: /reel|\btape\b|\b7 1\/2 ips\b/i };

class Providers {
  constructor({ cacheDir, getSettings }) {
    this.cacheDir = cacheDir;
    this.getSettings = getSettings;
    fs.mkdirSync(cacheDir, { recursive: true });
    this._mbLast = 0;
    this._index = new Map();
    for (const f of fs.readdirSync(cacheDir)) this._index.set(f.split('.')[0], path.join(cacheDir, f));
  }

  ua() {
    const s = this.getSettings();
    return `Digi-Deck/0.1 ( ${s.contact || 'https://github.com/digi-deck-player'} )`;
  }

  async http(url, { headers = {}, json = true, binary = false, timeout = 15000 } = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': this.ua(), Accept: json ? 'application/json' : '*/*', ...headers }, signal: ctl.signal, redirect: 'follow' });
      if (!res.ok) { const e = new Error(`HTTP ${res.status} for ${url}`); e.status = res.status; throw e; }
      if (binary) return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || '' };
      return json ? await res.json() : await res.text();
    } finally { clearTimeout(t); }
  }

  async mb(pathAndQuery) {
    const wait = this._mbLast + 1100 - Date.now(); // MusicBrainz: max ~1 request / second
    if (wait > 0) await sleep(wait);
    this._mbLast = Date.now();
    return this.http('https://musicbrainz.org/ws/2/' + pathAndQuery + (pathAndQuery.includes('?') ? '&' : '?') + 'fmt=json');
  }

  discogsHeaders() {
    const tok = this.getSettings().discogsToken;
    return tok ? { Authorization: `Discogs token=${tok}` } : {};
  }

  // ---------- release search ----------
  async searchReleases({ artist = '', title = '', mode = '' }) {
    const out = [];
    const jobs = [];
    // MusicBrainz (filtered to the wanted format first; falls back to any format when that finds nothing)
    jobs.push((async () => {
      const base = [title && `release:"${lucene(title)}"`, artist && `artist:"${lucene(artist)}"`].filter(Boolean).join(' AND ');
      if (!base) return;
      let j = null;
      if (MB_FORMATS[mode]) {
        const f = MB_FORMATS[mode].map(x => `format:"${lucene(x)}"`).join(' OR ');
        try { j = await this.mb(`release/?query=${encodeURIComponent(`${base} AND (${f})`)}&limit=12`); } catch {}
      }
      if (!j || !(j.releases || []).length) j = await this.mb(`release/?query=${encodeURIComponent(base)}&limit=12`);
      for (const r of j.releases || []) {
        const media = r.media || [];
        out.push({
          source: 'musicbrainz', id: r.id, title: r.title,
          artist: (r['artist-credit'] || []).map(a => a.name + (a.joinphrase || '')).join(''),
          year: (r.date || '').slice(0, 4), country: r.country || '',
          format: media.map(m => m.format).filter(Boolean).join(' + '),
          trackCount: media.reduce((a, m) => a + (m['track-count'] || 0), 0),
          label: (r['label-info'] || []).map(l => l.label?.name).filter(Boolean).join(', '),
          rgid: r['release-group']?.id || '', score: r.score || 0
        });
      }
    })().catch(() => {}));
    // Discogs (search requires a personal access token)
    if (this.getSettings().discogsToken) {
      jobs.push((async () => {
        const p = new URLSearchParams({ type: 'release', per_page: '12' });
        if (title) p.set('release_title', title);
        if (artist) p.set('artist', artist);
        let j = null;
        if (DISCOGS_FORMAT[mode]) { const p2 = new URLSearchParams(p); p2.set('format', DISCOGS_FORMAT[mode]); try { j = await this.http('https://api.discogs.com/database/search?' + p2, { headers: this.discogsHeaders() }); } catch {} }
        if (!j || !(j.results || []).length) j = await this.http('https://api.discogs.com/database/search?' + p, { headers: this.discogsHeaders() });
        for (const r of j.results || []) {
          const [a, ...rest] = String(r.title || '').split(' - ');
          out.push({
            source: 'discogs', id: String(r.id), title: rest.join(' - ') || r.title, artist: rest.length ? a : '',
            year: r.year || '', country: r.country || '', format: (r.format || []).join(', '),
            label: (r.label || []).slice(0, 2).join(', '), thumb: r.thumb || '', catno: r.catno || ''
          });
        }
      })().catch(() => {}));
    }
    await Promise.all(jobs);
    return out;
  }

  // Accepts a pasted discogs/musicbrainz URL or a bare id.
  static parseReleaseRef(text) {
    const t = String(text || '').trim();
    let m;
    if ((m = t.match(/discogs\.com\/(?:[^/]+\/)?release\/(\d+)/i))) return { source: 'discogs', id: m[1] };
    if ((m = t.match(/musicbrainz\.org\/release\/([0-9a-f-]{36})/i))) return { source: 'musicbrainz', id: m[1] };
    if (/^\d+$/.test(t)) return { source: 'discogs', id: t };
    if (/^[0-9a-f-]{36}$/i.test(t)) return { source: 'musicbrainz', id: t };
    return null;
  }

  // ---------- full release details ----------
  async fetchRelease({ source, id }) {
    if (source === 'discogs') {
      const r = await this.http(`https://api.discogs.com/releases/${id}`, { headers: this.discogsHeaders() });
      const lab = (r.labels || [])[0] || {};
      const tracklist = (r.tracklist || []).filter(t => !t.type_ || t.type_ === 'track').map(t => ({
        position: t.position || '', title: t.title || '', duration: parseDuration(t.duration),
        artist: (t.artists || []).map(a => a.name).join(', ')
      }));
      return {
        meta: {
          artist: (r.artists || []).map(a => (a.anv || a.name).replace(/\s\(\d+\)$/, '') + (a.join && a.join !== ',' ? ` ${a.join} ` : ', ')).join('').replace(/[, ]+$/, ''),
          title: r.title || '', year: r.year ? String(r.year) : '', label: lab.name || '', catno: lab.catno || '',
          discogs_id: String(id), mbid: '', format: (r.formats || []).map(f => f.name).join(', ')
        },
        tracklist,
        images: (r.images || []).map(i => ({ type: i.type, uri: i.uri, uri150: i.uri150 })),
        formats: r.formats || []
      };
    }
    // MusicBrainz
    const r = await this.mb(`release/${id}?inc=recordings+artist-credits+labels+url-rels+release-groups`);
    const li = (r['label-info'] || [])[0] || {};
    const tracklist = [];
    for (const m of r.media || []) for (const t of m.tracks || []) tracklist.push({ position: String(t.number || t.position || ''), title: t.title, duration: (t.length || 0) / 1000, artist: '' });
    const dl = (r.relations || []).find(x => x.url && /discogs\.com\/release\/\d+/.test(x.url.resource || ''));
    return {
      meta: {
        artist: (r['artist-credit'] || []).map(a => a.name + (a.joinphrase || '')).join(''), title: r.title || '',
        year: (r.date || '').slice(0, 4), label: li.label?.name || '', catno: li['catalog-number'] || '',
        discogs_id: dl ? String(dl.url.resource.match(/release\/(\d+)/)[1]) : '', mbid: r.id,
        format: (r.media || []).map(m => m.format).filter(Boolean).join(' + ')
      },
      tracklist, images: [], rgid: r['release-group']?.id || '', formats: (r.media || []).map(m => ({ name: m.format }))
    };
  }

  // ---------- art lookup ----------
  async findArt({ artist = '', title = '', mbid = '', rgid = '', discogsImages = [], mode = '', format = '' }) {
    const c = [];
    // exact = taken from the very release (pressing) we matched in this format; fmt = only valid for that format
    const add = (source, slot, url, note = '', thumb = '', extra = {}) => { if (url && !c.some(x => x.url === url)) c.push({ source, slot, url, thumb: thumb || url, note, exact: false, ...extra }); };
    const s = this.getSettings();
    const fmtName = { vinyl: 'vinyl', cd: 'CD', cassette: 'cassette', micro: 'microcassette', reel: 'reel to reel' }[mode] || '';

    const fmtOk = !FORMAT_RE[mode] || !format || FORMAT_RE[mode].test(format);   // is the matched release really in this format?
    discogsImages.forEach((im, i) => {
      const slot = im.type === 'primary' ? 'front' : i === 1 ? 'back' : 'other';
      add('discogs', slot, im.uri, im.type === 'primary' ? `Discogs ${fmtName} release - front` : `Discogs ${fmtName} release - image ${i + 1}${i === 1 ? ' (usually the back)' : ''}`, im.uri150, { exact: fmtOk });
    });

    let exactMbid = !!mbid && fmtOk;
    if (!mbid) {
      try {
        const rels = await this.searchReleases({ artist, title, mode });
        const mbRels = rels.filter(r => r.source === 'musicbrainz');
        const want = MB_FORMATS[mode] ? FORMAT_RE[mode] : null;
        const r = mbRels.find(x => x.score >= 80 && (!want || want.test(x.format))) || mbRels.find(x => x.score >= 80);
        if (r) { mbid = r.id; rgid = rgid || r.rgid || ''; exactMbid = !want || want.test(r.format); }
      } catch {}
    }
    const jobs = [];
    // Cover Art Archive: the matched release first (its own format), the release group only as a generic fallback
    jobs.push((async () => {
      const typeSlot = types => types.includes('Front') ? 'front' : types.includes('Back') ? 'back' : types.includes('Medium') ? 'label' : (types.includes('Tray') || types.includes('Booklet') || types.includes('Liner')) ? 'jcard' : 'other';
      let j = null, exact = false;
      if (mbid) { try { j = await this.http(`https://coverartarchive.org/release/${mbid}`); exact = exactMbid; } catch {} }
      if (!j && rgid) { try { j = await this.http(`https://coverartarchive.org/release-group/${rgid}`); } catch {} }
      for (const im of (j?.images || [])) {
        const slot = typeSlot(im.types || []);
        add('coverartarchive', slot, im.image, `CAA ${(im.types || []).join('/')}${exact ? ` (${fmtName || 'matched'} release)` : ' (any format)'}`, im.thumbnails?.small || im.thumbnails?.['250'], { exact });
      }
    })().catch(() => {}));
    // TheAudioDB (generic covers; its disc art is CD art only)
    jobs.push((async () => {
      if (!artist || !title) return;
      const key = s.audiodbKey || '123';
      const j = await this.http(`https://www.theaudiodb.com/api/v1/json/${key}/searchalbum.php?s=${encodeURIComponent(artist)}&a=${encodeURIComponent(title)}`);
      const a = (j.album || [])[0];
      if (!a) return;
      add('audiodb', 'front', a.strAlbumThumbHQ || a.strAlbumThumb, 'TheAudioDB cover');
      add('audiodb', 'back', a.strAlbumThumbBack, 'TheAudioDB back');
      add('audiodb', 'label', a.strAlbumCDart, 'TheAudioDB CD art', '', { fmt: 'cd', exact: true });
      add('audiodb', 'other', a.strAlbumSpine, 'TheAudioDB spine');
      if (!rgid && a.strMusicBrainzID) rgid = a.strMusicBrainzID;
    })().catch(() => {}));
    // iTunes / Deezer: digital covers, last-resort fronts
    jobs.push((async () => {
      if (!title) return;
      const j = await this.http(`https://itunes.apple.com/search?media=music&entity=album&limit=5&term=${encodeURIComponent((artist + ' ' + title).trim())}`);
      for (const r of (j.results || []).slice(0, 2)) add('itunes', 'front', String(r.artworkUrl100 || '').replace(/\d+x\d+bb/, '1200x1200bb'), `iTunes: ${r.collectionName} (digital cover)`, r.artworkUrl100);
    })().catch(() => {}));
    jobs.push((async () => {
      if (!title) return;
      const q = artist ? `artist:"${artist}" album:"${title}"` : title;
      const j = await this.http(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=3`);
      for (const r of (j.data || []).slice(0, 2)) add('deezer', 'front', r.cover_xl || r.cover_big, `Deezer: ${r.title} (digital cover)`, r.cover_medium);
    })().catch(() => {}));
    await Promise.all(jobs);
    // fanart.tv needs the release-group id (possibly learned from AudioDB above); its disc art is CD art
    if (s.fanartKey && rgid) {
      try {
        const j = await this.http(`https://webservice.fanart.tv/v3/music/albums/${rgid}?api_key=${encodeURIComponent(s.fanartKey)}`);
        const al = j.albums?.[rgid] || {};
        (al.albumcover || []).forEach(x => add('fanart', 'front', x.url, 'fanart.tv cover'));
        (al.cdart || []).forEach(x => add('fanart', 'label', x.url, `fanart.tv CD disc${x.disc ? ' ' + x.disc : ''}`, '', { fmt: 'cd', exact: true }));
      } catch {}
    }
    // the editor lists the wanted format first, then generic art; art that belongs to another format is hidden
    const list = c.filter(x => !x.fmt || !mode || x.fmt === (mode === 'micro' ? 'cassette' : mode)).sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0));
    return { candidates: list, mbid, rgid };
  }

  // Choose a default image per slot: art from the matched release in THIS format first, then generic covers.
  autoPick(cands, mode = '', sides = 2) {
    const rank = { front: ['coverartarchive', 'discogs', 'fanart', 'audiodb', 'itunes', 'deezer'], back: ['coverartarchive', 'discogs', 'audiodb'], label: ['coverartarchive', 'fanart', 'audiodb', 'discogs'], jcard: ['coverartarchive'] };
    const pick = (slot, n = 0) => {
      const order = rank[slot] || [];
      const list = cands.filter(x => x.slot === slot && (!x.fmt || !mode || x.fmt === (mode === 'micro' ? 'cassette' : mode)))
        .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || order.indexOf(a.source) - order.indexOf(b.source));
      return list[n] || null;
    };
    const out = { front: pick('front'), back: pick('back'), jcard: pick('jcard') };
    const n = mode === 'cd' ? Math.max(1, Math.min(8, sides)) : mode === 'vinyl' || mode === 'cassette' || mode === 'micro' || mode === 'reel' ? Math.max(2, Math.min(8, sides)) : 2;
    for (let i = 0; i < n; i++) out['label_' + 'abcdefgh'[i]] = pick('label', i);
    return out;
  }

  // Download a URL into the shared on-disk cache and return the local path.
  // (Downloads are shared across modes so nothing is fetched twice; each mode's DB still stores its own record.)
  async cache(src) {
    if (!src) return '';
    if (!/^https?:\/\//i.test(src)) return src;
    const h = sha1(src);
    if (this._index.has(h)) return this._index.get(h);
    const headers = /discogs\.com/i.test(src) ? this.discogsHeaders() : {};
    const { buf, type } = await this.http(src, { headers, binary: true, json: false, timeout: 30000 });
    if (!buf.length) throw new Error('empty image');
    const ext = /png/i.test(type) ? 'png' : /webp/i.test(type) ? 'webp' : /gif/i.test(type) ? 'gif' : 'jpg';
    const file = path.join(this.cacheDir, `${h}.${ext}`);
    fs.writeFileSync(file, buf);
    this._index.set(h, file);
    return file;
  }
}

module.exports = { Providers, parseDuration, sha1, FORMAT_RE };
