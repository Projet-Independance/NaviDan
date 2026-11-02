const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perfApi', {
  getMetrics: () => ipcRenderer.invoke('perf:get-metrics'),
  getPerfSettings: () => ipcRenderer.invoke('perf:get-settings'),
  savePerfSettings: (settings) => ipcRenderer.invoke('perf:save-settings', settings),
  killTab: (tabId) => ipcRenderer.invoke('perf:kill-tab', tabId),
  optimizeRam: () => ipcRenderer.invoke('perf:optimize-ram'),
  closePopup: () => ipcRenderer.send('perf:close')
});

