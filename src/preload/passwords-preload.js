const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('passwordsApi', {
  getPasswords: () => ipcRenderer.invoke('passwords:get'),
  addPassword: (item) => ipcRenderer.invoke('passwords:add', item),
  removePassword: (id) => ipcRenderer.invoke('passwords:remove', id),
  hasPin: () => ipcRenderer.invoke('passwords:has-pin'),
  setPin: (pin) => ipcRenderer.invoke('passwords:set-pin', pin),
  verifyPin: (pin) => ipcRenderer.invoke('passwords:verify-pin', pin),
  getCurrentTabDomain: () => ipcRenderer.invoke('passwords:get-current-domain'),
  closePopup: () => ipcRenderer.send('passwords:close')
});
