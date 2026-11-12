// Playlist parsers + folder scanning. Pure functions where possible so they can be tested.
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.mp4', '.wma', '.aiff', '.aif', '.ape', '.wv', '.webm']);
const PLAYLIST_EXT = new Set(['.m3u', '.m3u8', '.pls', '.xspf', '.wpl', '.zpl', '.asx', '.wax', '.wvx', '.b4s', '.cue', '.mpcpl', '.jspf', '.smil', '.vlc', '.txt']);

const isAudio = p => AUDIO_EXT.has(path.extname(p).toLowerCase());
const isPlaylist = p => PLAYLIST_EXT.has(path.extname(p).toLowerCase());

function decodeEntities(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// Turn a playlist entry (relative path, file:// URL, windows path) into an absolute local path.
function resolveEntry(entry, baseDir) {
  let e = String(entry).trim().replace(/^﻿/, '');
  if (!e) return null;
  if (/^https?:\/\//i.test(e)) return null; // streams are not supported
  if (/^file:\/\//i.test(e)) {
    try { e = fileURLToPath(e); } catch { e = decodeURIComponent(e.replace(/^file:\/+/i, '/')); }
  }
  // windows-style separators in playlists made elsewhere
  if (path.sep === '/' && /\\/.test(e) && !/^\//.test(e)) e = e.replace(/\\/g, '/');
  if (!path.isAbsolute(e) && !/^[a-zA-Z]:[\\/]/.test(e)) e = path.resolve(baseDir, e);
  return path.normalize(e);
}

function parseM3U(text, baseDir) {
  const out = []; let meta = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      const m = line.match(/^#EXTINF:\s*(-?[\d.]+)[^,]*,(.*)$/);
      if (m) {
        let artist = '', title = m[2].trim();
        const dash = title.indexOf(' - ');
        if (dash > 0) { artist = title.slice(0, dash); title = title.slice(dash + 3); }
        meta = { duration: Math.max(0, parseFloat(m[1])), artist, title };
      }
      continue;
    }
    if (line.startsWith('#')) continue;
    const p = resolveEntry(line, baseDir);
    if (p) out.push({ path: p, ...(meta || {}) });
    meta = null;
  }
  return out;
}

function parsePLS(text, baseDir) {
  const files = {}, titles = {}, lens = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(/^(File|Title|Length)(\d+)\s*=\s*(.*)$/i);
    if (!m) continue;
    const n = +m[2], k = m[1].toLowerCase();
    if (k === 'file') files[n] = m[3]; else if (k === 'title') titles[n] = m[3]; else lens[n] = parseFloat(m[3]);
  }
  return Object.keys(files).map(Number).sort((a, b) => a - b).map(n => {
    const p = resolveEntry(files[n], baseDir);
    return p && { path: p, title: titles[n], duration: lens[n] > 0 ? lens[n] : undefined };
  }).filter(Boolean);
}

// Generic XML attribute / tag extraction (xspf, wpl, asx, b4s, smil, zpl, mpcpl-xml)
function xmlEntries(text, baseDir) {
  const out = [];
  const add = (src, extra = {}) => { const p = resolveEntry(decodeEntities(src), baseDir); if (p) out.push({ path: p, ...extra }); };
  // XSPF: <track><location>..</location><title>..</title><creator>..</creator><album>..</album><duration>ms</duration>
  const tracks = text.match(/<track\b[\s\S]*?<\/track>/gi);
  if (tracks) {
    for (const t of tracks) {
      const g = tag => { const m = t.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')); return m ? decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : undefined; };
      const loc = g('location');
      if (loc) { const d = g('duration'); add(loc, { title: g('title'), artist: g('creator'), album: g('album'), duration: d ? parseFloat(d) / 1000 : undefined }); }
    }
    if (out.length) return out;
  }
  // WPL / ZPL / SMIL: <media src="..."/>, <ref src=...>, <audio src=...>
  for (const m of text.matchAll(/<(?:media|ref|audio|seq|entry)\b[^>]*?\b(?:src|href)\s*=\s*"([^"]+)"/gi)) add(m[1]);
  if (out.length) return out;
  // B4S: <entry Playstring="file:..."><Name>..</Name>
  for (const m of text.matchAll(/Playstring\s*=\s*"([^"]+)"/gi)) add(m[1]);
  return out;
}

function parseJSPF(text, baseDir) {
  try {
    const j = JSON.parse(text);
    return (j.playlist?.track || []).map(t => {
      const loc = Array.isArray(t.location) ? t.location[0] : t.location;
      const p = loc && resolveEntry(loc, baseDir);
      return p && { path: p, title: t.title, artist: t.creator, album: t.album, duration: t.duration ? t.duration / 1000 : undefined };
    }).filter(Boolean);
  } catch { return []; }
}

function parseMPCPL(text, baseDir) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\d+,filename,(.*)$/i);
    if (m) { const p = resolveEntry(m[1], baseDir); if (p) out.push({ path: p }); }
  }
  return out;
}

// CUE: one FILE (whole album image) or one FILE per track.
function parseCUE(text, baseDir) {
  const out = []; let file = null, albumTitle, albumPerformer, cur = null;
  const unq = s => s.replace(/^"|"$/g, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^FILE\s+("[^"]+"|\S+)/i))) file = resolveEntry(unq(m[1]), baseDir);
    else if ((m = line.match(/^TRACK\s+(\d+)/i))) { cur = { path: file, trackNo: +m[1] }; out.push(cur); }
    else if ((m = line.match(/^TITLE\s+(.*)$/i))) { if (cur) cur.title = unq(m[1].trim()); else albumTitle = unq(m[1].trim()); }
    else if ((m = line.match(/^PERFORMER\s+(.*)$/i))) { if (cur) cur.artist = unq(m[1].trim()); else albumPerformer = unq(m[1].trim()); }
  }
  // A cue pointing at one big file has several tracks sharing a path: we play the file as a whole.
  const uniq = new Set(out.map(o => o.path));
  if (out.length > 1 && uniq.size === 1) return { entries: [{ path: out[0].path, title: albumTitle, artist: albumPerformer }], album: albumTitle, albumArtist: albumPerformer };
  return { entries: out.filter(o => o.path), album: albumTitle, albumArtist: albumPerformer };
}

function parsePlaylist(file) {
  const ext = path.extname(file).toLowerCase();
  const baseDir = path.dirname(file);
  const buf = fs.readFileSync(file);
  // utf-16 BOM handling (WPL/old playlists)
  let text = (buf[0] === 0xff && buf[1] === 0xfe) ? buf.toString('utf16le') : buf.toString('utf8');
  text = text.replace(/^﻿/, '');
  let entries = [], extra = {};
  if (ext === '.m3u' || ext === '.m3u8' || ext === '.vlc' || ext === '.txt') entries = parseM3U(text, baseDir);
  else if (ext === '.pls') entries = parsePLS(text, baseDir);
  else if (ext === '.cue') { const c = parseCUE(text, baseDir); entries = c.entries; extra = { album: c.album, albumArtist: c.albumArtist }; }
  else if (ext === '.jspf') entries = parseJSPF(text, baseDir);
  else if (ext === '.mpcpl') entries = parseMPCPL(text, baseDir);
  else entries = xmlEntries(text, baseDir);
  return { name: path.basename(file, path.extname(file)), entries: entries.filter(e => e.path), ...extra };
}

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function scanFolder(dir, recursive = true) {
  const out = [];
  const walk = d => {
    let items = [];
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    items.sort((x, y) => naturalCompare(x.name, y.name));
    for (const it of items) {
      const full = path.join(d, it.name);
      if (it.isDirectory()) { if (recursive) walk(full); }
      else if (isAudio(full)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

// Look for album art lying next to the music.
const ART_NAMES = {
  front: ['cover', 'folder', 'front', 'album', 'albumart', 'artwork'],
  back: ['back', 'rear', 'back cover'],
  jcard: ['jcard', 'j-card', 'j_card', 'inlay', 'insert'],
  label_a: ['label', 'label a', 'label_a', 'labela', 'disc', 'cd', 'cdart', 'vinyl', 'side a', 'side_a'],
  label_b: ['label b', 'label_b', 'labelb', 'side b', 'side_b', 'disc2']
};
function findLocalArt(dir) {
  const found = {};
  let items = [];
  try { items = fs.readdirSync(dir); } catch { return found; }
  for (const it of items) {
    const ext = path.extname(it).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext)) continue;
    const base = path.basename(it).slice(0, -ext.length || undefined).toLowerCase();
    for (const [slot, names] of Object.entries(ART_NAMES)) {
      if (!found[slot] && names.includes(base)) found[slot] = path.join(dir, it);
    }
  }
  return found;
}

module.exports = { parsePlaylist, parseM3U, parsePLS, parseCUE, xmlEntries, scanFolder, findLocalArt, isAudio, isPlaylist, resolveEntry, AUDIO_EXT, PLAYLIST_EXT };
