const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('passwordsApi', {
  getPasswords: () => ipcRenderer.invoke('passwords:get'),
  addPassword: (item) => ipcRenderer.invoke('passwords:add', item),
  removePassword: (id) => ipcRenderer.invoke('passwords:remove', id),
  getCurrentTabDomain: () => ipcRenderer.invoke('passwords:get-current-domain'),
  closePopup: () => ipcRenderer.send('passwords:close')
});

