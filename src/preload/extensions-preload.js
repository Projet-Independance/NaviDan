const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('extensionsApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getExtensions: () => ipcRenderer.invoke('extensions:get'),
  getCatalog: () => ipcRenderer.invoke('extensions:get-catalog'),
  installFromWebStore: (input) => ipcRenderer.invoke('extensions:install-webstore', input),
  installFromFolder: () => ipcRenderer.invoke('extensions:install-folder'),
  toggleExtension: (id, enabled) => ipcRenderer.invoke('extensions:toggle', { id, enabled }),
  uninstallExtension: (id) => ipcRenderer.invoke('extensions:uninstall', id),
  closePopup: () => ipcRenderer.send('extensions:close-popup'),
  onUpdated: (cb) => {
    const handler = (_, list) => cb(list);
    ipcRenderer.on('extensions:updated', handler);
    return () => ipcRenderer.removeListener('extensions:updated', handler);
  }
});

