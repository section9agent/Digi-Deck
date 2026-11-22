#!/usr/bin/env node
// Digi-Deck: download the company-sleeve pictures from https://sleeves.bigboppa.co.uk/ (BigBoppa reproduction sleeves)
// and sort them into   <out>/45/   <out>/78/   <out>/unsorted/   named   "<Label> - <year>.jpg"   (or "<Label>.jpg" when no year is given).
//
// The site is an archive with one page per label and country (e.g. /USA/dot/dot-us.htm, /UK/london/lond-uk.htm).
// How it works: it walks the site's own pages (same site only), the way a browser would, reads each page's title, heading, the
// caption next to each picture and the pictures' alt text to work out the label, the size (7" -> 45, 10" -> 78) and any year, and saves the full-size version of each
// sleeve picture. It is polite on purpose: it follows the site's robots.txt, waits between requests (1.5 s, or the site's
// Crawl-delay if that is longer), never touches the basket / checkout / account pages, and remembers what it already saved,
// so you can stop it (Ctrl+C) and run it again later to carry on.
//
// The pictures are BigBoppa's product photos - keep them for your own Digi-Deck library and don't re-share them.
//
// Usage:   node tools/bigboppa-sleeves.js [output folder] [--dry] [--max N] [--pages N] [--delay ms] [--start URL]
//          --local F  don't go online: sort the pictures from pages you saved from your browser into folder F
//          --dry      list what would be saved, download nothing
//          --max N    stop after N pictures          --pages N  visit at most N pages (default 5000)
//          --delay ms wait between requests (default 1500, never less than the site asks for)
// Needs Node 18 or newer.  Windows: double-click tools\download-bigboppa-sleeves.bat

const fs = require('fs'), path = require('path');
const { formatOf: fmtGeneric, yearOf, labelOf } = require('./sleeves-download.js');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const flagVals = new Set(['--max', '--pages', '--delay', '--start', '--local'].map(n => opt(n, null)).filter(Boolean));
const LOCAL = opt('--local', null);           // a folder of pages saved from a web browser (Save page as... > Web page, complete)
const OUT = path.resolve(args.find(a => !a.startsWith('--') && !flagVals.has(a)) || 'BigBoppa Sleeves');
const DRY = args.includes('--dry'), MAX = +opt('--max', 0) || Infinity, PAGES = +opt('--pages', 5000);
let DELAY = Math.max(500, +opt('--delay', 1500));
const START = opt('--start', 'https://sleeves.bigboppa.co.uk/');
const HOST = new URL(START).host;
const UA = 'Mozilla/5.0 (compatible; DigiDeckSleeveFetcher/1.1; personal media-player artwork)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- what to visit
const SKIP_PATH = /\/(cart|basket|checkout|my-account|account|login|logout|register|wishlist|compare|wp-admin|wp-login|wp-json|feed|xmlrpc|cdn-cgi|search|policies|policy|terms|privacy|contact|blog\/tag)\b/i;
const SKIP_QUERY = /[?&](add-to-cart|add_to_wishlist|orderby|filter_|min_price|max_price|replytocom|share|currency|variant|_pos|_sid|_ss|q=|s=)/i;
const SKIP_EXT = /\.(css|js|json|xml|txt|pdf|zip|mp3|mp4|woff2?|ttf|ico|svg)(\?|$)/i;
const IMG_EXT = /\.(jpe?g|png|webp|gif|tiff?)(\?|$)/i;

let robots = { disallow: [], allow: [] };
function robotsOk(u) {
  const p = new URL(u).pathname + new URL(u).search;
  const hit = list => list.filter(r => r && p.startsWith(r)).reduce((a, r) => Math.max(a, r.length), -1);
  const d = hit(robots.disallow), a = hit(robots.allow);
  return d < 0 || a >= d;
}
async function loadRobots() {
  try {
    const r = await fetch(new URL('/robots.txt', START), { headers: { 'User-Agent': UA } }); if (!r.ok) return;
    let mine = false;
    for (const line of (await r.text()).split(/\r?\n/)) {
      const [k, ...v] = line.split(':'), key = k.trim().toLowerCase(), val = v.join(':').trim();
      if (key === 'user-agent') mine = val === '*' || /digideck/i.test(val);
      else if (mine && key === 'disallow' && val) robots.disallow.push(val.replace(/\*.*$/, ''));
      else if (mine && key === 'allow' && val) robots.allow.push(val.replace(/\*.*$/, ''));
      else if (mine && key === 'crawl-delay' && +val) DELAY = Math.max(DELAY, +val * 1000);
    }
  } catch {}
}
function norm(href, base) {
  try {
    const u = new URL(href.replace(/&amp;/g, '&'), base); u.hash = '';
    if (u.host !== HOST || !/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch { return null; }
}
const pageOk = u => u && !SKIP_PATH.test(new URL(u).pathname) && !SKIP_QUERY.test(u) && !SKIP_EXT.test(u) && !IMG_EXT.test(u) && robotsOk(u);

// ---------------------------------------------------------------- full-size picture from a thumbnail address
// WordPress / WooCommerce (name-300x300.jpg), Shopify (name_400x.jpg, ?width=), Wix (/v1/fill/...), Squarespace (?format=300w)
function fullSize(u) {
  try {
    const x = new URL(u);
    x.pathname = x.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|webp|gif)$)/i, '').replace(/-scaled(?=\.(jpe?g|png|webp)$)/i, '')
      .replace(/_(\d{2,4}x\d{0,4}|\d{0,4}x\d{2,4}|pico|icon|thumb|small|compact|medium|large|grande)(@2x)?(?=\.(jpe?g|png|webp|gif)$)/i, '');
    if (/wixstatic\.com$/.test(x.host)) x.pathname = x.pathname.replace(/\/v1\/.*$/, '');
    for (const k of ['width', 'height', 'w', 'h', 'resize', 'fit', 'crop', 'format', 'quality', 'v']) x.searchParams.delete(k);
    return x.toString();
  } catch { return u; }
}
const imgKey = u => fullSize(u).replace(/\?.*$/, '').toLowerCase();
// logos, icons, payment badges, banners and the like
const NOT_SLEEVE = /(logo|icon|favicon|sprite|banner|header|footer|badge|payment|paypal|visa|mastercard|stripe|placeholder|spinner|loader|avatar|flag|facebook|twitter|instagram|ebay|etsy|trustpilot|cookie|arrow|button|bg[-_]|background)/i;

// ---------------------------------------------------------------- reading a page
const strip = s => String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : ''; };
function biggestFromSrcset(s) {
  let best = null, bw = 0;
  for (const part of String(s || '').split(',')) { const [u, d] = part.trim().split(/\s+/); const w = parseFloat(d) || 1; if (u && w >= bw) { best = u; bw = w; } }
  return best;
}
function readPage(html, url) {
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).replace(/\s*[|–—-]\s*(BigBoppa|Big Boppa)[^|]*$/i, '');
  const h1 = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
  const ogImg = (html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i) || [])[0];
  const desc = strip((html.match(/<meta[^>]+name=["']description["'][^>]*>/i) || [''])[0].replace(/^.*content=["']([^"']*)["'].*$/i, '$1')).slice(0, 300);
  const links = new Set(), imgs = [], thumbs = new Set();
  for (const m of html.matchAll(/<(frame|iframe)\b[^>]*>/gi)) { const u = norm(attr(m[0], 'src'), url); if (u) links.add(u); }
  for (const m of html.matchAll(/(?:location(?:\.href)?\s*=|window\.open\(|location\.replace\()\s*['"]([^'"]+)['"]/gi)) { const u = norm(m[1], url); if (u) links.add(u); }
  for (const m of html.matchAll(/<option\b[^>]*value=['"]([^'"]+\.html?)['"]/gi)) { const u = norm(m[1], url); if (u) links.add(u); }
  for (const m of html.matchAll(/<(a|area)\b[^>]*>/gi)) {
    const href = attr(m[0], 'href'); if (!href) continue; const u = norm(href, url);
    if (u && IMG_EXT.test(new URL(u).pathname)) { const inner = html.slice(m.index, m.index + 700).split(/<\/a>/i)[0].match(/<img\b[^>]*>/i); if (inner) { try { thumbs.add(new URL(attr(inner[0], 'src'), url).toString()); } catch {} } }
    if (u && IMG_EXT.test(new URL(u).pathname)) imgs.push({ src: u, alt: attr(m[0], 'title') || attr(m[0], 'data-caption'), cap: (() => { const seg = html.slice(m.index, m.index + 1500).replace(/^<[^>]*>/, ''); const k = seg.search(/<\/a>/i); const inside = k < 0 ? '' : seg.slice(0, k), rest = k < 0 ? seg : seg.slice(k + 4); const n = rest.search(/<img\b|<a\b[^>]*\.(jpe?g|png|gif)/i); return strip(inside + ' ' + (n < 0 ? rest.slice(0, 600) : rest.slice(0, n))).slice(0, 160); })(), linked: true });
    else if (u) links.add(u);
    else { try { const x = new URL(href, url); if (IMG_EXT.test(x.pathname)) { const seg = html.slice(m.index, m.index + 1500).replace(/^<[^>]*>/, ''), k = seg.search(/<\/a>/i), rest = k < 0 ? seg : seg.slice(k + 4), n = rest.search(/<img\b|<a\b[^>]*\.(jpe?g|png|gif)/i); imgs.push({ src: x.toString(), alt: attr(m[0], 'title'), cap: strip((k < 0 ? '' : seg.slice(0, k)) + ' ' + (n < 0 ? rest.slice(0, 600) : rest.slice(0, n))).slice(0, 160), linked: true }); const inner = (k < 0 ? '' : seg.slice(0, k)).match(/<img\b[^>]*>/i); if (inner) { try { thumbs.add(new URL(attr(inner[0], 'src'), url).toString()); } catch {} } } } catch {} }   // full-size pictures on a CDN
  }
  const caption = i => { const after = html.slice(i).replace(/^<[^>]*>/, ''); const nxt = after.search(/<img\b/i); return strip(after.slice(0, nxt < 0 ? 600 : Math.min(nxt, 600))).slice(0, 160); };
  const before = i => { const b = html.slice(Math.max(0, i - 600), i); const k = b.search(/<img\b[^>]*>(?![\s\S]*<img\b)/i); return strip(k < 0 ? b : b.slice(k).replace(/^<[^>]*>/, '')).slice(-120); };
  for (const m of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const t = m[0], cap = (caption(m.index) + ' ' + before(m.index)).trim();
    const big = attr(t, 'data-large_image') || attr(t, 'data-zoom-image') || attr(t, 'data-zoom') || attr(t, 'data-full') || attr(t, 'data-original')
      || biggestFromSrcset(attr(t, 'data-srcset') || attr(t, 'srcset')) || attr(t, 'data-src') || attr(t, 'data-lazy-src') || attr(t, 'src');
    if (!big || /^data:/.test(big)) continue;
    try { imgs.push({ src: new URL(big.replace(/&amp;/g, '&'), url).toString(), alt: attr(t, 'alt') || attr(t, 'title'), cap, linked: false }); } catch {}
  }
  if (ogImg) { const c = attr(ogImg, 'content'); if (c) try { imgs.push({ src: new URL(c, url).toString(), alt: '' }); } catch {} }
  // JSON-LD product data (most shop platforms include it): name + image list
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
        if (/Product/i.test(o['@type'])) [].concat(o.image || []).forEach(i => { const s = typeof i === 'string' ? i : i && (i.url || i.contentUrl); if (s) imgs.push({ src: new URL(s, url).toString(), alt: o.name || '' }); });
        Object.values(o).forEach(walk); };
      walk(JSON.parse(m[1]));
    } catch {}
  }
  const isProduct = /\/(product|products|item|shop\/p)\//i.test(url) || /"@type"\s*:\s*"Product"/i.test(html) || /single-product|product-template/i.test(html);
  return { title, h1, desc, links: [...links], imgs: imgs.filter(i => i.linked || !thumbs.has(i.src)), isProduct };
}

// ---------------------------------------------------------------- sorting
// BigBoppa lists sizes as 7" / 7 inch (45s), 10" (78s); 12" LP sleeves go in "unsorted" unless they say 45 or 78
function formatOf(t) {
  if (/\b10\s*(["”″]|inch|in\b|-inch)|\b78\s*(rpm)?s?\b|\bshellac\b/i.test(t)) return '78';
  if (/\b7\s*(["”″]|inch|in\b|-inch)|\b45\s*(rpm)?s?\b|\bsingles?\b/i.test(t)) return '45';
  return fmtGeneric(t);
}
function labelFrom(ctx) {
  const t = ctx.match(/^\s*(.+?)\s+Record(?:s|ing)?(?:\s+(?:Co\.?|Company|Corp\.?|Ltd\.?))?\s+(?:UK|USA|US|Canada|Europe|Germany|France|Australia|Japan)\b/i);
  if (t && t[1].length < 40) return t[1].trim();
  const L = labelOf(ctx); if (L && L !== 'Unknown label') return L;
  // BigBoppa titles usually start with the label: "Parlophone Reproduction Company Record Sleeves (10 Pack)"
  const m = ctx.match(/^\s*([A-Z0-9][\w&.'’ -]{1,40}?)\s+(?:Reproduction|Repro|Company|Record|Records|Factory|Original|Paper|Sleeves?|7|10|45|78)\b/);
  return m ? m[1].trim() : 'Unknown label';
}
const safe = s => String(s).replace(/[<>:"/\\|?*\x00-\x1f]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Unknown';

// ---------------------------------------------------------------- saving
const creditsFile = path.join(OUT, 'credits.json');
let credits = []; try { credits = JSON.parse(fs.readFileSync(creditsFile, 'utf8')); } catch {}
const have = new Set(credits.map(c => imgKey(c.image)));
let saved = 0, lastReq = 0;
async function polite() { const w = lastReq + DELAY - Date.now(); if (w > 0) await sleep(w); lastReq = Date.now(); }
let lastWhy = '';
const logFile = path.join(OUT, 'download-log.txt');
const log = t => { try { fs.appendFileSync(logFile, t + '\n'); } catch {} };
async function get(url, asText, tries = 3) {
  lastWhy = '';
  if (/^file:/i.test(url)) {                       // --local: pictures saved next to the page
    try { const f = require('url').fileURLToPath(url); const b = fs.readFileSync(f); return asText ? { html: b.toString('utf8'), url } : b; } catch (e) { lastWhy = 'not found on disk'; return null; }
  }
  for (let i = 0; i < tries; i++) {
    await polite();
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': asText ? 'text/html,*/*' : 'image/*,*/*' }, redirect: 'follow' });
      if (r.status === 429 || r.status === 503) { const ra = +r.headers.get('retry-after') || 30; console.log(`  site asked us to slow down - waiting ${ra}s`); DELAY = Math.min(DELAY * 2, 15000); await sleep(ra * 1000); continue; }
      if (!r.ok) { lastWhy = 'HTTP ' + r.status; return null; }
      const type = r.headers.get('content-type') || '';
      if (asText) { if (/html|text\/plain/i.test(type) || !type) return { html: await r.text(), url: r.url }; lastWhy = 'not a web page (' + type + ')'; return null; }
      return /^image\//i.test(type) || IMG_EXT.test(url) ? Buffer.from(await r.arrayBuffer()) : null;
    } catch (e) { lastWhy = (e.cause && (e.cause.code || e.cause.message)) || e.message; if (i === tries - 1) return null; await sleep(3000 * (i + 1)); }
  }
  return null;
}
function nameFor(dir, base, ext) {
  let n = base + ext, k = 2; while (fs.existsSync(path.join(dir, n))) n = `${base} (${k++})${ext}`; return n;
}
async function saveImage(img, page) {
  if (saved >= MAX) return;
  const full = fullSize(img.src), key = imgKey(full); if (have.has(key)) return; have.add(key);
  const fileName = decodeURIComponent(path.basename(new URL(full).pathname)).replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ');
  if (NOT_SLEEVE.test(fileName) || NOT_SLEEVE.test(img.alt || '')) { log(`    skipped picture ${full}: looks like a site graphic`); return; }
  const ctx = [page.h1, page.title, img.alt, img.cap, fileName, page.desc].filter(Boolean).join('  ·  ');
  const near = [img.cap, img.alt, fileName].filter(Boolean).join(' ');
  const fmt = formatOf(near) !== 'unsorted' ? formatOf(near) : formatOf(ctx);
  const country = (new URL(page.from || page.url).pathname.match(/^\/(UK|USA|US|Canada|Europe|Germany|France|Australia|Japan|[A-Z]{2,3})\//i) || [])[1];
  const label = safe(labelFrom([page.h1, page.title].filter(Boolean).join(' ') || ctx) + (country ? ` (${country.toUpperCase()})` : '')), year = yearOf(near) || yearOf([page.h1, page.title].join(' '));
  const ext = ((new URL(full).pathname.match(/\.(jpe?g|png|webp|gif|tiff?)$/i) || ['.jpg'])[0]).toLowerCase().replace('.jpeg', '.jpg');
  const dir = path.join(OUT, fmt), base = year ? `${label} - ${year}` : label;
  if (DRY) { console.log(`  [dry] ${fmt}/${base}${ext}   <- ${full}`); saved++; return; }
  let buf = await get(full, false);
  if (!buf && full !== img.src) buf = await get(img.src, false);      // full-size guess failed: keep the size the page shows
  if (!buf) { log(`    skipped picture ${full}: ${lastWhy || 'not an image'}`); return; }
  if (buf.length < 5000) { log(`    skipped picture ${full}: too small (${buf.length} bytes) - probably a site graphic`); return; }
  fs.mkdirSync(dir, { recursive: true });
  const file = nameFor(dir, base, ext); fs.writeFileSync(path.join(dir, file), buf);
  credits.push({ file: path.join(fmt, file), image: full, page: page.url, title: page.h1 || page.title, saved: new Date().toISOString() });
  fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 1));
  saved++; console.log(`  saved ${fmt}/${file}`);
}

// ---------------------------------------------------------------- crawl
async function runLocal() {
  const root = path.resolve(LOCAL), pages = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.html?$/i.test(e.name)) pages.push(f); } };
  if (!fs.existsSync(root)) { console.log('That folder does not exist: ' + root); return; }
  walk(root);
  console.log(`Sorting sleeve pictures from ${pages.length} saved page(s) in ${root}\n  to ${OUT}${DRY ? '   (dry run)' : ''}\n`);
  fs.mkdirSync(OUT, { recursive: true }); log(`\n==== ${new Date().toISOString()}  local ${root}`);
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8'), url = require('url').pathToFileURL(f).toString();
    const from = (html.match(/saved from url=\(\d+\)(\S+)/i) || html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i) || [])[1];
    const page = { ...readPage(html, url), url, from };
    log(`page ${f}${from ? ' (from ' + from + ')' : ''}: "${page.title}", ${page.imgs.length} pictures`);
    for (const img of page.imgs) { if (!/^file:/i.test(img.src)) continue; await saveImage(img, page); if (saved >= MAX) break; }
  }
  console.log(`\nDone: ${saved} pictures ${DRY ? 'found' : 'saved'}. Details: ${logFile}`);
}

(async () => {
  if (LOCAL) { DELAY = 0; return runLocal(); }
  console.log(`Saving BigBoppa company sleeves from ${START}\n  to ${OUT}${DRY ? '   (dry run - nothing is downloaded)' : ''}`);
  await loadRobots();
  console.log(`  waiting ${(DELAY / 1000).toFixed(1)} s between requests; robots.txt rules: ${robots.disallow.length} blocked path(s)\n`);
  fs.mkdirSync(OUT, { recursive: true }); log(`\n==== ${new Date().toISOString()}  start ${START}`);
  if (!robotsOk(START)) { console.log('The site\'s robots.txt asks automated downloaders not to visit it, so nothing was downloaded.'); return; }
  // check the site answers at all (and fall back to plain http:// if https:// doesn't)
  let first = await get(START, true), base = START;
  if (!first && /^https:/.test(START)) { const alt = START.replace(/^https:/, 'http:'); const r2 = await get(alt, true); if (r2) { first = r2; base = alt; } }
  if (!first) {
    console.log(`\nCould not open ${START}: ${lastWhy || 'no answer'}.`);
    if (/403/.test(lastWhy)) {
      console.log('The site refuses download programs (HTTP 403 "forbidden"), so this script will not fetch from it directly.');
      console.log('Instead, open the label pages you want in your web browser, save each one with Ctrl+S ("Web page, complete"),');
      console.log('all into one folder, then run:   node tools\\bigboppa-sleeves.js "<output folder>" --local "<that folder>"');
      console.log('(or drag the folder onto tools\\sort-saved-bigboppa-pages.bat). The pictures are sorted and named the same way.');
    } else console.log('Check the address opens in your web browser. If it does, send me download-log.txt from the output folder.');
    log(`could not open start page: ${lastWhy}`); return;
  }
  log(`start page OK (${first.url}), ${first.html.length} characters`);
  try { fs.writeFileSync(path.join(OUT, 'start-page.html'), first.html); } catch {}
  // the site is laid out as /UK/<label>/... and /USA/<label>/...; seed those folders and the usual index pages too
  const seeds = [base, ...['/UK/', '/USA/', '/index.htm', '/index.html', '/uk.htm', '/usa.htm', '/UK/index.htm', '/USA/index.htm', '/labels.htm', '/sitemap.htm'].map(p => new URL(p, base).toString())]
    .filter(pageOk);
  const queue = [...new Set(seeds)], seenPages = new Set(queue); let visited = 0, products = 0;
  // sitemaps list every product page, which is quicker and lighter than following every link
  for (const sm of ['/sitemap.xml', '/sitemap_index.xml', '/product-sitemap.xml', '/sitemap_products_1.xml']) {
    await polite();
    try {
      const r = await fetch(new URL(sm, START), { headers: { 'User-Agent': UA } }); if (!r.ok) continue;
      const xml = await r.text();
      for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const u = norm(m[1], START); if (!u) continue;
        if (/\.xml(\?|$)/i.test(u)) { if (!queue.includes(u)) queue.push(u); continue; }
        if (pageOk(u) && !seenPages.has(u)) { seenPages.add(u); queue.push(u); }
      }
    } catch {}
  }
  while (queue.length && visited < PAGES && saved < MAX) {
    const url = queue.shift();
    if (/\.xml(\?|$)/i.test(url)) {               // a sub-sitemap
      await polite();
      try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) for (const m of (await r.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) { const u = norm(m[1], START); if (u && (/\.xml(\?|$)/i.test(u) || pageOk(u)) && !seenPages.has(u)) { seenPages.add(u); queue.push(u); } } } catch {}
      continue;
    }
    const res = url === base ? first : await get(url, true); visited++;
    if (!res) { log(`page ${url}: ${lastWhy}`); continue; }
    const page = { ...readPage(res.html, res.url), url: res.url };
    let added = 0; for (const l of page.links) if (pageOk(l) && !seenPages.has(l)) { seenPages.add(l); queue.push(l); added++; }
    log(`page ${res.url}: "${page.title}"  ${page.links.length} links (${added} new), ${page.imgs.length} pictures`);
    if (visited === 1 && !page.links.length) console.log('  The first page has no links this script can follow - send me start-page.html from the output folder and I can adjust it.');
    if (page.isProduct) products++;
    // pictures: on product pages take them all; on list / category pages only ones linked to a sleeve-looking name
    for (const img of page.imgs) {
      if (new URL(page.url).pathname === '/' && !/sleeve|company|record|45|78|7"|10"/i.test((img.alt || '') + ' ' + img.src)) continue;   // home page: site graphics
      await saveImage(img, page);
      if (saved >= MAX) break;
    }
    if (visited % 25 === 0) console.log(`  ... ${visited} pages visited, ${products} product pages, ${saved} pictures saved, ${queue.length} pages still to visit`);
  }
  console.log(`\nDone: ${visited} pages visited, ${saved} pictures ${DRY ? 'found' : 'saved'}.${DRY ? '' : ' List of what came from where: ' + creditsFile}`);
  console.log(`Details of every page and skipped picture: ${logFile}`);
  console.log('Check the "unsorted" folder - pictures whose page did not say 7"/45 or 10"/78 go there. Run it again any time to pick up new sleeves.');
})().catch(e => { console.error('Stopped:', e.message); process.exit(1); });
