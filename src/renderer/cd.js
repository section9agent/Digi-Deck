// CD player stage: portable hi-fi look (white frame, open well (no lid), control strip with big LCD),
// printed-label disc that slows from 500 to 200 rpm (constant linear velocity), 5" or 3" disc.
(function (S) {
  const HOLE_MM = 15, HUB_MM = 17.5;               // centre hole, clear clamping area (radius)
  const RPM_START = 500, RPM_END = 200;
  const K = Math.pow(RPM_START / RPM_END, 2) - 1;  // rpm(f) = RPM_START / sqrt(1 + K f)

  function drawCD(size, { small, labelImg }) {
    const c = S.newCanvas(size), x = c.getContext('2d'), R = size / 2;
    const rad = small ? 40 : 60;
    const hole = (HOLE_MM / 2) / rad, hub = HUB_MM / rad;
    const disc = r => { x.beginPath(); x.arc(R, R, r * R, 0, Math.PI * 2); };
    x.save(); disc(0.995); x.clip();
    x.fillStyle = '#d8dbe0'; x.fillRect(0, 0, size, size);
    if (labelImg) S.drawCover(x, labelImg, 0, 0, size, size);
    x.restore();
    x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 0.6; disc(hub); x.fill(); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = size * 0.004; disc(hub); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = size * 0.003; disc(hub * 0.9); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = size * 0.006; disc(0.992); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = size * 0.003; disc(0.975); x.stroke();
    x.save(); x.globalCompositeOperation = 'destination-out'; disc(hole); x.fill(); x.restore();
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = size * 0.003; disc(hole); x.stroke();
    return c;
  }

  class CDStage {
    constructor(host) {
      this.host = host; this.angle = 0; this.spin = 0; this.album = null; this.small = false; this.rpm = 0; this.frac = 0; this.disc = 'A'; this.busy = false;
      this.build();
      this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(host);
    }
    build() {
      const e = S.el;
      this.root = e('div', { class: 'cdp' });
      this.body = e('div', { class: 'cdp-body' });
      this.win = e('div', { class: 'cdp-win' });
      this.well = e('div', { class: 'cdp-well' });
      this.recess = e('div', { class: 'cdp-recess' });
      this.hub = e('div', { class: 'cdp-hub' }, e('div', { class: 'cdp-hub-in' }));
      this.discWrap = e('div', { class: 'cdp-disc' }, e('div', { class: 'cdp-spin' }));
      this.sheen = e('div', { class: 'cdp-sheen' });
      this.spindle = e('div', { class: 'cdp-spindle' });
      this.well.append(this.recess, this.hub, this.discWrap, this.sheen, this.spindle);
      const logo = e('img', { class: 'cdp-logo', src: '../../assets/cd-logo.svg', alt: 'Compact Disc Digital Audio', draggable: 'false' });
      logo.onerror = () => { logo.replaceWith(e('div', { class: 'cdp-logo cdp-logo-txt' }, 'COMPACT DISC DIGITAL AUDIO')); };
      this.win.append(this.well); this.logo = logo;

      this.lcd = e('div', { class: 'cdp-lcd' },
        e('div', { class: 'lcd-l' }, this.lcdLab = e('span', { class: 'lcd-lab' }, 'TRACK'), this.lcdTrack = e('span', { class: 'lcd-big seg7', 'data-ghost': '88' }, '--'), this.lcdOf = e('span', { class: 'lcd-of' }, '/--')),
        e('div', { class: 'lcd-r' }, e('span', { class: 'lcd-lab' }, 'TIME'), this.lcdTime = e('span', { class: 'lcd-big seg7', 'data-ghost': '88:88' }, '!0:00'), this.lcdRpm = e('span', { class: 'lcd-of' }, '')));
      const round = (cls, t, title, fn, label) => e('div', { class: 'cdp-rkey ' + cls }, e('button', { class: 'cdp-round', title, onclick: fn }, t), label ? e('span', { class: 'cdp-print' }, label) : null);
      this.stopKey = round('stop', '■', 'Stop', () => S.app.stop(), 'STOP');
      this.ejectKey = round('eject', '⏏', 'Eject - put in the next disc', () => S.app.manualSwap(), 'EJECT · NEXT DISC');
      this.ejectKey.hidden = true;
      // the half-moon key cluster: four curved keys around a domed play/pause key
      const NS = 'http://www.w3.org/2000/svg', sv = (tag, at = {}) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
      const svg = sv('svg', { class: 'cdp-moon', viewBox: '-4 -4 208 112' });
      const defs = sv('defs');
      defs.innerHTML = '<linearGradient id="cdpSeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a9fa6"/><stop offset=".5" stop-color="#6f747b"/><stop offset="1" stop-color="#555a60"/></linearGradient>'
        + '<radialGradient id="cdpDome" cx=".42" cy=".25" r=".9"><stop offset="0" stop-color="#dff0f9"/><stop offset=".45" stop-color="#70c3ed"/><stop offset="1" stop-color="#3b6e8a"/></radialGradient>'
        + '<linearGradient id="cdpRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d42"/><stop offset="1" stop-color="#15171a"/></linearGradient>';
      svg.append(defs, sv('path', { d: 'M -2 102 A 102 102 0 0 1 202 102 Z', fill: 'url(#cdpRim)' }));
      const P = (r, a) => [100 + r * Math.cos(a), 102 - r * Math.sin(a)].map(v => v.toFixed(2)).join(' ');
      const segs = [['⏮', 'Previous', () => S.app.prev(), 'PREV'], ['−', 'Volume down', () => S.app.volume(-0.08), 'VOL'], ['+', 'Volume up', () => S.app.volume(0.08), 'VOL'], ['⏭', 'Next', () => S.app.next(), 'NEXT']];
      const R1 = 98, R0 = 54, gap = 0.03;
      segs.forEach(([t, title, fn, lab], i) => {
        const a1 = Math.PI - i * Math.PI / 4 - gap, a0 = Math.PI - (i + 1) * Math.PI / 4 + gap, am = (a0 + a1) / 2;
        const g = sv('g', { class: 'cdp-seg' }); const tt = sv('title'); tt.textContent = title; g.append(tt);
        g.append(sv('path', { d: `M ${P(R1, a1)} A ${R1} ${R1} 0 0 1 ${P(R1, a0)} L ${P(R0, a0)} A ${R0} ${R0} 0 0 0 ${P(R0, a1)} Z`, fill: 'url(#cdpSeg)', stroke: '#2a2d31', 'stroke-width': 1.2 }));
        const [tx, ty] = P((R0 + R1) / 2 + 4, am).split(' ').map(Number);
        const tx1 = sv('text', { x: tx, y: ty + 5, 'text-anchor': 'middle', class: 'cdp-seg-ico' }); tx1.textContent = t;
        let [lx, ly] = P(R0 + 9, am).split(' ').map(Number);
        if (i === 0 || i === 3) { tx1.setAttribute('y', ty + 1); lx = tx; ly = ty + 9; }      // PREV / NEXT: name under the icon
        const tx2 = sv('text', { x: lx, y: ly + 2.5, 'text-anchor': 'middle', class: 'cdp-seg-lab' }); tx2.textContent = lab;
        g.append(tx1, tx2); g.addEventListener('click', fn); svg.append(g);
      });
      const dome = sv('g', { class: 'cdp-seg dome' }); const dt = sv('title'); dt.textContent = 'Play / Pause'; dome.append(dt);
      dome.append(sv('path', { d: `M ${100 - 48} 102 A 48 48 0 0 1 ${100 + 48} 102 Z`, fill: 'url(#cdpDome)', stroke: '#2a2d31', 'stroke-width': 1.2 }));
      const pt = sv('text', { x: 100, y: 88, 'text-anchor': 'middle', class: 'cdp-dome-ico' }); pt.textContent = '▶‖'; dome.append(pt);
      dome.addEventListener('click', () => S.app.togglePlay()); svg.append(dome);
      this.moon = e('div', { class: 'cdp-moonbox' }); this.moon.append(svg);
      this.brand = e('div', { class: 'cdp-brand' }, 'DIGI-DECK');
      this.model = e('div', { class: 'cdp-model' }, 'PORTABLE COMPACT DISC PLAYER');
      this.arcTxt = e('div', { class: 'cdp-arctxt' }, 'DIGITAL AUDIO · CONSTANT LINEAR VELOCITY');
      this.silver = e('div', { class: 'cdp-silver' }, this.stopKey, this.ejectKey, this.lcd, this.moon);
      this.surround = e('div', { class: 'cdp-surround' });
      this.glare = e('div', { class: 'cdp-glare' });
      this.body.append(this.silver, this.surround, this.win, this.brand, this.model, this.logo, this.glare);
      this.root.append(this.body);
      this.host.append(this.root);
      this.discWrap.style.cursor = 'pointer'; this.discWrap.addEventListener('click', () => S.app.togglePlay());
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight;
      if (!W || !H) return;
      const AR = 1.0, U = Math.max(300, Math.min(W - 30, (H - 30) / AR));
      this.U = U;
      Object.assign(this.root.style, { width: U + 'px', height: U * AR + 'px', left: (W - U) / 2 + 'px', top: (H - U * AR) / 2 + 'px' });
      this.root.style.setProperty('--u', U + 'px');
      // the disc sits in a round smoked well in the black top; the well dips into the silver control strip
      const wh = U * 0.68, cx = U / 2, cy = U * 0.44;
      Object.assign(this.win.style, { left: cx - wh / 2 + 'px', top: cy - wh / 2 + 'px', width: wh + 'px', height: wh + 'px' });
      const sr = wh * 1.07; Object.assign(this.surround.style, { left: cx - sr / 2 + 'px', top: cy - sr / 2 + 'px', width: sr + 'px', height: sr + 'px' });
      Object.assign(this.well.style, { width: wh + 'px', height: wh + 'px', left: 0, top: 0 });
      const full = wh * 0.95, dd = full * (this.small ? 80 / 120 : 1);
      const ctr = (el, d) => Object.assign(el.style, { width: d + 'px', height: d + 'px', left: (wh - d) / 2 + 'px', top: (wh - d) / 2 + 'px' });
      ctr(this.recess, wh); ctr(this.discWrap, dd); ctr(this.sheen, dd); ctr(this.hub, full * 0.19); ctr(this.spindle, full * 0.045);
      this.discFull = full;
    }
    setMulti(m) { this.ejectKey.hidden = !m; }
    async drawDisc(side) {
      const label = await S.art.get(this.album, 'label_' + side.toLowerCase(), 'cd', side);
      const canvas = drawCD(900, { small: this.small, labelImg: label });
      canvas.className = 'cdp-canvas';
      this.discWrap.firstChild.replaceChildren(canvas);
    }
    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'cd'); this.hideRecord(false);
      this.small = S.releaseInfo(album, 'cd').small;
      this.root.classList.toggle('small', this.small);
      this.discs = S.sidesOf(album.tracks); this.disc = this.discs[0] || 'A';
      await this.drawDisc(this.disc);
      this.layout();
    }
    // multi-disc releases: lift the finished disc out, drop the next one in
    async flipTo(side) {
      if (this.busy || side === this.disc) return;
      this.busy = true;
      const w = this.discWrap;
      await w.animate([{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(-45%) scale(1.12)', opacity: 0 }], { duration: 560, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      this.disc = side; await this.drawDisc(side);
      this.angle = 0; this.spin = 0;
      await w.animate([{ transform: 'translateY(-45%) scale(1.12)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }).finished.catch(() => {});
      w.getAnimations().forEach(a => a.cancel());
      await new Promise(r => setTimeout(r, 250)); this.busy = false;
    }
    currentSide() { return this.disc; }
    // for the library animations
    recordCanvas() { return this.discWrap.querySelector('canvas'); }
    recordRect() { return this.discWrap.getBoundingClientRect(); }
    hideRecord(h) { this.discWrap.style.visibility = h ? 'hidden' : ''; }

    frame(dt, st) {
      const target = st.playing && !this.busy ? 1 : 0;
      this.spin += (target - this.spin) * (1 - Math.exp(-dt * (target ? 3.0 : 1.2)));
      if (!target && this.spin < 0.002) this.spin = 0;
      const f = S.clamp(st.sideFrac || 0, 0, 1);       // every disc starts again at 500 rpm
      this.rpm = RPM_START / Math.sqrt(1 + K * f);
      this.angle = (this.angle + this.rpm * 6 * dt * this.spin) % 360;
      this.discWrap.firstChild.style.transform = `rotate(${this.angle}deg)`;
      const tr = this.album ? this.album.tracks : [], multi = (this.discs || []).length > 1;
      const onDisc = multi ? tr.map((t, i) => i).filter(i => tr[i].side === this.disc) : tr.map((t, i) => i);
      const pos = onDisc.indexOf(st.trackIndex);
      const seg = (el, t) => { if (el._t !== t) { el._t = t; el.textContent = t.replace(/ /g, '!'); el.dataset.ghost = t.replace(/[0-9\- ]/g, '8'); } };
      seg(this.lcdTrack, st.trackIndex >= 0 && pos >= 0 ? String(pos + 1).padStart(2, '0') : '--');
      this.lcdOf.textContent = '/' + String(onDisc.length).padStart(2, '0');
      if (this.lcdLab) this.lcdLab.textContent = multi ? `DISC ${S.SIDE_LETTERS.indexOf(this.disc) + 1}/${this.discs.length}  TRACK` : 'TRACK';
      seg(this.lcdTime, S.fmt(st.trackTime || 0).padStart(5, ' '));
      this.lcdRpm.textContent = this.spin > 0.05 ? `${Math.round(this.rpm * this.spin)} RPM` : '';
      this.root.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); this.root.remove(); }
  }
  S.stages = S.stages || {};
  S.stages.cd = CDStage;
  S.cdFace = async (album, side) => {
    const small = S.releaseInfo(album, 'cd').small, label = await S.art.get(album, 'label_' + side.toLowerCase(), 'cd', side);
    return drawCD(900, { small, labelImg: label });
  };
  S.cdRpm = f => RPM_START / Math.sqrt(1 + K * f);
})(window.S);
