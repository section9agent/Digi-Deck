// Shared helpers. Everything hangs off window.S (classic scripts, no bundler).
window.S = window.S || {};
(function (S) {
  S.$ = (sel, el = document) => el.querySelector(sel);
  S.$$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  S.el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) { if (p.startsWith('--')) e.style.setProperty(p, x); else e.style[p] = x; }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  };
  S.svgNS = 'http://www.w3.org/2000/svg';
  S.svg = (tag, attrs = {}, ...kids) => {
    const e = document.createElementNS(S.svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  };
  S.fileUrl = p => {
    if (!p) return '';
    if (/^(https?|data|blob|file):/i.test(p)) return p;
    let q = p.replace(/\\/g, '/');
    if (!q.startsWith('/')) q = '/' + q;
    return 'file://' + encodeURI(q).replace(/#/g, '%23').replace(/\?/g, '%3F');
  };
  S.mediaUrl = p => {
    if (!p) return '';
    if (/^(https?|data|blob|file|ddmedia):/i.test(p)) return p;
    return 'ddmedia://m/' + encodeURIComponent(p.replace(/\\/g, '/'));
  };
  S.fmt = s => {
    s = Math.max(0, Math.round(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  };
  S.hash = str => { let h = 2166136261; for (const c of String(str || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  S.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  S.lerp = (a, b, t) => a + (b - a) * t;

  const imgCache = new Map();
  S.loadImage = src => {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = S.fileUrl(src);
    });
    imgCache.set(src, p);
    return p;
  };
  S.dropImageCache = () => imgCache.clear();

  S.toast = msg => {
    const t = S.$('#toast');
    if (!t) return;
    t.textContent = msg; t.classList.toggle('show', !!msg);
    clearTimeout(S._toastT);
    if (msg) S._toastT = setTimeout(() => t.classList.remove('show'), 4500);
  };

  // draw an image to fill (cover) a circle / rect region of a canvas
  S.drawCover = (ctx, img, x, y, w, h) => {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  };
  S.newCanvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };


  // ------------------------------------------------------------------ colours
  S.VINYL_COLORS = [
    { id: 'black', name: 'Black', hex: '#0d0d0d' }, { id: 'red', name: 'Red', hex: '#b3151b' }, { id: 'orange', name: 'Orange', hex: '#e0731d' },
    { id: 'yellow', name: 'Yellow', hex: '#e7c61f' }, { id: 'green', name: 'Green', hex: '#1f8a48' }, { id: 'aqua', name: 'Aqua', hex: '#1e9ea8' },
    { id: 'blue', name: 'Blue', hex: '#1d3f9c' }, { id: 'purple', name: 'Purple', hex: '#6a2c91' }, { id: 'pink', name: 'Pink', hex: '#e0629b' },
    { id: 'white', name: 'White', hex: '#ececec' }, { id: 'grey', name: 'Grey', hex: '#7b7f85' }, { id: 'clear', name: 'Clear', hex: null },
    { id: 'gold', name: 'Gold', hex: '#c9a227', metal: true }, { id: 'silver', name: 'Silver', hex: '#b9bdc6', metal: true },
    { id: 'bronze', name: 'Bronze', hex: '#a9742e', metal: true }, { id: 'copper', name: 'Copper', hex: '#b5562f', metal: true }
  ];
  S.TAPE_COLORS = [
    { id: 'black', name: 'Black', hex: '#0e0e10' }, { id: 'white', name: 'White', hex: '#e8e4da' }, { id: 'red', name: 'Red', hex: '#b32222' },
    { id: 'orange', name: 'Orange', hex: '#d96a1c' }, { id: 'yellow', name: 'Yellow', hex: '#d9b81c' }, { id: 'green', name: 'Green', hex: '#2a7a45' },
    { id: 'blue', name: 'Blue', hex: '#2250a8' }, { id: 'purple', name: 'Purple', hex: '#6b3c96' }, { id: 'pink', name: 'Pink', hex: '#d9669a' },
    { id: 'gray', name: 'Gray', hex: '#6b6f76' }, { id: 'tan', name: 'Tan', hex: '#c9a577' }, { id: 'clear', name: 'Transparent', hex: null }, { id: 'smoke', name: 'Smoke', hex: null },
    { id: 'gold', name: 'Gold', hex: '#d4aa2c', metal: true }, { id: 'silver', name: 'Silver', hex: '#c4c8d0', metal: true },
    { id: 'bronze', name: 'Bronze', hex: '#b27a32', metal: true }, { id: 'copper', name: 'Copper', hex: '#c05c34', metal: true }
  ];
  // value is a preset id or a custom '#rrggbb'
  S.colorOf = (list, value) => {
    const hit = list.find(c => c.id === value);
    if (hit) return hit;
    if (/^#[0-9a-f]{6}$/i.test(value || '')) return { id: 'custom', name: 'Custom', hex: value };
    return list[0];
  };
  S.shade = (hex, amt) => { // amt -1..1 (negative darkens)
    const n = parseInt(hex.slice(1), 16);
    const ch = v => Math.round(S.clamp(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt, 0, 255));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => ch(v).toString(16).padStart(2, '0')).join('');
  };
  S.luma = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  // ------------------------------------------------------------ release rules
  // type: album | single | maxi. Vinyl: single = 7" (max 2 songs), maxi = 12" at 45 rpm. CD/cassette: single/maxi need <= 6 tracks.
  S.CD3_MAX_SECONDS = 22 * 60;
  S.SEVEN_CAPACITY = 10 * 60;
  S.releaseInfo = (a, mode) => {
    const tr = a.tracks || [], n = tr.length, total = tr.reduce((s, t) => s + (t.duration || 0), 0);
    let type = a.release_type || (a.kind === 'single' || (n >= 1 && n <= 2) ? 'single' : 'album'); // 1-2 tracks default to a single: 7" / 3" CD / cassette single
    if (type === 'single' && n > (mode === 'vinyl' ? 2 : 6)) type = mode === 'vinyl' && n <= 6 ? 'maxi' : 'album';
    if (type === 'maxi' && n > 6) type = 'album';
    const info = { type, n, total, canSingle: n <= (mode === 'vinyl' ? 2 : 6), canMaxi: n <= 6, can3in: total <= S.CD3_MAX_SECONDS };
    if (mode === 'vinyl') {
      info.seven = type === 'single'; info.rpm = type === 'album' ? 100 / 3 : 45; info.inch = info.seven ? 7 : 12;
      if (a.disc_size === '10' || a.disc_size === '10s') { info.seven = false; info.inch = 10; }       // 10": standard (33⅓ / 45) or shellac (78)
      if (a.disc_size === '10s') { info.shellac = true; info.rpm = 78; }
      if (a.shaped) { info.shaped = true; info.seven = false; info.shellac = false; info.inch = 12; if (info.rpm > 50) info.rpm = 45;
        const sp = S.shapeFit ? S.shapeFit(a).rpm : 0; if (sp) info.rpm = sp; }                      // shaped records can play at any speed
      info.paper = info.seven || !!info.shellac;                                                       // paper sleeve (7" and 78s) instead of a jacket
    }
    if (mode === 'md') { info.disc = a.md_disc || (a.is_generic || !a.front ? 'standard' : 'retail'); info.case = a.md_case || (info.disc === 'standard' ? 'small' : 'retail'); }
    if (mode === 'cd') {
      const ds = a.disc_size || (type === 'single' && S.sideCount(a, 'cd') < 2 ? '3' : '5');
      info.small = ds === '3' && info.can3in && !(a.sides > 1);
    }
    return info;
  };
  S.describe = (a, mode) => {
    const i = S.releaseInfo(a, mode), nm = { single: 'Single', maxi: 'Maxi single', album: '' }[i.type];
    if (mode === 'vinyl' && i.shaped) return `${a.shape_size && S.shapeFit && S.shapeFit(a).fit === 'play' ? a.shape_size + '" ' : ''}shaped picture disc · ${i.rpm === 45 ? '45' : i.rpm === 78 ? '78' : '33⅓'} rpm`;
    if (mode === 'vinyl' && i.shellac) return '10" shellac · 78 rpm';
    if (mode === 'vinyl' && i.inch === 10) return `10" ${i.type === 'album' ? 'record' : nm.toLowerCase()} · ${i.rpm === 45 ? '45' : '33⅓'} rpm`;
    if (mode === 'vinyl') return i.seven ? '7" · 45 rpm' : i.type === 'maxi' ? '12" maxi single · 45 rpm' : '12" LP · 33⅓ rpm';
    if (mode === 'dat') return `DAT · ${S.colorOf(S.DAT_COLORS, a.color || 'black').name.toLowerCase()} tape`;
    if (mode === 'md') return `MiniDisc · ${{ retail: 'retail disc', led: 'printed disc', standard: 'recordable disc' }[i.disc]} · ${i.case === 'small' ? 'slim case' : 'retail case'}`;
    if (mode === 'cd') return `${i.small ? '3"' : '5"'} disc${nm ? ' · CD ' + nm.toLowerCase() : ''}`;
    if (mode === 'reel') return `7" reel to reel · ${S.reelType(a) === 'retail' ? 'retail reel, 1,200 ft' : 'generic reel, 1,800 ft'} · 7½ ips`;
    const tape = mode === 'micro' ? 'Microcassette' : 'Cassette';
    return nm ? `${tape} ${nm.toLowerCase()}` : tape;
  };
  // 7" singles with two songs: one song per side. CD has one side.
  S.normalizeSides = (a, mode) => {
    const info = S.releaseInfo(a, mode);
    if (S.isDisc(mode)) a.tracks.forEach(t => { if (!/^[A-H]$/.test(t.side || '')) t.side = 'A'; });
    else if (info.type === 'single' && a.tracks.length <= 2) a.tracks.forEach((t, i) => { t.side = i === 0 ? 'A' : 'B'; });
    return a;
  };

  // vinyl sides: A-H, two per record. album.sides is the stored count (0 = just what the tracks use).
  S.SIDE_LETTERS = 'ABCDEFGH'.split('');
  S.sideCount = (a, mode) => {
    if (S.isDisc(mode)) return S.unitLetters(a, mode).length;
    const used = Math.max(0, ...(a.tracks || []).map(t => S.SIDE_LETTERS.indexOf((t.side || 'A').toUpperCase())));
    return Math.min(8, Math.max(2, a.sides | 0, Math.ceil((used + 1) / 2) * 2));
  };
  S.vinylSides = a => S.SIDE_LETTERS.slice(0, S.sideCount(a));
  // which physical record / tape / disc a side letter lives on (CD: every letter is its own disc)
  S.discOf = (side, mode) => { const i = Math.max(0, S.SIDE_LETTERS.indexOf(side)); return S.isDisc(mode || S.app?.mode) ? i : Math.floor(i / 2); };
  S.partnerSide = side => S.SIDE_LETTERS[S.SIDE_LETTERS.indexOf(side) ^ 1];            // the other side of the same record / tape
  // sides (vinyl, cassette) or discs (CD) the release has: what the user chose, or what the tracks use
  S.unitLetters = (a, mode) => {
    const used = Math.max(0, ...(a.tracks || []).map(t => S.SIDE_LETTERS.indexOf((t.side || 'A').toUpperCase())));
    const n = S.isDisc(mode) ? Math.min(8, Math.max(1, a.sides | 0, used + 1)) : Math.min(8, Math.max(2, a.sides | 0, Math.ceil((used + 1) / 2) * 2));
    return S.SIDE_LETTERS.slice(0, n);
  };
  // DAT tapes come in two shell colours
  S.DAT_COLORS = [{ id: 'black', name: 'Black', hex: '#18191b' }, { id: 'blue', name: 'Deep blue', hex: '#14246a' }];
  S.isDisc = m => m === 'cd' || m === 'md' || m === 'dat';
  S.unitNoun = m => m === 'dat' ? 'tape' : 'disc';                                                          // what one letter is called                                                                    // one letter per disc, no sides
  S.isTape = m => m === 'cassette' || m === 'micro' || m === 'reel';                                         // the two-sided tape formats (flip + swap tape)
  S.MAX_SEC = { dat: 120 * 60, md: 80 * 60, cd: 80 * 60, cassette: 45 * 60, micro: 30 * 60, reel: 48 * 60 };      // microcassette: MC-60 = 30 min a side                                        // vinyl: 25 min a side unless the album says otherwise
  // a side's default length: 12" 25 min; 10" 15 min at 33⅓, 10 at 45; a 10" shellac 78 about 4 min
  S.vinylSideMin = a => { if (!a) return 25; const ds = a.disc_size;
    if (a.shaped && S.shapeFit && S.shapeFit(a).fit === 'play') { const d = parseFloat(a.shape_size) || 7; return S.shapeFit(a).rpm === 78 ? (d <= 8 ? 3 : d <= 10.5 ? 4 : 5) : d <= 8 ? 6 : d <= 10.5 ? 12 : 25; } if (ds === '10s' && !a.shaped) return 4; if (ds === '10' && !a.shaped) return S.releaseInfo(a, 'vinyl').rpm === 45 ? 10 : 15; return 25; };
  S.sideLimit = (a, mode) => (mode === 'vinyl' ? ((a && a.side_minutes) || S.vinylSideMin(a)) * 60 : mode === 'reel' ? ((a && a.side_minutes) || 48) * 60 : S.MAX_SEC[mode] || 0);
  // reel to reel: which reel the album is on - the user's choice, else a retail reel for albums with information and the generic 7" reel for the rest
  S.reelType = a => (a && a.reel_type) || (a && !a.is_generic ? 'retail' : 'generic');
  S.sidesOf = tracks => [...new Set(tracks.map(t => t.side || 'A'))].sort();
})(window.S);

// brushed-aluminium texture for the CSS-drawn players (turntable, CD player): mid-grey streaks used with mix-blend-mode:overlay,
// so 50 % grey leaves the colour alone and the streaks lighten / darken it like brushed metal
(function () {
  try {
    const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < H; y += 1) { const v = rnd(); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.22})` : `rgba(0,0,0,${(0.5 - v) * 0.22})`; x.fillRect(0, y, W, 1); }
    for (let i = 0; i < 1400; i++) { const l = rnd() > 0.5; x.fillStyle = l ? `rgba(255,255,255,${0.06 + rnd() * 0.14})` : `rgba(0,0,0,${0.04 + rnd() * 0.1})`; const X = rnd() * W, Y = Math.floor(rnd() * H), L = 40 + rnd() * 380; x.fillRect(X, Y, L, 1); if (X + L > W) x.fillRect(X - W, Y, L, 1); }
    document.documentElement.style.setProperty('--brush', `url(${c.toDataURL('image/png')})`);
  } catch (e) {}
})();
