// Generic labels drawn on the supplied label artwork (assets/labels/*.png, built from the label PSDs).
//   vinyl 12" / 7": printed in OCR-A     CD 5" / 3": written with a Sharpie     cassette: thin marker
// Every text field is a box; the text is shrunk (and finally cut with an ellipsis) so it never leaves its box
// or the printable area of the label.
(function (S) {
  const A = '../../assets/', FONTS = [['OCRA', 'fonts/OCR-A.ttf'], ['Sharpie', 'fonts/PermanentMarker.woff2'], ['ThinMarker', 'fonts/ReenieBeanie.woff2'], ['Desyrel', 'fonts/Desyrel.ttf']];
  S.fontsReady = Promise.all(FONTS.map(async ([name, file]) => {
    try { const f = new FontFace(name, `url(${A}${file})`); await f.load(); document.fonts.add(f); } catch (e) { /* falls back to the CSS stack below */ }
  }));
  const STACK = { OCRA: '"OCRA","OCR A Extended","OCR A Std","Share Tech Mono",monospace', Sharpie: '"Sharpie","Permanent Marker","Marker Felt",cursive', ThinMarker: '"ThinMarker","Reenie Beanie","Bradley Hand",cursive',
    // handwriting for the tape-style formats (cassette, DAT, microcassette, reel to reel, MiniDisc). Segoe Print is a Windows system font
    // (not bundled - it can't be redistributed); Desyrel ships with the app and is the fallback.
    Desyrel: '"Desyrel","Reenie Beanie",cursive', SegoePrint: '"Segoe Print","Bradley Hand ITC","Desyrel","Reenie Beanie",cursive' };

  // Artist for a label: the album artist, or the shared artist of the tracks, or "Various Artists" when there is no single one.
  S.displayArtist = album => {
    const norm = s => String(s || '').trim().toLowerCase();
    const tr = (album.tracks || []).map(t => (t.artist || '').trim()).filter(Boolean);
    const set = new Map(); tr.forEach(a => set.set(norm(a), a));
    const own = (album.artist || '').trim();
    if (own && album.kind !== 'set') return own;
    if (own && set.size <= 1) return own;
    if (set.size === 1) return [...set.values()][0];
    if (set.size > 1) return 'Various Artists';
    return own;
  };

  // ---- layouts, in pixels of each base image. cx/x = anchor, y = vertical middle of the line, w = widest the text may be
  const L = {
    vinyl12: { img: 'vinyl12', font: 'OCRA', ink: '#101010', fields: {
      artist: { x: 446, y: 808, w: 590, size: 39, align: 'left' }, title: { x: 450, y: 874, w: 560, size: 39, align: 'left' }, side: { x: 450, y: 934, w: 520, size: 39, align: 'left' } } },
    vinyl7: { img: 'vinyl7', font: 'OCRA', ink: '#101010', fields: {
      artist: { x: 264, y: 79, w: 330, size: 38, align: 'center' }, side: { x: 264, y: 466, w: 240, size: 50, align: 'center', ink: '#f8f8f8' },
      title: { x: 6, y: 262, w: 156, size: 35, align: 'left', column: true } } },
    cd5: { img: 'cd5', font: 'Sharpie', ink: '#15171c', mark: 'sharpie', fields: {
      artist: { x: 384, y: 581, w: 400, size: 44, align: 'center' }, title: { x: 384, y: 624, w: 420, size: 44, align: 'center' } },
      brand: { text: 'DIGI', font: 'OCRA', x: 384, y: 159, size: 41, ink: '#222' } },
    cd3: { img: 'cd3', font: 'Sharpie', ink: '#15171c', mark: 'sharpie', fields: {
      title: { x: 232, y: 775, w: 556, size: 44, align: 'left' }, artist: { x: 281, y: 822, w: 506, size: 42, align: 'left' } } },
    cassette: { img: 'cassette', font: 'SegoePrint', ink: '#1b2540', mark: 'thin', fields: {
      artist: { x: 720, y: 36, w: 1240, size: 58, align: 'center' }, title: { x: 720, y: 108, w: 1240, size: 70, align: 'center', font: 'Desyrel' } },
      brand: { text: 'digi', font: 'OCRA', x: 716, y: 558, size: 92, ink: '#222', bold: true } },
    // microcassette: artist top left (next to the shell notch), title top right; positions from the supplied generic label PSD (586 x 344)
    // reel to reel: half-disc label sticker (855 x 400): artist on the first writing line, album / playlist on the next two
    reel: { img: 'reel', font: 'SegoePrint', ink: '#1b2540', mark: 'thin', fields: {
      artist: { x: 428, y: 224, w: 640, size: 40, align: 'center' }, title: { x: 428, y: 272, w: 700, size: 40, align: 'center', font: 'Desyrel' }, side: { x: 428, y: 322, w: 520, size: 36, align: 'center' } } },
    micro: { img: 'micro', font: 'SegoePrint', ink: '#14213d', mark: 'thin', fields: {
      artist: { x: 70, y: 40, w: 182, size: 22, align: 'left' }, title: { x: 340, y: 42, w: 218, size: 27, align: 'left', font: 'Desyrel' } } }
  };

  const loadBase = (() => { const c = {}; return key => c[key] || (c[key] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = A + 'labels/' + key + '.png'; })); })();

  // widest line the disc's printed area allows at height y (labels are circles)
  const chordW = (r, y, h) => 2 * Math.sqrt(Math.max(0, r.r * r.r - Math.pow(Math.max(Math.abs(y - h / 2 - r.cy), Math.abs(y + h / 2 - r.cy)), 2))) - r.margin * 2;
  const ROUND = { vinyl12: { r: 553, cy: 601, margin: 36 }, vinyl7: { r: 258, cy: 264, cx: 264, margin: 12 }, cd5: { r: 365, cy: 384, margin: 30 }, cd3: { r: 463, cy: 477, margin: 40 } };

  function fit(x, text, f, font, maxW) {
    let size = f.size;
    const set = s => { x.font = `${f.bold ? '700 ' : ''}${s}px ${STACK[font]}`; };
    set(size);
    while (x.measureText(text).width > maxW && size > f.size * 0.45) { size -= 1; set(size); }
    if (x.measureText(text).width > maxW) {            // still too wide: cut it off with an ellipsis rather than overflow
      let t = text; while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
      text = t.trimEnd() + '…';
    }
    return { text, size };
  }
  // Text column to the left of the 7" hole: every line may only use the part of the label circle that is really there.
  function columnFit(x, text, f, font, round) {
    const hole = 104, gap = 10, right = f.x + f.w;
    const span = yy => { const dy = yy - round.cy, edge = round.cx - Math.sqrt(Math.max(0, round.r * round.r - dy * dy)) + round.margin;
      const stop = Math.abs(dy) < hole ? round.cx - Math.sqrt(hole * hole - dy * dy) - gap : right; return [Math.max(edge, 4), Math.min(stop, right)]; };
    for (let size = f.size; size >= 11; size -= 1) {
      x.font = `${size}px ${STACK[font]}`;
      const lh = size * 1.12;
      for (let n = 1; n <= 9; n++) {
        const ys = Array.from({ length: n }, (_, i) => f.y + (i - (n - 1) / 2) * lh);
        const widths = ys.map(yy => { const [l, r] = span(yy - lh / 2), [l2, r2] = span(yy + lh / 2); return Math.max(0, Math.min(r, r2) - Math.max(l, l2)); });
        const xs = ys.map(yy => Math.max(span(yy - lh / 2)[0], span(yy + lh / 2)[0]));
        const lines = []; let words = String(text).split(/\s+/), i = 0, ok = true;
        while (words.length && ok) {
          if (i >= n) { ok = false; break; }
          let w = words.shift(), line = '';
          while (w !== undefined) {
            const t = line ? line + ' ' + w : w;
            if (x.measureText(t).width <= widths[i]) { line = t; w = words.shift(); continue; }
            if (!line) { let k = w.length; while (k > 1 && x.measureText(w.slice(0, k)).width > widths[i]) k--; if (widths[i] < size * 0.5) { ok = false; break; } line = w.slice(0, k); w = w.slice(k) || words.shift(); }
            break;
          }
          if (!ok) break;
          if (w !== undefined && line) words.unshift(w);
          lines.push(line); i++;
        }
        if (ok && !words.length && lines.length === n) return { lines, size, ys, xs };
      }
    }
    return { lines: [String(text).slice(0, 6) + '…'], size: 11, ys: [f.y], xs: [round.margin + 10] };
  }

  // marker-pen look: slightly uneven baseline, thickened strokes, ink that is a touch darker where it overlaps
  function pen(x, text, px, py, size, f, kind, ink, align) {
    x.save(); x.textAlign = align; x.textBaseline = 'alphabetic';
    const rot = (kind === 'sharpie' ? -0.012 : -0.006) + (S.hash(text) % 7 - 3) * 0.0018;
    x.translate(px, py); x.rotate(rot);
    x.fillStyle = ink; x.strokeStyle = ink; x.lineJoin = 'round'; x.lineCap = 'round';
    x.lineWidth = kind === 'sharpie' ? Math.max(1.4, size * 0.05) : Math.max(0.9, size * 0.028);
    x.globalAlpha = kind === 'sharpie' ? 0.94 : 0.9;
    x.shadowColor = ink; x.shadowBlur = kind === 'sharpie' ? size * 0.04 : size * 0.02;
    x.strokeText(text, 0, 0); x.fillText(text, 0, 0);
    x.globalAlpha = 0.28; x.translate(kind === 'sharpie' ? 0.9 : 0.5, 0.4); x.fillText(text, 0, 0);    // second pass: ink pooling
    x.restore();
  }

  async function render(key, info) {
    await S.fontsReady;
    const lay = L[key], base = await loadBase(lay.img);
    const w = base ? base.width : 600, h = base ? base.height : 600;
    const cv = S.newCanvas(w, h), x = cv.getContext('2d');
    if (base) x.drawImage(base, 0, 0);
    const round = ROUND[key];
    const vals = { artist: info.artist || '', title: info.title || 'Untitled', side: info.sideText || '' };
    for (const [name, f0] of Object.entries(lay.fields)) {
      const f = { ...f0 }, text = vals[name];
      if (!text) continue;
      const font = f.font || lay.font, ink = f.ink || lay.ink;
      let maxW = f.w; if (round) maxW = Math.min(maxW, chordW(round, f.y, f.size));
      if (f.column) {                                   // multi-line column (7" label)
        const { lines, size, ys, xs } = columnFit(x, text, f, font, round);
        x.font = `${size}px ${STACK[font]}`; x.fillStyle = ink; x.textBaseline = 'middle'; x.textAlign = 'left';
        lines.forEach((l, i) => x.fillText(l, xs[i], ys[i]));
        continue;
      }
      const r = fit(x, text, f, font, maxW);
      x.fillStyle = ink;
      if (lay.mark) { x.font = `${r.size}px ${STACK[font]}`; pen(x, r.text, f.x, f.y + r.size * 0.33, r.size, f, lay.mark, ink, f.align); }
      else { x.textAlign = f.align; x.textBaseline = 'middle'; x.fillText(r.text, f.x, f.y); }
    }
    if (lay.brand) { const b = lay.brand; x.font = `${b.bold ? '700 ' : ''}${b.size}px ${STACK[b.font]}`; x.fillStyle = b.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.text, b.x, b.y); }
    return cv;
  }

  // mode + release info -> label canvas
  S.labelArt = (mode, info) => {
    const i = { title: info.title, artist: info.artist, side: info.side || 'A' };
    if (mode === 'vinyl') { const key = info.seven ? 'vinyl7' : 'vinyl12'; i.sideText = info.seven ? 'SIDE ' + i.side : i.side; return render(key, i); }
    if (mode === 'cd') return render(info.small ? 'cd3' : 'cd5', i);
    if (mode === 'micro') return render('micro', i);
    if (mode === 'reel') { i.sideText = 'Side ' + i.side; return render('reel', i); }
    return render('cassette', i);
  };

  // ---- microcassette J-card (generic, no cover art): back flap | spine | cover, laid out like the supplied generic J-card PSD (605 x 596) ----
  S.MICRO_JCARD = { W: 605, H: 596, flap: [0, 91], spine: [93, 197], cover: [198, 605] };
  S.microJcard = async album => {
    await S.fontsReady;
    const J = S.MICRO_JCARD, k = 2, cv = S.newCanvas(J.W * k, J.H * k), x = cv.getContext('2d');
    const base = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = A + 'micro/jcard.png'; });
    if (base) x.drawImage(base, 0, 0, cv.width, cv.height); else { x.fillStyle = '#b0d0e0'; x.fillRect(0, 0, cv.width, cv.height); }
    x.scale(k, k);
    const title = album.title || album.name || 'Untitled', artist = S.displayArtist(album) || '';
    const fitText = (text, max, size) => { let s = size; x.font = `${s}px ${STACK.OCRA}`; while (x.measureText(text).width > max && s > 11) { s -= 1; x.font = `${s}px ${STACK.OCRA}`; } return text; };
    // spine: reads top to bottom, album on the left line, artist on the right
    const spineText = (text, cx, size, ink) => { x.save(); x.translate(cx, 300); x.rotate(Math.PI / 2); x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(text, 440, size); x.fillText(text, 0, 0); x.restore(); };
    spineText(title, 127, 30, '#101010'); if (artist) spineText(artist, 168, 26, '#303030');
    // cover: artist over album, white with a dark edge so it reads on both blues
    const coverText = (text, y, size) => { x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(text, 330, size); x.lineJoin = 'round'; x.lineWidth = 5; x.strokeStyle = '#0b3f63'; x.strokeText(text, 428, y); x.fillStyle = '#fff'; x.fillText(text, 428, y); x.restore(); };
    if (artist) coverText(artist, 150, 33); coverText(title, 194, 30);
    return cv;
  };
})(window.S);
