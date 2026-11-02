const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspaceApi', {
  getWorkspaces: () => ipcRenderer.invoke('workspaces:get'),
  switchWorkspace: (id) => ipcRenderer.invoke('workspaces:switch', id),
  addWorkspace: (ws) => ipcRenderer.invoke('workspaces:add', ws),
  deleteWorkspace: (id) => ipcRenderer.invoke('workspaces:delete', id),
  updateWorkspace: (ws) => ipcRenderer.invoke('workspaces:update', ws),
  closePopup: () => ipcRenderer.send('workspaces:close')
});

