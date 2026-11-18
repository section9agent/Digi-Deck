// Reel to reel deck (a silver rack-style 7½ ips deck, drawn here; not any brand's artwork).
//  * the deck front is painted once on a canvas (brushed aluminium, knobs, meters, head block, transport keys)
//  * reels are built live: a generic 7" plastic reel (assets/reel/generic-*.png), a retail reel (clear flange, big hub, drawn here) or the
//    aluminium take-up reel (assets/reel/take-up.png) - the tape pack on each one grows and shrinks with the side being played
//  * loading a reel: it drops onto the left spindle, the tape is threaded past the head block and onto the empty take-up reel
//  * a side is 48 minutes on the generic reel (1,800 ft) or 32 minutes on a retail reel (1,200 ft) at 7½ in/s
(function (S) {
  const A = '../../assets/';
  const DW = 2000, DH = 920;
  S.REEL_DECK = { W: DW, H: DH };
  const LC = { x: 440.4, y: 324 }, RC = { x: 1540.3, y: 324 }, RR = 298.3;               // reel centres / reel radius (deck units)
  const ROLL = [{ x: 677, y: 829, r: 62 }, { x: 1294, y: 829, r: 62 }];          // tape guide rollers
  const WHEEL_MM = 62 * 0.298, CAP_MM = 16.7 * 0.298;                              // radii of the idler wheels and capstans in mm (1 deck unit = 0.298 mm)
  const TABLE_R = 176;                                                              // the black wells are ~179 units in radius
  const HEADY = 790;                                                               // the tape runs along the bottom edge of the head cover
  const IPS_MM = 190.5, REEL_MM = 88.9;                                            // 7½ in/s, 3½ in flange radius
  const R_GEN = 0.335, R_RET = 0.545, R_TAKE = 0.315, R_FULL = 0.93;               // hub radius of each reel / full pack, as a fraction of the flange radius
  const TAU = Math.PI * 2;

  const imgs = new Map();
  const ld = src => { if (!imgs.has(src)) imgs.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); return imgs.get(src); };
  const pct = (el, x, y, w, h) => Object.assign(el.style, { left: x / DW * 100 + '%', top: y / DH * 100 + '%', width: w / DW * 100 + '%', height: h / DH * 100 + '%' });
  const rr = (x, px, py, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(px, py, w, h, r) : x.rect(px, py, w, h); };

  // ================================================================ the deck front ==========================================
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  function knob(x, cx, cy, r, opts = {}) {
    x.save(); x.translate(cx, cy);
    if (!opts.flat) { x.fillStyle = '#08090a'; x.beginPath(); x.arc(0, 0, r * 1.14, 0, TAU); x.fill(); }
    const g = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fbfbfc'); g.addColorStop(0.45, '#cfd2d6'); g.addColorStop(1, '#8f949a');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(40,44,50,.55)'; x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, r - 0.7, 0, TAU); x.stroke();
    for (let k = 1; k <= 5; k++) { x.strokeStyle = `rgba(${k % 2 ? '255,255,255' : '60,64,70'},.22)`; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, r * (0.2 + k * 0.13), 0, TAU); x.stroke(); }   // turned-aluminium rings
    x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(-r * 0.25, -r * 0.35, r * 0.5, r * 0.26, -0.5, 0, TAU); x.fill();
    if (opts.pointer != null) { x.rotate(opts.pointer); x.strokeStyle = '#c0302a'; x.lineWidth = Math.max(2, r * 0.09); x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -r * 0.2); x.lineTo(0, -r * 0.92); x.stroke(); }
    x.restore();
  }
  function ticks(x, cx, cy, r0, r1, a0, a1, n, label) {
    x.save(); x.strokeStyle = '#24272b'; x.fillStyle = '#24272b'; x.lineWidth = 1.5; x.font = '700 12px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, c = Math.cos(a), s = Math.sin(a);
      x.beginPath(); x.moveTo(cx + c * r0, cy + s * r0); x.lineTo(cx + c * r1, cy + s * r1); x.stroke();
      if (label && label[i] != null) x.fillText(label[i], cx + c * (r1 + 11), cy + s * (r1 + 11));
    }
    x.restore();
  }
  const MET = [{ x: 815, y: 183, w: 142, h: 284 }, { x: 1034, y: 183, w: 142, h: 284 }];
  const METFACE = [A + 'reel/vu-left.png', A + 'reel/vu-right.png'];                                  // your meter faces (212 x 424 px); the needle is drawn live
  // scale: reading (dB, 0 = the red mark) -> y on the face (px); the arc x follows. Pivot sits at the outer edge of each meter, the needle sweeps up and down the scale.
  const MSCALE = [
    { pivot: [13, 259], yv: [[-20, 357], [-10, 346], [-7, 313], [-5, 285], [-3, 248], [-2, 228], [-1, 205], [0, 190], [1, 152], [2, 115], [3, 78]], x0: 125, xs: -0.075, xt: 0.08, y0: 190 },
    { pivot: [183, 208], yv: [[-20, 356], [-10, 345], [-7, 310], [-5, 283], [-3, 248], [-2, 226], [-1, 200], [0, 182], [1, 145], [2, 108], [3, 75]], x0: 79, xs: 0.078, xt: -0.1, y0: 185 }
  ];
  function scalePoint(ch, db) {                                                                    // where the needle tip lands on the face for a reading
    const m = MSCALE[ch], t = m.yv; db = Math.max(-20, Math.min(3, db));
    let y = t[0][1]; for (let i = 0; i < t.length - 1; i++) if (db >= t[i][0] && db <= t[i + 1][0]) { const k = (db - t[i][0]) / (t[i + 1][0] - t[i][0]); y = t[i][1] + (t[i + 1][1] - t[i][1]) * k; }
    const x = m.x0 + (y > m.y0 ? (y - m.y0) * m.xs : (m.y0 - y) * m.xt * (ch ? 1 : 1));
    return [x, y];
  }
  function meterFace(x, m) {
    x.save(); x.translate(m.x, m.y); x.beginPath(); x.rect(0, 0, m.w, m.h); x.clip();
    const g = x.createLinearGradient(0, 0, 0, m.h); g.addColorStop(0, '#efe9d3'); g.addColorStop(1, '#e2dbc3'); x.fillStyle = g; x.fillRect(0, 0, m.w, m.h);
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, 0, m.w, 6);
    // red zone at the top, black scale with VU numbers
    const px = m.w * 0.62, py = m.h * 0.97, R = m.h * 0.86;
    x.fillStyle = '#d33a3a'; x.beginPath(); x.arc(px, py, R, -Math.PI / 2 - 0.06, -Math.PI / 2 + 0.3); x.arc(px, py, R * 0.86, -Math.PI / 2 + 0.3, -Math.PI / 2 - 0.06, true); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 3; x.beginPath(); x.arc(px, py, R * 0.9, -Math.PI / 2 - 1.0, -Math.PI / 2 - 0.06); x.stroke();
    ticks(x, px, py, R * 0.9, R * 0.97, -Math.PI / 2 - 1.0, -Math.PI / 2 - 0.06, 9, ['20', '10', '7', '5', '3', '2', '1', '0', '', '']);
    ticks(x, px, py, R * 0.86, R * 0.96, -Math.PI / 2 + 0.02, -Math.PI / 2 + 0.3, 3, ['0', '1', '2', '3']);
    x.fillStyle = '#2a2a2a'; x.font = '700 16px Arial, sans-serif'; x.textAlign = 'left'; x.fillText('dB', 12, m.h * 0.55); x.font = '700 11px Arial, sans-serif'; x.fillText('0%', 12, m.h * 0.78); x.fillText('50', 12, m.h * 0.38); x.fillText('100', 8, m.h * 0.2);
    x.font = '8px Arial, sans-serif'; x.fillStyle = '#666'; x.fillText('DIGI-DECK ELECTRONICS', 14, m.h - 7);
    x.restore();
  }
  function paintDeck(k = 1.5) {
    const c = S.newCanvas(DW * k, DH * k), x = c.getContext('2d'); x.scale(k, k);
    // brushed aluminium panel
    const g = x.createLinearGradient(0, 0, 0, DH); g.addColorStop(0, '#d9dbde'); g.addColorStop(0.5, '#c9ccd0'); g.addColorStop(1, '#bcc0c5');
    x.fillStyle = g; rr(x, 0, 0, DW, DH, 7); x.fill();
    x.save(); rr(x, 0, 0, DW, DH, 7); x.clip();
    for (let i = 0; i < 4200; i++) { const y = rand() * DH, w = 80 + rand() * 700, px = rand() * DW - 100; x.fillStyle = rand() < 0.5 ? `rgba(255,255,255,${0.04 + rand() * 0.07})` : `rgba(70,76,84,${0.03 + rand() * 0.05})`; x.fillRect(px, y, w, 0.8); }
    const sheen = x.createLinearGradient(0, 0, DW, DH * 0.3); sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,.16)'); sheen.addColorStop(0.7, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.08)');
    x.fillStyle = sheen; x.fillRect(0, 0, DW, DH);
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; rr(x, 1, 1, DW - 2, DH - 2, 7); x.stroke();
    x.strokeStyle = 'rgba(40,44,50,.5)'; x.lineWidth = 2; rr(x, 3, 3, DW - 6, DH - 6, 6); x.stroke();
    // rack-ear slots and screws
    x.fillStyle = '#6b6f75'; for (const [sx, sy] of [[-14, 150], [-14, 758], [DW - 50, 150], [DW - 50, 758]]) { rr(x, sx, sy, 64, 24, 10); x.fill(); }
    x.fillStyle = '#1e2023'; for (const [sx, sy] of [[-14, 152], [-14, 760], [DW - 50, 152], [DW - 50, 760]]) { rr(x, sx, sy, 62, 21, 10); x.fill(); }
    for (const [sx, sy] of [[152, 321], [1845, 321]]) { knob(x, sx, sy, 14, { flat: true }); x.strokeStyle = '#555'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx - 7, sy); x.lineTo(sx + 7, sy); x.moveTo(sx, sy - 7); x.lineTo(sx, sy + 7); x.stroke(); }
    // sticker
    x.fillStyle = '#eef0f2'; x.fillRect(8, 22, 214, 58); x.strokeStyle = '#999'; x.strokeRect(8.5, 22.5, 213, 57);
    x.fillStyle = '#151515'; x.font = '700 15px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('"CAUTION"', 115, 42); x.font = '700 14px Arial, sans-serif'; x.fillText('DO NOT REMOVE SCREWS', 115, 60); x.fillText('SEE BOTTOM NOTICE', 115, 76);
    // reel wells
    for (const c0 of [LC, RC]) {
      x.fillStyle = '#0c0d0e'; x.beginPath(); x.arc(c0.x, c0.y, RR + 11, 0, TAU); x.fill();
      const wg = x.createRadialGradient(c0.x, c0.y, RR * 0.9, c0.x, c0.y, RR + 11); wg.addColorStop(0, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(120,125,130,.55)'); x.fillStyle = wg; x.beginPath(); x.arc(c0.x, c0.y, RR + 11, 0, TAU); x.fill();
    }
    // top row of function keys with their legends
    const KX = [809, 871, 933, 996, 1058, 1120, 1182];
    x.fillStyle = '#16181b'; x.font = '700 12px Arial, sans-serif'; x.textAlign = 'center';
    const leg = [['OFF', 'ON'], ['19', '9.5'], ['TAPE', 'SOURCE'], ['STD', 'LH'], ['STD', 'LH'], ['OFF', 'ON'], ['OFF', 'ON']];
    KX.forEach((kx, i) => { knob(x, kx, 107, 19); x.fillStyle = '#16181b'; x.fillText(leg[i][0], kx, 50); x.fillText(leg[i][1], kx, 63); });
    x.fillStyle = '#0b0c0d'; rr(x, 777, 14, 64, 17, 2); x.fill(); x.fillStyle = '#fff'; x.fillText('POWER', 809, 27);
    x.fillStyle = '#16181b'; x.fillText('SPEED', 869, 28); x.fillText('MONITOR', 936, 28); x.fillStyle = '#c0302a'; x.fillText('BIAS', 995, 28); x.fillStyle = '#16181b'; x.fillText('EQ', 1060, 28); x.fillText('REC MODE', 1152, 28);
    x.font = '700 11px Arial'; x.fillText('L', 1120, 140); x.fillText('R', 1182, 140);
    // meters
    for (const m of MET) { x.fillStyle = '#585c61'; x.fillRect(m.x - 7, m.y - 7, m.w + 14, m.h + 14); x.fillStyle = '#1e2023'; x.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6); meterFace(x, m); }
    x.font = '700 12px Arial'; x.fillStyle = '#16181b'; x.textAlign = 'center'; x.fillText('REC', 996, 251); x.fillText('PAUSE', 996, 452);
    x.fillStyle = '#2a0b0b'; x.beginPath(); x.arc(996, 219, 8, 0, TAU); x.fill(); x.strokeStyle = '#777'; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = '#10130f'; x.beginPath(); x.arc(996, 427, 8, 0, TAU); x.fill(); x.stroke();
    x.font = '700 11px Arial'; x.fillText('O-ADJUST', 724, 322); x.fillText('O-ADJUST', 1272, 322);
    for (const sx of [756, 1244]) { x.fillStyle = '#16181b'; x.beginPath(); x.arc(sx, 335, 9, 0, TAU); x.fill(); x.strokeStyle = '#8a8e94'; x.stroke(); }
    // counter, reset / repeat, pitch control
    x.fillStyle = '#0a0a0a'; rr(x, 846, 520, 106, 40, 2); x.fill(); x.strokeStyle = '#777'; x.lineWidth = 2; x.stroke();
    x.font = '700 11px Arial'; x.fillStyle = '#16181b'; x.fillText('RESET', 996, 498); x.fillText('REPEAT', 1058, 498); x.fillText('PUSH ON', 1058, 584); x.fillText('PITCH CONTROL', 1160, 494);
    x.fillStyle = '#17191c'; rr(x, 986, 528, 20, 24, 3); x.fill(); x.strokeStyle = '#555'; x.stroke();
    knob(x, 1058, 539, 18, {});
    ticks(x, 1140, 541, 30, 38, -Math.PI * 0.95, -Math.PI * 0.05, 10); knob(x, 1140, 541, 22, { pointer: 0.18 });
    // head compartment
    x.fillStyle = '#0d0e10'; x.fillRect(620, 599, 751, 232);
    for (const px of [620, 1273]) { const hg = x.createLinearGradient(px, 0, px + 98, 0); hg.addColorStop(0, '#cdd0d4'); hg.addColorStop(1, '#b3b7bc'); x.fillStyle = hg; x.fillRect(px, 599, 98, 232); x.strokeStyle = 'rgba(0,0,0,.45)'; x.strokeRect(px + .5, 599.5, 97, 231); knob(x, px + (px < 700 ? 22 : 76), 640, 8, { flat: true }); }
    const pg = x.createLinearGradient(0, 613, 0, 786); pg.addColorStop(0, '#e1e3e6'); pg.addColorStop(1, '#b6babf'); x.fillStyle = pg; rr(x, 764, 613, 455, 173, 10); x.fill(); x.strokeStyle = 'rgba(30,34,40,.6)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 18; i++) x.fillRect(780 + i * 24, 616, 18, 4);
    for (const [sx, sy] of [[790, 640], [1193, 640]]) { knob(x, sx, sy, 8.5, { flat: true }); }
    x.fillStyle = '#16181b'; x.textAlign = 'left'; x.font = '700 34px Arial, sans-serif'; x.fillText('DIGI-DECK', 828, 668); x.font = '12px Arial'; x.fillText('AUTO REVERSE', 1006, 654); x.fillText('DIRECT DRIVE  RD-7', 1006, 670);
    x.fillStyle = '#15171a'; for (const [sx, sy] of [[816, 700], [996, 727], [1175, 700]]) { x.beginPath(); x.arc(sx, sy, 8, 0, TAU); x.fill(); }
    x.font = '11px Arial'; x.fillText('◄ play azim', 806, 740); x.fillText('play azim ►', 1100, 740); x.textAlign = 'center'; x.fillText('rec azim ►', 996, 760);
    // tape guides (the black curved posts above the rollers) and the rollers
    for (const r of ROLL) {
      x.fillStyle = '#0a0a0b'; rr(x, r.x - 22, r.y - 150, 44, 140, 22); x.fill();
      x.strokeStyle = '#2a2c2f'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#c7cacd'; x.fillRect(r.x < 1000 ? r.x - 66 : r.x + 36, r.y - 20, 32, 8);
      x.fillStyle = '#0b0b0c'; x.beginPath(); x.arc(r.x, r.y, r.r, 0, TAU); x.fill();
      const rg = x.createRadialGradient(r.x - 8, r.y - 8, 4, r.x, r.y, r.r * 0.78); rg.addColorStop(0, '#f0f1f2'); rg.addColorStop(1, '#8c9095'); x.fillStyle = rg; x.beginPath(); x.arc(r.x, r.y, r.r * 0.76, 0, TAU); x.fill();
      x.fillStyle = '#26282b'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.ellipse(r.x + Math.cos(a) * r.r * 0.52, r.y + Math.sin(a) * r.r * 0.52, 8, 5, a, 0, TAU); x.fill(); }
      knob(x, r.x, r.y, 16, { flat: true });
    }
    // lower left: jacks and input knobs
    x.font = '700 12px Arial'; x.fillStyle = '#16181b'; x.textAlign = 'center'; x.fillText('PHONES', 180, 704); x.fillText('L — MIC — R', 216, 790);
    for (const [jx, jy] of [[180, 734], [180, 818], [253, 818]]) { x.fillStyle = '#9a9ea4'; x.beginPath(); x.arc(jx, jy, 28, 0, TAU); x.fill(); x.fillStyle = '#101112'; x.beginPath(); x.arc(jx, jy, 21, 0, TAU); x.fill(); x.fillStyle = '#4a4d52'; x.beginPath(); x.arc(jx, jy, 9, 0, TAU); x.fill(); }
    for (const [kx, nm] of [[360, 'MIC'], [489, 'LINE']]) { x.fillStyle = '#16181b'; x.font = '700 13px Arial'; x.fillText(nm, kx, 738); ticks(x, kx, 797, 58, 66, -Math.PI * 1.05, 0.05, 10, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']); knob(x, kx, 797, 44, { pointer: -0.5 }); }
    // lower right: transport
    x.font = '700 12px Arial'; x.fillStyle = '#16181b'; x.fillText('DIRECTION', 1695, 690); x.fillText('PAUSE', 1797, 686); x.fillText('PLAY', 1722, 779); x.fillText('REC', 1797, 779);
    x.font = '700 18px Arial'; x.fillText('◀◀', 1505, 779); x.fillText('▶▶', 1581, 779); x.fillText('■', 1651, 779);
    for (const [bx, by, r] of [[1505, 824, 24], [1581, 824, 24], [1651, 824, 24], [1722, 824, 24]]) knob(x, bx, by, r);
    knob(x, 1797, 824, 24); x.strokeStyle = '#c0302a'; x.lineWidth = 3; x.beginPath(); x.arc(1797, 824, 13, 0, TAU); x.stroke();
    for (const bx of [1663, 1726]) { x.fillStyle = '#09090a'; x.beginPath(); x.arc(bx, 728, 21, 0, TAU); x.fill(); x.strokeStyle = '#4b4e53'; x.lineWidth = 2; x.stroke(); }
    knob(x, 1797, 722, 26);
    return c;
  }

  // ================================================================ reels ===================================================
  const mk = (w, h = w) => S.newCanvas(w, h);
  const packR = (r0, area) => Math.sqrt(r0 * r0 + area * (R_FULL * R_FULL - r0 * r0));         // pack radius (fraction of flange radius) for a given amount of tape (0..1 of a full pack)
  function tapePack(x, S0, r0, r1) {                                                          // the wound tape: brown, with fine concentric lines
    if (r1 <= r0 + 0.002) return;
    const c = S0 / 2;
    x.save(); x.beginPath(); x.arc(c, c, r1 * c, 0, TAU); x.arc(c, c, r0 * c, 0, TAU, true); x.clip();
    const g = x.createRadialGradient(c, c, r0 * c, c, c, r1 * c); g.addColorStop(0, '#2a1f18'); g.addColorStop(0.55, '#4a382b'); g.addColorStop(1, '#5b4636');
    x.fillStyle = g; x.fillRect(0, 0, S0, S0);
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1;
    for (let r = r0 * c + 3; r < r1 * c; r += 3.2) { x.beginPath(); x.arc(c, c, r, 0, TAU); x.stroke(); }
    const sw = x.createConicGradient ? x.createConicGradient(0.6, c, c) : null;                 // sheen across the pack
    if (sw) { [0, .2, .35, .5, .7, .85, 1].forEach((p, i) => sw.addColorStop(p, i % 2 ? 'rgba(0,0,0,.22)' : 'rgba(255,235,210,.16)')); x.fillStyle = sw; x.fillRect(0, 0, S0, S0); }
    x.restore();
  }
  function spindleTop(x, S0) {                                                               // the deck spindle (three-prong hub) seen through the middle of the reel
    const c = S0 / 2, r = S0 * 0.058;
    x.save(); x.translate(c, c);
    x.fillStyle = '#7e8288'; x.beginPath(); x.arc(0, 0, r * 1.15, 0, TAU); x.fill();
    const g = x.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(1, '#9fa3a9'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill();
    x.fillStyle = '#4d5156'; for (let i = 0; i < 3; i++) { x.save(); x.rotate(i * TAU / 3); rr(x, -r * 0.22, -r * 0.95, r * 0.44, r * 0.8, r * 0.1); x.fill(); x.restore(); }
    x.fillStyle = '#2b2d30'; x.beginPath(); x.arc(0, 0, r * 0.2, 0, TAU); x.fill();
    x.restore();
  }
  // the label sticker: its own width, hung from the top rim of the reel
  function stickerOn(x, S0, img) {
    if (!img) return;
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height, R = S0 / 2, w = R * 1.8, h = Math.min(R * 0.95, w * h0 / w0);
    x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = S0 * 0.008; x.shadowOffsetY = S0 * 0.004;
    x.drawImage(img, R - w / 2, R - R * 0.95, w, h); x.restore();
  }
  async function retailFront(x, S0, tint) {                                                         // a retail reel: clear flange, two windows, big hub with three holes
    const c = S0 / 2, R = c;
    x.save();
    x.fillStyle = tint ? tint : 'rgba(214,222,228,.16)'; x.beginPath(); x.arc(c, c, R * 0.985, 0, TAU); x.fill();
    const hg = x.createLinearGradient(0, 0, S0, S0); hg.addColorStop(0, 'rgba(255,255,255,.34)'); hg.addColorStop(0.4, 'rgba(255,255,255,0)'); hg.addColorStop(0.7, 'rgba(255,255,255,.1)'); hg.addColorStop(1, 'rgba(255,255,255,.22)');
    x.fillStyle = hg; x.beginPath(); x.arc(c, c, R * 0.985, 0, TAU); x.fill();
    for (const [rad, a, w] of [[0.985, 0.6, 3], [0.94, 0.25, 2], [0.9, 0.18, 2]]) { x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = w; x.beginPath(); x.arc(c, c, R * rad, 0, TAU); x.stroke(); x.strokeStyle = `rgba(30,34,40,${a * 0.5})`; x.lineWidth = 1.5; x.beginPath(); x.arc(c, c, R * (rad - 0.012), 0, TAU); x.stroke(); }
    // top and bottom windows
    for (const dir of [-1, 1]) {
      const wx = c - R * 0.21, wy = dir < 0 ? c - R * 0.9 : c + R * 0.56, ww = R * 0.42, wh = R * 0.34;
      x.fillStyle = 'rgba(255,255,255,.1)'; rr(x, wx, wy, ww, wh, R * 0.05); x.fill(); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2.5; x.stroke(); x.strokeStyle = 'rgba(30,34,40,.35)'; x.lineWidth = 1.2; rr(x, wx + 3, wy + 3, ww - 6, wh - 6, R * 0.04); x.stroke();
    }
    // the big hub plate (frosted) with its three holes and the drive-spindle star
    const hubG = x.createRadialGradient(c - R * 0.15, c - R * 0.2, R * 0.05, c, c, R * R_RET);
    hubG.addColorStop(0, 'rgba(235,238,240,.62)'); hubG.addColorStop(1, 'rgba(180,186,192,.58)');
    x.fillStyle = hubG; x.beginPath(); x.arc(c, c, R * R_RET, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; x.stroke(); x.strokeStyle = 'rgba(30,34,40,.4)'; x.lineWidth = 1.5; x.beginPath(); x.arc(c, c, R * (R_RET - 0.012), 0, TAU); x.stroke();
    x.save(); x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 3; i++) { const a = (-120 + i * 120 - 3) * Math.PI / 180; x.beginPath(); x.arc(c + Math.cos(a) * R * 0.2, c + Math.sin(a) * R * 0.2, R * 0.058, 0, TAU); x.fill(); }
    x.restore();
    for (let i = 0; i < 3; i++) { const a = (-120 + i * 120 - 3) * Math.PI / 180; x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(c + Math.cos(a) * R * 0.2, c + Math.sin(a) * R * 0.2, R * 0.062, 0, TAU); x.stroke(); }
    for (const dy of [-0.4, 0.4]) { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; x.beginPath(); x.arc(c, c + R * dy, R * 0.06, 0, TAU); x.stroke(); }   // pin dimples
    x.restore();
  }
  // the reel's colour: a tint over the plastic flange (clear / none = untouched)
  function reelTint(col, a = 0.5) {
    if (!col || col === 'clear') return null;
    if (col === 'smoke') return `rgba(28,30,36,${a})`;
    const t = S.colorOf(S.TAPE_COLORS, col); if (!t || !t.hex) return null;
    const n = parseInt(t.hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  async function tintedFront(size, tint) {
    const f = await ld(A + 'reel/generic-front.png'); if (!f) return null; if (!tint) return f;
    const c = mk(size), x = c.getContext('2d'); x.drawImage(f, 0, 0, size, size); x.globalCompositeOperation = 'source-atop'; x.fillStyle = tint; x.fillRect(0, 0, size, size); return c;
  }
  // kind: 'generic' | 'retail' | 'take'; pack: radius of the tape pack as a fraction of the flange radius (0 = empty)
  // opts.color: reel colour; opts.full: the label picture is the whole reel face (label is then a square canvas)
  async function buildReel(kind, pack, label, size = 640, opts = {}) {
    const c = mk(size), x = c.getContext('2d'), r0 = kind === 'retail' ? R_RET : kind === 'take' ? R_TAKE : R_GEN, full = opts.full && label && kind !== 'take';
    tapePack(x, size, r0 - 0.005, pack);
    if (full) {                                                                         // a printed reel face covers the flange
      // the reel itself (in its colour) underneath, so it shows wherever the printed face is see-through
      if (kind === 'retail') await retailFront(x, size, reelTint(opts.color, 0.38)); else { const f = await tintedFront(size, reelTint(opts.color, 0.45)); if (f) x.drawImage(f, 0, 0, size, size); }
      x.save(); x.beginPath(); x.arc(size / 2, size / 2, size / 2 * 0.985, 0, TAU); x.clip(); x.drawImage(label, 0, 0, size, size); x.restore();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(size / 2, size / 2, size / 2 * 0.985, 0, TAU); x.stroke();
    } else if (kind === 'generic') { const f = await tintedFront(size, reelTint(opts.color, 0.45)); if (f) x.drawImage(f, 0, 0, size, size); stickerOn(x, size, label); }
    else if (kind === 'retail') { await retailFront(x, size, reelTint(opts.color, 0.38)); stickerOn(x, size, label); }
    else { const f = await ld(A + 'reel/take-up.png'); if (f) x.drawImage(f, 0, 0, size, size); }
    spindleTop(x, size);
    return c;
  }

  // ================================================================ the stage ================================================
  const LEDS = { rec: { x: 996, y: 219, c: '#ff3a2a' }, pause: { x: 996, y: 427, c: '#ffb23a' } };

  class ReelStage {
    constructor(host) {
      this.alwaysRun = true; this.host = host; this.album = null; this.t = 0; this.spin = 0; this.busy = false; this.side = 'A'; this.prog = 0; this.lvl = [-90, -90]; this.angS = 0; this.angT = 0; this.flipped = false;
      this.needle = [-48, -48]; this.ctrBase = 0; this.ctrRaw = 0; this.thread = 0; this.loaded = false; this._lastKey = '';
      this.build();
      this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    build() {
      const e = S.el;
      this.deck = e('div', { class: 'deck rr-deck' });
      this.art = e('img', { class: 'rr-art', draggable: 'false', alt: '' });
      this.art.onerror = () => { this.art.onerror = null; this.artCv = paintDeck(1.5); this.artCv.toBlob(b => { if (b && this.art) this.art.src = URL.createObjectURL(b); }); };
      this.art.src = A + 'reel/deck-front.png';
      const wrap = c0 => { const w = e('div', { class: 'rr-reel' }), cv = e('canvas', { class: 'rr-spin' }); w.append(cv); pct(w, c0.x - RR, c0.y - RR, RR * 2, RR * 2); return { w, cv }; };
      this.L = wrap(LC); this.R = wrap(RC);
      this.tapeCv = e('canvas', { class: 'rr-tape' }); this.tapeCv.width = DW / 2; this.tapeCv.height = DH / 2; pct(this.tapeCv, 0, 0, DW, DH);
      this.mc = METFACE.map((src, i) => {
        const c = e('canvas', { class: 'rr-live' }), im = new Image(); c.width = 424; c.height = 848; pct(c, MET[i].x + 0.3, MET[i].y + 1, 141.3, 282.7);
        im.onload = () => { c._face = im; }; im.src = src; return c;
      });
      const part = (src, cx, cy, d, cls) => { const i = e('canvas', { class: 'rr-live ' + cls }); i.width = i.height = Math.round(d * 3); pct(i, cx - d / 2, cy - d / 2, d, d); const im = new Image(); im.onload = () => { i._im = im; this.drawPart(i, 0); }; im.src = src; return i; };
      this.wheels = [part(A + 'reel/idler.png', 676.7, 828.7, 124, 'rr-wheel'), part(A + 'reel/idler.png', 1293.3, 828, 124, 'rr-wheel')];     // the big idler wheels turn clockwise
      this.caps = [part(A + 'reel/capstan.png', 676, 745.3, 33.4, 'rr-cap'), part(A + 'reel/capstan.png', 1294, 745.3, 33.4, 'rr-cap')];         // the capstans turn anticlockwise
      this.angW = 0; this.angC = 0;
      this.tables = [LC, RC].map(c => { const t = e('canvas', { class: 'rr-live' }), d = TABLE_R * 2; t.width = t.height = 640; pct(t, c.x - TABLE_R, c.y - TABLE_R, d, d); return t; });      this.ctr = e('canvas', { class: 'rr-live' }); this.ctr.width = 212; this.ctr.height = 80; pct(this.ctr, 846, 520, 106, 40);
      this.led = Object.fromEntries(Object.entries(LEDS).map(([k, l]) => { const d = e('i', { class: 'rr-led ' + k }); d.style.setProperty('--c', l.c); pct(d, l.x - 16, l.y - 16, 32, 32); return [k, d]; }));
      const key = (title, cx, cy, r, fn, cls = '') => { const b = e('button', { class: 'rr-key ' + cls, title, onclick: fn }); pct(b, cx - r, cy - r, r * 2, r * 2); return b; };
      this.keys = {
        prev: key('Previous track (rewind)', 1505, 824, 26, () => S.app.prev()), next: key('Next track (fast forward)', 1581, 824, 26, () => S.app.next()),
        stop: key('Stop', 1651, 824, 26, () => S.app.stop()), play: key('Play', 1722, 824, 26, () => S.app.togglePlay(), 'play'), rec: key('Record (this deck plays back only)', 1797, 824, 26, () => S.toast('This deck plays back only')),
        pause: key('Pause', 1797, 722, 28, () => { if (!S.app.audio.paused) S.app.audio.pause(); }),
        flip: key('Turn the reel over (other side)', 1663, 728, 24, () => S.app.manualFlip(), 'dir'), swap: key('Change reel', 1726, 728, 24, () => S.app.manualSwap(), 'dir')
      };
      this.knob = e('div', { class: 'rr-vol', title: 'Line level (drag or scroll)' }); pct(this.knob, 489 - 50, 797 - 50, 100, 100);
      this.deck.append(this.art, ...this.tables, ...this.wheels, ...this.caps, this.tapeCv, this.L.w, this.R.w, ...this.mc, this.ctr, this.led.rec, this.led.pause, ...Object.values(this.keys), this.knob);
      this.host.append(this.deck);
      this.setupKnob();
    }
    setupKnob() {
      const set = v => S.app.volume(v - S.app.audio.volume);
      this.knob.addEventListener('wheel', e => { e.preventDefault(); S.app.volume(e.deltaY < 0 ? 0.05 : -0.05); }, { passive: false });
      this.knob.addEventListener('pointerdown', e => {
        e.preventDefault(); const y0 = e.clientY, v0 = S.app.audio.volume;
        const mv = m => set(S.clamp(v0 + (y0 - m.clientY) / 160, 0, 1)), up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight; if (!W || !H) return;
      const top = Math.min(80, H * 0.1), Dw = Math.max(620, Math.min(W - 24, (H - top - 20) / (DH / DW))), Dh = Dw * DH / DW;
      Object.assign(this.deck.style, { width: Dw + 'px', height: Dh + 'px', left: (W - Dw) / 2 + 'px', top: top + Math.max(0, (H - top - Dh) / 2) + 'px' });
      this.Dw = Dw;
    }
    currentSide() { return this.side; }

    // ---- what is on the deck right now ----------------------------------------------------------------------------
    info(side) {
      const al = this.album, dur = al.tracks.filter(t => t.side === side).reduce((a, t) => a + (t.duration || 0), 0), cap = S.sideLimit(al, 'reel');
      return { dur, tape: S.clamp(dur / cap, 0.14, 1), type: S.reelType(al) };
    }
    reelKind() { return S.reelType(this.album) === 'retail' ? 'retail' : 'generic'; }
    r0() { return this.reelKind() === 'retail' ? R_RET : R_GEN; }
    // pack radii for the side being played: tape is conserved (area), so what leaves the supply reel arrives on the take-up reel
    radii(prog) {
      const inf = this.sideInfo, r0 = this.r0(), hs = this.flipped ? R_TAKE : r0, ht = this.flipped ? r0 : R_TAKE;      // hub of the supply / take-up reel (turned-over sides swap the reels)
      const area = inf.tape * (R_FULL * R_FULL - hs * hs), rs = Math.sqrt(hs * hs + area * (1 - prog)), rt = Math.sqrt(ht * ht + area * prog);
      return { rs: Math.min(R_FULL, rs), rt: Math.min(R_FULL, rt) };
    }
    // the picture on the reel: the album's own label cropped to the label outline (or covering the whole reel face), a generated label for playlists,
    // and nothing at all for a side whose label was left empty (some retail reels only have one)
    async labelFor(side) {
      const al = this.album, slot = 'label_' + side.toLowerCase(), own = al[slot], full = !!al.reel_full;
      if (own) {
        const img = await S.loadImage(own); if (img) {
          if (full) { const c = mk(1024), x = c.getContext('2d'); S.drawCover(x, img, 0, 0, 1024, 1024); return c; }
          const base = await ld(A + 'labels/reel.png'), L = mk(855 * 2, 400 * 2), lx = L.getContext('2d'); S.drawCover(lx, img, 0, 0, L.width, L.height);
          if (base) { lx.globalCompositeOperation = 'destination-in'; lx.drawImage(base, 0, 0, L.width, L.height); } return L;
        }
      }
      if (!al.is_generic && 'ABCDEFGH'.indexOf(side) % 2 === 1) return null;
      return S.art.get({ ...al, [slot]: '', label_a: '' }, slot, 'reel', side);
    }
    reelOpts() { return { color: this.album && this.album.color, full: !!(this.album && this.album.reel_full) }; }
    async buildPair() {
      const { rs, rt } = this.radii(this.prog), lab = this._label || (this._label = await this.labelFor(this.side)), k = this.reelKind(), ld_ = this.loaded;
      const o = this.reelOpts();
      return this.flipped ? Promise.all([buildReel('take', ld_ ? rs : 0, null), buildReel(k, ld_ ? rt : 0, lab, 640, o)]) : Promise.all([buildReel(k, ld_ ? rs : 0, lab, 640, o), buildReel('take', ld_ ? rt : 0, null)]);
    }
    drawPair([a, b]) { for (const [o, src] of [[this.L, a], [this.R, b]]) { o.cv.width = src.width; o.cv.height = src.height; o.cv.getContext('2d').drawImage(src, 0, 0); } }
    async paintReels(force) {
      if (!this.album) return;
      const { rs, rt } = this.radii(this.prog), key = [this.side, this.reelKind(), this.flipped ? 1 : 0, this.album.color || '', this.album.reel_full || '', Math.round(rs * 220), Math.round(rt * 220)].join('|');
      if (!force && key === this._lastKey) return; this._lastKey = key;
      this.drawPair(await this.buildPair());
    }

    // ---- loading / turning / changing the reel -------------------------------------------------------------------
    // gives a reel visible thickness (about 1/4 in) while it is turned: stacked copies of the face, darker toward the back
    addDepth(w, cv, pack = 0.3) {
      const T = w.getBoundingClientRect().width * 0.0357, n = 9, out = [];
      w.style.transformStyle = 'preserve-3d'; w.style.perspective = '';
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0);
        c.className = cv.className; c.style.cssText = cv.style.cssText + ';position:absolute;inset:0;width:100%;height:100%;pointer-events:none;filter:brightness(' + (0.45 + 0.04 * i) + ');transform:translateZ(' + (-T / 2 + T * i / (n - 1)) + 'px)';
        w.insertBefore(c, cv); out.push(c);
      }
      // the edge you see when the reel is side-on: two flanges with a gap between them, the tape pack and the hub in the middle
      const slab = document.createElement('div'), pk = Math.max(0.3, Math.min(0.97, pack)) * 100, bar = (h, bg) => `<i style="position:absolute;left:18%;right:18%;top:${50 - h / 2}%;height:${h}%;background:${bg}"></i>`;
      slab.style.cssText = `position:absolute;left:50%;top:0;height:100%;width:${T}px;margin-left:${-T / 2}px;transform:rotateY(90deg);pointer-events:none;border-radius:${T / 2}px / 3px;background:linear-gradient(90deg,#d9dcdf 0 16%,#0000 16% 84%,#b9bcc0 84% 100%)`;
      slab.innerHTML = bar(pk, 'linear-gradient(90deg,#3a2a22,#5b4336 50%,#33241d)') + bar(30, 'linear-gradient(90deg,#7c8086,#c9ccd0 50%,#70747a)');
      w.insertBefore(slab, cv); out.push(slab);
      cv.style.transform = 'translateZ(' + (T / 2 + 0.5) + 'px)'; cv.style.position = 'relative';
      return () => { out.forEach(c => c.remove()); cv.style.transform = ''; w.style.transformStyle = ''; };
    }
    anim(el, frames, ms, easing = 'cubic-bezier(.3,.05,.3,1)') { return el.animate(frames, { duration: ms, easing, fill: 'both' }).finished.catch(() => {}); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    async threadIn(ms = 1500) {                                          // the leader is drawn through the guides and onto the take-up reel while both reels turn slowly
      this.threading = true; const t0 = performance.now(), aS = Math.round(this.angS / 360) * 360, aT = Math.round(this.angT / 360) * 360;
      await new Promise(res => { const step = () => { const k = S.clamp((performance.now() - t0) / ms, 0, 1); this.thread = 1 - Math.pow(1 - k, 2); const e = k * (2 - k); this.angS = aS - 720 * e; this.angT = aT - 540 * e; if (k < 1 && this.deck.isConnected) requestAnimationFrame(step); else res(); }; step(); });
      this.thread = 1; this.threading = false; this.angS = aS - 720; this.angT = aT - 540;
    }
    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'reel');
      const sides = S.sidesOf(album.tracks), first = sides[0] || 'A';
      this.flipped = false; this.side = first; this.sideInfo = this.info(first); this.prog = 0; this._label = null; this._lastKey = ''; this.loaded = false; this.thread = 0; this.ctrBase = 0;
      this.keys.flip.style.display = sides.length > 1 ? '' : 'none';
      this.layout(); this.busy = true;
      if (this.quiet) {        // the library animation carries the reel onto the spindle itself, then calls finishArrive()
        this.quiet = false; this.loaded = true; this._lastKey = ''; await this.paintReels(true);
        this.R.w.getAnimations().forEach(a => a.cancel()); this.L.w.getAnimations().forEach(a => a.cancel());
        this.R.w.style.opacity = 1; this.L.w.style.opacity = 0; return;
      }
      await this.paintReels(true);
      this.R.w.getAnimations().forEach(a => a.cancel()); this.L.w.getAnimations().forEach(a => a.cancel());
      this.R.w.style.opacity = 1; this.L.w.style.opacity = 0;
      await this.anim(this.L.w, [{ transform: 'translate(-26%,-60%) scale(1.3) rotate(-12deg)', opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }], 950);   // the reel drops onto the left spindle
      this.L.w.getAnimations().forEach(a => a.cancel()); this.L.w.style.opacity = 1;
      this.loaded = true; this._lastKey = ''; this.threadMode = true;
      await this.paintReels(true);
      await this.threadIn(1700); this.threadMode = false;
      this.busy = false;
    }
    // ---- library animations ----
    recordRect() { const o = this._take || this.L; return o.w.getBoundingClientRect(); }
    recordCanvas() { return (this._take || this.L).cv; }
    hideRecord(h) { (this._take || this.L).w.style.opacity = h ? 0 : 1; }
    async finishArrive() { this._take = null; this.L.w.style.opacity = 1; this.threadMode = true; await this.threadIn(1700); this.threadMode = false; this.busy = false; }
    // putting the reel away: the slack is wound up onto the album's reel, the tape comes off the guides, and that reel is lifted off
    async prepTake() {
      while (this.busy) await this.wait(50);
      this.busy = true; this.spin = 0;
      const p0 = this.prog, to = this.flipped ? 1 : 0, t0 = performance.now(), dur = 700 + Math.abs(to - p0) * 900;
      this.rewinding = true;
      await new Promise(res => { const step = () => { const k = S.clamp((performance.now() - t0) / dur, 0, 1), e = k * k * (3 - 2 * k); this.prog = p0 + (to - p0) * e; if (k < 1 && this.deck.isConnected) requestAnimationFrame(step); else res(); }; step(); });
      this.prog = to; this.rewinding = false; await this.paintReels(true);
      await new Promise(res => { const t1 = performance.now(), step = () => { const k = S.clamp((performance.now() - t1) / 450, 0, 1); this.thread = 1 - k; if (k < 1 && this.deck.isConnected) requestAnimationFrame(step); else res(); }; step(); });
      this.thread = 0; this._take = this.flipped ? this.R : this.L;
    }
    finishTake() { this.busy = false; }
    // turn the reel over (the other side) or change to the next reel: the tape is rewound, the reel comes off, and it is threaded again
    async flipTo(side) {
      if (this.side === side) return;
      const wasBusy = this.busy; while (this.busy && !wasBusy) await this.wait(50);
      this.busy = true;
      const swap = S.discOf(side, 'reel') !== S.discOf(this.side, 'reel');
      const release = () => new Promise(res => { const t1 = performance.now(), step = () => { const k = S.clamp((performance.now() - t1) / 450, 0, 1); this.thread = 1 - k; if (k < 1 && this.deck.isConnected) requestAnimationFrame(step); else res(); }; step(); });
      if (!swap) {
        // turn the reel over: the full reel is lifted off, turned and set on the left spindle, the empty reel (now showing the other side) goes to the right
        await release(); this.thread = 0; this.prog = 0;
        const X = (RC.x - LC.x) / (RR * 2) * 100, lift = 'translateY(-34%) scale(1.14)';
        const go = (w, dx) => this.anim(w, [{ transform: 'none' }, { transform: `translateX(${dx / 2}%) translateY(-58%) scale(1.2) rotateY(45deg)`, offset: 0.5 }, { transform: `translateX(${dx}%) ${lift} rotateY(90deg)` }], 750, 'ease-in-out');
        const undo = [this.addDepth(this.L.w, this.L.cv, 0.33), this.addDepth(this.R.w, this.R.cv, 0.93)];
        await Promise.all([go(this.L.w, X), go(this.R.w, -X)]);
        this.flipped = !this.flipped; this.side = side; this.sideInfo = this.info(side); this._label = null; this._lastKey = '';
        const pair = await this.buildPair(); this.drawPair(pair);                                         // new faces are drawn while the reels are edge-on
        undo.forEach(u => u()); this.L.w.getAnimations().forEach(a => a.cancel()); this.R.w.getAnimations().forEach(a => a.cancel());
        const undo2 = [this.addDepth(this.L.w, this.L.cv, 0.93), this.addDepth(this.R.w, this.R.cv, 0.33)];
        await Promise.all([this.L.w, this.R.w].map(w => this.anim(w, [{ transform: `${lift} rotateY(90deg)` }, { transform: lift + ' rotateY(0deg)', offset: 0.45 }, { transform: 'none' }], 750, 'ease-out')));
        undo2.forEach(u => u()); [this.L.w, this.R.w].forEach(w => w.getAnimations().forEach(a => a.cancel()));
        this.threadMode = true; await this.threadIn(1100); this.threadMode = false;
        this.busy = false; await this.wait(120); return;
      }
      // change to the next reel: the tape is rewound, the reel comes off, and a new one is threaded
      this.rewinding = true; const p0 = this.prog, t0 = performance.now(), dur = 900 + p0 * 700;
      await new Promise(res => { const step = () => { const k = S.clamp((performance.now() - t0) / dur, 0, 1); this.prog = p0 * (1 - k * k); if (k < 1 && this.deck.isConnected) requestAnimationFrame(step); else res(); }; step(); });
      this.prog = 0; this.rewinding = false;
      await release(); this.thread = 0;
      const off = [{ transform: 'none', opacity: 1 }, { transform: 'translate(-20%,-70%) scale(1.25) rotate(-10deg)', opacity: 0 }];
      await Promise.all([this.anim(this.L.w, off, 600, 'ease-in'), this.flipped ? this.anim(this.R.w, [{ transform: 'none', opacity: 1 }, { transform: 'translate(20%,-70%) scale(1.25) rotate(10deg)', opacity: 0 }], 600, 'ease-in') : null]);
      this.flipped = false; this.side = side; this.sideInfo = this.info(side); this._label = null; this._lastKey = ''; await this.paintReels(true);
      this.R.w.getAnimations().forEach(a => a.cancel());
      await this.anim(this.L.w, [{ transform: 'translate(-26%,-60%) scale(1.3) rotate(-12deg)', opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: 'none', opacity: 1 }], 900);
      this.L.w.getAnimations().forEach(a => a.cancel());
      this.threadMode = true; await this.threadIn(1100); this.threadMode = false;
      this.busy = false; await this.wait(120);
    }

    // ---- live parts -------------------------------------------------------------------------------------------------
    tapePath(rs, rt) {                                                   // points the tape runs through (deck units): it leaves the edge of the tape on the supply reel and lands on the edge of the pack on the take-up reel
      const P1 = { x: ROLL[0].x - 14, y: ROLL[0].y - ROLL[0].r + 4 }, P2 = { x: ROLL[1].x + 14, y: ROLL[1].y - ROLL[1].r + 4 };
      const tan = (C, r, P) => {                                         // touch point of the tangent from P that runs along the lower side of the pack
        const d = Math.hypot(P.x - C.x, P.y - C.y), phi = Math.atan2(P.y - C.y, P.x - C.x), al = Math.acos(Math.min(1, r / d));
        const q = [phi + al, phi - al].map(t => ({ x: C.x + Math.cos(t) * r, y: C.y + Math.sin(t) * r }));
        return q[0].y > q[1].y ? q[0] : q[1];
      };
      return [tan(LC, rs * RR, P1), P1, { x: 770, y: HEADY }, { x: 1213, y: HEADY }, P2, tan(RC, rt * RR, P2)];
    }
    drawTape() {
      const c = this.tapeCv, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
      if (!this.album || !this.loaded || this.thread <= 0) return;
      const { rs, rt } = this.radii(this.prog), pts = this.tapePath(rs, rt).map(p => ({ x: p.x / 2, y: p.y / 2 }));
      const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)), total = seg.reduce((a, b) => a + b, 0);
      let left = total * this.thread; x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
      const trace = () => { x.beginPath(); x.moveTo(pts[0].x, pts[0].y); let rem = left; for (let i = 0; i < seg.length && rem > 0; i++) { const k = Math.min(1, rem / seg[i]); x.lineTo(pts[i].x + (pts[i + 1].x - pts[i].x) * k, pts[i].y + (pts[i + 1].y - pts[i].y) * k); rem -= seg[i]; } };
      trace(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3.4; x.translate(0, 1.2); x.stroke(); x.translate(0, -1.2);
      trace(); x.strokeStyle = '#6a5240'; x.lineWidth = 2.4; x.stroke(); x.strokeStyle = 'rgba(255,235,210,.35)'; x.lineWidth = 0.8; x.stroke();
      x.restore();
    }
    drawMeters(dt, playing) {
      const live = playing && !this.busy ? S.meter.read() : null;
      for (let ch = 0; ch < 2; ch++) {
        let target = -90;
        if (live) target = live[ch]; else if (playing && !S.meter.ok) { const t = this.t * (3.1 + ch * 0.7) + ch * 9; target = -22 + 12 * Math.sin(t) + 6 * Math.sin(t * 2.3 + 1); }
        const cur = this.lvl[ch], k = target > cur ? 1 - Math.exp(-dt * 9) : 1 - Math.exp(-dt * 4.5);        // VU ballistics: ~300 ms
        this.lvl[ch] = cur + (target - cur) * k;
        const db = S.clamp(this.lvl[ch], -30, 4), deg = db < -20 ? -48 - (-20 - db) * 0.5 : -48 + (db + 20) * (56 / 23);
        this.needle[ch] = S.clamp(deg, -53, 8);
        const c = this.mc[ch], x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
        if (!c._face) continue;
        x.drawImage(c._face, 0, 0, c.width, c.height); x.scale(2, 2);
        const read = this.lvl[ch] + 12, [tx, ty] = scalePoint(ch, read < -20 ? -20 : read), [px, py] = MSCALE[ch].pivot;           // 0 on the scale sits ~12 dB below full scale, like a VU meter
        const dx = tx - px, dy = ty - py, len = Math.hypot(dx, dy), ex = px + dx / len * (len + 9), ey = py + dy / len * (len + 9);
        x.lineCap = 'round'; x.strokeStyle = 'rgba(60,25,0,.28)'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(px + 1.5, py + 2); x.lineTo(ex + 1.5, ey + 2); x.stroke();     // soft shadow on the face
        x.strokeStyle = '#17120e'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
      }
    }
    drawTables(a0, a1) {                                                                      // the reel tables in the black wells: a turned platter with the three-prong drive hub the reels sit on
      [a0, a1].forEach((ang, i) => {
        const cv = this.tables[i]; if (!cv) return; const key = Math.round(ang * 4); if (cv._k === key) return; cv._k = key;
        const x = cv.getContext('2d'), n = cv.width, R = n / 2 * 0.96; x.clearRect(0, 0, n, n); x.save(); x.translate(n / 2, n / 2);
        const sh = x.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.04); sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sh; x.beginPath(); x.arc(0, 0, R * 1.04, 0, 7); x.fill();
        x.rotate(ang * Math.PI / 180);
        let g = x.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R); g.addColorStop(0, '#3a3d43'); g.addColorStop(0.6, '#25272b'); g.addColorStop(1, '#141517'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, 7); x.fill();      // platter
        x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1; for (let r = R * 0.3; r < R * 0.97; r += R * 0.022) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }                    // machined rings
        x.strokeStyle = '#5b5f66'; x.lineWidth = R * 0.022; x.beginPath(); x.arc(0, 0, R * 0.985, 0, 7); x.stroke();                                                                   // rim
        x.strokeStyle = '#0a0a0b'; x.lineWidth = R * 0.03; x.beginPath(); x.arc(0, 0, R * 0.62, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.1)'; x.lineWidth = R * 0.01; x.beginPath(); x.arc(0, 0, R * 0.645, 0, 7); x.stroke();     // groove
        for (let k = 0; k < 3; k++) { x.save(); x.rotate(k * Math.PI * 2 / 3); const pg = x.createLinearGradient(-R * 0.05, 0, R * 0.05, 0); pg.addColorStop(0, '#8b8f96'); pg.addColorStop(0.5, '#e4e6ea'); pg.addColorStop(1, '#7d8188'); x.fillStyle = pg; x.beginPath(); x.roundRect(-R * 0.045, -R * 0.46, R * 0.09, R * 0.32, R * 0.04); x.fill(); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(R * 0.03, -R * 0.44, R * 0.012, R * 0.28); x.restore(); }   // drive prongs
        g = x.createRadialGradient(-R * 0.06, -R * 0.07, R * 0.02, 0, 0, R * 0.2); g.addColorStop(0, '#f2f3f5'); g.addColorStop(0.7, '#a9adb4'); g.addColorStop(1, '#6a6e75'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.2, 0, 7); x.fill();   // hub
        x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#26282c'; x.beginPath(); x.arc(0, 0, R * 0.075, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(-R * 0.02, -R * 0.025, R * 0.025, 0, 7); x.fill();
        x.fillStyle = '#d8d8d8'; x.beginPath(); x.arc(0, -R * 0.8, R * 0.022, 0, 7); x.fill();                                                                                         // a dot so the turning shows
        x.restore();
      });
    }
    drawPart(cv, ang) {
      if (!cv._im) return; const x = cv.getContext('2d'), n = cv.width; x.clearRect(0, 0, n, n); x.save(); x.translate(n / 2, n / 2); x.rotate(ang * Math.PI / 180); x.drawImage(cv._im, -n / 2, -n / 2, n, n);
      if (cv.classList.contains('rr-cap')) { x.fillStyle = 'rgba(30,30,34,.85)'; x.beginPath(); x.arc(0, -n * 0.3, n * 0.055, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(0, n * 0.3, n * 0.035, 0, 7); x.fill(); }    // a mark so the turning shows
      x.restore();
    }
    drawCounter() {
      const c = this.ctr, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.save(); x.scale(2, 2);
      const s = String(Math.max(0, this.ctrRaw - this.ctrBase) % 1000).padStart(3, '0'), w = 106 / 3;
      for (let i = 0; i < 3; i++) {
        const g = x.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, '#d8d8d3'); g.addColorStop(0.5, '#f6f6f1'); g.addColorStop(1, '#b8b8b3'); x.fillStyle = g; x.fillRect(i * w + 3, 5, w - 6, 30);
        x.fillStyle = '#111'; x.font = '700 24px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s[i], i * w + w / 2, 21);
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(i * w + 3, 5, w - 6, 6); x.fillRect(i * w + 3, 29, w - 6, 6);
      }
      x.restore();
    }
    frame(dt, st) {
      this.t += dt;
      if (!this.album) { this.drawMeters(dt, false); this.drawCounter(); this.drawTables(0, 0); return; }                // meters, counter and the empty reel tables are always on show
      const run = ((st.playing || this.threading || this.rewinding) && !this.busyIdle) ? 1 : 0;
      // reels spin up quickly; STOP halts them at once (no wind-down)
      if (run) this.spin += (1 - this.spin) * (1 - Math.exp(-dt * 6)); else this.spin = 0;
      if (st.hasTrack && !this.busy) this.prog = S.clamp(st.sideFrac || 0, 0, 1);
      const { rs, rt } = this.radii(this.prog);
      const speed = this.rewinding ? 6 : this.threading ? 0.6 : 1, dir = this.rewinding ? 1 : -1;        // forward play: both reels turn anticlockwise
      if (!this.threading) this.angS += dir * IPS_MM * speed / (Math.max(rs, 0.3) * REEL_MM) * 180 / Math.PI * dt * this.spin;
      if (!this.threading) this.angT += dir * IPS_MM * speed / (Math.max(rt, 0.3) * REEL_MM) * 180 / Math.PI * dt * this.spin;
      if (!this.threading) { const w = IPS_MM * speed * this.spin * dt * 180 / Math.PI; this.angW += -dir * w / (WHEEL_MM); this.angC += dir * w / (CAP_MM) * 0.17; }     // idler wheels clockwise, capstans anticlockwise (capstan drawn slower so it can be followed)
      this.wheels.forEach(w => this.drawPart(w, this.angW)); this.caps.forEach(c => this.drawPart(c, this.angC));
      this.drawTables(this.angS, this.angT);
      this.L.cv.style.transform = `rotate(${this.angS}deg)`; this.R.cv.style.transform = `rotate(${this.angT}deg)`;
      this.paintReels(false);
      this.drawTape(); this.drawMeters(dt, st.playing);
      this.ctrRaw = Math.floor((st.sideTime || 0) * 0.6); this.drawCounter();
      const paused = S.app.album && !S.app.stopped && S.app.audio.paused && !S.app.flipping && !this.busy;
      this.led.pause.classList.toggle('on', !!paused); this.led.rec.classList.remove('on');
      this.keys.play.classList.toggle('lit', st.playing);
      this.knob.style.setProperty('--r', (-135 + S.app.audio.volume * 270) + 'deg');
      this.deck.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); if (this.art.src) URL.revokeObjectURL(this.art.src); this.deck.remove(); }
  }
  S.stages = S.stages || {};
  S.stages.reel = ReelStage;
  // the album's reel, full, as a picture (library animations)
  S.reelFace = async (album, side) => {
    const st = Object.create(ReelStage.prototype); st.album = album; st.flipped = false; st.side = side; st.sideInfo = st.info(side);
    return buildReel(st.reelKind(), st.radii(0).rs, await st.labelFor(side), 640, st.reelOpts());
  };
  S.reelArt = { buildReel, paintDeck };
})(window.S);
