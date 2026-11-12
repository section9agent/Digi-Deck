// Turntable stage (direct-drive deck look): per-song groove bands, 33 1/3 / 45 rpm platter, S-shaped tonearm that tracks the
// real position and can be dragged to pick a song / position, coloured + picture-disc records, 7" and 12" records, side flip.
(function (S) {
  // geometry as fractions of record radius
  const GEO = {
    lp: { musicOut: 0.935, musicIn: 0.375, label: 0.333, hole: 0.0238, gap: 0.0065 },
    seven: { musicOut: 0.95, musicIn: 0.60, label: 0.54, hole: 0.2143, gap: 0.009 }
  };
  const REC = 0.99;                                // 12" record radius in platter-radius units
  const ARM = { px: 1.36, py: -0.55, L: 1.42 };     // arm pivot + effective length, in platter radii from the platter centre
  const REST_R = 1.14;

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

  // Draw one record face. o: {seven, tracks, labelImg, color, pic, capacity}
  function drawRecord(size, o) {
    const g = o.seven ? GEO.seven : GEO.lp, color = o.color;
    const c = S.newCanvas(size), x = c.getContext('2d'), R = size / 2, px = R / 100;
    const disc = r => { x.beginPath(); x.arc(R, R, r * R, 0, Math.PI * 2); };
    const clear = color.id === 'clear' && !o.pic, pic = !!o.pic;
    const light = !clear && !pic && color.hex && S.luma(color.hex) > 0.55;
    const darkMul = pic ? 1.1 : clear ? 1.2 : light ? 1.0 : 2, lightMul = pic ? 0.7 : light ? 0.5 : 1;
    x.save(); disc(1); x.clip();
    if (pic) S.drawCover(x, o.pic, 0, 0, size, size);
    else if (clear) { x.fillStyle = 'rgba(176,196,212,.20)'; x.fillRect(0, 0, size, size); }
    else { x.fillStyle = color.hex; x.fillRect(0, 0, size, size); }
    x.restore();
    disc(0.985); x.strokeStyle = light ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.07)'; x.lineWidth = px * 0.8; x.stroke();

    const tracks = o.tracks, bands = computeBands(tracks, g, o.capacity);
    const landColor = pic ? 'rgba(255,255,255,.35)' : clear ? 'rgba(255,255,255,.4)' : light ? S.shade(color.hex, -0.25) : S.shade(color.hex === '#0d0d0d' ? '#1d1d1d' : color.hex, 0.07);
    const step = Math.max(1.1, px * 0.55);
    // lead-in: a few widely spaced grooves between the rim and the first song, where the needle is dropped
    { let ri = 0.985 * R, pitch = step * 2.4, n = 0;
      while (ri > g.musicOut * R + 1) {
        x.strokeStyle = n % 2 ? `rgba(255,255,255,${0.08 * lightMul})` : `rgba(0,0,0,${0.2 * darkMul})`;
        x.lineWidth = 0.8; x.beginPath(); x.arc(R, R, ri, 0, Math.PI * 2); x.stroke();
        ri -= pitch; pitch = Math.max(step, pitch * 0.82); n++;
      } }
    bands.forEach((b, k) => {
      for (let rr = b.outer * R, n = 0; rr > b.inner * R; rr -= step, n++) {
        const a = 0.05 + noise(n + k * 977) * 0.1;
        x.strokeStyle = n % 3 === 0 ? `rgba(255,255,255,${a * lightMul})` : `rgba(0,0,0,${a * darkMul})`;
        x.lineWidth = 0.7; x.beginPath(); x.arc(R, R, rr, 0, Math.PI * 2); x.stroke();
      }
      if (k < bands.length - 1) { // the smooth, glossy land between songs
        const gm = (b.inner - g.gap / 2) * R;
        x.strokeStyle = landColor; x.lineWidth = g.gap * R * 0.75; x.beginPath(); x.arc(R, R, gm, 0, Math.PI * 2); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 0.7; x.beginPath(); x.arc(R, R, gm, 0, Math.PI * 2); x.stroke();
      }
    });
    // lead-out: after the last song the groove spirals inward faster (wider pitch), ends in a smooth band and a locked groove
    // The side ends with ~1/4" of dead wax when it is full (musicIn sits 1/4" outside the label). The needle's last song ends at lastIn;
    // from there the groove spirals inward ever faster to the locked groove, just outside the label.
    const lastIn = bands.length ? bands[bands.length - 1].inner : g.musicOut;
    const leadEnd = g.label + 0.022;
    { const distPx = Math.max(2, Math.min(lastIn - leadEnd, 0.05) * R), p0 = step * 1.4, nL = Math.max(3, Math.round(Math.sqrt(distPx / step) * 1.8));
      const sum = q => Math.abs(q - 1) < 1e-6 ? p0 * nL : p0 * (Math.pow(q, nL) - 1) / (q - 1);
      let lo = 0.3, hi = 3; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (sum(m) < distPx) lo = m; else hi = m; }
      const q = (lo + hi) / 2; let rr = lastIn * R, pitch = p0;
      for (let n = 1; n <= nL; n++) {
        rr -= pitch; pitch *= q;
        x.strokeStyle = n % 2 ? `rgba(255,255,255,${0.07 * lightMul})` : `rgba(0,0,0,${0.22 * darkMul})`;
        x.lineWidth = 0.8; x.beginPath(); x.arc(R, R, Math.max(rr, leadEnd * R), 0, Math.PI * 2); x.stroke();
      } }
    x.strokeStyle = landColor; x.lineWidth = px * 0.9; x.beginPath(); x.arc(R, R, leadEnd * R - px * 0.8, 0, Math.PI * 2); x.stroke(); // locked groove
    x.strokeStyle = pic ? 'rgba(0,0,0,.2)' : light ? 'rgba(0,0,0,.14)' : 'rgba(0,0,0,.4)'; x.lineWidth = px * 0.5;
    for (let r2 = leadEnd - 0.012; r2 > g.label + 0.004; r2 -= 0.009) { disc(r2); x.stroke(); }   // dead wax / run-out area

    if (!pic) { // paper label
      x.save(); disc(g.label); x.clip();
      x.fillStyle = '#e8e0cf'; x.fillRect(0, 0, size, size);
      if (o.labelImg) S.drawCover(x, o.labelImg, R - g.label * R, R - g.label * R, g.label * R * 2, g.label * R * 2);
      x.restore();
      disc(g.label); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = px * 0.8; x.stroke();
    }
    x.save(); x.globalCompositeOperation = 'destination-out'; disc(g.hole); x.fill(); x.restore();
    if (o.seven) drawAdapter(x, R, R, g.hole * R);
    return { canvas: c, bands, lockR: leadEnd - 0.003, lastIn, leadR: (g.musicOut + 0.985) / 2 };
  }

  function drawPlatter(size) {
    const c = S.newCanvas(size), x = c.getContext('2d'), R = size / 2;
    const disc = r => { x.beginPath(); x.arc(R, R, r * R, 0, Math.PI * 2); };
    disc(1); x.fillStyle = '#e4e7ea'; x.fill();
    disc(0.995); x.fillStyle = '#17191c'; x.fill();
    // strobe dot rows
    [[0.935, 170], [0.955, 178], [0.975, 186]].forEach(([r, n], row) => {
      for (let i = 0; i < n; i++) {
        const a = (i + (row % 2 ? 0.5 : 0)) / n * Math.PI * 2;
        x.fillStyle = '#d3d7dc'; x.beginPath(); x.arc(R + Math.cos(a) * r * R, R + Math.sin(a) * r * R, R * 0.0058, 0, Math.PI * 2); x.fill();
      }
    });
    disc(0.915); x.fillStyle = '#c9ccd1'; x.fill();
    disc(0.905); const g = x.createRadialGradient(R, R, R * 0.1, R, R, R * 0.9); g.addColorStop(0, '#273044'); g.addColorStop(1, '#1a202e'); x.fillStyle = g; x.fill();
    disc(0.86); x.strokeStyle = 'rgba(160,175,200,.35)'; x.lineWidth = R * 0.006; x.stroke();
    x.fillStyle = 'rgba(150,165,190,.16)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${R * 0.17}px Georgia, "Times New Roman", serif`;
    x.save(); x.translate(R, R - R * 0.2); x.fillText('Digi-Deck', 0, 0); x.restore();
    x.save(); x.translate(R, R + R * 0.2); x.scale(-1, -1); x.fillText('Digi-Deck', 0, 0); x.restore();
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
      this.fader = e('div', { class: 'tt-fader' }, e('div', { class: 'tt-fader-knob' }));
      this.sideLed = e('div', { class: 'tt-side' }, 'SIDE A');
      this.flipBtn = e('button', { class: 'tt-flipbtn', title: 'Flip record', onclick: () => S.app.manualFlip() }, '↻ FLIP');
      this.tt.append(this.plinth, this.platter, this.recWrap, this.spindle, this.power, this.btn, this.s33, this.s45, this.fader, this.sideLed, this.flipBtn, this.arm.svg);
      this.host.append(this.tt);
      this.recWrap.addEventListener('click', ev => this.recordClick(ev));
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
      lin('silver', [[0, '#f7f8f9'], [0.5, '#c0c4c9'], [1, '#8d9197']]);
      lin('silverH', [[0, '#8d9197'], [0.4, '#eceef0'], [1, '#9a9ea4']], 1, 0);
      lin('blk', [[0, '#46484d'], [0.45, '#16171a'], [1, '#050506']]);
      lin('well', [[0, '#1d1e21'], [1, '#08080a']], 1, 1);
      rad('plate', [[0, '#f1f2f4'], [0.65, '#cdd1d6'], [1, '#9fa3aa']]);
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
        A.base.append(line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, { stroke: '#d9dadc', 'stroke-width': 1 }));
      }
      A.base.append(e('circle', { cx: cx - U * 0.006, cy: cy + U * 0.004, r: U * 0.142, fill: 'url(#plate)', stroke: '#6d7177', 'stroke-width': 1 }),
        e('circle', { cx: cx - U * 0.006, cy: cy + U * 0.004, r: U * 0.106, fill: 'none', stroke: '#8e9298', 'stroke-width': 1.1 }),
        e('circle', { cx: cx - U * 0.006, cy: cy + U * 0.004, r: U * 0.074, fill: 'rgba(255,255,255,.2)', stroke: '#a3a7ad', 'stroke-width': 1 }));
      // arm-rest cut-out + curved cable slot (the black arc visible on the plate)
      A.base.append(e('path', { d: `M ${cx - U * 0.1} ${cy + U * 0.03} A ${U * 0.103} ${U * 0.103} 0 0 0 ${cx - U * 0.03} ${cy + U * 0.1}`, fill: 'none', stroke: '#101012', 'stroke-width': U * 0.016, 'stroke-linecap': 'round' }));
      // anti-skating dial
      const sx = cx + U * 0.088, sy = cy - U * 0.026, sr = U * 0.034;
      A.base.append(e('rect', { x: sx - U * 0.07, y: sy - U * 0.02, width: U * 0.07, height: U * 0.04, fill: 'url(#silver)', stroke: '#777b81', 'stroke-width': 1 }),
        e('circle', { cx: sx, cy: sy, r: sr, fill: '#121214', stroke: '#b4b8bd', 'stroke-width': 1.6 }), e('circle', { cx: sx, cy: sy, r: sr * 0.62, fill: '#1c1c1f', stroke: '#2e2f33', 'stroke-width': 1 }));
      for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; A.base.append(line(sx + Math.cos(a) * sr * 0.7, sy + Math.sin(a) * sr * 0.7, sx + Math.cos(a) * sr * (k % 4 ? 0.88 : 0.94), sy + Math.sin(a) * sr * (k % 4 ? 0.88 : 0.94), { stroke: '#eeeeee', 'stroke-width': 0.8 })); }
      // lock lever (black, top) and lift lever (long black lever lower right)
      A.base.append(e('rect', { x: cx + U * 0.018, y: cy - U * 0.118, width: U * 0.02, height: U * 0.052, rx: U * 0.009, fill: 'url(#blk)', stroke: '#555', 'stroke-width': 0.8, transform: `rotate(-14 ${cx + U * 0.028} ${cy - U * 0.09})` }),
        e('circle', { cx: cx + U * 0.09, cy: cy + U * 0.08, r: U * 0.015, fill: 'url(#silver)', stroke: '#6f7379', 'stroke-width': 1 }),
        line(cx + U * 0.09, cy + U * 0.08, cx + U * 0.15, cy + U * 0.165, { stroke: '#0e0e10', 'stroke-width': U * 0.017, 'stroke-linecap': 'round' }),
        line(cx + U * 0.09, cy + U * 0.08, cx + U * 0.15, cy + U * 0.165, { stroke: 'rgba(255,255,255,.18)', 'stroke-width': U * 0.004, 'stroke-linecap': 'round', transform: `translate(${-U * 0.003} 0)` }));
      // ---- the swinging arm, drawn at angle 0 (stylus straight along +x from the pivot)
      const hs = U * 0.17, psi = 0.34, cs = Math.cos(psi), sn = Math.sin(psi);
      const Tx = px + L, Ty = py, Ex = Tx - hs * cs, Ey = Ty - hs * sn;
      // counterweight: black knurled barrel with a numbered dial ring and a silver end cap
      const cwL = U * 0.11, cwW = U * 0.088, cwX = px - U * 0.22;
      A.grp.append(e('rect', { x: cwX - U * 0.022, y: py - cwW * 0.38, width: U * 0.026, height: cwW * 0.76, rx: U * 0.006, fill: 'url(#silver)', stroke: '#6c7076', 'stroke-width': 1 }),
        e('rect', { x: cwX, y: py - cwW / 2, width: cwL, height: cwW, rx: U * 0.008, fill: 'url(#blk)', stroke: '#6a6d73', 'stroke-width': 1 }));
      for (let k = 1; k < 8; k++) A.grp.append(line(cwX + U * 0.004, py - cwW / 2 + k * cwW / 8, cwX + cwL * 0.7, py - cwW / 2 + k * cwW / 8, { stroke: 'rgba(255,255,255,.12)', 'stroke-width': 0.8 }));
      A.grp.append(e('rect', { x: cwX + cwL * 0.7, y: py - cwW / 2, width: cwL * 0.3, height: cwW, fill: '#0c0c0e', stroke: '#8b8e94', 'stroke-width': 1 }));
      for (let k = 0; k <= 16; k++) A.grp.append(line(cwX + cwL * 0.72, py - cwW / 2 + (k + 0.5) * cwW / 17, cwX + cwL * (k % 4 ? 0.8 : 0.88), py - cwW / 2 + (k + 0.5) * cwW / 17, { stroke: '#e4e5e7', 'stroke-width': 0.9 }));
      // rear silver tube into the pivot tower
      A.grp.append(e('rect', { x: cwX + cwL, y: py - U * 0.021, width: px - (cwX + cwL), height: U * 0.042, fill: 'url(#silver)', stroke: '#757980', 'stroke-width': 1 }));
      // yoke / height bracket: a silver bar across the tower, with its screw
      A.grp.append(e('rect', { x: px - U * 0.135, y: py - U * 0.05, width: U * 0.15, height: U * 0.03, rx: U * 0.012, fill: 'url(#silver)', stroke: '#6d7177', 'stroke-width': 1, transform: `rotate(24 ${px - U * 0.06} ${py - U * 0.035})` }),
        e('circle', { cx: px - U * 0.03, cy: py - U * 0.057, r: U * 0.0085, fill: '#d6d8db', stroke: '#555', 'stroke-width': 1 }),
        e('rect', { x: px - U * 0.012, y: py - U * 0.046, width: U * 0.075, height: U * 0.026, rx: U * 0.01, fill: 'url(#silver)', stroke: '#6d7177', 'stroke-width': 1, transform: `rotate(24 ${px + U * 0.02} ${py - U * 0.033})` }));
      // tube: chrome, bows away from the platter and comes back to the headshell (offset angle psi)
      const d = `M ${f(px)} ${f(py)} C ${f(px + 0.3 * L)} ${f(py)} ${f(px + 0.38 * L)} ${f(py - 0.095 * L)} ${f(px + 0.55 * L)} ${f(py - 0.095 * L)} C ${f(px + 0.7 * L)} ${f(py - 0.095 * L)} ${f(Ex - 0.09 * L * cs)} ${f(Ey - 0.09 * L * sn)} ${f(Ex)} ${f(Ey)}`;
      const tube = (w, c, dy = 0) => e('path', { d, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'butt', transform: dy ? `translate(0 ${f(dy)})` : '' });
      A.grp.append(tube(U * 0.034, '#4a4e54'), tube(U * 0.03, '#b9bdc3'), tube(U * 0.015, '#f4f5f7', -U * 0.006), tube(U * 0.004, '#6b6f75', U * 0.0105), tube(U * 0.003, '#ffffff', -U * 0.0075));
      // tower cap on top of the pivot
      A.grp.append(e('circle', { cx: px, cy: py, r: U * 0.03, fill: 'url(#plate)', stroke: '#6d7177', 'stroke-width': 1.2 }), e('circle', { cx: px, cy: py, r: U * 0.018, fill: '#9a9ea4', stroke: '#5b5f65', 'stroke-width': 1 }), e('circle', { cx: px - U * 0.004, cy: py - U * 0.004, r: U * 0.007, fill: '#eef0f2' }));
      // black cable clip a little way along the tube
      const bz = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
      const t0 = 0.34, qx = bz(t0, px, px + 0.3 * L, px + 0.38 * L, px + 0.55 * L), qy = bz(t0, py, py, py - 0.095 * L, py - 0.095 * L);
      A.grp.append(e('rect', { x: qx - U * 0.012, y: qy - U * 0.026, width: U * 0.024, height: U * 0.052, rx: U * 0.006, fill: 'url(#blk)', stroke: '#6a6d73', 'stroke-width': 1 }));
      // knurled silver collar, then the cartridge photo (finger lift, collar, blue stylus guard) at the offset angle
      const col = e('g', { transform: `translate(${f(Ex)} ${f(Ey)}) rotate(${f(psi * 180 / Math.PI)})` });
      col.append(e('rect', { x: -U * 0.034, y: -U * 0.0185, width: U * 0.036, height: U * 0.037, rx: U * 0.004, fill: 'url(#silverH)', stroke: '#6b6f75', 'stroke-width': 1 }));
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
      place(this.platter, U * 1.08);
      const rd = U * REC * (this.seven ? 7 / 12 : 1);
      place(this.recWrap, rd); this.recD = rd;
      place(this.spindle, U * 0.028);
      at(this.power, 0.04, 0.76, 0.075, 0.075);
      at(this.btn, 0.025, 1.0, 0.16, 0.085); at(this.s33, 0.025, 0.9, 0.075, 0.07); at(this.s45, 0.105, 0.9, 0.075, 0.07);
      at(this.fader, 1.43, 0.5, 0.05, 0.46); at(this.sideLed, 1.12, 0.985, 0.12, 0.05); at(this.flipBtn, 1.255, 0.985, 0.11, 0.05);
      Object.assign(this.arm.svg.style, { width: PW + 'px', height: PH + 'px' });
      this.arm.svg.setAttribute('viewBox', `0 0 ${PW} ${PH}`);
      const Rp = U / 2, px = cx + ARM.px * Rp, py = cy + ARM.py * Rp, L = ARM.L * Rp;
      this.pivot = { x: px, y: py };
      this.rebuildArm(U, px, py, L);
      const lab = (this.seven ? GEO.seven : GEO.lp).label;
      this.sheen.style.setProperty('--lab', (lab * 100 + 0.8) + '%');
      this.tt.style.setProperty('--u', U + 'px');
      this.applyArm();
    }
    applyArm() {
      if (!this.pivot) return;
      const deg = armAngle(this.armR);
      this.arm.grp.setAttribute('transform', `rotate(${deg} ${this.pivot.x} ${this.pivot.y})`);
      const off = 2 + 12 * this.lift;
      this.arm.svg.style.filter = `drop-shadow(${off * 0.6}px ${off}px ${2 + off * 0.5}px rgba(0,0,0,${0.5 - 0.2 * this.lift}))`;
      this.arm.svg.style.transformOrigin = `${this.pivot.x}px ${this.pivot.y}px`;
      this.arm.svg.style.transform = `scale(${1 + 0.03 * this.lift})`;
    }

    // ---------------------------------------------------------------- stylus drag / click-to-place
    get geo() { return this.seven ? GEO.seven : GEO.lp; }
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
        const rRel = r / (REC * (this.seven ? 7 / 12 : 1));
        if (rRel > 1.02) S.app.stop();                  // lifted off the record
        else this.seekPick(this.pick(rRel));
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }
    recordClick(ev) {
      const b = this.recWrap.getBoundingClientRect();
      const rRel = Math.hypot(ev.clientX - (b.left + b.width / 2), ev.clientY - (b.top + b.height / 2)) / (b.width / 2);
      const g = this.geo;
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
      const size = this.seven ? 700 : 1000;
      const { canvas, bands, lockR, leadR, lastIn } = drawRecord(size, { seven: this.seven, tracks, labelImg, color, pic, capacity: Math.max(total, this.seven ? S.SEVEN_CAPACITY : S.sideLimit(this.album, 'vinyl')) });
      canvas.className = 'tt-canvas';
      this.faceEls[face].firstChild.replaceChildren(canvas);
      this.faces[face] = { side, bands, lockR, leadR, lastIn };
    }
    visIndex() { return Math.round(this.rot / 180) % 2; }

    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'vinyl');
      this.info = S.releaseInfo(album, 'vinyl'); this.seven = this.info.seven; this.rpm = this.info.rpm;
      this.tt.classList.toggle('seven', this.seven);
      const sides = S.sidesOf(album.tracks);
      this.rot = 0; this.flipper.style.transform = 'rotateY(0deg)'; this.faces = []; this.unsettle();
      const first = sides[0] || 'A', pair = S.partnerSide(first);     // the other side of the same record
      await this.renderFace(0, first);
      await this.renderFace(1, sides.includes(pair) ? pair : sides[1] || pair);
      this.s33.classList.toggle('on', this.rpm < 40); this.s45.classList.toggle('on', this.rpm >= 40);
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
      this.busy = true; this.unsettle();
      const hidden = this.visIndex() ^ 1, swap = S.discOf(side) !== S.discOf(this.currentSide());
      if (this.faces[hidden]?.side !== side) await this.renderFace(hidden, side);
      await new Promise(r => setTimeout(r, 650));          // arm lifts away first
      if (swap) {
        await this.swapRecord(hidden, side);
        this.settle(); this.sideLed.textContent = `SIDE ${side}`; this.updateFlipBtn();
        await new Promise(r => setTimeout(r, 300)); this.busy = false; return;
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
      await new Promise(r => setTimeout(r, 350));
      this.busy = false;
    }

    needleRadius(st) {
      const f = this.faces[this.visIndex()];
      const sc = REC * (this.seven ? 7 / 12 : 1);
      if (f && st.vphase === 'leadin') {        // set down on the lead-in, then creep across to the first groove while the drop recording settles
        const t = S.clamp(((st.leadFrac || 0) - 0.3) / 0.7, 0, 1);
        return (f.leadR + ((f.bands[0] ? f.bands[0].outer : f.leadR) - f.leadR) * t) * sc;
      }
      if (f && st.vphase === 'runout') {         // the needle leaves the last song and is pulled faster and faster inward to the locked groove
        const t = S.clamp(st.runFrac || 0, 0, 1);
        return (f.lastIn + (f.lockR - f.lastIn) * Math.pow(t, 1.6)) * sc;
      }
      if (f && st.vphase === 'locked') return f.lockR * sc;
      if (!f || st.trackIndex < 0) return null;
      const band = f.bands.find(b => b.i === st.trackIndex);
      if (!band) return null;
      const frac = S.clamp(st.trackDur > 0 ? st.trackTime / st.trackDur : 0, 0, 1);
      return (band.outer + (band.inner - band.outer) * frac) * REC * (this.seven ? 7 / 12 : 1);
    }

    frame(dt, st) {
      const target = (st.playing || st.vphase) && !this.busy ? 1 : 0;
      this.spin += (target - this.spin) * (1 - Math.exp(-dt * (target ? 2.0 : 0.8)));
      if (!target && this.spin < 0.002) this.spin = 0;
      this.angle = (this.angle + this.rpm * 6 * dt * this.spin) % 360;
      // both faces turn clockwise as seen from above (the flipped face is already un-mirrored by the flip itself)
      this.faceEls[0].firstChild.style.transform = `rotate(${this.angle}deg)`;
      this.faceEls[1].firstChild.style.transform = `rotate(${this.angle}deg)`;
      this.platter.style.transform = `rotate(${this.angle}deg)`;
      let tR = REST_R, lift = 1;
      if (this.drag) { tR = this.drag.r; lift = 0.55; }
      else if (!this.busy) {
        const nr = this.needleRadius(st);
        if (nr != null) { tR = nr; lift = (st.playing || st.vphase) ? 0 : 1; }
      }
      const k = this.drag ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * (lift === 0 ? 3.5 : 3));
      this.armR += (tR - this.armR) * k;
      this.lift += (lift - this.lift) * (1 - Math.exp(-dt * 7));
      this.applyArm();
      this.tt.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); this.tt.remove(); }
  }

  S.stages = S.stages || {};
  S.stages.vinyl = VinylStage;
  S.vinyl = { armAngle, GEO, ARM, computeBands, REC };
})(window.S);
