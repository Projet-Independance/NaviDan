const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('themesApi', {
  getThemeSettings: () => ipcRenderer.invoke('themes:get'),
  saveThemeSettings: (theme) => ipcRenderer.invoke('themes:save', theme),
  closePopup: () => ipcRenderer.send('themes:close')
});

