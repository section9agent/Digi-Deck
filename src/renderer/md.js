// MiniDisc player stage. A clear-window portable (Panasonic SJ-MJ style, unbranded) with an LCD stick remote beside it.
// The disc slides in from the bottom; once it is in, the shutter (slider) on its right side opens and the inner disc spins
// at 900 rpm at the start of the disc, slowing to 400 rpm at the edge (constant linear velocity, like the CD). 80 minutes a disc.
// Three disc styles: retail (black shell, big printed label, no shutter on the label side), LED printed (the picture covers the
// whole shell, slider included; see-through parts show the spinning disc), standard (clear recordable with a paper sticker).
// Every picture the stage uses is in assets/md/*.png (generated from the code below on first export); edit them and they are used.
(function (S) {
  const A = '../../assets/md/';
  // the disc, in art pixels: 2 13/16 x 2 11/16 in at 400 dpi; the inner disc is 2 1/2 in across
  const MW = 1125, MH = 1075, DISC_R = 500, DCX = 0.5 * MW, DCY = 0.5 * MH;
  const RECT = {                                                     // fractions of the disc art (measured on the supplied layouts)
    stdLabel: [0.055, 0.125, 0.565, 0.905], retailLabel: [0.055, 0.134, 0.941, 0.923],
    slider: [0.585, 0.336, 1.0, 0.654], win: [0.625, 0.37, 0.955, 0.625], travel: 0.30   // slider slides down by 30% of the height
  };
  const RPM_START = 900, RPM_END = 400, K = Math.pow(RPM_START / RPM_END, 2) - 1;
  const mk = (w, h) => S.newCanvas(Math.round(w), Math.round(h || w));
  const cache = {};
  const ld = src => cache[src] || (cache[src] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  const rr = (x, X, Y, W, H, r) => { x.beginPath(); x.roundRect(X, Y, W, H, r); };
  const shellPath = x => { x.beginPath(); x.roundRect(0, 0, MW, MH, [MW * 0.04, MW * 0.04, MW * 0.012, MW * 0.012]); };
  const px = r => [r[0] * MW, r[1] * MH, (r[2] - r[0]) * MW, (r[3] - r[1]) * MH];
  // the MiniDisc logo (assets/md/minidisc-logo.png, and a white copy for dark plastic); loaded before anything is drawn
  const LOGO = {};
  const logoReady = Promise.all([['black', 'minidisc-logo.png'], ['white', 'minidisc-logo-white.png']].map(async ([k, f]) => { LOGO[k] = await ld(A + f); }));
  const logo = (x, X, Y, w, col = 'black', alpha = 1) => { const im = LOGO[col]; if (!im) return; x.save(); x.globalAlpha = alpha; x.drawImage(im, X, Y, w, w * im.naturalHeight / im.naturalWidth); x.restore(); };
  const noise = i => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

  // ---------------------------------------------------------------- pictures (procedural; a PNG in assets/md overrides each one)
  const ART = {
    // the inner disc: silver-gold data area, a clear ring and the metal clamping plate (it turns, so it carries marks that show it)
    disc() {
      const c = mk(1000), x = c.getContext('2d'), R = 500;
      const g = x.createRadialGradient(R, R, 60, R, R, R);
      g.addColorStop(0, '#d7d2c6'); g.addColorStop(0.45, '#c9bfa8'); g.addColorStop(0.8, '#b8ad94'); g.addColorStop(1, '#a89e86');
      x.fillStyle = g; x.beginPath(); x.arc(R, R, R, 0, 7); x.fill();
      for (let i = 0; i < 70; i++) {                                   // faint radial streaks (uneven, so the turning shows)
        const a = noise(i) * Math.PI * 2, w = 0.004 + noise(i + 99) * 0.02;
        x.fillStyle = `rgba(${noise(i + 7) > 0.5 ? '255,255,255' : '60,50,30'},${0.03 + noise(i + 3) * 0.05})`;
        x.beginPath(); x.moveTo(R, R); x.arc(R, R, R * 0.995, a, a + w); x.closePath(); x.fill();
      }
      for (let r = R * 0.33; r < R * 0.985; r += 3) { x.strokeStyle = `rgba(0,0,0,${0.02 + noise(r) * 0.03})`; x.lineWidth = 1; x.beginPath(); x.arc(R, R, r, 0, 7); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 3; x.beginPath(); x.arc(R, R, R * 0.99, 0, 7); x.stroke();
      x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,.72)'; x.beginPath(); x.arc(R, R, R * 0.32, 0, 7); x.fill(); x.restore();   // clear ring
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; x.beginPath(); x.arc(R, R, R * 0.32, 0, 7); x.stroke();
      x.save(); x.translate(R, R); x.fillStyle = 'rgba(30,30,40,.55)'; x.font = '600 22px Helvetica, Arial, sans-serif'; x.textAlign = 'center';   // moulded ring text
      const txt = 'MD AUDIO · 80 · DIGI-DECK · 0451-27 · ', step = (Math.PI * 2) / txt.length;
      [...txt].forEach((ch, i) => { x.save(); x.rotate(i * step); x.fillText(ch, 0, -R * 0.26); x.restore(); }); x.restore();
      const hg = x.createRadialGradient(R - 25, R - 30, 10, R, R, R * 0.2);                                          // metal clamping plate
      hg.addColorStop(0, '#f4f5f6'); hg.addColorStop(0.6, '#a9adb3'); hg.addColorStop(1, '#6f747a');
      x.fillStyle = hg; x.beginPath(); x.arc(R, R, R * 0.2, 0, 7); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.beginPath(); x.arc(R, R, R * 0.2, 0, 7); x.stroke(); x.beginPath(); x.arc(R, R, R * 0.13, 0, 7); x.stroke();
      x.fillStyle = '#2b2d30'; x.beginPath(); x.arc(R, R, R * 0.035, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(R + R * 0.06, R - 6, R * 0.08, 12);                                   // a mark on the plate
      return c;
    },
    // the rainbow the light makes on the disc (it stays still while the disc turns)
    sheen() {
      const c = mk(1000), x = c.getContext('2d'), R = 500;
      const cg = x.createConicGradient(-0.6, R, R);
      [['#ff4fd8', 0], ['#ffe14a', 0.08], ['#5cff9a', 0.14], ['#4ad2ff', 0.2], ['#ffffff00', 0.27], ['#ffffff00', 0.48], ['#ff9a3c', 0.55], ['#fff36a', 0.6], ['#6dffb5', 0.66], ['#58b8ff', 0.72], ['#ffffff00', 0.8], ['#ffffff00', 1]].forEach(([col, p]) => cg.addColorStop(p, col));
      x.fillStyle = cg; x.beginPath(); x.arc(R, R, R, 0, 7); x.arc(R, R, R * 0.33, 0, 7, true); x.fill();
      return c;
    },
    // standard recordable shell: clear plastic with its ribs, the arrow, and the "80 MiniDisc" mark
    shellStd() {
      const c = mk(MW, MH), x = c.getContext('2d');
      shellPath(x); x.fillStyle = 'rgba(214,224,232,.30)'; x.fill();
      x.save(); shellPath(x); x.clip();
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 10; shellPath(x); x.stroke();
      x.strokeStyle = 'rgba(120,130,140,.35)'; x.lineWidth = 3; rr(x, 22, 22, MW - 44, MH - 44, 30); x.stroke();
      for (let i = 0; i < 9; i++) { x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; x.beginPath(); x.arc(70 + i * 105, 55, 14, 0, 7); x.stroke(); }
      for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(45, 200 + i * 130, 12, 0, 7); x.stroke(); x.beginPath(); x.arc(MW - 45, 120 + i * 60, 10, 0, 7); x.stroke(); }
      x.strokeStyle = 'rgba(160,170,180,.45)'; x.lineWidth = 4; x.beginPath(); x.arc(DCX, DCY, DISC_R + 14, 0, 7); x.stroke();
      x.fillStyle = 'rgba(40,40,45,.8)'; x.beginPath(); x.moveTo(DCX, 80); x.lineTo(DCX - 22, 118); x.lineTo(DCX + 22, 118); x.closePath(); x.fill();   // insert arrow
      logo(x, MW * 0.753, MH * 0.117, MW * 0.169, 'black', 0.85);
      x.restore();
      const [wx, wy, ww, wh] = px(RECT.win); x.save(); x.globalCompositeOperation = 'destination-out'; rr(x, wx, wy, ww, wh, 14); x.fill(); x.restore();
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; rr(x, wx, wy, ww, wh, 14); x.stroke();
      return c;
    },
    // retail shell: black, the label set into a shallow recess, arrow and a small moulded MiniDisc mark at the top
    shellRetail() {
      const c = mk(MW, MH), x = c.getContext('2d');
      shellPath(x); const g = x.createLinearGradient(0, 0, MW, MH); g.addColorStop(0, '#26272a'); g.addColorStop(1, '#141517'); x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 6; shellPath(x); x.stroke();
      const [lx, ly, lw, lh] = px(RECT.retailLabel); rr(x, lx - 8, ly - 8, lw + 16, lh + 16, 10); x.fillStyle = '#0d0e10'; x.fill();
      x.fillStyle = '#0b0b0c'; x.beginPath(); x.moveTo(MW * 0.11, MH * 0.035); x.lineTo(MW * 0.075, MH * 0.1); x.lineTo(MW * 0.145, MH * 0.1); x.closePath(); x.fill();
      x.fillRect(MW * 0.1, MH * 0.1, MW * 0.02, MH * 0.03);
      logo(x, MW * 0.2, MH * 0.022, MW * 0.085, 'white', 0.22);                               // moulded into the black plastic
      return c;
    },
    // the metal slider (shutter) of a recordable disc
    slider() {
      const [, , w, h] = px(RECT.slider), c = mk(w, h), x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c9ccd0'); g.addColorStop(0.5, '#a9adb2'); g.addColorStop(1, '#8e9298'); x.fillStyle = g; rr(x, 0, 0, w, h, 12); x.fill();
      for (let i = 0; i < h; i += 2) { x.fillStyle = `rgba(255,255,255,${0.03 + noise(i) * 0.05})`; x.fillRect(0, i, w, 1); }
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; rr(x, 1.5, 1.5, w - 3, h - 3, 12); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 3; rr(x, w * 0.1, h * 0.12, w * 0.82, h * 0.76, 8); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.25)'; rr(x, w * 0.1 + 3, h * 0.12 + 3, w * 0.82, h * 0.76, 8); x.stroke();
      // printed on the slider: the 80 with a small "Minutes" beside it, "Recordable MD" centred under it
      x.fillStyle = 'rgba(30,30,34,.85)'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.font = `800 ${h * 0.42}px Helvetica, Arial, sans-serif`; const w80 = x.measureText('80').width;
      x.font = `700 ${h * 0.11}px Helvetica, Arial, sans-serif`; const wm = x.measureText('Minutes').width, gap = h * 0.04, tot = w80 + gap + wm, x0 = (w - tot) / 2;
      x.textAlign = 'left'; x.font = `800 ${h * 0.42}px Helvetica, Arial, sans-serif`; x.fillText('80', x0, h * 0.56);
      x.font = `700 ${h * 0.11}px Helvetica, Arial, sans-serif`; x.fillText('Minutes', x0 + w80 + gap, h * 0.56);
      x.textAlign = 'center'; x.font = `600 ${h * 0.1}px Helvetica, Arial, sans-serif`; x.fillText('Recordable MD', w / 2, h * 0.75);
      return c;
    },
    // the player body: silver, a coloured bezel round a big clear window (the window is cut out)
    body() {
      const W = 1400, H = 1360, c = mk(W, H), x = c.getContext('2d');
      rr(x, 0, 0, W, H, 120); const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#e8ebee'); g.addColorStop(0.5, '#c4c9ce'); g.addColorStop(1, '#a9afb5'); x.fillStyle = g; x.fill();
      x.save(); rr(x, 0, 0, W, H, 120); x.clip(); for (let i = 0; i < W; i += 2) { x.fillStyle = `rgba(255,255,255,${0.025 + noise(i) * 0.05})`; x.fillRect(i, 0, 1, H); } x.restore();
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 6; rr(x, 3, 3, W - 6, H - 6, 118); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 3; rr(x, 10, 10, W - 20, H - 20, 112); x.stroke();
      // coloured bezel (with the tab on top that carries the name)
      x.fillStyle = '#1797d8'; rr(x, 78, 92, W - 156, H - 170, 86); x.fill();
      x.fillStyle = '#1797d8'; rr(x, W * 0.33, 60, W * 0.34, 90, 30); x.fill();
      const bg = x.createLinearGradient(0, 92, 0, H - 78); bg.addColorStop(0, 'rgba(255,255,255,.28)'); bg.addColorStop(0.12, 'rgba(255,255,255,0)'); bg.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = bg; rr(x, 78, 92, W - 156, H - 170, 86); x.fill();
      x.fillStyle = '#ffffff'; x.font = '800 64px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('DIGI-DECK', W / 2, 140);
      x.fillStyle = '#101214'; rr(x, 130, 175, W - 260, H - 300, 54); x.fill();          // (frame ends at H - 125; the printing sits on the bezel below it)                                 // black inner frame
      x.save(); x.globalCompositeOperation = 'destination-out'; rr(x, 150, 195, W - 300, H - 340, 44); x.fill(); x.restore();   // the window
      x.font = 'italic 800 30px Helvetica, Arial, sans-serif'; x.textAlign = 'right'; x.fillStyle = '#0d0f11'; x.fillText('D.SOUND', W - 175, H - 92);
      x.font = '700 24px Helvetica, Arial, sans-serif'; x.textAlign = 'left'; x.fillStyle = '#c4262e'; x.fillText('PORTABLE MD PLAYER  DD-MJ1', 175, H - 92);
      return c;
    },
    // what the window shows: the works of a clear-window portable (modelled on Panasonic SJ-MJ / Sony photos). A perforated
    // metal plate along the top, black chassis, spindle motor with its turntable, the optical pickup (lens, metal housing,
    // gold board) on guide rails with a lead screw, the amber flex cable, a circuit board with parts, the sled motor and screws.
    // Drawn at 2x for sharpness, in 1100 x 1020 units
    internals() {
      const W = 1100, H = 1020, Q = 2, c = mk(W * Q, H * Q), x = c.getContext('2d'); x.scale(Q, Q);
      const n = noise, circ = (X, Y, R) => { x.beginPath(); x.arc(X, Y, R, 0, Math.PI * 2); };
      const lin = (x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
      const rad = (X, Y, r0, r1, stops, ox = 0, oy = 0) => { const g = x.createRadialGradient(X + ox, Y + oy, r0, X, Y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
      const screw = (X, Y, R = 11, cross = true) => {
        x.fillStyle = rad(X, Y, 1, R, [[0, '#f4f5f6'], [0.6, '#b9bdc2'], [1, '#6c7177']], -R * 0.3, -R * 0.3); circ(X, Y, R); x.fill();
        x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = R * 0.22; x.beginPath(); x.moveTo(X - R * 0.6, Y); x.lineTo(X + R * 0.6, Y);
        if (cross) { x.moveTo(X, Y - R * 0.6); x.lineTo(X, Y + R * 0.6); } x.stroke();
        x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1.5; circ(X, Y, R); x.stroke();
      };
      const rivet = (X, Y, R = 4) => { x.fillStyle = rad(X, Y, 0.5, R, [[0, '#ffffff'], [1, '#8d9298']], -1, -1); circ(X, Y, R); x.fill(); };
      const brushed = (X, Y, w, h, base, k = 0.05, seed = 0) => {
        x.fillStyle = base; x.fillRect(X, Y, w, h);
        for (let i = 0; i < h; i += 1.5) { const v = n(i * 3.1 + seed) - 0.5; x.fillStyle = v > 0 ? `rgba(255,255,255,${v * k * 2})` : `rgba(0,0,0,${-v * k * 2})`; x.fillRect(X, Y + i, w, 1.5); }
      };

      // black plastic chassis, faintly textured, with moulded ribs
      x.fillStyle = '#131517'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(255,255,255,${n(i) * 0.035})`; x.fillRect(n(i + 1) * W, n(i + 2) * H, 1.5, 1.5); }
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 2;
      for (const [a, b, c2, d] of [[620, 300, 1080, 300], [1080, 300, 1080, 980], [760, 760, 1080, 760], [620, 300, 620, 420]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); }

      // the bright metal sheet under the pickup's path, and its shadowed edge
      brushed(150, 262, 400, 220, '#b9bdc0', 0.08, 7);
      x.fillStyle = lin(150, 262, 150, 482, [[0, 'rgba(255,255,255,.25)'], [1, 'rgba(0,0,0,.15)']]); x.fillRect(150, 262, 400, 220);
      x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(150, 478, 400, 6);

      // perforated plate along the top: warm brushed steel, holes of a few sizes, tabs along its lower edge
      x.save(); x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 236);
      for (let k = 0; k < 15; k++) { const tx = W - 30 - k * 72; x.lineTo(tx, 236); x.lineTo(tx, 252); x.lineTo(tx - 34, 252); x.lineTo(tx - 34, 236); }
      x.lineTo(0, 236); x.closePath(); x.clip();
      brushed(0, 0, W, 256, '#cfc8b4', 0.06, 1);
      x.fillStyle = lin(0, 0, 0, 256, [[0, 'rgba(255,255,255,.22)'], [0.7, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.18)']]); x.fillRect(0, 0, W, 256);
      // rows of holes in a few sizes, a hole left out here and there (as stamped)
      const holes = [];
      for (let row = 0; row < 4; row++) for (let k = 0; k < 24; k++) {
        const i = row * 31 + k, hx = 34 + k * 45 + (row % 2) * 22 + (n(i * 2.1) - 0.5) * 6, hy = 36 + row * 50 + (n(i * 4.3) - 0.5) * 6;
        if (hx > W - 26 || n(i * 9.7) < 0.22) continue;
        const r = [8, 10, 10, 13, 17][Math.floor(n(i * 7.7) * 5)] + (k % 5 === 2 ? 4 : 0);
        holes.push([hx, hy, r]);
      }
      for (const [hx, hy, r] of holes) {
        x.fillStyle = '#2b2d30'; circ(hx, hy, r); x.fill();
        x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(hx, hy, r, Math.PI * 1.05, Math.PI * 1.95); x.arc(hx, hy + r * 0.35, r * 0.9, Math.PI * 1.9, Math.PI * 1.1, true); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.5; x.beginPath(); x.arc(hx, hy, r + 1, Math.PI * 0.1, Math.PI * 0.9); x.stroke();
      }
      x.restore();
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 252, W, 5);
      for (const X of [40, 560, 1060]) screw(X, 214, 10);

      // circuit board, lower left: dark green-black with gold traces and parts
      x.fillStyle = '#16201c'; rr(x, -10, 800, 560, 240, 8); x.fill();
      x.strokeStyle = 'rgba(200,170,90,.28)'; x.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const y0 = 815 + n(i * 2.2) * 190, x0 = n(i * 4.4) * 480; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + 40 + n(i) * 90, y0); x.lineTo(x0 + 60 + n(i) * 90, y0 + (n(i * 9) - 0.5) * 40); x.stroke(); }
      const ind = (X, Y, s, txt) => { x.fillStyle = lin(X, Y, X + s, Y + s, [[0, '#4a4d52'], [1, '#232528']]); rr(x, X, Y, s, s, 6); x.fill(); x.fillStyle = '#1a1b1d'; circ(X + s / 2, Y + s / 2, s * 0.3); x.fill(); x.fillStyle = '#c9ccd0'; x.font = `600 ${s * 0.22}px Helvetica, Arial, sans-serif`; x.textAlign = 'center'; x.fillText(txt, X + s / 2, Y + s * 0.92); };
      ind(150, 900, 62, '330'); ind(30, 925, 50, '4R7'); ind(400, 860, 54, '220');
      const chip = (X, Y, w, h) => { x.fillStyle = '#1d1e20'; x.fillRect(X, Y, w, h); x.fillStyle = '#b8bcc0'; for (let k = 4; k < w - 4; k += 7) { x.fillRect(X + k, Y - 4, 3, 4); x.fillRect(X + k, Y + h, 3, 4); } x.fillStyle = 'rgba(255,255,255,.12)'; circ(X + 6, Y + 6, 2.5); x.fill(); };
      chip(240, 830, 64, 40); chip(330, 950, 44, 30); chip(1000, 420, 50, 34);
      for (let i = 0; i < 40; i++) { const X = 20 + n(i * 1.7) * 500, Y = 815 + n(i * 2.9) * 200; x.fillStyle = n(i * 6) > 0.5 ? '#7a5a3a' : '#2c2a28'; x.fillRect(X, Y, 10, 5); x.fillStyle = '#c7cbd0'; x.fillRect(X - 2, Y, 2, 5); x.fillRect(X + 10, Y, 2, 5); }

      // spindle motor: black housing ring with holes, the turntable with magnet clips, a pale hub
      const cx = W * 0.52, cy = H * 0.52;
      x.fillStyle = '#0c0d0e'; circ(cx, cy, 160); x.fill();
      x.fillStyle = rad(cx, cy, 120, 160, [[0, '#26292c'], [1, '#141618']]); circ(cx, cy, 152); x.fill();
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.3; rivet(cx + Math.cos(a) * 138, cy + Math.sin(a) * 138, 4); }
      x.fillStyle = rad(cx, cy, 40, 112, [[0, '#2b2e32'], [0.85, '#1a1c1f'], [1, '#08090a']]); circ(cx, cy, 112); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1.5; for (const r of [100, 84, 70]) { circ(cx, cy, r); x.stroke(); }
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 - 0.4; x.save(); x.translate(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62); x.rotate(a + Math.PI / 2); x.fillStyle = lin(-12, 0, 12, 0, [[0, '#9aa0a6'], [0.5, '#eef0f2'], [1, '#8a9096']]); rr(x, -11, -7, 22, 14, 3); x.fill(); x.restore(); }
      x.fillStyle = rad(cx, cy, 2, 46, [[0, '#e9e1cc'], [0.7, '#b5ab92'], [1, '#6f6857']], -10, -12); circ(cx, cy, 44); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; circ(cx, cy, 30); x.stroke();
      x.fillStyle = rad(cx, cy, 1, 10, [[0, '#ffffff'], [1, '#8b9095']], -3, -3); circ(cx, cy, 9); x.fill();

      // guide rails and the lead screw the pickup runs on
      const rail = (x0, y0, x1, th) => { x.fillStyle = lin(0, y0 - th / 2, 0, y0 + th / 2, [[0, '#7d8288'], [0.4, '#f0f2f4'], [1, '#5c6167']]); x.fillRect(x0, y0 - th / 2, x1 - x0, th); };
      rail(20, 500, 405, 9); rail(20, 778, 560, 9);
      x.fillStyle = lin(0, 682, 0, 702, [[0, '#6f747a'], [0.45, '#e6e9ec'], [1, '#50555a']]); x.fillRect(120, 682, 300, 20);
      x.strokeStyle = 'rgba(40,42,45,.75)'; x.lineWidth = 2; for (let X = 122; X < 418; X += 6) { x.beginPath(); x.moveTo(X, 682); x.lineTo(X + 5, 702); x.stroke(); }

      // the optical pickup: gold board (with a dot code), metal housing and the lens
      x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 18; x.shadowOffsetY = 6;
      x.fillStyle = lin(30, 560, 280, 790, [[0, '#e8cd8e'], [0.5, '#d1ae66'], [1, '#a9813e']]); rr(x, 30, 560, 250, 230, 8); x.fill(); x.restore();
      x.fillStyle = 'rgba(90,60,20,.45)'; for (let i = 0; i < 12; i++) for (let k = 0; k < 12; k++) if (n(i * 13 + k * 7 + 3) > 0.5) x.fillRect(170 + k * 7, 600 + i * 7, 6, 6);
      x.fillStyle = 'rgba(90,60,20,.55)'; x.font = '700 22px Helvetica, Arial, sans-serif'; x.textAlign = 'left'; x.fillText('H', 60, 760); x.fillText('R', 240, 770);
      for (const [X, Y] of [[50, 580], [260, 580], [50, 770], [260, 770]]) rivet(X, Y, 5);
      x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
      x.fillStyle = lin(40, 380, 200, 560, [[0, '#e9ebee'], [0.5, '#b8bdc2'], [1, '#7f858b']]); rr(x, 40, 380, 170, 190, 10); x.fill(); x.restore();
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; rr(x, 52, 392, 146, 166, 8); x.stroke();
      x.fillStyle = '#18191b'; rr(x, 72, 410, 106, 100, 12); x.fill();
      x.fillStyle = rad(125, 460, 4, 40, [[0, '#9fb4ff'], [0.35, '#3d55c8'], [0.8, '#141a3a'], [1, '#0a0b12']], -8, -10); circ(125, 460, 36); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)'; circ(114, 448, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.35)'; circ(136, 472, 4); x.fill();
      x.strokeStyle = '#3a3d41'; x.lineWidth = 4; circ(125, 460, 40); x.stroke();

      // amber flex cable from the pickup board, folded across to the right
      x.save(); x.globalAlpha = 0.88;
      x.fillStyle = lin(280, 620, 280, 760, [[0, '#b86f14'], [0.5, '#e09a32'], [1, '#a35e10']]);
      x.beginPath(); x.moveTo(280, 620); x.bezierCurveTo(360, 610, 420, 640, 470, 700); x.lineTo(470, 760); x.bezierCurveTo(420, 740, 350, 730, 280, 740); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(70,40,5,.5)'; x.lineWidth = 1.2;
      for (let k = 1; k < 12; k++) { const t = k / 12; x.beginPath(); x.moveTo(280, 620 + t * 120); x.bezierCurveTo(360, 610 + t * 122, 420, 640 + t * 100, 470, 700 + t * 60); x.stroke(); }
      x.restore();

      // sled motor, lower right: a brass can with a printed code
      const mx = W * 0.78, my = H * 0.84;
      x.fillStyle = '#0b0c0d'; circ(mx, my + 4, 100); x.fill();
      x.fillStyle = rad(mx, my, 10, 96, [[0, '#f3e3b8'], [0.6, '#d8bf86'], [1, '#9c8148']], -20, -24); circ(mx, my, 94); x.fill();
      x.strokeStyle = 'rgba(80,60,20,.35)'; x.lineWidth = 1; for (let r = 20; r < 92; r += 5) { circ(mx, my, r); x.stroke(); }
      x.fillStyle = rad(mx, my, 2, 26, [[0, '#ffffff'], [1, '#9aa0a6']], -5, -6); circ(mx, my, 24); x.fill();
      x.fillStyle = 'rgba(60,40,10,.75)'; x.font = '700 18px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('CRBRL1-H', mx, my + 60);

      // blue connector on the right, a few small parts and screws, and the thin spring wire
      x.fillStyle = lin(1010, 620, 1080, 620, [[0, '#2a49b8'], [1, '#18307e']]); rr(x, 1010, 600, 70, 110, 6); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 6; k++) x.fillRect(1022, 612 + k * 16, 46, 4);
      for (let i = 0; i < 18; i++) { const X = 650 + n(i * 8.1) * 400, Y = 320 + n(i * 9.3) * 400; if (Math.hypot(X - cx, Y - cy) < 175) continue; x.fillStyle = '#26282b'; x.fillRect(X, Y, 14, 9); x.fillStyle = '#b8bcc0'; x.fillRect(X - 2, Y + 2, 2, 5); x.fillRect(X + 14, Y + 2, 2, 5); }
      for (let i = 0; i < 22; i++) { const X = 640 + n(i * 4.7) * 440, Y = 290 + n(i * 6.1) * 700; if (Math.hypot(X - cx, Y - cy) < 175 || Math.hypot(X - mx, Y - my) < 110) continue; rivet(X, Y, 3.5); }
      for (const [X, Y] of [[300, 300], [1060, 300], [1060, 980], [640, 980]]) screw(X, Y, 13);
      x.strokeStyle = lin(120, 800, 520, 1010, [[0, '#d9dde1'], [1, '#7f858b']]); x.lineWidth = 3; x.beginPath(); x.moveTo(110, 790); x.bezierCurveTo(250, 880, 380, 950, 520, 1015); x.stroke();
      return c;
    },
    // the clear window's reflections (on top of everything)
    glass() {
      const W = 1100, H = 1020, c = mk(W, H), x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(0.28, 'rgba(255,255,255,.04)'); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0)'); g.addColorStop(0.64, 'rgba(255,255,255,.08)'); g.addColorStop(0.72, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      return c;
    }
  };
  // the asset files: a PNG with the same name in assets/md is used instead of the drawing above
  const FILES = { disc: 'inner-disc.png', sheen: 'disc-sheen.png', shellStd: 'shell-standard.png', shellRetail: 'shell-retail.png', slider: 'slider.png', body: 'player-body.png', internals: 'player-internals.png', glass: 'player-glass.png' };
  const art = async k => { await logoReady; return (await ld(A + FILES[k])) || ART[k](); };
  S.mdArt = { ART, FILES, RECT, MW, MH, ready: logoReady };
  S.mdLogo = (col = 'black') => logoReady.then(() => LOGO[col]);

  // ---------------------------------------------------------------- labels
  // standard disc with no picture of its own: the generic paper sticker, written on by hand (title, artist, the songs)
  async function genericLabel(album, side) {
    const base = await ld(A + 'generic-label.png'), W = 271 * 4, H = 392 * 4, c = mk(W, H), x = c.getContext('2d');
    if (base) x.drawImage(base, 0, 0, W, H); else { x.fillStyle = '#f7f6f2'; x.fillRect(0, 0, W, H); }
    const ink = (t, X, Y, size, maxW) => { x.font = `${size}px "Segoe Print", Desyrel, "Comic Sans MS", cursive`; let s = size; while (x.measureText(t).width > maxW && s > 12) { s -= 1; x.font = `${s}px "Segoe Print", Desyrel, "Comic Sans MS", cursive`; } x.fillStyle = '#1b2540'; x.fillText(t, X, Y); };
    const k = 4, lines = Array.from({ length: 13 }, (_, i) => (80 + i * 24.25) * k);
    ink(album.title || 'Untitled', 100 * k, 38 * k, 61, W - 110 * k);
    const tr = (album.tracks || []).filter(t => (t.side || 'A') === side), rows = [(S.displayArtist ? S.displayArtist(album) : album.artist) || '', ...tr.map((t, i) => `${i + 1}. ${t.title || ''}`)].filter(Boolean);
    const room = lines.length - 2, show = rows.length > room ? [...rows.slice(0, room - 1), `+ ${rows.length - room + 1} more`] : rows;
    show.forEach((t, i) => ink(t, 16 * k, lines[i] - 5 * k, 51, (i >= room - 1 ? W * 0.62 : W - 30 * k)));
    return c;
  }
  async function labelFor(album, side, style) {
    const own = album['label_' + side.toLowerCase()] || (side !== 'A' ? '' : '');
    const img = own ? await S.loadImage(own) : null; if (img) return img;
    if (style === 'standard') return genericLabel(album, side);
    return (await S.loadImage(album.front)) || S.generic.cover(album.title || 'Untitled', album.artist || '', 900);
  }

  // ---------------------------------------------------------------- one disc, as layered elements
  // returns { el, inner (the canvas that turns), slider (element), open(bool, ms) }
  // shell colour (the tape colours; Transparent is the plain clear shell). Coloured plastic is see-through, black / white /
  // metallic nearly solid; the head window stays open
  function tintShell(shell, album, std) {
    const col = S.colorOf(S.TAPE_COLORS, album.color || 'clear'); if (col.id === 'clear') return;
    const x = shell.getContext('2d'), hex = col.id === 'smoke' ? '#3c3e44' : col.hex;
    const a = col.id === 'smoke' ? 0.72 : col.id === 'black' ? 0.93 : col.id === 'white' ? 0.9 : col.metal ? 0.9 : 0.62;
    const rgba = (h, al) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`; };
    x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(hex, col.id === 'white' ? 0.25 : 0.45); x.fillRect(0, 0, MW, MH); x.restore();
    x.save(); x.globalCompositeOperation = 'destination-over'; shellPath(x); x.fillStyle = rgba(hex, a); x.fill();
    if (col.metal) { const g = x.createLinearGradient(0, 0, MW, MH); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, MW, MH); }
    x.restore();
    if (std) logo(x, MW * 0.753, MH * 0.117, MW * 0.169, col.id === 'black' || col.id === 'smoke' ? 'white' : 'black', 0.85);   // the printed logo keeps its ink
    const [wx, wy, ww, wh] = px(RECT.win); x.save(); x.globalCompositeOperation = 'destination-out'; rr(x, wx, wy, ww, wh, 14); x.fill(); x.restore();
  }

  // back: the other side of the disc (no label; seen from that side the slider is on the left)
  async function buildDisc(album, side, back = false) {
    const e = S.el, style = S.releaseInfo(album, 'md').disc, root = e('div', { class: 'md-disc ' + style });
    const pct = (el, X, Y, W, H) => Object.assign(el.style, { left: X / MW * 100 + '%', top: Y / MH * 100 + '%', width: W / MW * 100 + '%', height: H / MH * 100 + '%' });
    const inner = e('div', { class: 'md-inner' }), sheen = await art('sheen'), disc = await art('disc');
    const dc = mk(disc.width || disc.naturalWidth, disc.height || disc.naturalHeight); dc.getContext('2d').drawImage(disc, 0, 0); inner.append(dc);
    const sh = mk(1000); sh.getContext('2d').drawImage(sheen, 0, 0, 1000, 1000); sh.className = 'md-sheen';
    pct(inner, DCX - DISC_R, DCY - DISC_R, DISC_R * 2, DISC_R * 2); pct(sh, DCX - DISC_R, DCY - DISC_R, DISC_R * 2, DISC_R * 2);
    const label = back ? null : await labelFor(album, side, style);
    let shell, slider = null;
    const [sx, sy, sw, shh] = px(RECT.slider);
    if (back) {
      const base = await art(style === 'standard' ? 'shellStd' : 'shellRetail');
      shell = mk(MW, MH); shell.getContext('2d').drawImage(base, 0, 0, MW, MH); tintShell(shell, album, style === 'standard'); slider = await art('slider');
    } else if (style === 'led') {
      // the picture is the shell: the slider part is cut out and moves; the area under the slider is plain shell with the head window
      shell = mk(MW, MH); const x = shell.getContext('2d');
      x.save(); shellPath(x); x.clip(); S.drawCover(x, label, 0, 0, MW, MH);
      x.globalCompositeOperation = 'destination-out'; rr(x, sx, sy, sw, shh, 12); x.fill(); x.restore();
      x.save(); x.globalCompositeOperation = 'destination-over'; rr(x, sx, sy, sw, shh, 12); x.fillStyle = '#2a2c2f'; x.fill(); x.restore();
      const [wx, wy, ww, wh] = px(RECT.win); x.save(); x.globalCompositeOperation = 'destination-out'; rr(x, wx, wy, ww, wh, 14); x.fill(); x.restore();
      const sl = mk(sw, shh), y = sl.getContext('2d'); rr(y, 0, 0, sw, shh, 12); y.clip(); y.drawImage((() => { const t = mk(MW, MH), tx = t.getContext('2d'); tx.save(); shellPath(tx); tx.clip(); S.drawCover(tx, label, 0, 0, MW, MH); tx.restore(); return t; })(), sx, sy, sw, shh, 0, 0, sw, shh);
      y.strokeStyle = 'rgba(0,0,0,.35)'; y.lineWidth = 3; rr(y, 1.5, 1.5, sw - 3, shh - 3, 12); y.stroke();
      slider = sl;
    } else {
      const base = await art(style === 'retail' ? 'shellRetail' : 'shellStd');
      shell = mk(MW, MH); shell.getContext('2d').drawImage(base, 0, 0, MW, MH); tintShell(shell, album, style !== 'retail');
      const x = shell.getContext('2d'), r = px(style === 'retail' ? RECT.retailLabel : RECT.stdLabel);
      x.save(); rr(x, r[0], r[1], r[2], r[3], style === 'retail' ? 6 : 10); x.clip(); S.drawCover(x, label, r[0], r[1], r[2], r[3]); x.restore();
      if (style === 'standard') { x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3; rr(x, r[0], r[1], r[2], r[3], 10); x.stroke(); slider = await art('slider'); }
    }
    shell.className = 'md-shell';
    const holder = back ? e('div', { class: 'md-flip' }) : root;
    if (back) root.append(holder);
    holder.append(inner, sh, shell);
    let sliderEl = null;
    if (slider) { sliderEl = e('div', { class: 'md-slider' }); const c = mk(sw, shh); c.getContext('2d').drawImage(slider, 0, 0, sw, shh); sliderEl.append(c); pct(sliderEl, sx, sy, sw, shh); holder.append(sliderEl); }
    const d = { el: root, inner, slider: sliderEl, style, isOpen: false };
    d.open = (on, ms = 450) => {
      if (!sliderEl || d.isOpen === on) return Promise.resolve(); d.isOpen = on;
      const a = 'translateY(0)', b = `translateY(${RECT.travel / (RECT.slider[3] - RECT.slider[1]) * 100}%)`;
      return sliderEl.animate([{ transform: on ? a : b }, { transform: on ? b : a }], { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.catch(() => {});
    };
    return d;
  }
  S.mdBuildDisc = buildDisc;

  // ---------------------------------------------------------------- the player
  class MDStage {
    constructor(host) {
      this.host = host; this.album = null; this.angle = 0; this.spin = 0; this.rpm = 0; this.disc = 'A'; this.discs = []; this.busy = false; this.cur = null;
      this.build(); this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    async build() {
      const e = S.el;
      this.root = e('div', { class: 'mdp' });
      this.player = e('div', { class: 'mdp-player' });
      this.inside = e('div', { class: 'mdp-inside' });
      this.slot = e('div', { class: 'mdp-slot' });                // the disc moves in here (under the body, seen through the window)
      this.bodyBox = e('div', { class: 'mdp-body' }); this.glassBox = e('div', { class: 'mdp-glass' });
      this.player.append(this.inside, this.slot, this.bodyBox, this.glassBox);
      this.buildRemote();
      this.root.append(this.player, this.remote); this.host.append(this.root);
      const [body, glass, internals] = await Promise.all([art('body'), art('glass'), art('internals')]);
      const put = (box, im) => { const c = mk(im.width || im.naturalWidth, im.height || im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); box.replaceChildren(c); };
      put(this.bodyBox, body); put(this.glassBox, glass); put(this.inside, internals);
      this.slot.addEventListener('click', () => S.app.togglePlay());
      this.layout();
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight; if (!W || !H) return;
      const BW = 1400, BH = 1360, P = Math.max(260, Math.min((H - 40) * BW / BH, (W - 60) / 1.3)), PH = P * BH / BW, RW = PH * 0.98 / 4.4;
      const left = (W - P - RW - P * 0.06) / 2, top = (H - PH) / 2;
      Object.assign(this.player.style, { left: left + 'px', top: top + 'px', width: P + 'px', height: PH + 'px' });
      const RH = PH * 0.98, RW2 = RH / 4.4;
      Object.assign(this.remote.style, { left: left + P + P * 0.06 + 'px', top: top + (PH - RH) / 2 + 'px', width: RW2 + 'px', height: RH + 'px' });
      this.remote.style.setProperty('--rw', RW2 + 'px');
      this.root.style.setProperty('--u', P + 'px');
      // the window (body art: 150..1250 x 195..1215) holds the works and the disc
      const win = { x: 150 / BW * P, y: 195 / BH * PH, w: 1100 / BW * P, h: 1020 / BH * PH };
      Object.assign(this.inside.style, { left: win.x + 'px', top: win.y + 'px', width: win.w + 'px', height: win.h + 'px' });
      Object.assign(this.glassBox.style, { left: win.x + 'px', top: win.y + 'px', width: win.w + 'px', height: win.h + 'px' });
      const dw = win.w * 0.975, dh = dw * MH / MW;
      Object.assign(this.slot.style, { left: win.x + (win.w - dw) / 2 + 'px', top: win.y + (win.h - dh) / 2 + 'px', width: dw + 'px', height: dh + 'px' });
    }
    // the remote (styled on a Sony RM-D29M MiniDisc deck remote) with an amber fluorescent display on top
    buildRemote() {
      const e = S.el, app = () => S.app;
      const key = (label, title, fn, cls, pos, cap) => {
        const b = e('button', { class: 'mdrm-key ' + (cls || ''), title, onclick: fn || (() => {}) }, label);
        const [L, T, W, H] = pos; Object.assign(b.style, { left: L + '%', top: T / 4.4 + '%', width: W + '%', height: H / 4.4 + '%' });
        const out = [b]; if (cap) { const c = e('span', { class: 'mdrm-cap' + (cap[1] ? ' or' : '') }, cap[0]); Object.assign(c.style, { left: L - 6 + '%', top: (T - 5.6) / 4.4 + '%', width: W + 12 + '%' }); out.push(c); }
        return out;
      };
      const text = (t, L, T, W, cls = '') => { const c = e('span', { class: 'mdrm-txt ' + cls }, t); Object.assign(c.style, { left: L + '%', top: T / 4.4 + '%', width: W + '%' }); return c; };
      const track = n => () => { const a = this.album; if (!a) return; const tr = a.tracks, on = tr.map((t, i) => i).filter(i => (this.discs.length > 1 ? tr[i].side === this.disc : true)); if (on[n - 1] != null) S.app.playIndex(on[n - 1]); };
      this.mode = 0;                                       // DISPLAY: 0 elapsed, 1 remaining in the track, 2 total on the disc
      this.disp = mk(600, 330); this.disp.className = 'mdrm-disp';
      const parts = [this.disp,
        ...key('⏏', 'Eject - put in the next disc', () => this.multi ? S.app.manualSwap() : null, 'round eject', [13, 62, 18, 18], ['EJECT']),
        ...key('', 'Power', null, 'round power', [68, 60, 20, 20], ['I / ⏻']),
        ...key('', 'Menu / No', null, 'pill', [11, 92, 22, 8], ['MENU/NO', 1]), ...key('', 'Yes', null, 'pill', [39, 92, 22, 8], ['YES', 1]), ...key('', 'Clear', null, 'pill', [67, 92, 22, 8], ['CLEAR']),
        ...key('', 'Display - elapsed / remaining / total', () => { this.mode = (this.mode + 1) % 3; }, 'pill', [11, 110, 22, 8], ['DISPLAY']),
        ...key('', 'Scroll the title', () => { this.tscroll = 0; }, 'pill', [39, 110, 22, 8], ['SCROLL']), ...key('', 'Fader', null, 'pill', [67, 110, 22, 8], ['FADER']),
        ...key('NAME', 'Name', null, 'pill txt', [11, 128, 22, 8], ['— NAME IN —', 1]), ...key('CHAR', 'Character', null, 'pill txt', [39, 128, 22, 8]), ...key('', 'Play mode', null, 'pill', [67, 128, 22, 8], ['PLAY MODE']),
        ...[['1', '&!?'], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PRS'], ['8', 'TUV'], ['9', 'WXY']].flatMap(([n, l], k) =>
          key(n, 'Track ' + n, track(+n), 'num', [12 + (k % 3) * 28, 146 + Math.floor(k / 3) * 20, 18, 14], [l, 1])),
        ...key('>10', 'Track above 10', null, 'pill txt', [10, 210, 22, 8]), ...key('10/0', 'Track 10', track(10), 'num', [40, 206, 18, 15], ['QZ', 1]), ...key('', 'Music sync', null, 'pill', [67, 210, 22, 8], ['MUSIC SYNC']),
        text('CD-SYNC', 8, 224, 84, 'rule'),
        ...key('STOP', '', null, 'pill txt', [10, 230, 22, 8]), ...key('START', '', null, 'pill txt', [39, 230, 22, 8]), ...key('STANDBY', '', null, 'pill txt', [67, 230, 22, 8]),
        text('CD PLAYER', 8, 244, 84, 'rule'),
        ...key('‖', '', null, 'pill txt', [10, 250, 22, 8]), ...key('⏮', '', null, 'pill txt', [39, 250, 22, 8]), ...key('⏭', '', null, 'pill txt', [67, 250, 22, 8]),
        ...key('▷', 'Play', () => app().togglePlay(), 'big play', [8, 266, 50, 12]), ...key('‖', 'Pause', () => app().togglePlay(), 'big', [66, 266, 24, 12]),
        ...key('●', 'Record', null, 'big rec', [8, 284, 24, 12]), ...key('T.REC', 'Timer record', null, 'big txt', [37, 284, 24, 12]), ...key('■', 'Stop', () => app().stop(), 'big', [66, 284, 24, 12]),
        ...key('⏮', 'Previous', () => app().prev(), 'big', [8, 302, 24, 10]), ...key('⏭', 'Next', () => app().next(), 'big', [37, 302, 24, 10]),
        ...key('◀◀', 'Back 10 s', () => this.nudge(-10), 'big', [8, 318, 24, 10]), ...key('▶▶', 'Forward 10 s', () => this.nudge(10), 'big', [37, 318, 24, 10]),
        ...key('', 'Repeat', null, 'big', [8, 336, 24, 10], ['REPEAT']), ...key('', 'A-B repeat', null, 'big', [37, 336, 24, 10], ['A ↔ B']),
        ...key('+', 'Volume up', () => app().volume(0.08), 'lvl up', [66, 300, 24, 18], ['LEVEL']), ...key('−', 'Volume down', () => app().volume(-0.08), 'lvl dn', [66, 320, 24, 18]),
        text('RM-DD1', 50, 358, 40, 'model'), text('DIGI-DECK', 0, 368, 100, 'brand'), e('div', { class: 'mdrm-plate' }, 'MINIDISC', e('br'), 'DECK')];
      this.ejectKey = parts[1];
      this.remote = e('div', { class: 'mdrm' }, ...parts);
    }
    nudge(d) { const a = S.app.audio; if (!S.app.album || !isFinite(a.duration)) return; a.currentTime = S.clamp(a.currentTime + d, 0, Math.max(0, a.duration - 0.5)); }
    // amber VFD: TRACK NO. (7-segment) and the level bars with their scale, the title in 5 x 8 dot-matrix cells, the time,
    // and the numbered track boxes (lit up to the one playing)
    drawRemoteDisplay(st, dt, onDisc, pos, multi) {
      const c = this.disp, x = c.getContext('2d'), W = c.width, H = c.height, ON = '#ffa21f', DIM = 'rgba(255,162,31,.09)', RED = '#ff4a2a';
      x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0a0503'; x.fillRect(0, 0, W, H);
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,120,40,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const lit = (on, col = ON) => { x.fillStyle = on ? col : DIM; x.shadowColor = on ? col : 'transparent'; x.shadowBlur = on ? 10 : 0; };
      const word = (t, X, Y, on, size, col, al = 'left') => { lit(on, col); x.textAlign = al; x.font = `700 ${size}px Helvetica, Arial, sans-serif`; x.fillText(t, X, Y); x.textAlign = 'left'; };
      const has = !!this.album, playing = !!st.playing, tr = has ? this.album.tracks : [];
      x.textBaseline = 'alphabetic';
      word('TRACK', 24, 40, has, 17); word('NO.', 34, 60, has, 17);
      S.segText(x, has && pos >= 0 ? String(pos + 1).padStart(3, '0') : '---', 96, 70, 54, { on: has ? ON : DIM, off: DIM, glow: has ? 10 : 0 });
      word(multi ? `DISC ${S.SIDE_LETTERS.indexOf(this.disc) + 1}/${this.discs.length}` : '', 24, 100, multi, 16);
      // level bars
      const live = playing && S.meter && S.meter.ok ? S.meter.read() : null;
      this.lv = this.lv || [0, 0];
      const N = 16, X0 = 250, X1 = W - 20;
      for (let ch = 0; ch < 2; ch++) {
        let tgt = 0; if (live) tgt = S.clamp((live[ch] + 50) / 50, 0, 1); else if (playing) { const t = performance.now() / 1000 * (3 + ch); tgt = S.clamp(0.62 + 0.2 * Math.sin(t) + 0.1 * Math.sin(t * 2.6), 0, 1); }
        this.lv[ch] += (tgt - this.lv[ch]) * (1 - Math.exp(-dt * (tgt > this.lv[ch] ? 30 : 5)));
        const n = Math.round(this.lv[ch] * N), y = ch ? 48 : 22;
        word(ch ? 'R' : 'L', X0 - 18, y + 11, true, 13);
        for (let k = 0; k < N; k++) { lit(k < n, k >= N - 2 ? RED : ON); x.fillRect(X0 + k * (X1 - X0) / N, y, (X1 - X0) / N - 4, 11); }
      }
      x.shadowBlur = 0; x.fillStyle = 'rgba(255,162,31,.7)'; x.font = '600 12px Helvetica, Arial, sans-serif'; x.textAlign = 'center';
      ['dB', '50', '40', '20', '12', '8', '4', '2', '0', 'OVER'].forEach((t, i) => { x.fillStyle = t === 'OVER' ? RED : 'rgba(255,162,31,.7)'; x.fillText(t, X0 + i / 9 * (X1 - X0 - 16) + 8, 82); });
      x.textAlign = 'left';
      // title (dot matrix), time
      const t = st.trackIndex >= 0 && tr[st.trackIndex], title = !has ? 'NO DISC' : t ? t.title || '' : this.album.title || '';
      this.tscroll = (this.tscroll || 0) + dt;
      S.dotText(x, S.dotScroll(title, 14, this.tscroll, 3), 26, 106, { dot: 4.8, gap: 1.6, on: ON, off: 'rgba(255,162,31,.06)', glow: 7, cells: 14, spacing: 1.4 });
      const dur = st.trackDur || 0, tot = onDisc.reduce((a, i) => a + (tr[i].duration || 0), 0);
      const secs = this.mode === 1 ? Math.max(0, dur - (st.trackTime || 0)) : this.mode === 2 ? tot : (st.trackTime || 0);
      word(['', 'REMAIN', 'TOTAL'][this.mode], 24, 200, has && this.mode > 0, 16);
      const s = Math.floor(secs); S.segText(x, `${String(Math.floor(s / 60)).padStart(2, ' ')}m${String(s % 60).padStart(2, '0')}s`, 150, 238, 46, { on: has ? ON : DIM, off: DIM, glow: has ? 10 : 0, label: 0.62 });
      word(playing ? '▶' : st.hasTrack ? '‖' : '', 40, 236, has, 30);
      // numbered track boxes
      const nb = Math.min(Math.max(onDisc.length, 1), 25), bw = (W - 48) / Math.min(15, Math.max(nb, 1));
      for (let k = 0; k < nb; k++) {
        const row = Math.floor(k / 15), col = k % 15, X = 24 + col * bw, Y = 262 + row * 32;
        lit(has && k < onDisc.length && (pos < 0 || k >= pos), k === pos ? '#ffd27a' : ON); x.fillRect(X, Y, bw - 6, 24);
        x.shadowBlur = 0; x.fillStyle = '#0a0503'; x.font = '700 15px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText(String(k + 1), X + (bw - 6) / 2, Y + 18); x.textAlign = 'left';
      }
    }
    setMulti(m) { this.multi = m; this.ejectKey.title = m ? 'Eject - put in the next disc' : 'Eject (one disc)'; }
    // where the bottom edge of the window is, in disc heights from the top of the disc when it is all the way in
    winBottom() { return (this.inside.offsetTop + this.inside.offsetHeight - this.slot.offsetTop) / Math.max(1, this.slot.offsetHeight); }
    // how far below its playing position the disc is when it has just come out of the bottom of the player (in disc heights)
    outside(gap = 0.08) { return (this.player.offsetHeight - this.slot.offsetTop) / Math.max(1, this.slot.offsetHeight) + gap; }
    // one fluid motion: the disc slides up from below and its slider starts opening as soon as half the slider is in the window
    async slideIn(d, start) {
      const H = Math.max(1, this.slot.offsetHeight), midS = (RECT.slider[1] + RECT.slider[3]) / 2, wb = this.winBottom();
      d.el.getAnimations().forEach(a => a.cancel());
      const anim = d.el.animate([{ transform: `translateY(${start * 100}%)` }, { transform: 'translateY(0)' }], { duration: 1100, easing: 'cubic-bezier(.25,.6,.3,1)' });
      let opening = null;
      await new Promise(res => {
        const tick = () => {
          const m = new DOMMatrixReadOnly(getComputedStyle(d.el).transform), ty = m.m42 / H;          // how far down the disc still is, in disc heights
          if (!opening && midS + ty <= wb) opening = d.open(true, 520);
          if (anim.playState === 'finished' || !d.el.isConnected) return res(); requestAnimationFrame(tick);
        };
        anim.finished.then(res, res); requestAnimationFrame(tick);
      });
      await (opening || d.open(true, 450));
    }
    async insert(side) {
      const d = await buildDisc(this.album, side);
      this.slot.replaceChildren(d.el); this.cur = d; this.angle = 0;
      if (this.quiet) {                                    // the library animation brings the disc to the bottom of the player (finishArrive)
        d.el.animate([{ transform: `translateY(${this.outside(0) * 100}%)` }], { duration: 1, fill: 'forwards' }); this.waiting = true; return;
      }
      await this.slideIn(d, this.outside());
    }
    async slideOut(gap) {                                  // the reverse: it starts sliding out while the slider closes
      const d = this.cur; if (!d) return;
      const closing = d.open(false, 420);
      await new Promise(r => setTimeout(r, 160));
      await d.el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${this.outside(gap) * 100}%)` }], { duration: 850, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' }).finished.catch(() => {});
      await closing;
    }
    async remove() { const d = this.cur; if (!d) return; await this.slideOut(0.08); d.el.remove(); this.cur = null; }
    // ---- library animations: the disc is handed over / taken away just below the player, lined up with the slot ----
    recordRect() { const r = this.slot.getBoundingClientRect(), p = this.player.getBoundingClientRect(); return { left: r.left, top: p.bottom, width: r.width, height: r.height }; }
    hideRecord(h) { if (this.cur) this.cur.el.style.visibility = h ? 'hidden' : ''; }
    async finishArrive() { while (!this.waiting) await new Promise(r => setTimeout(r, 30)); this.waiting = false; if (this.cur) { this.cur.el.style.visibility = ''; await this.slideIn(this.cur, this.outside(0)); } this.busy = false; }
    async prepTake() { while (this.busy) await new Promise(r => setTimeout(r, 40)); this.busy = true; await this.slideOut(0); }
    finishTake() { if (this.cur) this.cur.el.remove(); this.cur = null; this.busy = false; }
    async setAlbum(album) {
      while (!this.bodyBox.firstChild) await new Promise(r => setTimeout(r, 30));
      this.busy = true;
      if (this.cur) await this.remove();
      this.album = album; S.normalizeSides(album, 'md');
      this.discs = S.sidesOf(album.tracks); this.disc = this.discs[0] || 'A';
      const q = this.quiet; await this.insert(this.disc); this.quiet = false;
      if (!q) this.busy = false;                          // (a library hand-over keeps it busy until finishArrive)
    }
    async flipTo(side) {
      if (this.busy || side === this.disc) return;
      this.busy = true; await this.remove(); this.disc = side; await this.insert(side); this.busy = false;
    }
    currentSide() { return this.disc; }
    recordCanvas() { return this.cur && this.cur.inner.firstChild; }
    frame(dt, st) {
      const target = st.playing && !this.busy && this.cur ? 1 : 0;
      this.spin += (target - this.spin) * (1 - Math.exp(-dt * (target ? 3.0 : 1.2)));
      if (!target && this.spin < 0.002) this.spin = 0;
      const f = S.clamp(st.sideFrac || 0, 0, 1);
      this.rpm = RPM_START / Math.sqrt(1 + K * f);
      this.angle = (this.angle + this.rpm * 6 * dt * this.spin) % 360;
      if (this.cur) this.cur.inner.style.transform = `rotate(${this.angle}deg)`;
      const tr = this.album ? this.album.tracks : [], multi = this.discs.length > 1;
      const onDisc = multi ? tr.map((t, i) => i).filter(i => tr[i].side === this.disc) : tr.map((t, i) => i);
      const pos = onDisc.indexOf(st.trackIndex);
      this.drawRemoteDisplay(st, dt, onDisc, pos, multi);
      this.root.classList.toggle('playing', !!st.playing);
    }
    destroy() { this._ro.disconnect(); this.root.remove(); }
  }
  S.stages = S.stages || {};
  S.stages.md = MDStage;
  S.mdRpm = f => RPM_START / Math.sqrt(1 + K * f);
})(window.S);
