// Update check against GitHub releases. Installed (NSIS) builds download and install through electron-updater;
// portable builds can't replace themselves, so they just offer the download page.
const { app, dialog, shell, net } = require('electron');
const { repo } = require('./appinfo');

function parseV(v) { return String(v || '').replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0); }
function isNewer(a, b) { const x = parseV(a), y = parseV(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }

class Updater {
  constructor({ getWindow, getSettings, onStatus }) {
    this.getWindow = getWindow; this.getSettings = getSettings; this.onStatus = onStatus || (() => {});
    this.portable = !!process.env.PORTABLE_EXECUTABLE_FILE;
    this.busy = false; this.au = null;
  }
  get canSelfInstall() { return app.isPackaged && !this.portable && process.platform !== 'linux' ? true : app.isPackaged && !!process.env.APPIMAGE; }
  _au() {
    if (this.au) return this.au;
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = true; autoUpdater.allowPrerelease = false;
    autoUpdater.on('download-progress', p => this.onStatus(`Downloading update… ${Math.round(p.percent)}%`));
    return (this.au = autoUpdater);
  }
  box(opts) { const w = this.getWindow(); return w && !w.isDestroyed() ? dialog.showMessageBox(w, opts) : dialog.showMessageBox(opts); }
  // silent=true: background check at startup (no dialogs unless an update is ready)
  async check({ silent }) {
    if (this.busy) return;
    if (!repo.configured) { if (!silent) await this.box({ type: 'info', message: 'Update source not set up', detail: 'This build has no GitHub repository configured for updates yet (see README: "Auto-update").' }); return; }
    if (!app.isPackaged) { if (!silent) await this.box({ type: 'info', message: 'Updates are only checked in installed builds', detail: `Running from source (v${app.getVersion()}).` }); return; }
    this.busy = true;
    try { await (this.canSelfInstall ? this._installed(silent) : this._portable(silent)); }
    catch (e) { if (!silent) await this.box({ type: 'error', message: 'Could not check for updates', detail: String(e && e.message || e).slice(0, 300) }); }
    finally { this.busy = false; this.onStatus(''); }
  }
  async _installed(silent) {
    const au = this._au();
    const r = await au.checkForUpdates();
    const info = r && r.updateInfo;
    if (!info || !isNewer(info.version, app.getVersion())) { if (!silent) await this.box({ type: 'info', message: 'Digi-Deck is up to date', detail: `You have the latest version (v${app.getVersion()}).` }); return; }
    if (!silent) {
      const { response } = await this.box({ type: 'question', message: `Digi-Deck ${info.version} is available`, detail: `You have v${app.getVersion()}. Download and install the update?`, buttons: ['Download & install', 'Later'], defaultId: 0, cancelId: 1 });
      if (response !== 0) return;
    }
    this.onStatus('Downloading update…');
    await au.downloadUpdate();
    const { response } = await this.box({ type: 'info', message: `Digi-Deck ${info.version} is ready to install`, detail: 'Restart now to finish updating, or it will be installed the next time you quit.', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1 });
    if (response === 0) au.quitAndInstall();
  }
  async _portable(silent) {
    const res = await net.fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Digi-Deck' } });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const rel = await res.json();
    if (!isNewer(rel.tag_name, app.getVersion())) { if (!silent) await this.box({ type: 'info', message: 'Digi-Deck is up to date', detail: `You have the latest version (v${app.getVersion()}).` }); return; }
    const { response } = await this.box({ type: 'question', message: `Digi-Deck ${rel.tag_name} is available`, detail: 'This portable copy cannot update itself. Open the download page?', buttons: ['Open download page', 'Later'], defaultId: 0, cancelId: 1 });
    if (response === 0) shell.openExternal(rel.html_url);
  }
  startup() {
    if (this.getSettings().autoUpdate === false) return;
    setTimeout(() => this.check({ silent: true }).catch(() => {}), 6000);
  }
}
module.exports = { Updater, isNewer };
