// Turn "something the user opened" (files / folder / playlist) into a normalized scan object.
const fs = require('fs');
const path = require('path');
const { parsePlaylist, scanFolder, findLocalArt, isAudio, isPlaylist } = require('./playlists');
const { sha1 } = require('./providers');

async function readTags(file, cacheDir) {
  const mm = require('music-metadata');
  const t = { path: file, title: path.basename(file, path.extname(file)), artist: '', album: '', albumartist: '', duration: 0, trackNo: 0, discNo: 0, year: '', embedded: '' };
  try {
    const md = await mm.parseFile(file, { duration: true });
    const c = md.common || {};
    t.title = c.title || t.title; t.artist = c.artist || ''; t.album = c.album || ''; t.albumartist = c.albumartist || '';
    t.trackNo = c.track?.no || 0; t.discNo = c.disk?.no || 0; t.year = c.year ? String(c.year) : '';
    t.duration = md.format?.duration || 0;
    const pic = c.picture && c.picture[0];
    if (pic && pic.data?.length) {
      const ext = /png/i.test(pic.format) ? 'png' : 'jpg';
      const f = path.join(cacheDir, `emb-${sha1(pic.data.slice(0, 4096).toString('base64') + pic.data.length)}.${ext}`);
      if (!fs.existsSync(f)) fs.writeFileSync(f, pic.data);
      t.embedded = f;
    }
  } catch { /* unreadable tags: keep filename-based defaults */ }
  return t;
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const mostCommon = arr => {
  const m = new Map(); for (const a of arr.filter(Boolean)) m.set(a, (m.get(a) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

/**
 * @param {{kind:'files'|'folder'|'playlist', paths:string[]}} req
 * @returns scan = { kind:'album'|'set'|'single', name, artist, title, year, tracks:[...], localArt:{}, embedded:'', source:'' }
 */
async function scan(req, cacheDir) {
  let files = [], name = '', source = '', hint = {}, dir = '';
  if (req.kind === 'folder') {
    dir = req.paths[0]; source = dir; name = path.basename(dir);
    files = scanFolder(dir, req.recursive !== false).map(p => ({ path: p }));
  } else if (req.kind === 'playlist') {
    const pl = parsePlaylist(req.paths[0]);
    source = req.paths[0]; name = pl.name; hint = pl;
    files = pl.entries.filter(e => fs.existsSync(e.path)).map(e => ({ ...e }));
  } else {
    const list = [];
    for (const p of req.paths) {
      if (isPlaylist(p) && !isAudio(p)) { const pl = parsePlaylist(p); list.push(...pl.entries.filter(e => fs.existsSync(e.path))); if (!name) name = pl.name; source = p; }
      else if (isAudio(p) && fs.existsSync(p)) list.push({ path: p });
    }
    files = list;
    if (!name) name = files.length === 1 ? path.basename(files[0].path, path.extname(files[0].path)) : 'Untitled Mix';
    if (!source && files.length) source = files[0].path;
  }
  if (!files.length) throw new Error('No playable audio files were found.');

  const tags = await mapLimit(files, 6, async f => {
    const t = await readTags(f.path, cacheDir);
    // playlist-provided metadata fills gaps
    if (f.title && (!t.title || t.title === path.basename(f.path, path.extname(f.path)))) t.title = f.title;
    if (f.artist && !t.artist) t.artist = f.artist;
    if (!t.duration && f.duration) t.duration = f.duration;
    return t;
  });
  if (req.kind === 'folder') {
    tags.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.trackNo || 9999) - (b.trackNo || 9999) || a.path.localeCompare(b.path, undefined, { numeric: true }));
  }

  const dirs = new Set(tags.map(t => path.dirname(t.path)));
  if (!dir && dirs.size === 1) dir = [...dirs][0];
  const localArt = dir ? findLocalArt(dir) : {};
  const embedded = tags.find(t => t.embedded)?.embedded || '';

  const out = { name, source, localArt, embedded, year: mostCommon(tags.map(t => t.year)), tracks: tags.map(t => ({ path: t.path, title: t.title, artist: t.artist || t.albumartist || '', duration: t.duration, side: 'A' })) };

  if (tags.length === 1) {
    const t = tags[0];
    Object.assign(out, { kind: 'single', artist: t.artist || t.albumartist, title: t.title, albumTag: t.album });
    return out;
  }
  const albums = new Set(tags.map(t => t.album.trim().toLowerCase()));
  const albumName = tags[0].album.trim();
  if (albums.size === 1 && albumName) {
    const aa = mostCommon(tags.map(t => t.albumartist));
    const artists = new Set(tags.map(t => t.artist).filter(Boolean));
    Object.assign(out, { kind: 'album', title: albumName, artist: aa || (artists.size === 1 ? [...artists][0] : mostCommon(tags.map(t => t.artist))) || (artists.size > 1 ? 'Various Artists' : '') });
    if (!aa && artists.size > 1) out.artist = 'Various Artists';
    return out;
  }
  if (hint.album) { Object.assign(out, { kind: 'album', title: hint.album, artist: hint.albumArtist || '' }); return out; }
  // a user-made set of songs
  Object.assign(out, { kind: 'set', title: name, artist: '' });
  return out;
}

module.exports = { scan, readTags, mapLimit };
