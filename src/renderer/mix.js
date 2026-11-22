// Multi-colour vinyl: patterns drawn as the record's base colour (under the grooves and label).
// Fixed-colour styles: half & half (2), tri-colour (3), quad (4), pinwheel (2). Random styles (2-5 colours, regenerated from a seed):
// starburst, cloudy, splatter, marble. album.color_mix = JSON {style, colors: ['#rrggbb', ...], seed}.
(function (S) {
  const STYLES = [
    { id: 'half', name: 'Half & half', min: 2, max: 2 },
    { id: 'tri', name: 'Tri-colour', min: 3, max: 3 },
    { id: 'quad', name: 'Quad colour', min: 4, max: 4 },
    { id: 'pinwheel', name: 'Pinwheel', min: 2, max: 2 },
    { id: 'starburst', name: 'Starburst', min: 2, max: 5, random: true },
    { id: 'cloudy', name: 'Cloudy', min: 2, max: 5, random: true },
    { id: 'splatter', name: 'Splatter', min: 2, max: 5, random: true },
    { id: 'marble', name: 'Marble', min: 2, max: 5, random: true }
  ];
  const DEFAULTS = ['#1d3f9c', '#ececec', '#b3151b', '#e7c61f', '#0d0d0d'];

  S.mixOf = a => {
    if (!a || !a.color_mix) return null;
    let m; try { m = JSON.parse(a.color_mix); } catch { return null; }
    if (m.style === 'smoke') m.style = 'marble';                       // Smoke was removed; records saved with it become Marble
    const st = STYLES.find(s => s.id === m.style); if (!st) return null;
    const colors = (Array.isArray(m.colors) ? m.colors : []).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, st.max);
    while (colors.length < st.min) colors.push(DEFAULTS[colors.length]);
    return { style: st.id, colors, seed: (m.seed >>> 0) || 1 };
  };

  // the pattern for one side: the back of a record is its front mirrored; random styles differ from record to record
  S.mixFor = (a, side) => {
    const m = S.mixOf(a); if (!m) return null;
    const k = Math.max(0, S.SIDE_LETTERS.indexOf(side)), rec = k >> 1, st = STYLES.find(x => x.id === m.style);
    return { ...m, seed: st.random ? m.seed + rec * 977 : m.seed };
  };

  // ---- seeded randomness and noise
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; };
  function noise3(seed) {
    const r = rng(seed * 7919 + 13), P = new Uint8Array(512), G = new Float32Array(256);
    const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) P[i] = p[i & 255]; for (let i = 0; i < 256; i++) G[i] = r();
    const f = t => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t;
    const h = (X, Y, Z) => G[P[P[P[X & 255] + (Y & 255)] + (Z & 255)]];
    return (x, y, z) => {
      const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = f(x - X), v = f(y - Y), w = f(z - Z);
      return L(L(L(h(X, Y, Z), h(X + 1, Y, Z), u), L(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
        L(L(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), L(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w);
    };
  }
  const fbm = (n, x, y, z, oct = 4) => { let a = 0, s = 1, t = 0; for (let i = 0; i < oct; i++) { a += n(x * s, y * s, z * s) / s; t += 1 / s; s *= 2; } return a / t; };
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  // ---- one pixel's colour for each style. r: 0 (centre) .. 1 (edge); a: angle; (px, py): -1..1
  function painter(mix) {
    const C = mix.colors.map(rgb), n = C.length, R = rng(mix.seed), N = noise3(mix.seed), N2 = noise3(mix.seed + 101);
    const rot = R() * TAU;
    switch (mix.style) {
      case 'half': return (r, a) => { const d = Math.sin(a - rot); return mixc(C[0], C[1], smooth(-0.012, 0.012, d + (N(r * 6, a, 0) - 0.5) * 0.02)); };
      case 'tri': case 'quad': {
        const k = mix.style === 'tri' ? 3 : 4;
        return (r, a) => {
          const t = ((a - rot) / TAU % 1 + 1) % 1 * k + (N(r * 5, Math.cos(a) * 2, Math.sin(a) * 2) - 0.5) * 0.04, i = ((Math.floor(t) % k) + k) % k, f = t - Math.floor(t);
          const e = Math.min(f, 1 - f), j = f < 0.5 ? (i + k - 1) % k : (i + 1) % k;
          return mixc(C[i], C[j], (1 - smooth(0, 0.012, e)) * 0.5);
        };
      }
      case 'pinwheel': {
        const petals = 5 + Math.floor(R() * 3), twist = 0.12 + R() * 0.12;
        return (r, a) => {
          // petals of colour 2: narrow at the centre, widest in the middle, a little narrower at the rim, with curved (swept) edges
          const w = 0.16 + 0.34 * Math.sin(Math.PI * Math.min(1, Math.pow(r, 0.8) * 0.85)) - 0.06 * smooth(0.8, 1, r);
          const t = ((a - rot) / TAU * petals + twist * r * r + (N(r * 4, a, 1) - 0.5) * 0.05) % 1, f = (t + 1) % 1, d = Math.abs(f - 0.5);
          return mixc(C[0], C[1], 1 - smooth(w / 2 - 0.012, w / 2 + 0.012, d));
        };
      }
      case 'starburst': {
        // colour-in-colour burst. Each colour was pushed in after the one before, so they sit in wavy rings outward from the
        // label (a ring can also break into separate puddles), with soft edges, combed radial fringes and fine marbled swirls.
        const seams = [0], sectors = [{ z: R() * 60, rot: 0, sh: 0, swap: null }];      // one continuous pour (no seams)
        const L = [];
        for (let k = 1; k < n; k++) {
          const b = 0.5 + (k / n) * 0.42 + (R() - 0.5) * 0.06, blobs = k >= 2 && n > 2 && R() < 0.3;
          const pb = blobs ? Array.from({ length: 3 + Math.floor(R() * 4) }, () => ({ a: R() * TAU, w: 0.25 + R() * 0.45, h: 0.06 + R() * 0.07 })) : null;
          L.push({ k, b, pb, lobes: 0.08 + R() * 0.1, z: R() * 50 });
        }
        const pale = [255, 255, 255], ang = v => Math.abs(((v % TAU) + TAU + Math.PI) % TAU - Math.PI);
        return (r, a) => {
          // which sector, and how far (along the circle) from its nearest seam
          let si = seams.length - 1; for (let i = 0; i < seams.length; i++) if (((a - seams[i]) % TAU + TAU) % TAU < ((a - seams[si]) % TAU + TAU) % TAU) si = i;
          let seamD = 9; for (const sm of seams) seamD = Math.min(seamD, ang(a - sm) * r);
          const sec = sectors[si], aa = a + sec.rot, ca = Math.cos(aa), sa = Math.sin(aa), rr = r + sec.sh * r;
          let col = C[0];
          for (const l of L) {
            const z = l.z + sec.z;
            const big = fbm(N, ca * 1.3 + z, sa * 1.3, l.k + rr * 0.6, 3) - 0.5, mid = fbm(N2, ca * 4 + z, sa * 4, rr * 2.5, 3) - 0.5;
            const combAmp = 0.008 + 0.045 * smooth(0.45, 0.72, fbm(N2, ca * 2 + z, sa * 2, 30 + l.k, 2));
            const comb = (N(ca * 140, sa * 140, l.k * 3 + z) - 0.5) * combAmp + (N2(ca * 45, sa * 45, l.k * 5) - 0.5) * combAmp * 0.8;
            const rw = rr + big * l.lobes * 2.4 * (0.5 + rr) + mid * 0.05 + comb;
            let cover;
            if (!l.pb) cover = smooth(l.b - 0.045, l.b + 0.045, rw);
            else {
              cover = 0;
              for (const p of l.pb) {
                const da = ang(aa - p.a) / p.w, dr = (rw - l.b - p.h * 0.3) / p.h;
                cover = Math.max(cover, 1 - smooth(0.8, 1.05, Math.hypot(da, dr * 1.2) + comb * 4));
              }
            }
            let ck = l.k; if (sec.swap) ck = ck === sec.swap[0] ? sec.swap[1] : ck === sec.swap[1] ? sec.swap[0] : ck;
            // the poured colour carries some of the one before it, unevenly
            const carry = 0.35 * smooth(0.45, 0.75, fbm(N, ca * 2.2 + z + 7, sa * 2.2, rr * 3, 3));
            col = mixc(col, mixc(C[ck], col, carry), cover);
          }
          // fine marbled swirls running round the record: pale and dark wisps
          const wv = (fbm(N2, ca * 1.5 + sec.z, sa * 1.5, rr, 2) - 0.5) * 0.25;
          const mv = fbm(N, ca * 5 + sec.z, sa * 5, (rr + wv) * 34, 2), wisp = 1 - smooth(0, 0.08, Math.abs(mv - 0.5));
          const patch = smooth(0.4, 0.65, fbm(N2, ca * 3 + sec.z, sa * 3, rr * 4, 2));
          col = mixc(col, mv > 0.5 ? pale : [0, 0, 0], wisp * patch * (mv > 0.5 ? 0.3 : 0.12));
          return col;
        };
      }
      case 'cloudy': {
        // soft clouds of the colours, streaked outward from the centre, with lots of droplets: rounded heads pointing outward and
        // short tails toward the centre, shaded so they look raised (light on the inner side, a dark rim on the outer side)
        const drops = Array.from({ length: 230 }, () => ({ rr: 0.36 + Math.pow(R(), 0.7) * 0.64, aa: R() * TAU, s: 0.016 + R() * 0.022, tail: 0.03 + R() * 0.08, c: Math.floor(R() * n), lift: R() }));
        drops.sort((p, q) => p.rr - q.rr);
        return (r, a, x, y) => {
          const ca = Math.cos(a), sa = Math.sin(a);
          const v = 0.68 * fbm(N, x * 2.2 + 9, y * 2.2, 0.5, 5) + 0.32 * fbm(N2, ca * 9, sa * 9, r * 1.6, 3);
          const t = Math.max(0, Math.min(0.999, (v - 0.3) * 2.2 + (0.62 - r) * 0.35)) * (n - 1), i = Math.floor(t);
          let col = mixc(C[i], C[Math.min(n - 1, i + 1)], smooth(0.15, 0.85, t - i));
          col = mixc(col, [255, 255, 255], Math.max(0, fbm(N, x * 6, y * 6, 3, 3) - 0.6) * 0.8);
          for (const p of drops) {
            const d = r - p.rr; if (d > p.s || d < -p.tail) continue;
            const tt = Math.abs(((a - p.aa) % TAU + TAU + Math.PI) % TAU - Math.PI) * p.rr; if (tt > p.s) continue;
            const hw = d >= 0 ? p.s * Math.sqrt(Math.max(0, 1 - (d / p.s) ** 2)) : p.s * Math.pow(Math.max(0, 1 + d / p.tail), 0.6);
            if (tt >= hw) continue;
            const e = 1 - tt / hw, base = C[p.c];
            let dc = mixc(base, [0, 0, 0], 0.18 + 0.3 * smooth(0, p.s, d) * (1 - e * 0.5));          // darker toward the outer rim
            dc = mixc(dc, [255, 255, 255], 0.25 * smooth(0, -p.tail, d) * e * p.lift);                // lighter on the tail side
            col = mixc(col, dc, 0.8 * smooth(0, 0.55, e));
          }
          return col;
        };
      }
      case 'marble': {
        // mostly the first colour, with soft clouds of the others and lots of fine, wispy veins (where a warped noise field
        // crosses a level), at two scales; veins take the other colours and a pale tint of the first
        const pale = mixc(C[0], [255, 255, 255], 0.55), deep = mixc(C[0], [0, 0, 0], 0.35), vcol = n > 1 ? C.slice(1) : [pale];
        return (r, a, x, y) => {
          const sw = 0.6 * r, cs = Math.cos(sw), sn = Math.sin(sw), X = x * cs - y * sn, Y = x * sn + y * cs;     // a slight swirl
          const wx = X + 0.9 * (fbm(N, X * 0.9, Y * 0.9, 1, 3) - 0.5), wy = Y + 0.9 * (fbm(N2, X * 0.9 + 5, Y * 0.9, 2, 3) - 0.5);
          let col = C[0];
          // broad, faint clouds: base lighter / darker, and the other colours
          const cl = fbm(N2, wx * 1.6 + 20, wy * 1.6, 6, 4);
          col = mixc(col, cl > 0.5 ? pale : deep, Math.min(0.35, Math.abs(cl - 0.5) * 0.9));
          for (let i = 1; i < n; i++) col = mixc(col, C[i], 0.42 * smooth(0.58, 0.78, fbm(N, wx * 1.4 + i * 7.3, wy * 1.4, 10 + i, 4)));
          // veins: thin wisps with a soft smoky glow, fading in and out along their length
          for (let L = 0; L < 3; L++) {
            const sc = [1.8, 3, 5][L], wd = [0.014, 0.01, 0.007][L];
            const v = fbm(L % 2 ? N2 : N, wx * sc + L * 4.1, wy * sc * 1.25, 3 + L * 2, 3), dv = Math.abs(v - 0.5);
            const line = (1 - smooth(0, wd, dv)) * 0.75 + (1 - smooth(0, wd * 5, dv)) * 0.3;
            if (line <= 0.01) continue;
            const fade = smooth(0.38, 0.62, fbm(N2, wx * 2.2 + L * 9, wy * 2.2, 20 + L, 2));
            const c = L === 2 ? pale : vcol[Math.floor(fbm(N2, wx * 0.8 + L, wy * 0.8, 9, 2) * vcol.length * 1.6) % vcol.length];
            col = mixc(col, c, Math.min(1, line) * fade * (L === 2 ? 0.55 : 0.8));
          }
          return col;
        };
      }
      case 'smoke': {
        // thin wisps (where the noise crosses a level), swept round the record as it was pressed
        const marble = false;
        return (r, a, x, y) => {
          const sw = a + r * (marble ? 1.2 : 2.2), cx = Math.cos(sw), sy = Math.sin(sw);
          let col = C[0];
          for (let i = 1; i < n; i++) {
            const v = fbm(N, cx * (marble ? 1.6 : 1.1) + i * 3.1, sy * (marble ? 1.6 : 1.1), r * (marble ? 4 : 7) + i, 5);
            const line = 1 - smooth(0, marble ? 0.05 : 0.06, Math.abs(v - 0.5));
            const patch = marble ? smooth(0.55, 0.75, fbm(N2, x * 2 + i, y * 2, i, 3)) * 0.35 : 0.15 * smooth(0.5, 0.7, v);
            col = mixc(col, C[i], Math.min(1, line * (marble ? 0.85 : 0.75) + patch));
          }
          return col;
        };
      }
      case 'splatter': {
        // the base colour with a soft glow of the splatter colours round the label; the splats themselves are drawn as shapes
        // afterwards (drawSplats)
        const glow = R() < 0.6;
        return (r, a, x, y) => {
          const ca = Math.cos(a), sa = Math.sin(a), st = (N(ca * 30, sa * 30, 1) - 0.5) * 0.18 + (N(ca * 7, sa * 7, 2) - 0.5) * 0.2;
          let col = C[0];
          if (glow && n > 1) col = mixc(col, C[1], (1 - smooth(0.36, 0.6, r + st)) * 0.45);
          return mixc(col, [255, 255, 255], Math.max(0, fbm(N2, x * 3, y * 3, 1, 3) - 0.58) * 0.5);
        };
      }
    }
    return () => C[0];
  }

  // splatter: radial streaks bursting out from the label, chips / flakes scattered round (denser near the centre) and a few faint
  // smears. How bursty or chippy a record is, is part of its random pattern. Drawn in record units (re: 0.3 = label edge)
  function drawSplats(x, W, mix, lab) {
    const R = rng(mix.seed * 31 + 7), C = mix.colors, n = C.length, h = W / 2, cols = n > 1 ? C.slice(1) : [S.shade(C[0], 0.4)];
    const realR = re => (re <= 0.3 ? re * lab / 0.3 : lab + (re - 0.3) / 0.7 * (1 - lab)) * h;
    const pt = (re, a) => [h + realR(re) * Math.cos(a), h + realR(re) * Math.sin(a)];
    const burst = R(), chips = R(), pick = () => cols[Math.floor(R() * cols.length)];
    x.save(); x.beginPath(); x.arc(h, h, h, 0, TAU); x.clip();
    // faint smears (blurred)
    x.filter = `blur(${Math.max(2, W / 160)}px)`;
    for (let i = 0; i < 18 + burst * 30; i++) {
      const a = R() * TAU, r0 = 0.3 + R() * 0.1, r1 = r0 + 0.25 + R() * 0.5, w = 0.03 + R() * 0.08;
      x.globalAlpha = 0.12 + R() * 0.18; x.fillStyle = pick(); x.beginPath();
      x.moveTo(...pt(r0, a - w)); x.lineTo(...pt(r1, a - w * 0.2)); x.lineTo(...pt(r1, a + w * 0.2)); x.lineTo(...pt(r0, a + w)); x.fill();
    }
    x.filter = 'none';
    // streaks: thin jagged wedges from near the label, tapering outward
    for (let i = 0, N = Math.round(80 + burst * 200); i < N; i++) {
      const a = R() * TAU, r0 = 0.3 + Math.pow(R(), 1.8) * 0.45, len = (0.05 + Math.pow(R(), 1.5) * 0.55) * (1.1 - r0 * 0.6), w0 = (0.004 + R() * 0.02) / Math.max(0.35, r0);
      x.globalAlpha = 0.65 + R() * 0.35; x.fillStyle = pick(); x.beginPath();
      const steps = 6, left = [], right = [];
      for (let k = 0; k <= steps; k++) { const t = k / steps, rr = r0 + len * t, ww = w0 * Math.pow(1 - t, 0.8) * (0.6 + R() * 0.8); left.push(pt(rr, a - ww)); right.push(pt(rr, a + ww)); }
      x.moveTo(...left[0]); left.forEach(p => x.lineTo(...p)); right.reverse().forEach(p => x.lineTo(...p)); x.closePath(); x.fill();
    }
    // chips: irregular flakes, a little drawn out along the radius
    for (let i = 0, N = Math.round(60 + chips * 300); i < N; i++) {
      const a = R() * TAU, rr = 0.3 + Math.pow(R(), 1.2 - chips * 0.5) * 0.7, s = (0.006 + Math.pow(R(), 2) * 0.03) * h, el = 1 + R() * 1.6, rot = a + (R() - 0.5) * 0.8;
      const [cx, cy] = pt(rr, a), k = 6 + Math.floor(R() * 5);
      x.globalAlpha = 0.75 + R() * 0.25; x.fillStyle = pick(); x.beginPath();
      for (let j = 0; j < k; j++) {
        const ph = j / k * TAU, rad = s * (0.55 + R() * 0.7), lx = Math.cos(ph) * rad * el, ly = Math.sin(ph) * rad;
        const X = cx + lx * Math.cos(rot) - ly * Math.sin(rot), Y = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
        j ? x.lineTo(X, Y) : x.moveTo(X, Y);
      }
      x.closePath(); x.fill();
    }
    x.restore(); x.globalAlpha = 1;
  }

  const cache = new Map();
  // the pattern as a square canvas; the record's back is the mirror image of its front
  // lab: the label radius (fraction of the record); patterns are laid out over the playing area, so a 7" (big label) still shows them
  S.mixCanvas = (mix, size, mirror, lab = 0.333) => {
    const key = JSON.stringify(mix) + '|' + size + '|' + lab;
    let c = cache.get(key);
    if (!c) {
      const W = Math.min(size, 560); c = S.newCanvas(W); const x = c.getContext('2d'), img = x.createImageData(W, W), d = img.data, p = painter(mix), h = W / 2;
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
        const px = (i + 0.5 - h) / h, py = (j + 0.5 - h) / h, r = Math.hypot(px, py);
        const k = (j * W + i) * 4; if (r > 1.02) { d[k + 3] = 0; continue; }
        const re = r <= lab ? r * 0.3 / lab : 0.3 + 0.7 * (r - lab) / (1 - lab), q = re / (r || 1);
        const col = p(Math.min(1, re), Math.atan2(py, px), px * q, py * q);
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      if (mix.style === 'splatter') drawSplats(x, W, mix, lab);
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      cache.set(key, c);
    }
    if (!mirror) return c;
    const m = S.newCanvas(c.width), mx = m.getContext('2d'); mx.translate(c.width, 0); mx.scale(-1, 1); mx.drawImage(c, 0, 0); return m;
  };
  S.mixLuma = mix => mix.colors.reduce((s, h) => s + S.luma(h), 0) / mix.colors.length;
  S.MIX_STYLES = STYLES; S.MIX_DEFAULTS = DEFAULTS;
})(window.S);
