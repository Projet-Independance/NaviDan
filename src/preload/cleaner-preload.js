const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cleanerApi', {
  getStorageStats: () => ipcRenderer.invoke('cleaner:get-stats'),
  cleanStorage: (options) => ipcRenderer.invoke('cleaner:clean', options),
  closePopup: () => ipcRenderer.send('cleaner:close')
});

