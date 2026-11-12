// Plain-node tests (no Electron needed): node test/run.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../src/main/playlists');
const { assignSides, durationSplit, discogsSides, albumKey } = require('../src/main/sides');
const { Providers, parseDuration } = require('../src/main/providers');
const { scoreRelease } = require('../src/main/library');

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('ok  ', name); } catch (e) { console.error('FAIL', name, '\n', e.message); process.exitCode = 1; } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'digi-deck-'));
const base = '/music/album';

t('m3u with EXTINF and relative paths', () => {
  const r = P.parseM3U('#EXTM3U\n#EXTINF:215,Artist - Song One\n01.mp3\n#EXTINF:100,Song Two\nsub/02.flac\n', base);
  assert.equal(r.length, 2);
  assert.equal(r[0].path, path.resolve(base, '01.mp3'));
  assert.equal(r[0].artist, 'Artist'); assert.equal(r[0].title, 'Song One'); assert.equal(r[0].duration, 215);
  assert.equal(r[1].title, 'Song Two');
});
t('m3u ignores streams, handles file:// and windows slashes', () => {
  const r = P.parseM3U('http://x/y.mp3\nfile:///tmp/a%20b.mp3\nsub\\c.mp3\n', base);
  assert.equal(r.length, 2);
  assert.equal(r[0].path, path.normalize('/tmp/a b.mp3'));
  assert.equal(r[1].path, path.resolve(base, 'sub/c.mp3'));
});
t('pls', () => {
  const r = P.parsePLS('[playlist]\nFile2=b.mp3\nTitle2=Bee\nFile1=a.mp3\nTitle1=Ay\nLength1=60\nNumberOfEntries=2', base);
  assert.deepEqual(r.map(x => x.title), ['Ay', 'Bee']); assert.equal(r[0].duration, 60);
});
t('xspf', () => {
  const x = '<playlist><trackList><track><location>file:///m/a%20one.mp3</location><title>One &amp; Two</title><creator>Me</creator><album>Alb</album><duration>61000</duration></track></trackList></playlist>';
  const r = P.xmlEntries(x, base);
  assert.equal(r[0].path, path.normalize('/m/a one.mp3')); assert.equal(r[0].title, 'One & Two'); assert.equal(r[0].artist, 'Me'); assert.equal(r[0].duration, 61);
});
t('wpl / asx / b4s / zpl', () => {
  assert.equal(P.xmlEntries('<smil><body><seq><media src="a.mp3"/><media src="b.mp3"/></seq></body></smil>', base).length, 2);
  assert.equal(P.xmlEntries('<asx><entry><ref href="x/a.mp3"/></entry></asx>', base).length, 1);
  assert.equal(P.xmlEntries('<WinampXML><playlist><entry Playstring="file:C:\\m\\a.mp3"/></playlist></WinampXML>', base).length, 1);
});
t('cue: one file per track vs single image', () => {
  const multi = P.parseCUE('PERFORMER "A"\nTITLE "T"\nFILE "1.flac" WAVE\n TRACK 01 AUDIO\n  TITLE "x"\nFILE "2.flac" WAVE\n TRACK 02 AUDIO\n  TITLE "y"\n', base);
  assert.equal(multi.entries.length, 2); assert.equal(multi.album, 'T'); assert.equal(multi.albumArtist, 'A');
  const one = P.parseCUE('TITLE "T"\nFILE "all.flac" WAVE\n TRACK 01 AUDIO\n TRACK 02 AUDIO\n', base);
  assert.equal(one.entries.length, 1);
});
t('parsePlaylist reads from disk (utf-16 + bom)', () => {
  const f = path.join(tmp, 'x.m3u8'); fs.writeFileSync(f, '\uFEFF#EXTM3U\na.mp3\n');
  assert.equal(P.parsePlaylist(f).entries.length, 1);
  const w = path.join(tmp, 'y.wpl'); fs.writeFileSync(w, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<smil><body><seq><media src="z.mp3"/></seq></body></smil>', 'utf16le')]));
  assert.equal(P.parsePlaylist(w).entries.length, 1);
});
t('folder scan is natural-sorted, recursive, audio only', () => {
  const d = path.join(tmp, 'f'); fs.mkdirSync(path.join(d, 'cd2'), { recursive: true });
  for (const n of ['10.mp3', '2.mp3', 'cover.jpg', 'notes.txt']) fs.writeFileSync(path.join(d, n), '');
  fs.writeFileSync(path.join(d, 'cd2', '1.flac'), '');
  const r = P.scanFolder(d).map(x => path.relative(d, x));
  assert.deepEqual(r, ['2.mp3', '10.mp3', path.join('cd2', '1.flac')]);
});
t('local art discovery', () => {
  const d = path.join(tmp, 'art'); fs.mkdirSync(d);
  for (const n of ['Cover.JPG', 'back.png', 'label_b.jpg', 'junk.jpg']) fs.writeFileSync(path.join(d, n), '');
  const a = P.findLocalArt(d);
  assert.ok(a.front && a.back && a.label_b && !a.label_a);
});

const tr = (...ds) => ds.map((d, i) => ({ title: 'T' + (i + 1), duration: d }));
t('duration split is balanced', () => {
  const s = durationSplit(tr(300, 300, 300, 300, 300, 300));
  assert.deepEqual(s, ['A', 'A', 'A', 'B', 'B', 'B']);
  assert.deepEqual(durationSplit(tr(600)), ['A']);
  const uneven = durationSplit(tr(900, 100, 100, 100)); assert.equal(uneven[0], 'A'); assert.equal(uneven[3], 'B');
});
t('discogs sides: by title, in any file order', () => {
  const list = [{ position: 'A1', title: 'Alpha' }, { position: 'A2', title: 'Beta' }, { position: 'B1', title: 'Gamma' }];
  assert.deepEqual(discogsSides([{ title: 'alpha' }, { title: 'BETA (remastered)' }, { title: 'Gamma' }], list), ['A', 'A', 'B']);
});
t('discogs sides: positional fallback + numeric positions rejected', () => {
  const list = [{ position: 'A1', title: 'x' }, { position: 'B1', title: 'y' }];
  assert.deepEqual(discogsSides([{ title: 'foo' }, { title: 'bar' }], list), ['A', 'B']);
  assert.equal(discogsSides([{ title: 'a' }], [{ position: '1', title: 'a' }]), null);
  assert.equal(discogsSides([{ title: 'a' }], [{ position: '1-1', title: 'a' }]), null);
});
t('assignSides: cd is single side, vinyl uses discogs else time', () => {
  assert.deepEqual(assignSides('cd', tr(1, 2), null), ['A', 'A']);
  assert.deepEqual(assignSides('vinyl', tr(100, 100), null), ['A', 'B']);
  assert.deepEqual(assignSides('cassette', [{ title: 'q' }, { title: 'w' }], [{ position: 'A1', title: 'q' }, { position: 'A2', title: 'w' }]), ['A', 'A']);
});
t('album keys are stable and mode-independent', () => {
  const s = { kind: 'album', artist: 'The Band', title: 'Rec (Deluxe)', tracks: [] };
  assert.equal(albumKey(s), albumKey({ ...s, artist: 'the band', title: 'rec' }));
  assert.notEqual(albumKey({ kind: 'single', tracks: [{ path: '/a' }] }), albumKey({ kind: 'single', tracks: [{ path: '/b' }] }));
});
t('release refs + durations', () => {
  assert.deepEqual(Providers.parseReleaseRef('https://www.discogs.com/release/249504-Rick-Astley-Never-Gonna-Give-You-Up'), { source: 'discogs', id: '249504' });
  assert.deepEqual(Providers.parseReleaseRef('https://musicbrainz.org/release/76df3287-6cda-33eb-8e9a-044b5e15ffdd'), { source: 'musicbrainz', id: '76df3287-6cda-33eb-8e9a-044b5e15ffdd' });
  assert.equal(Providers.parseReleaseRef('hello'), null);
  assert.equal(parseDuration('3:45'), 225); assert.equal(parseDuration('1:02:03'), 3723); assert.equal(parseDuration(''), 0);
});
t('release scoring prefers the right format', () => {
  const want = { artist: 'A', title: 'T' };
  const lp = scoreRelease({ title: 'T', artist: 'A', format: 'Vinyl, LP', source: 'discogs' }, want, 'vinyl', 10);
  const cd = scoreRelease({ title: 'T', artist: 'A', format: 'CD', source: 'discogs' }, want, 'vinyl', 10);
  assert.ok(lp > cd);
});

// databases: three physically separate files
let Store;
try { Store = require('../src/main/db').Store; } catch (e) { console.log('skip db tests:', e.message.split('\n')[0]); }
if (Store) {
  let store;
  try { store = new Store(path.join(tmp, 'db')); } catch (e) { console.log('skip db tests:', e.message.split('\n')[0]); }
  if (store) {
    t('three separate db files exist', () => { for (const m of ['vinyl', 'cd', 'cassette']) assert.ok(fs.existsSync(path.join(tmp, 'db', m + '.db'))); });
    t('save / load / isolate between modes', () => {
      const a = store.save('vinyl', { key: 'k1', kind: 'album', artist: 'X', title: 'Y', front: '/f.jpg', label_a: '/la.jpg', tracks: [{ title: 'one', duration: 10, side: 'A', path: '/1.mp3' }, { title: 'two', duration: 20, side: 'B', path: '/2.mp3' }] });
      assert.equal(a.tracks.length, 2); assert.equal(a.tracks[1].side, 'B');
      assert.ok(store.getByKey('vinyl', 'k1')); assert.equal(store.getByKey('cd', 'k1'), null); assert.equal(store.getByKey('cassette', 'k1'), null);
      a.title = 'Z'; a.tracks.pop(); const b = store.save('vinyl', a);
      assert.equal(b.title, 'Z'); assert.equal(b.tracks.length, 1); assert.equal(store.list('vinyl').length, 1);
      store.remove('vinyl', b.id); assert.equal(store.list('vinyl').length, 0);
    });
  }
}
// ---- format-specific art + library scanner
t('autoPick prefers art from the matched release in the same format, hides other formats\' disc art', () => {
  const pr = new Providers({ cacheDir: path.join(tmp, 'c1'), getSettings: () => ({}) });
  const cands = [
    { source: 'itunes', slot: 'front', url: 'dig', exact: false },
    { source: 'coverartarchive', slot: 'front', url: 'lp-front', exact: true },
    { source: 'audiodb', slot: 'label', url: 'cd-disc', exact: true, fmt: 'cd' },
    { source: 'coverartarchive', slot: 'label', url: 'lp-label', exact: true }];
  assert.equal(pr.autoPick(cands, 'vinyl').front.url, 'lp-front');
  assert.equal(pr.autoPick(cands, 'vinyl').label_a.url, 'lp-label');
  assert.equal(pr.autoPick(cands, 'cassette').label_a.url, 'lp-label');
  assert.equal(pr.autoPick(cands, 'vinyl').label_b, null);          // CD disc art never lands on a record
  assert.equal(pr.autoPick(cands, 'cd').label_b.url, 'cd-disc');
});
t('release scoring prefers the wanted format and penalises the others', () => {
  const want = { artist: 'A', title: 'T' };
  const lp = scoreRelease({ title: 'T', artist: 'A', format: '12" Vinyl', source: 'musicbrainz' }, want, 'vinyl', 10);
  const cd = scoreRelease({ title: 'T', artist: 'A', format: 'CD', source: 'musicbrainz' }, want, 'vinyl', 10);
  assert.ok(lp > cd + 40);
  assert.ok(scoreRelease({ title: 'T', artist: 'A', format: 'Cassette', source: 'musicbrainz' }, want, 'cassette', 10) > scoreRelease({ title: 'T', artist: 'A', format: 'CD', source: 'musicbrainz' }, want, 'cassette', 10));
});
const { findAlbumDirs, LibraryScanner } = require('../src/main/libscan');
const lib = path.join(tmp, 'lib');
for (const f of ['Artist/Album One/01.mp3', 'Artist/Album One/02.mp3', 'Artist/Double/CD1/a.flac', 'Artist/Double/CD2/b.flac', 'Loose/x.mp3', 'Empty/readme.txt']) {
  fs.mkdirSync(path.dirname(path.join(lib, f)), { recursive: true }); fs.writeFileSync(path.join(lib, f), 'x');
}
t('findAlbumDirs: one entry per album folder, multi-disc folded into the parent, non-audio ignored', () => {
  const r = findAlbumDirs(lib).map(a => path.relative(lib, a.dir).split(path.sep).join('/')).sort();
  assert.deepEqual(r, ['Artist/Album One', 'Artist/Double', 'Loose']);
  assert.equal(findAlbumDirs(lib).find(a => a.dir.endsWith('Double')).files.length, 2);
});
(async () => {
  try {
  const calls = []; const events = [];
    const fake = { resolve: async ({ mode, scan }) => { calls.push(mode + ':' + scan.title); } };
    const sc = new LibraryScanner({ library: fake, indexFile: path.join(tmp, 'idx.json'), cacheDir: path.join(tmp, 'c2'), emit: m => events.push(m.phase) });
    fs.mkdirSync(path.join(tmp, 'c2'), { recursive: true });
    const r1 = await sc.run({ roots: [lib], formats: ['vinyl', 'cd'] });
    assert.equal(r1.albums, 3); assert.equal(calls.length, 6); assert.ok(events.includes('done'));
    calls.length = 0;
    const r2 = await sc.run({ roots: [lib], formats: ['vinyl', 'cd'] });
    assert.equal(calls.length, 0); assert.equal(r2.unchanged, 3);
    pass++; console.log('ok   LibraryScanner files every album in each format and skips unchanged folders on re-scan');
  } catch (e) { console.error('FAIL LibraryScanner', e.message); process.exitCode = 1; }
  try {
    const { isNewer } = require('../src/main/updater'); const ai = require('../src/main/appinfo');
    assert.ok(isNewer('v0.2.0', '0.1.9') && isNewer('1.0.0', '0.9.9') && isNewer('0.1.10', '0.1.9'));
    assert.ok(!isNewer('0.1.0', '0.1.0') && !isNewer('v0.1.0', '0.2.0') && !isNewer('0.1.0-beta', '0.1.0'));
    assert.ok(ai.DONATE_URL.includes('business=section9agent%40hotmail.com') && ai.allowedUrls().has(ai.DONATE_URL));
    pass++; console.log('ok   update version compare + donate link');
  } catch (e) { console.error('FAIL updater', e.message); process.exitCode = 1; }
  try {
    const { durationSplit, sidesCount } = require('../src/main/sides');
    const mk = n => Array.from({ length: n }, () => ({ duration: 240 }));
    assert.equal(durationSplit(mk(10), 2).join(''), 'AAAAABBBBB');
    assert.equal(durationSplit(mk(20), 4).join(''), 'AAAAABBBBBCCCCCDDDDD');
    assert.equal(sidesCount(['A', 'B', 'C', 'D']), 4);
    pass++; console.log('ok   multi-record side splitting');
    const sd = require('../src/main/sides');
    const long = Array.from({ length: 30 }, (_, i) => ({ title: 't' + i, duration: 300 }));      // 150 min
    const cass = sd.capacitySplit('cassette', long, sd.capFor('cassette')), cdd = sd.capacitySplit('cd', long, sd.capFor('cd')), lp = sd.capacitySplit('vinyl', long, sd.capFor('vinyl'));
    const mins = (arr, L) => arr.reduce((a, l, i) => a + (l === L ? long[i].duration : 0), 0) / 60;
    assert.ok(new Set(cass).size >= 4 && [...new Set(cass)].every(L => mins(cass, L) <= 45), 'cassette sides <= 45 min');
    assert.ok([...new Set(cdd)].every(L => mins(cdd, L) <= 80) && new Set(cdd).size === 2, 'CD discs <= 80 min');
    assert.ok([...new Set(lp)].every(L => mins(lp, L) <= 25), 'vinyl sides <= 25 min');
    const mix = sd.capacitySplit('cassette', Array.from({ length: 10 }, () => ({ duration: 300 })), sd.capFor('cassette'));
    assert.strictEqual(mix.join(''), 'AAAAAAAAAB', 'cassette mix tape fills side A to 45 min first');
    pass++; console.log('ok   capacity limits (vinyl 25/side, cassette 90/tape, CD 80/disc)');
  } catch (e) { console.error('FAIL sides', e.message); process.exitCode = 1; }
  console.log(`\n${pass} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
