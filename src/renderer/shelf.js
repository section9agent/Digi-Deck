// Library: a record-shelf view (front covers facing out) backed by the current mode's own database.
(function (S) {
  const $ = S.$, el = S.el;
  // Real-world sizes drive the shelf (PX px per inch). Vinyl jackets face front, 12" and 7" on their own shelves; CD cases
  // stand spine-out (5.5 x 4.875 in case, 3/8 in spine; 3" case 3 13/16 x 3 3/8), 3" CDs on their own shelf.
  const PX = { vinylFront: 13, spine: 36 };
  const KINDS = {
    lp: { label: '12″ records', w: 12 * PX.vinylFront }, shp: { label: 'Shaped records', w: 10 * PX.vinylFront }, ten: { label: '10″ records', w: 10 * PX.vinylFront }, sev: { label: '7″ records', w: 7 * PX.vinylFront },
    cd5: { label: 'CDs', spineW: 3 / 8, spineH: 4.875 }, cd3: { label: '3″ CDs', spineW: 3 / 8, spineH: 3.375 },
    cas: { label: 'Cassettes', spineW: 5 / 8, spineH: 4.25 }, cas1: { label: 'Cassette singles', spineW: 1 / 2, spineH: 4 },
    mc: { label: 'Microcassettes', spineW: 1 / 2, spineH: 2 + 3 / 16, sc: 1.5 },
    mdr: { label: 'MiniDiscs - retail cases', spineW: 5 / 8, spineH: 4 + 5 / 16 },                 // 3 1/3 x 4 5/16 x 5/8 in
    mds: { label: 'MiniDiscs - slim cases', spineW: 5 / 16, spineH: 3 + 1 / 8, sc: 1.25 },           // 2 13/16 x 3 1/8 x 5/16 in
    dat: { label: 'DAT tapes', spineW: 0.44, spineH: 3.13, sc: 1.25 },                              // case about 60 x 80 x 14 mm (tape 73 x 54 x 10.5 mm), stood spine-out
    rl: { label: 'Reels', spineW: 0.85, spineH: 7.5, sc: 0.8 }                     // retail box 7.25-7.75 in square, 5/8 - 1 in deep: stood spine-out       // case 1 1/2 x 2 3/16 x 1/2 in; drawn 1.5x so the little spines stay readable
  };
  const PXI = k => PX.spine * (KINDS[k].sc || 1);
  const infoOf = (a, mode) => {
    const n = a.track_count || 1, d = (a.total_sec || 0) / n;
    return S.releaseInfo({ release_type: a.release_type, kind: a.kind, disc_size: a.disc_size, shaped: a.shaped, sides: a.sides, md_disc: a.md_disc, md_case: a.md_case, is_generic: a.is_generic, front: a.front, tracks: Array.from({ length: n }, () => ({ duration: d })) }, mode);
  };
  const kindOf = (a, mode) => { const i = infoOf(a, mode); return mode === 'vinyl' ? (i.shaped ? 'shp' : i.seven ? 'sev' : i.inch === 10 ? 'ten' : 'lp') : mode === 'cd' ? (i.small ? 'cd3' : 'cd5') : mode === 'micro' ? 'mc' : mode === 'reel' ? 'rl' : mode === 'md' ? (i.case === 'small' ? 'mds' : 'mdr') : mode === 'dat' ? 'dat' : (i.type === 'single' ? 'cas1' : 'cas'); };
  // ---- wrap-around artwork -------------------------------------------------------------------------------------
  // CD "back" = tray card: [spine | back panel | spine]; cassette "J-card" = [back flap | spine | cover]. Returns the pixel rectangles
  // ({x,w} of the full-height strips) or null when the picture is an ordinary single-panel image.
  // the J-card of a tape: its own art, or (microcassette, no info) the generic J-card layout carrying the playlist name
  const mdTray = a => S.app.mode === 'md' && infoOf(a, 'md').case !== 'small';          // MiniDisc retail case: tray card like a CD
  const wrapOf = (a, small) => S.app.mode === 'cd' || mdTray(a) ? (a.back ? loadImg(a.back) : Promise.resolve(null)) : a.jcard ? loadImg(a.jcard).then(im => im && a.jcard_adj ? S.applyAdj(im, a.jcard_adj) : im).then(im => im && S.app.mode === 'cassette' && a.is_generic ? genericText(im, a, small) : im)
    : S.app.mode === 'micro' ? Promise.resolve(S.microJcard(a)) : S.app.mode === 'dat' ? S.datJcard(a) : Promise.resolve(null);
  // a generic cassette J-card has no album info of its own: write the artist and title on its spine and cover
  function genericText(im, a, small) {
    const g = jCard(im, small, false); if (!g) return im;
    const c = S.newCanvas(g.W, g.H), x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const artist = (S.displayArtist ? S.displayArtist(a) : a.artist) || '', title = a.title || '';
    const font = sz => `${Math.round(sz)}px Desyrel, "Segoe Print", "Comic Sans MS", cursive`;
    const fit = (txt, maxW, sz) => { x.font = font(sz); const w = x.measureText(txt).width; return w > maxW ? sz * maxW / w : sz; };
    const ink = (txt, px, py, sz, rot) => {
      x.save(); x.translate(px, py); if (rot) x.rotate(Math.PI / 2); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(sz);
      x.lineJoin = 'round'; x.lineWidth = Math.max(2, sz * 0.12); x.strokeStyle = 'rgba(255,255,255,.85)'; x.strokeText(txt, 0, 0); x.fillStyle = '#17171a'; x.fillText(txt, 0, 0); x.restore();
    };
    const sp = g.spine, sx = sp.x + sp.w / 2, maxL = g.H * 0.86;                    // spine: two lines of text running top to bottom
    if (title) ink(title, sx - sp.w * 0.17, g.H / 2, Math.min(sp.w * 0.34, fit(title, maxL, sp.w * 0.34)), true);
    if (artist) ink(artist, sx + sp.w * 0.2, g.H / 2, Math.min(sp.w * 0.28, fit(artist, maxL, sp.w * 0.28)), true);
    const cv = g.cover, cx = cv.x + cv.w / 2, maxW = cv.w * 0.84;                      // cover: artist over title, near the top
    if (artist) ink(artist, cx, g.H * 0.1, fit(artist, maxW, cv.w * 0.11), false);
    if (title) ink(title, cx, g.H * 0.1 + cv.w * 0.13, fit(title, maxW, cv.w * 0.15), false);
    return c;
  }
  const loadImg = src => new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = S.fileUrl(src); });
  function trayCard(im) {
    const md = S.app.mode === 'md', W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; if (W / H < (md ? 0.95 : 1.2)) return null;
    let l = Math.round(W * (md ? 0.0987 : 0.0425)), r = l;                 // MiniDisc tray layout: each spine ~9.9% of the width                          // default: each spine is ~4.25% of the width (the tray layout reference)
    try {                                                           // supplied art separates the spines with plain white fold lines: find them
      const sw = Math.min(W, 600), c = S.newCanvas(sw, 40), x = c.getContext('2d'); x.drawImage(im, 0, 0, sw, 40);
      const d = x.getImageData(0, 0, sw, 40).data, white = Array.from({ length: sw }, (_, i) => { for (let y = 0; y < 40; y++) { const o = (y * sw + i) * 4; if (d[o] < 246 || d[o + 1] < 246 || d[o + 2] < 246) return false; } return true; });
      const lim = Math.round(sw * 0.12);
      let a = -1, b = -1; for (let i = 1; i < lim; i++) if (white[i]) a = i;                       // last white column in the left strip
      for (let i = sw - 2; i > sw - lim; i--) if (white[i]) b = i;                                 // first-from-right in the right strip
      if (a > 0) { while (a < lim && white[a + 1]) a++; l = Math.round((a + 1) * W / sw); }
      if (b > 0) { while (b > sw - lim && white[b - 1]) b--; r = Math.round((sw - b) * W / sw); }
    } catch (e) { /* tainted canvas: keep the defaults */ }
    return { W, H, left: { x: 0, w: l }, panel: { x: l, w: W - l - r }, right: { x: W - r, w: r }, spine: { x: W - r, w: r } };
  }
  // the jewel case seen from the front: the supplied case picture, the cover sized into its window, then the lid's highlights over the top
  const caseImgs = {};
  const getCaseImg = n => caseImgs[n] || (caseImgs[n] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '../../assets/cd/' + n; }));
  async function cdCase(src, a) {
    const [base, over] = await Promise.all([getCaseImg('case-base.png'), getCaseImg('case-overlay.png')]);
    if (!base) return null;
    const art = src ? await loadImg(src) : null, c = S.newCanvas(base.naturalWidth, base.naturalHeight), x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    const R = { x: 70, y: 12, w: 566, h: 555 }, im = art || S.generic.cover(a.title, a.artist, 600), iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(R.w / iw, R.h / ih);
    x.save(); x.beginPath(); x.rect(R.x, R.y, R.w, R.h); x.clip(); x.drawImage(im, R.x + (R.w - iw * k) / 2, R.y + (R.h - ih * k) / 2, iw * k, ih * k); x.restore();
    if (over) x.drawImage(over, -1, 0);
    return c;
  }
  S.cdCaseArt = cdCase;
  S.mdCaseArt = a => mdCase(a);
  // the cover panel of a tape's J-card (or null when there is no J-card art)
  S.tapeJcardParts = async (a, small) => { const im = await wrapOf(a, small), g = im && jCard(im, small, S.app.mode === 'micro'); return g ? { cover: crop(im, g.cover, g.H), spine: crop(im, g.spine, g.H), flap: g.flap.w > 4 ? crop(im, g.flap, g.H) : null, flapFrac: g.flap.w / g.cover.w } : null; };
  S.tapeCoverArt = async (a, small) => { const im = await wrapOf(a, small), g = im && jCard(im, small, S.app.mode === 'micro'); return g ? crop(im, g.cover, g.H) : null; };
  // MiniDisc retail case seen from the front: the cover in the case's window (assets/md/case-retail.png has the window cut out)
  async function mdCase(a) {
    const caseIm = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '../../assets/md/case-retail.png'; }), cov = a.front ? await loadImg(a.front) : null;
    if (!caseIm) return null;
    const W = caseIm.naturalWidth, H = caseIm.naturalHeight, c = S.newCanvas(W, H), x = c.getContext('2d');
    const r = [0.1454 * W, 0.0343 * H, (0.9447 - 0.1454) * W, (0.956 - 0.0343) * H];
    S.drawCover(x, cov || S.generic.cover(a.title, a.artist, 800), r[0], r[1], r[2], r[3]);
    x.drawImage(caseIm, 0, 0); return c;
  }
  function jCard(im, small, micro) {
    const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; if (W / H < 0.9) return null;
    // proportions measured on a real J-card scan; microcassette: from the supplied generic J-card (flap 91 | spine 104 | cover 407 of 605 x 596)
    const md = S.app.mode === 'md';                // MiniDisc slim case J-card (layout reference): flap 123 | spine 62 | cover 790 of 975 x 845
    if (S.app.mode === 'dat') {                    // DAT case J-card (layout reference): flap 200 | spine 121 | cover 638 of 959 x 860 - a portrait cover
      const cw = Math.round(H * 638 / 860), sw = Math.round(H * 121 / 860); if (cw + sw >= W) return null;
      return { W, H, flap: { x: 0, w: W - cw - sw }, spine: { x: W - cw - sw, w: sw }, cover: { x: W - cw, w: cw } };
    }
    const cw = Math.round(H * (md ? 790 / 845 : micro ? 407 / 596 : small ? 2.5625 / 4 : 2.75 / 4.25)), sw = Math.round(H * (md ? 62 / 845 : micro ? 104 / 596 : small ? 0.125 : 0.1326));     // measured on a real J-card scan
    if (cw + sw >= W) return null;
    return { W, H, flap: { x: 0, w: W - cw - sw }, spine: { x: W - cw - sw, w: sw }, cover: { x: W - cw, w: cw } };
  }
  const crop = (im, r, H, targetW) => {            // a strip of the picture as a canvas of the same shape
    const c = S.newCanvas(Math.round(targetW || r.w), Math.round(targetW ? targetW * H / r.w : H)); c.getContext('2d').drawImage(im, r.x, 0, r.w, H, 0, 0, c.width, c.height); return c;
  };
  const hash = str => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  const visibleIds = () => shelf.items.filter(a => !shelf.q || (a.artist + ' ' + a.title).toLowerCase().includes(shelf.q)).map(a => a.id);

  const shelf = S.shelf = {
    _pvTok: 0, items: [], q: '', sort: 'artist', selecting: false, sel: new Set(),
    async open() {
      const root = $('#shelf');
      root.hidden = false;
      shelf.root = root;
      const mode = S.app.mode;
      const search = el('input', { placeholder: 'Search artist or title…', oninput: e => { shelf.q = e.target.value.toLowerCase(); shelf.render(); } });
      const sort = el('select', { onchange: e => { shelf.sort = e.target.value; shelf.render(); } },
        el('option', { value: 'artist' }, 'Sort: artist'), el('option', { value: 'title' }, 'Sort: title'),
        el('option', { value: 'recent' }, 'Sort: recently played'), el('option', { value: 'added' }, 'Sort: newest first'));
      sort.value = shelf.sort; search.value = shelf.q;
      shelf.count = el('span', { class: 'note' });
      shelf.selecting = false; shelf.sel = new Set();
      shelf.btnSel = el('button', { onclick: () => shelf.toggleSelect() }, 'Select');
      shelf.btnAll = el('button', { hidden: true, onclick: () => { visibleIds().forEach(id => shelf.sel.add(id)); shelf.render(); } }, 'Select all');
      shelf.btnDel = el('button', { class: 'danger', hidden: true, onclick: () => shelf.removeSelected() }, 'Remove selected');
      shelf.btnScan = el('button', { title: 'Scan your media library folder and add everything', onclick: () => S.libScan.start(false) }, 'Scan library folder');
      shelf.btnWipe = el('button', { class: 'danger', onclick: () => shelf.removeAll() }, 'Clear shelf');
      shelf.body = el('div', { class: 'shelf-body', onscroll: () => shelf.unpop() });
      root.replaceChildren(el('div', { class: 'shelf-top' },
        el('h2', {}, `${mode==="micro"?"Microcassette":mode==="reel"?"Reel to reel":mode==="md"?"MiniDisc":mode==="dat"?"DAT":mode[0].toUpperCase() + mode.slice(1)} shelf`), shelf.count, el('div', { class: 'spacer' }), search, sort, shelf.btnScan, shelf.btnSel, shelf.btnAll, shelf.btnDel, shelf.btnWipe,
        el('button', { onclick: shelf.close }, 'Close')), shelf.body);
      shelf._esc = e => { if (e.key === 'Escape' && !$('#modal').hidden === false) shelf.close(); };
      window.addEventListener('keydown', shelf._esc);
      shelf._rs = () => shelf.render(); window.addEventListener('resize', shelf._rs);
      try { shelf.items = await window.api.libraryList(mode); } catch (e) { S.toast(e.message); shelf.items = []; }
      shelf.render();
    },
    async reload() { try { shelf.items = await window.api.libraryList(S.app.mode); } catch {} shelf.render(); },
    toggleSelect() {
      shelf.selecting = !shelf.selecting; shelf.sel.clear(); shelf.syncBar(); shelf.render();
    },
    syncBar() {
      shelf.btnSel.textContent = shelf.selecting ? 'Done' : 'Select';
      shelf.btnAll.hidden = !shelf.selecting; shelf.btnDel.hidden = !shelf.selecting;
      shelf.btnDel.textContent = `Remove selected (${shelf.sel.size})`; shelf.btnDel.disabled = !shelf.sel.size;
    },
    async removeIds(ids) {
      for (const id of ids) { try { await window.api.libraryDelete(S.app.mode, id); } catch (e) { S.toast(e.message); } }
      const gone = new Set(ids); shelf.items = shelf.items.filter(x => !gone.has(x.id)); ids.forEach(id => shelf.sel.delete(id));
      if (S.app.album && gone.has(S.app.album.id)) S.app.album.id = null;
      shelf.syncBar(); shelf.render();
    },
    async removeSelected() {
      const ids = [...shelf.sel]; if (!ids.length) return;
      if (!confirm(`Remove ${ids.length} album${ids.length > 1 ? 's' : ''} from the ${S.app.mode} library?\n(Your music files are not touched.)`)) return;
      await shelf.removeIds(ids);
    },
    async removeAll() {
      if (!shelf.items.length) return;
      if (!confirm(`Remove ALL ${shelf.items.length} albums from the ${S.app.mode} library?\n(Your music files are not touched.)`)) return;
      await shelf.removeIds(shelf.items.map(a => a.id));
    },
    close() {
      shelf.unpop(); $('#shelf').hidden = true;
      window.removeEventListener('keydown', shelf._esc); window.removeEventListener('resize', shelf._rs);
    },
    render() {
      if (!shelf.body || $('#shelf').hidden) return;
      const mode = S.app.mode;
      let list = shelf.items.filter(a => !shelf.q || (a.artist + ' ' + a.title).toLowerCase().includes(shelf.q));
      const by = {
        artist: (a, b) => (a.artist || '').localeCompare(b.artist || '') || (a.title || '').localeCompare(b.title || ''),
        title: (a, b) => (a.title || '').localeCompare(b.title || ''),
        recent: (a, b) => (b.last_played || 0) - (a.last_played || 0),
        added: (a, b) => b.id - a.id
      };
      list = list.sort(by[shelf.sort]);
      shelf.count.textContent = `${list.length} of ${shelf.items.length}`;
      shelf.body.replaceChildren();
      if (!list.length) { shelf.body.append(el('div', { class: 'shelf-empty' }, shelf.items.length ? 'Nothing matches your search.' : `Your ${mode} shelf is empty.\nOpen an album and it will be filed here automatically.`)); return; }
      const order = mode === 'vinyl' ? ['lp', 'ten', 'sev', 'shp'] : mode === 'cd' ? ['cd5', 'cd3'] : mode === 'micro' ? ['mc'] : mode === 'reel' ? ['rl'] : mode === 'md' ? ['mdr', 'mds'] : mode === 'dat' ? ['dat'] : ['cas', 'cas1'];
      const groups = Object.fromEntries(order.map(k => [k, []]));
      list.forEach(a => groups[kindOf(a, mode)].push(a));
      order.forEach((k, oi) => {
        if (oi > 0 && !groups[k].length) return;                // the extra shelves only show once something is on them
        shelf.body.append(el('div', { class: 'shelf-label' }, KINDS[k].label, el('small', {}, `${groups[k].length}`)));
        if (!groups[k].length) { shelf.body.append(el('div', { class: 'shelf-none' }, 'Nothing on this shelf yet')); return; }
        const spine = mode !== 'vinyl', iw = spine ? KINDS[k].spineW * PXI(k) : KINDS[k].w, gap = spine ? 3 : 18;
        const perRow = Math.max(1, Math.floor((shelf.body.clientWidth - 90) / (iw + gap)));
        for (let i = 0; i < groups[k].length; i += perRow) {
          const row = el('div', { class: 'shelf-row ' + (spine ? 'spines' : 'fronts') });
          groups[k].slice(i, i + perRow).forEach(a => row.append(spine ? shelf.spine(a, k) : shelf.item(a, mode, k)));
          shelf.body.append(row);
        }
      });
    },
    click(a) {
      if (shelf.selecting) { shelf.sel.has(a.id) ? shelf.sel.delete(a.id) : shelf.sel.add(a.id); shelf.syncBar(); return shelf.render(); }
      shelf.preview(a);
    },
    // a front-facing jacket, always the same footprint per shelf (art is cropped to the jacket shape)
    item(a, mode, k) {
      const w = KINDS[k].w, h = w;
      const cov = el('div', { class: 'cov' });
      // shaped records: a clear PVC sleeve the size of the record (the record shows through it, or the cover art sits behind it)
      if (k === 'shp' && a.pic_a) {
        const box = el('div', { class: 'item ' + mode + ' pvc' + (shelf.sel.has(a.id) ? ' sel' : ''), style: { '--w': w + 'px', '--h': h + 'px' }, title: `${a.artist} – ${a.title}`, onclick: () => shelf.click(a) },
          cov, el('div', { class: 'tag' }, el('b', {}, a.title || 'Untitled'), el('span', {}, a.artist || '')));
        S.shapedSleeve(a, 360).then(c => { c.className = 'pvc-cv'; cov.replaceChildren(c); });
        S.shapedInches(a).then(inch => { if (inch) { const px = S.clamp(inch, 3, 14) * PX.vinylFront; box.style.setProperty('--w', px + 'px'); box.style.setProperty('--h', px + 'px'); } });
        return box;
      }
      if (a.front) { const im = el('img', { src: S.fileUrl(a.front), loading: 'lazy', onerror: e => e.target.replaceWith(S.generic.cover(a.title, a.artist, 300)) }); cov.append(im);
        if (mode === 'vinyl') S.holeCover(a, 'front', 400).then(c => { if (c && im.isConnected) im.replaceWith(c); }); }
      else cov.append(S.generic.cover(a.title, a.artist, 300));
      return el('div', { class: 'item ' + mode + (shelf.sel.has(a.id) ? ' sel' : ''), style: { '--w': w + 'px', '--h': h + 'px' }, title: `${a.artist} – ${a.title}`, onclick: () => shelf.click(a) },
        cov, el('div', { class: 'tag' }, el('b', {}, a.title || 'Untitled'), el('span', {}, a.artist || (a.kind === 'set' ? 'Playlist' : ''))));
    },
    // a case spine (CD 3/8 in, cassette 5/8 in wide): drawn at high resolution, enlarged on hover so the text is readable
    spine(a, k) {
      const hpx = KINDS[k].spineH * PXI(k), wpx = KINDS[k].spineW * PXI(k), Q = 5;
      const cv = S.newCanvas(Math.round(wpx * Q), Math.round(hpx * Q)); cv.style.width = wpx + 'px'; cv.style.height = hpx + 'px';
      const paint = cols => { cv._cols = cols; shelf.paintSpine(cv, a, cols); };
      const fallback = () => { const h = hash((a.artist || '') + (a.title || '')) % 360; paint([`hsl(${h} 40% 26%)`, `hsl(${h} 40% 15%)`]); };
      const wrapSrc = mode_ => mode_ === 'cd' || k === 'mdr' ? a.back : a.jcard;
      const wrapped = wrapSrc(S.app.mode);
      if (S.app.mode === 'reel') {                                  // the box spine: its own image, or a generated one carrying the artist and title
        (a.spine ? loadImg(a.spine) : Promise.resolve(null)).then(im => {
          const src = im || S.generic.spine(a), W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
          cv._wrap = { im: src, r: { x: 0, w: W }, H };
          cv.getContext('2d').drawImage(src, 0, 0, W, H, 0, 0, cv.width, cv.height);
        });
      } else if (wrapped || S.app.mode === 'micro' || S.app.mode === 'dat') {
        wrapOf(a, k === 'cas1').then(im => {
          const g = im && (S.app.mode === 'cd' || k === 'mdr' ? trayCard(im) : jCard(im, k === 'cas1', S.app.mode === 'micro'));
          if (!g) return plain();
          cv._wrap = { im, r: g.spine, H: g.H };
          cv.getContext('2d').drawImage(im, g.spine.x, 0, g.spine.w, g.H, 0, 0, cv.width, cv.height);
        });
      } else plain();
      function plain() {
       if (a.front) {
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => {
          try {
            const t = S.newCanvas(8, 8), x = t.getContext('2d'); x.drawImage(im, 0, 0, 8, 8);
            const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
            const n = d.length / 4; r /= n; g /= n; b /= n;
            const mid = (Math.max(r, g, b) + Math.min(r, g, b)) / 2, k2 = mid > 150 ? 150 / mid : mid < 40 ? 1.8 : 1;     // dark/mid enough for white text, never black
            const c = v => Math.round(Math.min(255, v * k2));
            paint([`rgb(${c(r)},${c(g)},${c(b)})`, `rgb(${c(r) >> 1},${c(g) >> 1},${c(b) >> 1})`]);
          } catch (e) { fallback(); }
        };
        im.onerror = fallback; im.src = S.fileUrl(a.front);
       } else fallback();
      }
      return el('div', { class: 'item cd-spine' + (shelf.sel.has(a.id) ? ' sel' : ''), style: { width: wpx + 'px', height: hpx + 'px' }, title: `${a.artist} – ${a.title}`, onclick: () => shelf.click(a),
        onmouseenter: e => shelf.pop(a, k, e.currentTarget, cv), onmouseleave: () => shelf.unpop() }, cv);
    },
    // hovering a spine pulls out a larger, easy-to-read copy of it (redrawn at the bigger size so the text stays crisp)
    pop(a, k, node, cv) {
      shelf.unpop(); if (!cv._cols && !cv._wrap) return;
      const r = node.getBoundingClientRect(), Q = 4;
      let pw, ph;
      if (cv._wrap) { const sc = Math.max(1.25, Math.min(2.6, (innerHeight - 120) / r.height)); pw = Math.round(r.width * sc); ph = Math.round(r.height * sc); }      // art keeps its shape
      else { pw = Math.round(r.width * 3.3); ph = Math.round(Math.min(r.height * 1.6, Math.max(r.height * 1.12, innerHeight - 120))); }
      const c = S.newCanvas(pw * Q, ph * Q); c.style.width = pw + 'px'; c.style.height = ph + 'px'; c.className = 'spine-pop';
      if (cv._wrap) c.getContext('2d').drawImage(cv._wrap.im, cv._wrap.r.x, 0, cv._wrap.r.w, cv._wrap.H, 0, 0, c.width, c.height); else shelf.paintSpine(c, a, cv._cols);
      const top = Math.max(66, Math.min(r.bottom - ph, innerHeight - ph - 8));          // grows upward from the spine; the top shelf, which has no room above, shifts down instead of zooming less
      c.style.left = Math.max(4, Math.min(innerWidth - pw - 4, r.left + r.width / 2 - pw / 2)) + 'px'; c.style.top = top + 'px';
      shelf.root.append(c); shelf._pop = c;
    },
    unpop() { if (shelf._pop) { shelf._pop.remove(); shelf._pop = null; } },
    paintSpine(cv, a, [c1, c2]) {
      const x = cv.getContext('2d'), W = cv.width, H = cv.height;
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, c2); g.addColorStop(.18, c1); g.addColorStop(.82, c1); g.addColorStop(1, c2);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(0, 0, 3, H); x.fillRect(W - 3, 0, 3, H);     // plastic edges
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(3, 0, 2, H); x.fillRect(W - 5, 0, 2, H);
      if (S.app.mode !== 'md') { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(W * .22, 10, W * .56, Math.round(W * .34)); }     // top label strip
      x.fillStyle = '#222'; x.font = `700 ${Math.round(W * .26)}px Helvetica, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; if (S.app.mode === 'md') { const lw = W * .56, top = 10; S.mdLogo('black').then(im => { if (im) { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(W * .2, top - 2, W * .6, lw * im.naturalHeight / im.naturalWidth + 4); x.drawImage(im, W * .22, top, lw, lw * im.naturalHeight / im.naturalWidth); } }); }
      else x.fillText(S.app.mode === 'cd' ? 'CD' : 'MC', W / 2, 10 + W * .17);
      const top = 10 + W * .34 + 16, room = H - top - 14, artist = (a.artist || '').toUpperCase(), title = a.title || 'Untitled';
      x.save(); x.translate(W / 2, top); x.rotate(Math.PI / 2); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
      let size = Math.round(W * .4);
      const fit = () => { x.font = `700 ${size}px Helvetica, Arial, sans-serif`; const wa = x.measureText(artist + '  ').width; x.font = `400 ${size}px Helvetica, Arial, sans-serif`; return wa + x.measureText(title).width; };
      while (fit() > room && size > 14) size -= 1;
      x.font = `700 ${size}px Helvetica, Arial, sans-serif`; const wa = x.measureText(artist + '  ').width; x.fillText(artist, 0, 0);
      x.font = `400 ${size}px Helvetica, Arial, sans-serif`;
      let t = title; while (wa + x.measureText(t).width > room && t.length > 2) t = t.slice(0, -2);
      if (t !== title) t = t.trimEnd() + '…';
      x.fillText(t, wa, 0); x.restore();
    },
    // a bigger look at an album with Play / Edit / Remove
    preview(a) {
      const mode = S.app.mode, kind = kindOf(a, mode), n = a.track_count || 1;
      const close = () => { ov.remove(); window.removeEventListener('keydown', onKey, true); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      let alt = false;                       // CD / vinyl: showing the back;  cassette: showing the whole J-card instead of just the cover
      const art = el('div', { class: 'pv-art ' + mode + (kind === 'cd3' || kind === 'cas1' ? ' small' : '') + (kind === 'sev' ? ' seven' : kind === 'ten' ? ' ten' : '') });
      const place = (node, cls = '') => { art.className = 'pv-art ' + mode + cls + (kind === 'cd3' || kind === 'cas1' ? ' small' : '') + (kind === 'sev' ? ' seven' : kind === 'ten' ? ' ten' : ''); art.replaceChildren(node); };
      const plainImg = src => src ? el('img', { class: 'pv-img', src: S.fileUrl(src), onerror: e => e.target.replaceWith(S.generic.cover(a.title, a.artist, 600)) }) : S.generic.cover(a.title, a.artist, 600);
      const draw = async () => {
        const tok = ++shelf._pvTok; let node, cls = '';
        if (kind === 'shp' && a.pic_a && !alt) { node = await S.shapedSleeve(a, 900); node.classList.add('pv-img'); }
        else if (mode === 'dat') {                    // the J-card's cover (or the whole J-card), else the front picture
          const im = await wrapOf(a, false), g = im && jCard(im, false, false);
          if (g) { node = alt ? crop(im, { x: 0, w: g.W }, g.H) : crop(im, g.cover, g.H); node.classList.add('pv-img'); cls = ' free'; Object.assign(node.style, alt ? { width: 'min(52vw, 620px)', height: 'auto' } : { height: 'min(62vh, 520px)', width: 'auto' }); }
        } else if (mode === 'md') {                     // retail case: the case with the cover behind its front; slim case: the J-card's cover
          if (kind === 'mdr') {
            if (alt && a.back) { const im = await loadImg(a.back), g = im && trayCard(im); node = g ? crop(im, g.panel, g.H) : plainImg(a.back); }
            else node = await mdCase(a);
          } else if (a.jcard) { const im = await wrapOf(a, false), g = im && jCard(im, false, false); node = g ? (alt ? plainImg(a.jcard) : crop(im, g.cover, g.H)) : plainImg(a.jcard); }
          if (node) { node.classList.add('pv-img'); cls = ' free'; }
        } else if (S.isTape(mode) && mode !== 'reel' && (a.jcard || mode === 'micro')) {
          const im = await wrapOf(a, kind === 'cas1'), g = im && jCard(im, kind === 'cas1', mode === 'micro');
          if (g) { node = alt ? (a.jcard && !(mode === 'cassette' && a.is_generic) ? plainImg(a.jcard) : crop(im, { x: 0, w: g.W }, g.H)) : crop(im, g.cover, g.H); node.classList.add('pv-img'); cls = ' free'; }
        } else if (mode === 'cd' && alt && a.back) {
          const im = await loadImg(a.back), g = im && trayCard(im);
          node = g ? crop(im, g.panel, g.H) : plainImg(a.back); node.classList.add('pv-img'); cls = ' free';
        }
        else if (mode === 'cd' && !alt) { node = await cdCase(a.front, a); if (node) { node.classList.add('pv-img'); cls = ' free'; } }
        else if (mode === 'vinyl') { const h = await S.holeCover(a, alt && a.back ? 'back' : 'front'); if (h) { node = h; node.classList.add('pv-img'); cls = ' free'; } }
        if (tok !== shelf._pvTok) return;
        if (!node) {
          const src = alt && a.back && (!S.isTape(mode) || mode === 'reel') ? a.back : a.front;
          node = plainImg(src);
          if (mode === 'cd' && !alt) { place(el('div', { class: 'pv-frame' }, el('div', { class: 'pv-hinge' }), el('div', { class: 'pv-face' }, node))); return; }
          cls = ' free';
        }
        place(node, cls);
      };
      draw();
      const canAlt = mode === 'dat' ? true : mode === 'md' ? !!(kind === 'mdr' ? a.back : a.jcard) : S.isTape(mode) && mode !== 'reel' ? !!(a.jcard || mode === 'micro') : !!a.back;
      const flip = canAlt ? el('button', { onclick: () => { alt = !alt; flip.textContent = (S.isTape(mode) && mode !== 'reel') || (mode === 'md' && kind === 'mds') || mode === 'dat' ? (alt ? 'Show cover' : 'Show full J-card') : (alt ? 'Show front' : 'Show back'); draw(); } }, (S.isTape(mode) && mode !== 'reel') || (mode === 'md' && kind === 'mds') || mode === 'dat' ? 'Show full J-card' : 'Show back') : null;
      const desc = S.describe({ release_type: a.release_type, kind: a.kind, disc_size: a.disc_size, shaped: a.shaped, shape_size: a.shape_size, shape_fit: a.shape_fit, sides: a.sides, md_disc: a.md_disc, md_case: a.md_case, is_generic: a.is_generic, front: a.front, tracks: Array.from({ length: n }, () => ({ duration: (a.total_sec || 0) / n })) }, mode);
      const ov = el('div', { class: 'pv-ov', onclick: e => { if (e.target === ov) close(); } },
        el('div', { class: 'pv-card' }, art,
          el('div', { class: 'pv-info' },
            el('h3', {}, a.title || 'Untitled'), el('div', { class: 'pv-artist' }, a.artist || (a.kind === 'set' ? 'Playlist' : '')),
            el('div', { class: 'note' }, [a.year, desc, `${a.track_count || 0} track${a.track_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')),
            el('div', { class: 'pv-btns' },
              el('button', { class: 'primary', onclick: async () => { const from = art.getBoundingClientRect(); close(); await S.app.playFromLibrary(a.id, from, () => shelf.close()); } }, '▶  Play'),
              el('button', { onclick: async () => { const full = await window.api.libraryLoad(mode, a.id); if (!full) return S.toast('That entry no longer exists'); close(); S.editor.open(full, { onSaved: () => shelf.reload() }); } }, '✎  Edit info'),
              flip,
              el('button', { class: 'danger', onclick: async () => {
                if (!confirm(`Remove "${a.title}" from the ${mode} library?\n(Your music files are not touched.)`)) return;
                await window.api.libraryDelete(mode, a.id);
                shelf.items = shelf.items.filter(x => x.id !== a.id); shelf.sel.delete(a.id); close(); shelf.render();
              } }, 'Remove'),
              el('button', { onclick: close }, 'Close')))));
      window.addEventListener('keydown', onKey, true);
      shelf.root.append(ov);
    }
  };
})(window.S);
