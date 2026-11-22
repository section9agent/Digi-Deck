// 5 x 8 dot-matrix character cells (square dots), as on DAT and MiniDisc deck displays and remotes.
// The glyphs are the classic character-LCD / VFD 5 x 7 set (an 8th row is left for descenders).
(function (S) {
  const COLS = 5, ROWS = 8, cache = new Map();
  // HD44780-style 5 x 7 glyphs (row bitmasks, top to bottom; the 8th row is the cursor / descender row, left blank)
  const FONT = {" ":[0,0,0,0,0,0,0],"!":[4,4,4,4,4,0,4],"\"":[10,10,10,0,0,0,0],"#":[10,10,31,10,31,10,10],"$":[4,15,20,14,5,30,4],"%":[24,25,2,4,8,19,3],"&":[12,18,20,8,21,18,13],"'":[12,4,8,0,0,0,0],"(":[2,4,8,8,8,4,2],")":[8,4,2,2,2,4,8],"*":[0,4,21,14,21,4,0],"+":[0,4,4,31,4,4,0],",":[0,0,0,0,12,4,8],"-":[0,0,0,31,0,0,0],".":[0,0,0,0,0,12,12],"/":[0,1,2,4,8,16,0],"0":[14,17,19,21,25,17,14],"1":[4,12,4,4,4,4,14],"2":[14,17,1,2,4,8,31],"3":[31,2,4,2,1,17,14],"4":[2,6,10,18,31,2,2],"5":[31,16,30,1,1,17,14],"6":[6,8,16,30,17,17,14],"7":[31,1,2,4,8,8,8],"8":[14,17,17,14,17,17,14],"9":[14,17,17,15,1,2,12],":":[0,12,12,0,12,12,0],";":[0,12,12,0,12,4,8],"<":[2,4,8,16,8,4,2],"=":[0,0,31,0,31,0,0],">":[8,4,2,1,2,4,8],"?":[14,17,1,2,4,0,4],"@":[14,17,1,13,21,21,14],"A":[14,17,17,17,31,17,17],"B":[30,17,17,30,17,17,30],"C":[14,17,16,16,16,17,14],"D":[28,18,17,17,17,18,28],"E":[31,16,16,30,16,16,31],"F":[31,16,16,30,16,16,16],"G":[14,17,16,23,17,17,15],"H":[17,17,17,31,17,17,17],"I":[14,4,4,4,4,4,14],"J":[7,2,2,2,2,18,12],"K":[17,18,20,24,20,18,17],"L":[16,16,16,16,16,16,31],"M":[17,27,21,21,17,17,17],"N":[17,17,25,21,19,17,17],"O":[14,17,17,17,17,17,14],"P":[30,17,17,30,16,16,16],"Q":[14,17,17,17,21,18,13],"R":[30,17,17,30,20,18,17],"S":[15,16,16,14,1,1,30],"T":[31,4,4,4,4,4,4],"U":[17,17,17,17,17,17,14],"V":[17,17,17,17,17,10,4],"W":[17,17,17,21,21,21,10],"X":[17,17,10,4,10,17,17],"Y":[17,17,17,10,4,4,4],"Z":[31,1,2,4,8,16,31],"[":[14,8,8,8,8,8,14],"\\":[0,16,8,4,2,1,0],"]":[14,2,2,2,2,2,14],"^":[4,10,17,0,0,0,0],"_":[0,0,0,0,0,0,31],"`":[8,4,2,0,0,0,0],"a":[0,0,14,1,15,17,15],"b":[16,16,22,25,17,17,30],"c":[0,0,14,16,16,17,14],"d":[1,1,13,19,17,17,15],"e":[0,0,14,17,31,16,14],"f":[6,9,8,28,8,8,8],"g":[0,15,17,17,15,1,14],"h":[16,16,22,25,17,17,17],"i":[4,0,12,4,4,4,14],"j":[2,0,6,2,2,18,12],"k":[16,16,18,20,24,20,18],"l":[12,4,4,4,4,4,14],"m":[0,0,26,21,21,17,17],"n":[0,0,22,25,17,17,17],"o":[0,0,14,17,17,17,14],"p":[0,0,30,17,30,16,16],"q":[0,0,13,19,15,1,1],"r":[0,0,22,25,16,16,16],"s":[0,0,14,16,14,1,30],"t":[8,8,28,8,8,9,6],"u":[0,0,17,17,17,19,13],"v":[0,0,17,17,17,10,4],"w":[0,0,17,17,21,21,10],"x":[0,0,17,10,4,10,17],"y":[0,0,17,17,15,1,14],"z":[0,0,31,2,4,8,31],"{":[2,4,4,8,4,4,2],"|":[4,4,4,4,4,4,4],"}":[8,4,4,2,4,4,8],"~":[0,0,13,18,0,0,0]};
  const fold = ch => ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  function glyph(ch) {
    if (cache.has(ch)) return cache.get(ch);
    let rows = FONT[ch] || FONT[fold(ch)] || (/[‘’]/.test(ch) ? FONT["'"] : /[“”]/.test(ch) ? FONT['"'] : /[–—]/.test(ch) ? FONT['-'] : ch === '…' ? [0, 0, 0, 0, 0, 0, 21] : FONT['?']);
    if (ch === ' ') rows = FONT[' '];
    const bits = new Uint8Array(COLS * ROWS);
    rows.forEach((v, r) => { for (let q = 0; q < COLS; q++) bits[r * COLS + q] = (v >> (4 - q)) & 1; });
    cache.set(ch, bits); return bits;
  }
  // draw text in cells: dot = the size of one dot, gap between dots; returns the width used. Unlit dots are drawn faintly
  S.dotText = (x, text, X, Y, { dot = 3, gap = 1, on = '#ff8a2a', off = null, glow = 6, cells = 0, spacing = 1 } = {}) => {
    const step = dot + gap, cw = (COLS + spacing) * step, str = String(text);
    const n = cells || str.length;
    x.save();
    for (let i = 0; i < n; i++) {
      const ch = str[i] || ' ', b = glyph(ch), ox = X + i * cw;
      if (off) { x.fillStyle = off; x.shadowBlur = 0; for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (!b[r * COLS + q]) x.fillRect(ox + q * step, Y + r * step, dot, dot); }
      x.fillStyle = on; x.shadowColor = on; x.shadowBlur = glow;
      for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (b[r * COLS + q]) x.fillRect(ox + q * step, Y + r * step, dot, dot);
    }
    x.restore();
    return n * cw;
  };
  S.dotCellW = (dot = 3, gap = 1, spacing = 1) => (COLS + spacing) * (dot + gap);
  S.dotCellH = (dot = 3, gap = 1) => ROWS * (dot + gap);
  // a scrolling window of text: shows `cells` characters, scrolling when it is longer
  S.dotScroll = (text, cells, t, speed = 3) => {
    const s = String(text || ''); if (s.length <= cells) return s.padEnd(cells);
    const loop = s + '     ', i = Math.floor(t * speed) % loop.length;
    return (loop + loop).slice(i, i + cells);
  };
})(window.S);

// 7-segment LCD / VFD numerals (DSEG7 font, SIL OFL). Digits, '-', ':' and '.' are drawn as segments with the unlit
// segments ghosted behind them like a real display; any letters (h, m, s, RPM ...) are drawn small between them.
(function (S) {
  const FAM = 'DSEG7', SEG = /[0-9\-:. ]/;
  try {
    const f = new FontFace(FAM, 'url(../../assets/fonts/DSEG7Classic-Bold.woff2)', { weight: '700' });
    f.load().then(ff => { document.fonts.add(ff); S.segReady = true; }).catch(() => {});
    const fi = new FontFace(FAM, 'url(../../assets/fonts/DSEG7Classic-BoldItalic.woff2)', { weight: '700', style: 'italic' });
    fi.load().then(ff => document.fonts.add(ff)).catch(() => {});
  } catch (e) {}
  // split "0h00m02s" into runs of segment characters and label characters
  const runs = s => { const out = []; for (const ch of String(s)) { const seg = SEG.test(ch), last = out[out.length - 1]; if (last && last.seg === seg) last.t += ch; else out.push({ seg, t: ch }); } return out; };
  const ghostOf = t => t.replace(/[0-9\- ]/g, '8');
  S.segText = (x, text, X, Y, size, { on = '#ff5a2a', off = null, glow = 8, italic = false, label = 0.42, align = 'left' } = {}) => {
    const segFont = `${italic ? 'italic ' : ''}700 ${size}px ${FAM}, Consolas, monospace`, labFont = `700 ${Math.round(size * label)}px Helvetica, Arial, sans-serif`;
    const parts = runs(text).map(r => { x.font = r.seg ? segFont : labFont; const t = r.seg ? r.t.replace(/ /g, '!') : r.t; return { ...r, t, w: x.measureText(t).width + (r.seg ? 0 : size * 0.08) }; });
    const total = parts.reduce((a, p) => a + p.w, 0);
    let cx = align === 'right' ? X - total : align === 'center' ? X - total / 2 : X;
    x.save(); x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    for (const p of parts) {
      if (p.seg) {
        x.font = segFont;
        if (off) { x.shadowBlur = 0; x.fillStyle = off; x.fillText(ghostOf(p.t.replace(/!/g, ' ')), cx, Y); }
        x.fillStyle = on; x.shadowColor = on; x.shadowBlur = glow; x.fillText(p.t, cx, Y);
      } else { x.font = labFont; x.fillStyle = on; x.shadowColor = on; x.shadowBlur = glow * 0.6; x.fillText(p.t, cx + size * 0.04, Y); }
      cx += p.w;
    }
    x.restore();
    return total;
  };
})(window.S);
