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

  // reel to reel box spine (7.5" tall, a bit under 1" deep): title and artist read down the spine
  function spine(album, w = 154, h = 1500) {
    const c = S.newCanvas(w, h), x = c.getContext('2d'), hh = hue((album.title || '') + (album.artist || ''));
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, `hsl(${hh},35%,22%)`); g.addColorStop(0.5, `hsl(${hh},38%,28%)`); g.addColorStop(1, `hsl(${hh},35%,19%)`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f4ecdc'; x.fillRect(0, 0, w, h * 0.012); x.fillRect(0, h * 0.988, w, h * 0.012);
    x.save(); x.translate(w / 2, h / 2); x.rotate(Math.PI / 2); x.textAlign = 'center'; x.textBaseline = 'middle';
    const t = String(album.title || album.name || 'Untitled'), a = String(album.artist || '');
    const fit = (text, max, size, wt) => { let sz = size; x.font = `${wt} ${sz}px Georgia, serif`; while (x.measureText(text).width > max && sz > 14) { sz -= 2; x.font = `${wt} ${sz}px Georgia, serif`; } return sz; };
    x.fillStyle = '#f4ecdc'; fit(t, h * 0.78, w * 0.36, 700); x.fillText(t, 0, a ? -w * 0.14 : 0);
    if (a) { x.fillStyle = `hsl(${hh},50%,80%)`; fit(a, h * 0.78, w * 0.24, 400); x.fillText(a, 0, w * 0.2); }
    x.restore();
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
  // DAT J-card, laid out like the reference: back flap (track list, written sideways) | spine (title, recorded) | cover
  // (picture on top, the title, the songs and DIGITAL AUDIO TAPE below). 959 x 860 units: flap 200, spine 121, cover 638
  function datJcard(album, frontImg) {
    const k = 2, W = 959 * k, H = 860 * k, c = S.newCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const title = album.title || album.name || 'Untitled', artist = S.displayArtist ? S.displayArtist(album) : (album.artist || '');
    const songs = (album.tracks || []).map(t => (t.title || '').toUpperCase()).filter(Boolean).join(' • ') + ((album.tracks || []).length ? ' •' : '');
    const wrap = (txt, maxW) => { const out = []; let line = ''; for (const w of txt.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; };
    x.fillStyle = '#111'; x.textBaseline = 'top';
    // back flap: the songs, reading top to bottom
    x.save(); x.translate(200 * k - 26 * k, 26 * k); x.rotate(Math.PI / 2);
    x.font = `400 ${26 * k}px Helvetica, Arial, sans-serif`; wrap(songs, 800 * k).slice(0, 5).forEach((l, i) => x.fillText(l, 0, i * 32 * k)); x.restore();
    // spine: title (bold) at the top, the year at the bottom
    x.save(); x.translate(357 * k - 30 * k, 26 * k); x.rotate(Math.PI / 2);
    x.font = `700 ${27 * k}px Helvetica, Arial, sans-serif`;
    x.fillText(title.toUpperCase().slice(0, 34), 0, 0); if (artist) x.fillText(artist.toUpperCase().slice(0, 34), 0, 32 * k);
    if (album.year) { x.font = `400 ${24 * k}px Helvetica, Arial, sans-serif`; x.textAlign = 'right'; x.fillText(String(album.year), 808 * k, 18 * k); }
    x.restore();
    // cover: picture, then the text block
    const cx = 321 * k, cw = 638 * k;
    S.drawCover(x, frontImg || cover(title, artist, 900), cx, 0, cw, 638 * k);
    x.textAlign = 'center'; x.font = `700 ${30 * k}px Helvetica, Arial, sans-serif`;
    x.fillText(title.toUpperCase().slice(0, 30), cx + cw / 2, 648 * k); if (artist) x.fillText(artist.toUpperCase().slice(0, 30), cx + cw / 2, 684 * k);
    x.textAlign = 'left'; x.font = `400 ${22 * k}px Helvetica, Arial, sans-serif`;
    wrap(songs, cw - 50 * k).slice(0, 2).forEach((l, i) => x.fillText(l, cx + 25 * k, (728 + i * 28) * k));
    x.textAlign = 'center'; x.font = `400 ${28 * k}px Helvetica, Arial, sans-serif`; x.fillText('DIGITAL AUDIO TAPE', cx + cw / 2, 810 * k);
    x.textAlign = 'left';
    // fold lines
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = k; for (const fx of [200, 321]) { x.beginPath(); x.moveTo(fx * k, 0); x.lineTo(fx * k, H); x.stroke(); }
    return c;
  }

  S.generic = { cover, back, label, jcard, spine, datJcard };
  const datCache = new Map();
  S.datJcard = async album => {
    if (!album.tracks && album.id) { const k = album.id + ':' + (album.updated || ''); if (!datCache.has(k)) datCache.set(k, window.api.libraryLoad('dat', album.id).catch(() => null)); album = (await datCache.get(k)) || album; }  // shelf rows carry no track list
    return datJcard(album, album.front ? await S.loadImage(album.front) : null);
  };

  // Resolve the image for a slot, falling back to generated art.
  // slot: front|back|jcard|label_a|label_b ; returns a CanvasImageSource
  S.art = {
    async get(album, slot, mode, side) {
      if (!album) return null;
      side = side || (slot.startsWith('label_') ? slot.slice(6).toUpperCase() : 'A');
      const info = { title: album.title || album.name || 'Untitled', artist: album.artist || '', side };
      if (mode === 'vinyl' && slot === 'front' && album.shaped && album.pic_a && S.shapedSleeve && !album.front) return S.shapedSleeve(album, 600);
      if (mode === 'vinyl' && (slot === 'front' || slot === 'back') && S.holeCover) { const h = await S.holeCover(album, slot); if (h) return h; }
      if (slot === 'front') return (await S.loadImage(album.front)) || cover(info.title, info.artist);
      if (slot === 'back') return (await S.loadImage(album.back)) || back(album);
      if (slot === 'spine') return (await S.loadImage(album.spine)) || spine(album);
      if (slot === 'jcard') {
        const j = await S.loadImage(album.jcard);
        if (!j && mode === 'micro') return S.microJcard(album);
        if (!j && mode === 'dat') return S.datJcard(album);
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
