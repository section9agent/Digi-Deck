// Generated artwork used whenever a real image is missing (user-made sets, unknown releases, empty slots).
(function (S) {
  const hue = s => S.hash(s) % 360;

  function wrap(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function textBlock(ctx, text, cx, cy, maxW, size, color, weight = '700', family = 'Georgia, serif', maxLines = 4) {
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let s = size, lines;
    for (; s > 10; s -= 2) { ctx.font = `${weight} ${s}px ${family}`; lines = wrap(ctx, text, maxW); if (lines.length <= maxLines) break; }
    ctx.font = `${weight} ${s}px ${family}`; lines = wrap(ctx, text, maxW).slice(0, maxLines);
    const lh = s * 1.15, y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh));
    return s;
  }

  function cover(title, artist, size = 800) {
    const c = S.newCanvas(size), x = c.getContext('2d');
    const h = hue(title + artist);
    const g = x.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, `hsl(${h},45%,28%)`); g.addColorStop(1, `hsl(${(h + 40) % 360},50%,14%)`);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    x.strokeStyle = `hsla(${h},60%,75%,.12)`; x.lineWidth = size * 0.004;
    for (let r = size * 0.1; r < size * 0.9; r += size * 0.045) { x.beginPath(); x.arc(size * 0.78, size * 0.86, r, 0, 7); x.stroke(); }
    x.fillStyle = `hsla(${h},70%,85%,.9)`; x.fillRect(size * 0.08, size * 0.08, size * 0.012, size * 0.2);
    textBlock(x, title || 'Untitled', size * 0.5, size * 0.4, size * 0.72, size * 0.1, '#f6efe3');
    if (artist) textBlock(x, artist, size * 0.5, size * 0.72, size * 0.7, size * 0.05, `hsl(${h},60%,80%)`, '400', 'Helvetica, Arial, sans-serif', 2);
    return c;
  }

  function back(album, size = 800) {
    const c = S.newCanvas(size), x = c.getContext('2d');
    const h = hue((album.title || '') + (album.artist || ''));
    x.fillStyle = `hsl(${h},30%,14%)`; x.fillRect(0, 0, size, size);
    x.fillStyle = '#f2e9d8'; x.textAlign = 'left'; x.textBaseline = 'top';
    x.font = `700 ${size * 0.05}px Georgia, serif`; x.fillText(String(album.title || 'Untitled').slice(0, 34), size * 0.07, size * 0.07);
    x.font = `${size * 0.03}px Helvetica, Arial, sans-serif`; x.fillStyle = `hsl(${h},50%,75%)`;
    x.fillText(album.artist || '', size * 0.07, size * 0.14);
    const tr = (album.tracks || []).slice(0, 22), step = Math.min(size * 0.034, (size * 0.8) / Math.max(1, tr.length));
    x.font = `${step * 0.75}px Helvetica, Arial, sans-serif`; x.fillStyle = '#e8dfcc';
    tr.forEach((t, i) => x.fillText(`${String(i + 1).padStart(2, '0')}  ${String(t.title).slice(0, 44)}`, size * 0.07, size * 0.2 + i * step));
    return c;
  }

  // circular label for vinyl & CD, rectangle for cassette
  function label(mode, info, size = 600) {
    const side = info.side || 'A', h = hue(info.title + info.artist);
    if (mode === 'cassette') {
      const w = size, ht = Math.round(size * 0.42), c = S.newCanvas(w, ht), x = c.getContext('2d');
      x.fillStyle = `hsl(${h},35%,88%)`; x.fillRect(0, 0, w, ht);
      // The real window (x 19-81%, y 14-71%) is cut out of this later, so text lives in the strips around it.
      x.fillStyle = `hsl(${h},60%,35%)`; x.fillRect(0, 0, w * 0.1, ht);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `800 ${ht * 0.22}px Helvetica, Arial, sans-serif`; x.fillText(side, w * 0.05, ht * 0.5);
      textBlock(x, info.title || 'Untitled', w * 0.55, ht * 0.07, w * 0.8, ht * 0.11, '#1b1b1b', '700', 'Georgia, serif', 1);
      if (info.artist) textBlock(x, info.artist, w * 0.55, ht * 0.8, w * 0.8, ht * 0.1, '#333', '400', 'Helvetica, Arial, sans-serif', 1);
      x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(w * 0.14, ht * 0.9); x.lineTo(w * 0.96, ht * 0.9); x.stroke();
      return c;
    }
    const c = S.newCanvas(size), x = c.getContext('2d'), r = size / 2;
    const g = x.createRadialGradient(r, r, r * 0.1, r, r, r);
    if (mode === 'cd') { g.addColorStop(0, `hsl(${h},30%,92%)`); g.addColorStop(0.6, `hsl(${h},45%,70%)`); g.addColorStop(1, `hsl(${(h + 30) % 360},55%,38%)`); }
    else { g.addColorStop(0, `hsl(${h},55%,45%)`); g.addColorStop(1, `hsl(${h},60%,30%)`); }
    x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = size * 0.006; x.beginPath(); x.arc(r, r, r * 0.97, 0, 7); x.stroke();
    const ink = mode === 'cd' ? '#17202a' : '#fbf3df';
    textBlock(x, info.title || 'Untitled', r, r * 0.78, r * 1.1, r * 0.2, ink, '700', 'Georgia, serif', 3);
    if (info.artist) textBlock(x, info.artist, r, r * 1.2, r * 1.0, r * 0.1, ink, '400', 'Helvetica, Arial, sans-serif', 2);
    x.fillStyle = ink; x.font = `800 ${r * 0.16}px Helvetica, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (mode === 'vinyl') x.fillText(`SIDE ${side}`, r, r * 1.55);
    else x.fillText('DIGITAL AUDIO', r, r * 1.58);
    return c;
  }

  // J-card: [back panel][spine][front panel] flat spread
  function jcard(album, frontImg, backImg, w = 1500) {
    const h = Math.round(w * 0.31), c = S.newCanvas(w, h), x = c.getContext('2d');
    const spine = w * 0.075, panel = (w - spine) / 2;
    const hh = hue((album.title || '') + (album.artist || ''));
    x.fillStyle = `hsl(${hh},30%,15%)`; x.fillRect(0, 0, w, h);
    const back = backImg || back_(album, h);
    S.drawCover(x, back, 0, 0, panel, h);
    x.fillStyle = `hsl(${hh},45%,22%)`; x.fillRect(panel, 0, spine, h);
    x.save(); x.translate(panel + spine / 2, h / 2); x.rotate(Math.PI / 2);
    x.fillStyle = '#f4ecdc'; x.font = `700 ${spine * 0.5}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(`${album.artist || ''}${album.artist ? ' — ' : ''}${album.title || ''}`.slice(0, 60), 0, 0); x.restore();
    S.drawCover(x, frontImg || cover(album.title, album.artist, h), panel + spine, 0, panel, h);
    return c;
  }
  const back_ = (album, h) => back(album, h);

  S.generic = { cover, back, label, jcard };

  // Resolve the image for a slot, falling back to generated art.
  // slot: front|back|jcard|label_a|label_b ; returns a CanvasImageSource
  S.art = {
    async get(album, slot, mode, side) {
      if (!album) return null;
      side = side || (slot.startsWith('label_') ? slot.slice(6).toUpperCase() : 'A');
      const info = { title: album.title || album.name || 'Untitled', artist: album.artist || '', side };
      if (slot === 'front') return (await S.loadImage(album.front)) || cover(info.title, info.artist);
      if (slot === 'back') return (await S.loadImage(album.back)) || back(album);
      if (slot === 'jcard') {
        const j = await S.loadImage(album.jcard);
        return j || jcard(album, await S.loadImage(album.front), await S.loadImage(album.back));
      }
      // labels: side B falls back to side A's label when only one was found
      let img = await S.loadImage(album[slot] || album.label_a || '');
      if (!img && slot === 'label_a') img = null;
      if (img) return img;
      const ri = (mode === 'vinyl' || mode === 'cd') ? S.releaseInfo(album, mode) : {};
      return S.labelArt(mode, { title: info.title, artist: S.displayArtist(album), side, seven: ri.seven, small: ri.small });
    }
  };
})(window.S);
