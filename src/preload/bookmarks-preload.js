const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bookmarksApi', {
  getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
  removeBookmark: (url) => ipcRenderer.invoke('bookmarks:remove', url),
  navigateTo: (url, inNewTab = true) => ipcRenderer.send('nav:go-and-close-popups', url, inNewTab),
  addCurrentPage: () => ipcRenderer.invoke('bookmarks:add-current-page'),
  closePopup: () => ipcRenderer.send('bookmarks:close')
});

