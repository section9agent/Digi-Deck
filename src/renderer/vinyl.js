// Turntable stage (direct-drive deck look): per-song groove bands, 33 1/3 / 45 rpm platter, S-shaped tonearm that tracks the
// real position and can be dragged to pick a song / position, coloured + picture-disc records, 7" and 12" records, side flip.
(function (S) {
  // geometry as fractions of record radius
  const GEO = {
    lp: { musicOut: 0.96, musicIn: 0.375, label: 0.333, hole: 0.0238, gap: 0.0065 },
    seven: { musicOut: 0.95, musicIn: 0.60, label: 0.54, hole: 0.2143, gap: 0.009 },
    // 10" (radius 127 mm): about a 90 mm label; a shellac 78 has a 76 mm label and its grooves run closer to it. 7.24 mm hole
    ten: { musicOut: 0.955, musicIn: 0.42, label: 0.354, hole: 0.0285, gap: 0.0075 },
    shellac: { musicOut: 0.94, musicIn: 0.36, label: 0.299, hole: 0.0285, gap: 0.009 }
  };
  const EDGES = { lp: { rim: 0.994, land: 0.9915, lead: 0.989 }, seven: { rim: 0.972, land: 0.967, lead: 0.962 }, ten: { rim: 0.99, land: 0.987, lead: 0.983 }, shellac: { rim: 0.982, land: 0.976, lead: 0.97 } };
  // which record: lp | ten | shellac | seven, from releaseInfo
  const kindOfInfo = i => i.seven ? 'seven' : i.shellac ? 'shellac' : i.inch === 10 ? 'ten' : 'lp';
  const scaleOf = i => (i.seven ? 7 : i.inch === 10 ? 10 : 12) / 12;
  const canvasOf = i => i.seven ? 700 : i.inch === 10 ? 860 : 1000;
  const REC = 0.99;                                // 12" record radius in platter-radius units
  const ARM = { px: 1.36, py: -0.55, L: 1.42 };     // arm pivot + effective length, in platter radii from the platter centre
  const REST_R = 1.14;
  // the needle crosses the lead-in during the last 70% of the 5.6 s drop recording (3.9 s, less a little for the platter getting up to speed)
  const leadTurns = rpm => rpm / 60 * 3.895;
  // and the lead-out during the first ~2.6 s of the 3 s run-out
  const RUN_TOTAL = 6, RUN_SEC = 5.3, runTurns = rpm => rpm / 60 * RUN_SEC;   // lead-out: 6 s; the needle crosses it in the first 5.3 s (about 3 turns on a 12", 4 on a 7")

  function armAngle(r) {
    const d = Math.hypot(ARM.px, ARM.py);
    const a = (r * r - ARM.L * ARM.L + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r * r - a * a));
    const ux = ARM.px / d, uy = ARM.py / d, vx = -uy, vy = ux;
    const nx = a * ux + h * vx, ny = a * uy + h * vy;
    return Math.atan2(ny - ARM.py, nx - ARM.px) * 180 / Math.PI;
  }
  const noise = i => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

  // One groove band per song, width proportional to its running time. Bands start at the outer edge.
  // capacity (seconds) is what the whole side could hold; a side that is shorter leaves the inner part smooth (7" singles).
  function computeBands(tracks, g, capacity) {
    const n = tracks.length; if (!n) return [];
    const total = tracks.reduce((a, t) => a + (t.duration || 0), 0);
    const span = g.musicOut - g.musicIn, usable = span - (n - 1) * g.gap;
    const cap = Math.max(capacity || 0, total);
    let cursor = g.musicOut;
    return tracks.map((t, k) => {
      const w = total > 0 ? usable * ((t.duration || 0) / cap) : usable / n;
      const b = { i: t.i, outer: cursor, inner: cursor - w };
      cursor = b.inner - (k < n - 1 ? g.gap : 0);
      return b;
    });
  }

  // the yellow 45 rpm adapter ("spider"), cut out of the reference photo (assets/adapter.png)
  const ADAPTER = new Image();
  S.adapterReady = new Promise(res => { ADAPTER.onload = ADAPTER.onerror = () => res(); ADAPTER.src = '../../assets/adapter.png'; });
  function drawAdapter(x, cx, cy, r) {
    if (!ADAPTER.naturalWidth) return;
    const d = r * 2 * 1.04;
    x.save(); x.translate(cx, cy); x.rotate(-0.35);
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = r * 0.12; x.shadowOffsetY = r * 0.04;
    x.drawImage(ADAPTER, -d / 2, -d / 2, d, d);
    x.restore();
  }

  // ---- shaped records ------------------------------------------------------------------------------------------------------
  // The side A / B pictures are PNGs; their outline is the record. The grooves are round, so they fill the biggest circle that fits
  // in the outline; the hole goes at its centre. Side B is the other face, so its outline is A's mirrored; both are lined up by
  // fitting B's outline box onto A's. Physical size: shape_size inches across the widest way (default 10).
  const shapeCache = new Map();
  function outline(img) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, 220 / Math.max(W, H)), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
    const c = S.newCanvas(w, h), x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const a = x.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0; i < w * h; i++) if (a[i * 4 + 3] > 128) { m[i] = 1; const X = i % w, Y = (i / w) | 0; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
    if (x1 < 0) return null;
    // distance to the nearest transparent pixel (chamfer), so the centre of the biggest inscribed circle can be found
    const INF = 1e9, d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = m[i] ? INF : 0;
    const at = (X, Y) => (X < 0 || Y < 0 || X >= w || Y >= h) ? 0 : d[Y * w + X];
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const i = Y * w + X; if (!d[i]) continue; d[i] = Math.min(d[i], at(X - 1, Y) + 1, at(X, Y - 1) + 1, at(X - 1, Y - 1) + 1.414, at(X + 1, Y - 1) + 1.414); }
    for (let Y = h - 1; Y >= 0; Y--) for (let X = w - 1; X >= 0; X--) { const i = Y * w + X; if (!d[i]) continue; d[i] = Math.min(d[i], at(X + 1, Y) + 1, at(X, Y + 1) + 1, at(X + 1, Y + 1) + 1.414, at(X - 1, Y + 1) + 1.414); }
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, diag = Math.hypot(x1 - x0, y1 - y0);
    let best = -1, cx = bx, cy = by, r = 0;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const v = d[Y * w + X]; if (!v) continue; const sc = v - 0.06 * Math.hypot(X - bx, Y - by) * (v / diag); if (sc > best) { best = sc; cx = X; cy = Y; r = v; } }
    let far = 0; for (let i = 0; i < w * h; i++) if (m[i]) far = Math.max(far, Math.hypot(i % w - cx, ((i / w) | 0) - cy));
    return { k, w, h, m, box: [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k], c: [cx / k, cy / k], r: (r - 0.5) / k, far: (far + 1) / k };
  }
  // Side B lined up on side A. The B picture is the record's other face, so its outline is A's outline mirrored - but it may be
  // photographed turned, at another size or off-centre. Find the mirror + rotation + scale + shift that lays B's outline on A's
  // (best overlap of the two silhouettes), so the grooves, hole and edges match on both sides.
  function alignB(A, B) {
    const pts = (O, step) => { const P = []; let sx = 0, sy = 0; for (let y = 0; y < O.h; y += step) for (let x = 0; x < O.w; x += step) if (O.m[y * O.w + x]) { P.push(x, y); sx += x; sy += y; } const n = P.length / 2; return { P, n, cx: sx / n, cy: sy / n }; };
    const a = pts(A, 1), b = pts(B, 2);
    if (!a.n || !b.n) return null;
    const sc = Math.sqrt(a.n / (b.n * 4)) ;                                  // B mask pixels -> A mask pixels (b sampled every 2nd pixel)
    const score = (flip, th) => {
      const c = Math.cos(th), s2 = Math.sin(th); let hit = 0;
      for (let i = 0; i < b.P.length; i += 2) {
        let dx = (b.P[i] - b.cx) * sc, dy = (b.P[i + 1] - b.cy) * sc; if (flip) dx = -dx;
        const X = Math.round(a.cx + dx * c - dy * s2), Y = Math.round(a.cy + dx * s2 + dy * c);
        if (X >= 0 && Y >= 0 && X < A.w && Y < A.h && A.m[Y * A.w + X]) hit++;
      }
      return hit / b.n;                                                       // share of B landing inside A
    };
    let best = { s: -1 };
    for (const flip of [true, false]) for (let d = 0; d < 360; d += 3) { const v = score(flip, d * Math.PI / 180); if (v > best.s) best = { s: v, flip, d }; }
    for (let d = best.d - 3; d <= best.d + 3; d += 0.5) { const v = score(best.flip, d * Math.PI / 180); if (v > best.s) best = { ...best, s: v, d }; }
    // back to full-size picture pixels
    return { flip: best.flip, rot: best.d, scale: sc * B.k / A.k, cA: [a.cx / A.k, a.cy / A.k], cB: [b.cx / B.k, b.cy / B.k], score: best.s };
  }

  // the shape's outline and its groove circle: the biggest circle that fits, moved / shrunk by the user's adjustment (shape_fit)
  function shapeCircle(img, album) {
    const key = album.pic_a || img.src || '';
    let O = shapeCache.get(key); if (!O) { O = outline(img); if (!O) return null; shapeCache.set(key, O); }
    const f = S.shapeFit(album), cx = O.c[0] + f.dx * O.r, cy = O.c[1] + f.dy * O.r, r = O.r * f.k;
    let far = 0; for (const [X, Y] of [[O.box[0], O.box[1]], [O.box[2], O.box[1]], [O.box[0], O.box[3]], [O.box[2], O.box[3]]]) far = Math.max(far, Math.hypot(X - cx, Y - cy));
    return { ...O, c: [cx, cy], r, far: Math.min(far, O.far + Math.hypot(cx - O.c[0], cy - O.c[1])), r0: O.r, c0: O.c };
  }
  // where to draw a side's picture on a 12"-frame canvas (R = 6 in), and the grooved radius as a fraction of R
  async function shapeFor(album, sideImg, isB) {
    const a = await S.loadImage(album.pic_a) || sideImg; if (!a) return null;
    const A = shapeCircle(a, album); if (!A) return null;
    const fit = S.shapeFit(album), bw = A.box[2] - A.box[0], bh = A.box[3] - A.box[1];
    const inches = S.clamp(parseFloat(album.shape_size) || (fit.fit === 'play' ? 7 : 10), 2, 14);
    // inches per picture pixel: "playable area" sizes the groove circle (how shaped discs are usually listed - a 7" shaped
    // picture disc has a 7" grooved circle), "whole shape" sizes the shape's widest dimension
    let ipp = fit.fit === 'play' ? inches / (2 * A.r) : inches / Math.max(bw, bh);
    ipp = Math.min(ipp, 5.95 / A.far);                                     // the whole shape has to fit on a 12" platter
    const rIn = S.clamp(A.r * ipp / 6, 0.15, 0.99);
    if (!isB || !sideImg || sideImg === a) {
      if (isB) return { img: a, sx: -ipp, sy: ipp, cx: A.c[0], cy: A.c[1], rIn };              // no B picture: A's, seen from behind
      return { img: a, sx: ipp, sy: ipp, cx: A.c[0], cy: A.c[1], rIn };
    }
    const kB = `${album['pic_b']}|b`; let B = shapeCache.get(kB); if (!B) { B = outline(sideImg) || A; shapeCache.set(kB, B); }
    const kAl = `${album.pic_a}|${album.pic_b}|align`; let al = shapeCache.get(kAl); if (al === undefined) { al = alignB(shapeCache.get(album.pic_a || a.src) || A, B); shapeCache.set(kAl, al); }
    if (!al) {                                                             // (no outline found: fall back to lining up the boxes)
      const fx = (A.c[0] - A.box[0]) / bw, fy = (A.c[1] - A.box[1]) / bh, Bw = B.box[2] - B.box[0], Bh = B.box[3] - B.box[1];
      return { img: sideImg, sx: ipp * bw / Bw, sy: ipp * bh / Bh, cx: B.box[0] + (1 - fx) * Bw, cy: B.box[1] + fy * Bh, rIn };
    }
    // B picture pixel -> A picture pixel (outlines on top of each other), then the user's own nudges (fit.bRot / fit.bFlip, about
    // the hole), then into the B-side view: A's frame mirrored, centred on the hole, in inches
    const toA = new DOMMatrix().translate(al.cA[0], al.cA[1]).rotate(al.rot).scale(al.flip ? -al.scale : al.scale, al.scale).translate(-al.cB[0], -al.cB[1]);
    const nudge = new DOMMatrix().translate(A.c[0], A.c[1]).rotate(fit.bRot || 0).scale(fit.bFlip ? -1 : 1, 1).translate(-A.c[0], -A.c[1]);
    const m = new DOMMatrix().scale(-ipp, ipp).translate(-A.c[0], -A.c[1]).multiply(nudge).multiply(toA);
    return { img: sideImg, m, rIn };
  }
  function drawShape(x, R, sh, alphaOnly) {                // picture placed with its hole point at the canvas centre
    const s = R / 6, w = (sh.img.naturalWidth || sh.img.width), h = (sh.img.naturalHeight || sh.img.height);
    if (sh.m) { x.save(); x.translate(R, R); x.scale(s, s); x.transform(sh.m.a, sh.m.b, sh.m.c, sh.m.d, sh.m.e, sh.m.f); x.drawImage(sh.img, 0, 0, w, h); x.restore(); return; }
    x.save(); x.translate(R, R); x.scale(sh.sx < 0 ? -1 : 1, 1);
    x.drawImage(sh.img, -sh.cx * Math.abs(sh.sx) * s, -sh.cy * sh.sy * s, w * Math.abs(sh.sx) * s, h * sh.sy * s);
    x.restore();
  }

  // Draw one record face. o: {seven, tracks, labelImg, color, pic, capacity, shape}
  function drawRecord(size, o) {
    const sh = o.shape;
    const kind = o.kind || (o.seven ? 'seven' : 'lp'), rpm = o.rpm || (o.seven ? 45 : 100 / 3);
    const g = sh ? { musicOut: sh.rIn * 0.955, musicIn: Math.min(0.375, sh.rIn * 0.955 - 0.08), label: Math.min(0.333, sh.rIn * 0.955 - 0.12), hole: 0.0238, gap: 0.0065 } : GEO[kind], color = o.color;
    const c = S.newCanvas(size), x = c.getContext('2d'), R = size / 2, px = R / 100;
    const disc = r => { x.beginPath(); x.arc(R, R, r * R, 0, Math.PI * 2); };
    const mix = !o.pic && o.mix, clear = color.id === 'clear' && !o.pic && !mix, pic = !!o.pic;
    const light = !clear && !pic && (mix ? S.mixLuma(mix) > 0.55 : color.hex && S.luma(color.hex) > 0.55);
    const darkMul = pic ? 1.1 : clear ? 1.2 : light ? 1.0 : 2, lightMul = pic ? 0.7 : light ? 0.5 : 1;
    x.save(); if (!sh) { disc(1); x.clip(); }
    if (sh) { x.globalAlpha = 1; drawShape(x, R, sh); }
    else if (pic) S.drawCover(x, o.pic, 0, 0, size, size);
    else if (mix) x.drawImage(S.mixCanvas(mix, size, o.mirror, g.label), 0, 0, size, size);
    else if (clear) { x.fillStyle = 'rgba(176,196,212,.20)'; x.fillRect(0, 0, size, size); }
    else {
      x.fillStyle = color.hex; x.fillRect(0, 0, size, size);
      if (color.metal && x.createConicGradient) {          // metallic sheen: bright and dark wedges sweeping round the record
        const cg = x.createConicGradient(0.5, size / 2, size / 2), hi = 'rgba(255,255,255,.34)', lo = 'rgba(0,0,0,.28)';
        [0, .125, .25, .375, .5, .625, .75, .875, 1].forEach((p, i) => cg.addColorStop(p, i % 2 ? lo : hi));
        x.fillStyle = cg; x.fillRect(0, 0, size, size);
      }
    }
    x.restore();
    if (!sh) { disc(0.985); x.strokeStyle = light ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.07)'; x.lineWidth = px * 0.8; x.stroke(); }

    const tracks = o.tracks, bands = computeBands(tracks, g, o.capacity);
    const landColor = mix ? (light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.09)') : pic ? 'rgba(255,255,255,.35)' : clear ? 'rgba(255,255,255,.4)' : light ? S.shade(color.hex, -0.25) : S.shade(color.hex === '#0d0d0d' ? '#1d1d1d' : color.hex, 0.07);
    const step = Math.max(1.1, px * 0.55), TAU = Math.PI * 2;
    const seed = (tracks[0] ? (tracks[0].title || '').length * 131 + (tracks[0].i || 0) * 17 : 7) + tracks.length * 911;
    const ring = (r, style, w) => { x.strokeStyle = style; x.lineWidth = w; x.beginPath(); x.arc(R, R, r, 0, TAU); x.stroke(); };
    // a true spiral (the lead-in, the run between songs and the lead-out are wide enough to see the groove spiral). The record turns
    // clockwise under a needle that stays put, so going inward the groove runs anticlockwise across the record
    const spiral = (r0, r1, turns, style, w, a0 = 0) => {
      const n = Math.max(60, Math.ceil(turns * 240)); x.strokeStyle = style; x.lineWidth = w; x.beginPath();
      for (let i = 0; i <= n; i++) { const t = i / n, r = r0 + (r1 - r0) * t, a = a0 - t * turns * TAU; i ? x.lineTo(R + r * Math.cos(a), R + r * Math.sin(a)) : x.moveTo(R + r * Math.cos(a), R + r * Math.sin(a)); }
      x.stroke();
    };
    const grooveLine = (r0, r1, turns, a0, k = 1) => {      // one groove seen at an angle: a dark wall and a thin bright edge beside it
      spiral(r0, r1, turns, `rgba(0,0,0,${0.32 * k * darkMul})`, Math.max(1, px * 0.4), a0);
      spiral(r0 - px * 0.35, r1 - px * 0.35, turns, `rgba(255,255,255,${0.11 * k * lightMul})`, Math.max(0.6, px * 0.22), a0);
    };
    // the raised bead round the edge: smooth and glossy, rounded over
    const EDGE = sh ? { rim: sh.rIn, land: sh.rIn - 0.0035, lead: sh.rIn - 0.0065 } : EDGES[kind];   // 12": from the layout PSD (lead-in at 99.4% of the radius, first song at 96%)
    if (sh) { ring(EDGE.rim * R, `rgba(255,255,255,${0.16 * lightMul})`, px * 0.5); ring(EDGE.rim * R + px * 0.5, `rgba(0,0,0,${0.22 * darkMul})`, px * 0.4); }    // where the grooved circle ends
    else { const rim = EDGE.rim * R, gr = x.createRadialGradient(R, R, rim, R, R, R);
      gr.addColorStop(0, `rgba(0,0,0,${0.18 * darkMul})`); gr.addColorStop(0.35, `rgba(255,255,255,${0.10 * lightMul})`); gr.addColorStop(0.7, `rgba(0,0,0,${0.06 * darkMul})`); gr.addColorStop(1, `rgba(0,0,0,${0.25 * darkMul})`);
      x.fillStyle = gr; x.beginPath(); x.arc(R, R, R, 0, TAU); x.arc(R, R, rim, 0, TAU, true); x.fill(); }
    // lead-in: a smooth landing band inside the bead, then the groove starts and spirals in quickly (about 2 turns) to the first song
    const leadTop = EDGE.lead * R, music0 = (bands.length ? bands[0].outer : g.musicOut) * R;
    ring(EDGE.land * R, landColor, px * 0.9);
    const LT = leadTurns(rpm), lead = { r0: leadTop / R, r1: (music0 + px * 0.6) / R, turns: LT, a0: seed % 6 };
    grooveLine(leadTop, music0 + px * 0.6, LT, seed % 6);   // as many turns as the record makes while the needle crosses it
    // music: fine grooves; their spacing and sheen follow the loudness (loud passages are cut wider and catch more light), so each
    // song shows the faint light and dark rings real records have; the songs are separated by a glossy band the groove crosses in one turn
    bands.forEach((b, k) => {
      const o0 = b.outer * R, i0 = b.inner * R, span = Math.max(1, o0 - i0), ks = seed + k * 977;
      const env = t => { const fade = Math.min(1, t * 12, (1 - t) * 18); let v = 0; for (let h = 1; h <= 3; h++) v += Math.sin(t * (2 + h * 2.3) + noise(ks + h) * 6.28) / h; return S.clamp(0.58 + 0.16 * v - 0.3 * (1 - fade), 0, 1); };
      // one ring per pixel: the tone follows the loudness, with fine random grain (no regular spacing, so no moire rings)
      for (let rr = o0, n = 0; rr > i0; rr -= 1, n++) {
        const t = (o0 - rr) / span, e = env(t), j = noise(n * 1.7 + ks);
        ring(rr, `rgba(0,0,0,${(0.08 + 0.07 * (1 - e) + j * 0.04) * darkMul})`, 1);
        if (j > 0.45) ring(rr, `rgba(255,255,255,${(0.015 + 0.06 * e) * (j - 0.3) * 1.6 * lightMul})`, 0.6);
      }
      if (k < bands.length - 1) {          // the band between songs: smooth, glossy, with the groove running across it
        const gOut = b.inner * R, gIn = bands[k + 1].outer * R, gm = (gOut + gIn) / 2;
        ring(gm, landColor, Math.max(1, (gOut - gIn) * 0.95));
        ring(gm, `rgba(255,255,255,${0.08 * lightMul})`, Math.max(0.7, (gOut - gIn) * 0.25));
        grooveLine(gOut, gIn, 1, (seed + k) % 6, 0.55);
      }
    });
    // lead-out: after the last song the groove spirals inward with ever wider turns across the run-out area to the locked groove
    const lastIn = bands.length ? bands[bands.length - 1].inner : g.musicOut;
    const leadEnd = g.label + 0.022;
    let run = null;
    { const r0 = lastIn * R, r1 = leadEnd * R, dist = Math.max(2, r0 - r1);
      // glossy run-out surface first, then the spiral drawn on it
      const mid = (r0 + r1) / 2; ring(mid, landColor, dist * 0.92); ring(mid, 'rgba(255,255,255,.035)', dist * 0.5);
      const turns = runTurns(rpm), n = Math.ceil(turns * 300), a0 = (seed * 0.37) % TAU;
      run = { r0: r0 / R, r1: r1 / R, turns, a0 };
      const pathR = t => r0 - dist * (1 - Math.pow(1 - t, 0.55));              // starts wide and gets wider as it goes in
      for (const [off, style, w] of [[0, `rgba(0,0,0,${0.34 * darkMul})`, Math.max(1, px * 0.45)], [-px * 0.35, `rgba(255,255,255,${0.12 * lightMul})`, Math.max(0.6, px * 0.22)]]) {
        x.strokeStyle = style; x.lineWidth = w; x.beginPath();
        for (let i = 0; i <= n; i++) { const t = i / n, r = pathR(t) + off, a = a0 - t * turns * TAU; i ? x.lineTo(R + r * Math.cos(a), R + r * Math.sin(a)) : x.moveTo(R + r * Math.cos(a), R + r * Math.sin(a)); }
        x.stroke();
      }
    }
    // the locked groove: one closed circle the needle stays in
    ring(leadEnd * R - px * 0.2, `rgba(0,0,0,${0.45 * darkMul})`, Math.max(1, px * 0.5));
    ring(leadEnd * R - px * 0.6, `rgba(255,255,255,${0.14 * lightMul})`, Math.max(0.6, px * 0.25));
    // dead wax: smooth, with the hand-etched matrix number and a raised ring guarding the label
    { const rIn = g.label * R, rOut = (leadEnd - 0.006) * R;
      ring((rIn + rOut) / 2, landColor, Math.max(1, (rOut - rIn) * 0.9));
      const side = (tracks[0] && tracks[0].side) || 'A', mtx = `DD-${String(1000 + seed % 9000)}-${side}1  ℗`;
      x.save(); x.translate(R, R); x.rotate((seed * 0.53) % TAU);
      x.font = `italic ${Math.max(6, px * 1.15)}px "Segoe Print", "Comic Sans MS", cursive`; x.fillStyle = light ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.16)';
      const rt = (rIn + rOut) / 2 - px * 0.4; let ang = 0;
      for (const ch of mtx) { const w = x.measureText(ch).width; x.save(); x.rotate(ang); x.translate(0, -rt); x.fillText(ch, 0, 0); x.restore(); ang += (w + px * 0.1) / rt; }
      x.restore();
      ring(rIn + px * 1.1, `rgba(255,255,255,${0.10 * lightMul})`, px * 0.35);
      ring(rIn + px * 0.6, `rgba(0,0,0,${0.3 * darkMul})`, px * 0.45);
    }
    if (!pic) { // paper label
      x.save(); disc(g.label); x.clip();
      x.fillStyle = '#e8e0cf'; x.fillRect(0, 0, size, size);
      if (o.labelImg) S.drawCover(x, o.labelImg, R - g.label * R, R - g.label * R, g.label * R * 2, g.label * R * 2);
      x.restore();
      disc(g.label); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = px * 0.8; x.stroke();
    }
    if (sh) { x.save(); x.globalCompositeOperation = 'destination-in'; drawShape(x, R, sh); x.restore(); }    // cut to the outline
    const hole = o.seven && o.smallHole ? 0.0407 : g.hole;           // a 7" with a small (LP-size, 7.24 mm) hole: no 45 adapter
    x.save(); x.globalCompositeOperation = 'destination-out'; disc(hole); x.fill(); x.restore();
    if (o.seven && !o.smallHole) drawAdapter(x, R, R, g.hole * R);
    return { canvas: c, bands, lockR: leadEnd - 0.003, lastIn, leadR: sh || kind === 'ten' || kind === 'shellac' ? EDGE.lead : 0.959, lead, run, g };
  }

  // the platter: metallic-blue rim with strobe dots, and the slipmat (assets/slipmat.png, or a plain dark mat until it loads)
  function drawPlatter(size, mat) {
    const c = S.newCanvas(size), x = c.getContext('2d'), R = size / 2;
    const disc = r => { x.beginPath(); x.arc(R, R, r * R, 0, Math.PI * 2); };
    const metal = (r0, r1) => { const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#d8f1ff'); g.addColorStop(0.35, '#6cc4f2'); g.addColorStop(0.55, '#bfe7fd'); g.addColorStop(0.8, '#3e9fd8'); g.addColorStop(1, '#8fd3f8'); return g; };
    disc(1); x.fillStyle = metal(); x.fill();
    disc(0.993); x.fillStyle = '#0c0d10'; x.fill();
    // (the three rows of strobe dots are drawn on their own layers - see drawStrobe)
    disc(0.917); x.fillStyle = metal(); x.fill();
    disc(0.906); x.fillStyle = '#05060a'; x.fill();
    if (S.skin) S.skin.recolorCanvas(c, true);                 // the theme's metal
    if (mat) { x.save(); disc(0.905); x.clip(); x.drawImage(mat, R - 0.905 * R, R - 0.905 * R, 1.81 * R, 1.81 * R); x.restore(); }
    else { disc(0.905); const g = x.createRadialGradient(R, R, R * 0.1, R, R, R * 0.9); g.addColorStop(0, '#141a2a'); g.addColorStop(1, '#0a0d16'); x.fillStyle = g; x.fill(); }
    return c;
  }

  // the strobe rows, outermost to innermost: 33 1/3, 45 and 78 rpm. Each row has the number of dots that, lit by mains light
  // flashing 120 times a second, look still at exactly that speed (216, 160 and 92 dots)
  const STROBE = [{ r: 0.975, n: 216, rpm: 100 / 3 }, { r: 0.955, n: 160, rpm: 45 }, { r: 0.935, n: 92, rpm: 78 }];
  function drawStrobe(size, row) {
    const c = S.newCanvas(size), x = c.getContext('2d'), R = size / 2, { r, n } = STROBE[row];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, X = R + Math.cos(a) * r * R, Y = R + Math.sin(a) * r * R, d = R * 0.0062;
      const g = x.createRadialGradient(X - d * 0.35, Y - d * 0.4, d * 0.05, X, Y, d);
      g.addColorStop(0, '#f2fbff'); g.addColorStop(0.45, '#7fd0fb'); g.addColorStop(1, '#2777b8');
      x.fillStyle = g; x.beginPath(); x.arc(X, Y, d, 0, Math.PI * 2); x.fill();
    }
    if (S.skin) S.skin.recolorCanvas(c, true);
    return c;
  }

  const sv = (tag, a = {}) => S.svg(tag, a);
  const CART = { w: 1000, h: 701, axisY: 560.5 };   // assets/cartridge.png: stylus at the right edge, pins at the left, finger lift up

  class VinylStage {
    constructor(host) {
      this.host = host; this.angle = 0; this.spin = 0; this.armR = REST_R; this.lift = 1; this.rot = 0; this.busy = false; this.drag = null;
      this.faces = []; this.album = null; this.seven = false; this.info = null; this.rpm = 100 / 3; this.build();
      this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    build() {
      const e = S.el;
      this.tt = e('div', { class: 'tt' });
      this.plinth = e('div', { class: 'tt-plinth' }, e('div', { class: 'tt-brand' }, 'DIGI-DECK'), e('div', { class: 'tt-model' }, 'DIRECT DRIVE TURNTABLE SYSTEM  SP-1200'));
      this.platter = e('div', { class: 'tt-platter' }, drawPlatter(900));
      // strobe rows: separate layers turned by what the eye would see under a strobe light (still at their own speed)
      this.strobes = STROBE.map((_, k) => e('div', { class: 'tt-strobe' }, drawStrobe(900, k))); this.strobeA = [0, 0, 0];
      this.redrawStrobes = () => this.strobes.forEach((el, k) => el.replaceChildren(drawStrobe(900, k)));
      this.loadMat = () => { const m = new Image(), src = S.skin ? S.skin.slipmat() : '../../assets/slipmat.png'; m.onload = () => { if (this.platter) this.platter.replaceChildren(drawPlatter(900, m)); }; m.onerror = () => { if (this.platter) this.platter.replaceChildren(drawPlatter(900)); }; m.src = src; };
      this.loadMat(); this.offSkin = S.skin && S.skin.onChange(() => { this.loadMat(); this.applyArm(); this.redrawStrobes(); });
      this.recWrap = e('div', { class: 'tt-rec' });
      this.flipper = e('div', { class: 'tt-flip' });
      this.faceEls = [0, 1].map(k => e('div', { class: 'tt-face ' + (k ? 'back' : 'front') }, e('div', { class: 'tt-spin' })));
      this.flipper.append(...this.faceEls);
      this.sheen = e('div', { class: 'tt-sheen' });
      this.recWrap.append(this.flipper, this.sheen);
      this.spindle = e('div', { class: 'tt-spindle' });
      this.arm = this.buildArm();
      this.power = e('div', { class: 'tt-power' }, e('span', {}, 'POWER'));
      this.btn = e('button', { class: 'tt-start', title: 'Start / stop', onclick: () => S.app.startStop() }, 'START · STOP');
      this.s33 = e('div', { class: 'tt-spd' }, e('span', {}, '33'), e('i'));
      this.s45 = e('div', { class: 'tt-spd' }, e('span', {}, '45'), e('i'));
      this.s78 = e('div', { class: 'tt-78' }, e('span', {}, '78'));          // 78 rpm: both 33 and 45 light up, as on decks with a 78 setting
      this.knob = e('div', { class: 'tt-fader-knob', title: 'Pitch (drag; double-click to reset)' });
      this.fader = e('div', { class: 'tt-fader' }, e('span', { class: 'tt-pm tt-pm-top' }, '+'), e('span', { class: 'tt-pm tt-pm-bot' }, '−'), e('b', { class: 'tt-zero' }), this.knob, this.pitchLed = e('div', { class: 'tt-pitch' }, '0.0%'));
      this.pitch = 0; this.setupFader();
      this.sideLed = e('div', { class: 'tt-side' }, 'SIDE A');
      this.flipBtn = e('button', { class: 'tt-flipbtn', title: 'Flip record', onclick: () => S.app.manualFlip() }, '↻ FLIP');
      this.tt.append(this.plinth, this.platter, ...this.strobes, this.recWrap, this.spindle, this.power, this.btn, this.s33, this.s45, this.s78, this.fader, this.sideLed, this.flipBtn, this.arm.svg);
      this.host.append(this.tt);
      this.recWrap.addEventListener('click', ev => this.recordClick(ev));
    }
    // pitch fader: +10 % at the top, -10 % at the bottom, a click detent at 0. Speeds the record and the music up / down together
    setupFader() {
      const set = p => {
        p = S.clamp(p, -0.1, 0.1); if (Math.abs(p) < 0.004) p = 0; this.pitch = p;
        this.knob.style.top = (50 - p / 0.1 * 41) + '%';
        this.pitchLed.textContent = (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p * 100).toFixed(1) + '%';
        this.applyPitch();
      };
      this.setPitch = set;
      const fromY = ev => { const r = this.fader.getBoundingClientRect(); return (0.5 - (ev.clientY - r.top) / r.height) / 0.41 * 0.1; };
      this.fader.addEventListener('pointerdown', ev => {
        ev.preventDefault(); this.fader.setPointerCapture(ev.pointerId);
        const onKnob = ev.target === this.knob, y0 = ev.clientY, p0 = this.pitch;
        const move = e2 => set(onKnob ? p0 + (y0 - e2.clientY) / this.fader.getBoundingClientRect().height / 0.41 * 0.1 : fromY(e2));
        if (!onKnob) set(fromY(ev));
        const up = () => { this.fader.removeEventListener('pointermove', move); this.fader.removeEventListener('pointerup', up); };
        this.fader.addEventListener('pointermove', move); this.fader.addEventListener('pointerup', up);
      });
      this.fader.addEventListener('dblclick', () => set(0));
      this.fader.addEventListener('wheel', ev => { ev.preventDefault(); set(this.pitch + (ev.deltaY < 0 ? 0.001 : -0.001) * (ev.shiftKey ? 10 : 1)); }, { passive: false });
      set(0);
    }
    applyPitch() {
      const a = S.app && S.app.audio; if (!a) return;
      const r = 1 + (this.pitch || 0); a.preservesPitch = false; a.defaultPlaybackRate = r; if (Math.abs(a.playbackRate - r) > 1e-4) a.playbackRate = r;
    }
    buildArm() {
      const svg = sv('svg', { class: 'tt-arm' });
      const defs = sv('defs');
      const lin = (id, stops, x2 = 0, y2 = 1) => {
        const g = sv('linearGradient', { id, x1: 0, y1: 0, x2, y2 });
        stops.forEach(([o, c]) => g.append(sv('stop', { offset: o, 'stop-color': c })));
        defs.append(g);
      };
      const rad = (id, stops, cx = '40%', cy = '35%', r = '75%') => {
        const g = sv('radialGradient', { id, cx, cy, r });
        stops.forEach(([o, c]) => g.append(sv('stop', { offset: o, 'stop-color': c })));
        defs.append(g);
      };
      lin('silver', [[0, '#f5f9fb'], [0.5, '#97d4f2'], [1, '#3daee7']]);
      lin('silverH', [[0, '#3daee7'], [0.4, '#e3f2f9'], [1, '#54b8ea']], 1, 0);
      lin('blk', [[0, '#46484d'], [0.45, '#16171a'], [1, '#050506']]);
      lin('well', [[0, '#1d1e21'], [1, '#08080a']], 1, 1);
      rad('plate', [[0, '#ecf5f9'], [0.65, '#aeddf5'], [1, '#5ebceb']]);
      const A = { svg };
      A.base = sv('g'); A.grp = sv('g');
      A.hit = sv('line', { stroke: 'transparent', 'stroke-linecap': 'round', class: 'arm-hit' });
      svg.append(defs, A.base, A.grp);
      A.hit.addEventListener('pointerdown', ev => this.startDrag(ev));
      return A;
    }

    // everything the tonearm is made of, drawn for the current size (static base + the swinging arm group)
    rebuildArm(U, px, py, L) {
      const A = this.arm, e = sv, f = v => +v.toFixed(2);
      A.base.replaceChildren(); A.grp.replaceChildren();
      const line = (x1, y1, x2, y2, st) => e('path', { d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`, ...st });
      // ---- static base: black well, silver plate, height scale, anti-skate dial, lock + lift levers
      const cx = px + U * 0.022, cy = py - U * 0.008, R0 = U * 0.17;
      A.base.append(e('circle', { cx, cy, r: R0 + U * 0.004, fill: 'none', stroke: 'rgba(0,0,0,.28)', 'stroke-width': U * 0.01 }),
        e('circle', { cx, cy, r: R0, fill: 'url(#well)', stroke: '#3a3b3f', 'stroke-width': 1.2 }));
      for (let k = 0; k <= 14; k++) { // height-adjust scale printed on the black rim
        const a = (-165 + k * 10.5) * Math.PI / 180, r1 = R0 - U * 0.012, r2 = R0 - U * (k % 2 ? 0.02 : 0.026);
        A.base.append(line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, { stroke: '#bee4f7', 'stroke-width': 1 }));
      }
      A.base.append(e('circle', { cx: cx - U * 0.006, cy: cy + U * 0.004, r: U * 0.142, fill: 'url(#plate)', stroke: '#258bbf', 'stroke-width': 1 }),
        e('circle', { cx: cx - U * 0.006, cy: cy + U * 0.004, r: U * 0.106, fill: 'none', stroke: '#3fafe7', 'stroke-width': 1.1 }),
        e('circle', { cx: cx - U * 0.006, cy: cy + U * 0.004, r: U * 0.074, fill: 'rgba(255,255,255,.2)', stroke: '#64bfec', 'stroke-width': 1 }));
      // arm-rest cut-out + curved cable slot (the black arc visible on the plate)
      A.base.append(e('path', { d: `M ${cx - U * 0.1} ${cy + U * 0.03} A ${U * 0.103} ${U * 0.103} 0 0 0 ${cx - U * 0.03} ${cy + U * 0.1}`, fill: 'none', stroke: '#101012', 'stroke-width': U * 0.016, 'stroke-linecap': 'round' }));
      // anti-skating dial
      const sx = cx + U * 0.088, sy = cy - U * 0.026, sr = U * 0.034;
      A.base.append(e('rect', { x: sx - U * 0.07, y: sy - U * 0.02, width: U * 0.07, height: U * 0.04, fill: 'url(#silver)', stroke: '#1c9cdc', 'stroke-width': 1 }),
        e('circle', { cx: sx, cy: sy, r: sr, fill: '#121214', stroke: '#82cbef', 'stroke-width': 1.6 }), e('circle', { cx: sx, cy: sy, r: sr * 0.62, fill: '#1c1c1f', stroke: '#2e2f33', 'stroke-width': 1 }));
      for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; A.base.append(line(sx + Math.cos(a) * sr * 0.7, sy + Math.sin(a) * sr * 0.7, sx + Math.cos(a) * sr * (k % 4 ? 0.88 : 0.94), sy + Math.sin(a) * sr * (k % 4 ? 0.88 : 0.94), { stroke: '#e3f2f9', 'stroke-width': 0.8 })); }
      // lock lever (black, top) and lift lever (long black lever lower right)
      A.base.append(e('rect', { x: cx + U * 0.018, y: cy - U * 0.118, width: U * 0.02, height: U * 0.052, rx: U * 0.009, fill: 'url(#blk)', stroke: '#4b585f', 'stroke-width': 0.8, transform: `rotate(-14 ${cx + U * 0.028} ${cy - U * 0.09})` }),
        e('circle', { cx: cx + U * 0.09, cy: cy + U * 0.08, r: U * 0.015, fill: 'url(#silver)', stroke: '#238fc5', 'stroke-width': 1 }),
        line(cx + U * 0.09, cy + U * 0.08, cx + U * 0.15, cy + U * 0.165, { stroke: '#0e0e10', 'stroke-width': U * 0.017, 'stroke-linecap': 'round' }),
        line(cx + U * 0.09, cy + U * 0.08, cx + U * 0.15, cy + U * 0.165, { stroke: 'rgba(255,255,255,.18)', 'stroke-width': U * 0.004, 'stroke-linecap': 'round', transform: `translate(${-U * 0.003} 0)` }));
      // ---- the swinging arm, drawn at angle 0 (stylus straight along +x from the pivot)
      const hs = U * 0.17, psi = 0.34, cs = Math.cos(psi), sn = Math.sin(psi);
      const Tx = px + L, Ty = py, Ex = Tx - hs * cs, Ey = Ty - hs * sn;
      // counterweight: black knurled barrel with a numbered dial ring and a silver end cap
      const cwL = U * 0.11, cwW = U * 0.088, cwX = px - U * 0.22;
      A.grp.append(e('rect', { x: cwX - U * 0.022, y: py - cwW * 0.38, width: U * 0.026, height: cwW * 0.76, rx: U * 0.006, fill: 'url(#silver)', stroke: '#2789bb', 'stroke-width': 1 }),
        e('rect', { x: cwX, y: py - cwW / 2, width: cwL, height: cwW, rx: U * 0.008, fill: 'url(#blk)', stroke: '#2a85b3', 'stroke-width': 1 }));
      for (let k = 1; k < 8; k++) A.grp.append(line(cwX + U * 0.004, py - cwW / 2 + k * cwW / 8, cwX + cwL * 0.7, py - cwW / 2 + k * cwW / 8, { stroke: 'rgba(255,255,255,.12)', 'stroke-width': 0.8 }));
      A.grp.append(e('rect', { x: cwX + cwL * 0.7, y: py - cwW / 2, width: cwL * 0.3, height: cwW, fill: '#0c0c0e', stroke: '#39ace6', 'stroke-width': 1 }));
      for (let k = 0; k <= 16; k++) A.grp.append(line(cwX + cwL * 0.72, py - cwW / 2 + (k + 0.5) * cwW / 17, cwX + cwL * (k % 4 ? 0.8 : 0.88), py - cwW / 2 + (k + 0.5) * cwW / 17, { stroke: '#d2ecf9', 'stroke-width': 0.9 }));
      // rear silver tube into the pivot tower
      A.grp.append(e('rect', { x: cwX + cwL, y: py - U * 0.021, width: px - (cwX + cwL), height: U * 0.042, fill: 'url(#silver)', stroke: '#1d9ad8', 'stroke-width': 1 }));
      // yoke / height bracket: a silver bar across the tower, with its screw
      A.grp.append(e('rect', { x: px - U * 0.135, y: py - U * 0.05, width: U * 0.15, height: U * 0.03, rx: U * 0.012, fill: 'url(#silver)', stroke: '#258bbf', 'stroke-width': 1, transform: `rotate(24 ${px - U * 0.06} ${py - U * 0.035})` }),
        e('circle', { cx: px - U * 0.03, cy: py - U * 0.057, r: U * 0.0085, fill: '#bae3f7', stroke: '#4b585f', 'stroke-width': 1 }),
        e('rect', { x: px - U * 0.012, y: py - U * 0.046, width: U * 0.075, height: U * 0.026, rx: U * 0.01, fill: 'url(#silver)', stroke: '#258bbf', 'stroke-width': 1, transform: `rotate(24 ${px + U * 0.02} ${py - U * 0.033})` }));
      // tube: chrome, bows away from the platter and comes back to the headshell (offset angle psi)
      const d = `M ${f(px)} ${f(py)} C ${f(px + 0.3 * L)} ${f(py)} ${f(px + 0.38 * L)} ${f(py - 0.095 * L)} ${f(px + 0.55 * L)} ${f(py - 0.095 * L)} C ${f(px + 0.7 * L)} ${f(py - 0.095 * L)} ${f(Ex - 0.09 * L * cs)} ${f(Ey - 0.09 * L * sn)} ${f(Ex)} ${f(Ey)}`;
      const tube = (w, c, dy = 0) => e('path', { d, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'butt', transform: dy ? `translate(0 ${f(dy)})` : '' });
      A.grp.append(tube(U * 0.034, '#474f57'), tube(U * 0.03, '#8bcff1'), tube(U * 0.015, '#f1f7fa', -U * 0.006), tube(U * 0.004, '#2887b8', U * 0.0105), tube(U * 0.003, '#ffffff', -U * 0.0075));
      // tower cap on top of the pivot
      A.grp.append(e('circle', { cx: px, cy: py, r: U * 0.03, fill: 'url(#plate)', stroke: '#258bbf', 'stroke-width': 1.2 }), e('circle', { cx: px, cy: py, r: U * 0.018, fill: '#54b8ea', stroke: '#3e6a82', 'stroke-width': 1 }), e('circle', { cx: px - U * 0.004, cy: py - U * 0.004, r: U * 0.007, fill: '#e7f3f9' }));
      // black cable clip a little way along the tube
      const bz = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
      const t0 = 0.34, qx = bz(t0, px, px + 0.3 * L, px + 0.38 * L, px + 0.55 * L), qy = bz(t0, py, py, py - 0.095 * L, py - 0.095 * L);
      A.grp.append(e('rect', { x: qx - U * 0.012, y: qy - U * 0.026, width: U * 0.024, height: U * 0.052, rx: U * 0.006, fill: 'url(#blk)', stroke: '#2a85b3', 'stroke-width': 1 }));
      // knurled silver collar, then the cartridge photo (finger lift, collar, blue stylus guard) at the offset angle
      const col = e('g', { transform: `translate(${f(Ex)} ${f(Ey)}) rotate(${f(psi * 180 / Math.PI)})` });
      col.append(e('rect', { x: -U * 0.034, y: -U * 0.0185, width: U * 0.036, height: U * 0.037, rx: U * 0.004, fill: 'url(#silverH)', stroke: '#2887b8', 'stroke-width': 1 }));
      for (let k = 1; k < 7; k++) col.append(line(-U * 0.034 + k * U * 0.0052, -U * 0.0185, -U * 0.034 + k * U * 0.0052, U * 0.0185, { stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.9 }));
      const sc = hs / CART.w;
      col.append(e('image', { href: '../../assets/cartridge.png', x: 0, y: -CART.axisY * sc, width: CART.w * sc, height: CART.h * sc, preserveAspectRatio: 'none' }));
      A.grp.append(col);
      // grab area: the whole headshell plus the end of the tube (a fat invisible stroke), not just the stylus tip
      const cp = Math.cos(psi), sp = Math.sin(psi);
      for (const [k, v] of Object.entries({ x1: Ex - U * 0.24 * cp, y1: Ey - U * 0.24 * sp, x2: Tx, y2: Ty, 'stroke-width': U * 0.1 })) A.hit.setAttribute(k, v);
      A.grp.append(A.hit);
    }

    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight;
      if (!W || !H) return;
      const U = Math.max(200, Math.min((W - 24) / 1.55, (H - 24) / 1.12));
      this.U = U;
      const PW = U * 1.55, PH = U * 1.12;
      Object.assign(this.tt.style, { width: PW + 'px', height: PH + 'px', left: (W - PW) / 2 + 'px', top: (H - PH) / 2 + 'px', '--u': U + 'px' });
      const cx = U * 0.62, cy = U * 0.56; this.cx = cx; this.cy = cy;
      const place = (el, d) => Object.assign(el.style, { width: d + 'px', height: d + 'px', left: cx - d / 2 + 'px', top: cy - d / 2 + 'px' });
      const at = (el, x, y, w, h) => Object.assign(el.style, { left: x * U + 'px', top: y * U + 'px', width: w ? w * U + 'px' : '', height: h ? h * U + 'px' : '' });
      place(this.platter, U * 1.08); this.strobes.forEach(el => place(el, U * 1.08));
      const rd = U * REC * (this.scale);
      place(this.recWrap, rd); this.recD = rd;
      place(this.spindle, U * 0.028);
      at(this.power, 0.04, 0.76, 0.075, 0.075);
      at(this.btn, 0.025, 1.0, 0.16, 0.085); at(this.s33, 0.025, 0.9, 0.075, 0.07); at(this.s45, 0.105, 0.9, 0.075, 0.07); at(this.s78, 0.0625, 0.858, 0.08, 0.034);
      at(this.fader, 1.43, 0.5, 0.05, 0.46); at(this.sideLed, 1.12, 0.985, 0.12, 0.05); at(this.flipBtn, 1.255, 0.985, 0.11, 0.05);
      Object.assign(this.arm.svg.style, { width: PW + 'px', height: PH + 'px' });
      this.arm.svg.setAttribute('viewBox', `0 0 ${PW} ${PH}`);
      const Rp = U / 2, px = cx + ARM.px * Rp, py = cy + ARM.py * Rp, L = ARM.L * Rp;
      this.pivot = { x: px, y: py };
      this.rebuildArm(U, px, py, L);
      const lab = this.geo.label;
      this.sheen.style.setProperty('--lab', (lab * 100 + 0.8) + '%');
      this.tt.style.setProperty('--u', U + 'px');
      this.applyArm();
    }
    applyArm() {
      if (!this.pivot) return;
      const deg = armAngle(this.armR);
      this.arm.grp.setAttribute('transform', `rotate(${deg} ${this.pivot.x} ${this.pivot.y})`);
      const off = 2 + 12 * this.lift;
      this.arm.svg.style.filter = (S.skin && S.skin.def.ramp ? `url(#skin-${S.skin.name}-soft) ` : '') + `drop-shadow(${off * 0.6}px ${off}px ${2 + off * 0.5}px rgba(0,0,0,${0.5 - 0.2 * this.lift}))`;
      this.arm.svg.style.transformOrigin = `${this.pivot.x}px ${this.pivot.y}px`;
      this.arm.svg.style.transform = `scale(${1 + 0.03 * this.lift})`;
    }

    // ---------------------------------------------------------------- stylus drag / click-to-place
    get geo() { return GEO[this.kind || 'lp']; }
    get scale() { return this.info ? scaleOf(this.info) : 1; }
    recRadiusPx() { return this.recD / 2; }
    // relative radius (0..1 of the record) -> {i, frac} on the visible side
    pick(rRel) {
      const f = this.faces[this.visIndex()];
      if (!f || !f.bands.length) return null;
      const B = f.bands;
      if (rRel >= B[0].outer) return { i: B[0].i, frac: 0 };
      for (let k = 0; k < B.length; k++) {
        const b = B[k];
        if (rRel <= b.outer && rRel >= b.inner) return { i: b.i, frac: (b.outer - rRel) / Math.max(1e-6, b.outer - b.inner) };
        const nx = B[k + 1];
        if (nx && rRel < b.inner && rRel > nx.outer) return (b.inner - rRel < rRel - nx.outer) ? { i: b.i, frac: 0.985 } : { i: nx.i, frac: 0 };
      }
      return { i: B[B.length - 1].i, frac: 0.985 };
    }
    seekPick(p) {
      if (!p) return;
      const t = this.album.tracks[p.i];
      S.app.seekTo(p.i, Math.max(0, (t.duration || 0) * p.frac));
    }
    startDrag(ev) {
      if (this.busy || !this.album) return;
      ev.preventDefault(); ev.stopPropagation();
      this.drag = { r: this.armR };
      this.tt.classList.add('dragging');
      const move = e2 => {
        const b = this.tt.getBoundingClientRect();
        this.drag.r = S.clamp(Math.hypot(e2.clientX - b.left - this.cx, e2.clientY - b.top - this.cy) / (this.U / 2), 0.16, 1.3);
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        const r = this.drag.r; this.drag = null; this.tt.classList.remove('dragging');
        const rRel = r / (REC * (this.scale));
        if (rRel > 1.02) S.app.stop();                  // lifted off the record
        else this.seekPick(this.pick(rRel));
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }
    recordClick(ev) {
      const b = this.recWrap.getBoundingClientRect();
      const rRel = Math.hypot(ev.clientX - (b.left + b.width / 2), ev.clientY - (b.top + b.height / 2)) / (b.width / 2);
      const f = this.faces[this.visIndex()], g = (f && f.g) || this.geo;
      if (rRel > g.label + 0.012 && rRel < 1 && this.album) this.seekPick(this.pick(rRel));
      else S.app.togglePlay();
    }

    async renderFace(face, side) {
      const sides = S.sidesOf(this.album.tracks), idx = Math.max(0, sides.indexOf(side));
      const tracks = this.album.tracks.map((t, i) => ({ ...t, i })).filter(t => t.side === side);
      const total = tracks.reduce((a, t) => a + (t.duration || 0), 0);
      const color = S.colorOf(S.VINYL_COLORS, this.album.color);
      const sk = side.toLowerCase();
      const pic = this.album.picture_disc ? await S.loadImage(this.album['pic_' + sk] || this.album.pic_a) : null;
      await S.adapterReady;
      const labelImg = pic ? null : await S.art.get({ ...this.album }, 'label_' + sk, 'vinyl', side);
      const size = canvasOf(this.info), shape = this.album.shaped && pic ? await shapeFor(this.album, pic, sk !== 'a') : null;
      const { canvas, bands, lockR, leadR, lastIn, lead, run, g } = drawRecord(size, { mix: S.mixFor(this.album, side), mirror: S.SIDE_LETTERS.indexOf(side) % 2 === 1, seven: this.seven, kind: this.kind, rpm: this.rpm, smallHole: !!this.album.small_hole, shape, tracks, labelImg, color, pic, capacity: Math.max(total, this.seven ? S.SEVEN_CAPACITY : S.sideLimit(this.album, 'vinyl')) });
      canvas.className = 'tt-canvas';
      this.faceEls[face].firstChild.replaceChildren(canvas);
      this.faces[face] = { side, bands, lockR, leadR, lastIn, lead, run, g };
    }
    visIndex() { return Math.round(this.rot / 180) % 2; }
    // for the library animations: where the record sits on screen, the face that is showing, and a way to hide the real one meanwhile
    recordCanvas() { return this.faceEls[this.visIndex()].querySelector('canvas'); }
    recordRect() { const c = this.recordCanvas(); return c ? c.getBoundingClientRect() : null; }
    hideRecord(h) { this.flipper.style.visibility = h ? 'hidden' : ''; if (h) this.faceEls.forEach(f => { f.style.visibility = 'hidden'; }); else this.settle(); }

    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'vinyl'); this.flipper.style.visibility = '';
      this.info = S.releaseInfo(album, 'vinyl'); this.seven = this.info.seven; this.rpm = this.info.rpm; this.kind = this.info.shaped ? 'lp' : kindOfInfo(this.info);
      this.tt.classList.toggle('seven', this.seven); this.layout && this.layout();
      const sides = S.sidesOf(album.tracks);
      this.rot = 0; this.flipper.style.transform = 'rotateY(0deg)'; this.faces = []; this.unsettle();
      const first = sides[0] || 'A', pair = S.partnerSide(first);     // the other side of the same record
      await this.renderFace(0, first);
      await this.renderFace(1, sides.includes(pair) ? pair : sides[1] || pair);
      this.s33.classList.toggle('on', this.rpm < 40); this.s45.classList.toggle('on', this.rpm >= 40); if (this.rpm >= 60) this.s33.classList.add('on');
      this.settle(); this.sideLed.textContent = `SIDE ${first}`;
      this.flipBtn.style.display = sides.length > 1 ? '' : 'none'; this.updateFlipBtn();
      this.armR = REST_R; this.lift = 1; this.layout();
    }
    currentSide() { return this.faces[this.visIndex()]?.side || 'A'; }
    settle() {                                    // only the face turned toward us is drawn at rest
      const v = this.visIndex();
      this.faceEls.forEach((el, k) => { el.style.visibility = k === v ? 'visible' : 'hidden'; });
    }
    unsettle() { this.faceEls.forEach(el => { el.style.visibility = 'visible'; }); }

    // the button says what pressing it does: turn the record over, or swap in the next record of a set
    updateFlipBtn() {
      const sides = S.sidesOf(this.album.tracks), cur = this.currentSide(), next = sides[(sides.indexOf(cur) + 1) % sides.length] || cur;
      this.flipBtn.textContent = sides.length > 2 && S.discOf(next) !== S.discOf(cur) ? '⇄ NEXT RECORD' : '↻ FLIP';
    }
    async swapRecord(hidden, side) {              // lift the record off, put the next one of the set on
      const from = this.rot, to = from + 180;
      await this.flipper.animate([{ transform: `translateY(0) scale(1) rotateY(${from}deg)`, opacity: 1 }, { transform: `translateY(-55%) scale(1.15) rotateY(${from}deg)`, opacity: 0 }], { duration: 620, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      this.rot = to; this.flipper.style.transform = `translateY(-55%) scale(1.15) rotateY(${to}deg)`;
      await this.flipper.animate([{ transform: `translateY(-55%) scale(1.15) rotateY(${to}deg)`, opacity: 0 }, { transform: `translateY(0) scale(1) rotateY(${to}deg)`, opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }).finished.catch(() => {});
      this.flipper.getAnimations().forEach(a => a.cancel()); this.flipper.style.opacity = ''; this.rot = to % 360; this.flipper.style.transform = `rotateY(${this.rot}deg)`;
    }
    async flipTo(side) {
      if (this.busy) return;
      if (this.currentSide() === side) return;
      this.busy = true; this.unsettle(); this.spindle.style.zIndex = 1;        // the lifted record passes over the spindle
      const hidden = this.visIndex() ^ 1, swap = S.discOf(side) !== S.discOf(this.currentSide());
      if (this.faces[hidden]?.side !== side) await this.renderFace(hidden, side);
      await new Promise(r => setTimeout(r, 650));          // arm lifts away first
      if (swap) {
        await this.swapRecord(hidden, side);
        this.settle(); this.sideLed.textContent = `SIDE ${side}`; this.updateFlipBtn();
        await new Promise(r => setTimeout(r, 300)); this.spindle.style.zIndex = ''; this.busy = false; return;
      }
      const from = this.rot, to = from + 180;
      const anim = this.flipper.animate([
        { transform: `translateY(0) scale(1) rotateY(${from}deg)` },
        { transform: `translateY(-10%) scale(1.28) rotateY(${from + 90}deg)`, offset: 0.5 },
        { transform: `translateY(0) scale(1) rotateY(${to}deg)` }
      ], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)' });
      await anim.finished.catch(() => {});
      this.rot = to % 360; this.flipper.style.transform = `rotateY(${this.rot}deg)`; this.settle();
      this.sideLed.textContent = `SIDE ${side}`; this.updateFlipBtn();
      this.spindle.style.zIndex = '';
      await new Promise(r => setTimeout(r, 350));
      this.busy = false;
    }

    needleRadius(st) {
      const f = this.faces[this.visIndex()];
      const sc = REC * (this.scale);
      // lead-in and lead-out: the needle sits in the drawn groove. The groove passing under the needle is the turn of the spiral
      // whose angle is under the needle right now (record turned by this.angle); of those turns, the one nearest where it should be by now
      const follow = (sp, te, radius) => {
        const phi = this.tipAngle(this.armR / sc), psi = phi - this.angle * Math.PI / 180, T2 = Math.PI * 2 * sp.turns;
        let t = (sp.a0 - psi) / T2; t += Math.round((te - t) * sp.turns) / sp.turns;
        return radius(S.clamp(t, 0, 1)) * sc;
      };
      if (f && st.vphase === 'leadin' && f.lead) {
        const fr = st.leadFrac || 0;
        if (fr < 0.3) return f.lead.r0 * sc;                                   // set down on the smooth band, waiting for the groove
        return follow(f.lead, (fr - 0.3) / 0.7, t => f.lead.r0 + (f.lead.r1 - f.lead.r0) * t);
      }
      if (f && st.vphase === 'runout' && f.run) {
        const d = f.run.r0 - f.run.r1;
        return follow(f.run, S.clamp((st.runFrac || 0) * RUN_TOTAL / RUN_SEC, 0, 1), t => f.run.r0 - d * (1 - Math.pow(1 - t, 0.55)));
      }
      if (f && st.vphase === 'locked') return f.lockR * sc;
      if (!f || st.trackIndex < 0) return null;
      const band = f.bands.find(b => b.i === st.trackIndex);
      if (!band) return null;
      const frac = S.clamp(st.trackDur > 0 ? st.trackTime / st.trackDur : 0, 0, 1);
      return (band.outer + (band.inner - band.outer) * frac) * REC * (this.scale);
    }

    // angle (screen, clockwise from 3 o'clock) of the stylus tip round the record centre, for a tip at radius r (record radii)
    tipAngle(rFrac) {
      const r = rFrac * REC * (this.scale), d = Math.hypot(ARM.px, ARM.py), al = Math.atan2(ARM.py, ARM.px);
      return al + Math.acos(S.clamp((r * r + d * d - ARM.L * ARM.L) / (2 * r * d), -1, 1));
    }
    frame(dt, st) {
      if (this.pitch) this.applyPitch();
      const target = (st.playing || st.vphase) && !this.busy ? 1 : 0;
      this.spin += (target - this.spin) * (1 - Math.exp(-dt * (target ? 2.0 : 0.8)));
      if (!target && this.spin < 0.002) this.spin = 0;
      this.angle = (this.angle + this.rpm * (1 + this.pitch) * 6 * dt * this.spin) % 360;
      // keep the groove in step with the needle: before the needle reaches the lead-in groove (and in the last seconds of a side, before
      // the lead-out), the platter's position is nudged so the start of that groove spiral arrives under the needle right on time
      { const f = this.faces[this.visIndex()], sc = REC * (this.scale);
        const sync = (tLeft, sp, rFrac) => {
          if (!sp || tLeft <= 0.04 || tLeft > 4) return;
          const est = 1 - (1 - this.spin) * (1 - Math.exp(-2 * tLeft)) / (2 * tLeft);
          const want = (this.tipAngle(rFrac) - sp.a0) * 180 / Math.PI, pred = this.angle + this.rpm * 6 * tLeft * est;
          const err = ((pred - want) % 360 + 540) % 360 - 180;
          this.angle -= S.clamp(err * dt / tLeft, -70 * dt, 70 * dt);
        };
        if (f && !this.drag && !this.busy) {
          if (st.vphase === 'leadin' && f.lead) sync((0.3 - (st.leadFrac || 0)) * (st.leadMs || 5592) / 1000, f.lead, f.lead.r0);
          else if (!st.vphase && st.playing && f.run && f.bands.length && f.bands[f.bands.length - 1].i === st.trackIndex) sync((st.trackDur || 0) - (st.trackTime || 0), f.run, f.run.r0);
        }
      }
      // both faces turn clockwise as seen from above (the flipped face is already un-mirrored by the flip itself)
      this.faceEls[0].firstChild.style.transform = `rotate(${this.angle}deg)`;
      this.faceEls[1].firstChild.style.transform = `rotate(${this.angle}deg)`;
      this.platter.style.transform = `rotate(${this.angle}deg)`;
      // strobe: per mains flash (1/120 s) the platter turns d degrees; a row of n dots looks like it moves by d minus a whole
      // number of dot spacings - so the row for the selected speed stands still, and the others crawl or race
      const rpmNow = this.rpm * (1 + this.pitch) * this.spin, d = rpmNow * 6 / 120;
      STROBE.forEach((row, k) => {
        const sp = row.rpm * 6 / 120; let w = d % sp; if (w > sp / 2) w -= sp;
        this.strobeA[k] = (this.strobeA[k] + w * 120 * dt) % 360;
        this.strobes[k].style.transform = `rotate(${this.strobeA[k]}deg)`;
      });
      let tR = REST_R, lift = 1;
      if (this.drag) { tR = this.drag.r; lift = 0.55; }
      else if (!this.busy) {
        const nr = this.needleRadius(st);
        if (nr != null) { tR = nr; lift = (st.playing || st.vphase) ? 0 : 1; }
      }
      const tracking = st.vphase === 'leadin' || st.vphase === 'runout';   // in the lead-in / lead-out the arm keeps right in the groove
      const k = this.drag ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * (tracking && this.lift < 0.3 ? 14 : lift === 0 ? 3.5 : 3));
      this.armR += (tR - this.armR) * k;
      this.lift += (lift - this.lift) * (1 - Math.exp(-dt * 7));
      this.applyArm();
      this.tt.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); this.offSkin && this.offSkin(); this.tt.remove(); const a = S.app && S.app.audio; if (a) { a.defaultPlaybackRate = 1; a.playbackRate = 1; a.preservesPitch = true; } }
  }

  S.stages = S.stages || {};
  S.stages.vinyl = VinylStage;
  // one side of a record as a picture (used by the library animations)
  // die-cut jackets / sleeves: a front or back picture with a see-through hole in the middle shows the record (its label) through
  // it. Returns the jacket face with the record drawn behind, or null when the picture has no hole there
  const holeCache = new Map();
  S.isHoled = src => {
    if (!src) return Promise.resolve(false);
    if (!holeCache.has(src)) holeCache.set(src, S.loadImage(src).then(im => {
      if (!im) return false;
      const c = S.newCanvas(64, 64), x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64);
      try { const d = x.getImageData(28, 28, 8, 8).data; let t = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 128) t++; return t > 40; } catch { return false; }
    }));
    return holeCache.get(src);
  };
  const fullCache = new Map();
  S.holeCover = async (album, which = 'front', size = 900) => {
    const src = album && album[which]; if (!src || !(await S.isHoled(src))) return null;
    let a = album;
    if (!(a.tracks && a.tracks.length) && a.id) { if (!fullCache.has(a.id + ':' + (a.updated || ''))) fullCache.set(a.id + ':' + (a.updated || ''), window.api.libraryLoad('vinyl', a.id).catch(() => null)); a = (await fullCache.get(a.id + ':' + (a.updated || ''))) || a; }
    if (!(a.tracks && a.tracks.length)) a = { ...a, tracks: [{ title: '', duration: 600, side: 'A' }, { title: '', duration: 600, side: 'B' }] };
    const sides = S.sidesOf(a.tracks), side = which === 'back' ? (sides[1] || 'B') : (sides[0] || 'A');
    const [im, rec] = await Promise.all([S.loadImage(src), S.vinylFace(a, side)]);
    const c = S.newCanvas(size), x = c.getContext('2d');
    x.fillStyle = '#e3dccd'; x.fillRect(0, 0, size, size);                                 // the inside of the jacket
    const r = size * (S.releaseInfo(a, 'vinyl').paper ? 0.975 : 0.96); x.drawImage(rec, (size - r) / 2, (size - r) / 2, r, r);
    S.drawCover(x, im, 0, 0, size, size);
    return c;
  };
  S.vinylFace = async (album, side) => {
    const info = S.releaseInfo(album, 'vinyl'), seven = info.seven, sk = side.toLowerCase();
    const tracks = album.tracks.map((t, i) => ({ ...t, i })).filter(t => t.side === side), total = tracks.reduce((a, t) => a + (t.duration || 0), 0);
    const pic = album.picture_disc ? await S.loadImage(album['pic_' + sk] || album.pic_a) : null;
    await S.adapterReady;
    const labelImg = pic ? null : await S.art.get({ ...album }, 'label_' + sk, 'vinyl', side);
    const shape = album.shaped && pic ? await shapeFor(album, pic, sk !== 'a') : null;
    return drawRecord(canvasOf(info), { mix: S.mixFor(album, side), mirror: S.SIDE_LETTERS.indexOf(side) % 2 === 1, seven, kind: info.shaped ? 'lp' : kindOfInfo(info), rpm: info.rpm, smallHole: !!album.small_hole, shape, tracks, labelImg, color: S.colorOf(S.VINYL_COLORS, album.color), pic, capacity: Math.max(total, seven ? S.SEVEN_CAPACITY : S.sideLimit(album, 'vinyl')) }).canvas;
  };
  S.shapeFit = a => { let f = {}; try { f = a && a.shape_fit ? JSON.parse(a.shape_fit) : {}; } catch {} return { fit: 'play',   /* the size is always the playable area (the groove circle); the shape around it is scaled to match */ dx: +f.dx || 0, dy: +f.dy || 0, k: S.clamp(+f.k || 1, 0.2, 4), bRot: +f.bRot || 0, bFlip: !!f.bFlip, rpm: [100 / 3, 45, 78].find(v => Math.abs(v - (+f.rpm || 0)) < 0.5) || 0 }; };
  S.shapeCircle = (img, album) => shapeCircle(img, album);
  S.shapeFor = (album, img, isB) => shapeFor(album, img, isB);
  // ---- the clear PVC sleeve a shaped record comes in (shelf, preview, playlist): sized to the record, with the record showing
  // through it - or, when there is cover art, the card behind the PVC
  const sleeveCache = new Map();
  S.shapedInches = async album => {                                       // the sleeve's side, in inches (record's widest way + a margin)
    const img = album.pic_a ? await S.loadImage(album.pic_a) : null; if (!img) return null;
    const C = shapeCircle(img, album), sh = await shapeFor(album, img, false); if (!C || !sh) return null;
    return Math.max(C.box[2] - C.box[0], C.box[3] - C.box[1]) * sh.sx * 1.08;
  };
  S.shapedSleeve = async (album, px = 600) => {
    const key = [album.pic_a, album.front, album.shape_fit, album.shape_size, px].join('|'); if (sleeveCache.has(key)) return sleeveCache.get(key);
    const pr = (async () => {
      const c = S.newCanvas(px, px), x = c.getContext('2d'), m = px * 0.035, inner = px - 2 * m;
      // back sheet and its fold-over flap
      x.fillStyle = 'rgba(235,240,245,.10)'; x.fillRect(0, 0, px, px);
      x.fillStyle = 'rgba(255,255,255,.10)'; x.fillRect(0, 0, px, px * 0.13); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, px * 0.13, px, Math.max(1, px * 0.003));
      const cover = album.front ? await S.loadImage(album.front) : null;
      if (cover) { x.save(); x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = px * 0.015; S.drawCover(x, cover, m, m, inner, inner); x.restore(); }
      else {
        const img = album.pic_a ? await S.loadImage(album.pic_a) : null, sh = img && await shapeFor(album, img, false);
        if (sh) {
          const f = S.newCanvas(1200, 1200); drawShape(f.getContext('2d'), 600, sh);
          const q = S.transit && S.transit.shapedCrop ? S.transit.shapedCrop(f) : { crop: f };
          x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = px * 0.02; x.shadowOffsetY = px * 0.008; x.drawImage(q.crop, m, m, inner, inner); x.restore();
        }
      }
      // front sheet: sheen, welded seams, edge
      const g = x.createLinearGradient(0, 0, px, px);
      g.addColorStop(0, 'rgba(255,255,255,.26)'); g.addColorStop(0.25, 'rgba(255,255,255,.04)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(0.52, 'rgba(255,255,255,.18)'); g.addColorStop(0.64, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(255,255,255,.14)');
      x.fillStyle = g; x.fillRect(0, 0, px, px);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1, px * 0.004); x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, px - x.lineWidth, px - x.lineWidth);
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = px * 0.008; x.strokeRect(px * 0.012, px * 0.012, px * 0.976, px * 0.976);
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = px * 0.004; x.beginPath(); x.moveTo(px * 0.62, px * 0.04); x.lineTo(px * 0.3, px * 0.96); x.stroke();
      return c;
    })();
    sleeveCache.set(key, pr); return pr;
  };
  S.drawShapeOn = (x, R, sh) => drawShape(x, R, sh);
  S.vinyl = { armAngle, GEO, ARM, computeBands, REC, kindOfInfo, scaleOf };
})(window.S);
