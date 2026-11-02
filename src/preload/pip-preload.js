const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pipApi', {
  sendAnswer: (answer) => ipcRenderer.send('pip:webrtc-answer', answer),
  sendIceCandidate: (candidate) => ipcRenderer.send('pip:webrtc-ice-candidate', candidate),
  onOffer: (callback) => ipcRenderer.on('pip:webrtc-offer', (_, offer) => callback(offer)),
  onIceCandidate: (callback) => ipcRenderer.on('pip:webrtc-ice-candidate', (_, cand) => callback(cand)),
  onMediaState: (callback) => ipcRenderer.on('pip:media-state', (_, state) => callback(state)),
  
  togglePlay: () => ipcRenderer.send('pip:cmd-toggle-play'),
  seek: (delta) => ipcRenderer.send('pip:cmd-seek', delta),
  setVolume: (vol) => ipcRenderer.send('pip:cmd-set-volume', vol),
  toggleMute: () => ipcRenderer.send('pip:cmd-toggle-mute'),
  setOpacity: (val) => ipcRenderer.send('pip:set-opacity', val),
  returnToTab: () => ipcRenderer.send('pip:return-to-tab'),
  notifyReady: () => ipcRenderer.send('pip:window-ready'),
  close: () => ipcRenderer.send('pip:close-window')
});

