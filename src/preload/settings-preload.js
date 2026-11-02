const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  toggleAdblock: (val) => ipcRenderer.invoke('adblock:toggle', val),
  closePopup: () => ipcRenderer.send('settings:close')
});

