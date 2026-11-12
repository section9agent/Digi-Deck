const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('about', {
  info: () => ipcRenderer.invoke('about:info'),
  licenses: () => ipcRenderer.invoke('about:licenses'),
  open: url => ipcRenderer.invoke('about:open', url),
  setAuto: v => ipcRenderer.invoke('about:setAuto', v),
  check: () => ipcRenderer.invoke('about:check')
});
