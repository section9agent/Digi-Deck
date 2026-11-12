// Side assignment (vinyl / cassette) and helpers shared by the resolver.
const { sha1 } = require('./providers');

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function albumKey(scan) {
  if (scan.kind === 'single') return 'single:' + sha1(scan.tracks[0].path);
  if (scan.kind === 'set') return 'set:' + sha1(norm(scan.name) + '|' + scan.tracks.map(t => t.path).sort().join('|'));
  return 'album:' + sha1(norm(scan.artist) + '|' + norm(scan.title));
}

const LETTERS = 'ABCDEFGH';
// Playing-time limits. Vinyl: 25 min a side (a release can override it); cassette: 90 min a tape = 45 a side; CD: 80 min a disc.
const CAPS = { vinyl: 25 * 60, cassette: 45 * 60, cd: 80 * 60 };
const capFor = (mode, sideMinutes) => (mode === 'vinyl' && sideMinutes > 0 ? sideMinutes * 60 : CAPS[mode] || CAPS.vinyl);
const totalOf = tracks => tracks.reduce((a, t) => a + (t.duration || 0), 0);

// Split into n contiguous sides with the most even playing time.
function durationSplit(tracks, n = 2) {
  const cnt = tracks.length;
  n = Math.max(1, Math.min(n, cnt || 1));
  if (cnt < 2 || n < 2) return tracks.map(() => 'A');
  const total = totalOf(tracks), target = total / n;
  const out = []; let side = 0, acc = 0;
  tracks.forEach((t, i) => {
    out.push(side); acc += t.duration || 0;
    const boundary = target * (side + 1);
    if (side < n - 1 && acc >= boundary - (tracks[i + 1] ? (tracks[i + 1].duration || 0) / 2 : 0) && cnt - i - 1 >= n - side - 1) side++;
  });
  return out.map(i => LETTERS[i]);
}
const perUnit = (tracks, letters) => { const o = {}; tracks.forEach((t, i) => { o[letters[i]] = (o[letters[i]] || 0) + (t.duration || 0); }); return o; };

// Smallest split whose sides/discs all fit the limit. Vinyl and cassette need an even number of sides (two per record/tape);
// a CD needs one disc per 80 minutes. `min` is a count the user already chose (never goes below it).
// Cassette playlists / folders of loose songs: fill each side up to the limit (45 min) before starting the next, like taping a mix.
function fillSplit(tracks, cap) {
  const out = []; let side = 0, acc = 0;
  tracks.forEach(t => {
    const d = t.duration || 0;
    if (acc > 0 && acc + d > cap + 1 && side < 7) { side++; acc = 0; }
    out.push(LETTERS[side]); acc += d;
  });
  return out;
}
function capacitySplit(mode, tracks, cap, min = 0) {
  if (mode === 'cassette' && totalOf(tracks) > cap && !(min > 2)) return fillSplit(tracks, cap);
  const step = mode === 'cd' ? 1 : 2, floor = mode === 'cd' ? 1 : 2;
  let n = Math.max(floor, min | 0, Math.ceil(totalOf(tracks) / cap));
  if (step === 2 && n % 2) n++;
  n = Math.min(n, 8);
  for (;;) {
    const letters = durationSplit(tracks, n);
    const fits = Object.values(perUnit(tracks, letters)).every(v => v <= cap + 1);
    if (fits || n + step > 8 || n >= tracks.length) return letters;
    n += step;
  }
}
// kept for older callers: how many vinyl sides a release needs
function autoSides(tracks, sideMinutes) {
  const letters = capacitySplit('vinyl', tracks, capFor('vinyl', sideMinutes));
  return sidesCount(letters, 'vinyl');
}
// number of sides (vinyl / cassette: whole records or tapes, two each) or discs (CD) used by a list of letters
function sidesCount(letters, mode = 'vinyl') {
  const m = Math.max(0, ...letters.map(l => LETTERS.indexOf(String(l || 'A').toUpperCase())));
  return mode === 'cd' ? Math.min(8, m + 1) : Math.min(8, Math.ceil((m + 1) / 2) * 2);
}

// Discogs-style positions: A1, A2, B1 ... (also C/D for double LPs). Returns null if positions aren't lettered.
function sideLetter(position) {
  const m = String(position || '').trim().match(/^([A-Za-z])\.?\d*/);
  return m ? m[1].toUpperCase() : null;
}

// CD positions: "1-4", "2.3", "CD2-1", "Disc 2/5" -> disc number
function discLetter(position) {
  const m = String(position || '').trim().match(/^(?:cd|disc|disk)?\s*(\d+)\s*[-.\/:]\s*\d+/i);
  return m && +m[1] >= 1 && +m[1] <= 8 ? LETTERS[+m[1] - 1] : null;
}

function discogsSides(tracks, tracklist, letterOf = sideLetter) {
  const letters = (tracklist || []).map(t => letterOf(t.position));
  if (!letters.length || letters.some(l => !l)) return null;
  const used = new Set();
  const sides = new Array(tracks.length).fill(null);
  tracks.forEach((t, i) => {
    const nt = norm(t.title);
    const j = tracklist.findIndex((d, k) => !used.has(k) && nt && norm(d.title) === nt);
    if (j >= 0) { used.add(j); sides[i] = letters[j]; }
  });
  if (sides.some(s => !s) && tracks.length === tracklist.length) {
    // fall back to positional match for the ones that didn't match by title
    sides.forEach((s, i) => { if (!s) sides[i] = letters[i]; });
  }
  let prev = 'A';
  return sides.map(s => (prev = s || prev));
}

function assignSides(mode, tracks, tracklist, sides, sideMinutes) {
  if (mode === 'cd') {
    // multi-disc releases keep their real disc numbers (Discogs positions, or the disc tag of the files)
    const tagged = tracks.map(t => (t.discNo > 0 && t.discNo <= 8 ? LETTERS[t.discNo - 1] : null));
    const real = discogsSides(tracks, tracklist, discLetter) || (tagged.some(l => l && l !== 'A') && tagged.every(Boolean) ? tagged : null);
    if (real && new Set(real).size > 1) return real;
    return capacitySplit('cd', tracks, capFor('cd'), sides | 0);
  }
  return discogsSides(tracks, tracklist) || capacitySplit(mode, tracks, capFor(mode, sideMinutes), sides | 0);
}

module.exports = { norm, albumKey, durationSplit, discogsSides, assignSides, sideLetter, discLetter, autoSides, sidesCount, capacitySplit, capFor, CAPS, LETTERS };
