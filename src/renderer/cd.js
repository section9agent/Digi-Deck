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
      this.win.append(this.well, logo);

      this.lcd = e('div', { class: 'cdp-lcd' },
        e('div', { class: 'lcd-l' }, this.lcdLab = e('span', { class: 'lcd-lab' }, 'TRACK'), this.lcdTrack = e('span', { class: 'lcd-big' }, '--'), this.lcdOf = e('span', { class: 'lcd-of' }, '/--')),
        e('div', { class: 'lcd-r' }, e('span', { class: 'lcd-lab' }, 'TIME'), this.lcdTime = e('span', { class: 'lcd-big' }, '0:00'), this.lcdRpm = e('span', { class: 'lcd-of' }, '')));
      const b = (t, title, fn, cls = '') => e('button', { class: 'cdp-btn ' + cls, title, onclick: fn }, t);
      this.playBtn = b('▶‖', 'Play / Pause', () => S.app.togglePlay());
      this.keys = e('div', { class: 'cdp-keys' },
        b('■', 'Stop', () => S.app.stop()), this.playBtn, b('⏮', 'Previous', () => S.app.prev()), b('⏭', 'Next', () => S.app.next()),
        b('≡', 'Open library', () => S.shelf.open()));
      this.rocker = e('div', { class: 'cdp-rocker' }, e('button', { title: 'Volume down', onclick: () => S.app.volume(-0.08) }, '−'), e('button', { title: 'Volume up', onclick: () => S.app.volume(0.08) }, '+'));
      this.strip = e('div', { class: 'cdp-strip' }, this.lcd, this.keys, this.rocker);
      this.body.append(this.win, this.strip);
      this.root.append(this.body);
      this.host.append(this.root);
      this.discWrap.style.cursor = 'pointer'; this.discWrap.addEventListener('click', () => S.app.togglePlay());
    }
    layout() {
      const W = this.host.clientWidth, H = this.host.clientHeight;
      if (!W || !H) return;
      const U = Math.max(300, Math.min(W - 30, (H - 30) / 0.95));
      this.U = U;
      Object.assign(this.root.style, { width: U + 'px', height: U * 0.95 + 'px', left: (W - U) / 2 + 'px', top: (H - U * 0.95) / 2 + 'px' });
      this.root.style.setProperty('--u', U + 'px');
      const wh = U * 0.69, ww = U * 0.92;
      Object.assign(this.win.style, { left: U * 0.04 + 'px', top: U * 0.04 + 'px', width: ww + 'px', height: wh + 'px' });
      Object.assign(this.well.style, { width: wh + 'px', height: wh + 'px', left: (ww - wh) / 2 + 'px', top: 0 });
      const full = wh * 0.92, dd = full * (this.small ? 80 / 120 : 1);
      const ctr = (el, d) => Object.assign(el.style, { width: d + 'px', height: d + 'px', left: (wh - d) / 2 + 'px', top: (wh - d) / 2 + 'px' });
      ctr(this.recess, wh * 0.97); ctr(this.discWrap, dd); ctr(this.sheen, dd); ctr(this.hub, full * 0.19); ctr(this.spindle, full * 0.045);
      this.discFull = full;
    }
    async drawDisc(side) {
      const label = await S.art.get(this.album, 'label_' + side.toLowerCase(), 'cd', side);
      const canvas = drawCD(900, { small: this.small, labelImg: label });
      canvas.className = 'cdp-canvas';
      this.discWrap.firstChild.replaceChildren(canvas);
    }
    async setAlbum(album) {
      this.album = album; S.normalizeSides(album, 'cd');
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
      this.lcdTrack.textContent = st.trackIndex >= 0 && pos >= 0 ? String(pos + 1).padStart(2, '0') : '--';
      this.lcdOf.textContent = '/' + String(onDisc.length).padStart(2, '0');
      if (this.lcdLab) this.lcdLab.textContent = multi ? `DISC ${S.SIDE_LETTERS.indexOf(this.disc) + 1}/${this.discs.length}  TRACK` : 'TRACK';
      this.lcdTime.textContent = S.fmt(st.trackTime || 0);
      this.lcdRpm.textContent = this.spin > 0.05 ? `${Math.round(this.rpm * this.spin)} RPM` : '';
      this.root.classList.toggle('playing', st.playing);
    }
    destroy() { this._ro.disconnect(); this.root.remove(); }
  }
  S.stages = S.stages || {};
  S.stages.cd = CDStage;
  S.cdRpm = f => RPM_START / Math.sqrt(1 + K * f);
})(window.S);
