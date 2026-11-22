// App controller: mode picker, opening music, playback, playlist panel, animation loop.
(function (S) {
  const $ = S.$, el = S.el;

  const A = S.app = {
    mode: null, album: null, scan: null, stage: null, cur: -1, stopped: true, flipping: false, finished: false,
    audio: new Audio(), token: 0, pendingSeek: 0, seeking: false, cumAll: [], cumSide: [], sideTotals: {}, total: 0, last: 0,

    async init() {
      A.audio.preload = 'auto'; A.audio.volume = 0.8;
      A.audio.addEventListener('ended', () => A.next(true));
      A.audio.addEventListener('loadedmetadata', () => { if (A.pendingSeek) { A.audio.currentTime = A.pendingSeek; A.pendingSeek = 0; } });
      A.audio.crossOrigin = 'anonymous';
      A.audio.addEventListener('playing', () => { if (/^ddmedia:/.test(A.audio.src) && S.meter.ok) { S.meter.attach(A.audio); S.meter.resume(); } });
      A.audio.addEventListener('error', () => {
        const cur = A.album?.tracks[A.cur];
        if (/^ddmedia:/.test(A.audio.src) && cur && !A._retried) { S.meter.ok = false; A._retried = true; A.audio.src = S.fileUrl(cur.path); A.audio.removeAttribute('crossorigin'); A.audio.play().catch(() => {}); return; }
        if (A.audio.src) { S.toast('Could not play: ' + (A.album?.tracks[A.cur]?.title || 'file')); A.next(true); } });
      A.cfg = await window.api.getSettings().catch(() => ({})); A.applyTheme();
      window.api.onSettingsChanged && window.api.onSettingsChanged(async () => { A.cfg = await window.api.getSettings().catch(() => ({})); A.applyFx(); A.applyTheme(); });
      A.swapBtn = el('button', { class: 'swap-btn', hidden: true, onclick: () => A.manualSwap() });
      $('#stage').append(A.swapBtn);
      S.libScan.init();
      window.api.onStatus(m => { $('#status').textContent = m || ''; });

      S.$$('.mode-card').forEach(b => b.addEventListener('click', () => A.startMode(b.dataset.mode)));
      S.$$('#modeSeg button').forEach(b => b.addEventListener('click', () => A.setMode(b.dataset.mode)));
      $('#openFiles').onclick = () => A.openDialog('files');
      $('#openFolder').onclick = () => A.openDialog('folder');
      $('#openPlaylist').onclick = () => A.openDialog('playlist');
      $('#btnLibrary').onclick = () => S.shelf.open();
      $('#btnAlbums').onclick = () => S.albumList.open();
      $('#btnCreate').onclick = () => (A.album ? S.artCreator.open() : S.toast('Open an album first - the design is made for its artwork slots'));
      $('#btnClear').onclick = () => A.clearPlaylist();
      $('#btnInfo').onclick = () => (A.album ? S.editor.open(A.album) : S.toast('Open something first'));
      $('#btnArt').onclick = () => (A.album ? S.artViewer.open(A.album) : S.toast('Open something first'));
      $('#btnSettings').onclick = () => S.settingsDialog();
      window.api.onMenuSettings && window.api.onMenuSettings(() => S.settingsDialog());
      $('#tPlay').onclick = () => A.togglePlay();
      $('#tPrev').onclick = () => A.prev();
      $('#tNext').onclick = () => A.next();
      $('#tVol').oninput = e => { A.audio.volume = e.target.value / 100; S.fx.vol(A.audio.volume); };
      const seek = $('#tSeek');
      seek.addEventListener('input', () => { A.seeking = true; });
      seek.addEventListener('change', () => {
        const d = A.trackDuration();
        if (d) A.audio.currentTime = (seek.value / 1000) * d;
        A.seeking = false;
      });
      window.addEventListener('keydown', e => {
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
        if (!$('#modal').hidden || !$('#shelf').hidden) return;
        if (e.code === 'Space') { e.preventDefault(); A.togglePlay(); }
        else if (e.key === 'n' || e.key === 'N') A.next();
        else if (e.key === 'p' || e.key === 'P') A.prev();
      });
      // drag & drop (files, folders, playlists)
      const host = $('#stage');
      ['dragenter', 'dragover'].forEach(t => window.addEventListener(t, e => { e.preventDefault(); if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) host.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(t => window.addEventListener(t, e => { e.preventDefault(); if (t === 'drop' || e.target === document.documentElement) host.classList.remove('drag'); }));
      window.addEventListener('drop', async e => {
        host.classList.remove('drag');
        const paths = [...e.dataTransfer.files].map(f => window.api.pathForFile(f)).filter(Boolean);
        if (paths.length && A.mode) A.openDialog('drop', paths);
      });
      requestAnimationFrame(A.tick);
    },

    // unload the current playlist/album (the library is untouched)
    // An unidentified playlist (not in the library yet): ask whether to keep it before it is replaced.
    async confirmKeep() {
      const a = A.album;
      if (A.building) return true;                       // building a playlist: the user already chose whether to save it
      if (!a || !a.pending || a.id) return true;
      const st = await window.api.getSettings();
      const policy = st.unidentifiedSave || 'ask';
      if (policy === 'never') return true;
      const doSave = async () => { const saved = await window.api.librarySave(A.mode, a); S.dropImageCache && S.dropImageCache(); return saved; };
      if (policy === 'always') { await doSave(); return true; }
      return new Promise(res => {
        const rem = S.el('input', { type: 'checkbox' });
        let settled = false;
        const done = async (act, ok) => {
          settled = true; dlg.close();
          if (rem.checked && act !== 'cancel') window.api.setSettings({ unidentifiedSave: act === 'save' ? 'always' : 'never' });
          if (act === 'save') { try { await doSave(); S.toast('Saved to the library'); } catch (e) { S.toast('Could not save: ' + e.message); } }
          res(ok);
        };
        const dlg = S.modal('Save to library?', [
          S.el('p', {}, `"${a.title || a.artist || 'This playlist'}" has no album information. Save it to the ${A.mode === 'micro' ? 'microcassette' : A.mode === 'dat' ? 'DAT' : A.mode === 'reel' ? 'reel to reel' : A.mode === 'md' ? 'MiniDisc' : A.mode} library before it is closed?`),
          S.el('label', { class: 'note' }, rem, ' Remember my choice (change it later in Settings)')],
          [S.el('button', { onclick: () => done('cancel', false) }, 'Cancel'), S.el('button', { onclick: () => done('discard', true) }, "Don't save"), S.el('button', { class: 'primary', onclick: () => done('save', true) }, 'Save to library')],
          { narrow: true, onClose: () => { if (!settled) res(false); } });
      });
    },

    async clearPlaylist() {
      if (!A.album) { S.toast('Nothing to clear'); return; }
      if (A.albumList) S.albumList.stopList();
      if (!(await A.confirmKeep())) return;
      // an album from the library that has been stopped is put back in its packaging first
      const T = S.transit, back = T && T.enabled() && T[A.mode + 'Back'];
      if (back && A.album.id && A.audio.paused && !A.clearing) { A.clearing = true; try { await back(A.album); } catch (e) { console.error(e); } A.clearing = false; }
      A.audio.pause(); A.audio.removeAttribute('src'); try { A.audio.load(); } catch {}
      A.building = null;
      A.token++; A.album = null; A.scan = null; A.cur = -1; A.stopped = true; A.finished = false; A.pendingSeek = 0; A.cumAll = []; A.cumSide = []; A.sideTotals = {};
      A.mountStage(); A.renderPlaylist();
      $('#empty').hidden = false;
      S.toast('Playlist cleared');
    },

    applyTheme(t) { const th = t || (A.cfg && A.cfg.theme) || 'metal'; document.body.dataset.theme = th; S.skin && S.skin.apply(th); },
    applyFx() { S.fx.setMode(A.mode, A.cfg || {}); if (!S.fx.vinyl && !S.fx.tape) { A.vphase = null; S.fx.stopAll(); } },
    startMode(mode) {
      A.mode = mode; A.applyFx();
      $('#picker').hidden = true; $('#app').hidden = false;
      A.mountStage();
      S.$$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    },
    mountStage() {
      if (A.stage) A.stage.destroy();
      A.stage = new S.stages[A.mode]($('#stage'));
      A.stage.layout();
    },

    MODE_NAMES: { vinyl: 'vinyl', cd: 'CD', cassette: 'cassette', micro: 'microcassette', reel: 'reel to reel', md: 'MiniDisc', dat: 'DAT' },
    // the same album in another player's library: same key, or the same title and artist
    async findSame(mode, a) {
      const list = await window.api.libraryList(mode).catch(() => []), n = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      return list.find(r => a.key && r.key === a.key) || list.find(r => n(r.title) && n(r.title) === n(a.title) && n(r.artist) === n(a.artist)) || null;
    },
    // Switching players: the album is not carried across. If the new player's library has the same album it is loaded (and keeps
    // playing from the same song and time if it was playing); if not, the player is left empty and the user is asked whether to
    // make the album in that format too.
    async setMode(mode) {
      if (mode === A.mode) return;
      if (A.album && !(await A.confirmKeep())) return;
      if (A.albumList) S.albumList.stopList();                  // an album list belongs to one player's library
      const old = A.album, oldScan = A.scan || (old && A.scanFromAlbum(old));
      const snap = old ? { path: old.tracks[A.cur] && old.tracks[A.cur].path, cur: A.cur, time: A.audio.currentTime, playing: !A.audio.paused && !A.stopped } : null;
      A.audio.pause(); A.audio.removeAttribute('src'); try { A.audio.load(); } catch {}
      A.token++; A.vphase = null; S.fx.stopAll();
      A.building = null; A.album = null; A.scan = null; A.cur = -1; A.stopped = true; A.finished = false; A.pendingSeek = 0; A.cumAll = []; A.cumSide = []; A.sideTotals = {};
      A.mode = mode; A.applyFx();
      S.$$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
      A.mountStage(); A.renderPlaylist(); $('#empty').hidden = false;
      if (!old) return;
      const same = await A.findSame(mode, old);
      if (A.mode !== mode) return;
      const resume = async () => {
        if (!A.album) return;
        const i = Math.max(0, A.album.tracks.findIndex(t => t.path === snap.path));
        if (snap.playing) await A.playIndex(i, snap.time);
      };
      if (same) { await A.openLibraryAlbum(same.id, { autoplay: false, confirmed: true }); return resume(); }
      const name = A.MODE_NAMES[mode] || mode;
      const yes = await A.ask(`Not in your ${name} library`, `"${old.title || 'This album'}"${old.artist ? ' by ' + old.artist : ''} isn't in your ${name} library yet. Would you like to make it in this format as well?`, [['No thanks', false], ['Make it', true, true]]);
      if (!yes || A.mode !== mode) return;
      await A.openScan(oldScan, { keep: true, autoplay: false });
      if (A.album && !A.album.id && !A.isLoose(A.album)) { try { const sv = await window.api.librarySave(mode, { ...A.album, pending: false }); if (sv && sv.id) A.album.id = sv.id; S.toast(`Added to the ${name} library`); } catch (e) { S.toast('Could not save: ' + e.message); } }
      await resume();
    },

    scanFromAlbum(a) {
      return {
        kind: a.kind, key: a.key, name: a.title, artist: a.artist, title: a.title, year: a.year, source: a.source_path, albumTag: '',
        tracks: a.tracks.map(t => ({ path: t.path, title: t.title, artist: t.artist, duration: t.duration, side: 'A' })),
        localArt: { front: a.front, back: a.back, jcard: a.jcard }, embedded: ''
      };
    },

    async openDialog(kind, paths) {
      if (!A.mode) return;
      try {
        const scan = await window.api.scan(kind, paths);
        if (!scan) return;
        if (await A.maybeBuild(scan)) return;
        await A.openScan(scan, { autoplay: true });
      } catch (e) { S.toast('Could not open: ' + e.message); $('#status').textContent = ''; }
    },

    // ---- playlist building ----
    // When songs are opened while the playlist already holds songs that are not an album, the user is asked whether they are
    // making a playlist. If so the new songs are added to the end (nothing is cleared until Clear or a library album), the user
    // may save it to the library under a name, and the saved playlist is kept up to date on every add and every reorder.
    isLoose(a) { return !!a && a.tracks && a.tracks.length > 0 && (a.kind !== 'album' || a.is_generic); },
    ask(title, text, buttons) {
      return new Promise(res => {
        let done = false;
        const dlg = S.modal(title, [S.el('p', {}, text)], buttons.map(([label, val, primary]) => S.el('button', { class: primary ? 'primary' : '', onclick: () => { done = true; dlg.close(); res(val); } }, label)), { narrow: true, onClose: () => { if (!done) res(null); } });
      });
    },
    askName(def) {
      return new Promise(res => {
        let done = false;
        const inp = S.el('input', { value: def || '', style: { width: '100%' }, onkeydown: e => { if (e.key === 'Enter') ok(); } });
        const ok = () => { const v = inp.value.trim(); if (!v) return inp.focus(); done = true; dlg.close(); res(v); };
        const dlg = S.modal('Name this playlist', [S.el('label', {}, 'Name', inp)], [S.el('button', { onclick: () => { done = true; dlg.close(); res(null); } }, 'Cancel'), S.el('button', { class: 'primary', onclick: ok }, 'Save')], { narrow: true, onClose: () => { if (!done) res(null); } });
        setTimeout(() => { inp.focus(); inp.select(); }, 50);
      });
    },
    async maybeBuild(scan) {
      if (!A.isLoose(A.album) || !scan.tracks || !scan.tracks.length) return false;
      if (!A.building) {
        const yes = await A.ask('Making a playlist?', 'There are already songs in the playlist. Are you making a playlist? The new songs will be added to the end.', [['No - replace them', false], ['Yes, add them', true, true]]);
        if (yes == null) return true;                  // dialog closed: do nothing
        if (!yes) return false;
        A.building = { save: false };
        if (A.album.id && (A.album.key || '').startsWith('playlist:')) A.building.save = true;      // a playlist already in the library: keep it updated
        const save = A.building.save ? false : await A.ask('Save the playlist?', 'Would you like to save this playlist in the library? It will be kept up to date as you add and move songs.', [['No', false], ['Save it', true, true]]);
        if (save) {
          const name = await A.askName(A.album.id && A.album.kind === 'set' ? A.album.title : 'My playlist');
          if (name) { A.building.save = true; A.album.title = name; A.album.artist = A.album.artist || 'Various Artists'; }
        }
      }
      await A.appendTracks(scan.tracks);
      return true;
    },
    async appendTracks(tracks) {
      const a = A.album, have = new Set(a.tracks.map(t => t.path));
      const add = tracks.filter(t => t.path).map(t => ({ path: t.path, title: t.title, artist: t.artist, duration: t.duration }));
      if (!add.length) return;
      a.kind = 'set'; a.is_generic = a.is_generic !== false ? true : a.is_generic;
      await A.reflow([...a.tracks, ...add]);
      S.toast(`${add.length} song${add.length === 1 ? '' : 's'} added to the playlist`);
    },
    // new track order: sides/discs are worked out again, the player is refreshed, playback carries on, and the saved copy is updated
    async reflow(tracks) {
      const a = A.album, curPath = a.tracks[A.cur]?.path;
      const plain = tracks.map(t => ({ ...t, side: undefined }));
      let assigned = plain;
      try { assigned = await window.api.assignSides(A.mode, plain, null, 0, 0); } catch {}
      a.tracks = assigned; a.sides = 0;
      await A.saveBuilding();
      await A.afterEdit(A.album);
      const ni = A.album.tracks.findIndex(t => t.path === curPath); if (ni >= 0) A.cur = ni;
      A.highlight();
    },
    async saveBuilding() {
      if (!A.building || !A.building.save) return;
      const a = A.album;
      if (!a.key || !a.key.startsWith('playlist:')) a.key = 'playlist:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      try {
        const saved = await window.api.librarySave(A.mode, { ...a, pending: false, kind: 'set', tracks: a.tracks.map(({ missing, ...t }) => t) });
        if (saved) { a.id = saved.id; a.pending = false; }
      } catch (e) { S.toast('Could not save the playlist: ' + e.message); }
    },
    moveTrack(from, to) {
      const tr = A.album.tracks.slice(), [m] = tr.splice(from, 1); tr.splice(to > from ? to - 1 : to, 0, m);
      return A.reflow(tr);
    },

    async openScan(scan, opts = {}) {
      if (!opts.keep && A.album && A.album.pending && !(await A.confirmKeep())) return;
      A.scan = scan;
      try {
        const album = await window.api.resolve(A.mode, scan, !!opts.force);
        await A.loadAlbum(album, opts);
      } catch (e) { S.toast('Could not open: ' + e.message); }
      $('#status').textContent = '';
    },

    // Play in the library: the album comes out of its packaging first (when there is an animation for this player)
    async playFromLibrary(id, from, closeShelf) {
      const T = S.transit, fn = T && T.enabled() && T[A.mode + 'Out'];
      if (!fn || !from || !from.width) { closeShelf(); return A.openLibraryAlbum(id); }
      if (!(await A.confirmKeep())) return;
      const album = await window.api.libraryLoad(A.mode, id);
      if (!album) { closeShelf(); return S.toast('That entry no longer exists'); }
      S.normalizeSides(album, A.mode);
      A.audio.pause();
      // watchdog: an animation that has not finished after 30 s is cut short (finished at once, then removed)
      const dog = setTimeout(() => { const r = T._run; console.error('library animation took too long - skipped'); if (r) { r.finish(); setTimeout(() => { if (T._run === r) r.end(); }, 1500); } }, 30000);
      try { await fn(album, from, async () => { closeShelf(); await A.openLibraryAlbum(id, { autoplay: false, confirmed: true }); }); }
      catch (e) { console.error(e); if (!A.album || A.album.id !== id) { closeShelf(); await A.openLibraryAlbum(id, { autoplay: false, confirmed: true }); } }
      finally { clearTimeout(dog); }
      // whatever happened, the player ends up with its record / disc / tape showing and ready
      if (A.stage) { A.stage.quiet = false; if (A.stage.waiting && A.stage.finishArrive) await A.stage.finishArrive(); if (A.stage.hideRecord) A.stage.hideRecord(false); }
      if (A.album && A.album.id === id) await A.playIndex(0);
    },

    async openLibraryAlbum(id, opts = {}) {
      if (!opts.confirmed && !(await A.confirmKeep())) return;
      A.building = null;
      const album = await window.api.libraryLoad(A.mode, id);
      if (!album) return S.toast('That entry no longer exists');
      A.scan = A.scanFromAlbum(album);
      const missing = album.tracks.filter(t => t.missing).length;
      if (missing) S.toast(`${missing} file(s) can't be found on disk - re-open the folder/playlist to relink them`);
      await A.loadAlbum(album, { autoplay: opts.autoplay !== false });
    },

    computeCum() {
      const tr = A.album.tracks; let all = 0; const side = {};
      A.cumAll = []; A.cumSide = []; A.sideTotals = {};
      tr.forEach(t => {
        const d = t.duration || 0;
        A.cumAll.push(all); all += d;
        side[t.side] = side[t.side] || 0; A.cumSide.push(side[t.side]); side[t.side] += d;
      });
      A.total = all; A.sideTotals = side;
    },

    async loadAlbum(album, { autoplay = true, startIndex = 0, startTime = 0 } = {}) {
      A.audio.pause(); A.token++;
      S.normalizeSides(album, A.mode);
      A.album = album; A.finished = false; A.cur = -1; A.stopped = true;
      A.computeCum();
      $('#empty').hidden = true;
      await A.stage.setAlbum(album);
      A.renderPlaylist();
      if (autoplay) await A.playIndex(startIndex, startTime);
      else { A.cur = startIndex; A.highlight(); }
    },

    async afterEdit(saved) { // album edited in the editor: refresh visuals, keep playing
      const curPath = A.album?.tracks[A.cur]?.path;
      saved.tracks = saved.tracks.map(t => ({ ...t, missing: false }));
      S.normalizeSides(saved, A.mode);
      A.album = saved; A.computeCum();
      await A.stage.setAlbum(saved);
      const ni = saved.tracks.findIndex(t => t.path === curPath);
      A.cur = ni; A.renderPlaylist(); A.highlight();
      if (ni >= 0 && A.stage.currentSide() !== saved.tracks[ni].side) A.stage.flipTo(saved.tracks[ni].side);
    },

    async playIndex(i, startTime = 0) {
      const a = A.album; if (!a) return;
      if (i < 0 || i >= a.tracks.length) return A.endOfAlbum();
      const t = a.tracks[i], token = ++A.token;
      if (t.missing || !t.path) { S.toast(`Skipping missing file: ${t.title}`); return A.playIndex(i + 1); }
      if (A.stage.ensureLoaded && A.stage.ejected) await A.stage.ensureLoaded();           // microcassette: tape slides back in first
      if (token !== A.token) return;
      const wasStopped = A.stopped || A.finished, prevCur = A.cur, auto = A.autoNext; A.autoNext = false;
      A.vphase = null; S.fx.leadOut(false);
      A.cur = i; A.stopped = false; A.finished = false; A.highlight();
      if (A.stage.currentSide() !== t.side) {
        A.audio.pause(); A.flipping = true; if (S.isTape(A.mode) && S.fx.tape) S.fx.hiss('off');
        await A.stage.flipTo(t.side);
        A.flipping = false;
        if (token !== A.token) return;
      }
      // DAT: skipping to another track on the same tape searches (fast-forwards / rewinds) for about a second and a half first
      if (A.stage.search && !auto && !wasStopped && prevCur >= 0 && prevCur !== i && a.tracks[prevCur] && a.tracks[prevCur].side === t.side) {
        A.audio.pause(); await A.stage.search(i > prevCur ? 1 : -1, i);
        if (token !== A.token) return;
      }
      const sideStart = !startTime && (i === 0 || a.tracks[i - 1].side !== t.side);
      if (S.fx.vinyl && A.mode === 'vinyl' && S.meter.ensure()) {
        S.meter.resume();
        if (sideStart) {          // the whole needle-drop recording plays, with the needle lowering onto the lead-in, before the first song
          A.vphase = 'leadin'; A.leadStart = performance.now(); A.leadMs = S.fx.DROP_SEC * 1000;
          await S.fx.needleDrop();
          if (token !== A.token) return;
          A.vphase = null;
        } else if (wasStopped || A.audio.paused) S.fx.needleTap();
      } else if (S.fx.tape && S.isTape(A.mode) && S.meter.ensure()) {
        S.meter.resume();
        if (sideStart) {          // ~5 s of leader hiss with the reels turning, then it drops under the music
          A.vphase = 'leader'; S.fx.hiss('up');
          await new Promise(r => setTimeout(r, 5000));
          if (token !== A.token) return;
          A.vphase = null;
        }
        S.fx.hiss('low');
      }
      A.pendingSeek = startTime || 0;
      A._retried = false;
      if (S.meter.ok) { A.audio.crossOrigin = 'anonymous'; A.audio.src = S.mediaUrl(t.path); } else A.audio.src = S.fileUrl(t.path);
      S.meter.resume();
      try { await A.audio.play(); } catch (e) { if (token === A.token && e.name !== 'AbortError' && !A._retried) S.toast('Cannot play: ' + e.message); }   // AbortError: the source changed (a retry) - the error handler reports real failures
    },

    // jump to a position inside a track (used by the draggable stylus)
    seekTo(i, t) {
      if (!A.album) return;
      if (i === A.cur && A.audio.src && !A.stopped && !A.finished) {
        A.audio.currentTime = Math.max(0, t);
        if (A.audio.paused) A.audio.play().catch(() => {});
      } else A.playIndex(i, t);
    },
    volume(delta) {
      A.audio.volume = S.clamp(A.audio.volume + delta, 0, 1);
      $('#tVol').value = Math.round(A.audio.volume * 100); S.fx.vol(A.audio.volume);
    },

    // vinyl: the needle runs into the lead-out (lead-out loop ~3 s) then the side flips; after the last side it stays in the locked groove until Stop
    async runOut(last) {
      const token = ++A.token;
      A.audio.pause(); A.vphase = 'runout'; A.runStart = performance.now(); S.fx.leadOut(true);
      await new Promise(r => setTimeout(r, 6000));
      if (token !== A.token) return;
      if (last && S.albumList.albumEnded()) { A.vphase = null; S.fx.leadOut(false); A.finished = true; A.stopped = true; return; }   // an album list moves on instead of the locked groove
      if (last) { A.vphase = 'locked'; A.finished = true; A.highlight(); }
      else { A.vphase = null; S.fx.leadOut(false); A.playIndex(A.cur + 1); }
    },
    // cassette: the hiss comes back up for ~5 s at the end of a side, then the tape flips (or the album ends)
    async tapeEnd(last) {
      const token = ++A.token;
      A.audio.pause(); A.vphase = 'trail'; S.fx.hiss('up');
      await new Promise(r => setTimeout(r, 5000));
      if (token !== A.token) return;
      A.vphase = null;
      if (last) { S.fx.hiss('off'); A.endOfAlbum(); } else A.playIndex(A.cur + 1);
    },
    endOfAlbum() { A.audio.pause(); A.finished = true; A.stopped = true; A.highlight(); S.albumList.albumEnded(); },
    // turntable START/STOP: stops whatever the record is doing (playing, lead-in, run-out, locked groove); otherwise starts it
    startStop() {
      if (!A.album) return A.openDialog('files');
      const running = !A.audio.paused || A.vphase || A.flipping || (A.finished && A.vphase);
      if (running) { A.stop(); A.flipping = false; } else A.togglePlay();
    },
    togglePlay() {
      if (!A.album) return A.openDialog('files');
      if (A.stopped || A.finished || !A.audio.src) return A.playIndex(A.cur >= 0 && !A.finished ? A.cur : 0);
      if (A.stage && A.stage.ejected) { A.stage.loadTape().then(() => A.audio.play()); return; }
      if (A.audio.paused) A.audio.play(); else A.audio.pause();
    },
    // microcassette EJECT: stop, door opens, tape slides out; pressed again it slides back in
    eject() { if (!A.stage || !A.stage.eject) return; if (A.stage.ejected) A.stage.loadTape(); else { A.stop(); A.stage.eject(); } },
    stop() { A.token++; A.vphase = null; S.fx.stopAll(); A.audio.pause(); try { A.audio.currentTime = 0; } catch {} A.stopped = true; },
    next(fromEnd) {
      if (!A.album) return;
      if (fromEnd && ((A.mode === 'vinyl' && S.fx.vinyl) || (S.isTape(A.mode) && S.fx.tape))) {
        const tr = A.album.tracks, last = A.cur + 1 >= tr.length;
        if (last || tr[A.cur + 1].side !== tr[A.cur].side) return A.mode === 'vinyl' ? A.runOut(last) : A.tapeEnd(last);
      }
      if (A.cur + 1 >= A.album.tracks.length) { if (fromEnd) A.endOfAlbum(); return; } A.autoNext = !!fromEnd; A.playIndex(A.cur + 1); },
    prev() { if (!A.album) return; if (A.audio.currentTime > 3 || A.cur <= 0) { A.audio.currentTime = 0; if (A.stopped) A.playIndex(Math.max(0, A.cur)); } else A.playIndex(A.cur - 1); },

    async manualFlip() {
      if (!A.album || S.isDisc(A.mode) || A.flipping) return;
      const sides = S.sidesOf(A.album.tracks); if (sides.length < 2) return;
      const cur = A.stage.currentSide(), pair = S.partnerSide(cur);
      // cassette: FLIP turns the tape over (A<->B); changing tapes has its own button. Vinyl keeps cycling through the set.
      const next = S.isTape(A.mode) ? (sides.includes(pair) ? pair : cur) : sides[(sides.indexOf(cur) + 1) % sides.length];
      if (next === cur) return;
      const first = A.album.tracks.findIndex(t => t.side === next);
      A.playIndex(first);
    },

    trackDuration() { const t = A.album?.tracks[A.cur]; return (t && t.duration) || (isFinite(A.audio.duration) ? A.audio.duration : 0); },

    computeState() {
      const a = A.album;
      const vp = { vphase: A.vphase, leadFrac: A.vphase === 'leadin' ? (performance.now() - A.leadStart) / (A.leadMs || 5600) : 0, leadMs: A.leadMs || 5600, runFrac: A.vphase === 'runout' ? (performance.now() - A.runStart) / 6000 : 0 };
      if (!a || A.cur < 0 || A.stopped || A.finished) return { ...vp, playing: false, trackIndex: -1, hasTrack: false, trackTime: 0, trackDur: 0, sideTime: 0, sideFrac: 0, albumFrac: 0 };
      const t = a.tracks[A.cur], dur = A.trackDuration() || 1;
      const time = S.clamp(A.audio.currentTime, 0, dur);
      const sideDur = A.sideTotals[t.side] || dur, sideTime = (A.cumSide[A.cur] || 0) + time;
      return {
        ...vp, playing: !A.audio.paused && !A.flipping && !A.audio.ended, trackIndex: A.cur, hasTrack: true, trackTime: time, trackDur: dur, side: t.side,
        sideTime, sideFrac: sideTime / sideDur, albumFrac: A.total ? ((A.cumAll[A.cur] || 0) + time) / A.total : 0
      };
    },

    tick(ts) {
      const dt = Math.min(0.1, (ts - (A.last || ts)) / 1000); A.last = ts;
      const st = A.computeState();
      if (A.stage && (A.album || A.stage.alwaysRun)) A.stage.frame(dt, st);
      S.fx.surface(A.mode === 'vinyl' && st.playing && !A.vphase);
      if (S.isTape(A.mode) && S.fx.tape) { if (!st.playing && !A.vphase) S.fx.hiss('off'); else if (st.playing && !A.vphase && !S.fx._hiss) S.fx.hiss('low'); }
      if (!A.seeking) {
        const d = A.trackDuration();
        $('#tCur').textContent = S.fmt(st.trackTime); $('#tDur').textContent = S.fmt(d);
        $('#tSeek').value = d ? Math.round((st.trackTime / d) * 1000) : 0;
      }
      $('#tPlay').textContent = st.playing ? '⏸' : '▶';
      requestAnimationFrame(A.tick);
    },

    // CD: change disc / cassette: change tape (vinyl uses its own NEXT RECORD button)
    updateSwapBtn() {
      const n = A.album && A.mode !== 'vinyl' ? S.sideCount(A.album, A.mode) : 0;
      const units = A.album ? new Set(S.sidesOf(A.album.tracks).map(x => S.discOf(x, A.mode))).size : 0;
      A.swapBtn.hidden = !(A.mode !== 'vinyl' && !S.isDisc(A.mode) && units > 1);     // the CD player has its own EJECT key
      if (A.stage && A.stage.setMulti) A.stage.setMulti(units > 1);
      A.swapBtn.textContent = A.mode === 'cd' ? '⏏ CHANGE DISC' : '⏏ CHANGE TAPE';
      A.swapBtn.title = A.mode === 'cd' ? 'Swap in the next disc' : 'Swap in the next tape';
    },
    manualSwap() {
      if (!A.album || A.flipping) return;
      const tr = A.album.tracks, cur = A.stage.currentSide();
      const units = [...new Set(S.sidesOf(tr).map(x => S.discOf(x, A.mode)))].sort((x, y) => x - y);
      if (units.length < 2) return;
      const nu = units[(units.indexOf(S.discOf(cur, A.mode)) + 1) % units.length];
      A.playIndex(tr.findIndex(t => S.discOf(t.side, A.mode) === nu));
    },

    async renderPlaylist() {
      A.updateSwapBtn();
      const pl = $('#playlist'), a = A.album;
      pl.replaceChildren();
      if (!a) return;
      const coverBox = el('div', { class: 'pl-cover' });
      S.art.get(a, 'front', A.mode).then(img => coverBox.replaceChildren(img instanceof HTMLImageElement ? el('img', { src: img.src }) : img));
      const total = A.total;
      pl.append(el('div', { class: 'pl-head' }, coverBox, el('div', { class: 'pl-meta' },
        el('b', {}, a.title || 'Untitled'), el('div', {}, a.artist || 'Unknown artist'),
        el('div', {}, [a.year, a.label].filter(Boolean).join(' · ') || (a.kind === 'set' ? 'Playlist' : '')),
        el('div', {}, `${a.tracks.length} track${a.tracks.length === 1 ? '' : 's'} · ${S.fmt(total)}`),
        el('div', { class: 'pl-spec' }, S.describe(a, A.mode)),
        a.is_generic ? el('div', { class: 'pl-flag' }, a.kind === 'set' ? 'Custom set - generic artwork' : 'No release matched - use Edit info') : null)));
      const list = el('div', { class: 'pl-list' });
      const sides = S.isDisc(A.mode) && S.sidesOf(a.tracks).length < 2 ? [null] : S.sidesOf(a.tracks);
      for (const s of sides) {
        if (s) list.append(el('div', { class: 'side-head' }, el('span', {}, S.isDisc(A.mode) ? `${S.unitNoun(A.mode).toUpperCase()} ${S.SIDE_LETTERS.indexOf(s) + 1}` : `SIDE ${s}`), el('span', {}, S.fmt(A.sideTotals[s] || 0))));
        let n = 0;
        a.tracks.forEach((t, i) => {
          if (s && t.side !== s) return;
          n++;
          const num = S.isDisc(A.mode) ? String(s ? n : i + 1).padStart(2, '0') : `${t.side}${n}`;
          const row = el('div', { class: 'tr' + (t.missing ? ' missing' : ''), 'data-i': i, onclick: () => A.playIndex(i) },
            el('span', { class: 'n' }, num), el('span', { class: 't' }, t.title, t.artist && t.artist !== a.artist ? el('small', {}, t.artist) : null), el('span', { class: 'd' }, S.fmt(t.duration)));
          if (A.isLoose(a)) {                             // a playlist (not an album): drag songs to change the order
            row.draggable = true; row.title = 'Drag to move this song';
            row.ondragstart = e => { e.dataTransfer.setData('text/x-dd-track', String(i)); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); };
            row.ondragend = () => row.classList.remove('dragging');
            row.ondragover = e => { if (!e.dataTransfer.types.includes('text/x-dd-track')) return; e.preventDefault(); e.stopPropagation(); const r = row.getBoundingClientRect(); row.classList.toggle('drop-above', e.clientY < r.top + r.height / 2); row.classList.toggle('drop-below', e.clientY >= r.top + r.height / 2); };
            row.ondragleave = () => row.classList.remove('drop-above', 'drop-below');
            row.ondrop = e => { const f = e.dataTransfer.getData('text/x-dd-track'); if (f === '') return; e.preventDefault(); e.stopPropagation(); const below = row.classList.contains('drop-below'); row.classList.remove('drop-above', 'drop-below'); const from = +f, to = i + (below ? 1 : 0); if (to !== from && to !== from + 1) A.moveTrack(from, to); };
          }
          list.append(row);
        });
      }
      pl.append(list);
    },
    highlight() {
      S.$$('#playlist .tr').forEach(r => r.classList.toggle('cur', +r.dataset.i === A.cur && !A.finished));
      S.$('#playlist .tr.cur')?.scrollIntoView({ block: 'nearest' });
    }
  };

  window.addEventListener('DOMContentLoaded', () => A.init());
})(window.S);
