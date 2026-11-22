// Library animations: an album is taken out of its packaging before it goes on the player, and put back when the playlist is cleared.
// Vinyl: the jacket comes forward, the record slides out (12" from the right, 7" from the top) and is carried to the turntable.
(() => {
  const S = window.S, el = S.el;
  const EASE = 'cubic-bezier(.45,.05,.25,1)';
  const T = {
    enabled() { return (S.app.cfg || {}).libraryAnim !== false; },
    _run: null,
    // one animation run; clicking the backdrop (or Esc) finishes it straight away
    // speed: multiplies every step's time (the step timings below add up to ~7.8 s out / ~7 s back at 1)
    begin(speed = 1) {
      const run = { skip: false, anims: new Set(), k: speed };
      run.ov = el('div', { class: 'tr-ov' }); run.shade = el('div', { class: 'tr-shade' }); run.ov.append(run.shade);
      run.finish = () => { run.skip = true; run.anims.forEach(a => { try { a.finish(); } catch {} }); };
      run.onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); run.finish(); } };
      run.ov.addEventListener('click', run.finish); window.addEventListener('keydown', run.onKey, true);
      // fading a 3D holder would flatten it (back faces show through), so its opacity goes on a plain wrapper around it instead
      const fadeOf = h => {
        if (h._fade) return h._fade;
        const f = el('div', { class: 'tr-fade' }); h.parentNode.insertBefore(f, h); f.append(h); h._fade = f;
        if (h.style.opacity !== '') { f.style.opacity = h.style.opacity; h.style.opacity = ''; }
        return f;
      };
      run.anim = (node, frames, ms, easing = EASE) => {
        if (node.classList && node.classList.contains('tr-holder') && frames.some(k => 'opacity' in k)) {
          const f = fadeOf(node);
          run.anim(f, frames.map(k => { const o = { opacity: k.opacity ?? 1 }; if (k.offset != null) o.offset = k.offset; return o; }), ms, easing);
          frames = frames.map(k => { const o = { ...k }; delete o.opacity; return o; });
        }
        const a = node.animate(frames, { duration: run.skip ? 1 : ms * run.k, easing, fill: 'both' }); run.anims.add(a);
        return a.finished.catch(() => {}).then(() => { run.anims.delete(a); try { a.commitStyles(); } catch {} a.cancel(); });
      };
      run.wait = ms => run.skip ? Promise.resolve() : new Promise(r => { const t0 = performance.now(), f = () => (run.skip || performance.now() - t0 >= ms * run.k) ? r() : requestAnimationFrame(f); f(); });
      run.end = () => { window.removeEventListener('keydown', run.onKey, true); run.ov.remove(); if (T._run === run) T._run = null; };
      document.body.append(run.ov); T._run = run; return run;
    },
    // a record jacket / paper sleeve with the record inside it. 12" jackets are 4 mm thick; 7" sleeves are paper.
    jacket(album, seven, recCanvas, size) {
      const th = seven ? 1.5 : Math.max(3, size * 4 / 314);
      const face = (src, cls) => { const d = el('div', { class: 'tr-jface ' + cls }); if (src) d.style.backgroundImage = `url("${S.fileUrl(src)}")`; else d.append(S.generic.cover(album.title, album.artist, 600)); return d; };
      const front = face(album.front, 'front'), back = face(album.back || null, 'back');
      if (!album.back) { back.replaceChildren(); back.classList.add('plain'); }
      front.style.transform = `translateZ(${th / 2}px)`; back.style.transform = `translateZ(${-th / 2}px) rotateY(180deg)`;
      const slab = (cls, css) => { const d = el('div', { class: 'tr-jedge ' + cls }); d.style.cssText = css; return d; };
      const edges = [
        slab('open', seven ? `left:0;top:0;width:100%;height:${th}px;margin-top:${-th / 2}px;transform:rotateX(90deg)` : `left:100%;top:0;height:100%;width:${th}px;margin-left:${-th / 2}px;transform:rotateY(90deg)`),
        slab('spine', seven ? `left:0;top:100%;width:100%;height:${th}px;margin-top:${-th / 2}px;transform:rotateX(-90deg)` : `left:0;top:0;height:100%;width:${th}px;margin-left:${-th / 2}px;transform:rotateY(-90deg)`),
        ...(seven ? [] : [slab('', `left:0;top:0;width:100%;height:${th}px;margin-top:${-th / 2}px;transform:rotateX(90deg)`), slab('', `left:0;top:100%;width:100%;height:${th}px;margin-top:${-th / 2}px;transform:rotateX(-90deg)`)])];
      const rec = el('div', { class: 'tr-rec' }); rec.append(recCanvas);
      // die-cut jacket (a see-through hole in the front / back picture): the record shows through, and its other side shows
      // through the back. The inside of the jacket is drawn behind each face so the hole never shows straight through
      const inner = [];
      for (const [face2, which, z] of [[front, 'front', -th / 2 + 0.6], [back, 'back', th / 2 - 0.6]]) {
        if (!album[which]) continue;
        S.isHoled(album[which]).then(h => { if (!h) return; face2.classList.add('holed');
          const d = el('div', { class: 'tr-jinner' }); d.style.transform = `translateZ(${z}px)` + (which === 'back' ? ' rotateY(180deg)' : ''); j.insertBefore(d, which === 'front' ? back.nextSibling : front);
          if (which === 'back') { const sides = S.sidesOf(album.tracks || []); S.vinylFace(album, sides[1] || 'B').then(cv => { cv.classList.add('tr-recback'); rec.append(cv); }); }
        });
      }
      const j = el('div', { class: 'tr-jacket' + (seven ? ' seven' : '') }, back, rec, ...edges, front);
      j.style.width = j.style.height = size + 'px';
      return { j, rec, front, th };
    },
    // ---- shaped records: a clear PVC sleeve the size of the record (with a fold-over flap at the back). Without cover art the record
    // shows through it; with cover art the card sits at the front, under the PVC, and the record slides out from behind it.
    shapedCrop(cv) {                                    // the record's own square inside its 12" frame canvas
      const W = cv.width, k = 160 / W, sm = S.newCanvas(160, 160), x = sm.getContext('2d'); x.drawImage(cv, 0, 0, 160, 160);
      const a = x.getImageData(0, 0, 160, 160).data; let x0 = 160, y0 = 160, x1 = 0, y1 = 0;
      for (let i = 0; i < 160 * 160; i++) if (a[i * 4 + 3] > 40) { const X = i % 160, Y = (i / 160) | 0; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
      if (x1 <= x0) return { crop: cv, x0: 0, y0: 0, cs: W, W };
      const cs = Math.min(W, Math.round((Math.max(x1 - x0, y1 - y0) + 3) / k)), cx = (x0 + x1 + 1) / 2 / k, cy = (y0 + y1 + 1) / 2 / k;
      const X0 = Math.round(cx - cs / 2), Y0 = Math.round(cy - cs / 2), c = S.newCanvas(cs, cs); c.getContext('2d').drawImage(cv, -X0, -Y0);
      return { crop: c, x0: X0, y0: Y0, cs, W };
    },
    // the full 12"-frame rectangle that puts the cropped record at r
    shapedFull(sc, r) { const k = r.width / sc.cs; return { left: r.left - sc.x0 * k, top: r.top - sc.y0 * k, width: sc.W * k, height: sc.W * k }; },
    pvc(album, recCanvas, size) {
      const th = 2;
      const sheet = cls => el('div', { class: 'tr-pvc ' + cls });
      const back = sheet('back'), front = sheet('front'), flap = sheet('flap');
      back.style.transform = `translateZ(${-th / 2}px)`; flap.style.transform = `translateZ(${-th / 2 + 0.3}px)`; front.style.transform = `translateZ(${th / 2}px)`;
      const rec = el('div', { class: 'tr-rec shaped' }); rec.append(recCanvas);
      const layers = [back, flap, rec];
      if (album.front) { const card = el('div', { class: 'tr-pvccard' }); card.style.backgroundImage = `url("${S.fileUrl(album.front)}")`; card.style.transform = `translateZ(${th / 2 - 0.4}px)`; layers.push(card); }
      const j = el('div', { class: 'tr-jacket pvcj' }, ...layers, front);
      j.style.width = j.style.height = size + 'px';
      return { j, rec, front, th };
    },
    copyOf(cv) { const c = S.newCanvas(cv.width, cv.height); c.getContext('2d').drawImage(cv, 0, 0); return c; },
    place(node, r) { Object.assign(node.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); },
    // on-screen size of the jacket / sleeve: a 12" fills most of the height, a 10" is 10/12 of that, a 7" sleeve its own size
    sleeveSize(vi, vw, vh) { if (vi.seven) return Math.min(vh * 0.42, vw * 0.3); const s12 = Math.min(vh * 0.62, vw * 0.4); return vi.inch === 10 ? s12 * 10 / 12 : s12; },
    tilt: seven => seven ? 'rotateX(16deg) rotateY(-8deg)' : 'rotateY(-22deg) rotateX(5deg)',

    // ---- vinyl: out of the jacket and onto the turntable -------------------------------------------------------------------
    // from: rectangle of the cover in the library preview; load(): puts the album on the player (no autoplay) and resolves when it is ready
    async vinylOut(album, from, load) {
      const run = T.begin(0.6), vi = S.releaseInfo(album, 'vinyl'), seven = vi.paper;     // about 5 s; "seven" = paper sleeve (7" and 78s)
      try {
        const side = (S.sidesOf(album.tracks)[0]) || 'A';
        const recCv = await S.vinylFace(album, side);
        const vw = innerWidth, vh = innerHeight, sc = vi.shaped ? T.shapedCrop(recCv) : null;
        const size = sc ? T.sleeveSize(vi, vw, vh) * sc.cs / sc.W * 1.12 : T.sleeveSize(vi, vw, vh);
        const { j, rec } = sc ? T.pvc(album, sc.crop, size) : T.jacket(album, seven, recCv, size);
        const holder = el('div', { class: 'tr-holder' }); holder.append(j); run.ov.append(holder);
        // where the jacket rests while the record comes out: left of centre for a 12", low for a 7"
        const cx = seven ? vw / 2 : vw / 2 - size * 0.42, cy = seven ? Math.min(vh / 2 + size * 0.5, vh - size * 0.47) : vh / 2;
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2, s0 = Math.max(from.width, from.height) / size;
        const at = (x, y, s, rot) => `translate(${x - size / 2}px,${y - size / 2}px) scale(${s}) ${rot}`;
        const tilt = T.tilt(seven);
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        await run.anim(holder, [{ transform: at(fx, fy, s0, 'rotateY(0deg)') }, { transform: at(cx, cy, 1, tilt) }], 1500);
        await run.wait(350);
        // the record slides out
        const out = seven ? 'translateY(-104%)' : 'translateX(104%)';
        await run.anim(rec, [{ transform: 'none' }, { transform: out }], 2300, 'cubic-bezier(.5,0,.3,1)');
        await run.wait(250);
        // free the record from the jacket's space, so the two can part
        let rr = rec.getBoundingClientRect(); const free = el('div', { class: 'tr-free' + (sc ? ' shaped' : '') }); free.append(T.copyOf(recCv));
        if (sc) { const q = rr.width / sc.cs * sc.W; rr = T.shapedFull(sc, rr); rr = { left: rr.left, top: rr.top, width: q, height: q }; }
        T.place(free, rr); run.ov.append(free); rec.style.visibility = 'hidden';
        const rs = Math.min(rr.width, rr.height), up = { left: vw / 2 - rs / 2, top: Math.max(12, vh * 0.1), width: rs, height: rs };
        const loaded = load();
        run.anim(holder, [{ transform: at(cx, cy, 1, tilt), opacity: 1 }, { transform: at(cx - (seven ? 0 : vw * 0.12), cy + vh * 0.25, 0.86, tilt), opacity: 0 }], 1300, 'cubic-bezier(.5,0,.6,1)');
        await run.anim(free, [{ left: rr.left + 'px', top: rr.top + 'px', width: rr.width + 'px', height: rr.height + 'px' }, { left: up.left + 'px', top: up.top + 'px', width: up.width + 'px', height: up.height + 'px' }], 1400);
        await loaded;
        // down onto the platter
        const stage = S.app.stage, target = stage && stage.recordRect && stage.recordRect();
        if (target) {
          stage.hideRecord(true);
          run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 900, 'ease');
          await run.wait(300);
          const mid = { left: target.left - target.width * 0.06, top: target.top - target.height * 0.16, width: target.width * 1.12, height: target.height * 1.12 };
          const px = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
          await run.anim(free, [px(up), { ...px(mid), offset: 0.72 }, px(target)], 1700);
          stage.hideRecord(false);
        }
      } finally { run.end(); }
    },

    // ---- vinyl: off the turntable, back in the jacket, and away toward the Library button ------------------------------------
    async vinylBack(album) {
      const stage = S.app.stage, target = stage && stage.recordRect && stage.recordRect(); if (!target) return;
      const run = T.begin(0.54), vi = S.releaseInfo(album, 'vinyl'), seven = vi.paper;     // about 4 s
      try {
        const src = stage.recordCanvas(), recCv = T.copyOf(src);
        const vw = innerWidth, vh = innerHeight, sc = vi.shaped ? T.shapedCrop(recCv) : null;
        const size = sc ? T.sleeveSize(vi, vw, vh) * sc.cs / sc.W * 1.12 : T.sleeveSize(vi, vw, vh);
        const free = el('div', { class: 'tr-free' + (sc ? ' shaped' : '') }); free.append(T.copyOf(src)); T.place(free, target); run.ov.append(free); stage.hideRecord(true);
        const { j, rec } = sc ? T.pvc(album, sc.crop, size) : T.jacket(album, seven, recCv, size); rec.style.visibility = 'hidden';
        const holder = el('div', { class: 'tr-holder' }); holder.append(j); holder.style.opacity = 0; run.ov.append(holder, free);
        const cx = seven ? vw / 2 : vw / 2 - size * 0.42, cy = seven ? Math.min(vh / 2 + size * 0.5, vh - size * 0.47) : vh / 2, tilt = T.tilt(seven);
        const at = (x, y, s, rot) => `translate(${x - size / 2}px,${y - size / 2}px) scale(${s}) ${rot}`;
        const px = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        // the record lifts off the platter
        const lift = { left: target.left - target.width * 0.06, top: target.top - target.height * 0.16, width: target.width * 1.12, height: target.height * 1.12 };
        await run.anim(free, [px(target), px(lift)], 900);
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        // the jacket comes down from the top while the record moves to where it will slide in
        const out = seven ? 'translateY(-104%)' : 'translateX(104%)';
        rec.style.transform = out; holder.style.transform = at(cx, cy, 1, tilt);
        let slot = rec.getBoundingClientRect();                                    // where the pulled-out record sits, on screen
        if (sc) slot = T.shapedFull(sc, slot);
        run.anim(holder, [{ transform: at(cx, -size, 0.8, tilt), opacity: 0 }, { transform: at(cx, cy, 1, tilt), opacity: 1 }], 1500);
        await run.anim(free, [px(lift), px(slot)], 1500);
        rec.style.visibility = ''; free.remove();
        await run.wait(250);
        await run.anim(rec, [{ transform: out }, { transform: 'none' }], 2300, 'cubic-bezier(.5,0,.3,1)');
        await run.wait(350);
        // the jacket straightens and leaves toward the Library button
        const lb = document.getElementById('btnLibrary'), b = lb ? lb.getBoundingClientRect() : { left: vw - 200, top: 0, width: 80, height: 30 };
        run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 1300, 'ease');
        await run.anim(holder, [{ transform: at(cx, cy, 1, tilt), opacity: 1 }, { transform: at(vw / 2, vh * 0.42, 0.8, 'rotateY(0deg)'), opacity: 1, offset: 0.45 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05, 'rotateY(0deg)'), opacity: 0.2 }], 1700, 'cubic-bezier(.5,0,.5,1)');
        if (lb) lb.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500 });
      } finally { run.end(); }
    },
    // ---- CD: jewel case (5") or sleeve (3") ------------------------------------------------------------------------------------
    // the case art is 658 x 580: hinge strip x 0-70, front insert 70-636; a 120 mm disc is 545 px across, centred on the insert
    CASE: { w: 658, h: 580, cx: 353, cy: 290, disc: 545 },
    trayCanvas() {
      const { w, h, cx, cy } = T.CASE, c = S.newCanvas(w, h), x = c.getContext('2d');
      const rr = (X, Y, W, H, r) => { x.beginPath(); x.roundRect(X, Y, W, H, r); };
      x.fillStyle = 'rgba(225,232,240,.35)'; rr(0, 0, w, h, 10); x.fill();                                  // clear outer shell
      x.fillStyle = '#26282b'; rr(10, 10, w - 20, h - 20, 6); x.fill();                                      // black tray
      const g = x.createLinearGradient(10, 0, 70, 0); g.addColorStop(0, '#1d1f22'); g.addColorStop(1, '#2f3236');
      x.fillStyle = g; x.fillRect(10, 10, 60, h - 20);                                                       // ribbed hinge strip
      x.strokeStyle = '#ffffff10'; x.lineWidth = 2; for (let i = 16; i < 66; i += 7) { x.beginPath(); x.moveTo(i, 14); x.lineTo(i, h - 14); x.stroke(); }
      x.fillStyle = '#1e2023'; x.beginPath(); x.arc(cx, cy, 282, 0, Math.PI * 2); x.fill();                  // disc recess
      x.strokeStyle = '#3a3d41'; x.lineWidth = 3; x.stroke();
      for (const [ax, ay] of [[cx - 250, cy - 250], [cx + 250, cy - 250], [cx - 250, cy + 250], [cx + 250, cy + 250]]) { x.fillStyle = '#2c2f33'; x.beginPath(); x.arc(ax, ay, 26, 0, Math.PI * 2); x.fill(); }
      // the hub rosette that grips the disc
      x.fillStyle = '#18191b'; x.beginPath(); x.arc(cx, cy, 62, 0, Math.PI * 2); x.fill();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.fillStyle = '#4a4e53'; x.beginPath(); x.ellipse(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34, 12, 7, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#0d0e0f'; x.beginPath(); x.arc(cx, cy, 16, 0, Math.PI * 2); x.fill();
      return c;
    },
    async lidInside(album) {             // the inside of the lid: the booklet seen from the inside, through clear plastic
      const { w, h } = T.CASE, c = S.newCanvas(w, h), x = c.getContext('2d');
      x.fillStyle = 'rgba(225,232,240,.4)'; x.beginPath(); x.roundRect(0, 0, w, h, 10); x.fill();
      const src = album.front ? await S.loadImage(album.front) : null, im = src || S.generic.cover(album.title, album.artist, 600);
      const R = { x: w - 636, y: 12, w: 566, h: 555 }, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(R.w / iw, R.h / ih);
      x.save(); x.beginPath(); x.rect(R.x, R.y, R.w, R.h); x.clip(); x.filter = 'brightness(.72) saturate(.85)';
      x.drawImage(im, R.x + (R.w - iw * k) / 2, R.y + (R.h - ih * k) / 2, iw * k, ih * k); x.restore();
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffffff30'); g.addColorStop(.4, '#ffffff00'); g.addColorStop(.6, '#ffffff10'); g.addColorStop(1, '#ffffff00');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      return c;
    },
    async jewel(album, H) {
      const { w, h } = T.CASE, W = H * w / h, mm = W / 142, th = 10.2 * mm, lt = 4 * mm;     // jewel case 142 x 125 x 10.2 mm; the lid is about 4 mm deep
      const front = await S.cdCaseArt(album.front, album) || S.generic.cover(album.title, album.artist, 600);
      const face = (cv, cls) => { const d = el('div', { class: 'tr-cface ' + cls }); d.append(cv); return d; };
      const lidF = face(front, 'front'), lidB = face(await T.lidInside(album), 'back');
      // a wall of the case: side 'l' | 'r' | 't' | 'b', standing from z0 up to z0 + d
      const wall = (side, z0, d, cls = '') => {
        const n = el('div', { class: 'tr-wall ' + cls }), v = side === 't' || side === 'b';
        n.style.cssText = v ? `left:0;width:100%;height:${d}px;top:${side === 't' ? 0 : '100%'};margin-top:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateX(${side === 't' ? 90 : -90}deg)`
                            : `top:0;height:100%;width:${d}px;left:${side === 'l' ? 0 : '100%'};margin-left:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateY(${side === 'l' ? -90 : 90}deg)`;
        return n;
      };
      lidB.style.transform = `translateZ(${-lt}px) rotateY(180deg)`;
      const lid = el('div', { class: 'tr-lid' }, lidB, wall('l', -lt, lt, 'hinge'), wall('r', -lt, lt), wall('t', -lt, lt), wall('b', -lt, lt), lidF); lid.style.transform = `translateZ(${th}px)`;
      const base = el('div', { class: 'tr-cbase' }, face(T.trayCanvas(), 'tray'), wall('l', 0, th - lt, 'hinge'), wall('r', 0, th - lt), wall('t', 0, th - lt), wall('b', 0, th - lt));
      const disc = el('div', { class: 'tr-cdisc' });
      const d = T.CASE.disc / w * W; Object.assign(disc.style, { width: d + 'px', height: d + 'px', left: (T.CASE.cx / w * W - d / 2) + 'px', top: (T.CASE.cy / h * H - d / 2) + 'px', transform: 'translateZ(3px)' });
      disc.dataset.mm = mm;
      const box = el('div', { class: 'tr-case' }, base, disc, lid); box.style.width = W + 'px'; box.style.height = H + 'px';
      return { box, lid, disc, W, H, th, hz: 45 * mm };
    },
    sleeve(album, H) {                   // 3" CD: a card / paper sleeve, open at the top, no case overlay
      const d = el('div', { class: 'tr-sleeve' }), im = el('div', { class: 'tr-sface' });
      if (album.front) im.style.backgroundImage = `url("${S.fileUrl(album.front)}")`; else im.append(S.generic.cover(album.title, album.artist, 400));
      const disc = el('div', { class: 'tr-rec tr-sdisc' });
      d.append(disc, im); d.style.width = d.style.height = H + 'px';
      return { box: d, disc };
    },
    // a CD is 1.2 mm thick: stacked copies give it an edge when it is seen at an angle
    thickDisc(holder, cv, tmm = 1.2) {
      const t = tmm * (+holder.dataset.mm || 3), n = tmm > 3 ? 7 : 4;
      holder.style.transformStyle = 'preserve-3d';
      for (let i = 0; i < n; i++) { const c = T.copyOf(cv); c.style.cssText = `position:absolute;inset:0;transform:translateZ(${t * i / (n - 1)}px);filter:brightness(${i === n - 1 ? 1 : 0.55 + i * 0.1})`; holder.append(c); }
    },
    discEl(cv, angle = 0) { const f = el('div', { class: 'tr-free disc' }), c = T.copyOf(cv); c.style.transform = `rotate(${angle}deg)`; f.append(c); return f; },
    px: r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }),

    async cdOut(album, from, load) {
      const run = T.begin(0.6), small = S.releaseInfo(album, 'cd').small;
      try {
        const side = S.sidesOf(album.tracks)[0] || 'A', cv = await S.cdFace(album, side);
        const vw = innerWidth, vh = innerHeight, H = Math.min(vh * (small ? 0.42 : 0.56), vw * (small ? 0.3 : 0.34));
        const holder = el('div', { class: 'tr-holder' }); run.ov.append(holder);
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        let free;
        if (small) {
          const sl = T.sleeve(album, H); sl.disc.append(T.copyOf(cv)); holder.append(sl.box);
          const at = (x, y, s, r = '') => `translate(${x - H / 2}px,${y - H / 2}px) scale(${s}) ${r}`, cy = vh / 2 + H * 0.45, tilt = 'rotateX(14deg)';
          await run.anim(holder, [{ transform: at(fx, fy, from.width / H) }, { transform: at(vw / 2, cy, 1, tilt) }], 1500);
          await run.wait(300);
          await run.anim(sl.disc, [{ transform: 'translateY(0)' }, { transform: 'translateY(-96%)' }], 2000, 'cubic-bezier(.5,0,.3,1)');
          const rr = sl.disc.getBoundingClientRect(); free = T.discEl(cv); T.place(free, rr); run.ov.append(free); sl.disc.style.visibility = 'hidden';
          run.anim(holder, [{ transform: at(vw / 2, cy, 1, tilt), opacity: 1 }, { transform: at(vw / 2, cy + vh * 0.3, 0.86, tilt), opacity: 0 }], 1300, 'cubic-bezier(.5,0,.6,1)');
        } else {
          const jc = await T.jewel(album, H), W = jc.W; T.thickDisc(jc.disc, cv); holder.append(jc.box);
          const s0 = from.width / W, tilt = 'rotateX(32deg) rotateY(-6deg)';
          const at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - H / 2}px) scale(${s}) ${r}`;
          // the closed case comes forward, then slides right while the lid swings open to the left on its hinge
          await run.anim(holder, [{ transform: at(fx, fy, s0) }, { transform: at(vw / 2, vh / 2, 1, tilt) }], 1400);
          await run.wait(200);
          run.anim(holder, [{ transform: at(vw / 2, vh / 2, 1, tilt) }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt) }], 1500);
          await run.anim(jc.lid, [{ transform: `translateZ(${jc.th}px) rotateY(0deg)` }, { transform: `translateZ(${jc.th}px) rotateY(-180deg)` }], 1500);
          await run.wait(250);
          // the disc is lifted off the hub and floats up while the case closes and drops away
          // it comes straight up off the hub inside the case first, then is carried away
          const hz = jc.hz;
          await run.anim(jc.disc, [{ transform: 'translateZ(3px)' }, { transform: `translateZ(${hz}px)` }], 800, 'cubic-bezier(.3,0,.3,1)');
          jc.disc.style.transform = `translateZ(${hz}px)`;
          const rr = jc.disc.getBoundingClientRect(); free = T.discEl(cv); T.place(free, rr); run.ov.append(free); jc.disc.style.visibility = 'hidden';
          run.anim(jc.lid, [{ transform: `translateZ(${jc.th}px) rotateY(-180deg)` }, { transform: `translateZ(${jc.th}px) rotateY(0deg)` }], 1300);
          run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1 }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1, offset: 0.55 }, { transform: at(vw / 2 + W / 2, vh * 0.85, 0.85, tilt), opacity: 0 }], 1700, 'cubic-bezier(.5,0,.6,1)');
        }
        const r0 = free.getBoundingClientRect(), rs = r0.width, up = { left: vw / 2 - rs / 2, top: Math.max(12, vh * 0.08), width: rs, height: rs };
        const loaded = load();
        await run.anim(free, [T.px(r0), T.px(up)], 1300);
        await loaded;
        const stage = S.app.stage, target = stage && stage.recordRect && stage.recordRect();
        if (target && target.width) {
          stage.hideRecord(true);
          run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 900, 'ease');
          const mid = { left: target.left - target.width * 0.05, top: target.top - target.height * 0.12, width: target.width * 1.1, height: target.height * 1.1 };
          await run.anim(free, [T.px(up), { ...T.px(mid), offset: 0.72 }, T.px(target)], 1600);
          stage.hideRecord(false);
        }
      } finally { run.end(); }
    },

    async cdBack(album) {
      const stage = S.app.stage, target = stage && stage.recordRect && stage.recordRect(); if (!target || !target.width) return;
      const run = T.begin(0.54), small = S.releaseInfo(album, 'cd').small;
      try {
        const src = stage.recordCanvas(), cv = T.copyOf(src);
        const vw = innerWidth, vh = innerHeight, H = Math.min(vh * (small ? 0.42 : 0.56), vw * (small ? 0.3 : 0.34));
        const free = T.discEl(src, stage.angle || 0); T.place(free, target); run.ov.append(free); stage.hideRecord(true);
        const lift = { left: target.left - target.width * 0.05, top: target.top - target.height * 0.12, width: target.width * 1.1, height: target.height * 1.1 };
        await run.anim(free, [T.px(target), T.px(lift)], 800);
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        const holder = el('div', { class: 'tr-holder' }); run.ov.append(holder, free);            // the disc stays in front of the case
        const lb = document.getElementById('btnLibrary'), b = lb ? lb.getBoundingClientRect() : { left: vw - 200, top: 0, width: 80, height: 30 };
        let away;
        if (small) {
          const sl = T.sleeve(album, H); sl.disc.append(cv); holder.append(sl.box); sl.disc.style.visibility = 'hidden'; sl.disc.style.transform = 'translateY(-96%)';
          const at = (x, y, s, r = '') => `translate(${x - H / 2}px,${y - H / 2}px) scale(${s}) ${r}`, cy = vh / 2 + H * 0.45, tilt = 'rotateX(14deg)';
          holder.style.transform = at(vw / 2, cy, 1, tilt); const slot = sl.disc.getBoundingClientRect();
          run.anim(holder, [{ transform: at(vw / 2, vh + H, 0.85, tilt), opacity: 0 }, { transform: at(vw / 2, cy, 1, tilt), opacity: 1 }], 1400);
          await run.anim(free, [T.px(lift), T.px(slot)], 1400);
          sl.disc.style.visibility = ''; free.remove();
          await run.anim(sl.disc, [{ transform: 'translateY(-96%)' }, { transform: 'translateY(0)' }], 1800, 'cubic-bezier(.5,0,.3,1)');
          away = [{ transform: at(vw / 2, cy, 1, tilt), opacity: 1 }, { transform: at(vw / 2, vh * 0.45, 0.8), opacity: 1, offset: 0.45 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05), opacity: 0.2 }];
        } else {
          const jc = await T.jewel(album, H), W = jc.W; T.thickDisc(jc.disc, cv); holder.append(jc.box); jc.disc.style.visibility = 'hidden';
          const tilt = 'rotateX(32deg) rotateY(-6deg)', at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - H / 2}px) scale(${s}) ${r}`;
          const open = `translateZ(${jc.th}px) rotateY(-180deg)`, shut = `translateZ(${jc.th}px) rotateY(0deg)`;
          // the case comes up, already open, under the disc
          holder.style.transform = at(vw / 2 + W / 2, vh / 2, 1, tilt); jc.lid.style.transform = open;
          jc.disc.style.transform = `translateZ(${jc.hz}px)`; const high = jc.disc.getBoundingClientRect(); jc.disc.style.transform = 'translateZ(3px)';
          run.anim(jc.lid, [{ transform: shut }, { transform: shut, offset: 0.35 }, { transform: open }], 1500);
          run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh * 0.9, 0.85, tilt), opacity: 0 }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1 }], 1200);
          // the disc is carried over the open case (tipping to the case's angle), then lowered straight down onto the hub
          await run.anim(free, [T.px(lift), { ...T.px(high), offset: 0.85 }, T.px(high)], 1500);
          jc.disc.style.transform = `translateZ(${jc.hz}px)`; jc.disc.style.visibility = ''; free.remove();
          await run.anim(jc.disc, [{ transform: `translateZ(${jc.hz}px)` }, { transform: 'translateZ(3px)' }], 900, 'cubic-bezier(.3,0,.25,1)');
          jc.disc.style.transform = 'translateZ(3px)';
          await run.wait(200);
          run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh / 2, 1, tilt) }, { transform: at(vw / 2, vh / 2, 1, tilt) }], 1400);
          await run.anim(jc.lid, [{ transform: open }, { transform: shut }], 1400);
          await run.wait(250);
          away = [{ transform: at(vw / 2, vh / 2, 1, tilt), opacity: 1 }, { transform: at(vw / 2, vh * 0.42, 0.8), opacity: 1, offset: 0.45 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05), opacity: 0.2 }];
        }
        run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 1300, 'ease');
        await run.anim(holder, away, 1700, 'cubic-bezier(.5,0,.5,1)');
        if (lb) lb.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500 });
      } finally { run.end(); }
    },
    // ---- cassette: Norelco case. The cassette sits in a clear pocket hinged at the bottom; the J-card stays in the back ------------
    // case 109 x 70 x 17 mm, cassette 100.4 x 63.8 x 12 mm (art 1600 x 1020)
    // case / tape sizes in mm (case modelled lying on its side: W = long side). Microcassette: case 2 3/16 x 1 1/2 x 1/2 in, tape 2 x 1 5/16 x 5/16 in
    SPEC: {
      cassette: { W: 109, H: 70, D: 17, dd: 12.5, tw: 100.4, ar: 1600 / 1020, tt: 12, face: (a, s) => S.cassetteFace(a, s), edge: a => S.cassetteEdge(a) },
      md: { W: 79.4, H: 71.4, D: 7.9, dd: 5.6, tw: 71.4, ar: 71.4 / 68.3, tt: 4.8, turned: true, face: (a, s, w, h, back) => T.mdFace(a, s, w, h, back), edge: a => T.mdEdge(a) },
      micro: { W: 55.6, H: 38.1, D: 12.7, dd: 9, tw: 50.8, ar: 1461 / 959, tt: 7.9, noEdges: true, face: (a, s) => S.microFace(a, s), edge: a => S.microEdge(a) },
      // DAT: a small clamshell case about 81 x 60 x 14 mm (portrait J-card cover 638 x 860), tape 73 x 54 x 10.5 mm
      dat: { W: 81, H: 60, D: 14, dd: 11.5, tw: 73, ar: 73 / 54, tt: 10.5, turned: true, face: (a, s) => S.datTapeFace(a, s), edge: a => S.colorOf(S.DAT_COLORS, (a && a.color) || 'black').hex }
    },
    spec() { return T.SPEC[S.app.mode] || T.SPEC.cassette; },
    async tapeCase(album, Hc, small) {
      const P = T.spec(), mm = Hc / P.H, Wc = P.W * mm, D = P.D * mm, dd = P.dd * mm, cw = P.tw * mm, ch = cw / P.ar, ct = P.tt * mm;
      const side = S.sidesOf(album.tracks)[0] || 'A', other = S.partnerSide(side);
      const wall = (side_, z0, d, cls = '', w = Wc, h = Hc) => {
        const n = el('div', { class: 'tr-wall ' + cls }), v = side_ === 't' || side_ === 'b';
        n.style.cssText = v ? `left:0;width:${w}px;height:${d}px;top:${side_ === 't' ? 0 : h}px;margin-top:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateX(${side_ === 't' ? 90 : -90}deg)`
                            : `top:0;height:${h}px;width:${d}px;left:${side_ === 'l' ? 0 : w}px;margin-left:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateY(${side_ === 'l' ? -90 : 90}deg)`;
        return n;
      };
      // The case is modelled lying on its side (hinge along the bottom) and turned a quarter turn to stand upright (portrait) on screen,
      // so every picture on it is drawn a quarter turn back. J-card: cover on the front, spine on the hinge edge, back flap on the back.
      const turn = (src, cw_) => { const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, c = S.newCanvas(h, w), x = c.getContext('2d'); x.translate(cw_ ? h : 0, cw_ ? 0 : w); x.rotate((cw_ ? 1 : -1) * Math.PI / 2); x.drawImage(src, 0, 0); return c; };
      const parts = await S.tapeJcardParts(album, small);
      let coverSrc = parts && parts.cover;
      if (!coverSrc) coverSrc = album.front ? await S.loadImage(album.front) : null;
      if (!coverSrc) coverSrc = S.generic.cover(album.title, album.artist, 500);
      const jside = el('div', { class: 'tr-tface jcard' }); jside.append(turn(coverSrc, false), el('div', { class: 'tr-sheen' }));
      jside.style.transform = `translateZ(${-D / 2}px) rotateY(180deg)`;
      const inner = el('div', { class: 'tr-tface paper' }); inner.style.transform = `translateZ(${-D / 2 + 1}px)`;
      const spineWall = wall('b', -D / 2, D, 'spine');
      if (parts && parts.spine) { const sc = turn(parts.spine, true); sc.className = 'tr-spineart'; spineWall.append(sc); }
      const body = el('div', { class: 'tr-tbody' }, jside, inner, wall('l', -D / 2, D - dd, 'clear'), wall('r', -D / 2, D - dd, 'clear'), wall('t', -D / 2, D - dd, 'clear'), spineWall);
      // the pocket that tips out, holding the cassette
      const tape = el('div', { class: 'tr-ctape' }), faceA = el('div', { class: 'tr-cside a' }), faceB = el('div', { class: 'tr-cside b' });
      faceA.append(await P.face(album, side, cw, ch, false)); faceB.append(await P.face(album, P.turned ? side : other, cw, ch, P.turned));
      const edge = P.edge(album), te = k => { const w = wall(k, -ct / 2, ct, 'tape', cw, ch); w.style.background = edge; return w; };
      // (the microcassette shell has rounded corners and notches, so square edge walls would show as a box around it - it gets none, like in the deck)
      tape.append(faceB, ...(P.noEdges ? [] : [te('l'), te('r'), te('t'), te('b')]), faceA);
      faceA.style.transform = `translateZ(${ct / 2}px)`; faceB.style.transform = `translateZ(${-ct / 2}px) rotateY(180deg)`;
      Object.assign(tape.style, { width: cw + 'px', height: ch + 'px', left: (Wc - cw) / 2 + 'px', top: (Hc - ch) / 2 + 'px' });
      // the tape stays in the case (under the back flap) when the pocket tips open, then slides out from under the flap
      const rest = `translateY(0px) translateZ(${D / 2 - dd / 2}px)`, slid = `translateY(${-ch * 0.55}px) translateZ(${D / 2 - dd / 2}px)`; tape.style.transform = rest;
      const front = el('div', { class: 'tr-tface clearfront' }, el('div', { class: 'tr-sheen' }));
      // the back flap stays with the J-card (it does not tip out with the pocket; the tape slides out from under it):
      // a strip along the spine edge just inside the clear back, or the whole back for a full-back J-card
      let flapEl = null;
      if (parts && parts.flap) {
        const f = Math.min(1, parts.flapFrac), fc = turn(parts.flap, true); flapEl = el('div', { class: 'tr-flap' }); flapEl.style.height = f * Hc + 'px'; flapEl.style.width = Wc + 'px';
        flapEl.append(fc); flapEl.style.transform = `translateZ(${D / 2 - 1}px)`; body.append(flapEl);
      }
      const door = el('div', { class: 'tr-door' }, wall('l', -dd, dd, 'clear'), wall('r', -dd, dd, 'clear'), wall('t', -dd, dd, 'clear'), front);
      door.style.transform = `translateZ(${D / 2}px) rotateX(0deg)`;
      const box = el('div', { class: 'tr-tcase' }, body, door); box.style.width = Wc + 'px'; box.style.height = Hc + 'px';
      box.style.transform = 'rotateZ(-90deg)';                                                                  // stand it upright
      // poses of the cassette, in the pocket's own space: resting in it, and lifted out standing up facing you (pocket open)
      const lifted = `translateY(${-ch * 0.9}px) translateZ(${D / 2 + 10 * mm}px)`;
      body.append(tape);
      return { box, door, tape, Wc, Hc, D, rest, slid, lifted, side, doorAt: a => `translateZ(${D / 2}px) rotateX(${a}deg)` };
    },
    TT: 'rotateX(22deg)',
    async tapeEl(album, side) { const d = el('div', { class: 'tr-tape' }); d.append(await T.spec().face(album, side)); return d; },

    async tapeOut(album, from, load) {
      const run = T.begin(0.52), small = S.app.mode === 'cassette' && S.releaseInfo(album, 'cassette').type === 'single';
      try {
        const vw = innerWidth, vh = innerHeight, P = T.spec(), Hc = Math.min(vh * 0.4, vw * 0.4 * P.H / P.W) * (small ? 0.92 : 1);
        const tc = await T.tapeCase(album, Hc, small), W = tc.Wc;
        const holder = el('div', { class: 'tr-holder' }); holder.append(tc.box); run.ov.append(holder);
        const at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - Hc / 2}px) scale(${s}) ${r}`;
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2, cx = vw / 2, cy = vh * 0.56;
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        // the case comes forward showing its J-card, then is turned over to the side with the cassette in it
        await run.anim(holder, [{ transform: at(fx, fy, from.height / Hc, 'rotateY(180deg)') }, { transform: at(cx, cy, 1, 'rotateX(10deg) rotateY(180deg)'), offset: 0.55 }, { transform: at(cx, cy, 1, T.TT) }], 2000);
        // picked up and turned on its side (like holding it to open it), then the pocket tips open towards you on its hinge
        await run.anim(tc.box, [{ transform: 'rotateZ(-90deg)' }, { transform: 'rotateZ(0deg)' }], 900, 'cubic-bezier(.4,0,.2,1)');
        tc.box.style.transform = 'rotateZ(0deg)';
        await run.wait(100);
        await run.anim(tc.door, [{ transform: tc.doorAt(0) }, { transform: tc.doorAt(-82) }], 1200, 'cubic-bezier(.4,0,.2,1)');
        // the cassette is lifted out, standing up
        await run.anim(tc.tape, [{ transform: tc.rest }, { transform: tc.slid, offset: 0.55 }, { transform: tc.lifted }], 1300, 'cubic-bezier(.35,0,.25,1)');
        tc.tape.style.transform = tc.lifted;
        const rr = tc.tape.getBoundingClientRect(), free = await T.tapeEl(album, tc.side); T.place(free, rr); run.ov.append(free); tc.tape.style.visibility = 'hidden';
        // the case closes and drops away while the tape floats up
        run.anim(tc.door, [{ transform: tc.doorAt(-82) }, { transform: tc.doorAt(0) }], 1000);
        run.anim(holder, [{ transform: at(cx, cy, 1, T.TT), opacity: 1 }, { transform: at(cx, cy, 1, T.TT), opacity: 1, offset: 0.5 }, { transform: at(cx, vh * 0.95, 0.85, T.TT), opacity: 0 }], 1600, 'cubic-bezier(.5,0,.6,1)');
        const up = { left: vw / 2 - rr.width / 2, top: Math.max(12, vh * 0.08), width: rr.width, height: rr.width / P.ar };
        if (S.app.stage) S.app.stage.quiet = true;                // a deck with its own loading animation leaves it to us
        const loaded = load();
        await run.anim(free, [T.px(rr), T.px(up)], 1300);
        await loaded;
        const stage = S.app.stage;
        if (stage && stage.prepArrive) { stage.hideRecord(true); await stage.prepArrive(); }
        const target = stage && stage.recordRect && stage.recordRect();
        if (target && target.width) {
          stage.hideRecord(true);
          run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 900, 'ease');
          const mid = { left: target.left - target.width * 0.05, top: target.top - target.height * 0.25, width: target.width * 1.1, height: target.height * 1.1 };
          await run.anim(free, [T.px(up), { ...T.px(mid), offset: 0.7 }, T.px(target)], 1500);
          stage.hideRecord(false); free.remove();
          if (stage.finishArrive) await stage.finishArrive();
        }
      } finally { run.end(); }
    },

    async tapeBack(album) {
      const stage = S.app.stage; if (!stage || !stage.recordRect) return;
      if (stage.prepTake) await stage.prepTake();
      const target = stage.recordRect(); if (!target || !target.width) return;
      const run = T.begin(0.48), small = S.app.mode === 'cassette' && S.releaseInfo(album, 'cassette').type === 'single';
      try {
        const vw = innerWidth, vh = innerHeight, P = T.spec(), Hc = Math.min(vh * 0.4, vw * 0.4 * P.H / P.W) * (small ? 0.92 : 1);
        const tc = await T.tapeCase(album, Hc, small), W = tc.Wc;
        const free = await T.tapeEl(album, tc.side); T.place(free, target); run.ov.append(free); stage.hideRecord(true);
        if (stage.finishTake) stage.finishTake();
        const lift = { left: target.left - target.width * 0.05, top: target.top - target.height * 0.3, width: target.width * 1.1, height: target.height * 1.1 };
        await run.anim(free, [T.px(target), T.px(lift)], 800);
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        const holder = el('div', { class: 'tr-holder' }); holder.append(tc.box); run.ov.append(holder, free);
        const at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - Hc / 2}px) scale(${s}) ${r}`, cx = vw / 2, cy = vh * 0.56;
        // the open case comes up under the tape
        holder.style.transform = at(cx, cy, 1, T.TT); tc.box.style.transform = 'rotateZ(0deg)'; tc.door.style.transform = tc.doorAt(-82); tc.tape.style.transform = tc.lifted;
        const high = tc.tape.getBoundingClientRect(); tc.tape.style.visibility = 'hidden';
        run.anim(tc.door, [{ transform: tc.doorAt(0) }, { transform: tc.doorAt(0), offset: 0.35 }, { transform: tc.doorAt(-82) }], 1500);
        run.anim(holder, [{ transform: at(cx, vh * 0.95, 0.85, T.TT), opacity: 0 }, { transform: at(cx, cy, 1, T.TT), opacity: 1 }], 1200);
        await run.anim(free, [T.px(lift), { ...T.px(high), offset: 0.85 }, T.px(high)], 1500);
        tc.tape.style.visibility = ''; free.remove();
        // lowered back into the pocket, the pocket closes, the case is turned back to its J-card and goes back on the shelf
        await run.anim(tc.tape, [{ transform: tc.lifted }, { transform: tc.slid, offset: 0.45 }, { transform: tc.rest }], 1300, 'cubic-bezier(.35,0,.25,1)');
        tc.tape.style.transform = tc.rest;
        await run.anim(tc.door, [{ transform: tc.doorAt(-82) }, { transform: tc.doorAt(0) }], 1000, 'cubic-bezier(.4,0,.2,1)');
        await run.anim(tc.box, [{ transform: 'rotateZ(0deg)' }, { transform: 'rotateZ(-90deg)' }], 800, 'cubic-bezier(.4,0,.2,1)');
        tc.box.style.transform = 'rotateZ(-90deg)';
        await run.anim(holder, [{ transform: at(cx, cy, 1, T.TT) }, { transform: at(cx, cy, 1, 'rotateX(8deg) rotateY(180deg)') }], 1100);
        const lb = document.getElementById('btnLibrary'), b = lb ? lb.getBoundingClientRect() : { left: vw - 200, top: 0, width: 80, height: 30 };
        run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 1300, 'ease');
        await run.anim(holder, [{ transform: at(cx, cy, 1, 'rotateX(8deg) rotateY(180deg)'), opacity: 1 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05, 'rotateY(180deg)'), opacity: 0.2 }], 1500, 'cubic-bezier(.5,0,.5,1)');
        if (lb) lb.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500 });
      } finally { run.end(); }
    },
    // ---- reel to reel: square card box (7" reel), lid hinged on the left that opens to the left; the reel lies in the right half ----
    // box 7.5 in square, 0.85 in deep (same as the shelf). The lid is a full-depth cover: its flaps fold down over the top, right and
    // bottom of the tray; the spine is the tray's left (hinge) side. Reel 7 in (178 mm) across, about 9 mm thick.
    async reelBox(album, H) {
      const mm = H / 190.5, W = H, th = 21.6 * mm, ins = 1.6 * mm;
      const wall = (side, z0, d, cls = '', w = W, h = H) => {
        const n = el('div', { class: 'tr-wall ' + cls }), v = side === 't' || side === 'b';
        n.style.cssText = v ? `left:0;width:${w}px;height:${d}px;top:${side === 't' ? 0 : h}px;margin-top:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateX(${side === 't' ? 90 : -90}deg)`
                            : `top:0;height:${h}px;width:${d}px;left:${side === 'l' ? 0 : w}px;margin-left:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateY(${side === 'l' ? -90 : 90}deg)`;
        return n;
      };
      const imgFace = (src, cls) => { const d = el('div', { class: 'tr-bface ' + cls }); if (src) d.style.backgroundImage = `url("${S.fileUrl(src)}")`; else d.append(S.generic.cover(album.title, album.artist, 600)); return d; };
      // lid: the printed top plus three flaps hanging down (full depth); hinged on the left at the top of the spine
      const lidF = imgFace(album.front, 'front'), lidB = el('div', { class: 'tr-bface card' });
      lidB.style.transform = 'rotateY(180deg)';
      const flap = k => { const n = wall(k, -th, th, 'boxedge flap'); return n; };
      const lid = el('div', { class: 'tr-lid' }, lidB, flap('r'), flap('t'), flap('b'), lidF);
      lid.style.transform = `translateZ(${th}px)`;
      // tray: slightly smaller so the lid's flaps close over it; the spine runs the full height on the hinge side
      const spine = wall('l', 0, th, 'boxedge spine'); if (album.spine) spine.style.backgroundImage = `url("${S.fileUrl(album.spine)}")`;
      const tray = el('div', { class: 'tr-tray' }, wall('r', 0, th - mm, 'boxedge', W - 2 * ins, H - 2 * ins), wall('t', 0, th - mm, 'boxedge', W - 2 * ins, H - 2 * ins), wall('b', 0, th - mm, 'boxedge', W - 2 * ins, H - 2 * ins));
      Object.assign(tray.style, { left: ins + 'px', top: ins + 'px', width: W - 2 * ins + 'px', height: H - 2 * ins + 'px' });
      const base = el('div', { class: 'tr-cbase' }, el('div', { class: 'tr-bface card' }), spine, tray);
      const disc = el('div', { class: 'tr-cdisc' }), d = 178 * mm;
      Object.assign(disc.style, { width: d + 'px', height: d + 'px', left: (W - d) / 2 + 'px', top: (H - d) / 2 + 'px', transform: 'translateZ(1px)' });
      disc.dataset.mm = mm;
      const box = el('div', { class: 'tr-case' }, base, disc, lid); box.style.width = W + 'px'; box.style.height = H + 'px';
      return { box, lid, disc, W, H, th, hz: 70 * mm, open: `translateZ(${th}px) rotateY(-180deg)`, shut: `translateZ(${th}px) rotateY(0deg)` };
    },
    reelSize() { return Math.min(innerHeight * 0.56, innerWidth * 0.3); },
    async reelOut(album, from, load) {
      const run = T.begin(0.55);
      try {
        const side = S.sidesOf(album.tracks)[0] || 'A', cv = await S.reelFace(album, side);
        const vw = innerWidth, vh = innerHeight, H = T.reelSize();
        const jc = await T.reelBox(album, H), W = jc.W; T.thickDisc(jc.disc, cv, 9);
        const holder = el('div', { class: 'tr-holder' }); holder.append(jc.box); run.ov.append(holder);
        const tilt = 'rotateX(36deg) rotateY(-10deg)', at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - H / 2}px) scale(${s}) ${r}`;
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        await run.anim(holder, [{ transform: at(fx, fy, from.width / W) }, { transform: at(vw / 2, vh / 2, 1, tilt) }], 1400);
        await run.wait(200);
        // the box slides right while the lid opens to the left
        run.anim(holder, [{ transform: at(vw / 2, vh / 2, 1, tilt) }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt) }], 1500);
        await run.anim(jc.lid, [{ transform: jc.shut }, { transform: jc.open }], 1500);
        await run.wait(200);
        // the reel is lifted straight up out of the box, then carried away while the box closes
        await run.anim(jc.disc, [{ transform: 'translateZ(1px)' }, { transform: `translateZ(${jc.hz}px)` }], 800, 'cubic-bezier(.3,0,.3,1)');
        jc.disc.style.transform = `translateZ(${jc.hz}px)`;
        const rr = jc.disc.getBoundingClientRect(), free = T.discEl(cv); T.place(free, rr); run.ov.append(free); jc.disc.style.visibility = 'hidden';
        run.anim(jc.lid, [{ transform: jc.open }, { transform: jc.shut }], 1300);
        run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1 }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1, offset: 0.55 }, { transform: at(vw / 2 + W / 2, vh * 0.9, 0.85, tilt), opacity: 0 }], 1700, 'cubic-bezier(.5,0,.6,1)');
        const r0 = free.getBoundingClientRect(), rs = r0.width, up = { left: vw / 2 - rs / 2, top: Math.max(12, vh * 0.06), width: rs, height: rs };
        if (S.app.stage) S.app.stage.quiet = true;
        const loaded = load();
        await run.anim(free, [T.px(r0), T.px(up)], 1300);
        await loaded;
        const stage = S.app.stage, target = stage && stage.recordRect && stage.recordRect();
        if (target && target.width) {
          stage.hideRecord(true);
          run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 900, 'ease');
          const mid = { left: target.left - target.width * 0.05, top: target.top - target.height * 0.12, width: target.width * 1.1, height: target.height * 1.1 };
          const rot = getComputedStyle(stage.recordCanvas()).transform;                  // turn to how the reel sits on the spindle
          if (rot && rot !== 'none') run.anim(free.firstChild, [{ transform: 'none' }, { transform: rot }], 1600);
          await run.anim(free, [T.px(up), { ...T.px(mid), offset: 0.72 }, T.px(target)], 1600);
          stage.hideRecord(false); free.remove();
          if (stage.finishArrive) await stage.finishArrive();
        }
      } finally { run.end(); }
    },
    async reelBack(album) {
      const stage = S.app.stage; if (!stage || !stage.recordRect) return;
      if (stage.prepTake) await stage.prepTake();
      const target = stage.recordRect(); if (!target || !target.width) return;
      const run = T.begin(0.5);
      try {
        const src = stage.recordCanvas(), cv = T.copyOf(src);
        const vw = innerWidth, vh = innerHeight, H = T.reelSize();
        const free = el('div', { class: 'tr-free disc' }), fc = T.copyOf(src); fc.style.transform = getComputedStyle(src).transform; free.append(fc);
        T.place(free, target); run.ov.append(free); stage.hideRecord(true); if (stage.finishTake) stage.finishTake();
        const lift = { left: target.left - target.width * 0.05, top: target.top - target.height * 0.12, width: target.width * 1.1, height: target.height * 1.1 };
        await run.anim(free, [T.px(target), T.px(lift)], 800);
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        const jc = await T.reelBox(album, H), W = jc.W; T.thickDisc(jc.disc, cv, 9); jc.disc.style.visibility = 'hidden';
        const holder = el('div', { class: 'tr-holder' }); holder.append(jc.box); run.ov.append(holder, free);
        const tilt = 'rotateX(36deg) rotateY(-10deg)', at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - H / 2}px) scale(${s}) ${r}`;
        holder.style.transform = at(vw / 2 + W / 2, vh / 2, 1, tilt); jc.lid.style.transform = jc.open;
        jc.disc.style.transform = `translateZ(${jc.hz}px)`; const high = jc.disc.getBoundingClientRect(); jc.disc.style.transform = 'translateZ(1px)';
        run.anim(jc.lid, [{ transform: jc.shut }, { transform: jc.shut, offset: 0.35 }, { transform: jc.open }], 1500);
        run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh * 0.9, 0.85, tilt), opacity: 0 }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1 }], 1200);
        await run.anim(free, [T.px(lift), { ...T.px(high), offset: 0.85 }, T.px(high)], 1500);
        jc.disc.style.transform = `translateZ(${jc.hz}px)`; jc.disc.style.visibility = ''; free.remove();
        await run.anim(jc.disc, [{ transform: `translateZ(${jc.hz}px)` }, { transform: 'translateZ(1px)' }], 900, 'cubic-bezier(.3,0,.25,1)');
        jc.disc.style.transform = 'translateZ(1px)';
        run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh / 2, 1, tilt) }, { transform: at(vw / 2, vh / 2, 1, tilt) }], 1400);
        await run.anim(jc.lid, [{ transform: jc.open }, { transform: jc.shut }], 1400);
        await run.wait(200);
        const lb = document.getElementById('btnLibrary'), b = lb ? lb.getBoundingClientRect() : { left: vw - 200, top: 0, width: 80, height: 30 };
        run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 1300, 'ease');
        await run.anim(holder, [{ transform: at(vw / 2, vh / 2, 1, tilt), opacity: 1 }, { transform: at(vw / 2, vh * 0.42, 0.8), opacity: 1, offset: 0.45 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05), opacity: 0.2 }], 1700, 'cubic-bezier(.5,0,.5,1)');
        if (lb) lb.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500 });
      } finally { run.end(); }
    },
    // ---- MiniDisc ----------------------------------------------------------------------------------------------------------------
    // the disc is a live element (shell, slider, inner disc); 2 13/16 x 2 11/16 x 3/16 in
    MDW: 71.4, MDH: 68.3, MDT: 4.8,
    mdEdge(a) { const d = S.releaseInfo(a, 'md').disc; return d === 'standard' ? '#cfd8e0aa' : d === 'led' ? '#2a2c30' : '#151618'; },
    async mdDisc(album, side, back) { return (await S.mdBuildDisc(album, side || S.sidesOf(album.tracks)[0] || 'A', back)).el; },
    // a disc lying a quarter turn round (as it sits in a slim case that is on its side): w x h is the turned box
    async mdFace(album, side, w, h, back) {
      const box = el('div', { class: 'tr-mdface' }), d = await T.mdDisc(album, side, back);
      Object.assign(d.style, { position: 'absolute', inset: 0, transform: back ? 'none' : 'rotate(180deg)' });     // upside down in the case
      box.append(d); return box;
    },
    // a free disc on screen; turned: starts a quarter turn round (out of a slim case)
    async mdFree(album, side, rect, turned) {
      const f = el('div', { class: 'tr-free md' }), d = await T.mdDisc(album, side);
      Object.assign(d.style, { position: 'absolute', inset: 0, transform: turned ? 'rotate(180deg)' : 'none' }); f._turned = !!turned;
      f.append(d); f._d = d; T.place(f, rect); return f;
    },
    async straighten(run, f) {               // a disc that came out of a slim case upside down is turned upright (in its own plane)
      if (!f._turned) return; f._turned = false;
      await run.anim(f._d, [{ transform: 'rotate(180deg)' }, { transform: 'rotate(360deg)' }], 650);
      f._d.style.transform = 'none';
    },
    // hand the disc to the player: it goes to just below the player, lined up with the slot, and the player slides it in
    async mdHandIn(run, free) {
      const stage = S.app.stage, target = stage && stage.recordRect && stage.recordRect();
      if (!target || !target.width) return;
      // straight down to the bottom of the player while the room is still dimmed, then the lights come up as the player takes it in
      const r0 = free.getBoundingClientRect();
      await run.anim(free, [T.px(r0), T.px(target)], 1300);
      free.remove(); stage.hideRecord(false);
      run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 700, 'ease');
      await stage.finishArrive();
    },
    // retail case: like a CD jewel case (opens like a book, hinge on the left; the disc sits in the tray on the right)
    // 3 1/3 x 4 5/16 x 5/8 in
    async mdRetailCase(album, H) {
      const mm = H / 109.5, W = 84.7 * mm, th = 15.9 * mm, lt = 5 * mm;
      const wall = (side, z0, d, cls = '', w = W, h = H) => {
        const n = el('div', { class: 'tr-wall ' + cls }), v = side === 't' || side === 'b';
        n.style.cssText = v ? `left:0;width:${w}px;height:${d}px;top:${side === 't' ? 0 : h}px;margin-top:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateX(${side === 't' ? 90 : -90}deg)`
                            : `top:0;height:${h}px;width:${d}px;left:${side === 'l' ? 0 : w}px;margin-left:${-d / 2}px;transform:translateZ(${z0 + d / 2}px) rotateY(${side === 'l' ? -90 : 90}deg)`;
        return n;
      };
      const face = (cv, cls) => { const d = el('div', { class: 'tr-cface ' + cls }); d.append(cv); return d; };
      const front = (await S.mdCaseArt(album)) || S.generic.cover(album.title, album.artist, 600);
      // inside of the lid: the booklet seen from inside, through clear plastic
      const ins = S.newCanvas(600, Math.round(600 * 109.5 / 84.7)), ix = ins.getContext('2d');
      ix.fillStyle = 'rgba(225,232,240,.4)'; ix.beginPath(); ix.roundRect(0, 0, ins.width, ins.height, 10); ix.fill();
      const cov = album.front ? await S.loadImage(album.front) : null;
      ix.save(); ix.filter = 'brightness(.72) saturate(.85)'; S.drawCover(ix, cov || S.generic.cover(album.title, album.artist, 600), 10, 10, ins.width * 0.86, ins.height - 20); ix.restore();
      const lidF = face(front, 'front'), lidB = face(ins, 'back'); lidB.style.transform = `translateZ(${-lt}px) rotateY(180deg)`;
      const lid = el('div', { class: 'tr-lid' }, lidB, wall('l', -lt, lt, 'hinge'), wall('r', -lt, lt), wall('t', -lt, lt), wall('b', -lt, lt), lidF);
      lid.style.transform = `translateZ(${th}px)`;
      // the tray: black, ribbed hinge strip on the left, a moulded pocket the disc sits in
      const tc = S.newCanvas(600, Math.round(600 * 109.5 / 84.7)), x = tc.getContext('2d'), TW = tc.width, TH = tc.height;
      x.fillStyle = 'rgba(225,232,240,.35)'; x.beginPath(); x.roundRect(0, 0, TW, TH, 10); x.fill();
      x.fillStyle = '#25272a'; x.beginPath(); x.roundRect(8, 8, TW - 16, TH - 16, 6); x.fill();
      x.fillStyle = '#1b1d1f'; x.fillRect(8, 8, TW * 0.1, TH - 16); x.strokeStyle = '#ffffff12'; x.lineWidth = 2; for (let i = 14; i < TW * 0.1; i += 7) { x.beginPath(); x.moveTo(i, 12); x.lineTo(i, TH - 12); x.stroke(); }
      const dw = 71.4 / 84.7 * TW, dh = 68.3 / 109.5 * TH, dx = TW * 0.555 - dw / 2, dy = TH / 2 - dh / 2;
      x.fillStyle = '#141517'; x.beginPath(); x.roundRect(dx - 6, dy - 6, dw + 12, dh + 12, 8); x.fill(); x.strokeStyle = '#3a3d41'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#2f3236'; for (const [cx, cy] of [[dx + dw * 0.5, dy - 4], [dx + dw * 0.5, dy + dh + 4]]) { x.beginPath(); x.roundRect(cx - 30, cy - 6, 60, 12, 4); x.fill(); }
      const base = el('div', { class: 'tr-cbase' }, face(tc, 'tray'), wall('l', 0, th - lt, 'hinge'), wall('r', 0, th - lt), wall('t', 0, th - lt), wall('b', 0, th - lt));
      const disc = el('div', { class: 'tr-cdisc md' }), DW = 71.4 * mm, DH = 68.3 * mm;
      Object.assign(disc.style, { width: DW + 'px', height: DH + 'px', left: dx / TW * W + 'px', top: dy / TH * H + 'px', transform: 'translateZ(1px)' });
      const box = el('div', { class: 'tr-case' }, base, disc, lid); box.style.width = W + 'px'; box.style.height = H + 'px';
      return { box, lid, disc, W, H, th, hz: 32 * mm, open: `translateZ(${th}px) rotateY(-180deg)`, shut: `translateZ(${th}px) rotateY(0deg)` };
    },
    mdSize() { return Math.min(innerHeight * 0.58, innerWidth * 0.36 * 109.5 / 84.7); },
    // a disc with its 3/16 in edge, for inside a case
    async mdThick(holder, album, side) {
      const d = await T.mdDisc(album, side), mm = holder.offsetWidth / 71.4 || parseFloat(holder.style.width) / 71.4, t = T.MDT * mm, col = T.mdEdge(album);
      holder.style.transformStyle = 'preserve-3d';
      const w = parseFloat(holder.style.width), h = parseFloat(holder.style.height);
      const wall = (side_) => { const n = el('div', { class: 'tr-wall' }), v = side_ === 't' || side_ === 'b'; n.style.background = col;
        n.style.cssText += v ? `;left:0;width:${w}px;height:${t}px;top:${side_ === 't' ? 0 : h}px;margin-top:${-t / 2}px;transform:translateZ(${t / 2}px) rotateX(${side_ === 't' ? 90 : -90}deg)` : `;top:0;height:${h}px;width:${t}px;left:${side_ === 'l' ? 0 : w}px;margin-left:${-t / 2}px;transform:translateZ(${t / 2}px) rotateY(${side_ === 'l' ? -90 : 90}deg)`; return n; };
      Object.assign(d.style, { position: 'absolute', inset: 0, transform: `translateZ(${t}px)` });
      holder.append(wall('l'), wall('r'), wall('t'), wall('b'), d);
    },
    async mdOut(album, from, load) {
      if (S.releaseInfo(album, 'md').case === 'small') return T.mdSlimOut(album, from, load);
      const run = T.begin(0.6);
      try {
        const side = S.sidesOf(album.tracks)[0] || 'A', vw = innerWidth, vh = innerHeight, H = T.mdSize();
        const jc = await T.mdRetailCase(album, H), W = jc.W; await T.mdThick(jc.disc, album, side);
        const holder = el('div', { class: 'tr-holder' }); holder.append(jc.box); run.ov.append(holder);
        const tilt = 'rotateX(32deg) rotateY(-6deg)', at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - H / 2}px) scale(${s}) ${r}`;
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        // the case comes forward, slides right while the lid swings open to the left on its hinge
        await run.anim(holder, [{ transform: at(fx, fy, from.width / W) }, { transform: at(vw / 2, vh / 2, 1, tilt) }], 1400);
        await run.wait(200);
        run.anim(holder, [{ transform: at(vw / 2, vh / 2, 1, tilt) }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt) }], 1500);
        await run.anim(jc.lid, [{ transform: jc.shut }, { transform: jc.open }], 1500);
        await run.wait(250);
        // the disc is lifted out of the tray, the case closes and drops away
        await run.anim(jc.disc, [{ transform: 'translateZ(1px)' }, { transform: `translateZ(${jc.hz}px)` }], 800, 'cubic-bezier(.3,0,.3,1)');
        jc.disc.style.transform = `translateZ(${jc.hz}px)`;
        const rr = jc.disc.getBoundingClientRect(), free = await T.mdFree(album, side, rr); run.ov.append(free); jc.disc.style.visibility = 'hidden';
        run.anim(jc.lid, [{ transform: jc.open }, { transform: jc.shut }], 1300);
        run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1 }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1, offset: 0.55 }, { transform: at(vw / 2 + W / 2, vh * 0.85, 0.85, tilt), opacity: 0 }], 1700, 'cubic-bezier(.5,0,.6,1)');
        if (S.app.stage) S.app.stage.quiet = true;
        await load();
        await T.mdHandIn(run, free);
      } finally { run.end(); }
    },
    async mdTakeOut(stage, album, side) {     // the player slides the disc out of the bottom; returns it as a free disc there
      await stage.prepTake();
      const target = stage.recordRect(), free = await T.mdFree(album, side, target);
      stage.finishTake(); return { free, target };
    },
    async mdBack(album) {
      const stage = S.app.stage; if (!stage || !stage.recordRect) return;
      if (S.releaseInfo(album, 'md').case === 'small') return T.mdSlimBack(album);
      const side = stage.currentSide ? stage.currentSide() : 'A';
      const { free, target } = await T.mdTakeOut(stage, album, side);
      const run = T.begin(0.54);
      try {
        run.ov.append(free);
        const vw = innerWidth, vh = innerHeight, H = T.mdSize();
        const lift = { left: target.left, top: target.top - target.height * 0.6, width: target.width, height: target.height };
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        await run.anim(free, [T.px(target), T.px(lift)], 800);
        const jc = await T.mdRetailCase(album, H), W = jc.W; await T.mdThick(jc.disc, album, side); jc.disc.style.visibility = 'hidden';
        const holder = el('div', { class: 'tr-holder' }); holder.append(jc.box); run.ov.append(holder, free);
        const tilt = 'rotateX(32deg) rotateY(-6deg)', at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - H / 2}px) scale(${s}) ${r}`;
        holder.style.transform = at(vw / 2 + W / 2, vh / 2, 1, tilt); jc.lid.style.transform = jc.open;
        jc.disc.style.transform = `translateZ(${jc.hz}px)`; const high = jc.disc.getBoundingClientRect(); jc.disc.style.transform = 'translateZ(1px)';
        run.anim(jc.lid, [{ transform: jc.shut }, { transform: jc.shut, offset: 0.35 }, { transform: jc.open }], 1500);
        run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh * 0.9, 0.85, tilt), opacity: 0 }, { transform: at(vw / 2 + W / 2, vh / 2, 1, tilt), opacity: 1 }], 1200);
        await run.anim(free, [T.px(lift), { ...T.px(high), offset: 0.85 }, T.px(high)], 1500);
        jc.disc.style.transform = `translateZ(${jc.hz}px)`; jc.disc.style.visibility = ''; free.remove();
        await run.anim(jc.disc, [{ transform: `translateZ(${jc.hz}px)` }, { transform: 'translateZ(1px)' }], 900, 'cubic-bezier(.3,0,.25,1)');
        jc.disc.style.transform = 'translateZ(1px)';
        await run.wait(200);
        run.anim(holder, [{ transform: at(vw / 2 + W / 2, vh / 2, 1, tilt) }, { transform: at(vw / 2, vh / 2, 1, tilt) }], 1400);
        await run.anim(jc.lid, [{ transform: jc.open }, { transform: jc.shut }], 1400);
        await run.wait(250);
        const lb = document.getElementById('btnLibrary'), b = lb ? lb.getBoundingClientRect() : { left: vw - 200, top: 0, width: 80, height: 30 };
        run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 1300, 'ease');
        await run.anim(holder, [{ transform: at(vw / 2, vh / 2, 1, tilt), opacity: 1 }, { transform: at(vw / 2, vh * 0.42, 0.8), opacity: 1, offset: 0.45 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05), opacity: 0.2 }], 1700, 'cubic-bezier(.5,0,.5,1)');
        if (lb) lb.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500 });
      } finally { run.end(); }
    },
    // slim case: works like the cassette case (J-card wrapped round it, the clear pocket tips open, the disc slides out)
    async mdSlimOut(album, from, load) {
      const run = T.begin(0.52);
      try {
        const vw = innerWidth, vh = innerHeight, P = T.SPEC.md, Hc = Math.min(vh * 0.42, vw * 0.4 * P.H / P.W);
        const tc = await T.tapeCase(album, Hc, false), W = tc.Wc;
        const holder = el('div', { class: 'tr-holder' }); holder.append(tc.box); run.ov.append(holder);
        const at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - Hc / 2}px) scale(${s}) ${r}`;
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2, cx = vw / 2, cy = vh * 0.56;
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        await run.anim(holder, [{ transform: at(fx, fy, from.width / Hc, 'rotateY(180deg)') }, { transform: at(cx, cy, 1, 'rotateX(10deg) rotateY(180deg)'), offset: 0.55 }, { transform: at(cx, cy, 1, T.TT) }], 2000);
        await run.anim(tc.box, [{ transform: 'rotateZ(-90deg)' }, { transform: 'rotateZ(0deg)' }], 900, 'cubic-bezier(.4,0,.2,1)');
        tc.box.style.transform = 'rotateZ(0deg)';
        await run.wait(100);
        await run.anim(tc.door, [{ transform: tc.doorAt(0) }, { transform: tc.doorAt(-82) }], 1200, 'cubic-bezier(.4,0,.2,1)');
        await run.anim(tc.tape, [{ transform: tc.rest }, { transform: tc.slid, offset: 0.55 }, { transform: tc.lifted }], 1300, 'cubic-bezier(.35,0,.25,1)');
        tc.tape.style.transform = tc.lifted;
        const rr = tc.tape.getBoundingClientRect(), free = await T.mdFree(album, tc.side, rr, true); run.ov.append(free); tc.tape.style.visibility = 'hidden';
        run.anim(tc.door, [{ transform: tc.doorAt(-82) }, { transform: tc.doorAt(0) }], 1000);
        run.anim(holder, [{ transform: at(cx, cy, 1, T.TT), opacity: 1 }, { transform: at(cx, cy, 1, T.TT), opacity: 1, offset: 0.5 }, { transform: at(cx, vh * 0.95, 0.85, T.TT), opacity: 0 }], 1600, 'cubic-bezier(.5,0,.6,1)');
        if (S.app.stage) S.app.stage.quiet = true;
        const loaded = load();
        await T.straighten(run, free);
        await loaded;
        await T.mdHandIn(run, free);
      } finally { run.end(); }
    },
    async mdSlimBack(album) {
      const stage = S.app.stage, side = stage.currentSide ? stage.currentSide() : 'A';
      const { free, target } = await T.mdTakeOut(stage, album, side);
      const run = T.begin(0.48);
      try {
        run.ov.append(free);
        const vw = innerWidth, vh = innerHeight, P = T.SPEC.md, Hc = Math.min(vh * 0.42, vw * 0.4 * P.H / P.W);
        const lift = { left: target.left, top: target.top - target.height * 0.6, width: target.width, height: target.height };
        run.anim(run.shade, [{ opacity: 0 }, { opacity: 1 }], 900, 'ease');
        await run.anim(free, [T.px(target), T.px(lift)], 800);
        const tc = await T.tapeCase(album, Hc, false), W = tc.Wc;
        const holder = el('div', { class: 'tr-holder' }); holder.append(tc.box); run.ov.append(holder, free);
        const at = (x, y, s, r = '') => `translate(${x - W / 2}px,${y - Hc / 2}px) scale(${s}) ${r}`, cx = vw / 2, cy = vh * 0.56;
        holder.style.transform = at(cx, cy, 1, T.TT); tc.box.style.transform = 'rotateZ(0deg)'; tc.door.style.transform = tc.doorAt(-82); tc.tape.style.transform = tc.lifted;
        const high = tc.tape.getBoundingClientRect(); tc.tape.style.visibility = 'hidden';
        run.anim(tc.door, [{ transform: tc.doorAt(0) }, { transform: tc.doorAt(0), offset: 0.35 }, { transform: tc.doorAt(-82) }], 1500);
        run.anim(holder, [{ transform: at(cx, vh * 0.95, 0.85, T.TT), opacity: 0 }, { transform: at(cx, cy, 1, T.TT), opacity: 1 }], 1200);
        // carried over the open case and turned upside down to match how it lies in the case
        await run.anim(free, [T.px(lift), { ...T.px(high), offset: 0.8 }, T.px(high)], 1300);
        await run.anim(free._d, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }], 520);      // turned upside down, as it sits in the case
        free._d.style.transform = 'rotate(180deg)';
        tc.tape.style.visibility = ''; free.remove();
        await run.anim(tc.tape, [{ transform: tc.lifted }, { transform: tc.slid, offset: 0.45 }, { transform: tc.rest }], 1300, 'cubic-bezier(.35,0,.25,1)');
        tc.tape.style.transform = tc.rest;
        await run.anim(tc.door, [{ transform: tc.doorAt(-82) }, { transform: tc.doorAt(0) }], 1000, 'cubic-bezier(.4,0,.2,1)');
        await run.anim(tc.box, [{ transform: 'rotateZ(0deg)' }, { transform: 'rotateZ(-90deg)' }], 800, 'cubic-bezier(.4,0,.2,1)');
        tc.box.style.transform = 'rotateZ(-90deg)';
        await run.anim(holder, [{ transform: at(cx, cy, 1, T.TT) }, { transform: at(cx, cy, 1, 'rotateX(8deg) rotateY(180deg)') }], 1100);
        const lb = document.getElementById('btnLibrary'), b = lb ? lb.getBoundingClientRect() : { left: vw - 200, top: 0, width: 80, height: 30 };
        run.anim(run.shade, [{ opacity: 1 }, { opacity: 0 }], 1300, 'ease');
        await run.anim(holder, [{ transform: at(cx, cy, 1, 'rotateX(8deg) rotateY(180deg)'), opacity: 1 }, { transform: at(b.left + b.width / 2, b.top + b.height / 2, 0.05, 'rotateY(180deg)'), opacity: 0.2 }], 1500, 'cubic-bezier(.5,0,.5,1)');
        if (lb) lb.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500 });
      } finally { run.end(); }
    },
    cassetteOut(a, f, l) { return T.tapeOut(a, f, l); },
    microOut(a, f, l) { return T.tapeOut(a, f, l); },
    microBack(a) { return T.tapeBack(a); },
    cassetteBack(a) { return T.tapeBack(a); },
    datOut(a, f, l) { return T.tapeOut(a, f, l); },
    datBack(a) { return T.tapeBack(a); }
  };
  S.transit = T;
})();
