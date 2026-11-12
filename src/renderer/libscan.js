// Media-library scan: progress dialog + background status for the folder scanner in the main process.
(function (S) {
  const $ = S.$, el = S.el;
  const L = S.libScan = {
    running: false, ui: null,
    init() { window.api.onLibScan(m => L.onMsg(m)); },
    async start(force = false) {
      const s = await window.api.getSettings();
      if (!s.libraryPath) { S.toast('Choose a media library folder first'); S.settingsDialog(); return; }
      L.show();
      try { await window.api.libScanStart(force); L.running = true; } catch (e) { L.setText(e.message); }
    },
    show() {
      const bar = el('div', { class: 'ls-bar' }, el('i'));
      const cur = el('div', { class: 'ls-cur' }, 'Starting…');
      const log = el('div', { class: 'ls-log' });
      const cancel = el('button', { onclick: async () => { await window.api.libScanCancel(); cancel.disabled = true; L.setText('Cancelling after the current album…'); } }, 'Cancel scan');
      L.ui = { bar, cur, log, cancel };
      const dlg = S.modal('Scanning media library', [bar, cur, log], [cancel, el('button', { class: 'primary', onclick: () => dlg.close() }, 'Hide')], { narrow: true, onClose: () => { L.ui = null; } });
    },
    setText(t) { if (L.ui) L.ui.cur.textContent = t; $('#status').textContent = t; },
    onMsg(m) {
      const u = L.ui;
      if (m.phase === 'finding') { L.running = true; L.setText(m.message); return; }
      if (m.phase === 'error') { if (u) u.log.append(el('div', {}, '⚠ ' + (m.message || 'error'))); if (!L.running) L.setText(m.message); return; }
      if (m.phase === 'scan') {
        L.running = true;
        const pct = m.total ? Math.round(m.done / m.total * 100) : 0;
        if (u) u.bar.firstChild.style.width = pct + '%';
        L.setText(`${m.done}/${m.total} · ${m.message || m.current || ''}`);
      }
      if (m.phase === 'done') {
        L.running = false;
        const txt = `Library scan finished: ${m.albums} albums found, ${m.added} entries added or updated, ${m.unchanged} unchanged${m.failed ? `, ${m.failed} failed` : ''}${m.cancelled ? ' (cancelled)' : ''}.`;
        if (u) { u.bar.firstChild.style.width = '100%'; u.cur.textContent = txt; u.cancel.disabled = true; }
        $('#status').textContent = ''; S.toast(txt);
        if (S.shelf && !$('#shelf').hidden) S.shelf.reload();
      }
    }
  };
})(window.S);
