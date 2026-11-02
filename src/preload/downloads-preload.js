const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloadsApi', {
  getDownloads: () => ipcRenderer.invoke('downloads:get'),
  openFile: (filePath) => ipcRenderer.send('download:open-file', filePath),
  showInFolder: (filePath) => ipcRenderer.send('download:show-folder', filePath),
  openDownloadsFolder: () => ipcRenderer.send('download:open-default-folder'),
  clearDownloads: () => ipcRenderer.invoke('download:clear-list'),
  closePopup: () => ipcRenderer.send('downloads:close'),

  onDownloadStarted: (cb) => ipcRenderer.on('download:started', (_, item) => cb(item)),
  onDownloadUpdated: (cb) => ipcRenderer.on('download:updated', (_, item) => cb(item)),
  onDownloadDone: (cb) => ipcRenderer.on('download:done', (_, item) => cb(item))
});

