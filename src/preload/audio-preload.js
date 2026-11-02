const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('audioApi', {
  getStreams: () => ipcRenderer.invoke('audio:get-streams'),
  toggleTabMute: (tabId) => ipcRenderer.invoke('tab:toggle-mute', tabId),
  setTabMuted: (tabId, muted) => ipcRenderer.invoke('tab:set-muted', { tabId, muted }),
  muteBackgroundTabs: () => ipcRenderer.invoke('audio:mute-background'),
  closePopup: () => ipcRenderer.send('audio:close'),
  onStreamsUpdated: (cb) => ipcRenderer.on('audio:streams-updated', (_, d) => cb(d))
});

