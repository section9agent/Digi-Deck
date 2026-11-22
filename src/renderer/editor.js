// Dialogs: album/release editor, settings, art viewer.
(function (S) {
  const $ = S.$, el = S.el;

  // Which artwork slots each mode needs. Vinyl has no J-card; CD only has front, back and the CD label.
  S.slotsFor = (mode, album) => {
    const sides = album ? S.unitLetters(album, mode) : S.isDisc(mode) ? ['A'] : ['A', 'B'];
    if (mode === 'vinyl') {
      const s = [['front', 'Front'], ['back', 'Back'], ...sides.map(x => ['label_' + x.toLowerCase(), 'Label ' + x])];
      if (album && album.picture_disc) s.push(...sides.map(x => ['pic_' + x.toLowerCase(), 'Picture disc ' + x]));
      return s;
    }
    if (mode === 'cd') return [['front', 'Front'], ['back', 'Back (tray card, with spines)'], ...sides.map((x, i) => ['label_' + x.toLowerCase(), sides.length > 1 ? `CD label ${i + 1}` : 'CD label'])];
    if (mode === 'md') return [['front', 'Cover'], ['back', 'Tray card - retail case (spine · back · spine)'], ['jcard', 'J-card - slim case (back flap · spine · cover)'], ...sides.map((x, i) => ['label_' + x.toLowerCase(), sides.length > 1 ? `Disc label ${i + 1}` : 'Disc label'])];
    if (mode === 'dat') return [['front', 'Front'], ['jcard', 'J-card (back flap · spine · cover)'], ...sides.map((x, i) => ['label_' + x.toLowerCase(), sides.length > 1 ? `Tape label ${i + 1}` : 'Tape label'])];
    if (mode === 'reel') return [['front', 'Cover (front of box)'], ['spine', 'Spine'], ['back', 'Back of box'], ...sides.map(x => ['label_' + x.toLowerCase(), 'Label ' + x])];
    return [['front', 'Front'], ['jcard', 'J-card (back flap · spine · cover)'], ...sides.map(x => ['label_' + x.toLowerCase(), 'Label ' + x])];
  };

  S.modal = (title, body, foot, { narrow = false, onClose } = {}) => {
    const root = $('#modal');
    const close = () => { root.hidden = true; root.replaceChildren(); window.removeEventListener('keydown', esc); onClose && onClose(); };
    const esc = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    root.replaceChildren(el('div', { class: 'dlg' + (narrow ? ' narrow' : '') },
      el('div', { class: 'dlg-head' }, el('h3', {}, title), el('button', { onclick: close }, '✕')),
      el('div', { class: 'dlg-body' }, body), foot ? el('div', { class: 'dlg-foot' }, foot) : null));
    root.hidden = false;
    return { close };
  };

  // colour chooser: preset swatches + custom picker
  function swatches(list, get, set) {
    const wrap = el('div', { class: 'swatches' });
    const custom = el('input', { type: 'color', title: 'Custom colour', value: /^#[0-9a-f]{6}$/i.test(get() || '') ? get() : '#808080', oninput: e => { set(e.target.value); render(); } });
    const render = () => {
      const cur = S.colorOf(list, get());
      wrap.replaceChildren(...list.map(c => {
        const bg = c.metal ? `linear-gradient(135deg,${S.shade(c.hex, 0.35)},${c.hex} 45%,${S.shade(c.hex, -0.35)})` : c.hex || (c.id === 'smoke' ? 'linear-gradient(135deg,#8a8c96,#2a2a30)' : 'repeating-conic-gradient(#d8dde2 0 25%,#fff 0 50%) 0 0/10px 10px');
        return el('button', { class: 'sw' + (cur.id === c.id ? ' on' : ''), title: c.name, style: { background: bg }, onclick: () => { set(c.id); render(); } });
      }), el('label', { class: 'sw-custom' + (cur.id === 'custom' ? ' on' : ''), title: 'Custom colour' }, 'Custom', custom),
        el('span', { class: 'note' }, cur.name));
    };
    render();
    return wrap;
  }

  // ------------------------------------------------------------------ editor
  const editor = S.editor = {
    open(album, opts = {}) {
      const mode = S.app.mode;
      const work = JSON.parse(JSON.stringify(album));
      let candidates = [];
      const status = el('span', { class: 'note' });
      const fields = {};
      const input = (key, label, cls = '') => {
        const i = el('input', { value: work[key] || '', oninput: e => { work[key] = e.target.value; } });
        fields[key] = i;
        return el('label', { class: cls }, label, i);
      };
      const form = el('div', { class: 'form' },
        input('artist', 'Artist', 'w2'), input('title', 'Album / title', 'w2'),
        input('year', 'Year'), input('label', 'Label'), input('catno', 'Catalog #'), input('discogs_id', 'Discogs release ID'), input('mbid', 'MusicBrainz release ID', 'w2'));

      // ---- format: release type, disc size, colour, picture disc
      const fmt = el('div', { class: 'fmt' });
      const renderFormat = () => {
        const info = S.releaseInfo(work, mode);
        const typeSel = el('select', { onchange: e => { work.release_type = e.target.value; S.normalizeSides(work, mode); renderTracks(); renderFormat(); } },
          el('option', { value: 'album' }, mode === 'vinyl' ? (info.inch === 10 || info.shaped ? 'Album' : 'Album (12" LP)') : 'Album'),
          el('option', { value: 'single', disabled: !info.canSingle }, mode === 'vinyl' ? (info.inch === 10 || info.shaped ? 'Single (45)' : 'Single (7")') : 'Single'),
          el('option', { value: 'maxi', disabled: !info.canMaxi }, mode === 'vinyl' ? (info.inch === 10 || info.shaped ? 'Maxi single (45)' : 'Maxi single (12" at 45)') : 'Maxi single'));
        typeSel.value = info.type;
        const hint = mode === 'vinyl' ? 'A single is a 7" 45 and holds at most 2 songs (two songs = one per side); a maxi single is a 12" at 45 rpm with up to 6 tracks.'
          : 'Single and maxi single are available for releases with 6 tracks or fewer.';
        const rows = [el('label', {}, 'Release type', typeSel), el('div', { class: 'note' }, hint)];
        if (mode === 'vinyl' && !work.shaped) {
          const vs = el('select', { onchange: e => { work.disc_size = e.target.value; S.normalizeSides(work, mode); renderTracks(); renderFormat(); renderSlots(); } },
            el('option', { value: '' }, 'Automatic (12", 7" for singles)'), el('option', { value: '10' }, '10" record (33⅓, or 45 for singles)'), el('option', { value: '10s' }, '10" shellac (78 rpm)'));
          vs.value = work.disc_size === '10' || work.disc_size === '10s' ? work.disc_size : '';
          rows.push(el('label', {}, 'Record size', vs), el('div', { class: 'note' }, 'A 10" record plays at 33⅓ (about 15 minutes a side), or at 45 when the release type is a single or maxi single (about 10). A 10" shellac plays at 78 rpm, holds about 4 minutes a side, has a smaller (76 mm) label and comes in a paper sleeve.'));
        }
        if (mode === 'cd') {
          const size = el('select', { onchange: e => { work.disc_size = e.target.value; renderFormat(); } },
            el('option', { value: '' }, 'Automatic'), el('option', { value: '5' }, '5" disc'), el('option', { value: '3', disabled: !info.can3in || S.sideCount(work, 'cd') > 1 }, '3" disc (22 minutes or less, one disc)'));
          size.value = work.disc_size || '';
          rows.push(el('label', {}, 'Disc size', size), el('div', { class: 'note' }, `Total running time: ${S.fmt(info.total)}. A 3" disc holds up to 22 minutes, a 5" disc 80.`));
        }
        // how many records / tapes / discs the release spans, and the playing-time limit that decides the split
        if (mode === 'md') {
          const ds = el('select', { onchange: e => { work.md_disc = e.target.value; renderSlots(); } },
            el('option', { value: 'retail' }, 'Retail disc - black, printed label on the front'), el('option', { value: 'led' }, 'LED printed - the picture covers the whole disc, slider too'), el('option', { value: 'standard' }, 'Standard recordable - clear, with a paper sticker'));
          ds.value = info.disc;
          const cs = el('select', { onchange: e => { work.md_case = e.target.value; renderSlots(); } }, el('option', { value: 'retail' }, 'Retail case (3 1/3 x 4 5/16 in, tray card)'), el('option', { value: 'small' }, 'Slim case (2 13/16 x 3 1/8 in, J-card)'));
          cs.value = info.case;
          rows.push(el('label', {}, 'Disc', ds), el('label', {}, 'Case', cs), el('div', { class: 'note' }, 'The disc label picture fills the label on a retail disc, the sticker on a standard disc, or the whole disc (slider included) on an LED printed disc - see-through parts of an LED picture show the disc spinning inside. Standard discs without a label get the plain sticker with the songs written on it.'));
        }
        if (info.type === 'album' || S.isDisc(mode)) {
          const per = S.isDisc(mode) ? 1 : 2, max = S.isDisc(mode) ? 8 : 4, cur = Math.ceil(S.sideCount(work, mode) / per);
          const noun = S.isDisc(mode) ? S.unitNoun(mode) : mode === 'reel' ? 'reel' : S.isTape(mode) ? 'tape' : 'record';
          const first = S.SIDE_LETTERS;
          const sel = el('select', { onchange: e => { work.sides = +e.target.value * per; renderTracks(); renderFormat(); renderSlots(); } },
            Array.from({ length: max }, (_, i) => i + 1).map(n => el('option', { value: n }, S.isDisc(mode) ? (n === 1 ? `1 ${S.unitNoun(mode)}` : `${n} ${S.unitNoun(mode)}s`) : n === 1 ? `1 ${noun} (sides A, B)` : `${n} ${noun}s (sides A–${first[n * 2 - 1]})`)));
          sel.value = cur;
          const used = Math.max(0, ...work.tracks.map(t => S.SIDE_LETTERS.indexOf((t.side || 'A').toUpperCase()))) + 1;
          const maxUsed = Math.ceil(used / per);
          [...sel.options].forEach(o => { o.disabled = +o.value < maxUsed; });
          const lim = S.sideLimit(work, mode);
          rows.push(el('label', {}, S.isDisc(mode) ? (mode === 'dat' ? 'Tapes in this release' : 'Discs in this release') : mode === 'reel' ? 'Reels in this release' : S.isTape(mode) ? 'Tapes in this release' : 'Records in this release', sel));
          if (mode === 'vinyl') {
            const mins = el('input', { type: 'number', min: 5, max: 60, step: 1, value: work.side_minutes || 25, style: { width: '80px' }, onchange: e => { work.side_minutes = Math.max(5, Math.min(60, +e.target.value || 25)); if (work.side_minutes === 25) work.side_minutes = 0; renderFormat(); renderTracks(); } });
            rows.push(el('label', {}, 'Minutes per side (limit)', mins), el('div', { class: 'note' }, `A side normally holds up to 25 minutes; change it here to override. Long playlists are split into as many sides as the limit needs (now ${lim / 60} min). Every side gets its own label image below; put each track on its side in the Tracks list. While playing, Digi-Deck flips the record, then swaps in the next one.`));
          } else if (mode === 'reel') {
            const rt = el('select', { onchange: e => { work.reel_type = e.target.value; work.side_minutes = work.reel_type === 'retail' ? 32 : 48; renderFormat(); renderTracks(); renderSlots(); } },
              el('option', { value: 'generic' }, 'Generic 7" reel - 1,800 ft, 48 min a side'), el('option', { value: 'retail' }, 'Retail reel - 1,200 ft, 32 min a side'));
            rt.value = S.reelType(work);
            rows.push(el('label', {}, 'Reel', rt), el('div', { class: 'note' }, 'Tape runs at 7½ ips. A generic 7" reel holds 1,800 ft (about 48 minutes a side); a retail reel holds 1,200 ft (about 32). Longer playlists are split across several reels; every side gets its own label image below. The box shows the cover on the front, the spine image on the spine and the back image on the back.'));
          } else if (mode === 'micro') rows.push(el('div', { class: 'note' }, 'A microcassette (MC-60) holds 60 minutes (30 a side). Longer playlists are split across several tapes; every side gets its own label image below. The J-card image is the whole card: back flap, spine, cover - the shelf spine and the cover are cut from it. While playing, Digi-Deck flips the tape, then swaps in the next one.'));
          else if (mode === 'cassette') rows.push(el('div', { class: 'note' }, 'A tape holds 90 minutes (45 a side). Longer playlists are split across several tapes; every side gets its own label image below. While playing, Digi-Deck flips the tape, then swaps in the next one.'));
          else if (mode === 'dat') rows.push(el('div', { class: 'note' }, 'A DAT tape (DT-120) holds 120 minutes and plays in one direction, so there are no sides. Longer playlists, and multi-tape albums, use several tapes; every tape gets its own label image below. Put each track on its tape in the list.'));
          else if (mode === 'md') rows.push(el('div', { class: 'note' }, 'A MiniDisc holds 80 minutes. Longer playlists, and multi-disc albums, use several discs; every disc gets its own label image below.'));
          else rows.push(el('div', { class: 'note' }, 'A CD holds 80 minutes. Longer playlists, and multi-disc albums, use several discs; every disc gets its own label image below. Put each track on its disc in the Tracks list.'));
        }
        if (mode === 'vinyl') {
          const pd = el('input', { type: 'checkbox', onchange: e => { work.picture_disc = e.target.checked; renderFormat(); renderSlots(); } });
          pd.checked = !!work.picture_disc;
          rows.push(el('div', { class: 'sec' }, 'Record colour'), swatches(S.VINYL_COLORS, () => work.color, v => { work.color = v; }),
            el('label', { class: 'chk' }, pd, ' Picture disc (full-disc image with the song grooves drawn on top; choose the images under Artwork)'));
          // multi-colour records
          {
            const cur = S.mixOf(work), style = cur ? cur.style : '';
            const save = m => { work.color_mix = m ? JSON.stringify(m) : ''; renderFormat(); };
            const sel = el('select', { onchange: e => {
              const st = S.MIX_STYLES.find(x => x.id === e.target.value); if (!st) return save(null);
              const cols = (cur ? cur.colors : S.MIX_DEFAULTS).slice(0, st.random ? (cur ? st.max : 3) : st.max); while (cols.length < Math.max(st.min, st.random ? 3 : 0)) cols.push(S.MIX_DEFAULTS[cols.length]);
              save({ style: st.id, colors: cols.slice(0, st.max), seed: (cur && cur.seed) || (1 + Math.floor(Math.random() * 1e9)) });
            } }, el('option', { value: '' }, 'Single colour (above)'), ...S.MIX_STYLES.map(st => el('option', { value: st.id }, st.name + (st.random ? ' (random, 2-5 colours)' : ` (${st.min} colours)`))));
            sel.value = style;
            rows.push(el('label', {}, 'Multi-colour', sel));
            if (cur) {
              const st = S.MIX_STYLES.find(x => x.id === cur.style), list = S.VINYL_COLORS.filter(c => c.hex);
              cur.colors.forEach((hex, i) => rows.push(el('div', { class: 'mix-row' }, el('span', { class: 'mix-n' }, `Colour ${i + 1}`),
                swatches(list, () => (list.find(c => c.hex.toLowerCase() === cur.colors[i].toLowerCase()) || {}).id || cur.colors[i], v => { cur.colors[i] = S.colorOf(list, v).hex; work.color_mix = JSON.stringify(cur); drawMix(); }))));
              const btns = [];
              if (st.random) {
                const cnt = el('select', { onchange: e => { const n = +e.target.value; const c = cur.colors.slice(0, n); while (c.length < n) c.push(S.MIX_DEFAULTS[c.length]); save({ ...cur, colors: c }); } },
                  [2, 3, 4, 5].map(n => el('option', { value: n }, `${n} colours`)));
                cnt.value = cur.colors.length;
                btns.push(cnt, el('button', { type: 'button', onclick: () => { cur.seed = 1 + Math.floor(Math.random() * 1e9); work.color_mix = JSON.stringify(cur); drawMix(); } }, 'New pattern'));
              } else if (cur.style !== 'pinwheel') btns.push(el('button', { type: 'button', onclick: () => { cur.seed = 1 + Math.floor(Math.random() * 1e9); work.color_mix = JSON.stringify(cur); drawMix(); } }, 'Turn the split'));
              else btns.push(el('button', { type: 'button', onclick: () => { cur.seed = 1 + Math.floor(Math.random() * 1e9); work.color_mix = JSON.stringify(cur); drawMix(); } }, 'New pinwheel'));
              const pa = S.newCanvas(220), pb = S.newCanvas(220); pa.className = pb.className = 'mix-pv';
              const drawMix = async () => {
                for (const [cv, side] of [[pa, 'A'], [pb, 'B']]) {
                  const tmp = { ...work, picture_disc: false, tracks: (work.tracks || []).length ? work.tracks : [{ title: 'x', duration: 200, side: 'A' }, { title: 'y', duration: 200, side: 'B' }] };
                  const f = await S.vinylFace(tmp, side), x = cv.getContext('2d'); x.clearRect(0, 0, 220, 220); x.drawImage(f, 0, 0, 220, 220);
                }
              };
              rows.push(el('div', { class: 'mix-tools' }, ...btns), el('div', { class: 'mix-pvs' }, el('div', {}, pa, el('span', {}, 'Side A')), el('div', {}, pb, el('span', {}, 'Side B (the back, mirrored)'))),
                el('div', { class: 'note' }, st.random ? 'Random styles make a new pattern from the colours; "New pattern" makes another. Every record of a multi-record set gets its own.' : 'The colours are pressed in fixed sections; the back of the record shows them mirrored.'));
              drawMix();
            }
          }
          const shp = el('input', { type: 'checkbox', onchange: e => { work.shaped = e.target.checked ? '1' : ''; if (work.shaped) { work.picture_disc = true; if (!work.shape_fit) { work.shape_fit = JSON.stringify({ fit: 'play' }); if (!work.shape_size) work.shape_size = '7'; } } renderFormat(); renderSlots(); } });
          shp.checked = !!work.shaped;
          rows.push(el('label', { class: 'chk' }, shp, ' Shaped record (picture disc cut to the outline of the side pictures - use PNGs with a transparent background)'));
          if (work.shaped) {
            const fit = S.shapeFit(work), setFit = ch => { work.shape_fit = JSON.stringify({ ...S.shapeFit(work), ...ch }); drawFit(); };
            const sz = el('input', { type: 'number', min: 2, max: 14, step: 0.25, value: work.shape_size || 7, style: { width: '6em' }, oninput: e => { work.shape_size = e.target.value; drawFit(); } });
            // preview of side A with the groove circle; nudge it and change its size to match the circle printed on the record
            const pv = S.newCanvas(260, 260); pv.className = 'shape-fit-pv';
            let drawFit = async () => {
              const img = work.pic_a ? await S.loadImage(work.pic_a) : null, x = pv.getContext('2d');
              x.clearRect(0, 0, 260, 260); x.fillStyle = '#1b1f24'; x.fillRect(0, 0, 260, 260);
              if (!img) { x.fillStyle = '#9aa'; x.font = '13px sans-serif'; x.textAlign = 'center'; x.fillText('Choose the Side A picture', 130, 134); return; }
              const C = S.shapeCircle(img, work); if (!C) return;
              const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = 240 / Math.max(W, H), ox = (260 - W * k) / 2, oy = (260 - H * k) / 2;
              pv._map = { k, r0: C.r0, cx: ox + C.c[0] * k, cy: oy + C.c[1] * k, r: C.r * k };
              x.drawImage(img, ox, oy, W * k, H * k);
              x.save(); x.beginPath(); x.rect(0, 0, 260, 260); x.arc(ox + C.c[0] * k, oy + C.c[1] * k, C.r * k, 0, Math.PI * 2, true); x.fillStyle = 'rgba(0,0,0,.35)'; x.fill('evenodd'); x.restore();
              x.strokeStyle = '#4fc3ff'; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.arc(ox + C.c[0] * k, oy + C.c[1] * k, C.r * k, 0, Math.PI * 2); x.stroke();
              x.setLineDash([]); x.fillStyle = '#4fc3ff'; x.beginPath(); x.arc(ox + C.c[0] * k, oy + C.c[1] * k, 3, 0, Math.PI * 2); x.fill();
            };
            const nb = (t, f, title) => el('button', { type: 'button', title, onclick: () => { const c = S.shapeFit(work); setFit(f(c)); } }, t);
            // side B as it will look on the turntable (lined up on A automatically), with A's outline over it to check the match
            const pvB = S.newCanvas(260, 260); pvB.className = 'shape-fit-pv';
            const drawB = async () => {
              const x = pvB.getContext('2d'); x.clearRect(0, 0, 260, 260); x.fillStyle = '#1b1f24'; x.fillRect(0, 0, 260, 260);
              const imgA = work.pic_a ? await S.loadImage(work.pic_a) : null, imgB = work.pic_b ? await S.loadImage(work.pic_b) : null;
              x.fillStyle = '#9aa'; x.font = '13px sans-serif'; x.textAlign = 'center';
              if (!imgA) return; if (!imgB) { x.fillText('No side B picture - the back of side A is shown', 130, 134); return; }
              const shB = await S.shapeFor(work, imgB, true), shA = await S.shapeFor(work, imgA, true); if (!shB || !shA) return;
              S.drawShapeOn(x, 130, shB);
              const t = S.newCanvas(260, 260), tx = t.getContext('2d'); S.drawShapeOn(tx, 130, shA); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = '#4fc3ff'; tx.fillRect(0, 0, 260, 260);
              x.globalAlpha = 0.35; x.drawImage(t, 0, 0); x.globalAlpha = 1;
              x.strokeStyle = '#4fc3ff'; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.arc(130, 130, shB.rIn * 130, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
            };
            const sizeNote = el('div', { class: 'note warn' });
            const checkSize = async () => {                      // the size is the groove circle; say so if the shape then won't fit on the platter
              const img = work.pic_a ? await S.loadImage(work.pic_a) : null; if (!img) { sizeNote.textContent = ''; return; }
              const sh = await S.shapeFor(work, img, false), C = S.shapeCircle(img, work); if (!sh || !C) return;
              const want = parseFloat(work.shape_size) || 7, got = 2 * C.r * sh.sx, wide = Math.max(C.box[2] - C.box[0], C.box[3] - C.box[1]) * sh.sx;
              sizeNote.textContent = got < want - 0.05 ? `At ${want}" across the groove circle this shape would be about ${(wide * want / got).toFixed(1)}" wide - too big for a 12" platter - so it is shown at ${got.toFixed(1)}". Grow the blue circle to match the ring printed on the picture.` : `Groove circle ${want}" · the whole shape is about ${wide.toFixed(1)}" wide.`;
            };
            const drawFit0 = drawFit; drawFit = async () => { await drawFit0(); drawB(); checkSize(); };
            const st = 0.04;
            // drag the circle to move it; scroll (or drag its edge) to make it bigger / smaller
            pv.style.cursor = 'move'; pv.style.touchAction = 'none';
            const toCanvas = ev => { const b = pv.getBoundingClientRect(); return [(ev.clientX - b.left) * 260 / b.width, (ev.clientY - b.top) * 260 / b.height]; };
            pv.addEventListener('pointermove', ev => { const m = pv._map; if (!m || pv._drag) return; const [X, Y] = toCanvas(ev); pv.style.cursor = Math.abs(Math.hypot(X - m.cx, Y - m.cy) - m.r) < 7 ? 'nwse-resize' : 'move'; });
            pv.addEventListener('pointerdown', ev => {
              const m = pv._map; if (!m) return; ev.preventDefault(); pv.setPointerCapture(ev.pointerId);
              const [X0, Y0] = toCanvas(ev), f0 = S.shapeFit(work), edge = Math.abs(Math.hypot(X0 - m.cx, Y0 - m.cy) - m.r) < 7;
              pv._drag = true;
              const mv = e2 => { const [X, Y] = toCanvas(e2);
                if (edge) { const d0 = Math.hypot(X0 - m.cx, Y0 - m.cy) || 1, d = Math.hypot(X - m.cx, Y - m.cy); setFit({ k: S.clamp(f0.k * d / d0, 0.2, 4) }); }
                else setFit({ dx: f0.dx + (X - X0) / (m.k * m.r0), dy: f0.dy + (Y - Y0) / (m.k * m.r0) }); };
              const up = () => { pv._drag = false; pv.removeEventListener('pointermove', mv); pv.removeEventListener('pointerup', up); pv.removeEventListener('pointercancel', up); };
              pv.addEventListener('pointermove', mv); pv.addEventListener('pointerup', up); pv.addEventListener('pointercancel', up);
            });
            pv.addEventListener('wheel', ev => { ev.preventDefault(); const c = S.shapeFit(work); setFit({ k: S.clamp(c.k * (ev.deltaY < 0 ? 1.04 : 1 / 1.04), 0.2, 4) }); }, { passive: false });
            const ctl = el('div', { class: 'shape-fit-ctl' },
              el('div', { class: 'row' }, nb('↑', c => ({ dy: c.dy - st }), 'Move the circle up'), nb('↓', c => ({ dy: c.dy + st }), 'Move the circle down'), nb('←', c => ({ dx: c.dx - st }), 'Move the circle left'), nb('→', c => ({ dx: c.dx + st }), 'Move the circle right')),
              el('div', { class: 'row' }, nb('Smaller', c => ({ k: Math.max(0.2, c.k / 1.06) }), 'Shrink the groove circle'), nb('Bigger', c => ({ k: Math.min(4, c.k * 1.06) }), 'Grow the groove circle - it can go past the edges of the shape (the grooves only show on the record itself)'), nb('Reset', () => ({ dx: 0, dy: 0, k: 1 }), 'Back to the biggest circle that fits')),
              el('div', { class: 'note' }, 'Side B (lined up on side A automatically - the blue shading is side A\'s outline):'), pvB,
              el('div', { class: 'row' }, nb('⟲ 15°', c => ({ bRot: c.bRot - 15 }), 'Turn side B'), nb('⟲ 1°', c => ({ bRot: c.bRot - 1 }), 'Turn side B a little'), nb('⟳ 1°', c => ({ bRot: c.bRot + 1 }), 'Turn side B a little'), nb('⟳ 15°', c => ({ bRot: c.bRot + 15 }), 'Turn side B'),
                nb('Mirror', c => ({ bFlip: !c.bFlip }), 'Flip side B over'), nb('Auto', () => ({ bRot: 0, bFlip: false }), 'Back to the automatic line-up')));
            const spd = el('select', { onchange: e => { work.shape_fit = JSON.stringify({ ...S.shapeFit(work), rpm: +e.target.value }); renderFormat(); } },
              el('option', { value: '0' }, 'Automatic (33⅓ for albums, 45 for singles)'), el('option', { value: String(100 / 3) }, '33⅓ rpm'), el('option', { value: '45' }, '45 rpm'), el('option', { value: '78' }, '78 rpm'));
            spd.value = fit.rpm ? String(fit.rpm) : '0';
            rows.push(el('label', {}, 'Speed', spd));
            rows.push(el('label', {}, 'Playable area (inches across the groove circle)', sz), sizeNote,
              el('div', { class: 'note' }, 'Shaped picture discs are usually listed by their playable area: a "7 inch" shaped disc has a 7" groove circle, and the shape around it is bigger. The grooves are drawn inside the blue circle; the parts of the shape outside it are smooth. Line the circle up with the one printed on the picture, if it has one. Side B is lined up with side A (its outline is A\'s seen from the back); without a side B picture, the back of side A is shown.'),
              el('div', { class: 'shape-fit' }, pv, ctl));
            drawFit();
          }
          if (S.releaseInfo(work, mode).seven && !work.shaped) {
            const sh = el('input', { type: 'checkbox', onchange: e => { work.small_hole = e.target.checked ? '1' : ''; renderSlots(); } });
            sh.checked = !!work.small_hole;
            rows.push(el('label', { class: 'chk' }, sh, ' Small centre hole (7" pressed with an LP-size hole - no 45 adapter)'));
          }
        }
        if (mode === 'dat') rows.push(el('div', { class: 'sec' }, 'Tape colour'), swatches(S.DAT_COLORS, () => work.color || 'black', v => { work.color = v; }),
          el('div', { class: 'note' }, 'DAT tapes come in black or deep blue.'));
        if (mode === 'md') rows.push(el('div', { class: 'sec' }, 'Shell colour'), swatches(S.TAPE_COLORS, () => work.color || 'clear', v => { work.color = v; }),
          el('div', { class: 'note' }, 'The colour of the disc\'s plastic shell. Transparent is the plain clear shell. An LED printed disc is all picture, so it does not use this.'));
        if (S.isTape(mode) && mode !== 'reel') rows.push(el('div', { class: 'sec' }, 'Tape / shell colour'), swatches(S.TAPE_COLORS, () => work.color, v => { work.color = v; }));
        if (mode === 'reel') {
          const full = el('input', { type: 'checkbox', onchange: e => { work.reel_full = e.target.checked ? '1' : ''; renderSlots(); } }); full.checked = !!work.reel_full;
          rows.push(el('div', { class: 'sec' }, 'Reel colour'), swatches(S.TAPE_COLORS, () => work.color, v => { work.color = v; }),
            el('label', { class: 'chk' }, full, ' Full reel label (the label picture is the whole face of the reel, not a sticker - adjust it with the round guide)'));
        }
        fmt.replaceChildren(...rows);
      };

      // ---- release picker
      const refIn = el('input', { placeholder: 'Paste a Discogs / MusicBrainz release URL or ID to use that exact release' });
      const hits = el('div', { class: 'hits' });
      const useTitles = el('input', { type: 'checkbox' });
      const applyRelease = async (source, id) => {
        status.textContent = 'Fetching release…';
        try {
          const r = await window.api.fetchRelease(mode, source, id, work.artist, work.title);
          Object.assign(work, { artist: r.meta.artist || work.artist, title: r.meta.title || work.title, year: r.meta.year || work.year, label: r.meta.label || work.label, catno: r.meta.catno || work.catno, discogs_id: r.meta.discogs_id || work.discogs_id, mbid: r.meta.mbid || work.mbid, is_generic: false });
          if (r.tracklist.length) {
            const tl = r.tracklist;
            work.tracks = await window.api.assignSides(mode, work.tracks, tl);
            if (r.sides && mode !== 'cd') work.sides = Math.max(work.sides | 0, r.sides);
            work.sides = Math.max(work.sides | 0, S.unitLetters(work, mode).length === 1 ? 0 : S.unitLetters(work, mode).length);
            if (useTitles.checked && tl.length === work.tracks.length) work.tracks.forEach((t, i) => { t.title = tl[i].title || t.title; });
          }
          for (const [slot] of S.slotsFor(mode, work)) { const p = r.picks[slot]; if (p && !work[slot]) work[slot] = p.url; }      // fills empty / generic slots; your own images are kept
          
          S.normalizeSides(work, mode);
          candidates = r.candidates; refreshAll();
          status.textContent = `Applied ${source} release ${id}.`;
        } catch (e) { status.textContent = 'Could not fetch that release: ' + e.message; }
      };
      const search = async () => {
        status.textContent = 'Searching…'; hits.replaceChildren();
        try {
          const list = await window.api.searchReleases(work.artist, work.title, mode);
          status.textContent = list.length ? `${list.length} releases found - click one to use it.` : 'No releases found. Try changing the artist/title, or paste an ID.';
          list.forEach(h => hits.append(el('div', { class: 'hit', onclick: () => applyRelease(h.source, h.id) },
            el('span', { class: 'src ' + h.source }, h.source === 'discogs' ? 'Discogs' : 'MusicBrainz'),
            el('div', {}, `${h.artist} – ${h.title}`, el('br'), el('small', {}, [h.year, h.country, h.format, h.label].filter(Boolean).join(' · '))))));
        } catch (e) { status.textContent = 'Search failed: ' + e.message; }
      };
      // typing / pasting an ID (or a release link) into the Discogs or MusicBrainz box looks that release up straight away
      const idLookup = (key, source) => {
        const i = fields[key]; if (!i) return; let last = String(work[key] || '').trim();
        const go = () => {
          const v = i.value.trim(), m = source === 'discogs' ? (v.match(/release\/(\d+)/i) || v.match(/^\[?r?(\d+)\]?$/i)) : v.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (!m || m[1] === last) return; last = m[1]; i.value = m[1]; work[key] = m[1]; applyRelease(source, m[1]);
        };
        i.addEventListener('change', go); i.addEventListener('paste', () => setTimeout(go, 0));
        i.title = 'Type or paste a release ID (or link) - the release is looked up and applied';
      };
      idLookup('discogs_id', 'discogs'); idLookup('mbid', 'musicbrainz');
      const relRow = el('div', { class: 'rel-row' }, refIn,
        el('button', { onclick: async () => { const r = await window.api.parseReleaseRef(refIn.value); if (!r) return (status.textContent = 'That is not a Discogs or MusicBrainz release link / ID.'); applyRelease(r.source, r.id); } }, 'Use this release'),
        el('button', { onclick: search }, 'Search releases'));

      // ---- artwork
      const slotsEl = el('div', { class: 'slots' });
      const urlIn = el('input', { placeholder: 'Image URL…', style: { flex: 1 } });
      const urlSlot = el('select');
      const candEl = el('div', { class: 'cands' });
      const setSlot = (slot, val) => { work[slot] = val; if (slot === 'jcard') work.jcard_adj = ''; if (slot === 'pic_a' && work.shaped) renderFormat(); renderSlots(); };
      const slotAspect = k => mode === 'md' && k === 'front' ? (S.releaseInfo(work, 'md').case === 'small' ? '0.9349' : '0.6888') : k === 'front' || k.startsWith('pic_') ? '1' : (k.startsWith('label_') ? (mode === 'md' ? ({ retail: '1.1752', standard: '0.6834', led: '1.0465' })[S.releaseInfo(work, 'md').disc] : mode === 'cassette' ? '2.1563' : mode === 'dat' ? String(S.DAT_LABEL_ASPECT || 7.95) : mode === 'micro' ? '1.7035' : mode === 'reel' ? (work.reel_full ? '1' : '2.1375') : '1') : (k === 'jcard' && mode === 'micro' ? '1.0151' : k === 'spine' ? '0.103' : 'orig'));
      const guideFor = k => {                         // outline of what is actually visible on the finished label / disc
        if (k.startsWith('label_') || k.startsWith('pic_')) {
          if (mode === 'md') { const d = S.releaseInfo(work, 'md').disc; return { mask: `../../assets/md/guide-label-${d}.png`, boxes: d === 'led' ? [[0.585, 0.336, 1, 0.654, 'slider (moves)']] : null }; }
          if (mode === 'cassette') return { mask: '../../assets/cassette/label-clean.png' };
          if (mode === 'micro') return { mask: '../../assets/labels/micro.png' };
          if (mode === 'dat') return { boxes: [[0, 0, 1, 1, 'label strip (58 mm long)']] };
          if (mode === 'reel') return work.reel_full ? { circle: 0.985, hole: 0.058 } : { mask: '../../assets/labels/reel.png' };
          if (mode === 'cd') { const rad = S.releaseInfo(work, mode).small ? 40 : 60; return { circle: 0.995, hole: 7.5 / rad, hub: 17.5 / rad }; }
          const vi = S.releaseInfo(work, mode), seven = vi.seven, g = S.vinyl.GEO[vi.shaped ? 'lp' : S.vinyl.kindOfInfo(vi)];
          const hole = seven && work.small_hole ? 0.0407 : g.hole;
          if (k.startsWith('pic_') && work.shaped) return null;                     // shaped: the picture's own outline is the record
          if (k.startsWith('pic_')) return { circle: 1, hole };
          return { circle: 1, hole: hole / g.label };
        }
        if (mode === 'cd' && k === 'back') return { tray: 0.0425 };
        if (mode === 'md' && k === 'back') return { tray: 0.0987 };
        return null;
      };
      const renderSlots = () => {
        const slots = S.slotsFor(mode, work);
        urlSlot.replaceChildren(...slots.map(([k, n]) => el('option', { value: k }, n)));
        slotsEl.replaceChildren(...slots.map(([k, name]) => {
          const pv = el('div', { class: 'pv' });
          if (work[k]) {
            const im = el('img', { src: S.fileUrl(work[k]) });
            im.onerror = async () => { try { const p = await window.api.cacheArt(work[k]); work[k] = p; im.onerror = null; im.src = S.fileUrl(p); } catch { pv.textContent = 'could not load'; } };
            pv.append(im);
          } else pv.textContent = k.startsWith('pic_') ? 'no picture' : 'generated automatically';
          return el('div', { class: 'slot' }, el('b', {}, name), pv, el('div', { class: 'sb' },
            el('button', { onclick: async () => { const p = await window.api.pickImage(); if (p) setSlot(k, p); } }, 'Choose…'),
            work[k] ? el('button', { title: k === 'jcard' ? 'Line up the spine and cover used on the shelf (the full J-card image is kept)' : 'Move / zoom / re-crop this image', onclick: async () => {
              if (k === 'jcard') {
                const single = S.releaseInfo(work, mode).type === 'single';
                const r = mode === 'dat' ? { cover: 638 / 860, spine: 121 / 860 } : mode === 'md' ? { cover: 790 / 845, spine: 62 / 845 } : mode === 'micro' ? { cover: 407 / 596, spine: 104 / 596 } : single ? { cover: 2.5625 / 4, spine: 0.125 } : { cover: 2.75 / 4.25, spine: 0.1326 };
                const out = await S.cropImage(work.jcard, { title: 'Adjust shelf spine and cover', params: true, initial: work.jcard_adj ? JSON.parse(work.jcard_adj) : null, guide: { jcard: r } });
                if (out) { work.jcard_adj = (out.z === 1 && !out.ox && !out.oy && !out.rot) ? '' : JSON.stringify(out); S.toast('Shelf spine / cover adjusted - Save to keep it'); }
                return;
              }
              const out = await S.cropImage(work[k], { title: 'Adjust – ' + name, aspect: slotAspect(k), guide: guideFor(k) });
              if (!out) return;
              try { setSlot(k, await window.api.artSaveData(out, k)); S.toast('Adjusted image set - Save to keep it'); } catch (e) { S.toast('Could not save the image: ' + e.message); }
            } }, 'Adjust…') : null,
            work[k] ? el('button', { onclick: () => setSlot(k, '') }, 'Clear') : null));
        }));
        renderCands();
      };
      const findArt = async () => {
        status.textContent = 'Searching art sources…'; candEl.replaceChildren();
        try {
          candidates = await window.api.findArt(work.artist, work.title, work.mbid, mode);
          status.textContent = candidates.length ? `${candidates.length} images found - choose a slot under any image to use it.` : 'No images found online.';
          renderCands();
        } catch (e) { status.textContent = 'Art search failed: ' + e.message; }
      };
      const renderCands = () => {
        const slots = S.slotsFor(mode, work);
        candEl.replaceChildren(...candidates.map(c => {
          const im = el('img', { src: c.thumb || c.url, loading: 'lazy' });
          im.onerror = async () => { im.onerror = null; try { im.src = S.fileUrl(await window.api.cacheArt(c.url)); } catch {} };
          const sel = el('select', { onchange: e => { if (e.target.value) { setSlot(e.target.value, c.url); e.target.value = ''; } } },
            el('option', { value: '' }, 'Use as…'), slots.map(([k, n]) => el('option', { value: k }, n)));
          return el('div', { class: 'cand' }, im, el('small', {}, c.note || c.source), sel);
        }));
      };

      // ---- tracks
      const tbody = el('tbody');
      const capEl = el('div', { class: 'note cap' });
      const renderCap = () => {                      // playing time per side / disc against the limit
        const lim = S.sideLimit(work, mode), tot = {};
        work.tracks.forEach(t => { const k = t.side || 'A'; tot[k] = (tot[k] || 0) + (t.duration || 0); });
        const word = S.isDisc(mode) ? (mode === 'dat' ? 'Tape' : 'Disc') : 'Side';
        capEl.replaceChildren(...Object.keys(tot).sort().map(k => {
          const over = lim && tot[k] > lim + 1;
          return el('span', { class: over ? 'over' : '', style: { marginRight: '14px', color: over ? '#ff9b7a' : '' } }, `${word} ${S.isDisc(mode) ? S.SIDE_LETTERS.indexOf(k) + 1 : k}: ${S.fmt(tot[k])}${over ? ` - over the ${lim / 60} min limit` : ''}`);
        }), lim ? el('span', {}, `(limit ${lim / 60} min per ${S.isDisc(mode) ? S.unitNoun(mode) : 'side'})`) : null);
      };
      const renderTracks = () => {
        const sideOpts = S.unitLetters(work, mode), word = S.isDisc(mode) ? (mode === 'dat' ? 'Tape' : 'Disc') : 'Side';
        tbody.replaceChildren(...work.tracks.map((t, i) => el('tr', {},
          el('td', {}, String(i + 1)),
          el('td', {}, el('input', { value: t.title || '', oninput: e => { t.title = e.target.value; } })),
          el('td', {}, el('input', { value: t.artist || '', oninput: e => { t.artist = e.target.value; } })),
          el('td', {}, (() => { const s = el('select', { onchange: e => { t.side = e.target.value; renderTracks(); } }, sideOpts.map(x => el('option', { value: x }, S.isDisc(mode) ? String(S.SIDE_LETTERS.indexOf(x) + 1) : x))); s.value = t.side || 'A'; return s; })()),
          el('td', {}, S.fmt(t.duration)))));
        renderCap();
      };
      const tbl = el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Title'), el('th', {}, 'Artist'), el('th', {}, S.isDisc(mode) ? (mode === 'dat' ? 'Tape' : 'Disc') : 'Side'), el('th', {}, 'Time'))), tbody);

      const refreshAll = () => { for (const k of Object.keys(fields)) fields[k].value = work[k] || ''; renderFormat(); renderSlots(); renderTracks(); };

      const body = [
        form,
        el('div', { class: 'sec' }, 'Format'), fmt,
        el('div', { class: 'sec' }, 'Release'), relRow, el('label', { class: 'note' }, useTitles, ' also take track titles from the release (only when the track count matches)'), hits,
        el('div', { class: 'sec' }, 'Artwork'), slotsEl,
        el('div', { class: 'rel-row' }, urlIn, urlSlot, el('button', { onclick: () => { if (urlIn.value.trim()) { setSlot(urlSlot.value, urlIn.value.trim()); urlIn.value = ''; } } }, 'Use URL'), el('button', { onclick: findArt }, 'Find art online')),
        candEl,
        el('div', { class: 'sec' }, 'Tracks', el('button', { onclick: async () => { work.tracks = await window.api.assignSides(mode, work.tracks, null, work.sides | 0, work.side_minutes | 0); const n = S.unitLetters(work, mode).length; work.sides = Math.max(work.sides | 0, n); S.normalizeSides(work, mode); renderTracks(); renderFormat(); renderSlots(); } }, mode === 'cd' ? 'Auto-split discs (80 min)' : mode === 'cassette' ? 'Auto-split tapes (90 min)' : 'Auto-split sides by time')),
        tbl, capEl, status
      ];
      const save = el('button', { class: 'primary', onclick: async () => {
        status.textContent = 'Saving…';
        try {
          S.normalizeSides(work, mode);
          const saved = await window.api.librarySave(mode, work);
          S.dropImageCache();
          if (S.app.album && S.app.album.id === saved.id) await S.app.afterEdit(saved);
          dlg.close();
          if (opts.onSaved) opts.onSaved(saved);
          S.toast('Saved');
        } catch (e) { status.textContent = 'Could not save: ' + e.message; }
      } }, 'Save');
      const dlg = S.modal(`Edit info – ${mode==="micro"?"microcassette":mode==="reel"?"reel to reel":mode==="md"?"MiniDisc":mode==="dat"?"DAT":mode}`, body, [el('button', { onclick: () => dlg.close() }, 'Cancel'), save]);
      refreshAll();
    }
  };

  // ---------------------------------------------------------------- settings
  // media library folder: scanned for albums, which are filed in the chosen format libraries with art + info downloaded
  function libSection(s, f) {
    const path = el('input', { value: s.libraryPath || '', placeholder: 'Folder with your music (artist/album folders)', readonly: true, style: { flex: '1' } });
    const pick = el('button', { onclick: async () => { const p = await window.api.pickFolder(); if (p) path.value = p; } }, 'Browse…');
    const none = el('button', { onclick: () => { path.value = ''; } }, 'Remove');
    const fmts = ['vinyl', 'cd', 'cassette', 'micro', 'reel', 'md', 'dat'], have = new Set(s.libraryFormats || fmts);
    const boxes = fmts.map(k => { const cb = el('input', { type: 'checkbox' }); cb.checked = have.has(k); return [k, cb]; });
    const auto = el('input', { type: 'checkbox' }); auto.checked = !!s.libraryAutoScan;
    f._lib = () => ({ libraryPath: path.value, libraryFormats: boxes.filter(([, cb]) => cb.checked).map(([k]) => k), libraryAutoScan: auto.checked });
    return el('div', { class: 'lib-box' },
      el('div', { class: 'lib-title' }, 'Media library folder'),
      el('div', { class: 'note' }, 'The app scans this folder, finds every album and adds it to the libraries below, downloading the artwork and release info for each format (LP art for vinyl, CD art for CD, cassette art for cassette and microcassette). Re-scans only look at new or changed folders.'),
      el('div', { style: { display: 'flex', gap: '6px', margin: '6px 0' } }, path, pick, none),
      el('div', { class: 'lib-fmts' }, el('span', { class: 'note' }, 'Add albums to:'), ...boxes.map(([k, cb]) => el('label', {}, cb, ' ' + (k === 'cd' ? 'CD' : k === 'micro' ? 'Microcassette' : k === 'reel' ? 'Reel to reel' : k === 'md' ? 'MiniDisc' : k === 'dat' ? 'DAT' : k[0].toUpperCase() + k.slice(1))))),
      el('label', { class: 'lib-fmts' }, auto, ' Scan automatically when the app starts'));
  }
  function updSection(s, f) {
    const cb = el('input', { type: 'checkbox' }); cb.checked = s.autoUpdate !== false;
    f._upd = () => ({ autoUpdate: cb.checked });
    return el('div', { class: 'lib-box' }, el('div', { class: 'lib-title' }, 'Updates'),
      el('label', { class: 'lib-fmts' }, cb, ' Check GitHub for new versions and install them automatically'),
      el('div', { class: 'note' }, 'Turn this off to stop all background update checks. You can still use Help > Check for Updates at any time.'));
  }
  function generalSection(s, f) {
    const cb = (checked, text) => { const i = el('input', { type: 'checkbox' }); i.checked = checked; return [i, el('label', { class: 'lib-fmts' }, i, ' ' + text)]; };
    const [fs, fsRow] = cb(!!s.fullscreen, 'Always open in full screen');
    const [sfx, sfxRow] = cb(s.soundFx !== false, 'Sound effects - vinyl needle drop, crackle and lead-out loop; cassette and microcassette tape hiss and tape saturation; reel to reel tape warmth');
    const [pre, preRow] = cb(s.usePrebuilt !== false, 'Use the pre-made microcassette database (artwork for the supplied albums; applied when the microcassette library is opened)');
    const us = el('select', {}, el('option', { value: 'ask' }, 'Ask me'), el('option', { value: 'always' }, 'Always save'), el('option', { value: 'never' }, 'Never save'));
    us.value = s.unidentifiedSave || 'ask';
    const [la, laRow] = cb(s.libraryAnim !== false, 'Library animations - the album comes out of its jacket / case when you press Play, and goes back when you clear the playlist (click to skip one)');
    const th = el('select', { onchange: () => S.app.applyTheme(th.value) }, ...[['metal', 'Original (metal & blue)'], ['cyberpunk', 'Cyberpunk'], ['synthwave', 'Synthwave'], ['vaporwave', 'Vaporwave'], ['eighties', '80s'], ['nineties', '90s'], ['steampunk', 'Steampunk'], ['forest', 'Forest'], ['midnight', 'Midnight'], ['winamp', 'Winamp'], ['xp', 'Windows XP']].map(([v, n]) => el('option', { value: v }, n)));
    th.value = s.theme || 'metal';
    f._gen = () => ({ theme: th.value, fullscreen: fs.checked, soundFx: sfx.checked, libraryAnim: la.checked, unidentifiedSave: us.value, usePrebuilt: pre.checked });
    const bk = el('button', { class: 'btn', onclick: async () => {
      try { const r = await window.api.backupLibraries(); if (r) S.toast(`Backed up ${Object.values(r.players).reduce((a, n) => a + n, 0)} albums and ${r.images} pictures to "${r.dir}"`); } catch (e) { S.toast('Backup failed: ' + (e.message || e)); }
    } }, 'Back up libraries...');
    const rs = el('button', { class: 'btn', onclick: async () => {
      try { const r = await window.api.restoreLibraries(); if (r) S.toast(`Restored ${Object.values(r.players).reduce((a, n) => a + n, 0)} albums - reloading…`); } catch (e) { S.toast('Restore failed: ' + (e.message || e)); }
    } }, 'Restore from backup...');
    return el('div', { class: 'lib-box' }, el('div', { class: 'lib-title' }, 'General'), el('label', { class: 'lib-fmts' }, 'Theme: ', th, el('span', { class: 'note' }, ' (shows straight away; Save to keep it)')), fsRow, sfxRow, laRow, preRow,
      el('div', { class: 'lib-fmts' }, bk, ' ', rs, el('div', { class: 'note' }, 'A backup is a folder with every player\'s library and all of its pictures (covers, labels, J-cards, your adjustments). Restoring replaces your libraries with the backup\'s - your current ones are saved first, so it can be undone. Music files are not copied.')),
      el('label', { class: 'lib-fmts' }, 'Playlists / folders with no album info, when cleared or changed: ', us),
      el('div', { class: 'note' }, 'Sound effects only colour how the music is played back; turn them off for clean audio. Full screen can also be toggled any time with F11.'));
  }
  S.settingsDialog = async () => {
    const s = await window.api.getSettings();
    const f = {};
    const row = (key, label, ph) => el('label', { class: 'note', style: { display: 'flex', flexDirection: 'column', gap: '3px' } }, label, f[key] = el('input', { value: s[key] || '', placeholder: ph || '' }));
    const body = [
      row('discogsToken', 'Discogs personal access token (needed for Discogs search, side splits and Discogs images) - create one at discogs.com/settings/developers'),
      row('fanartKey', 'fanart.tv API key (optional, adds extra covers and disc art)'),
      row('audiodbKey', 'TheAudioDB API key (the free key 123 is the default)', '123'),
      row('contact', 'Contact email or URL sent to MusicBrainz in the User-Agent (they ask for one)'),
      generalSection(s, f),
      libSection(s, f),
      updSection(s, f),
      el('div', { class: 'note' }, 'Without any keys the app still works: MusicBrainz + Cover Art Archive, TheAudioDB, iTunes and Deezer need no signup.')
    ];
    const collect = async () => { const o = {}; for (const k of Object.keys(f)) if (!k.startsWith('_')) o[k] = f[k].value.trim(); Object.assign(o, f._lib(), f._upd(), f._gen()); await window.api.setSettings(o); return o; };
    const dlg = S.modal('Settings', body, [el('button', { onclick: () => dlg.close() }, 'Cancel'),
      el('button', { onclick: async () => { const o = await collect(); dlg.close(); if (!o.libraryPath) return S.toast('Choose a media library folder first'); S.libScan.start(false); } }, 'Save & scan library now'),
      el('button', { class: 'primary', onclick: async () => { await collect(); dlg.close(); S.toast('Settings saved'); } }, 'Save')], { narrow: true });
  };

  // ------------------------------------------------------------- art viewer
  S.artViewer = {
    async open(album) {
      const big = el('div', { class: 'big' });
      const tabs = el('div', { class: 'tabs' });
      const note = el('div', { class: 'note' });
      const mode = S.app.mode;
      const show = async (k, name) => {
        S.$$('button', tabs).forEach(b => b.classList.toggle('on', b.textContent === name));
        const img = k.startsWith('pic_') ? await S.loadImage(album[k]) : await S.art.get(album, k, mode, k.startsWith('label_') ? k.slice(6).toUpperCase() : 'A');
        big.replaceChildren(img ? (img instanceof HTMLImageElement ? el('img', { src: img.src }) : img) : el('div', { class: 'note' }, 'No image set.'));
        note.textContent = album[k] ? '' : 'Nothing saved for this slot - showing generated artwork. Use Edit info to add one.';
      };
      S.slotsFor(mode, album).forEach(([k, n]) => tabs.append(el('button', { onclick: () => show(k, n) }, n)));
      S.modal('Artwork', el('div', { class: 'artview' }, tabs, big, note));
      show('front', 'Front');
    }
  };
})(window.S);
