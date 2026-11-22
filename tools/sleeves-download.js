#!/usr/bin/env node
// Digi-Deck: download openly licensed "company sleeve" images (the generic paper sleeves record labels used for 45s and 78s)
// and sort them into   <out>/45/   <out>/78/   <out>/unsorted/   named   "<Label> - <year>.jpg".
//
// Sources (only ones that allow bulk download, and only images with a free / public-domain licence):
//   * Wikimedia Commons  - record-sleeve categories and searches (no key needed)
//   * Internet Archive   - image items about record sleeves marked public domain / Creative Commons (no key needed)
//   * Flickr (optional)  - Creative Commons / no-known-copyright photos; set FLICKR_KEY to a free Flickr API key to include it
// 45cat / 45spaces, Discogs and most museum sites do not allow bulk downloading, so they are not used here.
//
// Every saved image gets an entry in <out>/credits.json (source page, author, licence) - keep it with the images.
// Usage:   node tools/sleeves-download.js [output folder] [--dry] [--max N]
//          FLICKR_KEY=xxxxxxxx node tools/sleeves-download.js "C:\Sleeves"        (Windows: set FLICKR_KEY=xxxx first)
// Needs Node 18 or newer (the one that comes with the project is fine). Run it again any time: files already saved are skipped.

const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const OUT = path.resolve(args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) || 'company-sleeves');
const DRY = args.includes('--dry'), MAX = +(args[args.indexOf('--max') + 1] || 0) || Infinity;
const UA = 'DigiDeckSleeveFetcher/1.0 (personal media player artwork; https://github.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- sorting: format, label, year
const LABELS = ['RCA Victor', 'Victor', 'Columbia', 'Decca', 'Brunswick', 'Vocalion', 'Okeh', 'OKeh', 'Bluebird', 'Capitol', 'Mercury', 'MGM', 'Atlantic', 'Atco',
  'Motown', 'Tamla', 'Gordy', 'Stax', 'Chess', 'Checker', 'Sun', 'Dot', 'Imperial', 'Liberty', 'King', 'Federal', 'Specialty', 'Vee-Jay', 'Coral', 'Cadence',
  'ABC-Paramount', 'ABC', 'Paramount', 'Gennett', 'Edison', 'Okeh', 'Perfect', 'Banner', 'Melotone', 'Conqueror', 'Harmony', 'Velvet Tone', 'Emerson', 'Pathé', 'Pathe',
  'Odeon', 'Parlophone', 'HMV', 'His Master\'s Voice', 'Regal Zonophone', 'Regal', 'Zonophone', 'Beltona', 'Rex', 'Imperial', 'Edison Bell', 'Winner', 'Sterno',
  'Piccadilly', 'Pye', 'Philips', 'Fontana', 'London', 'Polydor', 'Deutsche Grammophon', 'Telefunken', 'Electrola', 'Durium',
  'EMI', 'Oriole', 'Embassy', 'Top Rank', 'Warner Bros', 'Reprise', 'Kapp', 'Epic', 'Okeh', 'Swan', 'Cameo', 'Parkway', 'Laurie', 'Roulette', 'Jubilee',
  'Modern', 'Aladdin', 'Savoy', 'Apollo', 'Duke', 'Peacock', 'Excello', 'Vogue', 'Festival', 'Starday', 'Hickory', 'Monument', 'Okeh', 'Arhoolie',
  'Baidaphon', 'Columbia Viva-Tonal', 'Zon-o-phone', 'Crown', 'Varsity', 'Musicraft', 'Keynote', 'Commodore', 'Blue Note', 'Prestige', 'Verve'];
const uniqLabels = [...new Set(LABELS)].sort((a, b) => b.length - a.length);          // longest first: "RCA Victor" before "Victor"

function formatOf(t) {
  if (/\b78\s*(rpm|r\.p\.m|s\b|record|disc)|\bshellac\b|\b10[\s-]?(inch|in\b|")|\bgramophone record|\b78\b/i.test(t)) return '78';
  if (/\b45\s*(rpm|r\.p\.m|s\b|record|single)|\b7[\s-]?(inch|in\b|")|\bseven[\s-]inch\b|\b45\b/i.test(t)) return '45';
  return 'unsorted';
}
function yearOf(t, date) {
  const m = String(t).match(/\b(18[89]\d|19\d\d|20[0-2]\d)s?\b/) || String(date || '').match(/\b(18[89]\d|19\d\d|20[0-2]\d)\b/);
  return m ? m[1] + (/\d{4}s\b/.test(m[0]) ? 's' : '') : '';
}
// label names that are also ordinary words only count when "Records" / "Record Co" / "label" follows them
const AMBIG = new Set(['Sun', 'King', 'Crown', 'Winner', 'Swan', 'Duke', 'Banner', 'Perfect', 'Harmony', 'Regal', 'Rex', 'Apollo', 'Festival', 'Modern', 'Imperial',
  'Liberty', 'Epic', 'Dot', 'Coral', 'Federal', 'Monument', 'Jubilee', 'Specialty', 'Cameo', 'Savoy', 'Commodore', 'Keynote', 'Varsity', 'London', 'Vogue', 'Embassy',
  'Laurie', 'Parkway', 'Peacock', 'Hickory', 'Kapp', 'Chess', 'Checker', 'Gordy', 'Philips', 'Oriole', 'Winner', 'Piccadilly', 'Crown', 'Velvet Tone', 'Conqueror', 'Perfect']);
function labelOf(t) {
  for (const L of uniqLabels) {
    const esc = L.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = AMBIG.has(L) ? new RegExp('(^|[^A-Za-z])' + esc + '\\s+(Records?|Record Co|Recording|label)\\b') : new RegExp('(^|[^A-Za-z])' + esc + '([^A-Za-z]|$)', /^[A-Z]{2,4}$/.test(L) ? '' : 'i');
    if (re.test(t)) return L === 'Okeh' ? 'OKeh' : L === 'Pathe' ? 'Pathé' : L;
  }
  const m = t.match(/([A-Z][\w&.'’-]+(?:\s[A-Z][\w&.'’-]+){0,2})\s+(?:Records?|Record Co(?:mpany)?|Recording|Phonograph|Talking Machine)/);
  return m ? m[1] : 'Unknown label';
}
const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
const safe = s => s.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Unknown';
const isSleeve = t => /sleeve|record (bag|cover|envelope)|paper (bag|cover)|company bag|disc (bag|cover)|inner bag|record jacket/i.test(t);

// ---------------------------------------------------------------- saving
if (require.main === module) fs.mkdirSync(OUT, { recursive: true });
const creditsFile = path.join(OUT, 'credits.json');
let credits = []; try { credits = JSON.parse(fs.readFileSync(creditsFile, 'utf8')); } catch {}
const seen = new Set(credits.map(c => c.source));
let saved = 0, skipped = 0;

async function get(url, json = true, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': json ? 'application/json' : '*/*' } });
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return json ? r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === tries - 1) throw e; await sleep(2000 * (i + 1)); }
  }
}
async function save({ url, text, date, source, author, licence, licenceUrl, site }) {
  if (saved >= MAX || seen.has(source)) { skipped++; return; }
  const fmt = formatOf(text), label = safe(labelOf(text)), year = yearOf(text, date) || 'unknown year';
  const ext = (path.extname(new URL(url).pathname).toLowerCase().match(/^\.(jpe?g|png|gif|webp|tiff?)$/) || ['.jpg'])[0].replace('.jpeg', '.jpg');
  const dir = path.join(OUT, fmt); fs.mkdirSync(dir, { recursive: true });
  let name = `${label} - ${year}${ext}`, n = 2;
  while (fs.existsSync(path.join(dir, name))) name = `${label} - ${year} (${n++})${ext}`;
  console.log(`${DRY ? '[dry] ' : ''}${fmt.padEnd(8)} ${name}   <- ${site}`);
  if (!DRY) {
    const buf = await get(url, false);
    fs.writeFileSync(path.join(dir, name), buf);
    credits.push({ file: path.join(fmt, name), source, image: url, author: clean(author), licence: clean(licence), licenceUrl, site, description: clean(text).slice(0, 300) });
    fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 1));
  }
  seen.add(source); saved++;
  await sleep(700);                                               // be polite
}

// ---------------------------------------------------------------- Wikimedia Commons
const FREE = /public domain|^pd|cc0|cc[ -]by|cc-by|creative commons|gfdl|attribution/i;
async function commons() {
  const API = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*&';
  const files = new Set();
  // categories, walked two levels down
  const cats = ['Category:Record sleeves', 'Category:Record company sleeves', 'Category:Gramophone record sleeves', 'Category:78 rpm record sleeves', 'Category:Phonograph record sleeves'];
  const walk = async (cat, depth) => {
    let cont = '';
    do {
      const j = await get(API + `action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmtype=file|subcat&cmlimit=500${cont}`).catch(() => null);
      if (!j || !j.query) return;
      for (const m of j.query.categorymembers) { if (m.ns === 6) files.add(m.title); else if (m.ns === 14 && depth > 0) await walk(m.title, depth - 1); }
      cont = j.continue ? `&cmcontinue=${encodeURIComponent(j.continue.cmcontinue)}` : '';
    } while (cont);
  };
  for (const c of cats) await walk(c, 2);
  // searches of file pages
  for (const q of ['"company sleeve"', '"record sleeve" 78', '"record sleeve" 45', '78 rpm sleeve', '45 rpm sleeve', 'gramophone record sleeve', 'shellac record sleeve', 'record company paper sleeve']) {
    const j = await get(API + `action=query&list=search&srnamespace=6&srlimit=200&srsearch=${encodeURIComponent(q)}`).catch(() => null);
    (j && j.query ? j.query.search : []).forEach(s => files.add(s.title));
    await sleep(300);
  }
  console.log(`Wikimedia Commons: ${files.size} candidate files`);
  const list = [...files];
  for (let i = 0; i < list.length; i += 40) {
    const j = await get(API + `action=query&prop=imageinfo&iiprop=url|extmetadata&titles=${encodeURIComponent(list.slice(i, i + 40).join('|'))}`).catch(() => null);
    for (const p of Object.values((j && j.query && j.query.pages) || {})) {
      const ii = p.imageinfo && p.imageinfo[0]; if (!ii) continue;
      const md = ii.extmetadata || {}, v = k => (md[k] && md[k].value) || '';
      const text = clean(`${p.title.replace(/^File:/, '').replace(/\.\w+$/, '')} ${v('ObjectName')} ${v('ImageDescription')} ${v('Categories')}`);
      if (!isSleeve(text)) continue;
      const lic = v('LicenseShortName'); if (!FREE.test(lic)) continue;
      if (!/\.(jpe?g|png|gif|webp|tiff?)$/i.test(ii.url)) continue;
      await save({ url: ii.url, text, date: v('DateTimeOriginal'), source: ii.descriptionurl, author: v('Artist'), licence: lic, licenceUrl: v('LicenseUrl'), site: 'Wikimedia Commons' }).catch(e => console.log('  failed:', p.title, e.message));
      if (saved >= MAX) return;
    }
  }
}

// ---------------------------------------------------------------- Internet Archive
async function archive() {
  const q = '(title:(sleeve) OR subject:(sleeve) OR subject:("record sleeve") OR subject:("company sleeve") OR description:("company sleeve") OR description:("record sleeve"))'
    + ' AND (mediatype:image OR mediatype:texts) AND (licenseurl:*publicdomain* OR licenseurl:*creativecommons*)';
  const fl = ['identifier', 'title', 'date', 'description', 'licenseurl', 'subject', 'creator'].map(f => 'fl[]=' + f).join('&');
  let page = 1, items = [];
  for (;;) {
    const j = await get(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&${fl}&rows=200&page=${page}&output=json`).catch(() => null);
    const docs = (j && j.response && j.response.docs) || []; items = items.concat(docs);
    if (docs.length < 200) break; page++; await sleep(500);
  }
  console.log(`Internet Archive: ${items.length} candidate items`);
  for (const d of items) {
    const text = clean(`${d.title} ${[].concat(d.subject || []).join(' ')} ${[].concat(d.description || []).join(' ')}`);
    if (!isSleeve(text)) continue;
    // an item marked free whose description still says "not for commercial use" is kept, but noted (fine for personal use)
    const meta = await get(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`).catch(() => null);
    const imgs = ((meta && meta.files) || []).filter(f => f.source === 'original' && /\.(jpe?g|png|tiff?)$/i.test(f.name)).slice(0, 4);
    for (const f of imgs) {
      await save({ url: `https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(f.name)}`, text: text + ' ' + f.name, date: d.date,
        source: `https://archive.org/details/${d.identifier}#${f.name}`, author: [].concat(d.creator || []).join(', '), licence: d.licenseurl, licenceUrl: d.licenseurl, site: 'Internet Archive' })
        .catch(e => console.log('  failed:', d.identifier, e.message));
      if (saved >= MAX) return;
    }
    await sleep(400);
  }
}

// ---------------------------------------------------------------- Flickr (optional, needs FLICKR_KEY)
async function flickr() {
  const key = process.env.FLICKR_KEY; if (!key) { console.log('Flickr: skipped (set FLICKR_KEY to a free Flickr API key to include it)'); return; }
  const LIC = { 1: 'CC BY-NC-SA 2.0', 2: 'CC BY-NC 2.0', 3: 'CC BY-NC-ND 2.0', 4: 'CC BY 2.0', 5: 'CC BY-SA 2.0', 6: 'CC BY-ND 2.0', 7: 'No known copyright restrictions', 8: 'United States Government Work', 9: 'CC0 1.0', 10: 'Public Domain Mark 1.0' };
  for (const q of ['company sleeve 45', 'company sleeve 78', 'record company sleeve', '78 rpm sleeve', '45 rpm record sleeve', 'factory record sleeve', 'gramophone record sleeve']) {
    for (let page = 1; page <= 5; page++) {
      const j = await get(`https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${key}&text=${encodeURIComponent(q)}&license=1,2,3,4,5,6,7,8,9,10&extras=license,owner_name,date_taken,url_o,url_l,description,tags&per_page=250&page=${page}&format=json&nojsoncallback=1`).catch(() => null);
      const ps = (j && j.photos && j.photos.photo) || [];
      for (const p of ps) {
        const text = clean(`${p.title} ${p.description && p.description._content} ${p.tags}`); if (!isSleeve(text)) continue;
        const url = p.url_o || p.url_l; if (!url) continue;
        await save({ url, text, date: p.datetaken, source: `https://www.flickr.com/photos/${p.owner}/${p.id}`, author: p.ownername, licence: LIC[p.license] || p.license, site: 'Flickr' }).catch(e => console.log('  failed:', p.id, e.message));
        if (saved >= MAX) return;
      }
      if (!j || page >= (j.photos ? j.photos.pages : 0)) break;
      await sleep(600);
    }
  }
}

if (require.main === module) (async () => {
  console.log(`Saving company sleeves to ${OUT}${DRY ? '  (dry run - nothing is downloaded)' : ''}\n`);
  for (const [name, fn] of [['Wikimedia Commons', commons], ['Internet Archive', archive], ['Flickr', flickr]]) {
    if (saved >= MAX) break;
    try { await fn(); } catch (e) { console.log(`${name}: stopped - ${e.message}`); }
  }
  console.log(`\nDone: ${saved} saved, ${skipped} already had / skipped. Credits and licences: ${creditsFile}`);
  console.log('Check the "unsorted" folder - images whose description did not say 45 or 78 go there; move and rename them by hand.');
})();
// exported for the unit check in test/
module.exports = { formatOf, yearOf, labelOf, isSleeve };
