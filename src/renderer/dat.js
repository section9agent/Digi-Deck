// DAT deck (modelled on Sony DTC-59ES / DTC-700 / DTC-670 photos): black brushed front, a cassette door with a smoked window
// (the tape sits tilted back a little and is lit by an LED so the hubs can be seen turning), a red fluorescent display with
// ABS time, programme number and level bars, and the transport keys. DAT plays one way (left to right): no flip, one letter
// per tape, like a disc. No audio filter.
(function (S) {
  const A = '../../assets/dat/';
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
  const imgs = new Map();
  const ld = src => { if (!imgs.has(src)) imgs.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); return imgs.get(src); };
  const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.roundRect(X, Y, w, h, r); };
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the tape (73 x 54 mm), drawn at K px per mm
  const K = 12, TW = 73 * K, TH = 54 * K;
  // layout (mm) after a Sony DT-60: a lid across the top (brand, arrow, lock slot, length), a long label strip under it, then a big
  // smoked window over the hubs with the DAT logo printed on it, and a ribbed foot
  const LABEL = { x: 7.5, y: 14.6, w: 58, h: 7.3 };               // the label strip (58 mm long)
  const WIN = { x: 7.4, y: 23.8, w: 58.2, h: 24, r: 1.3 };        // the smoked window
  const HUB = { l: 21.2, r: 51.8, y: 34.8, hub: 4.7, full: 7.0 };  // hub centres (mm), hub radius, a full pack's radius
  S.DAT_LABEL_ASPECT = LABEL.w / LABEL.h;

  const shellHex = album => S.colorOf(S.DAT_COLORS, (album && album.color) || 'black').hex;
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k)))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  // the moulded plastic's fine texture
  function stipple(x, X, Y, W, H, seed = 3, amt = 1) {
    let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < W * H / 9 * amt; i++) { const v = rnd(); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.09})` : `rgba(0,0,0,${(0.5 - v) * 0.22})`; x.fillRect(X + rnd() * W, Y + rnd() * H, 1.6, 1.6); }
  }
  const gold = (x, y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#f6e2a6'); g.addColorStop(0.45, '#c9a659'); g.addColorStop(0.55, '#a8873c'); g.addColorStop(1, '#e8cf88'); return g; };
  let goldLogo = null;
  async function datLogoGold() {
    if (goldLogo) return goldLogo;
    const w = await ld(A + 'dat-logo-white.png'); if (!w) return null;
    const c = mk(w.width, w.height), x = c.getContext('2d'); x.drawImage(w, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = gold(x, 0, c.height); x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-out';                       // the gold logo is printed in fine stripes
    for (let y = 0; y < c.height; y += c.height / 26) x.fillRect(0, y + c.height / 26 * 0.62, c.width, c.height / 26 * 0.38);
    return (goldLogo = c);
  }

  // the generic label: a white strip with the title written on it
  function genericLabel(album, x, side, n) {
    const L = LABEL, [X, Y, W, H] = [L.x * K, L.y * K, L.w * K, L.h * K];
    x.save(); rr(x, X, Y, W, H, 0.4 * K); x.clip();
    const g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, '#fbfbf8'); g.addColorStop(1, '#e9e8e2'); x.fillStyle = g; x.fillRect(X, Y, W, H);
    x.fillStyle = '#c9ccd2'; x.fillRect(X, Y + H - 0.9 * K, W, 0.9 * K);                                   // printed band along the foot
    x.fillStyle = '#8a8f98'; x.font = `700 ${0.62 * K}px Helvetica, Arial, sans-serif`; x.textBaseline = 'middle'; x.fillText('DIGI-DECK  DIGITAL AUDIO TAPE', X + 1 * K, Y + H - 0.45 * K);
    x.textBaseline = 'alphabetic';
    const t = (album && (album.title || album.name)) || 'Untitled', ar = (album && S.displayArtist ? S.displayArtist(album) : album && album.artist) || '';
    const fit = (s, w) => { let v = s; while (v.length > 1 && x.measureText(v).width > w) v = v.slice(0, -2) + '…'; return v; };
    x.fillStyle = '#1b2a55'; x.font = `600 ${2.6 * K}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
    x.fillText(fit(t, W * 0.6), X + 1.4 * K, Y + 4.2 * K);
    x.font = `500 ${1.7 * K}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
    x.textAlign = 'right'; x.fillText(fit(ar + (n > 1 ? `  (${S.SIDE_LETTERS.indexOf(side) + 1}/${n})` : ''), W * 0.36), X + W - 1.4 * K, Y + 4.2 * K);
    x.restore();
  }

  // the static front of a tape: shell, lid, label, the window cut out (the hubs are drawn behind it)
  async function tapeBody(album, side, n) {
    const c = mk(TW, TH), x = c.getContext('2d'), base = shellHex(album);
    // shell, with the stepped shoulders at the top corners
    const g = x.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, shade(base, 0.12)); g.addColorStop(1, shade(base, -0.2));
    x.beginPath(); x.roundRect(0, 1.6 * K, TW, TH - 1.6 * K, 1.4 * K); x.roundRect(1.4 * K, 0, TW - 2.8 * K, 3 * K, 0.6 * K); x.fillStyle = g; x.fill();
    stipple(x, 0, 0, TW, TH, 5, 1.2);
    // side rails and the raised panels (lid, label bed, window frame)
    const panel = (X, Y, W, H, k, r = 0.6) => { const pg = x.createLinearGradient(0, Y * K, 0, (Y + H) * K); pg.addColorStop(0, shade(base, k + 0.1)); pg.addColorStop(1, shade(base, k - 0.12)); rr(x, X * K, Y * K, W * K, H * K, r * K); x.fillStyle = pg; x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 0.18 * K; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.09)'; x.lineWidth = 0.12 * K; rr(x, (X + 0.1) * K, (Y + 0.1) * K, (W - 0.2) * K, (H - 0.2) * K, r * K); x.stroke(); };
    panel(6.4, 2.2, 60.2, 11.4, 0.06);                                    // lid
    panel(6.8, 14.1, 59.4, 8.3, -0.08, 0.3);                               // label bed
    panel(6.8, 23.2, 59.4, 25.3, -0.02, 1);                                // window frame
    stipple(x, 6.4 * K, 2.2 * K, 60.2 * K, 11.4 * K, 9, 0.8);
    // lid printing: brand, arrow, lock slot, length
    x.fillStyle = '#d9dcdf'; x.font = `700 ${2.6 * K}px "Times New Roman", Georgia, serif`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.save(); x.scale(1.18, 1); x.fillText('DIGI-DECK', 10.2 * K / 1.18, 10.2 * K); x.restore();
    x.fillStyle = '#121214'; x.beginPath(); x.moveTo(36.5 * K, 3 * K); x.lineTo(38.6 * K, 6.8 * K); x.lineTo(34.4 * K, 6.8 * K); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 0.12 * K; x.stroke();
    rr(x, 31.4 * K, 8.9 * K, 10.1 * K, 2.4 * K, 0.2 * K); x.fillStyle = '#0d0d0f'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.12)'; x.stroke();
    x.fillStyle = gold(x, 4 * K, 11 * K); x.font = `700 ${1.7 * K}px Helvetica, Arial, sans-serif`; x.fillText('DT-', 47.4 * K, 10.2 * K);
    x.font = `400 ${5.6 * K}px "Times New Roman", Georgia, serif`; x.fillText('120', 51.4 * K, 10.6 * K);
    // label
    const L = LABEL, own = album && album['label_' + side.toLowerCase()] ? await S.loadImage(album['label_' + side.toLowerCase()]) : null;
    if (own) { x.save(); rr(x, L.x * K, L.y * K, L.w * K, L.h * K, 0.4 * K); x.clip(); S.drawCover(x, own, L.x * K, L.y * K, L.w * K, L.h * K); x.restore(); }
    else genericLabel(album, x, side, n);
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.2 * K; rr(x, L.x * K, L.y * K, L.w * K, L.h * K, 0.4 * K); x.stroke();
    // the window, cut out
    x.save(); x.globalCompositeOperation = 'destination-out'; rr(x, WIN.x * K, WIN.y * K, WIN.w * K, WIN.h * K, WIN.r * K); x.fill(); x.restore();
    // printed on the window: the striped gold DAT logo and "Digital Audio Tape"
    const logo = await datLogoGold();
    if (logo) { const lw = 19 * K, lh = lw * logo.height / logo.width; x.drawImage(logo, 36.5 * K - lw / 2, 35 * K, lw, lh); }   // the logo artwork includes "Digital Audio Tape"
    // glass gloss over the window
    x.save(); rr(x, WIN.x * K, WIN.y * K, WIN.w * K, WIN.h * K, WIN.r * K); x.clip();
    const gg = x.createLinearGradient(0, WIN.y * K, 0, (WIN.y + WIN.h) * K); gg.addColorStop(0, 'rgba(255,255,255,.14)'); gg.addColorStop(0.3, 'rgba(255,255,255,.03)'); gg.addColorStop(0.75, 'rgba(255,255,255,.02)'); gg.addColorStop(1, 'rgba(255,255,255,.09)');
    x.fillStyle = gg; x.fillRect(WIN.x * K, WIN.y * K, WIN.w * K, WIN.h * K);
    x.fillStyle = 'rgba(255,255,255,.07)'; x.beginPath(); x.moveTo(30 * K, WIN.y * K); x.lineTo(38 * K, WIN.y * K); x.lineTo(28 * K, (WIN.y + WIN.h) * K); x.lineTo(20 * K, (WIN.y + WIN.h) * K); x.fill();
    x.restore();
    // ribbed foot
    for (let k = 0; k < 6; k++) { const y = (48.9 + k * 0.5) * K; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(6.8 * K, y, 59.4 * K, 0.22 * K); x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(6.8 * K, y + 0.22 * K, 59.4 * K, 0.12 * K); }
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 0.3 * K; rr(x, 0.2 * K, 1.8 * K, TW - 0.4 * K, TH - 2 * K, 1.3 * K); x.stroke();
    return c;
  }

  // the window's contents, redrawn as the hubs turn: smoky inside, tape packs (supply left, take-up right), white hubs
  function drawWindow(cv, f, angL, angR, glow) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / (WIN.w + 2), ox = -(WIN.x - 1) * s, oy = -(WIN.y - 1) * s;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    x.setTransform(s, 0, 0, s, ox, oy);
    // inside, seen through smoked plastic: the dark base plate, lit from the LED
    const bg = x.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
    bg.addColorStop(0, glow ? '#6e6b66' : '#303031'); bg.addColorStop(0.5, glow ? '#55524e' : '#252526'); bg.addColorStop(1, glow ? '#403e3b' : '#1b1b1c');
    x.fillStyle = bg; x.fillRect(WIN.x - 1, WIN.y - 1, WIN.w + 2, WIN.h + 2);
    // moulded guides: a bar across the top where the tape runs, and the centre post
    x.fillStyle = glow ? 'rgba(200,196,190,.35)' : 'rgba(150,150,150,.18)'; x.fillRect(WIN.x + 4, WIN.y + 0.8, WIN.w - 8, 0.9);
    x.strokeStyle = glow ? 'rgba(220,216,210,.4)' : 'rgba(160,160,160,.2)'; x.lineWidth = 0.18;
    x.beginPath(); x.moveTo(29.5, WIN.y + 3.2); x.quadraticCurveTo(36.5, WIN.y + 1.9, 43.5, WIN.y + 3.2); x.stroke();
    x.fillStyle = '#0c0c0d'; x.beginPath(); x.arc(36.5, WIN.y + 5.3, 0.75, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 0.12; x.stroke();
    const A2 = HUB.full * HUB.full - HUB.hub * HUB.hub, rS = Math.sqrt(HUB.full * HUB.full - f * A2), rT = Math.sqrt(HUB.hub * HUB.hub + f * A2);
    const pack = (cx, r) => {
      const pg = x.createRadialGradient(cx, HUB.y, HUB.hub, cx, HUB.y, r);
      pg.addColorStop(0, '#141110'); pg.addColorStop(0.85, glow ? '#30271f' : '#16120f'); pg.addColorStop(1, glow ? '#4a3d31' : '#221c17');
      x.fillStyle = pg; x.beginPath(); x.arc(cx, HUB.y, r, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 0.06; for (let q = HUB.hub + 0.5; q < r; q += 0.55) { x.beginPath(); x.arc(cx, HUB.y, q, 0, TAU); x.stroke(); }
    };
    if (rS > HUB.hub + 0.05) pack(HUB.l, rS); if (rT > HUB.hub + 0.05) pack(HUB.r, rT);
    // the tape leaves the left pack on its outside, runs up to the top of the cassette, across, and down the outside of the right pack
    x.strokeStyle = glow ? '#2e251e' : '#15110e'; x.lineWidth = 0.32;
    x.beginPath(); x.moveTo(HUB.l - rS, HUB.y); x.lineTo(HUB.l - HUB.full - 0.9, WIN.y + 1.2); x.lineTo(HUB.r + HUB.full + 0.9, WIN.y + 1.2); x.lineTo(HUB.r + rT, HUB.y); x.stroke();
    // the clear "C" guide rings round each hub (open at the top)
    for (const cx of [HUB.l, HUB.r]) {
      x.strokeStyle = glow ? 'rgba(120,118,114,.9)' : 'rgba(70,70,72,.9)'; x.lineWidth = 0.85;
      x.beginPath(); x.arc(cx, HUB.y, HUB.full + 0.75, -Math.PI / 2 + 0.42, Math.PI * 1.5 - 0.42); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 0.15; x.beginPath(); x.arc(cx, HUB.y, HUB.full + 1.15, -Math.PI / 2 + 0.42, Math.PI * 1.5 - 0.42); x.stroke();
    }
    const hub = (cx, a) => {
      x.save(); x.translate(cx, HUB.y); x.rotate(a);
      // white hub: a toothed outer ring and a dark centre with six white drive teeth
      x.fillStyle = '#e9eaea'; x.beginPath();
      for (let k = 0; k < 16; k++) { const a0 = k / 16 * TAU, rr2 = k % 2 ? HUB.hub * 0.86 : HUB.hub; x.arc(0, 0, rr2, a0, a0 + TAU / 16); }
      x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(0, 0, HUB.hub * 0.78, 0, TAU); x.fill();
      x.fillStyle = '#1a1b1d'; x.beginPath(); x.arc(0, 0, HUB.hub * 0.62, 0, TAU); x.fill();
      x.fillStyle = '#f2f3f3'; for (let k = 0; k < 6; k++) { x.save(); x.rotate(k * TAU / 6); x.beginPath(); x.moveTo(-0.45, -HUB.hub * 0.62); x.lineTo(0.45, -HUB.hub * 0.62); x.lineTo(0.28, -HUB.hub * 0.36); x.lineTo(-0.28, -HUB.hub * 0.36); x.fill(); x.restore(); }
      x.fillStyle = '#2a2b2e'; x.beginPath(); x.arc(0, 0, HUB.hub * 0.2, 0, TAU); x.fill();
      x.restore();
    };
    hub(HUB.l, angL); hub(HUB.r, angR);
    // smoke: the window plastic darkens everything a little
    x.fillStyle = glow ? 'rgba(20,18,16,.18)' : 'rgba(8,8,10,.35)'; x.fillRect(WIN.x - 1, WIN.y - 1, WIN.w + 2, WIN.h + 2);
    x.setTransform(1, 0, 0, 1, 0, 0);
  }

  // a tape as an element: window canvas under the body canvas
  async function buildTape(album, side, n) {
    const el = S.el('div', { class: 'dat-tape' });
    const win = mk((WIN.w + 2) * K, (WIN.h + 2) * K); win.className = 'dat-tw';
    Object.assign(win.style, { left: (WIN.x - 1) / 73 * 100 + '%', top: (WIN.y - 1) / 54 * 100 + '%', width: (WIN.w + 2) / 73 * 100 + '%', height: (WIN.h + 2) / 54 * 100 + '%' });
    const body = await tapeBody(album, side, n); body.className = 'dat-tb';
    el.append(win, body);
    const t = { el, win, body, side, angL: 0, angR: 0 };
    drawWindow(win, 0, 0, 0, false);
    return t;
  }
  S.datTapeFace = async (album, side = 'A') => { const t = await buildTape(album, side, S.sidesOf(album.tracks || []).length); drawWindow(t.win, 0, 0, 0, true); const c = mk(TW, TH), x = c.getContext('2d'); x.drawImage(t.win, (WIN.x - 1) * K, (WIN.y - 1) * K); x.drawImage(t.body, 0, 0); return c; };

  // ---------------------------------------------------------------- the deck front (1800 x 540 units), drawn once
  const DW = 1800, DH = 540;
  const DOOR = { x: 350, y: 92, w: 440, h: 300 };                    // the cassette door
  const DWIN = { x: 395, y: 196, w: 350, h: 158 };                   // its window: a letterbox onto the tape's hub window
  const DISP = { x: 870, y: 74, w: 650, h: 200 };                    // the fluorescent display
  async function deckFace() {
    const c = mk(DW * 2, DH * 2), x = c.getContext('2d'); x.scale(2, 2);
    // brushed black aluminium front with a bevelled edge
    const g = x.createLinearGradient(0, 0, 0, DH); g.addColorStop(0, '#2b2d31'); g.addColorStop(0.08, '#1b1c1f'); g.addColorStop(1, '#101113');
    rr(x, 0, 0, DW, DH, 10); x.fillStyle = g; x.fill();
    // brushed aluminium (anodised black): fine streaks of varying length, then a broad soft sheen across the face
    for (let yy = 0; yy < DH; yy += 0.9) { const v = Math.abs(Math.sin(yy * 12.9898) * 43758.5453 % 1); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.11})` : `rgba(0,0,0,${v * 0.2})`; x.fillRect(4, yy, DW - 8, 0.6); }
    for (let i = 0; i < 900; i++) { const r = n => Math.abs(Math.sin((i + n) * 78.233) * 12345.678 % 1); x.fillStyle = `rgba(255,255,255,${0.03 + r(1) * 0.05})`; x.fillRect(r(2) * DW, r(3) * DH, 40 + r(4) * 260, 0.6); }
    const sh = x.createLinearGradient(0, 0, DW, DH); sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(0.32, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(255,255,255,.09)'); sh.addColorStop(0.7, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.05)');
    x.fillStyle = sh; rr(x, 0, 0, DW, DH, 10); x.fill();
    const top = x.createLinearGradient(0, 0, 0, 14); top.addColorStop(0, 'rgba(255,255,255,.28)'); top.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = top; x.fillRect(6, 1, DW - 12, 14);
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2; rr(x, 1.5, 1.5, DW - 3, DH - 3, 9); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(10, DH - 1); x.lineTo(DW - 10, DH - 1); x.stroke();
    // lower split line (the DTC fronts are two panels)
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 418, 330, 2); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 420, 330, 1);
    // brand, power, timer, open/close labels
    x.fillStyle = '#e6e8eb'; x.font = '700 40px "Times New Roman", Georgia, serif'; x.textBaseline = 'alphabetic'; x.fillText('DIGI-DECK', 46, 70);
    x.fillStyle = '#c8ccd1'; x.font = '600 13px Helvetica, Arial, sans-serif';
    x.fillText('⊓ON  ⊔OFF', 74, 186); x.fillText('TIMER', 88, 254); x.font = '600 11px Helvetica, Arial, sans-serif'; x.fillText('REC   OFF   PLAY', 66, 300);
    x.font = '600 13px Helvetica, Arial, sans-serif'; x.fillText('OPEN/CLOSE', 62, 336); x.fillText('PHONES', 46, 470); x.fillText('LEVEL', 196, 470);
    x.font = '600 10px Helvetica, Arial, sans-serif'; x.fillText('0', 186, 524); x.fillText('10', 250, 524);
    // timer slide switch
    rr(x, 66, 266, 120, 18, 3); x.fillStyle = '#060607'; x.fill(); rr(x, 116, 264, 22, 22, 3); x.fillStyle = '#3a3c40'; x.fill();
    // the compartment: a recess round the door, with the loading slot along its top
    rr(x, DOOR.x - 14, DOOR.y - 26, DOOR.w + 28, DOOR.h + 40, 8); x.fillStyle = '#060607'; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1.5; x.stroke();
    rr(x, DOOR.x + 30, DOOR.y - 18, DOOR.w - 60, 9, 3); x.fillStyle = '#000'; x.fill();
    // gold print
    x.fillStyle = '#c9a85a'; x.font = 'italic 600 15px Helvetica, Arial, sans-serif'; x.fillText('HIGH DENSITY LINEAR A/D D/A CONVERTER', DOOR.x - 6, 470);
    x.font = 'italic 700 22px Helvetica, Arial, sans-serif'; x.fillText('DD-1ES', DOOR.x + DOOR.w - 92, 430);
    // display window frame
    rr(x, DISP.x - 10, DISP.y - 10, DISP.w + 20, DISP.h + 20, 6); x.fillStyle = '#050505'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.1)'; x.lineWidth = 1.5; x.stroke();
    // key strip under the display, and its labels
    rr(x, DISP.x - 10, 300, DISP.w + 20, 104, 6); x.fillStyle = '#0b0b0c'; x.fill();
    x.fillStyle = '#c8ccd1'; x.font = '600 11px Helvetica, Arial, sans-serif'; x.textAlign = 'center';
    x.fillText('AMS', DISP.x + 400, 296); x.fillText('REVIEW ◀◀ ▶▶ CUE', DISP.x + 577, 296);
    x.textAlign = 'left'; x.fillText('DIGITAL AUDIO TAPE DECK  DD-1ES', DISP.x + 330, 440);
    // the volume knob's scale (marked like a REC LEVEL knob)
    const kx = 1660, ky = 190; x.fillStyle = '#c8ccd1'; x.font = '600 12px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('VOLUME', kx, 80);
    for (let k = 0; k <= 10; k++) { const a = (-225 + k * 27) * Math.PI / 180, r1 = 92, r2 = k % 5 ? 99 : 104; x.strokeStyle = '#c8ccd1'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(kx + Math.cos(a) * r1, ky + Math.sin(a) * r1); x.lineTo(kx + Math.cos(a) * r2, ky + Math.sin(a) * r2); x.stroke();
      if (k % 2 === 0) x.fillText(String(k), kx + Math.cos(a) * 118, ky + Math.sin(a) * 118 + 4); }
    x.fillText('INPUT  ANALOG · OPT · COAX', kx, 360); rr(x, kx - 50, 370, 100, 16, 3); x.fillStyle = '#060607'; x.fill(); rr(x, kx - 48, 368, 22, 20, 3); x.fillStyle = '#3a3c40'; x.fill();
    x.textAlign = 'left';
    return c;
  }

  // the door: smoked window, DAT logo; drawn once (the window is a hole, the tape shows through it)
  async function doorFace() {
    const S2 = 4, c = mk(DOOR.w * S2, DOOR.h * S2), x = c.getContext('2d'); x.scale(S2, S2);
    const g = x.createLinearGradient(0, 0, 0, DOOR.h); g.addColorStop(0, '#2a2c30'); g.addColorStop(0.5, '#17181b'); g.addColorStop(1, '#0d0e10');
    rr(x, 0, 0, DOOR.w, DOOR.h, 6); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1.2; rr(x, 0.6, 0.6, DOOR.w - 1.2, DOOR.h - 1.2, 6); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(4, 3, DOOR.w - 8, 26);                                       // the finger lip along the top
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(4, 29, DOOR.w - 8, 2);
    const logo = await ld(A + 'dat-logo-white.png');
    if (logo) { const lh = 52, lw = lh * logo.width / logo.height; x.globalAlpha = 0.92; x.drawImage(logo, (DOOR.w - lw) / 2, 31 + (DWIN.y - DOOR.y - 6 - 31 - lh) / 2, lw, lh); x.globalAlpha = 1; }   // fits between the lip and the window
    const wx = DWIN.x - DOOR.x, wy = DWIN.y - DOOR.y;
    rr(x, wx - 6, wy - 6, DWIN.w + 12, DWIN.h + 12, 8); x.fillStyle = '#050506'; x.fill();
    x.save(); x.globalCompositeOperation = 'destination-out'; rr(x, wx, wy, DWIN.w, DWIN.h, 5); x.fill(); x.restore();
    // window scale marks at its ends (as on the DTC-670)
    x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 7; k++) { x.fillRect(wx + 8, wy + 19 + k * 12, 10, 1.4); x.fillRect(wx + DWIN.w - 18, wy + 19 + k * 12, 10, 1.4); }
    return c;
  }

  // ---------------------------------------------------------------- the stage
  class DATStage {
    constructor(host) {
      this.host = host; this.album = null; this.tapes = []; this.tape = 'A'; this.cur = null; this.busy = false; this.open = false; this.glow = 0; this.alwaysRun = true;
      this.build(); this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    async build() {
      const e = S.el;
      this.root = e('div', { class: 'datp' });
      this.deck = e('div', { class: 'dat-deck' });
      this.face = e('div', { class: 'dat-face' });
      this.cavity = e('div', { class: 'dat-cav' });                      // behind the door: the holder the tape sits in, tilted back
      this.holder = e('div', { class: 'dat-holder' });
      this.led = e('div', { class: 'dat-led' });
      this.cavity.append(this.holder, this.led);
      this.door = e('div', { class: 'dat-door', title: 'Open / close' });
      this.doorGlass = e('div', { class: 'dat-glass' });
      this.disp = mk(DISP.w * 2, DISP.h * 2); this.disp.className = 'dat-disp';
      const key = (label, title, fn, cls = '') => e('button', { class: 'dat-key ' + cls, title, onclick: fn }, label);
      this.keys = [
        key('■', 'Stop', () => S.app.stop(), 'stop'), key('▶', 'Play', () => S.app.togglePlay(), 'play'), key('‖', 'Pause', () => S.app.togglePlay(), 'pause'),
        key('⏮', 'AMS - previous', () => S.app.prev(), 'ams'), key('⏭', 'AMS - next', () => S.app.next(), 'ams'),
        key('◀◀', 'Review (back 10 s)', () => this.nudge(-10), 'srch'), key('▶▶', 'Cue (forward 10 s)', () => this.nudge(10), 'srch')];
      this.power = key('POWER', 'Power', () => {}, 'power');
      this.ejectKey = key('⏏', 'Open / close - put in the next tape', () => this.openClose(), 'eject');
      this.knob = e('div', { class: 'dat-knob', title: 'Volume (drag or scroll)' }, e('i'));
      this.phones = e('div', { class: 'dat-jack' }); this.level = e('div', { class: 'dat-knob small' }, e('i'));
      this.deck.append(this.face, this.cavity, this.door, this.doorGlass, this.disp, ...this.keys, this.power, this.ejectKey, this.knob, this.phones, this.level);
      this.root.append(this.deck); this.host.append(this.root);
      this.door.addEventListener('click', () => S.app.togglePlay());
      this.knob.addEventListener('wheel', ev => { ev.preventDefault(); S.app.volume(ev.deltaY < 0 ? 0.05 : -0.05); }, { passive: false });
      this.knob.addEventListener('pointerdown', ev => {
        ev.preventDefault(); this.knob.setPointerCapture(ev.pointerId); let y0 = ev.clientY;
        const mv = e2 => { S.app.volume((y0 - e2.clientY) / 200); y0 = e2.clientY; }, up = () => { this.knob.removeEventListener('pointermove', mv); this.knob.removeEventListener('pointerup', up); };
        this.knob.addEventListener('pointermove', mv); this.knob.addEventListener('pointerup', up);
      });
      const [face, door] = await Promise.all([deckFace(), doorFace()]);
      this.face.append(face); this.door.append(door);
      this.ready = true; this.layout();
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight; if (!W || !H) return;
      const P = Math.min(W - 40, (H - 40) * DW / DH * 0.98), PH = P * DH / DW, u = P / DW;
      Object.assign(this.deck.style, { left: (W - P) / 2 + 'px', top: (H - PH) / 2 + 'px', width: P + 'px', height: PH + 'px' });
      this.deck.style.setProperty('--u', u * 1000 + 'px');
      const at = (el, X, Y, w, h) => Object.assign(el.style, { left: X * u + 'px', top: Y * u + 'px', width: w * u + 'px', height: h * u + 'px' });
      at(this.face, 0, 0, DW, DH);
      at(this.door, DOOR.x, DOOR.y, DOOR.w, DOOR.h); at(this.doorGlass, DWIN.x, DWIN.y, DWIN.w, DWIN.h);
      at(this.cavity, DWIN.x, DWIN.y, DWIN.w, DWIN.h);
      // the tape: 73 mm across the holder, a little wider than the window, so the window frames its middle
      const tw = DWIN.w * 0.9, th = tw * 54 / 73; at(this.holder, (DWIN.w - tw) / 2, DWIN.h * 0.56 - th * HUB.y / 54, tw, th);       // the whole tape across the window, tilted back
      this.holder.style.left = (DWIN.w - tw) / 2 * u + 'px';
      at(this.disp, DISP.x, DISP.y, DISP.w, DISP.h);
      const kx = DISP.x, ky = 316, kh = 72;
      [[10, 70], [88, 132], [228, 70], [324, 72], [404, 72], [504, 66], [578, 66]].forEach(([dx, w], i) => at(this.keys[i], kx + dx, ky, w, kh));   // all inside the key strip (DISP.x - 10 .. DISP.x + DISP.w + 10)
      at(this.power, 62, 112, 140, 56); at(this.ejectKey, 62, 346, 110, 44);
      at(this.knob, 1660 - 82, 190 - 82, 164, 164); at(this.phones, 70, 480, 34, 34); at(this.level, 200, 476, 44, 44);
      this.drawDisplay({});
    }
    setMulti(m) { this.multi = m; this.ejectKey.title = m ? 'Open / close - put in the next tape' : 'Open / close'; }
    nudge(d) { const a = S.app.audio; if (!S.app.album || !isFinite(a.duration)) return; a.currentTime = S.clamp(a.currentTime + d, 0, Math.max(0, a.duration - 0.5)); }
    async openClose() { if (this.multi) return S.app.manualSwap(); if (this.busy) return; this.busy = true; await this.doorOpen(true); await new Promise(r => setTimeout(r, 500)); await this.doorOpen(false); this.busy = false; }

    // the door swings out and down from its bottom edge; the holder (and the tape in it) comes forward with it
    // the door swings out and down from its bottom edge, and the holder with the tape in it rises up out of the slot, so the tape
    // stands up out of the open door; closing lowers it back in
    doorOpen(on, ms = 620) {
      this.open = on;
      const tf = on ? 'perspective(900px) rotateX(-34deg)' : 'perspective(900px) rotateX(0deg)', from = on ? 'perspective(900px) rotateX(0deg)' : 'perspective(900px) rotateX(-34deg)';
      const IN = 'perspective(600px) translateY(0) rotateX(24deg) scale(1)', OUT = 'perspective(600px) translateY(-78%) rotateX(4deg) scale(1.06)';
      const o = { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' };
      if (on) this.cavity.classList.add('out');
      const a1 = this.door.animate([{ transform: from }, { transform: tf }], o), a2 = this.doorGlass.animate([{ transform: from }, { transform: tf }], o);
      const a3 = this.holder.animate([{ transform: on ? IN : OUT }, { transform: on ? OUT : IN }], { ...o, duration: ms * 1.25, delay: on ? ms * 0.25 : 0 });
      return Promise.all([a1.finished, a2.finished, a3.finished]).catch(() => {}).then(() => { if (!on) this.cavity.classList.remove('out'); });
    }
    async insert(side) {
      const t = await buildTape(this.album, side, this.tapes.length);
      this.holder.replaceChildren(t.el); this.cur = t;
      if (this.quiet) { t.el.style.visibility = 'hidden'; this.waiting = true; return; }
      await this.doorOpen(true);
      await t.el.animate([{ transform: 'translateY(-90%)', opacity: 0 }, { transform: 'translateY(-40%)', opacity: 1, offset: 0.4 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 800, easing: 'cubic-bezier(.3,.6,.35,1)' }).finished.catch(() => {});
      await this.doorOpen(false);
    }
    async remove() {
      const t = this.cur; if (!t) return;
      await this.doorOpen(true);
      await t.el.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-90%)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' }).finished.catch(() => {});
      t.el.remove(); this.cur = null;
      await this.doorOpen(false, 450);
    }
    // ---- library hand-over hooks (the case animation can hand the tape over at the door) ----
    recordRect() { const r = this.holder.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    hideRecord(h) { if (this.cur) this.cur.el.style.visibility = h ? 'hidden' : ''; }
    // from the library: the door opens (the empty holder rises out of it), the tape is put in from above, then the door closes
    async prepArrive() { while (!this.waiting) await new Promise(r => setTimeout(r, 30)); await this.doorOpen(true); }
    async finishArrive() { while (!this.waiting) await new Promise(r => setTimeout(r, 30)); this.waiting = false; if (this.cur) { this.cur.el.style.visibility = ''; } await this.doorOpen(false); this.busy = false; }
    async prepTake() { while (this.busy) await new Promise(r => setTimeout(r, 40)); this.busy = true; await this.doorOpen(true); }
    finishTake() { if (this.cur) this.cur.el.remove(); this.cur = null; this.doorOpen(false, 450); this.busy = false; }
    recordCanvas() { return this.cur && this.cur.body; }
    async setAlbum(album) {
      while (!this.ready) await new Promise(r => setTimeout(r, 30));
      this.busy = true;
      if (this.cur) await this.remove();
      this.album = album; S.normalizeSides(album, 'dat');
      this.tapes = S.sidesOf(album.tracks); this.tape = this.tapes[0] || 'A';
      const q = this.quiet; await this.insert(this.tape); this.quiet = false;
      if (!q) this.busy = false;
    }
    async flipTo(side) {
      if (this.busy || side === this.tape) return;
      this.busy = true; await this.remove(); this.tape = side; await this.insert(side); this.busy = false;
    }
    currentSide() { return this.tape; }
    // skipping a track: the deck searches (fast-forward / rewind) for about a second and a half, then plays
    async search(dir) { this.searching = dir; await new Promise(r => setTimeout(r, 1500)); this.searching = 0; }

    frame(dt, st) {
      const playing = !!st.playing && !this.busy && !!this.cur;
      // the LED comes on with a tape in, and is brightest while it runs
      const want = this.cur && !this.open ? (playing ? 1 : 0.55) : 0;
      this.glow += (want - this.glow) * (1 - Math.exp(-dt * 4));
      this.led.style.opacity = this.glow.toFixed(3);
      if (this.cur) {
        const sec = st.sideTime || 0, f = S.clamp(sec / (120 * 60), 0, 1);
        if (this.searching) { const sp = this.searching * 14; this.cur.angL += dt * sp; this.cur.angR += dt * sp; }       // AMS search: the hubs race
        else if (playing) {
          // 8.15 mm/s past the heads: each hub turns at tape speed / its pack radius (both clockwise, left to right)
          const A2 = HUB.full * HUB.full - HUB.hub * HUB.hub, rS = Math.sqrt(HUB.full * HUB.full - f * A2), rT = Math.sqrt(HUB.hub * HUB.hub + f * A2), v = 8.15 * 1.6;
          this.cur.angL += dt * v / rS; this.cur.angR += dt * v / rT;
        }
        const key = [f.toFixed(4), this.cur.angL.toFixed(3), this.cur.angR.toFixed(3), this.glow > 0.3].join();
        if (key !== this._wk) { this._wk = key; drawWindow(this.cur.win, f, this.cur.angL, this.cur.angR, this.glow > 0.3); }
      }
      this.knob.style.setProperty('--r', (-135 + S.app.audio.volume * 270) + 'deg');
      this.drawDisplay(st, dt);
      this.root.classList.toggle('playing', playing);
    }

    // the fluorescent display: programme number, ABS time, level bars, status words
    drawDisplay(st, dt = 0) {
      const c = this.disp, x = c.getContext('2d'), W = DISP.w, H = DISP.h; if (!c.width) return;
      x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, W, H); x.fillStyle = '#060303'; x.fillRect(0, 0, W, H);
      const ON = (S.skin && S.skin.lcd()) || '#ff5a2a', OFF = ON + '17', BLUE = '#5ab8ff';
      const lit = (on, col = ON) => { x.fillStyle = on ? col : OFF; x.shadowColor = on ? col : 'transparent'; x.shadowBlur = on ? 8 : 0; };
      const word = (t, X, Y, on, size = 12, col) => { lit(on, col); x.font = `700 ${size}px Helvetica, Arial, sans-serif`; x.fillText(t, X, Y); };
      const has = !!(this.album && this.cur), playing = !!st.playing, tr = has ? this.album.tracks : [];
      const onTape = has ? tr.map((t, i) => i).filter(i => tr[i].side === this.tape) : [];
      const pos = onTape.indexOf(st.trackIndex);
      x.textBaseline = 'alphabetic';
      word('PGM NO', 40, 20, has, 11); word('ABS TIME', 200, 20, has, 11); word('48kHz', 470, 20, has, 11); word('SP', 545, 20, has, 11, BLUE); word('START ID', 572, 20, playing && (st.trackTime || 0) < 9, 10);
      const srch = this.searching; if (srch) { word(srch > 0 ? '▶▶' : '◀◀', 10, 66, true, 16); word('AMS', 400, 64, true, 14); } else { word('▶', 16, 66, playing, 20); word('‖', 16, 66, has && !playing && st.hasTrack, 20); }
      const seg = (t, X, Y, size) => S.segText(x, t, X, Y, size, { on: ON, off: OFF, glow: 8, label: 0.5 });
      if (has) {
        seg(pos >= 0 ? String(pos + 1).padStart(2, '0') : '--', 46, 68, 40);
        const s = Math.floor(st.sideTime || 0), hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
        seg(`${hh}h${String(mm).padStart(2, '0')}m${String(ss).padStart(2, '0')}s`, 200, 68, 36);
        if (this.tapes.length > 1) word(`TAPE ${S.SIDE_LETTERS.indexOf(this.tape) + 1}/${this.tapes.length}`, 500, 64, true, 14);
      }
      // the title in 5 x 8 dot-matrix cells, scrolling when it is long
      const t = st.trackIndex >= 0 && tr[st.trackIndex], text = !has ? 'NO TAPE' : t ? (t.title || '') + (t.artist && t.artist !== this.album.artist ? ' - ' + t.artist : '') : (this.album.title || '');
      this.tt = (this.tt || 0) + dt;
      S.dotText(x, S.dotScroll(text.toUpperCase() === text ? text : text, 25, this.tt, 3), 40, 82, { dot: 2.6, gap: 0.9, on: ON, off: 'rgba(255,90,42,.07)', glow: 5, cells: 25 });
      // level bars (L, R) with the dB scale between them
      const live = playing && S.meter && S.meter.ok ? S.meter.read() : null;
      this.lv = this.lv || [0, 0]; this.pk = this.pk || [0, 0]; this.pkT = this.pkT || [0, 0];
      const scale = ['-∞', '40', '30', '20', '12', '6', '4', '2', '0', 'OVER'], N = 30, X0 = 74, X1 = W - 30;
      for (let ch = 0; ch < 2; ch++) {
        let tgt = 0; if (live) tgt = S.clamp((live[ch] + 50) / 50, 0, 1); else if (playing) { const t = performance.now() / 1000 * (3 + ch); tgt = S.clamp(0.6 + 0.2 * Math.sin(t) + 0.1 * Math.sin(t * 2.7), 0, 1); }
        this.lv[ch] += (tgt - this.lv[ch]) * (1 - Math.exp(-dt * (tgt > this.lv[ch] ? 30 : 5)));
        if (this.lv[ch] >= this.pk[ch]) { this.pk[ch] = this.lv[ch]; this.pkT[ch] = 1; } else { this.pkT[ch] -= dt; if (this.pkT[ch] < 0) this.pk[ch] = Math.max(this.lv[ch], this.pk[ch] - dt * 0.4); }
        const y = ch ? 182 : 140, n = Math.round(this.lv[ch] * N), pkN = Math.round(this.pk[ch] * N) - 1;
        word(ch ? 'R' : 'L', 46, y + 10, true, 12);
        for (let k = 0; k < N; k++) { lit(k < n || (k === pkN && this.pk[ch] > 0.03), k >= N - 3 ? '#ff2d2d' : ON); x.fillRect(X0 + k * (X1 - X0) / N, y, (X1 - X0) / N - 4, 10); }
      }
      x.shadowBlur = 0; x.fillStyle = 'rgba(255,140,90,.55)'; x.font = '600 10px Helvetica, Arial, sans-serif'; x.textAlign = 'center';
      scale.forEach((t, i) => x.fillText(t, X0 + (i / (scale.length - 1)) * (X1 - X0 - 10) + 4, 172));
      x.textAlign = 'left';
    }
    destroy() { this._ro.disconnect(); this.root.remove(); }
  }
  S.stages = S.stages || {};
  S.stages.dat = DATStage;
})(window.S);
