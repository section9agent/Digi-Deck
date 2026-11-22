// Album list: a playlist of whole albums from the current player's library, played one after another, in order or shuffled.
// Lists are saved per player (settings.albumLists[mode] = [{ name, ids, shuffle }]). While a list is playing, the end of each
// album (the last side's run-out on vinyl, the last tape's trailer, the last disc) moves straight on to the next album.
(function (S) {
  const el = (...a) => S.el(...a);
  const L = S.albumList = {
    async lists() { const st = await window.api.getSettings().catch(() => ({})); return ((st.albumLists || {})[S.app.mode]) || []; },
    async saveLists(arr) { const st = await window.api.getSettings().catch(() => ({})); const all = { ...(st.albumLists || {}) }; all[S.app.mode] = arr; await window.api.setSettings({ albumLists: all }); },

    // ---- playing
    async start(list) {
      const A = S.app, ids = list.ids.slice();
      if (!ids.length) return S.toast('The album list is empty');
      if (list.shuffle) for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      A.albumList = { mode: A.mode, name: list.name, order: ids, pos: -1 };
      L.badge();
      await L.go(0);
    },
    stopList() { S.app.albumList = null; L.badge(); },
    async go(pos) {
      const A = S.app, R = A.albumList; if (!R || A.mode !== R.mode) return;
      if (pos >= R.order.length) { A.albumList = null; L.badge(); S.toast(`Album list "${R.name}" finished`); return; }
      R.pos = pos; L.badge();
      const id = R.order[pos], T = S.transit, anim = T && T.enabled();
      // the album that just finished goes back in its packaging, then the next one comes out
      if (A.album && A.album.id && anim && T[A.mode + 'Back']) { A.stop(); try { await T[A.mode + 'Back'](A.album); } catch (e) { console.error(e); } }
      if (A.albumList !== R) return;
      A.album = null;
      const lb = document.getElementById('btnLibrary'), r = lb && lb.getBoundingClientRect();
      if (anim && r) await A.playFromLibrary(id, { left: r.left, top: r.top, width: r.width, height: r.height }, () => {});
      else await A.openLibraryAlbum(id, { autoplay: true, confirmed: true });
      S.toast(`Album ${pos + 1} of ${R.order.length}${A.album ? ': ' + (A.album.title || '') : ''}`);
    },
    // called when an album has played to its end; true when the list took over
    albumEnded() {
      const R = S.app.albumList; if (!R) return false;
      setTimeout(() => L.go(R.pos + 1), 600); return true;
    },
    badge() {
      const b = document.getElementById('btnAlbums'), R = S.app.albumList; if (!b) return;
      b.textContent = R ? `Album list ${R.pos + 1}/${R.order.length}` : 'Album list'; b.classList.toggle('on', !!R);
    },

    // ---- the editor
    async open() {
      const A = S.app, lib = await window.api.libraryList(A.mode).catch(() => []), byId = new Map(lib.map(a => [a.id, a]));
      let lists = await L.lists(), cur = lists[0] ? JSON.parse(JSON.stringify(lists[0])) : { name: 'My album list', ids: [], shuffle: false }, curIdx = lists.length ? 0 : -1;
      const name = el('input', { value: cur.name, oninput: e => { cur.name = e.target.value; } });
      const pick = el('select', { onchange: () => { const i = +pick.value; if (i < 0) { cur = { name: 'New album list', ids: [], shuffle: false }; curIdx = -1; } else { cur = JSON.parse(JSON.stringify(lists[i])); curIdx = i; } name.value = cur.name; ord.value = cur.shuffle ? 'shuffle' : 'order'; draw(); } });
      const fillPick = () => { pick.replaceChildren(...lists.map((l, i) => el('option', { value: i }, l.name)), el('option', { value: -1 }, '+ New list')); pick.value = curIdx; };
      const ord = el('select', { onchange: () => { cur.shuffle = ord.value === 'shuffle'; } }, el('option', { value: 'order' }, 'In order'), el('option', { value: 'shuffle' }, 'Shuffle'));
      ord.value = cur.shuffle ? 'shuffle' : 'order';
      const items = el('div', { class: 'al-items' }), found = el('div', { class: 'al-found' });
      const q = el('input', { placeholder: 'Search this player\'s library to add albums…', oninput: () => drawFound() });
      const row = (a, btns) => el('div', { class: 'al-row' }, a && a.front ? el('img', { src: S.fileUrl(a.front) }) : el('span', { class: 'al-noimg' }), el('div', { class: 'al-t' }, el('b', {}, (a && a.title) || '(missing)'), el('span', {}, (a && a.artist) || '')), ...btns);
      const draw = () => {
        items.replaceChildren(...(cur.ids.length ? cur.ids.map((id, i) => row(byId.get(id), [
          el('button', { title: 'Move up', disabled: i === 0, onclick: () => { [cur.ids[i - 1], cur.ids[i]] = [cur.ids[i], cur.ids[i - 1]]; draw(); } }, '▲'),
          el('button', { title: 'Move down', disabled: i === cur.ids.length - 1, onclick: () => { [cur.ids[i + 1], cur.ids[i]] = [cur.ids[i], cur.ids[i + 1]]; draw(); } }, '▼'),
          el('button', { title: 'Remove', onclick: () => { cur.ids.splice(i, 1); draw(); drawFound(); } }, '✕')])) : [el('p', { class: 'note' }, 'No albums yet - add some from the search below.')]));
        fillPick();
      };
      const drawFound = () => {
        const t = q.value.trim().toLowerCase();
        const hits = lib.filter(a => !t || `${a.artist} ${a.title}`.toLowerCase().includes(t)).slice(0, 60);
        found.replaceChildren(...hits.map(a => row(a, [el('button', { class: cur.ids.includes(a.id) ? '' : 'primary', onclick: () => { cur.ids.push(a.id); draw(); drawFound(); } }, cur.ids.includes(a.id) ? '+ again' : '+ Add')])));
      };
      const save = async () => { cur.name = (cur.name || '').trim() || 'My album list'; if (curIdx < 0) { lists.push(cur); curIdx = lists.length - 1; } else lists[curIdx] = cur; await L.saveLists(lists); cur = JSON.parse(JSON.stringify(lists[curIdx])); draw(); S.toast('Album list saved'); };
      const del = async () => { if (curIdx < 0) return; lists.splice(curIdx, 1); await L.saveLists(lists); curIdx = lists.length ? 0 : -1; cur = lists[0] ? JSON.parse(JSON.stringify(lists[0])) : { name: 'My album list', ids: [], shuffle: false }; name.value = cur.name; draw(); };
      draw(); drawFound();
      const playing = A.albumList ? el('p', { class: 'note' }, `Playing "${A.albumList.name}": album ${A.albumList.pos + 1} of ${A.albumList.order.length}. `, el('button', { onclick: () => { L.stopList(); dlg.close(); S.toast('Album list stopped (the current album keeps playing)'); } }, 'Stop the list')) : '';
      const dlg = S.modal('Album list', [
        el('p', { class: 'note' }, 'Line up whole albums from this player\'s library to play one after another. When an album ends - including the last side of a record - the next one comes out and plays.'),
        playing,
        el('div', { class: 'al-head' }, el('label', {}, 'List ', pick), el('label', {}, 'Name ', name), el('label', {}, 'Play ', ord)),
        items, el('div', { class: 'sec' }, 'Add albums'), q, found],
        [el('button', { onclick: del }, 'Delete list'), el('button', { onclick: save }, 'Save list'),
         el('button', { class: 'primary', onclick: async () => { await save(); dlg.close(); L.start(cur); } }, '▶ Play the list')]);
    }
  };
})(window.S);
