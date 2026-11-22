const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const { shell } = require('electron');
const appinfo = require('./appinfo');
const { Updater } = require('./updater');
const path = require('path');
const fs = require('fs');
const { Store } = require('./db');
const { Providers } = require('./providers');
const { Library } = require('./library');
const { scan } = require('./scan');
const { assignSides } = require('./sides');
const { LibraryScanner } = require('./libscan');
const { AUDIO_EXT, PLAYLIST_EXT, isAudio, isPlaylist } = require('./playlists');

let win, store, providers, library, settings, scanner, updater, aboutWin;

// ---- diagnostics: a small log file in the user data folder (Help > Open Log Folder), kept under about 1 MB
let logFile = null;
function log(...parts) {
  try {
    if (!logFile) { const dir = path.join(app.getPath('userData'), 'logs'); fs.mkdirSync(dir, { recursive: true }); logFile = path.join(dir, 'digi-deck.log'); }
    try { if (fs.statSync(logFile).size > 1e6) fs.renameSync(logFile, logFile.replace(/\.log$/, '.old.log')); } catch {}
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${parts.map(p => p instanceof Error ? (p.stack || p.message) : typeof p === 'string' ? p : JSON.stringify(p)).join(' ')}\n`);
  } catch {}
}
process.on('uncaughtException', e => log('main: uncaught', e));
process.on('unhandledRejection', e => log('main: unhandled rejection', e));

// ---- one copy at a time: opening the app again brings the running window forward (and offers a restart if it is stuck)
let hung = false;
const primary = app.requestSingleInstanceLock();
if (!primary) app.exit(0);
app.on('second-instance', async () => {
  log('second launch while running', hung ? '(window not responding)' : '');
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore(); win.show(); win.focus();
  if (hung) askAboutHang(true);
});
let hangAsking = false;
async function askAboutHang(again) {
  if (hangAsking || !win || win.isDestroyed()) return; hangAsking = true;
  const r = await dialog.showMessageBox({ type: 'warning', title: 'Digi-Deck is not responding', message: 'Digi-Deck is not responding.',
    detail: (again ? 'It is still running, but the window is stuck. ' : '') + 'You can wait a little longer, reload the window (your library is kept), or quit.\n\nWhat happened has been written to the log (Help > Open Log Folder).',
    buttons: ['Reload window', 'Wait', 'Quit'], defaultId: 0, cancelId: 1, noLink: true });
  hangAsking = false;
  if (r.response === 0 && win && !win.isDestroyed()) { log('user chose: reload window'); hung = false; try { win.webContents.forcefullyCrashRenderer(); } catch {} win.webContents.reload(); }
  else if (r.response === 2) { log('user chose: quit'); app.exit(0); }
}
const defaults = { discogsToken: '', fanartKey: '', audiodbKey: '123', contact: '', lastMode: '', libraryPath: '', libraryFormats: ['vinyl', 'cd', 'cassette', 'micro', 'reel', 'md', 'dat'], libraryAutoScan: false, autoUpdate: true, fullscreen: false, soundFx: true };

function settingsFile() { return path.join(app.getPath('userData'), 'settings.json'); }
function loadSettings() {
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { return { ...defaults }; }
}
function saveSettings(s) {
  const fsChanged = 'fullscreen' in s && !!s.fullscreen !== !!(settings && settings.fullscreen);
  settings = { ...settings, ...s };
  if (fsChanged && win && !win.isDestroyed()) win.setFullScreen(!!settings.fullscreen);
  if (win && !win.isDestroyed()) win.webContents.send('settings:changed');
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2)); buildMenu(); return settings; }
const status = msg => win && !win.isDestroyed() && win.webContents.send('status', msg);

// ddmedia:// serves local audio with CORS headers so Web Audio can analyse it (file:// media would be silenced by the analyser)
protocol.registerSchemesAsPrivileged([{ scheme: 'ddmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
// ---- Apple Lossless: Chromium plays AAC .m4a but not ALAC, so ALAC files are converted to FLAC (bit-perfect, lossless) in a cache
const alacSeen = new Map();
function ffmpegPath() { try { return require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked'); } catch (e) { return null; } }
async function playablePath(p) {
  if (!/\.(m4a|m4b|mp4|caf)$/i.test(p)) return p;
  const fs = require('fs'), crypto = require('crypto');
  let st; try { st = await fs.promises.stat(p); } catch (e) { return p; }
  const key = p + '|' + st.size + '|' + st.mtimeMs;
  if (!alacSeen.has(key)) alacSeen.set(key, (async () => {
    try { const mm = await import('music-metadata'); const meta = await (mm.parseFile || mm.default.parseFile)(p, { duration: false, skipCovers: true }); if (!/alac/i.test(meta.format.codec || '')) return p; } catch (e) { return p; }
    const dir = path.join(app.getPath('userData'), 'alac-cache'); await fs.promises.mkdir(dir, { recursive: true });
    const out = path.join(dir, crypto.createHash('sha1').update(key).digest('hex') + '.flac');
    if (fs.existsSync(out)) return out;
    const ff = ffmpegPath(); if (!ff) { log('ALAC file but ffmpeg is missing:', p); return p; }
    log('converting ALAC to FLAC:', p);
    await new Promise((res, rej) => { const c = require('child_process').spawn(ff, ['-v', 'error', '-y', '-i', p, '-map', '0:a', '-c:a', 'flac', out + '.part.flac'], { windowsHide: true }); c.on('error', rej); c.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg ' + code))); });
    await fs.promises.rename(out + '.part.flac', out); return out;
  })().catch(e => { log('ALAC conversion failed', e.message); alacSeen.delete(key); return p; }));
  return alacSeen.get(key);
}
function registerMediaProtocol() {
  protocol.handle('ddmedia', async req => {
    try {
      let p = decodeURIComponent(new URL(req.url).pathname.slice(1));
      if (!isAudio(p)) return new Response('forbidden', { status: 403 });
      p = await playablePath(p);          // Apple Lossless (ALAC) .m4a is converted to FLAC once, since Chromium can't decode ALAC
      // serve byte ranges ourselves: file:// fetches ignore Range, which makes the <audio> element unseekable (drops always restarted a track)
      const fs = require('fs'), { Readable } = require('stream');
      const st = await fs.promises.stat(p), size = st.size;
      const ext = path.extname(p).slice(1).toLowerCase();
      const type = { mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', wma: 'audio/x-ms-wma', aiff: 'audio/aiff', aif: 'audio/aiff' }[ext] || 'application/octet-stream';
      const h = { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes', 'Content-Type': type };
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
      if (m) {
        let a = m[1] === '' ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
        let b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
        if (a >= size || a > b) return new Response('range', { status: 416, headers: { ...h, 'Content-Range': `bytes */${size}` } });
        return new Response(Readable.toWeb(fs.createReadStream(p, { start: a, end: b })), { status: 206, headers: { ...h, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': String(b - a + 1) } });
      }
      return new Response(Readable.toWeb(fs.createReadStream(p)), { status: 200, headers: { ...h, 'Content-Length': String(size) } });
    } catch (e) { return new Response('not found', { status: 404 }); }
  });
}

function createWindow() {
  // the artwork creator lists the fonts installed on this computer (Local Font Access); nothing else asks for permissions
  try {
    const ses = require('electron').session.defaultSession;
    ses.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'local-fonts' || perm === 'media' || perm === 'clipboard-read' || perm === 'clipboard-sanitized-write'));
    ses.setPermissionCheckHandler((wc, perm) => perm === 'local-fonts' || perm === 'media' || perm === 'clipboard-read' || perm === 'clipboard-sanitized-write');
  } catch (e) { log('permission handler', e); }
  win = new BrowserWindow({
    fullscreen: !!(settings && settings.fullscreen), width: 1360, height: 860, minWidth: 1000, minHeight: 640, backgroundColor: '#14110f', title: 'Digi-Deck', icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  const wc = win.webContents;
  win.on('unresponsive', () => { hung = true; log('window not responding'); setTimeout(() => { if (hung) askAboutHang(false); }, 4000); });
  win.on('responsive', () => { if (hung) log('window responding again'); hung = false; });
  wc.on('render-process-gone', (e, d) => { log('renderer gone', d); if (d.reason !== 'clean-exit' && !win.isDestroyed()) setTimeout(() => !win.isDestroyed() && wc.reload(), 500); });
  wc.on('console-message', (e, level, message, line, source) => { if (level >= 3) log('renderer error:', message, source ? `(${path.basename(String(source))}:${line})` : ''); });
  buildMenu();
}

function openAbout() {
  if (aboutWin && !aboutWin.isDestroyed()) return aboutWin.focus();
  aboutWin = new BrowserWindow({
    width: 620, height: 800, minWidth: 520, minHeight: 560, parent: win, modal: false, autoHideMenuBar: true, backgroundColor: '#14110f', title: 'About Digi-Deck',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'), minimizable: false, maximizable: false,
    webPreferences: { preload: path.join(__dirname, 'about-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  aboutWin.setMenu(null);
  aboutWin.loadFile(path.join(__dirname, '..', 'renderer', 'about.html'));
  aboutWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  aboutWin.webContents.on('will-navigate', e => e.preventDefault());
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ label: 'Settings…', click: () => win && win.webContents.send('menu:settings') }, { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
    { label: 'Help', submenu: [
      { label: 'About Digi-Deck', click: openAbout },
      { label: 'Open Log Folder', click: () => { log('log folder opened'); shell.openPath(path.join(app.getPath('userData'), 'logs')); } },
      { label: 'Check for Updates…', click: () => updater && updater.check({ silent: false }) },
      { label: 'Automatically Check for Updates', type: 'checkbox', checked: !settings || settings.autoUpdate !== false, click: i => { settings = { ...settings, autoUpdate: i.checked }; fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2)); } },
      { type: 'separator' },
      { label: 'Donate with PayPal…', click: () => shell.openExternal(appinfo.DONATE_URL) },
      ...(appinfo.repo.configured ? [{ label: 'Releases on GitHub', click: () => shell.openExternal(appinfo.repo.url + '/releases') }] : [])
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  if (!primary) return;
  const ud = app.getPath('userData');
  log(`start ${app.getVersion()} (${process.platform}, Electron ${process.versions.electron})`);
  settings = loadSettings();
  try { store = new Store(path.join(ud, 'db')); }
  catch (e) {
    // never sit invisible in the background: say what went wrong and quit
    log('could not open the library databases', e);
    dialog.showErrorBox('Digi-Deck could not start', `The library could not be opened:\n${e.message}\n\nIf another copy of Digi-Deck is still running (check Task Manager for "Digi-Deck"), end it and try again.\n\nDetails are in the log:\n${path.join(ud, 'logs', 'digi-deck.log')}`);
    app.exit(1); return;
  }
  const artDir = path.join(ud, 'art');
  providers = new Providers({ cacheDir: path.join(ud, 'art-cache'), getSettings: () => settings });
  library = new Library({ store, providers, artDir, onStatus: status });
  scanner = new LibraryScanner({ library, indexFile: path.join(ud, 'libscan.json'), cacheDir: providers.cacheDir, emit: m => win && !win.isDestroyed() && win.webContents.send('libscan', m) });
  registerMediaProtocol();
  registerIpc();
  updater = new Updater({ getWindow: () => win, getSettings: () => settings, onStatus: status });
  createWindow();
  updater.startup();
  win.webContents.once('did-finish-load', () => { if (settings.libraryAutoScan && settings.libraryPath) setTimeout(() => startLibraryScan(false).catch(() => {}), 2500); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(e => {
  log('start-up failed', e);
  try { dialog.showErrorBox('Digi-Deck could not start', `${e.message}\n\nDetails are in the log:\n${path.join(app.getPath('userData'), 'logs', 'digi-deck.log')}`); } catch {}
  app.exit(1);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const wrap = fn => async (_e, arg) => {
  try { return { ok: true, data: await fn(arg) }; } catch (e) { return { ok: false, error: e.message || String(e) }; }
};

function startLibraryScan(force) {
  const roots = [settings.libraryPath].filter(Boolean);
  const formats = (settings.libraryFormats || []).filter(f => ['vinyl', 'cd', 'cassette', 'micro', 'reel', 'md', 'dat'].includes(f));
  if (!roots.length) return Promise.reject(new Error('Choose a media library folder in Settings first.'));
  if (!formats.length) return Promise.reject(new Error('Pick at least one format to fill in Settings.'));
  return scanner.run({ roots, formats, force });
}

function registerIpc() {
  ipcMain.handle('libscan:start', wrap(({ force } = {}) => { startLibraryScan(!!force).catch(e => win && win.webContents.send('libscan', { phase: 'error', message: e.message })); return true; }));
  ipcMain.handle('libscan:cancel', wrap(() => { scanner.cancel(); return true; }));
  ipcMain.handle('libscan:running', wrap(() => scanner.running));
  ipcMain.handle('lib:exportAdjust', wrap(async () => { const r = await dialog.showOpenDialog(win, { title: 'Choose a folder for the adjustment export', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return null; return library.exportAdjustments(r.filePaths[0], 'micro'); }));
  // library backup / restore (every player's library and all of its pictures)
  ipcMain.handle('lib:backup', wrap(async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose where to save the library backup', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return null;
    const res = await require('./backup').backup(store, require('./db').MODES, r.filePaths[0], app.getVersion()); log('library backup saved to', res.dir); return res;
  }));
  ipcMain.handle('lib:restore', wrap(async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose a Digi-Deck backup folder to restore', properties: ['openDirectory'] }); if (r.canceled) return null;
    const B = require('./backup'), man = B.readManifest(r.filePaths[0]);
    if (!man) throw new Error('That folder is not a Digi-Deck library backup (it has no manifest.json).');
    const ok = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancel', 'Restore'], defaultId: 1, cancelId: 0, title: 'Restore libraries',
      message: `Replace your libraries with the backup from ${new Date(man.created).toLocaleString()}?`,
      detail: `${Object.entries(man.players || {}).map(([m, n]) => `${m}: ${n}`).join(', ')}\n\nYour current libraries are saved to a backup first (in the app's data folder, "backups"), so this can be undone.` });
    if (ok.response !== 1) return null;
    const res = await B.restore(store, require('./db').MODES, r.filePaths[0], app.getPath('userData'), app.getVersion()); log('library restored from', r.filePaths[0]);
    setTimeout(() => win && !win.isDestroyed() && win.webContents.reload(), 1200);
    return res;
  }));
  ipcMain.handle('dialog:folder', wrap(async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; }));
  ipcMain.handle('scan', wrap(async ({ kind, paths }) => {
    if (!paths || !paths.length) {
      let r;
      if (kind === 'folder') r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
      else if (kind === 'playlist') r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Playlists / cue sheets', extensions: [...PLAYLIST_EXT].map(e => e.slice(1)) }] });
      else r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Audio', extensions: [...AUDIO_EXT].map(e => e.slice(1)) }] });
      if (r.canceled || !r.filePaths.length) return null;
      paths = r.filePaths;
    } else if (kind === 'drop') {
      // dropped items: decide by what they are
      const first = paths[0];
      if (fs.existsSync(first) && fs.statSync(first).isDirectory()) kind = 'folder';
      else if (paths.length === 1 && isPlaylist(first) && !isAudio(first)) kind = 'playlist';
      else kind = 'files';
    }
    status('Reading files…');
    const s = await scan({ kind, paths }, providers.cacheDir);
    status('');
    return s;
  }));
  ipcMain.handle('resolve', wrap(a => library.resolve(a)));
  ipcMain.handle('library:list', wrap(async mode => { await library.backfillGenerics(mode).catch(() => {}); await library.importPrebuilt(mode).catch(() => {}); return store.list(mode); }));
  ipcMain.handle('library:load', wrap(({ mode, id }) => library.load(mode, id)));
  ipcMain.handle('library:save', wrap(({ mode, album }) => library.saveEdited(mode, album)));
  ipcMain.handle('art:data', wrap(f => library.readData(f)));
  ipcMain.handle('art:saveData', wrap(({ dataUrl, name }) => library.saveData(dataUrl, name)));
  ipcMain.handle('library:delete', wrap(({ mode, id }) => { store.remove(mode, id); return true; }));
  ipcMain.handle('release:search', wrap(a => providers.searchReleases(a)));
  ipcMain.handle('release:fetch', wrap(a => library.fetchRelease(a)));
  ipcMain.handle('release:parse', wrap(t => Providers.parseReleaseRef(t)));
  ipcMain.handle('sides:assign', wrap(({ mode, tracks, tracklist, sides: n, sideMinutes }) => {
    const sides = assignSides(mode, tracks, tracklist, n, sideMinutes);
    return tracks.map((t, i) => ({ ...t, side: sides[i] }));
  }));
  ipcMain.handle('art:find', wrap(async a => (await providers.findArt(a)).candidates));
  ipcMain.handle('art:cache', wrap(url => providers.cache(url)));
  ipcMain.handle('dialog:image', wrap(async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'] }] });
    return r.canceled ? null : r.filePaths[0];
  }));
  ipcMain.handle('about:info', () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, credits: appinfo.CREDITS, donate: appinfo.DONATE_URL, repoUrl: appinfo.repo.url, autoUpdate: settings.autoUpdate !== false }));
  ipcMain.handle('about:licenses', () => { try { return fs.readFileSync(path.join(__dirname, '..', '..', 'THIRD_PARTY_NOTICES.md'), 'utf8'); } catch { return 'THIRD_PARTY_NOTICES.md not found.'; } });
  ipcMain.handle('about:open', (_e, url) => { if (appinfo.allowedUrls().has(url)) shell.openExternal(url); });
  ipcMain.handle('about:setAuto', (_e, v) => { saveSettings({ autoUpdate: !!v }); win && win.webContents.send('settings:changed'); });
  ipcMain.handle('about:check', () => updater.check({ silent: false }));
  ipcMain.handle('settings:get', wrap(() => settings));
  ipcMain.handle('settings:set', wrap(s => saveSettings(s)));
  ipcMain.handle('asset:exists', wrap(p => fs.existsSync(path.join(__dirname, '..', '..', 'assets', p))));
}
