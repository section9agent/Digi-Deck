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
const defaults = { discogsToken: '', fanartKey: '', audiodbKey: '123', contact: '', lastMode: '', libraryPath: '', libraryFormats: ['vinyl', 'cd', 'cassette', 'micro', 'reel'], libraryAutoScan: false, autoUpdate: true, fullscreen: false, soundFx: true };

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
function registerMediaProtocol() {
  protocol.handle('ddmedia', async req => {
    try {
      const p = decodeURIComponent(new URL(req.url).pathname.slice(1));
      if (!isAudio(p)) return new Response('forbidden', { status: 403 });
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
  win = new BrowserWindow({
    fullscreen: !!(settings && settings.fullscreen), width: 1360, height: 860, minWidth: 1000, minHeight: 640, backgroundColor: '#14110f', title: 'Digi-Deck', icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
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
  const ud = app.getPath('userData');
  settings = loadSettings();
  store = new Store(path.join(ud, 'db'));
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
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const wrap = fn => async (_e, arg) => {
  try { return { ok: true, data: await fn(arg) }; } catch (e) { return { ok: false, error: e.message || String(e) }; }
};

function startLibraryScan(force) {
  const roots = [settings.libraryPath].filter(Boolean);
  const formats = (settings.libraryFormats || []).filter(f => ['vinyl', 'cd', 'cassette', 'micro', 'reel'].includes(f));
  if (!roots.length) return Promise.reject(new Error('Choose a media library folder in Settings first.'));
  if (!formats.length) return Promise.reject(new Error('Pick at least one format to fill in Settings.'));
  return scanner.run({ roots, formats, force });
}

function registerIpc() {
  ipcMain.handle('libscan:start', wrap(({ force } = {}) => { startLibraryScan(!!force).catch(e => win && win.webContents.send('libscan', { phase: 'error', message: e.message })); return true; }));
  ipcMain.handle('libscan:cancel', wrap(() => { scanner.cancel(); return true; }));
  ipcMain.handle('libscan:running', wrap(() => scanner.running));
  ipcMain.handle('lib:exportAdjust', wrap(async () => { const r = await dialog.showOpenDialog(win, { title: 'Choose a folder for the adjustment export', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return null; return library.exportAdjustments(r.filePaths[0], 'micro'); }));
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
