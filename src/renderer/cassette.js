// Cassette deck stage. The deck and the cassette are the artwork supplied as PSD layers / PNGs (assets/cassette, assets/deck);
// the live parts - the two tape packs, the spinning reels, the paper label text, meters, counter, keys and the volume knob -
// are drawn on top at the art's own coordinates.
(function (S) {
  const CW = 1600, CH = 1020;                 // cassette artwork canvas (px)
  const DW = 2000, DH = 880;                  // deck artwork canvas (px)
  const LEFT = { x: 463, y: 431 }, RIGHT = { x: 1134.5, y: 430.5 };   // reel centres in the cassette art
  const R_F = 164.5, R_MIN = 170, R_MAX = 375;                         // hub flange radius, empty / full tape pack radius
  const PX_MM = R_MAX / 23, TAPE_MM_S = 47.6;
  const ROLL_L = { x: 140, y: 905 }, ROLL_R = { x: 1460, y: 905 };
  const AR = CW / CH;
  const A = '../../assets/';
  // layers of each PSD, bottom to top (from layers.json in assets/cassette/<set>)
  const STACK = {
    opaque: ['Tape Shell', 'Tape Label Area', 'Tape Center#0', 'Tape Center#1', 'LABEL', 'Mesure', 'Screws'],
    clear: ['Tape guids', 'PACKS', 'Shield', 'Presure pad', 'Tape Path', 'Tape Shell', 'Tape Label Area', 'Tape Center#0', 'Tape Center#1', 'LABEL', 'Mesure', 'Screws']
  };
  const TINTED = new Set(['Tape Shell', 'Tape Label Area', 'Tape Center#0']);
  const BASE_GRAY = 100;                      // grey of the supplied shell artwork
  const meta = {}, imgs = new Map(), urls = new Map();
  const ld = src => { if (!imgs.has(src)) imgs.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); return imgs.get(src); };
  async function setMeta(set) {
    return S.cassetteLayers[set] || [];
  }
  async function setupSet(set) {
    const list = await setMeta(set), by = {}; let tc = 0;
    for (const l of list) { const k = l.name === 'Tape Center' ? 'Tape Center#' + tc++ : l.name; by[k] = l; }
    return by;
  }
  // recolour a grey shell layer to another colour (keeps its shading)
  async function tinted(set, layer, hex) {
    const key = set + layer.file + hex;
    if (urls.has(key)) return urls.get(key);
    const p = (async () => {
      const im = await ld(A + 'cassette/' + set + '/' + layer.file); if (!im) return '';
      const c = S.newCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), px = d.data, n = parseInt(hex.slice(1), 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
      for (let i = 0; i < px.length; i += 4) { const g = (px[i] + px[i + 1] + px[i + 2]) / 3 / BASE_GRAY; px[i] = Math.min(255, R * g); px[i + 1] = Math.min(255, G * g); px[i + 2] = Math.min(255, B * g); }
      x.putImageData(d, 0, 0);
      return await new Promise(r => c.toBlob(b => r(URL.createObjectURL(b))));
    })();
    urls.set(key, p); return p;
  }

  // tangent point from external point P to a circle (centre C, radius r), picking the side closest to `toward`
  function tangent(P, C, r, toward) {
    const dx = P.x - C.x, dy = P.y - C.y, d = Math.hypot(dx, dy);
    if (d <= r + 0.5) return { x: C.x, y: C.y + r };
    const a = Math.atan2(dy, dx), b = Math.acos(r / d);
    const c1 = { x: C.x + r * Math.cos(a + b), y: C.y + r * Math.sin(a + b) }, c2 = { x: C.x + r * Math.cos(a - b), y: C.y + r * Math.sin(a - b) };
    return Math.hypot(c1.x - toward.x, c1.y - toward.y) < Math.hypot(c2.x - toward.x, c2.y - toward.y) ? c1 : c2;
  }

  const HOLE = 52;                                                  // radius of the see-through hole in a hub
  function spindleEl(c) {                                           // the deck's drive spindle seen through a hub: black, six lugs, a pale ring
    const R = 50, cv = S.newCanvas(R * 4, R * 4), x = cv.getContext('2d'); x.scale(2, 2); x.translate(R, R);
    x.fillStyle = '#d9d7d1'; x.beginPath(); x.arc(0, 0, R * 0.94, 0, 7); x.fill();                      // pale collar
    x.fillStyle = '#0b0b0c'; x.beginPath(); x.arc(0, 0, R * 0.8, 0, 7); x.fill();
    x.fillStyle = '#242427'; for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); x.fillRect(-4.5, -R * 0.8, 9, R * 0.46); x.restore(); }
    x.fillStyle = '#141416'; x.beginPath(); x.arc(0, 0, R * 0.36, 0, 7); x.fill(); x.fillStyle = '#4a4b4f'; x.beginPath(); x.arc(-3, -3, 4, 0, 7); x.fill();
    cv.className = 'cas-spindle'; Object.assign(cv.style, { position: 'absolute', transformOrigin: '50% 50%' }); pctBox(cv, c.x - R, c.y - R, R * 2, R * 2); return cv;
  }
  const pctBox = (el, x, y, w, h) => Object.assign(el.style, { left: x / CW * 100 + '%', top: y / CH * 100 + '%', width: w / CW * 100 + '%', height: h / CH * 100 + '%' });

  // the paper label: the supplied label art with the writing erased, then the album's own title/artist drawn in the same places
  async function labelCanvas(album, slot, side, real) {
    const base = await ld(A + 'cassette/label-clean.png');
    const cv = S.newCanvas(CW, 742), x = cv.getContext('2d');
    if (real) {
      const img = await S.art.get(album, slot, 'cassette', side);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (iw === 1440 && ih === 624) x.drawImage(img, 80, 96);            // a generic label made for the paper area: place it 1:1, like the built-in label art
      else S.drawCover(x, img, 0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-over';
      return cv;
    }
    // no label image: the supplied generic cassette label, written on in thin marker (artist = Various Artists for mixed playlists)
    const gen = await S.labelArt('cassette', { title: album.title || album.name || 'Untitled', artist: S.displayArtist(album), side });
    x.drawImage(gen, 80, 96);          // the label art is exactly the paper area (1440 x 624)
    x.globalCompositeOperation = 'destination-in'; x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#0b0b0d'; x.fillRect(110, 625, 85, 85);
    x.fillStyle = '#fff'; x.font = '700 66px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(side, 152.5, 670);
    return cv;
  }

  async function buildFace(album, slot, side, col, info, load) {
    const smoke = col.id === 'smoke', clear = col.id === 'clear' || smoke;
    const set = clear ? 'clear' : col.id === 'white' ? 'white' : 'black';
    const by = await setupSet(set), seq = clear ? STACK.clear : STACK.opaque;
    const recolour = !clear && col.id !== 'black' && col.id !== 'white' && col.hex;
    const face = S.el('div', { class: 'cas-face' }), f = { el: face, side, clear, load, angL: 0, angR: 0 };
    for (const name of seq) {
      if (name === 'PACKS') {
        f.packL = S.el('div', { class: 'pack', style: { backgroundImage: `url(${A}cassette/pack.png)` } }); f.packR = S.el('div', { class: 'pack', style: { backgroundImage: `url(${A}cassette/pack.png)` } });
        f.hubL = S.el('img', { class: 'hub', src: A + 'cassette/hub-l.png', draggable: 'false' }); f.hubR = S.el('img', { class: 'hub', src: A + 'cassette/hub-r.png', draggable: 'false' });
        pctBox(f.packL, LEFT.x - R_MAX, LEFT.y - R_MAX, R_MAX * 2, R_MAX * 2); pctBox(f.packR, RIGHT.x - R_MAX, RIGHT.y - R_MAX, R_MAX * 2, R_MAX * 2);
        pctBox(f.hubL, LEFT.x - R_F, LEFT.y - R_F, R_F * 2, R_F * 2); pctBox(f.hubR, RIGHT.x - R_F, RIGHT.y - R_F, R_F * 2, R_F * 2);
        face.append(f.packL, f.packR, f.hubL, f.hubR); continue;
      }
      if (name === 'LABEL') {
        const real = album[slot] || album.label_a;
        const cv = await labelCanvas(album, slot, side, real); cv.className = 'cas-label'; pctBox(cv, 0, 0, CW, 742); face.append(cv); continue;
      }
      const l = by[name]; if (!l) continue;
      let src = A + 'cassette/' + set + '/' + l.file;
      if (recolour && TINTED.has(name)) src = await tinted(set, l, col.hex) || src;
      const im = S.el('img', { src, draggable: 'false' }); pctBox(im, l.x, l.y, l.w, l.h);
      if (l.opacity < 1) im.style.opacity = l.opacity;
      if (smoke && TINTED.has(name)) im.style.filter = 'brightness(.3) saturate(.4)';
      face.append(im);
    }
    // the first PACKS layer of opaque shells sits below the shell: insert it at the bottom
    if (!clear) {
      f.packL = S.el('div', { class: 'pack', style: { backgroundImage: `url(${A}cassette/pack.png)` } }); f.packR = S.el('div', { class: 'pack', style: { backgroundImage: `url(${A}cassette/pack.png)` } });
      f.hubL = S.el('img', { class: 'hub', src: A + 'cassette/hub-l.png', draggable: 'false' }); f.hubR = S.el('img', { class: 'hub', src: A + 'cassette/hub-r.png', draggable: 'false' });
      pctBox(f.packL, LEFT.x - R_MAX, LEFT.y - R_MAX, R_MAX * 2, R_MAX * 2); pctBox(f.packR, RIGHT.x - R_MAX, RIGHT.y - R_MAX, R_MAX * 2, R_MAX * 2);
      pctBox(f.hubL, LEFT.x - R_F, LEFT.y - R_F, R_F * 2, R_F * 2); pctBox(f.hubR, RIGHT.x - R_F, RIGHT.y - R_F, R_F * 2, R_F * 2);
      face.prepend(f.packL, f.packR, f.hubL, f.hubR);
    }
    // pale backing behind the windows, so tape (dark) reads against empty space (light) exactly like the supplied art
    // (the hub centres are cut out of it, and a black drive spindle sits in each one, so the hubs look hollow)
    const back = S.newCanvas(944 * 2, 276 * 2); back.className = 'cas-winback'; pctBox(back, 327, 291, 944, 276);
    { const x = back.getContext('2d'); x.scale(2, 2); const g = x.createLinearGradient(0, 0, 0, 276); g.addColorStop(0, '#fbfaf6'); g.addColorStop(1, '#e9e5da');
      x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, 944, 276, [132, 132, 132, 132]); x.fill();
      x.globalCompositeOperation = 'destination-out'; for (const c of [LEFT, RIGHT]) { x.beginPath(); x.arc(c.x - 327, c.y - 291, HOLE, 0, 7); x.fill(); } }
    f.spL = spindleEl(LEFT); f.spR = spindleEl(RIGHT);
    face.prepend(f.spL, f.spR); face.prepend(back);
    setPacks(f, 0);
    return f;
  }

  // tape is conserved: area(supply) + area(take-up) stays constant. load = how much of a full reel is on the tape.
  function setPacks(f, frac) {
    const a = R_MIN * R_MIN, area = f.load * (R_MAX * R_MAX - a);
    f.rSup = Math.sqrt(a + area * (1 - frac)); f.rTake = Math.sqrt(a + area * frac);
    f.packL.style.clipPath = `circle(${f.rSup / (R_MAX * 2) * 100}% at 50% 50%)`; f.packR.style.clipPath = `circle(${f.rTake / (R_MAX * 2) * 100}% at 50% 50%)`;
  }

  const KEYS = [121, 421, 722, 1022, 1323];   // transport key columns in the deck art (y 612, 288 x 168)
  const dpct = (el, x, y, w, h) => Object.assign(el.style, { left: x / DW * 100 + '%', top: y / DH * 100 + '%', width: w / DW * 100 + '%', height: h / DH * 100 + '%' });

  class CassetteStage {
    constructor(host) {
      this.host = host; this.spin = 0; this.faces = []; this.rot = 0; this.busy = false; this.album = null; this.t = 0;
      this.lvl = [0, 0]; this.build();
      this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    build() {
      const e = S.el;
      this.deck = e('div', { class: 'deck' });
      this.art = e('img', { class: 'deck-art', src: A + 'deck/deck-normal.png', draggable: 'false' });
      this.stageEl = e('div', { class: 'cas-stage' });
      this.flipper = e('div', { class: 'cas-flip' });
      this.slots = [e('div', { class: 'cas-slot front' }), e('div', { class: 'cas-slot back' })];
      this.edges = ['l', 'r', 't', 'b'].map(k => e('div', { class: 'cas-edge ' + k }));
      this.flipper.append(...this.edges, ...this.slots); this.stageEl.append(this.flipper);
      this.lcd = S.newCanvas(1344, 560); this.lcd.className = 'deck-live';
      const b = (title, fn, cls = '') => { const k = e('button', { class: 'deck-key ' + cls, title, onclick: fn }); k.style.backgroundImage = `url(${A}deck/keys/${cls || title.toLowerCase()}.png)`; return k; };
      this.playKey = b('Play / Pause', () => S.app.togglePlay(), 'play'); this.flipKey = b('Flip cassette', () => S.app.manualFlip(), 'flip');
      this.keyEls = [b('Previous', () => S.app.prev(), 'prev'), this.playKey, b('Stop', () => S.app.stop(), 'stop'), b('Next', () => S.app.next(), 'next'), this.flipKey];
      this.knobB = e('div', { class: 'deck-knob', title: 'Volume (drag or scroll)' }, e('img', { src: A + 'deck/knob-output.png', draggable: 'false' }));
      this.deck.append(this.art, this.stageEl, this.lcd, ...this.keyEls, this.knobB);
      this.host.append(this.deck);
      dpct(this.stageEl, 237, 170, 501, 501 / AR); dpct(this.lcd, 940, 70, 672, 280);
      this.keyEls.forEach((k, i) => dpct(k, KEYS[i], 612, 288, 168)); dpct(this.knobB, 1709, 319, 152, 152);
      this.side = 'A'; this.counter = '0000'; this.timeStr = '0:00'; this.single = false;
      this.setupKnob();
    }
    setupKnob() { // the lower knob is the volume control
      const set = v => S.app.volume(v - S.app.audio.volume);
      this.knobB.addEventListener('wheel', e => { e.preventDefault(); S.app.volume(e.deltaY < 0 ? 0.05 : -0.05); }, { passive: false });
      this.knobB.addEventListener('pointerdown', e => {
        e.preventDefault(); const y0 = e.clientY, v0 = S.app.audio.volume;
        const mv = m => set(S.clamp(v0 + (y0 - m.clientY) / 160, 0, 1));
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight;
      if (!W || !H) return;
      const Dw = Math.max(520, Math.min(W - 30, (H - 30) / (DH / DW))), Dh = Dw * DH / DW;
      this.Dw = Dw;
      Object.assign(this.deck.style, { width: Dw + 'px', height: Dh + 'px', left: (W - Dw) / 2 + 'px', top: (H - Dh) / 2 + 'px' });
      this.deck.style.setProperty('--d', Dw + 'px');
      const Cw = Dw * 501 / DW;
      this.stageEl.style.setProperty('--t', Cw * 0.085 + 'px');
    }
    visIndex() { return Math.round(this.rot / 180) % 2; }
    // At rest the cassette is drawn flat (no 3D transform, no back-face culling) so no GPU layer can show a stale or mirrored face;
    // the 3D rotation is only used while it is actually turning.
    settle() {
      const v = this.visIndex();
      this.flipper.style.transform = 'none';
      this.slots.forEach((el, k) => { el.classList.add('rest'); el.style.visibility = k === v ? 'visible' : 'hidden'; });
    }
    unsettle() {
      this.flipper.style.transform = `rotateY(${this.rot}deg)`;
      this.slots.forEach(el => { el.classList.remove('rest'); el.style.visibility = 'visible'; });
    }

    sideLoad(info, side) {
      if (info.type === 'album') return 1;
      const dur = this.album.tracks.filter(t => t.side === side).reduce((a, t) => a + (t.duration || 0), 0);
      return S.clamp(dur / (30 * 60), 0.1, 0.7);   // a single only carries a small amount of tape
    }
    async fill(slotIdx, side) {
      const sides = S.sidesOf(this.album.tracks), i = Math.max(0, sides.indexOf(side));
      const col = S.colorOf(S.TAPE_COLORS, this.album.color), info = S.releaseInfo(this.album, 'cassette');
      const f = await buildFace(this.album, 'label_' + side.toLowerCase(), side, col, info, this.sideLoad(info, side));
      this.slots[slotIdx].replaceChildren(f.el);
      this.faces[slotIdx] = f;
    }
    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'cassette');
      const sides = S.sidesOf(album.tracks);
      this.rot = 0; this.flipper.style.transform = 'rotateY(0deg)'; this.faces = []; this.unsettle();
      const first = sides[0] || 'A', pair = S.partnerSide(first);       // the other side of the same tape
      await this.fill(0, first);
      await this.fill(1, sides.includes(pair) ? pair : sides[1] || pair);
      this.paintEdges(S.colorOf(S.TAPE_COLORS, album.color)); this.settle();
      this.side = first; this.single = S.releaseInfo(album, 'cassette').type === 'single';
      this.art.src = A + (this.single ? 'deck/deck-single.png' : 'deck/deck-normal.png');
      this.flipKey.style.display = sides.length > 1 ? '' : 'none';
      this.layout();
      this.stageEl.animate([{ transform: 'translateY(-60%) scale(1.05)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 700, easing: 'ease-out' });
    }
    paintEdges(col) {
      const clear = col.id === 'clear' || col.id === 'smoke';
      this.stageEl.style.setProperty('--edge', clear ? '#ffffff33' : col.id === 'black' ? '#242528' : col.id === 'white' ? '#a9aaad' : S.shade(col.hex, -0.28));
      this.edges.forEach(el => el.classList.toggle('clear', clear));
    }
    currentSide() { return this.faces[this.visIndex()]?.side || 'A'; }
    // for the library animations
    recordRect() { this.stageEl.getAnimations().forEach(a => a.finish()); return this.stageEl.getBoundingClientRect(); }
    hideRecord(h) { this.stageEl.style.opacity = h ? 0 : ''; }      // (the slots set their own visibility, so opacity is what hides it)

    async swapTape(side) {              // eject the tape and slot in the next one of the set
      const from = this.rot, to = from + 180;
      await this.flipper.animate([{ transform: `translateY(0) scale(1) rotateY(${from}deg)`, opacity: 1 }, { transform: `translateY(-70%) scale(1.1) rotateX(18deg) rotateY(${from}deg)`, opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      this.rot = to;
      await this.flipper.animate([{ transform: `translateY(-70%) scale(1.1) rotateX(18deg) rotateY(${to}deg)`, opacity: 0 }, { transform: `translateY(0) scale(1) rotateY(${to}deg)`, opacity: 1 }], { duration: 750, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }).finished.catch(() => {});
      this.flipper.getAnimations().forEach(a => a.cancel()); this.flipper.style.opacity = ''; this.rot = to % 360; this.flipper.style.transform = `rotateY(${this.rot}deg)`;
    }
    async flipTo(side) {
      if (this.busy || this.currentSide() === side) return;
      this.busy = true; this.unsettle();
      const hidden = this.visIndex() ^ 1, swap = S.discOf(side, 'cassette') !== S.discOf(this.currentSide(), 'cassette');
      if (this.faces[hidden]?.side !== side) await this.fill(hidden, side);
      if (swap) { await this.swapTape(side); this.settle(); this.side = side; await new Promise(r => setTimeout(r, 300)); this.busy = false; return; }
      const from = this.rot, to = from + 180;
      const anim = this.flipper.animate([
        { transform: `translateY(0) scale(1) rotateX(0deg) rotateY(${from}deg)` },
        { transform: `translateY(-38%) scale(1.15) rotateX(24deg) rotateY(${from + 90}deg)`, offset: 0.5 },
        { transform: `translateY(0) scale(1) rotateX(0deg) rotateY(${to}deg)` }
      ], { duration: 1500, easing: 'cubic-bezier(.45,0,.2,1)' });
      await anim.finished.catch(() => {});
      this.rot = to % 360; this.flipper.style.transform = `rotateY(${this.rot}deg)`; this.settle();
      this.side = side;
      await new Promise(r => setTimeout(r, 300));
      this.busy = false;
    }

    // live parts of the display, drawn at 2x deck-art pixels over the display's baked (unlit) bars: lit segments, counter, side, time
    drawDisplay(dt, playing) {
      const c = this.lcd, x = c.getContext('2d');
      x.clearRect(0, 0, c.width, c.height);
      const segs = 26, X0 = 462, PITCH = 31.28, SW = 22, DB0 = -40, DB1 = 3, BAR = [{ y: 112, h: 92 }, { y: 260, h: 92 }];
      const live = playing && !this.busy ? S.meter.read() : null;   // real signal level, dB
      this.pk = this.pk || [0, 0]; this.pkT = this.pkT || [0, 0];
      for (let ch = 0; ch < 2; ch++) {
        let target = 0;
        if (live) target = S.clamp((live[ch] - DB0) / (DB1 - DB0), 0, 1);
        else if (playing && !S.meter.ok) { const t = this.t * (3.1 + ch * 0.7) + ch * 9; target = S.clamp(0.42 + 0.22 * Math.sin(t) + 0.18 * Math.sin(t * 2.3 + 1) + 0.12 * Math.sin(t * 5.1), 0, 1); }
        this.lvl[ch] += (target - this.lvl[ch]) * (1 - Math.exp(-dt * (target > this.lvl[ch] ? 40 : 6)));
        if (this.lvl[ch] >= this.pk[ch]) { this.pk[ch] = this.lvl[ch]; this.pkT[ch] = 0.9; }
        else { this.pkT[ch] -= dt; if (this.pkT[ch] < 0) this.pk[ch] = Math.max(this.lvl[ch], this.pk[ch] - dt * 0.5); }
        const lit = Math.round(this.lvl[ch] * segs), pkSeg = Math.min(segs - 1, Math.round(this.pk[ch] * segs) - 1);
        for (let k = 0; k < segs; k++) {
          const on = k < lit || (k === pkSeg && this.pk[ch] > 0.03);
          if (!on) continue;
          x.fillStyle = k >= segs * 0.84 ? '#ff8a4d' : '#62e8ff'; x.shadowColor = k >= segs * 0.84 ? '#ff6a2a' : '#2fd0ff'; x.shadowBlur = 12;
          x.fillRect(X0 + k * PITCH, BAR[ch].y, SW, BAR[ch].h);
        }
      }
      x.shadowBlur = 16; x.shadowColor = '#2fd0ff'; x.fillStyle = '#62e8ff'; x.textBaseline = 'alphabetic';
      x.font = '700 92px Consolas, "Courier New", monospace'; x.fillText(this.counter, 70, 160);
      x.shadowBlur = 8; x.font = '700 40px Consolas, "Courier New", monospace';
      x.fillText('SIDE ' + this.side, 70, 454); x.fillText(this.timeStr, 70, 506);
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
        f.angL -= (TAPE_MM_S / (f.rSup / PX_MM)) * 180 / Math.PI * dt * this.spin;
        f.angR -= (TAPE_MM_S / (f.rTake / PX_MM)) * 180 / Math.PI * dt * this.spin;
        f.hubL.style.transform = f.packL.style.transform = `rotate(${f.angL}deg)`; f.hubR.style.transform = f.packR.style.transform = `rotate(${f.angR}deg)`;
        if (f.spL) { f.spL.style.transform = `rotate(${f.angL}deg)`; f.spR.style.transform = `rotate(${f.angR}deg)`; }
      }
      this.counter = String(Math.floor((st.sideTime || 0) * 0.9)).padStart(4, '0').slice(-4);
      this.timeStr = S.fmt(st.sideTime || 0);
      this.playKey.classList.toggle('lit', st.playing);
      const vol = S.app.audio.volume; this.knobB.style.transform = `rotate(${-135 + vol * 270 - 73}deg)`;
      this.drawDisplay(dt, st.playing);
      this.deck.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); this.deck.remove(); }
  }
  // one side of a tape as a free-standing element (library animations); fill its parent
  S.cassetteFace = async (album, side) => {
    const col = S.colorOf(S.TAPE_COLORS, album.color), info = S.releaseInfo(album, 'cassette');
    const load = info.type === 'album' ? 1 : S.clamp(album.tracks.filter(t => t.side === side).reduce((a, t) => a + (t.duration || 0), 0) / 1800, 0.1, 0.7);
    return (await buildFace(album, 'label_' + side.toLowerCase(), side, col, info, load)).el;
  };
  S.cassetteEdge = album => { const col = S.colorOf(S.TAPE_COLORS, album.color); return col.id === 'clear' || col.id === 'smoke' ? '#d9dee455' : col.id === 'black' ? '#242528' : col.id === 'white' ? '#a9aaad' : S.shade(col.hex, -0.28); };
  S.stages = S.stages || {};
  S.stages.cassette = CassetteStage;
})(window.S);
