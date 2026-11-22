// Player skins: each app theme also re-colours the players.
//  * Bitmap players (cassette, microcassette, reel to reel): the blue-metal parts of their artwork are found (the same rule the blue
//    tint used: light, blue-leaning pixels) and gradient-mapped onto the theme's colours, with a texture (brushed metal, wood grain,
//    brass scratches and patina, anodised flake ...). Wood trim is re-coloured separately. Windows, labels, dark keys stay as they are.
//  * CSS / SVG players (turntable, CD player): an SVG gradient-map filter on their metal parts, and a texture overlay.
//  * Displays get the theme's LCD colour; the turntable gets the theme's slipmat.
// The Original theme ('metal') leaves everything exactly as it is.
(function (S) {
  const A = '../../assets/';
  const T = S.SKINS = {
    metal:     { slip: 'slipmat-original.png' },
    cyberpunk: { soft: ['#2a2440', '#5a4a80', '#a070d0', '#ff7ae8', '#ffe0ff'], ramp: ['#000000', '#0b0912', '#1c1828', '#3a3150', '#ff2bd6'], g: 2.6, edge: '#00f0ff', ink: '#7ff8ff', tex: 'brushed', wood: ['#030304', '#141418', '#26262e'], lcd: '#00f0ff', slip: 'slipmat.png' },
    synthwave: { ramp: ['#12051f', '#4a1270', '#c0307a', '#ff8a5c', '#ffe6b0'], tex: 'brushed', wood: ['#0a0312', '#2a0c40', '#4a1a66'], lcd: '#ff4fd8', slip: 'slipmat-synthwave.png' },
    vaporwave: { ramp: ['#3a2f5c', '#8a6fc0', '#f2a6d8', '#b8f5ea', '#ffffff'], tex: 'soft', wood: ['#7a5fae', '#c38fd8', '#f2c6ec'], lcd: '#7ef9ff', slip: 'slipmat-vaporwave.png' },
    eighties:  { ramp: ['#1a1a1a', '#5a5a58', '#b9b6ad', '#e8e4d8', '#ffffff'], tex: 'brushed', wood: null, lcd: '#ff9f1c', slip: 'slipmat-8ball.png' },
    nineties:  { ramp: ['#140d33', '#3a2c78', '#20c4c4', '#9ff0e8', '#ffffff'], tex: 'soft', wood: ['#2a1f5c', '#5a3fb0', '#8a6fe0'], lcd: '#ffd400', slip: 'slipmat-arcade.png' },
    steampunk: { ramp: ['#1a0e04', '#5a3412', '#a8742c', '#e6c06a', '#fff1c1'], tex: 'brass', wood: ['#160904', '#3a1a0a', '#6a3418'], lcd: '#ffb347', slip: 'slipmat-gear.png' },
    forest:    { ramp: ['#140b05', '#3e2412', '#7a4a26', '#b98a52', '#e8cc9a'], tex: 'wood', wood: ['#0e1a0c', '#24401e', '#4a6e34'], lcd: '#a8ff7a', slip: 'slipmat-forest.png' },
    midnight:  { soft: ['#25386e', '#4a60a8', '#7d93d6', '#b8c8ff', '#ffffff'], ramp: ['#03050c', '#0c1430', '#25386e', '#7d93d6', '#e4ebff'], g: 2.4, ink: '#c9d4ff', tex: 'flake', wood: ['#020308', '#0a0f22', '#18213e'], lcd: '#9db4ff', slip: 'slipmat-midnight.png' },
    winamp:    { soft: ['#3a3a50', '#5a5a74', '#8a8aa4', '#c4c4d4', '#ffffff'], ramp: ['#0c0c14', '#22222e', '#3a3a50', '#5a5a74', '#a8a8c0'], g: 1.8, ink: '#d0d0e0', tex: 'brushed', wood: ['#0c0c12', '#1c1c26', '#2c2c3a'], lcd: '#00e800', slip: 'slipmat-llama.png' },
    xp:        { ramp: ['#0a246a', '#2a5bd7', '#9fbef5', '#eef3fb', '#ffffff'], tex: 'soft', wood: ['#8a96a8', '#c4ccd8', '#eef1f6'], lcd: '#8fd0ff', slip: 'slipmat-xp.png' },
  };
  const recolorPixels = (...a) => self.recolorPixels(...a);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lut = (stops, g = 1) => {          // 256-entry gradient map (for the SVG filters)
    const out = new Uint8ClampedArray(256 * 3), st = stops.map(hex), n = st.length - 1;
    for (let i = 0; i < 256; i++) {
      const t = Math.pow(Math.min(1, Math.max(0, (i / 255 - 0.15) / 0.85)), g) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = st[k][c] + (st[k + 1][c] - st[k][c]) * f;
    }
    return out;
  };
  let rs = 1; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const skin = S.skin = { name: 'metal', def: T.metal, listeners: new Set(), cache: new Map() };
  skin.lcd = () => skin.def.lcd || null;
  skin.slipmat = () => A + (skin.def.slip || 'slipmat-original.png');
  skin.onChange = fn => { skin.listeners.add(fn); return () => skin.listeners.delete(fn); };
  skin.recolor = (img, W, H, d = skin.def, all = false) => { if (d.ramp) recolorPixels(img.data, W, H, d, all); };
  skin.recolorCanvas = (c, all = false) => { if (!skin.def.ramp) return c; const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height); skin.recolor(im, c.width, c.height, skin.def, all); x.putImageData(im, 0, 0); return c; };
  // the worker: artwork is recoloured off the main thread so the app keeps running smoothly while a theme is applied
  let worker = null, jobs = new Map(), jobN = 0;
  try {
    worker = new Worker('skin-worker.js');
    worker.onmessage = ev => { const j = jobs.get(ev.data.id); if (j) { jobs.delete(ev.data.id); j(ev.data); } };
    worker.onerror = () => { worker = null; jobs.forEach(j => j({})); jobs.clear(); };
  } catch (e) { worker = null; }
  const MAXW = 2400;                                            // art is shown at most ~1200 px wide, so 2x that is plenty
  // ------------------------------------------------------------------ themed copies of artwork files (cached per theme)
  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  skin.url = async (src, name = skin.name) => {
    const d = T[name] || T.metal; if (!d.ramp) return src;
    const key = name + '|' + src; if (skin.cache.has(key)) return skin.cache.get(key);
    const pr = (async () => {
      const im = await load(src); if (!im) return src;
      const k = Math.min(1, MAXW / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      if (worker) {
        try {
          const bmp = await createImageBitmap(im), id = ++jobN;
          const res = await new Promise(r => { jobs.set(id, r); worker.postMessage({ id, bmp, w, h, d }, [bmp]); });
          if (res.blob) return URL.createObjectURL(res.blob);
        } catch (e) {}
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
      const data = x.getImageData(0, 0, w, h); recolorPixels(data.data, w, h, d, false); x.putImageData(data, 0, 0);
      const b = await new Promise(r => c.toBlob(r, 'image/png')); return b ? URL.createObjectURL(b) : src;
    })();
    skin.cache.set(key, pr); return pr;
  };
  // keep an element's picture in step with the theme: prop 'src' (img), 'bg' (background-image) or a function(url)
  const bound = new Set();
  skin.bind = (el, src, prop = 'src') => {
    const b = { el, src, prop, n: 0, set: s => { b.src = s; apply1(b); } }; bound.add(b); apply1(b); return b;
  };
  async function apply1(b) {
    const n = ++b.n, u = await skin.url(b.src); if (n !== b.n) return;
    if (typeof b.prop === 'function') b.prop(u); else if (b.prop === 'bg') b.el.style.backgroundImage = `url("${u}")`; else b.el.src = u;
  }

  // ------------------------------------------------------------------ SVG gradient-map filters for the CSS-drawn players
  function filters() {
    let svg = document.getElementById('skin-filters');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'skin-filters'; svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.style.position = 'absolute'; document.body.append(svg); }
    const one = (id, stops, g) => {
      const L = lut(stops, g), pick = c => Array.from({ length: 17 }, (_, i) => (L[Math.round(i / 16 * 255) * 3 + c] / 255).toFixed(3)).join(' ');
      return `<filter id="skin-${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0  .2126 .7152 .0722 0 0  .2126 .7152 .0722 0 0  0 0 0 1 0"/>` +
        `<feComponentTransfer><feFuncR type="table" tableValues="${pick(0)}"/><feFuncG type="table" tableValues="${pick(1)}"/><feFuncB type="table" tableValues="${pick(2)}"/></feComponentTransfer></filter>`;
    };
    svg.innerHTML = '<defs>' + Object.entries(T).filter(([, d]) => d.ramp).map(([n, d]) => one(n, d.ramp, d.g || 1) + one(n + '-soft', d.soft || d.ramp, 1)).join('') + '</defs>';
  }
  // grey textures (used with mix-blend-mode:overlay before the filter) for the CSS players' metal
  function texture(kind) {
    const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); rs = 11;
    x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
    if (kind === 'wood') for (let y = 0; y < H; y++) for (let X = 0; X < W; X += 4) { const g = Math.sin(y * 0.35 + Math.sin(X * 0.01) * 8 + Math.sin(X * 0.003 + y * 0.02) * 14); x.fillStyle = g > 0 ? `rgba(255,255,255,${g * 0.22})` : `rgba(0,0,0,${-g * 0.3})`; x.fillRect(X, y, 4, 1); }
    else if (kind === 'flake') { for (let i = 0; i < 26000; i++) { const v = rnd(); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.3})` : `rgba(0,0,0,${(0.5 - v) * 0.3})`; x.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); } for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(rnd() * W, rnd() * H, 1.2, 1.2); } }
    else {
      for (let y = 0; y < H; y++) { const v = rnd(); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.2})` : `rgba(0,0,0,${(0.5 - v) * 0.2})`; x.fillRect(0, y, W, 1); }
      for (let i = 0; i < 1200; i++) { x.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.05 + rnd() * 0.12})` : `rgba(0,0,0,${0.04 + rnd() * 0.1})`; x.fillRect(rnd() * W, Math.floor(rnd() * H), 40 + rnd() * 380, 1); }
      if (kind === 'brass') {
        for (let i = 0; i < 500; i++) { const X = rnd() * W, Y = rnd() * H, a = rnd() * Math.PI, l = 10 + rnd() * 90; x.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.2})`; x.lineWidth = 0.7; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); x.stroke(); }
        for (let i = 0; i < 40; i++) { const X = rnd() * W, Y = rnd() * H, r = 15 + rnd() * 60, g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); }
      }
    }
    return `url(${c.toDataURL('image/png')})`;
  }
  const texCache = {};
  skin.apply = name => {
    if (!T[name]) name = 'metal';
    const changed = name !== skin.name; skin.name = name; skin.def = T[name];
    if (!document.getElementById('skin-filters')) filters();
    const d = skin.def, root = document.documentElement.style;
    root.setProperty('--skin-filter', d.ramp ? `url(#skin-${name})` : 'none'); root.setProperty('--skin-filter-soft', d.ramp ? `url(#skin-${name}-soft)` : 'none');
    root.setProperty('--skin-tex', d.ramp ? (texCache[d.tex] || (texCache[d.tex] = texture(d.tex))) : 'var(--brush)');
    root.setProperty('--skin-lcd', d.lcd || '#a2ffc4'); root.setProperty('--skin-lcd-bg', d.lcdBg || '');
    if (!changed) return;
    for (const b of bound) { if (b.el && !b.el.isConnected) { bound.delete(b); continue; } apply1(b); }
    skin.listeners.forEach(fn => { try { fn(name); } catch (e) { console.error(e); } });
  };
})(window.S);
