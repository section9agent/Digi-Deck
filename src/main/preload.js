const { contextBridge, ipcRenderer, webUtils } = require('electron');

const call = (ch, arg) => ipcRenderer.invoke(ch, arg).then(r => { if (!r.ok) throw new Error(r.error); return r.data; });

contextBridge.exposeInMainWorld('api', {
  scan: (kind, paths) => call('scan', { kind, paths }),
  resolve: (mode, scan, force = false) => call('resolve', { mode, scan, force }),
  libraryList: mode => call('library:list', mode),
  libraryLoad: (mode, id) => call('library:load', { mode, id }),
  librarySave: (mode, album) => call('library:save', { mode, album }),
  artData: f => call('art:data', f),
  artSaveData: (dataUrl, name) => call('art:saveData', { dataUrl, name }),
  libraryDelete: (mode, id) => call('library:delete', { mode, id }),
  searchReleases: (artist, title, mode) => call('release:search', { artist, title, mode }),
  fetchRelease: (mode, source, id, artist, title) => call('release:fetch', { mode, source, id, artist, title }),
  parseReleaseRef: text => call('release:parse', text),
  assignSides: (mode, tracks, tracklist, sides, sideMinutes) => call('sides:assign', { mode, tracks, tracklist, sides, sideMinutes }),
  findArt: (artist, title, mbid, mode) => call('art:find', { artist, title, mbid, mode }),
  cacheArt: url => call('art:cache', url),
  pickImage: () => call('dialog:image'),
  onMenuSettings: cb => ipcRenderer.on('menu:settings', () => cb()),
  pickFolder: () => call('dialog:folder'),
  exportAdjust: () => call('lib:exportAdjust'),
  backupLibraries: () => call('lib:backup'),
  restoreLibraries: () => call('lib:restore'),
  libScanStart: force => call('libscan:start', { force }),
  libScanCancel: () => call('libscan:cancel'),
  libScanRunning: () => call('libscan:running'),
  onLibScan: cb => ipcRenderer.on('libscan', (_e, m) => cb(m)),
  onSettingsChanged: cb => ipcRenderer.on('settings:changed', () => cb()),
  getSettings: () => call('settings:get'),
  setSettings: s => call('settings:set', s),
  pathForFile: f => webUtils.getPathForFile(f),
  onStatus: cb => ipcRenderer.on('status', (_e, m) => cb(m))
});
