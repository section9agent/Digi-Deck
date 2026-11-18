// Front-panel artwork of the microcassette deck, drawn as SVG (2000 x 880 units): brushed-aluminium panel, vented top cover,
// compartment recess, scales and silk-screen text. Modelled on the supplied reference photos of a late-70s stereo microcassette deck,
// with its own name ("DIGI-DECK") - no real brand artwork. The live parts (door, tape, keys, meter, counter, knob) are DOM on top.
(function (S) {
  S.MICRO_DECK = { W: 2000, H: 880 };
  S.microDeckSVG = () => {
    const W = 2000, H = 880, f = "font-family=\"'Helvetica Neue',Helvetica,Arial,sans-serif\"";
    const t = (x, y, s, size = 20, extra = '') => {      // later attributes in `extra` override the defaults (keeps the SVG valid XML, so it opens in editors)
      const at = { 'font-weight': '600', fill: '#2b2c2f' }; extra.replace(/([\w-]+)="([^"]*)"/g, (m, k, v) => (at[k] = v, m));
      return `<text x="${x}" y="${y}" ${f} font-size="${size}" ${Object.entries(at).map(([k, v]) => `${k}="${v}"`).join(' ')}>${s}</text>`;
    };
    let vents = '';
    const rows = [46, 66, 86, 106, 126];
    rows.forEach(y => {
      const fr = (y - 25) / 125, l = 150 - 125 * fr, r = 1850 + 125 * fr, w = r - l;
      [[0.05, 0.31], [0.37, 0.63], [0.69, 0.95]].forEach(([a, b]) => {
        const x0 = l + w * a, x1 = l + w * b, n = Math.round((x1 - x0) / 46);
        for (let i = 0; i < n; i++) vents += `<rect x="${(x0 + i * (x1 - x0) / n + 3).toFixed(1)}" y="${y}" width="${((x1 - x0) / n - 7).toFixed(1)}" height="8" rx="3" fill="#0b0b0c"/>`;
      });
    });
    const scale = [[1425, '-∞'], [1480, '20'], [1535, '15'], [1590, '10'], [1625, '7'], [1660, '4'], [1698, '2'], [1735, '1'], [1772, '0'], [1809, '1'], [1846, '2'], [1883, '6'], [1925, 'dB']];
    const sw = (x, y, w, lab) => `<rect x="${x}" y="${y}" width="${w}" height="26" rx="3" fill="#0e0e10" stroke="#8b8d91" stroke-width="2"/><rect x="${x + 5}" y="${y + 3}" width="${w * 0.45}" height="20" rx="2" fill="url(#metal)"/>` + t(x, y - 12, lab, 17);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none">
<defs>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e3e5"/><stop offset=".45" stop-color="#cfd1d3"/><stop offset="1" stop-color="#bfc1c4"/></linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f2f3"/><stop offset=".5" stop-color="#c7c9cc"/><stop offset="1" stop-color="#9ea1a5"/></linearGradient>
  <linearGradient id="cover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3d40"/><stop offset="1" stop-color="#26272a"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8c929a"/><stop offset=".6" stop-color="#6a7079"/><stop offset="1" stop-color="#7b818a"/></linearGradient>
  <linearGradient id="well" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0d0f"/><stop offset=".5" stop-color="#232427"/><stop offset="1" stop-color="#17181a"/></linearGradient>
  <filter id="brushD" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0007 0.95" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.5 0 0 0 -0.5"/></filter>
  <filter id="brushL" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0007 0.95" numOctaves="3" seed="23"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -0.55"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<rect x="12" y="30" width="1976" height="850" rx="10" fill="#000" opacity=".35" filter="url(#soft)"/>
<polygon points="150,25 1850,25 1975,152 25,152" fill="url(#cover)"/>
<polygon points="150,25 1850,25 1853,32 147,32" fill="#6a6b70" opacity=".7"/>
${vents}
<rect x="20" y="150" width="1960" height="730" rx="8" fill="url(#panel)"/>
<rect x="20" y="150" width="1960" height="730" rx="8" filter="url(#brushD)" opacity=".30"/>
<rect x="20" y="150" width="1960" height="730" rx="8" filter="url(#brushL)" opacity=".38"/>
<rect x="20" y="150" width="1960" height="22" fill="#fff" opacity=".35"/>
<rect x="20" y="150" width="1960" height="2" fill="#fff" opacity=".9"/>
<rect x="20" y="878" width="1960" height="2" fill="#000" opacity=".25"/>
<rect x="20" y="150" width="3" height="730" fill="#fff" opacity=".5"/><rect x="1977" y="150" width="3" height="730" fill="#000" opacity=".22"/>
${t(1190, 205, 'STEREO  MICROCASSETTE  DECK', 22, 'letter-spacing="3"')}
<circle cx="1160" cy="197" r="9" fill="none" stroke="#2b2c2f" stroke-width="3"/><circle cx="1160" cy="197" r="3" fill="#2b2c2f"/>
${t(1740, 205, 'DIGI-DECK  MC-1', 24, 'font-weight="800" letter-spacing="2"')}

<!-- left column -->
${t(70, 238, 'POWER', 21)}<rect x="70" y="252" width="212" height="36" rx="3" fill="#1d1e20"/><rect x="73" y="255" width="206" height="28" rx="2" fill="url(#metal)"/>${[0, 1, 2, 3, 4].map(i => `<rect x="${95 + i * 8}" y="258" width="3" height="22" fill="#000" opacity=".5"/>`).join('')}
${t(70, 378, 'COUNTER', 21)}${t(290, 378, 'RESET', 21)}
<rect x="62" y="388" width="196" height="76" rx="4" fill="#9fa1a5"/><rect x="68" y="394" width="184" height="64" rx="3" fill="#0b0b0c"/>
<rect x="288" y="392" width="62" height="62" rx="3" fill="#1d1e20"/><rect x="291" y="395" width="56" height="56" rx="2" fill="url(#metal)"/>
${t(70, 530, 'TIMER STAND-BY', 19)}<rect x="70" y="545" width="220" height="30" rx="3" fill="#18181a"/><rect x="73" y="548" width="120" height="24" rx="2" fill="url(#metal)"/>
${t(70, 612, '▮ OFF', 15)}${t(240, 612, '▬ REC', 15)}
<circle cx="170" cy="735" r="58" fill="url(#metal)"/><circle cx="170" cy="735" r="58" fill="none" stroke="#7d8084" stroke-width="3"/><circle cx="170" cy="735" r="40" fill="#0e0e10"/><circle cx="170" cy="735" r="22" fill="#030303"/><circle cx="170" cy="735" r="40" fill="none" stroke="#5a5c60" stroke-width="3"/>
${t(122, 842, 'PHONES', 21)}

<!-- compartment: recess, frame -->
<rect x="386" y="200" width="788" height="435" rx="14" fill="#9fa2a6"/><rect x="392" y="206" width="776" height="423" rx="11" fill="#e9eaec" opacity=".75"/>
<rect x="400" y="215" width="760" height="405" rx="8" fill="url(#well)"/>
<rect x="400" y="215" width="760" height="405" rx="8" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="4"/>
<rect x="760" y="520" width="60" height="48" rx="3" fill="#6d6f73"/><rect x="766" y="526" width="48" height="36" rx="2" fill="#8e9094"/>
<rect x="440" y="575" width="680" height="12" fill="#000" opacity=".35"/>
<!-- strip, band, keys -->
<rect x="400" y="634" width="760" height="40" fill="url(#metal)"/>
<path d="M740 662 L762 645 L800 645 L788 662 L774 662 L770 652 L760 662 Z" fill="none" stroke="#2b2c2f" stroke-width="3" stroke-linejoin="round"/>
<rect x="400" y="684" width="760" height="32" fill="#161618"/>
<text x="426" y="707" ${f} font-size="21" font-style="italic" font-weight="800" fill="#f2f2f2" letter-spacing="1">MICROCASSETTE</text>
<text x="628" y="707" ${f} font-size="21" font-weight="600" fill="#f2f2f2" letter-spacing="1">/ TWO MOTORS</text>
<text x="900" y="707" ${f} font-size="19" font-weight="600" fill="#f2f2f2" letter-spacing="1">FULL LOGIC CONTROL</text>
<rect x="400" y="722" width="760" height="150" rx="8" fill="#c9cacd"/><rect x="400" y="722" width="760" height="150" rx="8" filter="url(#brushL)" opacity=".5"/><rect x="400" y="722" width="760" height="3" fill="#fff" opacity=".7"/>
${['◀◀', '▶▶', '●', '▶', '■', '❚❚', '⟲'].map((g, i) => `<text x="${474 + i * 105}" y="752" ${f} font-size="17" font-weight="700" fill="${i === 2 ? '#c4332b' : '#2b2c2f'}" text-anchor="middle">${g}</text>`).join('')}
${['PREV', 'NEXT', 'REC', 'PLAY', 'STOP', 'PAUSE', 'FLIP'].map((g, i) => `<text x="${474 + i * 105}" y="776" ${f} font-size="18" font-weight="600" fill="${i === 2 ? '#c4332b' : '#2b2c2f'}" text-anchor="middle">${g}</text>`).join('')}

<!-- meter window -->
<rect x="1186" y="214" width="780" height="226" rx="9" fill="#a4a7ab"/><rect x="1192" y="220" width="768" height="214" rx="7" fill="#e6e7e9" opacity=".8"/>
<rect x="1200" y="228" width="752" height="198" rx="5" fill="url(#glass)"/><rect x="1200" y="228" width="752" height="198" rx="5" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="3"/>
${t(1590, 255, 'PEAK LEVEL', 16, 'text-anchor="middle" letter-spacing="2" fill="#26292d"')}
${['REC', 'PLAY', 'PAUSE', 'FLIP'].map((g, i) => `<rect x="1214" y="${236 + i * 46}" width="104" height="38" rx="4" fill="none" stroke="#2b2e33" stroke-width="2"/>${t(1266, 262 + i * 46, g, 18, 'text-anchor="middle" fill="#2b2e33"')}`).join('')}
${t(1345, 312, 'LEFT', 16, 'fill="#26292d"')}${t(1337, 378, 'RIGHT', 16, 'fill="#26292d"')}
${scale.map(([x, s]) => t(x, 285, s, 16, 'text-anchor="middle" fill="#26292d"')).join('')}
<path d="M1413 268 H1780 V275 M1790 268 H1940 V275" fill="none" stroke="#26292d" stroke-width="2"/>
<!-- selectors below the meter -->
${t(1198, 478, 'EJECT', 21)}<rect x="1196" y="494" width="116" height="118" rx="6" fill="#18181a"/><rect x="1202" y="500" width="104" height="106" rx="4" fill="url(#metal)"/><rect x="1202" y="500" width="104" height="14" fill="#fff" opacity=".6"/>
${t(1345, 478, 'TAPE', 20, 'text-anchor="start"')}
${sw(1345, 520, 62, 'METAL')}${sw(1430, 520, 62, 'NORMAL')}
${t(1560, 478, 'INPUT', 20)}${sw(1560, 520, 62, 'MIC')}${t(1560, 602, '▮ LINE', 15)}
${t(1345, 640, 'NOISE', 20)}${sw(1345, 682, 62, 'REDUCTION')}
<circle cx="1390" cy="500" r="5" fill="#2c7a3a" opacity=".9"/><circle cx="1476" cy="500" r="5" fill="#44464a"/>
<!-- volume knob scale -->
${Array.from({ length: 9 }, (_, i) => { const a = (-135 + i * 33.75) * Math.PI / 180, cx = 1832, cy = 690, r1 = 108, r2 = 122, rt = 140; return `<line x1="${cx + r1 * Math.sin(a)}" y1="${cy - r1 * Math.cos(a)}" x2="${cx + r2 * Math.sin(a)}" y2="${cy - r2 * Math.cos(a)}" stroke="#2b2c2f" stroke-width="3"/>${t(cx + rt * Math.sin(a), cy - rt * Math.cos(a) + 7, String(i), 20, 'text-anchor="middle"')}`; }).join('')}
${t(1832, 862, 'VOLUME', 21, 'text-anchor="middle" letter-spacing="2"')}
</svg>`;
  };
})(window.S);
