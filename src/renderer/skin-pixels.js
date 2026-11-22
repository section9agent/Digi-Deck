// Recolours player artwork for a theme (see skin.js). Shared by the page and the background worker (skin-worker.js),
// so it only uses its own arguments.
self.recolorPixels = function recolorPixels(p, W, H, d, all) {
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lut = (stops, g) => { const out = new Float32Array(256 * 3), st = stops.map(hex), n = st.length - 1;
    for (let i = 0; i < 256; i++) { const t = Math.pow(Math.min(1, Math.max(0, (i / 255 - 0.15) / 0.85)), g) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k; for (let c = 0; c < 3; c++) out[i * 3 + c] = st[k][c] + (st[k + 1][c] - st[k][c]) * f; } return out; };
  const ss = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
  let rs = 7; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const L1 = lut(d.ramp, d.g || 1), LW = d.wood ? lut(d.wood, 1) : null, sc = Math.max(W, H) / 2000, N = W * H;
  const mask = new Float32Array(N), Lv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * 4; if (!p[o + 3]) continue;
    const r = p[o] / 255, g = p[o + 1] / 255, b = p[o + 2] / 255, mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b), L = (mx + mn) / 2;
    Lv[i] = L;
    mask[i] = all ? Math.min(1, ss(0.04, 0.12, b - r) * ss(0.2, 0.35, L) + (L > 0.55 ? 0.6 : 0)) : ss(0.22, 0.38, L) * ss(0.04, 0.12, b - r);
  }
  const rowN = new Float32Array(H); for (let y = 0; y < H; y++) rowN[y] = (rnd() - 0.5) * 2;
  const strk = new Float32Array(N);
  if (d.tex === 'brushed' || d.tex === 'brass' || d.tex === 'soft') for (let i = 0; i < 260 * N / (2000 * 880); i++) {
    const y = Math.floor(rnd() * H), x0 = rnd() * W, ln = (40 + rnd() * 340) * sc, v = (rnd() - 0.3) * 0.08 * (d.tex === 'soft' ? 0.4 : 1);
    for (let x = Math.max(0, x0 | 0); x < Math.min(W, x0 + ln); x++) strk[y * W + x] += v;
  }
  if (d.tex === 'brass') for (let i = 0; i < 280 * sc * sc; i++) {
    let x = rnd() * W, y = rnd() * H; const a = rnd() * Math.PI, ln = (20 + rnd() * 120) * sc, v = 0.06 + rnd() * 0.08, dx = Math.cos(a), dy = Math.sin(a);
    for (let k = 0; k < ln; k++) { const xi = x | 0, yi = y | 0; if (xi >= 0 && yi >= 0 && xi < W && yi < H) strk[yi * W + xi] += v; x += dx; y += dy; }
  }
  // printed text sitting on the metal: on the dark themes it is lightened so it can still be read
  let near = null;
  if (d.ink && !all) {
    const I = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += mask[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
    const R = Math.max(3, Math.round(6 * sc)); near = (x, y) => { const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1); return (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0)); };
  }
  const ink = d.ink ? hex(d.ink) : null;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const o = i * 4; if (!p[o + 3]) continue;
    const mm = mask[i], L = Lv[i];
    if (mm > 0.002) {
      const j = Math.round(L * 255) * 3; let cr = L1[j], cg = L1[j + 1], cb = L1[j + 2], k = 1, add = 0;
      if (d.tex === 'wood') { const gr = Math.sin(y * 0.35 / sc + Math.sin(x * 0.01 / sc) * 8 + Math.sin(x * 0.003 / sc + y * 0.02 / sc) * 14) * 0.5 + 0.5; k = 0.8 + 0.32 * gr; }
      else if (d.tex === 'flake') add = (rnd() - 0.5) * 22 + (rnd() < 0.0025 ? 90 : 0);
      else add = rowN[y] * (d.tex === 'soft' ? 4 : 7) + strk[i] * 255;
      if (d.tex === 'brass') { const pt = Math.sin(x * 0.004 / sc + Math.sin(y * 0.006 / sc) * 3) * Math.sin(y * 0.005 / sc + x * 0.002 / sc); if (pt > 0.55) { k *= 0.86; cg += 6; } }
      cr = cr * k + add; cg = cg * k + add; cb = cb * k + add;
      p[o] = p[o] * (1 - mm) + cr * mm; p[o + 1] = p[o + 1] * (1 - mm) + cg * mm; p[o + 2] = p[o + 2] * (1 - mm) + cb * mm;
    } else if (near && L < 0.3 && near(x, y) > 0.5) {
      const a = Math.min(1, (0.3 - L) / 0.2); p[o] = p[o] * (1 - a) + ink[0] * a; p[o + 1] = p[o + 1] * (1 - a) + ink[1] * a; p[o + 2] = p[o + 2] * (1 - a) + ink[2] * a;
    } else if (LW && !all) {                                  // walnut trim
      const r = p[o] / 255, g = p[o + 1] / 255, b = p[o + 2] / 255, rb = r - b;
      if (rb > 0.1 && g >= b - 0.02 && g <= r && (g - b) / rb < 0.8) {
        const w = ss(0.1, 0.22, rb) * ss(0.04, 0.1, L) * (1 - ss(0.62, 0.75, L));
        if (w > 0.01) { const j = Math.round(Math.min(1, L * 1.6) * 255) * 3; p[o] = p[o] * (1 - w) + LW[j] * w; p[o + 1] = p[o + 1] * (1 - w) + LW[j + 1] * w; p[o + 2] = p[o + 2] * (1 - w) + LW[j + 2] * w; }
      }
    }
  }
  if (d.edge) {
    const ec = hex(d.edge), rad = Math.max(1, Math.round(1.5 * sc));
    for (let y = rad; y < H - rad; y++) for (let x = rad; x < W - rad; x++) {
      const i = y * W + x, e = Math.abs(mask[i - rad] - mask[i + rad]) + Math.abs(mask[i - rad * W] - mask[i + rad * W]);
      if (e > 0.35) { const o = i * 4, a = Math.min(1, e); p[o] = p[o] * (1 - a) + ec[0] * a; p[o + 1] = p[o + 1] * (1 - a) + ec[1] * a; p[o + 2] = p[o + 2] * (1 - a) + ec[2] * a; }
    }
  }
};
