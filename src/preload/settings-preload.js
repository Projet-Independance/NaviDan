const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  toggleAdblock: (val) => ipcRenderer.invoke('adblock:toggle', val),
  closePopup: () => ipcRenderer.send('settings:close'),
  checkUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: (downloadUrl, assetName) => ipcRenderer.invoke('updater:download', { downloadUrl, assetName }),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateProgress: (cb) => ipcRenderer.on('updater:progress', (_, data) => cb(data))
});

