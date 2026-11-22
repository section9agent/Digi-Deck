// Microcassette deck stage. The deck front is drawn by microdeck-art.js; the microcassette itself is built here from the supplied
// generic label artwork (assets/labels/micro.png): clear shell, white backing, the two tape packs and hubs (live, spinning right-to-left:
// microcassettes run the opposite way to a compact cassette, at 15/16 in/s), then the label with the reel windows cut out.
// Loading / flipping / swapping a tape: the door drops open, the tape slides up out of the compartment, is turned over or replaced, and
// slides back down.
(function (S) {
  const A = '../../assets/';
  const { W: DW, H: DH } = S.MICRO_DECK;
  const TW = 1461, TH = 959;                                // tape art size in pixels: the outline of the supplied shell artwork (2 : 1 5/16)
  const LAB = { sx: 2.465, sy: 2.341, ox: 13.42, oy: 55.25 };   // where the 586x344 label canvas sits on the shell
  const LEFT = { x: 425, y: 434 }, RIGHT = { x: 1046.5, y: 434.5 };   // reel centres
  const R_HUB = 161, R_MIN = 178, R_MAX = 334;              // hub / empty pack / full pack radius (tape pixels)
  const T = A + 'micro/tape/';
  const PX_MM = R_MAX / 10.5, TAPE_MM_S = 23.8;             // 15/16 in/s
  const TAPE = { x: 490, y: 232, w: 580 };             // where the tape sits in the deck art (deck units)
  TAPE.h = TAPE.w * TH / TW; TAPE.k = TAPE.w / TW;
  const LIFT = 1.07;                                        // fully out of the compartment = this many tape heights up
  const KEYS = Array.from({ length: 7 }, (_, i) => 432 + i * 105);
  const hub = { L: { x: TAPE.x + LEFT.x * TAPE.k, y: TAPE.y + LEFT.y * TAPE.k }, R: { x: TAPE.x + RIGHT.x * TAPE.k, y: TAPE.y + RIGHT.y * TAPE.k } };

  const imgs = new Map();
  const ld = src => { if (!imgs.has(src)) imgs.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); return imgs.get(src); };
  const pct = (el, x, y, w, h, W = TW, H = TH) => Object.assign(el.style, { left: x / W * 100 + '%', top: y / H * 100 + '%', width: w / W * 100 + '%', height: h / H * 100 + '%' });
  const dpct = (el, x, y, w, h) => pct(el, x, y, w, h, DW, DH);
  const rr = (x, px, py, w, h, r) => { const [a, b, c, d] = [].concat(r, r, r, r).slice(0, 4); x.beginPath(); x.moveTo(px + a, py); x.lineTo(px + w - b, py); x.arcTo(px + w, py, px + w, py + b, b); x.lineTo(px + w, py + h - c); x.arcTo(px + w, py + h, px + w - c, py + h, c); x.lineTo(px + d, py + h); x.arcTo(px, py + h, px, py + h - d, d); x.lineTo(px, py + a); x.arcTo(px, py, px + a, py, a); x.closePath(); };

  // ---- the tape: drawn from the supplied shell, hub, pack and label artwork (assets/micro/tape) ---------------------
  const cvOf = (img, w = img.width, h = img.height) => { const c = S.newCanvas(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h); return c; };
  const mix = (hex, to, k) => { const f = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const a = f(hex), b = f(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  async function sprites() { const [hub, pack] = await Promise.all([ld(T + 'hub.png'), ld(T + 'pack.png')]); return { hub, pack }; }
  const kind = col => !col || col.id === 'clear' ? 'clear' : col.id === 'smoke' ? 'smoke' : col.id === 'black' ? 'black' : col.id === 'white' ? 'white' : 'colour';
  // the shell itself: black / white / clear are drawn from their own art; any other colour is the white shell multiplied by the colour
  async function shellCanvas(col) {
    const k = kind(col), c = S.newCanvas(TW, TH), x = c.getContext('2d');
    if (k === 'black' || k === 'clear') { x.drawImage(await ld(T + `shell-${k}.png`), 0, 0); return c; }
    const w = await ld(T + 'shell-white.png'); x.drawImage(w, 0, 0);
    if (k !== 'white') {
      x.globalCompositeOperation = 'multiply'; x.fillStyle = k === 'smoke' ? '#454850' : col.hex; x.fillRect(0, 0, TW, TH);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(w, 0, 0);
    }
    return c;
  }
  // everything behind the packs: (for see-through shells) a tinted body, a backing plate inside the reel window (opaque shells only),
  // and the tape running across it. The hub holes stay clear so the deck and its spindles show through.
  const HUB_HOLE = 99;
  async function backCanvas(col) {
    const k = kind(col), see = k === 'clear' || k === 'smoke', c = S.newCanvas(TW, TH), x = c.getContext('2d');
    const plate = k === 'black' ? '#161619' : k === 'white' ? '#c4c6c8' : see ? null : mix(col.hex, '#000000', 0.5);
    const winImg = await ld(T + 'window-mask.png');
    if (see) {
      const sil = await ld(T + 'silhouette.png'); x.drawImage(sil, 0, 0); x.globalCompositeOperation = 'source-in';
      x.fillStyle = k === 'clear' ? 'rgba(222,227,232,.62)' : 'rgba(26,28,32,.8)'; x.fillRect(0, 0, TW, TH);
      x.globalCompositeOperation = 'destination-out'; x.drawImage(winImg, 0, 0); x.globalCompositeOperation = 'source-over';      // the reel window itself is see-through
    } else {
      const win = S.newCanvas(TW, TH), wx = win.getContext('2d');
      wx.filter = 'blur(2px)'; wx.drawImage(winImg, -6, -6, TW + 12, TH + 12); wx.filter = 'none';     // a little bigger than the hole, so it tucks under the shell
      wx.globalCompositeOperation = 'source-in'; wx.fillStyle = plate; wx.fillRect(0, 0, TW, TH);
      wx.globalCompositeOperation = 'destination-out'; for (const c0 of [LEFT, RIGHT]) { wx.beginPath(); wx.arc(c0.x, c0.y, HUB_HOLE, 0, 7); wx.fill(); }
      x.drawImage(win, 0, 0);
    }
    // a soft light behind the reel window, so the tape packs can be seen
    { const gl = S.newCanvas(TW, TH), g = gl.getContext('2d'), mx = (LEFT.x + RIGHT.x) / 2;
      g.translate(mx, LEFT.y); g.scale(1.45, 1); const rg = g.createRadialGradient(0, 0, 0, 0, 0, 300);
      rg.addColorStop(0, 'rgba(225,240,255,.9)'); rg.addColorStop(0.45, 'rgba(180,215,245,.5)'); rg.addColorStop(1, 'rgba(160,200,235,0)');
      g.fillStyle = rg; g.fillRect(-500, -450, 1000, 900); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(winImg, 0, 0); x.drawImage(gl, 0, 0); }
    x.save(); x.beginPath(); x.rect(LEFT.x + 120, LEFT.y + 20, RIGHT.x - LEFT.x - 240, 92); x.clip();         // the tape web between the reels
    x.fillStyle = '#1b1514'; x.fillRect(0, 0, TW, TH); x.restore();
    return c;
  }
  async function labelCanvas(album, slot, side) {
    const base = await ld(A + 'labels/micro.png'), cv = S.newCanvas(TW, TH), x = cv.getContext('2d');
    const real = album[slot] || album.label_a;
    const L = S.newCanvas(586 * 2, 344 * 2), lx = L.getContext('2d');          // the label at 2x its own pixels
    if (real) {
      const img = await S.art.get(album, slot, 'micro', side);
      S.drawCover(lx, img, 0, 0, L.width, L.height);
      lx.globalCompositeOperation = 'destination-in'; lx.drawImage(base, 0, 0, L.width, L.height);
    } else {
      const gen = await S.labelArt('micro', { title: album.title || album.name || 'Untitled', artist: S.displayArtist(album), side });
      lx.drawImage(gen, 0, 0, L.width, L.height);
      lx.fillStyle = '#111'; lx.font = '700 98px Helvetica, Arial, sans-serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText(side, 1060, 215);   // side letter, right of the right reel
    }
    x.drawImage(L, LAB.ox, LAB.oy, 586 * LAB.sx, 344 * LAB.sy);
    return cv;
  }
  // soft glare over everything, clipped to the shell outline
  async function glareCanvas() {
    const c = S.newCanvas(TW, TH), x = c.getContext('2d');
    const gl = x.createLinearGradient(0, 0, TW, TH); gl.addColorStop(0, 'rgba(255,255,255,.20)'); gl.addColorStop(0.3, 'rgba(255,255,255,0)'); gl.addColorStop(0.72, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.09)');
    x.fillStyle = gl; x.fillRect(0, 0, TW, TH); x.globalCompositeOperation = 'destination-in'; x.drawImage(await ld(T + 'silhouette.png'), 0, 0);
    return c;
  }
  async function buildFace(album, slot, side, col, load) {
    const sp = await sprites(), face = S.el('div', { class: 'cas-face mc-face' }), f = { el: face, side, load, angL: 0, angR: 0 };
    const back = await backCanvas(col); back.className = 'mc-layer'; pct(back, 0, 0, TW, TH);
    const copy = img => cvOf(img);
    const hollow = c => { const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(c.width / 2, c.height / 2, HUB_HOLE, 0, 7); g.fill(); return c; };   // the wound tape sits outside the hub, so the hub hole is empty
    f.packL = hollow(copy(sp.pack)); f.packR = hollow(copy(sp.pack)); f.hubL = copy(sp.hub); f.hubR = copy(sp.hub);
    [[f.packL, LEFT, R_MAX], [f.packR, RIGHT, R_MAX], [f.hubL, LEFT, R_HUB], [f.hubR, RIGHT, R_HUB]].forEach(([el, c, r]) => { el.className = 'mc-layer'; pct(el, c.x - r, c.y - r, r * 2, r * 2); });
    const shell = await shellCanvas(col); shell.className = 'mc-layer'; pct(shell, 0, 0, TW, TH);
    const lab = await labelCanvas(album, slot, side); lab.className = 'mc-layer'; pct(lab, 0, 0, TW, TH);
    const top = await glareCanvas(); top.className = 'mc-layer'; pct(top, 0, 0, TW, TH);
    face.append(back, f.packL, f.packR, f.hubL, f.hubR, shell, lab, top);
    setPacks(f, 0);
    return f;
  }
  // tape is conserved; microcassettes play right -> left, so the RIGHT reel is the supply (full at the start of a side)
  function setPacks(f, frac) {
    const a = R_MIN * R_MIN, area = f.load * (R_MAX * R_MAX - a);
    f.rSup = Math.sqrt(a + area * (1 - frac)); f.rTake = Math.sqrt(a + area * frac);
    f.packR.style.clipPath = `circle(${f.rSup / (R_MAX * 2) * 100}% at 50% 50%)`; f.packL.style.clipPath = `circle(${f.rTake / (R_MAX * 2) * 100}% at 50% 50%)`;
  }

  // meter scale: LED x position -> dB, matching the printed scale in the deck art
  const SCALE = [[1425, -60], [1480, -20], [1535, -15], [1590, -10], [1625, -7], [1660, -4], [1698, -2], [1735, -1], [1772, 0], [1809, 1], [1846, 2], [1883, 6], [1930, 9]];
  const ledDb = px => { for (let i = 1; i < SCALE.length; i++) if (px <= SCALE[i][0]) { const [x0, d0] = SCALE[i - 1], [x1, d1] = SCALE[i]; return d0 + (d1 - d0) * (px - x0) / (x1 - x0); } return 9; };
  const LEDS = Array.from({ length: 28 }, (_, k) => 1428 + k * 18.2).map(px => ({ px, db: ledDb(px) }));

  class MicroStage {
    constructor(host) {
      this.host = host; this.spin = 0; this.faces = []; this.rot = 0; this.busy = false; this.album = null; this.t = 0; this.lvl = [0, 0]; this.ejected = false; this.angS = 0;
      this.build();
      this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    build() {
      const e = S.el;
      this.deck = e('div', { class: 'deck mc-deck' });
      this.art = e('div', { class: 'mc-art' }, S.skin.bind(e('img', { draggable: 'false', alt: '' }), A + 'micro/deck-front.png').el);
      // spindles inside the compartment (they show through the hubs of a loaded tape)
      this.spL = this.spindle(hub.L); this.spR = this.spindle(hub.R);
      // the tape
      this.stageEl = e('div', { class: 'cas-stage mc-tape' });
      this.flipper = e('div', { class: 'cas-flip' });
      this.slots = [e('div', { class: 'cas-slot front' }), e('div', { class: 'cas-slot back' })];
      this.edges = ['l', 'r', 't', 'b'].map(k => e('div', { class: 'cas-edge ' + k }));
      this.flipper.append(...this.edges, ...this.slots); this.stageEl.append(this.flipper);
      // the door
      this.door = e('div', { class: 'mc-door' }); S.skin.bind(this.door, A + 'micro/door.png', 'bg');
      this.lcd = S.newCanvas(1504, 396); this.lcd.className = 'deck-live';        // peak meter (2x of 752 x 198 units)
      this.ctr = S.newCanvas(368, 128); this.ctr.className = 'deck-live';          // tape counter
      const ICON = { prev: ['◀◀', 'PREV'], next: ['▶▶', 'NEXT'], rec: ['●', 'REC'], play: ['▶', 'PLAY'], stop: ['■', 'STOP'], pause: ['❚❚', 'PAUSE'], flip: ['⟲', 'FLIP'] };
      // the icon and the name are printed on the key itself
      const key = (title, cls, fn) => { const [ic, nm] = ICON[cls] || ['', '']; return e('button', { class: 'mc-key ' + cls, title, onclick: fn }, e('i', {}, e('b', {}, ic), e('span', {}, nm))); };
      this.keyEls = [
        key('Previous track', 'prev', () => S.app.prev()), key('Next track', 'next', () => S.app.next()), key('Record (playback only)', 'rec', () => S.toast('This deck plays back only')),
        key('Play', 'play', () => S.app.togglePlay()), key('Stop', 'stop', () => S.app.stop()), key('Pause', 'pause', () => { if (!S.app.audio.paused) S.app.audio.pause(); }),
        key('Flip the tape over', 'flip', () => S.app.manualFlip())];
      this.playKey = this.keyEls[3]; this.flipKey = this.keyEls[6];
      this.ejectBtn = e('button', { class: 'mc-eject', title: 'Eject / load the tape', onclick: () => S.app.eject() });
      this.resetBtn = e('button', { class: 'mc-reset', title: 'Reset the counter', onclick: () => { this.ctrBase = this.ctrRaw || 0; } });
      this.knob = e('div', { class: 'mc-knob', title: 'Volume (drag or scroll)' }, e('i'));
      this.deck.append(this.art, this.spL.el, this.spR.el, this.stageEl, this.door, this.lcd, this.ctr, ...this.keyEls, this.ejectBtn, this.resetBtn, this.knob);
      this.host.append(this.deck);
      dpct(this.stageEl, TAPE.x, TAPE.y, TAPE.w, TAPE.h);
      dpct(this.door, 400, 215, 760, 405); dpct(this.lcd, 1200, 228, 752, 198); dpct(this.ctr, 68, 394, 184, 64);
      this.keyEls.forEach((k, i) => dpct(k, KEYS[i], 765, 84, 92));
      dpct(this.ejectBtn, 1202, 500, 104, 106); dpct(this.resetBtn, 291, 395, 56, 56); dpct(this.knob, 1832 - 95, 690 - 95, 190, 190);
      this.side = 'A'; this.counter = '0000'; this.ctrBase = 0; this.ctrRaw = 0;
      this.setupKnob();
    }
    spindle(c) {
      const R = 36, cv = S.newCanvas(R * 2 * 3, R * 2 * 3), x = cv.getContext('2d'); x.scale(3, 3); x.translate(R, R);
      x.fillStyle = '#070707'; x.beginPath(); x.arc(0, 0, R * 0.62, 0, 7); x.fill();
      x.fillStyle = '#1a1a1c'; for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); rr(x, -3.2, -R * 0.62 - 2, 6.4, 9, 1.5); x.fill(); x.restore(); }
      x.strokeStyle = '#3a3b3e'; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, R * 0.62, 0, 7); x.stroke();
      x.fillStyle = '#2a2b2e'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill();
      cv.className = 'mc-spindle'; dpct(cv, c.x - R, c.y - R, R * 2, R * 2); return { el: cv, ang: 0 };
    }
    setupKnob() {
      const set = v => S.app.volume(v - S.app.audio.volume);
      this.knob.addEventListener('wheel', e => { e.preventDefault(); S.app.volume(e.deltaY < 0 ? 0.05 : -0.05); }, { passive: false });
      this.knob.addEventListener('pointerdown', e => {
        e.preventDefault(); const y0 = e.clientY, v0 = S.app.audio.volume;
        const mv = m => set(S.clamp(v0 + (y0 - m.clientY) / 160, 0, 1));
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight;
      if (!W || !H) return;
      const top = Math.min(120, H * 0.17), Dw = Math.max(560, Math.min(W - 30, (H - top - 20) / (DH / DW))), Dh = Dw * DH / DW;
      this.Dw = Dw;
      Object.assign(this.deck.style, { width: Dw + 'px', height: Dh + 'px', left: (W - Dw) / 2 + 'px', top: top + Math.max(0, (H - top - Dh) / 2) + 'px' });
      this.deck.style.setProperty('--d', Dw + 'px');
      this.stageEl.style.setProperty('--t', Dw * TAPE.w / DW * 0.15 + 'px');
    }
    visIndex() { return Math.round(this.rot / 180) % 2; }
    settle() {
      const v = this.visIndex(); this.flipper.style.transform = 'none';
      this.slots.forEach((el, k) => { el.classList.add('rest'); el.style.visibility = k === v ? 'visible' : 'hidden'; });
    }
    unsettle() {
      this.flipper.style.transform = `rotateY(${this.rot}deg)`;
      this.slots.forEach(el => { el.classList.remove('rest'); el.style.visibility = 'visible'; });
    }
    sideLoad(info, side) {
      if (info.type === 'album') return 1;
      const dur = this.album.tracks.filter(t => t.side === side).reduce((a, t) => a + (t.duration || 0), 0);
      return S.clamp(dur / (20 * 60), 0.1, 0.7);
    }
    async fill(slotIdx, side) {
      const sides = S.sidesOf(this.album.tracks), info = S.releaseInfo(this.album, 'micro'), col = S.colorOf(S.TAPE_COLORS, this.album.color || 'clear');
      const f = await buildFace(this.album, 'label_' + side.toLowerCase(), side, col, this.sideLoad(info, side));
      this.slots[slotIdx].replaceChildren(f.el); this.faces[slotIdx] = f;
    }
    paintEdges(col) {
      const clear = !col || col.id === 'clear' || col.id === 'smoke';
      this.stageEl.style.setProperty('--edge', clear ? '#ffffff33' : S.shade(col.hex, -0.28));
      this.edges.forEach(el => el.classList.toggle('clear', clear));
    }
    currentSide() { return this.faces[this.visIndex()]?.side || 'A'; }
    // ---- library animations: the tape is handed over / taken away fully lifted out of the open compartment ----
    recordRect() {
      const r = this.stageEl.getBoundingClientRect(), rest = r.top + (this.liftAt || 0) * r.height;
      return { left: r.left, top: rest - LIFT * r.height, width: r.width, height: r.height };
    }
    hideRecord(h) { this.stageEl.style.opacity = h ? 0 : ''; }      // (the slots set their own visibility, so opacity is what hides it)
    async prepArrive() { this.busy = true; this.ejected = true; await this.doorOpen(); await this.lift(LIFT, 1); }
    async finishArrive() { await this.lift(0, 650); this.stageEl.style.zIndex = ''; await this.doorClose(); this.ejected = false; this.busy = false; }
    async prepTake() { this.busy = true; this.ejected = true; await this.doorOpen(); await this.lift(LIFT, 650); }
    finishTake() { this.lift(0, 1).then(() => { this.stageEl.style.zIndex = ''; return this.doorClose(); }).then(() => { this.ejected = false; this.busy = false; }); }

    // ---- door and tape movement -----------------------------------------------------------------------------
    anim(el, frames, ms, easing = 'ease-in-out') { return el.animate(frames, { duration: ms, easing, fill: 'forwards' }).finished.catch(() => {}); }
    async doorOpen() { if (this.doorIsOpen) return; this.doorIsOpen = true; await this.anim(this.door, [{ transform: 'perspective(1500px) rotateX(0deg)', opacity: 1 }, { transform: 'perspective(1500px) rotateX(-40deg)', opacity: 0.35, offset: 0.4 }, { transform: 'perspective(1500px) rotateX(-78deg)', opacity: 0 }], 520, 'cubic-bezier(.3,.1,.4,1)'); }
    async doorClose() { if (!this.doorIsOpen) return; this.doorIsOpen = false; await this.anim(this.door, [{ transform: 'perspective(1500px) rotateX(-78deg)', opacity: 0 }, { transform: 'perspective(1500px) rotateX(-40deg)', opacity: 0.35, offset: 0.6 }, { transform: 'perspective(1500px) rotateX(0deg)', opacity: 1 }], 460, 'cubic-bezier(.5,0,.6,1)'); }
    lift(frac, ms = 650) { const from = this.liftAt || 0; this.liftAt = frac; this.stageEl.style.zIndex = 6; return this.anim(this.stageEl, [{ transform: `translateY(${-from * 100}%)` }, { transform: `translateY(${-frac * 100}%)` }], ms, 'cubic-bezier(.3,.05,.3,1)'); }
    async eject() {           // door opens, the tape slides up and stays half out
      if (this.ejected || this.busy) return; this.busy = true; this.ejected = true;
      await this.doorOpen(); await this.lift(LIFT * 0.72, 600); this.busy = false;
    }
    async loadTape() {        // the tape slides back down and the door closes
      if (!this.ejected || this.busy) return; this.busy = true;
      await this.lift(0, 600); this.stageEl.style.zIndex = ''; await this.doorClose(); this.ejected = false; this.busy = false;
    }
    async ensureLoaded() { if (this.ejected) await this.loadTape(); }

    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'micro');
      const sides = S.sidesOf(album.tracks);
      this.rot = 0; this.flipper.style.transform = 'rotateY(0deg)'; this.faces = []; this.unsettle();
      const first = sides[0] || 'A', pair = S.partnerSide(first);
      await this.fill(0, first); await this.fill(1, sides.includes(pair) ? pair : sides[1] || pair);
      this.paintEdges(S.colorOf(S.TAPE_COLORS, album.color || 'clear')); this.settle();
      this.side = first; this.flipKey.style.display = sides.length > 1 ? '' : 'none';
      this.layout();
      if (this.quiet) {        // the library animation brings the tape in itself (prepArrive / finishArrive)
        this.quiet = false; this.stageEl.getAnimations().forEach(a => a.cancel()); this.liftAt = 0; this.ejected = false; this.busy = false; return;
      }
      // a new tape arrives from above: door open, tape slides in, door closes
      this.busy = true; this.ejected = true; this.doorIsOpen = false; this.stageEl.getAnimations().forEach(a => a.cancel()); this.door.getAnimations().forEach(a => a.cancel());
      this.liftAt = 0; this.stageEl.style.zIndex = 6;
      await this.doorOpen();
      await this.anim(this.stageEl, [{ transform: 'translateY(-170%)', opacity: 0 }, { transform: `translateY(${-LIFT * 100}%)`, opacity: 1, offset: 0.25 }, { transform: 'translateY(0)', opacity: 1 }], 1000, 'cubic-bezier(.3,.05,.3,1)');
      this.liftAt = 0; this.stageEl.style.zIndex = ''; await this.doorClose(); this.ejected = false; this.busy = false;
    }

    // the tape is turned over (or replaced) outside the compartment
    async flipTo(side) {
      if (this.currentSide() === side) return;
      const wasBusy = this.busy; while (this.busy && !wasBusy) await new Promise(r => setTimeout(r, 50));
      this.busy = true; this.unsettle();
      const hidden = this.visIndex() ^ 1, swap = S.discOf(side, 'micro') !== S.discOf(this.currentSide(), 'micro');
      if (this.faces[hidden]?.side !== side) await this.fill(hidden, side);
      await this.doorOpen();
      if (swap) {                                       // old tape slides out of the top and away, the next one drops in
        await this.lift(1.7, 700); this.stageEl.style.opacity = 0;
        this.rot = (this.rot + 180) % 360; this.flipper.style.transform = `rotateY(${this.rot}deg)`;
        await new Promise(r => setTimeout(r, 150)); this.stageEl.style.opacity = 1;
        await this.lift(LIFT, 650);
      } else await this.lift(LIFT, 700);
      if (!swap) {
        const from = this.rot, to = from + 180;
        await this.flipper.animate([
          { transform: `rotateX(0deg) rotateY(${from}deg) scale(1)` }, { transform: `rotateX(-14deg) rotateY(${from + 90}deg) scale(1.08)`, offset: 0.5 }, { transform: `rotateX(0deg) rotateY(${to}deg) scale(1)` }
        ], { duration: 950, easing: 'cubic-bezier(.45,0,.2,1)' }).finished.catch(() => {});
        this.rot = to % 360; this.flipper.style.transform = `rotateY(${this.rot}deg)`;
      }
      this.settle(); this.side = side;
      await this.lift(0, 650); this.stageEl.style.zIndex = '';
      await this.doorClose(); this.ejected = false;
      await new Promise(r => setTimeout(r, 200));
      this.busy = false;
    }

    // ---- live parts -------------------------------------------------------------------------------------------
    drawMeter(dt, playing) {
      const c = this.lcd, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.save(); x.scale(2, 2);
      const live = playing && !this.busy ? S.meter.read() : null, ox = 1200, oy = 228, rows = [{ y: 305 - oy }, { y: 371 - oy }];
      this.pk = this.pk || [-90, -90]; this.pkT = this.pkT || [0, 0];
      for (let ch = 0; ch < 2; ch++) {
        let target = -90;
        if (live) target = live[ch];
        else if (playing && !S.meter.ok) { const t = this.t * (3.1 + ch * 0.7) + ch * 9; target = -22 + 14 * Math.sin(t) + 7 * Math.sin(t * 2.3 + 1); }
        const cur = this.lvl[ch], k = target > cur ? 1 - Math.exp(-dt * 40) : 1 - Math.exp(-dt * 6);
        this.lvl[ch] = cur + (target - cur) * k;
        if (this.lvl[ch] >= this.pk[ch]) { this.pk[ch] = this.lvl[ch]; this.pkT[ch] = 0.9; } else { this.pkT[ch] -= dt; if (this.pkT[ch] < 0) this.pk[ch] = Math.max(this.lvl[ch], this.pk[ch] - dt * 14); }
        LEDS.forEach((l, i) => {
          const on = this.lvl[ch] >= l.db || (this.pk[ch] >= l.db && (i === LEDS.length - 1 || this.pk[ch] < LEDS[i + 1].db));
          const px = l.px - ox, py = rows[ch].y, hot = l.db >= 0, warm = l.db >= -7;
          x.fillStyle = on ? (hot ? '#ff5b3a' : warm ? '#f2dc4a' : '#7dff68') : 'rgba(10,12,14,.55)';
          if (on) { x.shadowColor = hot ? '#ff3a1a' : warm ? '#f0d020' : '#40ff30'; x.shadowBlur = 9; }
          x.beginPath(); x.arc(px, py, 5.2, 0, 7); x.fill(); x.shadowBlur = 0;
        });
      }
      // function indicators: PLAY green, PAUSE amber while paused, FLIP while the tape is being turned
      const lit = (i, col) => { x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 12; x.fillRect(1218 - ox, 240 + i * 46 - (228 - 228) - oy + 228 - 228, 0, 0); x.shadowBlur = 0; };
      const box = (i, col) => { x.save(); x.shadowColor = col; x.shadowBlur = 14; x.fillStyle = col; x.globalAlpha = 0.55; x.fillRect(1216 - ox, 238 + i * 46 - oy, 100, 34); x.restore(); };
      const paused = S.app.album && !S.app.stopped && S.app.audio.paused && !S.app.flipping && !this.busy;
      if (playing) box(1, '#6dff6a'); if (paused) box(2, '#ffc04a'); if (this.busy) box(3, '#6ad8ff');
      x.restore();
    }
    drawCounter() {
      const c = this.ctr, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.save(); x.scale(2, 2);
      const s = this.counter, w = 184 / 4;
      for (let i = 0; i < 4; i++) {
        const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#d9d9d4'); g.addColorStop(0.5, '#f7f7f2'); g.addColorStop(1, '#bdbdb8');
        x.fillStyle = g; x.fillRect(i * w + 2, 5, w - 4, 54);
        x.fillStyle = '#111'; x.font = '700 40px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s[i], i * w + w / 2, 33);
        x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(i * w + 2, 5, w - 4, 8); x.fillRect(i * w + 2, 51, w - 4, 8);
      }
      x.restore();
    }
    frame(dt, st) {
      this.t += dt;
      const target = (st.playing || st.vphase) && !this.busy ? 1 : 0;
      // spins up quickly; STOP halts the reels at once (no wind-down)
      if (target) this.spin += (1 - this.spin) * (1 - Math.exp(-dt * 5)); else this.spin = 0;
      const frac = S.clamp(st.sideFrac || 0, 0, 1);
      for (const f of this.faces) {
        if (!f) continue;
        setPacks(f, frac);
        f.angR += (TAPE_MM_S / (f.rSup / PX_MM)) * 180 / Math.PI * dt * this.spin;      // both reels turn clockwise: the tape runs right to left
        f.angL += (TAPE_MM_S / (f.rTake / PX_MM)) * 180 / Math.PI * dt * this.spin;
        f.hubL.style.transform = f.packL.style.transform = `rotate(${f.angL}deg)`; f.hubR.style.transform = f.packR.style.transform = `rotate(${f.angR}deg)`;
      }
      const f0 = this.faces[this.visIndex()];
      if (f0 && !this.busy) { this.spL.el.style.transform = `rotate(${f0.angL}deg)`; this.spR.el.style.transform = `rotate(${f0.angR}deg)`; }
      this.ctrRaw = Math.floor((st.sideTime || 0) * 0.9);
      this.counter = String(Math.max(0, this.ctrRaw - this.ctrBase)).padStart(4, '0').slice(-4);
      this.playKey.classList.toggle('lit', st.playing);
      this.knob.style.setProperty('--r', (-135 + S.app.audio.volume * 270) + 'deg');
      this.drawMeter(dt, st.playing); this.drawCounter();
      this.deck.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); this.deck.remove(); }
  }
  S.microFace = async (album, side) => {
    const col = S.colorOf(S.TAPE_COLORS, album.color || 'clear'), info = S.releaseInfo(album, 'micro');
    const load = info.type === 'album' ? 1 : S.clamp(album.tracks.filter(t => t.side === side).reduce((a, t) => a + (t.duration || 0), 0) / 1800, 0.1, 0.7);
    return (await buildFace(album, 'label_' + side.toLowerCase(), side, col, load)).el;
  };
  S.microEdge = album => { const col = S.colorOf(S.TAPE_COLORS, album.color || 'clear'); return col.id === 'clear' || col.id === 'smoke' ? '#d9dee455' : S.shade(col.hex, -0.28); };
  S.stages = S.stages || {};
  S.stages.micro = MicroStage;
})(window.S);
