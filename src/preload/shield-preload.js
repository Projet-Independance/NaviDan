const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shieldApi', {
  getSiteData: () => ipcRenderer.invoke('shield:get-data'),
  toggleAds: () => ipcRenderer.invoke('shield:toggle-ads'),
  toggleTrackers: () => ipcRenderer.invoke('shield:toggle-trackers'),
  openSettings: () => ipcRenderer.send('shield:open-settings'),
  openPrivacyInfo: () => ipcRenderer.send('shield:open-privacy-info'),
  closePopup: () => ipcRenderer.send('shield:close')
});

