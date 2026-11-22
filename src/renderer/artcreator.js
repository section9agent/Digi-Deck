// Artwork creator: design a cover, back, J-card, tray card, label ... for the loaded album, at the exact shape of the slot it is for,
// then save it straight into that slot. Pictures can be moved, resized (corners), stretched (edges), rotated (top handle), skewed and
// cropped; text boxes can use any font installed on the computer. Guides show folds, spines, the disc / label circle and hole.
// A design is kept (as a small project, pictures by file path) so it can be opened and changed again later.
(function (S) {
  const el = (...a) => S.el(...a);
  const LONG = 2400;                                                     // the long edge of a design, in pixels
  const D2R = Math.PI / 180;
  let fontList = null;

  // ---- the shape of each slot, and the guides drawn over it --------------------------------------------------------------------
  // J-card panels (left to right) as fractions of the width; measured on the layout references used elsewhere in the app
  const JC = {
    cassette: { r: 0.927, folds: [0.159, 0.302], names: ['back flap', 'spine', 'cover'] },
    micro: { r: 605 / 596, folds: [91 / 605, 195 / 605], names: ['back flap', 'spine', 'cover'] },
    dat: { r: 959 / 860, folds: [200 / 959, 321 / 959], names: ['back flap', 'spine', 'cover'] },
    md: { r: 975 / 845, folds: [123 / 975, 185 / 975], names: ['back flap', 'spine', 'cover'] }
  };
  S.slotAspect = (mode, a, k) => {
    if (mode === 'md' && k === 'front') return S.releaseInfo(a, 'md').case === 'small' ? 0.9349 : 0.6888;
    if (k === 'front' || k.startsWith('pic_')) return 1;
    if (k.startsWith('label_')) {
      if (mode === 'md') return ({ retail: 1.1752, standard: 0.6834, led: 1.0465 })[S.releaseInfo(a, 'md').disc] || 1;
      if (mode === 'cassette') return 2.1563; if (mode === 'dat') return S.DAT_LABEL_ASPECT || 7.95; if (mode === 'micro') return 1.7035;
      if (mode === 'reel') return a.reel_full ? 1 : 2.1375;
      return 1;
    }
    if (k === 'jcard') return (JC[mode] || JC.cassette).r;
    if (k === 'spine') return 0.103;
    if (mode === 'cd' && k === 'back') return 151 / 118;
    if (mode === 'md' && k === 'back') return 1.5;
    return 1;
  };
  S.slotGuides = (mode, a, k) => {
    const g = [];
    if (k === 'jcard') { const j = JC[mode] || JC.cassette; g.push({ folds: j.folds, names: j.names }); }
    if (mode === 'cd' && k === 'back') g.push({ folds: [0.0425, 1 - 0.0425], names: ['spine', 'back', 'spine'] });
    if (mode === 'md' && k === 'back') g.push({ folds: [0.0987, 1 - 0.0987], names: ['spine', 'back', 'spine'] });
    if (k.startsWith('label_') || k.startsWith('pic_')) {
      if (mode === 'cd') { const rad = S.releaseInfo(a, mode).small ? 40 : 60; g.push({ circle: 0.995, hole: 7.5 / rad, hub: 17.5 / rad }); }
      else if (mode === 'vinyl') {
        const vi = S.releaseInfo(a, mode), G = S.vinyl.GEO[vi.shaped ? 'lp' : S.vinyl.kindOfInfo(vi)], hole = vi.seven && a.small_hole ? 0.0407 : G.hole;
        if (!(k.startsWith('pic_') && a.shaped)) g.push(k.startsWith('pic_') ? { circle: 1, hole } : { circle: 1, hole: hole / G.label });
      } else if (mode === 'reel' && a.reel_full) g.push({ circle: 0.985, hole: 0.058 });
      else if (mode === 'cassette') g.push({ mask: '../../assets/cassette/label-clean.png' });
      else if (mode === 'micro') g.push({ mask: '../../assets/labels/micro.png' });
      else if (mode === 'reel') g.push({ mask: '../../assets/labels/reel.png' });
      else if (mode === 'md') g.push({ mask: `../../assets/md/guide-label-${S.releaseInfo(a, 'md').disc}.png` });
    }
    return g;
  };

  // ---- fonts installed on this computer (Local Font Access), with a fallback list -----------------------------------------------
  async function fonts() {
    if (fontList) return fontList;
    let names = [];
    try { if (window.queryLocalFonts) { const fs = await window.queryLocalFonts(); names = [...new Set(fs.map(f => f.family))]; } } catch (e) { console.warn('local fonts', e); }
    if (!names.length) names = ['Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Franklin Gothic Medium', 'Georgia', 'Helvetica', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
    return (fontList = names.sort((a, b) => a.localeCompare(b)));
  }

  // ---- drawing a design ------------------------------------------------------------------------------------------------------
  const imgCache = new Map();
  const loadImg = src => { if (!imgCache.has(src)) imgCache.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = /^(data:|blob:|\.\.\/)/.test(src) ? src : S.fileUrl(src); })); return imgCache.get(src); };
  function wrapLines(x, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) { const t = line + word; if (line && x.measureText(t).width > maxW && word.trim()) { out.push(line.trimEnd()); line = word.trimStart(); } else line = t; }
      out.push(line);
    }
    return out;
  }
  function layerMatrix(L) {                       // the layer's local -> design transform
    const m = new DOMMatrix().translate(L.x, L.y).rotate(L.rot || 0).multiply(new DOMMatrix([1, Math.tan((L.sky || 0) * D2R), Math.tan((L.skx || 0) * D2R), 1, 0, 0])).scale(L.flipX ? -1 : 1, L.flipY ? -1 : 1);
    return m;
  }
  async function drawLayer(x, L) {
    x.save(); x.setTransform(x.getTransform().multiply(layerMatrix(L))); x.globalAlpha = L.op == null ? 1 : L.op;
    if (L.type === 'image') {
      const im = await loadImg(L.src);
      if (im) { const c = L.crop || { l: 0, t: 0, r: 0, b: 0 }, W = im.naturalWidth, H = im.naturalHeight; x.drawImage(im, c.l * W, c.t * H, W * (1 - c.l - c.r), H * (1 - c.t - c.b), -L.w / 2, -L.h / 2, L.w, L.h); }
    } else if (L.type === 'rect') {
      x.fillStyle = L.color || '#ffffff'; if (L.radius) { x.beginPath(); x.roundRect(-L.w / 2, -L.h / 2, L.w, L.h, L.radius); x.fill(); } else x.fillRect(-L.w / 2, -L.h / 2, L.w, L.h);
    } else if (L.type === 'text') {
      x.font = `${L.italic ? 'italic ' : ''}${L.bold ? '700 ' : '400 '}${L.size}px "${L.font}", sans-serif`;
      if ('letterSpacing' in x) x.letterSpacing = (L.spacing || 0) + 'px';
      x.textBaseline = 'top'; x.textAlign = L.align || 'left';
      const lines = wrapLines(x, L.text || '', L.w), lh = L.size * (L.lineH || 1.2), ax = L.align === 'center' ? 0 : L.align === 'right' ? L.w / 2 : -L.w / 2;
      const top = -lines.length * lh / 2;
      if (L.shadow) { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = L.size * 0.15; x.shadowOffsetY = L.size * 0.06; }
      lines.forEach((ln, i) => {
        if (L.strokeW) { x.lineJoin = 'round'; x.lineWidth = L.strokeW; x.strokeStyle = L.stroke || '#000'; x.strokeText(ln, ax, top + i * lh); }
        x.fillStyle = L.color || '#000'; x.fillText(ln, ax, top + i * lh);
      });
    }
    x.restore();
  }
  async function render(x, P, scale = 1) {
    x.save(); x.setTransform(scale, 0, 0, scale, 0, 0);
    x.fillStyle = P.bg || '#ffffff'; if (P.bg === 'transparent') x.clearRect(0, 0, P.w, P.h); else x.fillRect(0, 0, P.w, P.h);
    for (const L of P.layers) if (!L.hidden) await drawLayer(x, L);
    x.restore();
  }

  // ---- the creator window ----------------------------------------------------------------------------------------------------
  const projKey = (mode, a, slot) => `${mode}|${a.key || a.id || a.title}|${slot}`;
  async function loadProject(mode, a, slot) { const st = await window.api.getSettings().catch(() => ({})); const p = (st.artProjects || {})[projKey(mode, a, slot)]; return p ? JSON.parse(p) : null; }
  async function saveProject(mode, a, slot, P) { const st = await window.api.getSettings().catch(() => ({})); const all = { ...(st.artProjects || {}) }; all[projKey(mode, a, slot)] = JSON.stringify(P); await window.api.setSettings({ artProjects: all }); }

  S.artCreator = {
    async open(startSlot) {
      const A = S.app, mode = A.mode, album = A.album;
      if (!album) return S.toast('Open an album first - the design is made for its artwork slots');
      const slots = S.slotsFor(mode, album);
      let slot = startSlot || slots[0][0], P = null, sel = null, undo = [], redo = [], guidesOn = true;
      const fam = await fonts();
      const root = el('div', { class: 'ac' }), stage = el('div', { class: 'ac-stage' }), cv = el('canvas', { class: 'ac-cv' }), ov = el('canvas', { class: 'ac-ov' });
      stage.append(cv, ov);
      const side = el('div', { class: 'ac-side' }), layersBox = el('div', { class: 'ac-layers' }), props = el('div', { class: 'ac-props' });
      const slotSel = el('select', { onchange: async () => { await switchSlot(slotSel.value); } }, ...slots.map(([k, n]) => el('option', { value: k }, n)));
      slotSel.value = slot;
      const newP = () => { const r = S.slotAspect(mode, album, slot); return { w: r >= 1 ? LONG : Math.round(LONG * r), h: r >= 1 ? Math.round(LONG / r) : LONG, bg: '#ffffff', layers: [] }; };
      const snapshot = () => { undo.push(JSON.stringify(P)); if (undo.length > 80) undo.shift(); redo = []; };
      const sizeInfo = el('span', { class: 'note' });

      async function switchSlot(k) {
        slot = k; sel = null; undo = []; redo = [];
        P = await loadProject(mode, album, slot) || newP();
        const want = newP(); if (Math.abs(P.w / P.h - want.w / want.h) > 0.01) { const sx = want.w / P.w, sy = want.h / P.h; P.layers.forEach(L => { L.x *= sx; L.y *= sy; }); P.w = want.w; P.h = want.h; }
        // a slot that already has a picture (not made here) starts with that picture as the first layer
        if (!P.layers.length && album[slot] && !/^https?:/.test(album[slot])) P.layers.push({ id: Date.now(), type: 'image', src: album[slot], x: P.w / 2, y: P.h / 2, w: P.w, h: P.h, rot: 0, skx: 0, sky: 0, op: 1, crop: { l: 0, t: 0, r: 0, b: 0 }, name: 'Current picture' });
        sizeInfo.textContent = `${P.w} × ${P.h} px`;
        layout(); await redraw(); listLayers(); showProps();
      }
      // ---- display
      let view = 1;
      function layout() {
        const r = stage.getBoundingClientRect(), pad = 40; view = Math.min((r.width - pad) / P.w, (r.height - pad) / P.h);
        for (const c of [cv, ov]) { c.width = Math.round(P.w * view * devicePixelRatio); c.height = Math.round(P.h * view * devicePixelRatio); c.style.width = P.w * view + 'px'; c.style.height = P.h * view + 'px'; }
      }
      let drawing = false, again = false;
      async function redraw() {
        if (drawing) { again = true; return; } drawing = true;
        do { again = false; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); await render(x, P, view * devicePixelRatio); drawOverlay(); } while (again);
        drawing = false;
      }
      const guideImgs = {};
      function drawOverlay() {
        const x = ov.getContext('2d'), k = view * devicePixelRatio; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, ov.width, ov.height); x.setTransform(k, 0, 0, k, 0, 0);
        if (guidesOn) for (const g of S.slotGuides(mode, album, slot)) {
          x.save(); x.lineWidth = 2 / view; x.setLineDash([10 / view, 8 / view]); x.strokeStyle = 'rgba(255,40,140,.85)'; x.fillStyle = 'rgba(255,40,140,.9)'; x.font = `${13 / view}px Arial`;
          if (g.folds) { g.folds.forEach(f => { x.beginPath(); x.moveTo(f * P.w, 0); x.lineTo(f * P.w, P.h); x.stroke(); }); const ed = [0, ...g.folds, 1]; g.names.forEach((n, i) => { x.textAlign = 'center'; x.fillText(n, (ed[i] + ed[i + 1]) / 2 * P.w, 16 / view); }); }
          if (g.circle) { const R = Math.min(P.w, P.h) / 2; x.beginPath(); x.arc(P.w / 2, P.h / 2, R * g.circle, 0, 7); x.stroke(); if (g.hub) { x.beginPath(); x.arc(P.w / 2, P.h / 2, R * g.hub, 0, 7); x.stroke(); } x.setLineDash([]); x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(P.w / 2, P.h / 2, R * g.hole, 0, 7); x.fill(); }
          if (g.mask) { const im = guideImgs[g.mask]; if (im) { x.globalAlpha = 0.35; x.drawImage(im, 0, 0, P.w, P.h); } else loadImg(g.mask).then(i => { guideImgs[g.mask] = i; drawOverlay(); }); }
          x.restore();
        }
        const L = P.layers.find(l => l.id === sel); if (!L) return;
        x.save(); x.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]).multiply(layerMatrix(L)));
        const hw = L.w / 2, hh = L.h / 2, hs = 7 / view;
        x.strokeStyle = '#2aa8ff'; x.lineWidth = 1.5 / view; x.setLineDash([]); x.strokeRect(-hw, -hh, L.w, L.h);
        x.beginPath(); x.moveTo(0, -hh); x.lineTo(0, -hh - 34 / view); x.stroke();
        x.fillStyle = '#fff';
        for (const [hx, hy] of handlePts(L)) { x.beginPath(); x.rect(hx - hs, hy - hs, hs * 2, hs * 2); x.fill(); x.stroke(); }
        x.beginPath(); x.arc(0, -hh - 34 / view, hs * 1.2, 0, 7); x.fill(); x.stroke();
        x.restore();
      }
      const handlePts = L => { const hw = L.w / 2, hh = L.h / 2; return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [0, -hh], [hw, 0], [0, hh], [-hw, 0]]; };
      // ---- pointer: select, move, resize (corners keep the shape, edges stretch), rotate
      const toDesign = ev => { const r = ov.getBoundingClientRect(); return new DOMPoint((ev.clientX - r.left) / view, (ev.clientY - r.top) / view); };
      const toLocal = (L, p) => layerMatrix(L).inverse().transformPoint(p);
      const hit = p => { for (let i = P.layers.length - 1; i >= 0; i--) { const L = P.layers[i]; if (L.hidden || L.locked) continue; const q = toLocal(L, p); if (Math.abs(q.x) <= L.w / 2 && Math.abs(q.y) <= L.h / 2) return L; } return null; };
      let drag = null;
      ov.addEventListener('pointerdown', ev => {
        const p = toDesign(ev), L0 = P.layers.find(l => l.id === sel);
        if (L0) {
          const q = toLocal(L0, p), tol = 10 / view;
          if (Math.hypot(q.x, q.y + L0.h / 2 + 34 / view) < tol * 1.4) { snapshot(); drag = { kind: 'rot', L: L0 }; }
          else { const i = handlePts(L0).findIndex(([hx, hy]) => Math.abs(q.x - hx) < tol && Math.abs(q.y - hy) < tol); if (i >= 0) { snapshot(); drag = { kind: 'size', i, L: L0, start: { ...L0 }, anchor: layerMatrix(L0).transformPoint(new DOMPoint(-handlePts(L0)[i][0], -handlePts(L0)[i][1])) }; } }
        }
        if (!drag) { const L = hit(p); sel = L ? L.id : null; if (L) { snapshot(); drag = { kind: 'move', L, dx: p.x - L.x, dy: p.y - L.y }; } listLayers(); showProps(); drawOverlay(); }
        if (drag) ov.setPointerCapture(ev.pointerId);
      });
      ov.addEventListener('pointermove', ev => {
        const p = toDesign(ev);
        if (!drag) { const L0 = P.layers.find(l => l.id === sel); let c = ''; if (L0) { const q = toLocal(L0, p), tol = 10 / view; if (Math.hypot(q.x, q.y + L0.h / 2 + 34 / view) < tol * 1.4) c = 'grab'; else { const i = handlePts(L0).findIndex(([hx, hy]) => Math.abs(q.x - hx) < tol && Math.abs(q.y - hy) < tol); if (i >= 0) c = i < 4 ? 'nwse-resize' : 'ew-resize'; } } ov.style.cursor = c || (hit(p) ? 'move' : 'default'); return; }
        const L = drag.L;
        if (drag.kind === 'move') { L.x = p.x - drag.dx; L.y = p.y - drag.dy; if (!ev.altKey) snap(L); }
        else if (drag.kind === 'rot') { let a = Math.atan2(p.y - L.y, p.x - L.x) / D2R + 90; if (ev.shiftKey) a = Math.round(a / 15) * 15; L.rot = ((a % 360) + 360) % 360; }
        else {
          const s = drag.start, [hx, hy] = handlePts(s)[drag.i], corner = drag.i < 4;
          // work in the layer's own (unrotated) frame, with the opposite handle fixed
          const m0 = layerMatrix(s).inverse(), q = m0.transformPoint(p), a0 = m0.transformPoint(drag.anchor);
          let w = s.w, h = s.h;
          if (hx) w = Math.max(8, Math.abs(q.x - a0.x)); if (hy) h = Math.max(8, Math.abs(q.y - a0.y));
          if (corner && !ev.shiftKey) { const k = Math.max(w / s.w, h / s.h); w = s.w * k; h = s.h * k; }   // corners keep the shape (Shift: free)
          if (L.type === 'text' && corner && !ev.shiftKey) L.size = s.size * (w / s.w);
          const cxL = (a0.x + (hx ? Math.sign(hx) * w : 0) + a0.x) / 2, cyL = (a0.y + (hy ? Math.sign(hy) * h : 0) + a0.y) / 2;
          const c = layerMatrix(s).transformPoint(new DOMPoint(hx ? cxL : 0, hy ? cyL : 0));
          L.w = w; L.h = h; L.x = c.x; L.y = c.y;
        }
        redraw(); showProps(true);
      });
      ov.addEventListener('pointerup', () => { if (drag) { drag = null; redraw(); } });
      ov.addEventListener('dblclick', ev => { const L = hit(toDesign(ev)); if (L && L.type === 'text') { sel = L.id; showProps(); const ta = props.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } } });
      function snap(L) {                                  // the centre snaps to the middle and the folds
        const t = 12 / view, xs = [P.w / 2, ...[].concat(...S.slotGuides(mode, album, slot).filter(g => g.folds).map(g => { const ed = [0, ...g.folds, 1]; return ed.slice(0, -1).map((e, i) => (e + ed[i + 1]) / 2 * P.w); }))];
        for (const v of xs) if (Math.abs(L.x - v) < t) L.x = v; if (Math.abs(L.y - P.h / 2) < t) L.y = P.h / 2;
      }
      // ---- layers
      const addLayer = L => { snapshot(); L.id = Date.now() + Math.random(); P.layers.push(L); sel = L.id; listLayers(); showProps(); redraw(); };
      async function addImage(path) {
        const src = path || await window.api.pickImage(); if (!src) return;
        const im = await loadImg(src); if (!im) return S.toast('Could not open that picture');
        const k = Math.min(P.w / im.naturalWidth, P.h / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
        addLayer({ type: 'image', src, x: P.w / 2, y: P.h / 2, w, h, rot: 0, skx: 0, sky: 0, op: 1, crop: { l: 0, t: 0, r: 0, b: 0 }, name: src.split(/[\\/]/).pop() });
      }
      const addText = () => addLayer({ type: 'text', text: album.title || 'Title', font: fam.includes('Arial') ? 'Arial' : fam[0], size: Math.round(Math.min(P.w, P.h) * 0.08), color: '#111111', bold: true, italic: false, align: 'center', stroke: '#ffffff', strokeW: 0, shadow: false, spacing: 0, lineH: 1.15, x: P.w / 2, y: P.h / 2, w: P.w * 0.8, h: Math.min(P.w, P.h) * 0.2, rot: 0, skx: 0, sky: 0, op: 1, name: 'Text' });
      const addRect = () => addLayer({ type: 'rect', color: '#e83a3a', radius: 0, x: P.w / 2, y: P.h / 2, w: P.w * 0.5, h: P.h * 0.2, rot: 0, skx: 0, sky: 0, op: 1, name: 'Shape' });
      function listLayers() {
        layersBox.replaceChildren(...P.layers.map((L, i) => ({ L, i })).reverse().map(({ L, i }) => el('div', { class: 'ac-layer' + (L.id === sel ? ' on' : ''), onclick: () => { sel = L.id; listLayers(); showProps(); drawOverlay(); } },
          el('span', { class: 'ac-ico' }, L.type === 'text' ? 'T' : L.type === 'rect' ? '■' : '🖼'), el('span', { class: 'ac-ln' }, L.type === 'text' ? (L.text || '').slice(0, 24) || 'Text' : L.name || L.type),
          el('button', { title: L.hidden ? 'Show' : 'Hide', onclick: e => { e.stopPropagation(); L.hidden = !L.hidden; listLayers(); redraw(); } }, L.hidden ? '◌' : '●'),
          el('button', { title: 'Bring forward', onclick: e => { e.stopPropagation(); if (i < P.layers.length - 1) { snapshot(); [P.layers[i], P.layers[i + 1]] = [P.layers[i + 1], P.layers[i]]; listLayers(); redraw(); } } }, '▲'),
          el('button', { title: 'Send back', onclick: e => { e.stopPropagation(); if (i > 0) { snapshot(); [P.layers[i], P.layers[i - 1]] = [P.layers[i - 1], P.layers[i]]; listLayers(); redraw(); } } }, '▼'))));
      }
      // ---- properties of the selected layer
      const num = (label, get, set, min, max, step = 1, unit = '') => {
        const r = el('input', { type: 'range', min, max, step, value: get() }), n = el('input', { type: 'number', min, max, step, value: +(+get()).toFixed(2) });
        const apply = v => { set(+v); r.value = v; n.value = +(+v).toFixed(2); redraw(); };
        r.addEventListener('pointerdown', snapshot); r.addEventListener('input', () => apply(r.value)); n.addEventListener('change', () => { snapshot(); apply(n.value); });
        const row = el('label', { class: 'ac-num' }, el('span', {}, label), r, n, unit ? el('i', {}, unit) : ''); row._sync = () => { r.value = get(); n.value = +(+get()).toFixed(2); }; return row;
      };
      let numRows = [];
      function showProps(soft) {
        const L = P.layers.find(l => l.id === sel);
        if (soft) { numRows.forEach(r => r._sync && r._sync()); return; }
        numRows = [];
        const bgIn = el('input', { type: 'color', value: P.bg === 'transparent' ? '#ffffff' : P.bg, oninput: e => { P.bg = e.target.value; redraw(); } });
        const clear = el('input', { type: 'checkbox', onchange: e => { P.bg = e.target.checked ? 'transparent' : bgIn.value; redraw(); } }); clear.checked = P.bg === 'transparent';
        const base = [el('div', { class: 'sec' }, 'Background'), el('label', { class: 'ac-row' }, 'Colour ', bgIn, ' ', clear, ' see-through')];
        if (!L) { props.replaceChildren(...base, el('p', { class: 'note' }, 'Click a picture or text to change it. Drag to move · corners resize · edges stretch · the round handle rotates (Shift: 15° steps; on corners Shift stretches freely) · Alt turns off snapping · Delete removes · Ctrl+D duplicates · Ctrl+Z undoes.')); return; }
        const rows = [
          num('X', () => L.x, v => L.x = v, -P.w, P.w * 2), num('Y', () => L.y, v => L.y = v, -P.h, P.h * 2),
          num('Width', () => L.w, v => L.w = Math.max(4, v), 4, P.w * 3), num('Height', () => L.h, v => L.h = Math.max(4, v), 4, P.h * 3),
          num('Rotate', () => L.rot || 0, v => L.rot = v, -180, 360, 0.5, '°'), num('Skew ↔', () => L.skx || 0, v => L.skx = v, -60, 60, 0.5, '°'), num('Skew ↕', () => L.sky || 0, v => L.sky = v, -60, 60, 0.5, '°'),
          num('Opacity', () => (L.op == null ? 1 : L.op) * 100, v => L.op = v / 100, 0, 100, 1, '%')];
        numRows.push(...rows);
        const flips = el('div', { class: 'ac-row' }, el('button', { onclick: () => { snapshot(); L.flipX = !L.flipX; redraw(); } }, '⇋ Flip'), el('button', { onclick: () => { snapshot(); L.flipY = !L.flipY; redraw(); } }, '⇵ Flip'),
          el('button', { onclick: () => { snapshot(); Object.assign(L, { x: P.w / 2, y: P.h / 2 }); redraw(); showProps(true); } }, 'Centre'),
          el('button', { onclick: () => { snapshot(); Object.assign(L, { x: P.w / 2, y: P.h / 2, w: P.w, h: P.h, rot: 0, skx: 0, sky: 0 }); redraw(); showProps(true); } }, 'Fill'));
        let extra = [];
        if (L.type === 'image') {
          // cropping keeps the picture's scale: the box shrinks with the crop and the kept part stays where it was
          const cropRow = (label, key) => num(label, () => L.crop[key] * 100, v => {
            const c = L.crop, nv = S.clamp(v / 100, 0, 0.95 - (key === 'l' ? c.r : key === 'r' ? c.l : key === 't' ? c.b : c.t));
            const horiz = key === 'l' || key === 'r', span0 = horiz ? 1 - c.l - c.r : 1 - c.t - c.b, unit = (horiz ? L.w : L.h) / span0, d = nv - c[key];
            c[key] = nv; if (horiz) L.w = unit * (1 - c.l - c.r); else L.h = unit * (1 - c.t - c.b);
            const shift = (key === 'l' || key === 't' ? 1 : -1) * d * unit / 2, m = new DOMMatrix().rotate(L.rot || 0), v2 = m.transformPoint(new DOMPoint(horiz ? shift : 0, horiz ? 0 : shift));
            L.x += v2.x; L.y += v2.y;
          }, 0, 95, 0.5, '%');
          const cr = [cropRow('Crop left', 'l'), cropRow('Crop right', 'r'), cropRow('Crop top', 't'), cropRow('Crop bottom', 'b')]; numRows.push(...cr);
          extra = [el('div', { class: 'sec' }, 'Crop'), ...cr, el('button', { onclick: () => { snapshot(); const c = L.crop; const sx = L.w / (1 - c.l - c.r), sy = L.h / (1 - c.t - c.b); L.crop = { l: 0, t: 0, r: 0, b: 0 }; L.w = sx; L.h = sy; redraw(); showProps(); } }, 'Uncrop'),
            el('button', { onclick: async () => { const p = await window.api.pickImage(); if (p) { snapshot(); L.src = p; L.name = p.split(/[\\/]/).pop(); redraw(); listLayers(); } } }, 'Replace picture…')];
        } else if (L.type === 'text') {
          const ta = el('textarea', { rows: 3, value: L.text, oninput: e => { L.text = e.target.value; redraw(); listLayers(); } }); ta.addEventListener('focus', snapshot); ta.value = L.text || '';
          const fsel = el('select', { onchange: e => { snapshot(); L.font = e.target.value; redraw(); } }, ...fam.map(f => el('option', { value: f, style: { fontFamily: `"${f}"` } }, f))); fsel.value = L.font;
          const fsearch = el('input', { placeholder: 'Find a font…', oninput: e => { const t = e.target.value.toLowerCase(); const f = fam.find(n => n.toLowerCase().startsWith(t)) || fam.find(n => n.toLowerCase().includes(t)); if (f) { fsel.value = f; L.font = f; redraw(); } } });
          const tog = (label, key) => { const b = el('button', { class: L[key] ? 'on' : '', onclick: () => { snapshot(); L[key] = !L[key]; b.classList.toggle('on', L[key]); redraw(); } }, label); return b; };
          const al = v => el('button', { class: L.align === v ? 'on' : '', onclick: () => { snapshot(); L.align = v; redraw(); showProps(); } }, v === 'left' ? '⯇' : v === 'center' ? '≡' : '⯈');
          const col = el('input', { type: 'color', value: L.color, oninput: e => { L.color = e.target.value; redraw(); } }), scol = el('input', { type: 'color', value: L.stroke || '#ffffff', oninput: e => { L.stroke = e.target.value; redraw(); } });
          const nr = [num('Size', () => L.size, v => L.size = Math.max(4, v), 4, 800), num('Spacing', () => L.spacing || 0, v => L.spacing = v, -20, 200), num('Line height', () => (L.lineH || 1.2) * 100, v => L.lineH = v / 100, 60, 300, 1, '%'), num('Outline', () => L.strokeW || 0, v => L.strokeW = v, 0, 60)];
          numRows.push(...nr);
          extra = [el('div', { class: 'sec' }, 'Text'), ta, el('label', { class: 'ac-row' }, 'Font ', fsel), fsearch, el('div', { class: 'ac-row' }, tog('B', 'bold'), tog('I', 'italic'), tog('Shadow', 'shadow'), al('left'), al('center'), al('right')),
            el('label', { class: 'ac-row' }, 'Colour ', col, '  Outline colour ', scol), ...nr];
        } else if (L.type === 'rect') {
          const col = el('input', { type: 'color', value: L.color, oninput: e => { L.color = e.target.value; redraw(); } }); const rr = num('Corners', () => L.radius || 0, v => L.radius = v, 0, 600); numRows.push(rr);
          extra = [el('div', { class: 'sec' }, 'Shape'), el('label', { class: 'ac-row' }, 'Colour ', col), rr];
        }
        props.replaceChildren(...base, el('div', { class: 'sec' }, L.type === 'text' ? 'Text box' : L.type === 'rect' ? 'Shape' : 'Picture'), ...rows, flips, ...extra,
          el('div', { class: 'ac-row' }, el('button', { onclick: dup }, 'Duplicate'), el('button', { class: 'danger', onclick: del }, 'Delete')));
      }
      const dup = () => { const L = P.layers.find(l => l.id === sel); if (!L) return; const c = JSON.parse(JSON.stringify(L)); c.x += 30; c.y += 30; addLayer(c); };
      const del = () => { const i = P.layers.findIndex(l => l.id === sel); if (i < 0) return; snapshot(); P.layers.splice(i, 1); sel = null; listLayers(); showProps(); redraw(); };
      const doUndo = () => { if (!undo.length) return; redo.push(JSON.stringify(P)); P = JSON.parse(undo.pop()); if (!P.layers.some(l => l.id === sel)) sel = null; listLayers(); showProps(); redraw(); };
      const doRedo = () => { if (!redo.length) return; undo.push(JSON.stringify(P)); P = JSON.parse(redo.pop()); listLayers(); showProps(); redraw(); };
      const key = ev => {
        if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
        const L = P.layers.find(l => l.id === sel), c = ev.ctrlKey || ev.metaKey;
        if (c && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? doRedo() : doUndo(); }
        else if (c && ev.key.toLowerCase() === 'y') { ev.preventDefault(); doRedo(); }
        else if (c && ev.key.toLowerCase() === 'd') { ev.preventDefault(); dup(); }
        else if (L && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); del(); }
        else if (L && ev.key.startsWith('Arrow')) { ev.preventDefault(); const s = ev.shiftKey ? 20 : 2; if (ev.key === 'ArrowLeft') L.x -= s; if (ev.key === 'ArrowRight') L.x += s; if (ev.key === 'ArrowUp') L.y -= s; if (ev.key === 'ArrowDown') L.y += s; redraw(); showProps(true); }
      };
      window.addEventListener('keydown', key);
      // dropping picture files onto the design adds them
      stage.addEventListener('dragover', e => e.preventDefault());
      stage.addEventListener('drop', async e => { e.preventDefault(); for (const f of e.dataTransfer.files) { const p = window.api.pathForFile(f); if (p && /\.(png|jpe?g|webp|gif|bmp)$/i.test(p)) await addImage(p); } });
      // ---- save into the slot
      async function save(close) {
        sel = null; drawOverlay();
        const out = S.newCanvas(P.w, P.h); await render(out.getContext('2d'), P, 1);
        const path = await window.api.artSaveData(out.toDataURL('image/png'), `${mode}-${slot}`);
        await saveProject(mode, album, slot, P);
        album[slot] = path; S.dropImageCache && S.dropImageCache();
        if (album.id) { try { await window.api.librarySave(mode, { ...album, tracks: album.tracks.map(({ missing, ...t }) => t) }); } catch (e) { S.toast('Saved the picture, but could not update the library: ' + e.message); } }
        S.toast(`Saved to “${slots.find(s => s[0] === slot)[1]}”`);
        if (close) { done(); if (A.audio.paused) A.loadAlbum(A.album, { autoplay: false, startIndex: Math.max(0, A.cur) }); else S.toast('The new artwork shows the next time the album is loaded'); }
      }
      const exportPng = async () => { const out = S.newCanvas(P.w, P.h); await render(out.getContext('2d'), P, 1); const a = el('a', { href: out.toDataURL('image/png'), download: `${(album.title || 'artwork').replace(/[^\w -]+/g, '')} - ${slot}.png` }); a.click(); };
      const top = el('div', { class: 'ac-top' },
        el('b', {}, 'Create art'), el('label', {}, 'For ', slotSel), sizeInfo,
        el('button', { onclick: () => addImage() }, '+ Picture'), el('button', { onclick: addText }, '+ Text'), el('button', { onclick: addRect }, '+ Shape'),
        el('button', { title: 'Undo (Ctrl+Z)', onclick: doUndo }, '↶'), el('button', { title: 'Redo (Ctrl+Y)', onclick: doRedo }, '↷'),
        el('label', { class: 'chk' }, (() => { const c = el('input', { type: 'checkbox', onchange: e => { guidesOn = e.target.checked; drawOverlay(); } }); c.checked = true; return c; })(), ' Guides'),
        el('div', { class: 'spacer' }),
        el('button', { onclick: () => { if (confirm('Start this design again from blank?')) { snapshot(); P = newP(); sel = null; listLayers(); showProps(); redraw(); } } }, 'New'),
        el('button', { onclick: exportPng }, 'Export PNG'), el('button', { onclick: () => save(false) }, 'Save'), el('button', { class: 'primary', onclick: () => save(true) }, 'Save & close'), el('button', { onclick: () => done() }, 'Close'));
      side.append(el('div', { class: 'sec' }, 'Layers (top first)'), layersBox, props);
      root.append(top, el('div', { class: 'ac-main' }, stage, side));
      document.body.append(root);
      const ro = new ResizeObserver(() => { if (P) { layout(); redraw(); } }); ro.observe(stage);
      function done() { ro.disconnect(); window.removeEventListener('keydown', key); root.remove(); }
      await switchSlot(slot);
    }
  };
})(window.S);
