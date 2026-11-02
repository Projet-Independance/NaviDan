const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('historyApi', {
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  navigateTo: (url, inNewTab = true) => ipcRenderer.send('nav:go-and-close-popups', url, inNewTab),
  closePopup: () => ipcRenderer.send('history:close')
});

