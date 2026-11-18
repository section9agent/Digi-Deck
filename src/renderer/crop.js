// Image adjuster used by every album-info editor: pan / zoom an image inside the slot's frame (or another aspect ratio),
// then render the result to a PNG data URL that the editor saves into the database slot.
(function (S) {
  const el = S.el;
  const ASPECTS = [['orig', 'Original'], ['1', 'Square 1:1'], ['1.4', 'Wide 7:5'], ['1.7778', 'Wide 16:9'], ['2.1563', 'Cassette label'], ['1.7035', 'Microcassette label'], ['1.0151', 'Microcassette J-card'], ['0.75', 'Portrait 3:4']];

  // Apply a saved {z,ox,oy} adjustment to a picture (same shape as the picture) - used by the shelf for J-card spine + cover.
  S.applyAdj = (im, adj) => {
    let a = adj; if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = null; } }
    if (!a || !im) return im;
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, z = +a.z || 1;
    const c = S.newCanvas(w, h), x = c.getContext('2d');
    x.translate(w / 2 + (+a.ox || 0) * w, h / 2 + (+a.oy || 0) * h); x.rotate((+a.rot || 0) * Math.PI / 180);
    x.drawImage(im, -w * z / 2, -h * z / 2, w * z, h * z);
    return c;
  };

  // src: path or URL of the image; opts.aspect: default aspect key/number. Resolves to a data URL, or null on cancel.
  S.cropImage = async (src, opts = {}) => {
    let data;
    try { data = await window.api.artData(src); } catch (e) { S.toast('Could not read that image: ' + e.message); return null; }
    const im = new Image();
    await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = data; }).catch(() => {});
    if (!im.naturalWidth) { S.toast('Could not load that image'); return null; }
    let mask = null;                                  // label guide: a tape label's real outline, or a disc (circle + spindle hole)
    if (opts.guide && opts.guide.mask) { mask = new Image(); await new Promise(r => { mask.onload = r; mask.onerror = r; mask.src = opts.guide.mask; }); if (!mask.naturalWidth) mask = null; }
    const gd = opts.guide && (opts.guide.circle || mask || opts.guide.jcard || opts.guide.tray) ? opts.guide : null;
    const iw = im.naturalWidth, ih = im.naturalHeight;
    return new Promise(done => {
      let key = String(opts.aspect || 'orig'), z = (opts.initial && +opts.initial.z) || 1, ox = (opts.initial && +opts.initial.ox) || 0, oy = (opts.initial && +opts.initial.oy) || 0, rot = (opts.initial && +opts.initial.rot) || 0;
      const hadInitial = !!opts.initial;
      const aspect = () => key === 'orig' ? iw / ih : +key;
      const cv = el('canvas', { class: 'crop-cv' });
      const zoom = el('input', { type: 'range', min: '0.25', max: '8', step: '0.01', value: String(z), oninput: e => { z = +e.target.value; draw(); } });
      const rotIn = el('input', { type: 'range', min: '-180', max: '180', step: '0.1', value: String(rot), oninput: e => { rot = +e.target.value; draw(); } });
      const sel = el('select', { onchange: e => { key = e.target.value; ox = oy = 0; layout(); fitGuide(); } }, ASPECTS.map(([k, n]) => el('option', { value: k }, n)));
      if (!ASPECTS.some(([k]) => k === key)) sel.append(el('option', { value: key }, 'Slot shape'));
      sel.value = key;
      let fw = 480, fh = 480;
      const layout = () => { const a = aspect(), mw = 600, mh = 420; fw = a >= mw / mh ? mw : Math.round(mh * a); fh = Math.round(fw / a); cv.width = fw; cv.height = fh; draw(); };
      const render = (ctx, w, h) => {
        const f = w / fw, s = Math.max(fw / iw, fh / ih) * z * f;
        ctx.save(); ctx.translate(w / 2 + ox * w, h / 2 + oy * h); ctx.rotate(rot * Math.PI / 180); ctx.drawImage(im, -iw * s / 2, -ih * s / 2, iw * s, ih * s); ctx.restore();
      };
      // the part of the frame that stays visible on the finished label: the guide's outline (labels) or the disc circle
      let maskBox = null;
      if (mask) { try { const c = S.newCanvas(mask.naturalWidth, mask.naturalHeight), x = c.getContext('2d'); x.drawImage(mask, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 > x0) maskBox = { x0: x0 / c.width, y0: y0 / c.height, x1: (x1 + 1) / c.width, y1: (y1 + 1) / c.height }; } catch {} }
      else if (gd && gd.circle) { const m = Math.min(1, gd.circle); maskBox = { circle: m }; }
      const fitGuide = () => {                       // zoom the picture onto the visible part of the guide and centre it there
        if (!maskBox || opts.params) return;
        let bw, bh, bx, by;
        if (maskBox.circle) { const m = Math.min(fw, fh) * maskBox.circle; bw = bh = m; bx = fw / 2; by = fh / 2; }
        else { bw = (maskBox.x1 - maskBox.x0) * fw; bh = (maskBox.y1 - maskBox.y0) * fh; bx = (maskBox.x0 + maskBox.x1) / 2 * fw; by = (maskBox.y0 + maskBox.y1) / 2 * fh; }
        const base = Math.max(fw / iw, fh / ih), need = Math.max(bw / iw, bh / ih);
        z = Math.max(0.25, Math.min(8, need / base)); rot = 0;
        ox = (bx - fw / 2) / fw - 0; oy = (by - fh / 2) / fh - 0; zoom.value = z; rotIn.value = 0; draw();
      };
      const guideOn = el('input', { type: 'checkbox', onchange: () => draw() }); guideOn.checked = true;
      const guide = c => {                            // dim everything that will not be visible on the finished label
        const g = S.newCanvas(fw, fh), x = g.getContext('2d');
        x.fillStyle = 'rgba(0,0,0,.68)'; x.fillRect(0, 0, fw, fh);
        x.globalCompositeOperation = 'destination-out';
        const cx = fw / 2, cy = fh / 2, m = Math.min(fw, fh) / 2;
        if (gd.jcard) {                                // J-card: the flap is not used on the shelf; spine and cover are outlined
          x.globalCompositeOperation = 'source-over';
          const cw = fw * gd.jcard.cover / (iw / ih), sw = fw * gd.jcard.spine / (iw / ih), fx = fw - cw - sw;
          x.clearRect(fx, 0, cw + sw, fh);
          x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1.5; x.strokeRect(fx + .75, .75, sw - 1.5, fh - 1.5); x.strokeRect(fx + sw + .75, .75, cw - 1.5, fh - 1.5);
          x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText('flap', fx / 2, 16); x.fillText('cover', fx + sw + cw / 2, 16);
          x.save(); x.translate(fx + sw / 2 + 4, fh / 2); x.rotate(-Math.PI / 2); x.fillText('spine', 0, 0); x.restore();
          c.drawImage(g, 0, 0); return;
        }
        if (gd.tray) {                                 // CD tray card: spine | back panel | spine - only the back panel is shown in the case, the two spines wrap onto the shelf
          x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, fw, fh);
          const sp = fw * gd.tray; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, sp, fh); x.fillRect(fw - sp, 0, sp, fh);
          x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1.5; x.strokeRect(.75, .75, sp - 1.5, fh - 1.5); x.strokeRect(sp + .75, .75, fw - sp * 2 - 1.5, fh - 1.5); x.strokeRect(fw - sp + .75, .75, sp - 1.5, fh - 1.5);
          x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText('back', fw / 2, 16);
          for (const sx of [sp / 2, fw - sp / 2]) { x.save(); x.translate(sx + 4, fh / 2); x.rotate(-Math.PI / 2); x.fillText('spine', 0, 0); x.restore(); }
          c.drawImage(g, 0, 0); return;
        }
        if (mask) x.drawImage(mask, 0, 0, fw, fh);
        else { x.beginPath(); x.arc(cx, cy, m * gd.circle, 0, Math.PI * 2); x.fill(); }
        x.globalCompositeOperation = 'source-over';
        if (!mask) {
          x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, m * gd.circle, 0, Math.PI * 2); x.stroke();
          if (gd.hub) { x.strokeStyle = 'rgba(255,255,255,.45)'; x.setLineDash([4, 4]); x.beginPath(); x.arc(cx, cy, m * gd.hub, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
          x.fillStyle = 'rgba(0,0,0,.85)'; x.beginPath(); x.arc(cx, cy, Math.max(2, m * gd.hole), 0, Math.PI * 2); x.fill();
          x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
        }
        c.drawImage(g, 0, 0);
      };
      const draw = () => {
        const c = cv.getContext('2d');
        c.clearRect(0, 0, fw, fh); render(c, fw, fh);
        if (gd && guideOn.checked) guide(c);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath();      // thirds guide
        for (let i = 1; i < 3; i++) { c.moveTo(fw * i / 3, 0); c.lineTo(fw * i / 3, fh); c.moveTo(0, fh * i / 3); c.lineTo(fw, fh * i / 3); } c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.strokeRect(.5, .5, fw - 1, fh - 1);
      };
      let drag = null;
      cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); };
      cv.onpointermove = e => { if (!drag) return; const r = cv.getBoundingClientRect(); ox = drag.ox + (e.clientX - drag.x) / r.width; oy = drag.oy + (e.clientY - drag.y) / r.height; draw(); };
      cv.onpointerup = () => { drag = null; };
      cv.onwheel = e => { e.preventDefault(); z = Math.max(0.25, Math.min(4, z * (e.deltaY < 0 ? 1.05 : 1 / 1.05))); zoom.value = z; draw(); };
      const nudge = (dx, dy) => { ox += dx / fw; oy += dy / fh; draw(); };
      const clampZ = v => Math.max(0.25, Math.min(8, v));
      const step = (kind, dir, big) => {
        if (kind === 'x') nudge(dir * (big ? 10 : 1), 0); else if (kind === 'y') nudge(0, dir * (big ? 10 : 1));
        else if (kind === 'z') { z = clampZ(z * (1 + dir * (big ? 0.05 : 0.005))); zoom.value = z; draw(); }
        else if (kind === 'r') { rot = Math.max(-180, Math.min(180, Math.round((rot + dir * (big ? 1 : 0.1)) * 10) / 10)); rotIn.value = rot; draw(); }
      };
      const hold = (label, kind, dir, tip) => {      // a nudge button: click for a small step, Shift-click for 10x, hold to repeat
        const b = el('button', { class: 'nb', title: tip + ' (Shift = bigger step)' }, label); let t = null, iv = null;
        const stop = () => { clearTimeout(t); clearInterval(iv); t = iv = null; };
        b.onpointerdown = e => { e.preventDefault(); const big = e.shiftKey; step(kind, dir, big); t = setTimeout(() => { iv = setInterval(() => step(kind, dir, big), 50); }, 380); };
        b.onpointerup = b.onpointerleave = b.onpointercancel = stop; return b;
      };
      const key_ = e => {
        const st = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') nudge(-st, 0); else if (e.key === 'ArrowRight') nudge(st, 0); else if (e.key === 'ArrowUp') nudge(0, -st); else if (e.key === 'ArrowDown') nudge(0, st);
        else if (e.key === 'Escape') return finish(null); else return;
        e.preventDefault(); e.stopPropagation();
      };
      const finish = v => { window.removeEventListener('keydown', key_, true); ov.remove(); done(v); };
      const apply = () => {
        if (opts.params) return finish({ z, ox, oy, rot });
        const a = aspect(), L = Math.min(2400, Math.max(iw, ih));
        const ow = a >= 1 ? L : Math.round(L * a), oh = a >= 1 ? Math.round(L / a) : L;
        const o = document.createElement('canvas'); o.width = ow; o.height = oh;
        render(o.getContext('2d'), ow, oh);
        finish(o.toDataURL('image/png'));
      };
      const ov = el('div', { class: 'crop-ov' }, el('div', { class: 'crop-box' },
        el('h3', {}, opts.title || 'Adjust image'),
        el('div', { class: 'crop-stage' }, cv),
        el('div', { class: 'crop-ctl' }, opts.params ? null : el('label', {}, 'Shape ', sel), el('label', {}, 'Zoom ', zoom), el('label', {}, 'Rotate ', rotIn), gd ? el('label', {}, guideOn, gd.jcard ? ' Spine / cover guide' : gd.tray ? ' Spine / back guide' : ' Label guide') : null,
          maskBox && !opts.params ? el('button', { title: 'Zoom onto the part that will be visible and centre it', onclick: fitGuide }, 'Fit to guide') : null,
          el('button', { onclick: () => { z = 1; ox = oy = 0; rot = 0; zoom.value = 1; rotIn.value = 0; draw(); } }, 'Reset')),
        el('div', { class: 'crop-ctl nudge' }, el('span', {}, 'Move'), hold('◀', 'x', -1, 'Left'), hold('▲', 'y', -1, 'Up'), hold('▼', 'y', 1, 'Down'), hold('▶', 'x', 1, 'Right'),
          el('span', {}, 'Zoom'), hold('−', 'z', -1, 'Zoom out'), hold('+', 'z', 1, 'Zoom in'), el('span', {}, 'Rotate'), hold('⟲', 'r', -1, 'Rotate left 0.1°'), hold('⟳', 'r', 1, 'Rotate right 0.1°')),
        el('div', { class: 'note' }, 'Drag the image to move it, scroll or use the slider to zoom, arrow keys nudge (Shift = bigger steps). Anything outside the frame is cut off; empty areas stay transparent.' + (gd ? ' ' + (opts.params ? 'This only changes which part of the J-card is used for the shelf spine and cover - the saved image itself stays whole for the full-image view.' : '') + ' The darkened area of the guide will not show on the finished label (dashed ring = disc clamping area, dark centre = spindle hole).' : '')),
        el('div', { class: 'crop-foot' }, el('button', { onclick: () => finish(null) }, 'Cancel'), el('button', { class: 'primary', onclick: apply }, 'Apply'))));
      document.body.append(ov);
      window.addEventListener('keydown', key_, true);
      layout(); if (!hadInitial) fitGuide();
    });
  };
})(window.S);
