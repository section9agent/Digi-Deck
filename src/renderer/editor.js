// Dialogs: album/release editor, settings, art viewer.
(function (S) {
  const $ = S.$, el = S.el;

  // Which artwork slots each mode needs. Vinyl has no J-card; CD only has front, back and the CD label.
  S.slotsFor = (mode, album) => {
    const sides = album ? S.unitLetters(album, mode) : mode === 'cd' ? ['A'] : ['A', 'B'];
    if (mode === 'vinyl') {
      const s = [['front', 'Front'], ['back', 'Back'], ...sides.map(x => ['label_' + x.toLowerCase(), 'Label ' + x])];
      if (album && album.picture_disc) s.push(...sides.map(x => ['pic_' + x.toLowerCase(), 'Picture disc ' + x]));
      return s;
    }
    if (mode === 'cd') return [['front', 'Front'], ['back', 'Back (tray card, with spines)'], ...sides.map((x, i) => ['label_' + x.toLowerCase(), sides.length > 1 ? `CD label ${i + 1}` : 'CD label'])];
    return [['front', 'Front'], ['jcard', 'J-card (back flap · spine · cover)'], ...sides.map(x => ['label_' + x.toLowerCase(), 'Label ' + x])];
  };

  S.modal = (title, body, foot, { narrow = false, onClose } = {}) => {
    const root = $('#modal');
    const close = () => { root.hidden = true; root.replaceChildren(); window.removeEventListener('keydown', esc); onClose && onClose(); };
    const esc = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    root.replaceChildren(el('div', { class: 'dlg' + (narrow ? ' narrow' : '') },
      el('div', { class: 'dlg-head' }, el('h3', {}, title), el('button', { onclick: close }, '✕')),
      el('div', { class: 'dlg-body' }, body), foot ? el('div', { class: 'dlg-foot' }, foot) : null));
    root.hidden = false;
    return { close };
  };

  // colour chooser: preset swatches + custom picker
  function swatches(list, get, set) {
    const wrap = el('div', { class: 'swatches' });
    const custom = el('input', { type: 'color', title: 'Custom colour', value: /^#[0-9a-f]{6}$/i.test(get() || '') ? get() : '#808080', oninput: e => { set(e.target.value); render(); } });
    const render = () => {
      const cur = S.colorOf(list, get());
      wrap.replaceChildren(...list.map(c => {
        const bg = c.hex || (c.id === 'smoke' ? 'linear-gradient(135deg,#8a8c96,#2a2a30)' : 'repeating-conic-gradient(#d8dde2 0 25%,#fff 0 50%) 0 0/10px 10px');
        return el('button', { class: 'sw' + (cur.id === c.id ? ' on' : ''), title: c.name, style: { background: bg }, onclick: () => { set(c.id); render(); } });
      }), el('label', { class: 'sw-custom' + (cur.id === 'custom' ? ' on' : ''), title: 'Custom colour' }, 'Custom', custom),
        el('span', { class: 'note' }, cur.name));
    };
    render();
    return wrap;
  }

  // ------------------------------------------------------------------ editor
  const editor = S.editor = {
    open(album) {
      const mode = S.app.mode;
      const work = JSON.parse(JSON.stringify(album));
      let candidates = [];
      const status = el('span', { class: 'note' });
      const fields = {};
      const input = (key, label, cls = '') => {
        const i = el('input', { value: work[key] || '', oninput: e => { work[key] = e.target.value; } });
        fields[key] = i;
        return el('label', { class: cls }, label, i);
      };
      const form = el('div', { class: 'form' },
        input('artist', 'Artist', 'w2'), input('title', 'Album / title', 'w2'),
        input('year', 'Year'), input('label', 'Label'), input('catno', 'Catalog #'), input('discogs_id', 'Discogs release ID'), input('mbid', 'MusicBrainz release ID', 'w2'));

      // ---- format: release type, disc size, colour, picture disc
      const fmt = el('div', { class: 'fmt' });
      const renderFormat = () => {
        const info = S.releaseInfo(work, mode);
        const typeSel = el('select', { onchange: e => { work.release_type = e.target.value; S.normalizeSides(work, mode); renderTracks(); renderFormat(); } },
          el('option', { value: 'album' }, mode === 'vinyl' ? 'Album (12" LP)' : 'Album'),
          el('option', { value: 'single', disabled: !info.canSingle }, mode === 'vinyl' ? 'Single (7")' : 'Single'),
          el('option', { value: 'maxi', disabled: !info.canMaxi }, mode === 'vinyl' ? 'Maxi single (12" at 45)' : 'Maxi single'));
        typeSel.value = info.type;
        const hint = mode === 'vinyl' ? 'A single is a 7" 45 and holds at most 2 songs (two songs = one per side); a maxi single is a 12" at 45 rpm with up to 6 tracks.'
          : 'Single and maxi single are available for releases with 6 tracks or fewer.';
        const rows = [el('label', {}, 'Release type', typeSel), el('div', { class: 'note' }, hint)];
        if (mode === 'cd') {
          const size = el('select', { onchange: e => { work.disc_size = e.target.value; renderFormat(); } },
            el('option', { value: '' }, 'Automatic'), el('option', { value: '5' }, '5" disc'), el('option', { value: '3', disabled: !info.can3in || S.sideCount(work, 'cd') > 1 }, '3" disc (22 minutes or less, one disc)'));
          size.value = work.disc_size || '';
          rows.push(el('label', {}, 'Disc size', size), el('div', { class: 'note' }, `Total running time: ${S.fmt(info.total)}. A 3" disc holds up to 22 minutes, a 5" disc 80.`));
        }
        // how many records / tapes / discs the release spans, and the playing-time limit that decides the split
        if (info.type === 'album' || mode === 'cd') {
          const per = mode === 'cd' ? 1 : 2, max = mode === 'cd' ? 8 : 4, cur = Math.ceil(S.sideCount(work, mode) / per);
          const noun = mode === 'cd' ? 'disc' : mode === 'cassette' ? 'tape' : 'record';
          const first = S.SIDE_LETTERS;
          const sel = el('select', { onchange: e => { work.sides = +e.target.value * per; renderTracks(); renderFormat(); renderSlots(); } },
            Array.from({ length: max }, (_, i) => i + 1).map(n => el('option', { value: n }, mode === 'cd' ? (n === 1 ? '1 disc' : `${n} discs`) : n === 1 ? `1 ${noun} (sides A, B)` : `${n} ${noun}s (sides A–${first[n * 2 - 1]})`)));
          sel.value = cur;
          const used = Math.max(0, ...work.tracks.map(t => S.SIDE_LETTERS.indexOf((t.side || 'A').toUpperCase()))) + 1;
          const maxUsed = Math.ceil(used / per);
          [...sel.options].forEach(o => { o.disabled = +o.value < maxUsed; });
          const lim = S.sideLimit(work, mode);
          rows.push(el('label', {}, mode === 'cd' ? 'Discs in this release' : mode === 'cassette' ? 'Tapes in this release' : 'Records in this release', sel));
          if (mode === 'vinyl') {
            const mins = el('input', { type: 'number', min: 5, max: 60, step: 1, value: work.side_minutes || 25, style: { width: '80px' }, onchange: e => { work.side_minutes = Math.max(5, Math.min(60, +e.target.value || 25)); if (work.side_minutes === 25) work.side_minutes = 0; renderFormat(); renderTracks(); } });
            rows.push(el('label', {}, 'Minutes per side (limit)', mins), el('div', { class: 'note' }, `A side normally holds up to 25 minutes; change it here to override. Long playlists are split into as many sides as the limit needs (now ${lim / 60} min). Every side gets its own label image below; put each track on its side in the Tracks list. While playing, Digi-Deck flips the record, then swaps in the next one.`));
          } else if (mode === 'cassette') rows.push(el('div', { class: 'note' }, 'A tape holds 90 minutes (45 a side). Longer playlists are split across several tapes; every side gets its own label image below. While playing, Digi-Deck flips the tape, then swaps in the next one.'));
          else rows.push(el('div', { class: 'note' }, 'A CD holds 80 minutes. Longer playlists, and multi-disc albums, use several discs; every disc gets its own label image below. Put each track on its disc in the Tracks list.'));
        }
        if (mode === 'vinyl') {
          const pd = el('input', { type: 'checkbox', onchange: e => { work.picture_disc = e.target.checked; renderFormat(); renderSlots(); } });
          pd.checked = !!work.picture_disc;
          rows.push(el('div', { class: 'sec' }, 'Record colour'), swatches(S.VINYL_COLORS, () => work.color, v => { work.color = v; }),
            el('label', { class: 'chk' }, pd, ' Picture disc (full-disc image with the song grooves drawn on top; choose the images under Artwork)'));
        }
        if (mode === 'cassette') rows.push(el('div', { class: 'sec' }, 'Tape / shell colour'), swatches(S.TAPE_COLORS, () => work.color, v => { work.color = v; }));
        fmt.replaceChildren(...rows);
      };

      // ---- release picker
      const refIn = el('input', { placeholder: 'Paste a Discogs / MusicBrainz release URL or ID to use that exact release' });
      const hits = el('div', { class: 'hits' });
      const useTitles = el('input', { type: 'checkbox' });
      const applyRelease = async (source, id) => {
        status.textContent = 'Fetching release…';
        try {
          const r = await window.api.fetchRelease(mode, source, id, work.artist, work.title);
          Object.assign(work, { artist: r.meta.artist || work.artist, title: r.meta.title || work.title, year: r.meta.year || work.year, label: r.meta.label || work.label, catno: r.meta.catno || work.catno, discogs_id: r.meta.discogs_id || work.discogs_id, mbid: r.meta.mbid || work.mbid, is_generic: false });
          if (r.tracklist.length) {
            const tl = r.tracklist;
            work.tracks = await window.api.assignSides(mode, work.tracks, tl);
            if (r.sides && mode !== 'cd') work.sides = Math.max(work.sides | 0, r.sides);
            work.sides = Math.max(work.sides | 0, S.unitLetters(work, mode).length === 1 ? 0 : S.unitLetters(work, mode).length);
            if (useTitles.checked && tl.length === work.tracks.length) work.tracks.forEach((t, i) => { t.title = tl[i].title || t.title; });
          }
          for (const [slot] of S.slotsFor(mode, work)) { const p = r.picks[slot]; if (p) work[slot] = p.url; }
          S.normalizeSides(work, mode);
          candidates = r.candidates; refreshAll();
          status.textContent = `Applied ${source} release ${id}.`;
        } catch (e) { status.textContent = 'Could not fetch that release: ' + e.message; }
      };
      const search = async () => {
        status.textContent = 'Searching…'; hits.replaceChildren();
        try {
          const list = await window.api.searchReleases(work.artist, work.title, mode);
          status.textContent = list.length ? `${list.length} releases found - click one to use it.` : 'No releases found. Try changing the artist/title, or paste an ID.';
          list.forEach(h => hits.append(el('div', { class: 'hit', onclick: () => applyRelease(h.source, h.id) },
            el('span', { class: 'src ' + h.source }, h.source === 'discogs' ? 'Discogs' : 'MusicBrainz'),
            el('div', {}, `${h.artist} – ${h.title}`, el('br'), el('small', {}, [h.year, h.country, h.format, h.label].filter(Boolean).join(' · '))))));
        } catch (e) { status.textContent = 'Search failed: ' + e.message; }
      };
      const relRow = el('div', { class: 'rel-row' }, refIn,
        el('button', { onclick: async () => { const r = await window.api.parseReleaseRef(refIn.value); if (!r) return (status.textContent = 'That is not a Discogs or MusicBrainz release link / ID.'); applyRelease(r.source, r.id); } }, 'Use this release'),
        el('button', { onclick: search }, 'Search releases'));

      // ---- artwork
      const slotsEl = el('div', { class: 'slots' });
      const urlIn = el('input', { placeholder: 'Image URL…', style: { flex: 1 } });
      const urlSlot = el('select');
      const candEl = el('div', { class: 'cands' });
      const setSlot = (slot, val) => { work[slot] = val; renderSlots(); };
      const renderSlots = () => {
        const slots = S.slotsFor(mode, work);
        urlSlot.replaceChildren(...slots.map(([k, n]) => el('option', { value: k }, n)));
        slotsEl.replaceChildren(...slots.map(([k, name]) => {
          const pv = el('div', { class: 'pv' });
          if (work[k]) {
            const im = el('img', { src: S.fileUrl(work[k]) });
            im.onerror = async () => { try { const p = await window.api.cacheArt(work[k]); work[k] = p; im.onerror = null; im.src = S.fileUrl(p); } catch { pv.textContent = 'could not load'; } };
            pv.append(im);
          } else pv.textContent = k.startsWith('pic_') ? 'no picture' : 'generated automatically';
          return el('div', { class: 'slot' }, el('b', {}, name), pv, el('div', { class: 'sb' },
            el('button', { onclick: async () => { const p = await window.api.pickImage(); if (p) setSlot(k, p); } }, 'Choose…'),
            work[k] ? el('button', { onclick: () => setSlot(k, '') }, 'Clear') : null));
        }));
        renderCands();
      };
      const findArt = async () => {
        status.textContent = 'Searching art sources…'; candEl.replaceChildren();
        try {
          candidates = await window.api.findArt(work.artist, work.title, work.mbid, mode);
          status.textContent = candidates.length ? `${candidates.length} images found - choose a slot under any image to use it.` : 'No images found online.';
          renderCands();
        } catch (e) { status.textContent = 'Art search failed: ' + e.message; }
      };
      const renderCands = () => {
        const slots = S.slotsFor(mode, work);
        candEl.replaceChildren(...candidates.map(c => {
          const im = el('img', { src: c.thumb || c.url, loading: 'lazy' });
          im.onerror = async () => { im.onerror = null; try { im.src = S.fileUrl(await window.api.cacheArt(c.url)); } catch {} };
          const sel = el('select', { onchange: e => { if (e.target.value) { setSlot(e.target.value, c.url); e.target.value = ''; } } },
            el('option', { value: '' }, 'Use as…'), slots.map(([k, n]) => el('option', { value: k }, n)));
          return el('div', { class: 'cand' }, im, el('small', {}, c.note || c.source), sel);
        }));
      };

      // ---- tracks
      const tbody = el('tbody');
      const capEl = el('div', { class: 'note cap' });
      const renderCap = () => {                      // playing time per side / disc against the limit
        const lim = S.sideLimit(work, mode), tot = {};
        work.tracks.forEach(t => { const k = t.side || 'A'; tot[k] = (tot[k] || 0) + (t.duration || 0); });
        const word = mode === 'cd' ? 'Disc' : 'Side';
        capEl.replaceChildren(...Object.keys(tot).sort().map(k => {
          const over = lim && tot[k] > lim + 1;
          return el('span', { class: over ? 'over' : '', style: { marginRight: '14px', color: over ? '#ff9b7a' : '' } }, `${word} ${mode === 'cd' ? S.SIDE_LETTERS.indexOf(k) + 1 : k}: ${S.fmt(tot[k])}${over ? ` - over the ${lim / 60} min limit` : ''}`);
        }), lim ? el('span', {}, `(limit ${lim / 60} min per ${mode === 'cd' ? 'disc' : 'side'})`) : null);
      };
      const renderTracks = () => {
        const sideOpts = S.unitLetters(work, mode), word = mode === 'cd' ? 'Disc' : 'Side';
        tbody.replaceChildren(...work.tracks.map((t, i) => el('tr', {},
          el('td', {}, String(i + 1)),
          el('td', {}, el('input', { value: t.title || '', oninput: e => { t.title = e.target.value; } })),
          el('td', {}, el('input', { value: t.artist || '', oninput: e => { t.artist = e.target.value; } })),
          el('td', {}, (() => { const s = el('select', { onchange: e => { t.side = e.target.value; renderTracks(); } }, sideOpts.map(x => el('option', { value: x }, mode === 'cd' ? String(S.SIDE_LETTERS.indexOf(x) + 1) : x))); s.value = t.side || 'A'; return s; })()),
          el('td', {}, S.fmt(t.duration)))));
        renderCap();
      };
      const tbl = el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Title'), el('th', {}, 'Artist'), el('th', {}, mode === 'cd' ? 'Disc' : 'Side'), el('th', {}, 'Time'))), tbody);

      const refreshAll = () => { for (const k of Object.keys(fields)) fields[k].value = work[k] || ''; renderFormat(); renderSlots(); renderTracks(); };

      const body = [
        form,
        el('div', { class: 'sec' }, 'Format'), fmt,
        el('div', { class: 'sec' }, 'Release'), relRow, el('label', { class: 'note' }, useTitles, ' also take track titles from the release (only when the track count matches)'), hits,
        el('div', { class: 'sec' }, 'Artwork'), slotsEl,
        el('div', { class: 'rel-row' }, urlIn, urlSlot, el('button', { onclick: () => { if (urlIn.value.trim()) { setSlot(urlSlot.value, urlIn.value.trim()); urlIn.value = ''; } } }, 'Use URL'), el('button', { onclick: findArt }, 'Find art online')),
        candEl,
        el('div', { class: 'sec' }, 'Tracks', el('button', { onclick: async () => { work.tracks = await window.api.assignSides(mode, work.tracks, null, work.sides | 0, work.side_minutes | 0); const n = S.unitLetters(work, mode).length; work.sides = Math.max(work.sides | 0, n); S.normalizeSides(work, mode); renderTracks(); renderFormat(); renderSlots(); } }, mode === 'cd' ? 'Auto-split discs (80 min)' : mode === 'cassette' ? 'Auto-split tapes (90 min)' : 'Auto-split sides by time')),
        tbl, capEl, status
      ];
      const save = el('button', { class: 'primary', onclick: async () => {
        status.textContent = 'Saving…';
        try {
          S.normalizeSides(work, mode);
          const saved = await window.api.librarySave(mode, work);
          S.dropImageCache();
          if (S.app.album && S.app.album.id === saved.id) await S.app.afterEdit(saved);
          dlg.close();
          S.toast('Saved');
        } catch (e) { status.textContent = 'Could not save: ' + e.message; }
      } }, 'Save');
      const dlg = S.modal(`Edit info – ${mode}`, body, [el('button', { onclick: () => dlg.close() }, 'Cancel'), save]);
      refreshAll();
    }
  };

  // ---------------------------------------------------------------- settings
  // media library folder: scanned for albums, which are filed in the chosen format libraries with art + info downloaded
  function libSection(s, f) {
    const path = el('input', { value: s.libraryPath || '', placeholder: 'Folder with your music (artist/album folders)', readonly: true, style: { flex: '1' } });
    const pick = el('button', { onclick: async () => { const p = await window.api.pickFolder(); if (p) path.value = p; } }, 'Browse…');
    const none = el('button', { onclick: () => { path.value = ''; } }, 'Remove');
    const fmts = ['vinyl', 'cd', 'cassette'], have = new Set(s.libraryFormats || fmts);
    const boxes = fmts.map(k => { const cb = el('input', { type: 'checkbox' }); cb.checked = have.has(k); return [k, cb]; });
    const auto = el('input', { type: 'checkbox' }); auto.checked = !!s.libraryAutoScan;
    f._lib = () => ({ libraryPath: path.value, libraryFormats: boxes.filter(([, cb]) => cb.checked).map(([k]) => k), libraryAutoScan: auto.checked });
    return el('div', { class: 'lib-box' },
      el('div', { class: 'lib-title' }, 'Media library folder'),
      el('div', { class: 'note' }, 'The app scans this folder, finds every album and adds it to the libraries below, downloading the artwork and release info for each format (LP art for vinyl, CD art for CD, cassette art for cassette). Re-scans only look at new or changed folders.'),
      el('div', { style: { display: 'flex', gap: '6px', margin: '6px 0' } }, path, pick, none),
      el('div', { class: 'lib-fmts' }, el('span', { class: 'note' }, 'Add albums to:'), ...boxes.map(([k, cb]) => el('label', {}, cb, ' ' + (k === 'cd' ? 'CD' : k[0].toUpperCase() + k.slice(1))))),
      el('label', { class: 'lib-fmts' }, auto, ' Scan automatically when the app starts'));
  }
  function updSection(s, f) {
    const cb = el('input', { type: 'checkbox' }); cb.checked = s.autoUpdate !== false;
    f._upd = () => ({ autoUpdate: cb.checked });
    return el('div', { class: 'lib-box' }, el('div', { class: 'lib-title' }, 'Updates'),
      el('label', { class: 'lib-fmts' }, cb, ' Check GitHub for new versions and install them automatically'),
      el('div', { class: 'note' }, 'Turn this off to stop all background update checks. You can still use Help > Check for Updates at any time.'));
  }
  function generalSection(s, f) {
    const cb = (checked, text) => { const i = el('input', { type: 'checkbox' }); i.checked = checked; return [i, el('label', { class: 'lib-fmts' }, i, ' ' + text)]; };
    const [fs, fsRow] = cb(!!s.fullscreen, 'Always open in full screen');
    const [sfx, sfxRow] = cb(s.soundFx !== false, 'Sound effects - vinyl needle drop, crackle and lead-out loop; cassette tape hiss and tape saturation');
    f._gen = () => ({ fullscreen: fs.checked, soundFx: sfx.checked });
    return el('div', { class: 'lib-box' }, el('div', { class: 'lib-title' }, 'General'), fsRow, sfxRow,
      el('div', { class: 'note' }, 'Sound effects only colour how the music is played back; turn them off for clean audio. Full screen can also be toggled any time with F11.'));
  }
  S.settingsDialog = async () => {
    const s = await window.api.getSettings();
    const f = {};
    const row = (key, label, ph) => el('label', { class: 'note', style: { display: 'flex', flexDirection: 'column', gap: '3px' } }, label, f[key] = el('input', { value: s[key] || '', placeholder: ph || '' }));
    const body = [
      row('discogsToken', 'Discogs personal access token (needed for Discogs search, side splits and Discogs images) - create one at discogs.com/settings/developers'),
      row('fanartKey', 'fanart.tv API key (optional, adds extra covers and disc art)'),
      row('audiodbKey', 'TheAudioDB API key (the free key 123 is the default)', '123'),
      row('contact', 'Contact email or URL sent to MusicBrainz in the User-Agent (they ask for one)'),
      generalSection(s, f),
      libSection(s, f),
      updSection(s, f),
      el('div', { class: 'note' }, 'Without any keys the app still works: MusicBrainz + Cover Art Archive, TheAudioDB, iTunes and Deezer need no signup.')
    ];
    const collect = async () => { const o = {}; for (const k of Object.keys(f)) if (!k.startsWith('_')) o[k] = f[k].value.trim(); Object.assign(o, f._lib(), f._upd(), f._gen()); await window.api.setSettings(o); return o; };
    const dlg = S.modal('Settings', body, [el('button', { onclick: () => dlg.close() }, 'Cancel'),
      el('button', { onclick: async () => { const o = await collect(); dlg.close(); if (!o.libraryPath) return S.toast('Choose a media library folder first'); S.libScan.start(false); } }, 'Save & scan library now'),
      el('button', { class: 'primary', onclick: async () => { await collect(); dlg.close(); S.toast('Settings saved'); } }, 'Save')], { narrow: true });
  };

  // ------------------------------------------------------------- art viewer
  S.artViewer = {
    async open(album) {
      const big = el('div', { class: 'big' });
      const tabs = el('div', { class: 'tabs' });
      const note = el('div', { class: 'note' });
      const mode = S.app.mode;
      const show = async (k, name) => {
        S.$$('button', tabs).forEach(b => b.classList.toggle('on', b.textContent === name));
        const img = k.startsWith('pic_') ? await S.loadImage(album[k]) : await S.art.get(album, k, mode, k.startsWith('label_') ? k.slice(6).toUpperCase() : 'A');
        big.replaceChildren(img ? (img instanceof HTMLImageElement ? el('img', { src: img.src }) : img) : el('div', { class: 'note' }, 'No image set.'));
        note.textContent = album[k] ? '' : 'Nothing saved for this slot - showing generated artwork. Use Edit info to add one.';
      };
      S.slotsFor(mode, album).forEach(([k, n]) => tabs.append(el('button', { onclick: () => show(k, n) }, n)));
      S.modal('Artwork', el('div', { class: 'artview' }, tabs, big, note));
      show('front', 'Front');
    }
  };
})(window.S);
