const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('naviddan', {
  // --- Window Controls ---
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // --- Tab Management ---
  createTab: (url, isIncognito = false) => ipcRenderer.invoke('tab:create', { url, isIncognito }),
  closeTab: (tabId) => ipcRenderer.invoke('tab:close', tabId),
  selectTab: (tabId) => ipcRenderer.invoke('tab:select', tabId),
  reorderTabs: (tabIds) => ipcRenderer.invoke('tab:reorder', tabIds),

  // --- Navigation ---
  navigate: (url) => ipcRenderer.send('nav:go', url),
  goBack: () => ipcRenderer.send('nav:back'),
  goForward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  stop: () => ipcRenderer.send('nav:stop'),
  goHome: () => ipcRenderer.send('nav:home'),

  // --- Page Actions ---
  toggleDevTools: () => ipcRenderer.send('page:devtools'),
  zoomIn: () => ipcRenderer.send('page:zoom-in'),
  zoomOut: () => ipcRenderer.send('page:zoom-out'),
  zoomReset: () => ipcRenderer.send('page:zoom-reset'),
  printPage: () => ipcRenderer.send('page:print'),
  findInPage: (text, forward) => ipcRenderer.send('page:find', { text, forward }),
  stopFindInPage: () => ipcRenderer.send('page:stop-find'),

  // --- Bookmarks & History ---
  getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
  addBookmark: (item) => ipcRenderer.invoke('bookmarks:add', item),
  removeBookmark: (url) => ipcRenderer.invoke('bookmarks:remove', url),
  isBookmarked: (url) => ipcRenderer.invoke('bookmarks:is', url),

  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // --- Speed Dial ---
  getSpeedDial: () => ipcRenderer.invoke('speeddial:get'),
  addSpeedDial: (item) => ipcRenderer.invoke('speeddial:add', item),
  removeSpeedDial: (id) => ipcRenderer.invoke('speeddial:remove', id),

  // --- Downloads ---
  getDownloads: () => ipcRenderer.invoke('downloads:get'),
  openDownloadsMenu: (coords) => ipcRenderer.send('downloads:toggle-popup', coords),
  openDownloadFile: (filePath) => ipcRenderer.send('download:open-file', filePath),
  showDownloadInFolder: (filePath) => ipcRenderer.send('download:show-folder', filePath),

  // --- History & Bookmarks Popups ---
  openHistoryMenu: (coords) => ipcRenderer.send('history:toggle-popup', coords),
  openBookmarksMenu: (coords) => ipcRenderer.send('bookmarks:toggle-popup', coords),
  openSettingsMenu: (coords) => ipcRenderer.send('settings:toggle-popup', coords),

  // --- Performance, Cleaner, Passwords & Themes ---
  openPerfMenu: (coords) => ipcRenderer.send('perf:toggle-popup', coords),
  openCleanerMenu: (coords) => ipcRenderer.send('cleaner:toggle-popup', coords),
  openPasswordsMenu: (coords) => ipcRenderer.send('passwords:toggle-popup', coords),
  openThemesMenu: (coords) => ipcRenderer.send('themes:toggle-popup', coords),
  getThemeSettings: () => ipcRenderer.invoke('themes:get'),
  onThemeChanged: (cb) => ipcRenderer.on('theme:changed', (_, t) => cb(t)),

  // --- Sidebar Controls ---
  toggleSidebar: () => ipcRenderer.invoke('sidebar:toggle'),
  getSidebarState: () => ipcRenderer.invoke('sidebar:get-state'),
  onSidebarChanged: (cb) => ipcRenderer.on('sidebar:changed', (_, s) => cb(s)),

  // --- Picture-in-Picture Gaming ---
  openPip: () => ipcRenderer.send('pip:open-manual'),
  onPipMediaStatus: (cb) => ipcRenderer.on('pip:media-status', (_, s) => cb(s)),

  // --- Gaming Turbo Mode ---
  toggleTurbo: () => ipcRenderer.invoke('turbo:toggle'),
  getTurboState: () => ipcRenderer.invoke('turbo:get-state'),
  onTurboState: (cb) => ipcRenderer.on('turbo:state-changed', (_, s) => cb(s)),

  // --- NaviSnipper Screen Capture ---
  startSnipper: () => ipcRenderer.send('snipper:start'),
  saveSnippet: (dataUrl) => ipcRenderer.invoke('snipper:save-file', dataUrl),
  copySnippet: (dataUrl) => ipcRenderer.send('snipper:copy-to-clipboard', dataUrl),
  onSnippetCaptured: (cb) => ipcRenderer.on('snipper:captured', (_, d) => cb(d)),

  // --- Audio Focus Controller ---
  toggleTabMute: (tabId) => ipcRenderer.invoke('tab:toggle-mute', tabId),
  setTabMuted: (tabId, muted) => ipcRenderer.invoke('tab:set-muted', { tabId, muted }),
  muteBackgroundTabs: () => ipcRenderer.invoke('audio:mute-background'),
  getActiveAudioStreams: () => ipcRenderer.invoke('audio:get-streams'),
  openAudioMenu: (coords) => ipcRenderer.send('audio:toggle-popup', coords),
  onTabAudioChanged: (cb) => ipcRenderer.on('tab:audio-changed', (_, d) => cb(d)),
  onAudioStreamsUpdated: (cb) => ipcRenderer.on('audio:streams-updated', (_, d) => cb(d)),

  // --- Settings ---
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // --- Adblock & Privacy Shield ---
  getAdblockStats: () => ipcRenderer.invoke('adblock:stats'),
  toggleAdblock: (enabled) => ipcRenderer.invoke('adblock:toggle', enabled),
  openShieldMenu: (coords) => ipcRenderer.send('shield:toggle-popup', coords),

  // --- Events from Main ---
  onSettingsUpdated: (cb) => ipcRenderer.on('settings:updated', (_, s) => cb(s)),
  onTabCreated: (cb) => ipcRenderer.on('tab:created', (_, tab) => cb(tab)),
  onTabUpdated: (cb) => ipcRenderer.on('tab:updated', (_, tab) => cb(tab)),
  onTabClosed: (cb) => ipcRenderer.on('tab:closed', (_, tabId) => cb(tabId)),
  onTabActivated: (cb) => ipcRenderer.on('tab:activated', (_, tabId) => cb(tabId)),
  onNavStateChanged: (cb) => ipcRenderer.on('nav:state', (_, state) => cb(state)),
  onAdBlocked: (cb) => ipcRenderer.on('adblock:blocked', (_, data) => cb(data)),
  onDownloadStarted: (cb) => ipcRenderer.on('download:started', (_, item) => cb(item)),
  onDownloadUpdated: (cb) => ipcRenderer.on('download:updated', (_, item) => cb(item)),
  onDownloadDone: (cb) => ipcRenderer.on('download:done', (_, item) => cb(item)),
  onFindResult: (cb) => ipcRenderer.on('page:find-result', (_, result) => cb(result)),
  onOpenSettings: (cb) => ipcRenderer.on('open:settings', () => cb())
});

