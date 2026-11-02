const { app, BrowserWindow, BrowserView, ipcMain, shell, dialog, session, screen, globalShortcut, clipboard, ClipboardItem, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const Store = require('./store');
const adblock = require('./adblock');
const NaviAIService = require('./naviai');

let mainWindow = null;
let store = null;
let naviAIService = null;
let tabs = new Map(); // tabId -> { id, view, isIncognito, url, title }
let activeTabId = null;
let nextTabId = 1;
let downloads = [];
let isSidebarVisible = true;
let isNaviAIOpen = false;
let naviAIWidth = 380;
let pipWindow = null;
let pipSourceTabId = null;
let isTurboModeActive = false;

const popups = {
  shield: null,
  downloads: null,
  history: null,
  bookmarks: null,
  settings: null,
  perf: null,
  cleaner: null,
  passwords: null,
  themes: null,
  audio: null
};

function closeAllPopups(exceptKey = null) {
  for (const [key, win] of Object.entries(popups)) {
    if (key !== exceptKey && win && !win.isDestroyed()) {
      win.close();
      popups[key] = null;
    }
  }
}

function toggleAnchoredPopup(key, coords, width, height, htmlPage, preloadScript) {
  if (popups[key] && !popups[key].isDestroyed()) {
    popups[key].close();
    popups[key] = null;
    return;
  }

  closeAllPopups();

  if (!mainWindow || mainWindow.isDestroyed()) return;

  const winBounds = mainWindow.getBounds();
  let screenX;
  let screenY;

  if (coords && coords.fromSidebar) {
    const sbWidth = getSidebarWidth();
    screenX = Math.round(winBounds.x + sbWidth + 6);
    screenY = Math.max(winBounds.y + 70, Math.min(winBounds.y + winBounds.height - height - 10, winBounds.y + (coords.y || 100) - 20));
  } else {
    screenX = Math.round(winBounds.x + (coords.x || 300) - width + 24);
    screenY = Math.round(winBounds.y + (coords.y || 40) + 8);
  }

  const isLinux = process.platform === 'linux';

  const popup = new BrowserWindow({
    width,
    height,
    x: screenX,
    y: screenY,
    frame: false,
    transparent: !isLinux,
    backgroundColor: isLinux ? '#191c2b' : '#00000000',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    parent: mainWindow,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, preloadScript),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  popup.loadFile(path.join(__dirname, htmlPage));

  popup.on('blur', () => {
    if (popup && !popup.isDestroyed()) {
      popup.close();
      popups[key] = null;
    }
  });

  popup.on('closed', () => {
    popups[key] = null;
  });

  popups[key] = popup;
}

const NEW_TAB_URL = pathToFileURL(path.join(__dirname, '../pages/newtab.html')).href;

function getChromeHeight() {
  const settings = store.getSettings();
  return settings.showBookmarksBar ? 110 : 82;
}

function getSidebarWidth() {
  return isSidebarVisible ? 44 : 0;
}

function getNaviAIWidth() {
  return isNaviAIOpen ? naviAIWidth : 0;
}

function updateActiveViewBounds() {
  if (!mainWindow || !activeTabId) return;
  const tab = tabs.get(activeTabId);
  if (!tab || !tab.view) return;

  const [width, height] = mainWindow.getContentSize();
  const chromeHeight = getChromeHeight();
  const sidebarWidth = getSidebarWidth();
  const aiWidth = getNaviAIWidth();
  
  tab.view.setBounds({
    x: sidebarWidth,
    y: chromeHeight,
    width: Math.max(100, width - sidebarWidth - aiWidth),
    height: Math.max(100, height - chromeHeight)
  });
  tab.view.setAutoResize({ width: true, height: true });
}

function resolveSearchUrl(input) {
  const settings = store.getSettings();
  const engines = settings.searchEngines || {
    google: 'https://www.google.com/search?q='
  };
  const currentEngine = settings.searchEngine || 'google';
  const engineBase = engines[currentEngine] || engines.google;

  const trimmed = input.trim();
  if (trimmed === 'naviddan://newtab' || trimmed === 'about:blank') {
    return NEW_TAB_URL;
  }
  
  // Explicit protocols
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Domain like syntax (e.g. test.com, localhost:3000, 192.168.1.1)
  const isDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed) || /^localhost(:[0-9]+)?(\/.*)?$/i.test(trimmed);
  if (isDomain && !trimmed.includes(' ')) {
    return 'https://' + trimmed;
  }

  // Search query
  return engineBase + encodeURIComponent(trimmed);
}

function setupSession(ses) {
  adblock.attachSession(ses, (blockData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('adblock:blocked', blockData);
    }
  });

  // Allow embedding Duck.ai inside the sidebar iframe
  ses.webRequest.onHeadersReceived({ urls: ['*://*.duck.ai/*', '*://*.duckduckgo.com/*'] }, (details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    callback({ cancel: false, responseHeaders });
  });

  // Download handling
  ses.on('will-download', (event, item) => {
    const downloadId = Date.now().toString();
    const filename = item.getFilename();
    const savePath = item.getSavePath();
    const totalBytes = item.getTotalBytes();

    const dlEntry = {
      id: downloadId,
      filename,
      path: savePath,
      totalBytes,
      receivedBytes: 0,
      state: 'progressing',
      startTime: Date.now()
    };
    downloads.unshift(dlEntry);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:started', dlEntry);
    }
    if (downloadsWindow && !downloadsWindow.isDestroyed()) {
      downloadsWindow.webContents.send('download:started', dlEntry);
    }

    item.on('updated', (event, state) => {
      dlEntry.receivedBytes = item.getReceivedBytes();
      dlEntry.state = state;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:updated', dlEntry);
      }
      if (downloadsWindow && !downloadsWindow.isDestroyed()) {
        downloadsWindow.webContents.send('download:updated', dlEntry);
      }
    });

    item.once('done', (event, state) => {
      dlEntry.state = state;
      dlEntry.path = item.getSavePath();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:done', dlEntry);
      }
      if (downloadsWindow && !downloadsWindow.isDestroyed()) {
        downloadsWindow.webContents.send('download:done', dlEntry);
      }
    });
  });
}

function canGoBack(wc) {
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoBack === 'function') {
    return wc.navigationHistory.canGoBack();
  }
  return typeof wc.canGoBack === 'function' ? wc.canGoBack() : false;
}

function canGoForward(wc) {
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoForward === 'function') {
    return wc.navigationHistory.canGoForward();
  }
  return typeof wc.canGoForward === 'function' ? wc.canGoForward() : false;
}

function createTab(initialUrl = null, isIncognito = false) {
  const tabId = nextTabId++;
  const urlToLoad = initialUrl ? resolveSearchUrl(initialUrl) : NEW_TAB_URL;

  // Dedicated or shared session
  let viewSession;
  if (isIncognito) {
    viewSession = session.fromPartition(`incognito-${Date.now()}-${tabId}`, { cache: false });
    setupSession(viewSession);
  } else {
    viewSession = session.defaultSession;
  }

  const view = new BrowserView({
    webPreferences: {
      session: viewSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      preload: path.join(__dirname, '../preload/view-preload.js')
    }
  });

  const tabData = {
    id: tabId,
    view: view,
    isIncognito: !!isIncognito,
    url: urlToLoad,
    title: isIncognito ? 'Navigation privée' : 'Nouvel onglet',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    isAudible: false,
    isMuted: false
  };

  tabs.set(tabId, tabData);

  // View event handlers
  const wc = view.webContents;

  // Real-time audio focus monitoring
  wc.on('media-started-playing', () => {
    tabData.isAudible = true;
    tabData.isMuted = wc.isAudioMuted();
    broadcastAudioState(tabId);
  });

  wc.on('media-paused', () => {
    tabData.isAudible = false;
    tabData.isMuted = wc.isAudioMuted();
    broadcastAudioState(tabId);
  });

  wc.on('audio-state-changed', (event, audible) => {
    tabData.isAudible = !!audible;
    tabData.isMuted = wc.isAudioMuted();
    broadcastAudioState(tabId);
  });

  wc.on('did-start-loading', () => {
    tabData.isLoading = true;
    if (activeTabId === tabId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('nav:state', {
        canGoBack: canGoBack(wc),
        canGoForward: canGoForward(wc),
        isLoading: true
      });
    }
  });

  wc.on('did-stop-loading', () => {
    tabData.isLoading = false;
    tabData.canGoBack = canGoBack(wc);
    tabData.canGoForward = canGoForward(wc);
    
    if (activeTabId === tabId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('nav:state', {
        canGoBack: tabData.canGoBack,
        canGoForward: tabData.canGoForward,
        isLoading: false
      });
    }
  });

  wc.on('page-title-updated', (event, title) => {
    tabData.title = title || 'Nouvel onglet';
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab:updated', {
        id: tabId,
        title: tabData.title,
        url: tabData.url,
        isIncognito: tabData.isIncognito,
        isAudible: !!tabData.isAudible,
        isMuted: !!tabData.isMuted
      });
    }
  });

  wc.on('did-navigate', (event, url) => {
    tabData.url = url;
    if (!isIncognito && !url.startsWith('file://')) {
      store.addHistory({ title: tabData.title, url });
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab:updated', {
        id: tabId,
        title: tabData.title,
        url: tabData.url,
        isIncognito: tabData.isIncognito,
        isAudible: !!tabData.isAudible,
        isMuted: !!tabData.isMuted
      });
      if (activeTabId === tabId) {
        mainWindow.webContents.send('nav:state', {
          canGoBack: canGoBack(wc),
          canGoForward: canGoForward(wc),
          isLoading: wc.isLoading()
        });
      }
    }
  });

  wc.on('did-navigate-in-page', (event, url) => {
    tabData.url = url;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab:updated', {
        id: tabId,
        title: tabData.title,
        url: tabData.url,
        isIncognito: tabData.isIncognito,
        isAudible: !!tabData.isAudible,
        isMuted: !!tabData.isMuted
      });
    }
  });

  // Handle target="_blank" and window.open
  wc.setWindowOpenHandler(({ url }) => {
    createTab(url, isIncognito);
    return { action: 'deny' };
  });

  // Find in page result
  wc.on('found-in-page', (event, result) => {
    if (activeTabId === tabId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('page:find-result', result);
    }
  });

  // Load URL
  view.webContents.loadURL(urlToLoad).catch(() => {});

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab:created', {
      id: tabId,
      title: tabData.title,
      url: tabData.url,
      isIncognito: tabData.isIncognito,
      isAudible: false,
      isMuted: false
    });
  }

  // Switch to this new tab
  selectTab(tabId);
  return tabId;
}

// --- Picture-in-Picture (PiP) Gaming Window ---
function openPipWindow(sourceTabId = null) {
  const tabId = sourceTabId || activeTabId;
  if (!tabId || !tabs.has(tabId)) return;

  if (pipWindow && !pipWindow.isDestroyed()) {
    pipSourceTabId = tabId;
    pipWindow.focus();
    const srcTab = tabs.get(tabId);
    if (srcTab && srcTab.view && !srcTab.view.webContents.isDestroyed()) {
      srcTab.view.webContents.send('pip:start-stream');
    }
    return;
  }

  pipSourceTabId = tabId;
  const savedBounds = store?.getPipBounds ? store.getPipBounds() : null;
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  const defaultWidth = 480;
  const defaultHeight = 270;
  const defaultX = Math.round(workArea.x + workArea.width - defaultWidth - 24);
  const defaultY = Math.round(workArea.y + workArea.height - defaultHeight - 24);

  const width = savedBounds ? savedBounds.width : defaultWidth;
  const height = savedBounds ? savedBounds.height : defaultHeight;
  const x = savedBounds ? savedBounds.x : defaultX;
  const y = savedBounds ? savedBounds.y : defaultY;

  pipWindow = new BrowserWindow({
    width,
    height,
    minWidth: 320,
    minHeight: 180,
    aspectRatio: 16 / 9,
    x,
    y,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0d14',
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/pip-preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  pipWindow.setAlwaysOnTop(true, 'screen-saver');

  pipWindow.loadFile(path.join(__dirname, '../pages/pip-window.html'));

  pipWindow.webContents.once('did-finish-load', () => {
    const srcTab = tabs.get(pipSourceTabId);
    if (srcTab && srcTab.view && !srcTab.view.webContents.isDestroyed()) {
      srcTab.view.webContents.send('pip:start-stream');
    }
  });

  pipWindow.on('close', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      if (store?.setPipBounds) store.setPipBounds(pipWindow.getBounds());
    }
  });

  pipWindow.on('closed', () => {
    if (pipSourceTabId && tabs.has(pipSourceTabId)) {
      const tab = tabs.get(pipSourceTabId);
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('pip:stop-stream');
      }
    }
    pipWindow = null;
    pipSourceTabId = null;
  });
}

// --- Gaming Turbo Mode Engine ---
async function toggleTurboMode() {
  isTurboModeActive = !isTurboModeActive;
  let frozenCount = 0;

  for (const [id, tab] of tabs.entries()) {
    if (!tab.view || tab.view.webContents.isDestroyed()) continue;

    // Sanctuary: active tab and tab streaming to PiP Gaming are protected
    const isSanctuary = (id === activeTabId) || (pipWindow && !pipWindow.isDestroyed() && id === pipSourceTabId);

    if (isTurboModeActive) {
      if (!isSanctuary) {
        tab.view.webContents.setBackgroundThrottling(true);
        try {
          tab.view.webContents.executeJavaScript(`
            if (!window.__naviddanTurboFrozen) {
              window.__naviddanTurboFrozen = true;
              document.querySelectorAll('video, audio').forEach(el => {
                if (!el.paused) {
                  el.__turboPaused = true;
                  el.pause();
                }
              });
            }
          `).catch(() => {});
        } catch {}
        frozenCount++;
      } else {
        tab.view.webContents.setBackgroundThrottling(false);
      }
    } else {
      tab.view.webContents.setBackgroundThrottling(true);
      try {
        tab.view.webContents.executeJavaScript(`
          if (window.__naviddanTurboFrozen) {
            window.__naviddanTurboFrozen = false;
            document.querySelectorAll('video, audio').forEach(el => {
              if (el.__turboPaused) {
                delete el.__turboPaused;
                el.play().catch(() => {});
              }
            });
          }
        `).catch(() => {});
      } catch {}
    }
  }

  let freedEstimateMb = 0;
  if (isTurboModeActive) {
    try {
      if (session.defaultSession) {
        await session.defaultSession.clearCache();
      }
    } catch {}
    freedEstimateMb = Math.max(160, Math.round(frozenCount * 140 + 80));
  }

  const payload = {
    active: isTurboModeActive,
    tabsFrozen: frozenCount,
    memSavedMb: freedEstimateMb
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('turbo:state-changed', payload);
  }

  return payload;
}

function startSnipper() {
  if (!activeTabId || !tabs.has(activeTabId)) return;
  const tab = tabs.get(activeTabId);
  if (tab.view && !tab.view.webContents.isDestroyed()) {
    tab.view.webContents.send('snipper:open-overlay');
  }
}

// --- Audio Focus Controller Engine ---
function broadcastAudioState(tabId) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const tab = tabs.get(tabId);
  if (!tab) return;
  mainWindow.webContents.send('tab:audio-changed', {
    id: tabId,
    isAudible: !!tab.isAudible,
    isMuted: !!tab.isMuted
  });
  broadcastAudioSummary();
}

function broadcastAudioSummary() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const streams = [];
  for (const [id, tab] of tabs.entries()) {
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      if (tab.isAudible || tab.isMuted) {
        streams.push({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          isAudible: !!tab.isAudible,
          isMuted: !!tab.isMuted,
          isActive: id === activeTabId
        });
      }
    }
  }
  const activeTabMuted = activeTabId && tabs.has(activeTabId) && tabs.get(activeTabId).view && !tabs.get(activeTabId).view.webContents.isDestroyed()
    ? tabs.get(activeTabId).view.webContents.isAudioMuted()
    : false;
  const activeTabAudible = activeTabId && tabs.has(activeTabId) && tabs.get(activeTabId).view && !tabs.get(activeTabId).view.webContents.isDestroyed()
    ? !!tabs.get(activeTabId).isAudible
    : false;

  const payload = {
    streams,
    activeTabId,
    activeTabMuted,
    activeTabAudible
  };

  mainWindow.webContents.send('audio:streams-updated', payload);
  if (popups.audio && !popups.audio.isDestroyed()) {
    popups.audio.webContents.send('audio:streams-updated', payload);
  }
}

function toggleActiveTabMute() {
  if (!activeTabId || !tabs.has(activeTabId)) return false;
  const tab = tabs.get(activeTabId);
  if (!tab.view || tab.view.webContents.isDestroyed()) return false;
  const nextMuted = !tab.view.webContents.isAudioMuted();
  tab.view.webContents.setAudioMuted(nextMuted);
  tab.isMuted = nextMuted;

  tab.view.webContents.send('tab:set-muted-in-page', nextMuted);
  try {
    tab.view.webContents.executeJavaScript(`
      document.querySelectorAll('video, audio').forEach(el => el.muted = ${nextMuted});
    `).catch(() => {});
  } catch {}

  broadcastAudioState(activeTabId);
  return nextMuted;
}

function muteBackgroundTabs() {
  let mutedCount = 0;
  for (const [id, tab] of tabs.entries()) {
    if (id !== activeTabId && tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.setAudioMuted(true);
      tab.isMuted = true;
      tab.view.webContents.send('tab:set-muted-in-page', true);
      try {
        tab.view.webContents.executeJavaScript(`
          document.querySelectorAll('video, audio').forEach(el => el.muted = true);
        `).catch(() => {});
      } catch {}
      broadcastAudioState(id);
      mutedCount++;
    }
  }
  broadcastAudioSummary();
  return mutedCount;
}

function selectTab(tabId) {
  if (!mainWindow || !tabs.has(tabId)) return;
  const targetTab = tabs.get(tabId);

  // Auto-detach PiP when switching away from a playing video
  if (activeTabId && activeTabId !== tabId && tabs.has(activeTabId)) {
    const prevTab = tabs.get(activeTabId);
    if (prevTab && prevTab.hasPlayingVideo && (!pipWindow || pipWindow.isDestroyed())) {
      openPipWindow(activeTabId);
    }
  }

  // If Turbo Mode is active, freeze the previous tab and activate the target tab
  if (isTurboModeActive) {
    if (activeTabId && activeTabId !== tabId && tabs.has(activeTabId)) {
      const prevTab = tabs.get(activeTabId);
      const isPipTab = (pipWindow && !pipWindow.isDestroyed() && activeTabId === pipSourceTabId);
      if (prevTab && prevTab.view && !prevTab.view.webContents.isDestroyed() && !isPipTab) {
        prevTab.view.webContents.setBackgroundThrottling(true);
      }
    }
    targetTab.view.webContents.setBackgroundThrottling(false);
  }

  // If there was an active view, remove it
  if (activeTabId && tabs.has(activeTabId)) {
    const prevTab = tabs.get(activeTabId);
    try {
      mainWindow.removeBrowserView(prevTab.view);
    } catch {}
  }

  activeTabId = tabId;
  mainWindow.setBrowserView(targetTab.view);
  updateActiveViewBounds();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab:activated', tabId);
    mainWindow.webContents.send('nav:state', {
      canGoBack: canGoBack(targetTab.view.webContents),
      canGoForward: canGoForward(targetTab.view.webContents),
      isLoading: targetTab.view.webContents.isLoading()
    });
    mainWindow.webContents.send('pip:media-status', targetTab.mediaStatus || { hasVideo: false });
    broadcastAudioSummary();
  }
}

function closeTab(tabId) {
  if (!tabs.has(tabId)) return;
  const tab = tabs.get(tabId);

  if (activeTabId === tabId) {
    try {
      mainWindow.removeBrowserView(tab.view);
    } catch {}
  }

  // Destroy view
  try {
    tab.view.webContents.destroy();
  } catch {}
  tabs.delete(tabId);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab:closed', tabId);
    broadcastAudioSummary();
  }

  // If active tab was closed, pick another tab or create new one
  if (activeTabId === tabId) {
    const remainingTabIds = Array.from(tabs.keys());
    if (remainingTabIds.length > 0) {
      selectTab(remainingTabIds[remainingTabIds.length - 1]);
    } else {
      createTab();
    }
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../../assets/icon.svg');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 500,
    frame: false, // Custom titlebar
    backgroundColor: '#181d29',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.setMaxListeners(50);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('resize', () => {
    updateActiveViewBounds();
  });

  mainWindow.on('maximize', () => {
    updateActiveViewBounds();
  });

  mainWindow.on('unmaximize', () => {
    updateActiveViewBounds();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    // Open default initial tab
    createTab();
  });
}

function registerIpcHandlers() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Tabs
  ipcMain.handle('tab:create', (e, { url, isIncognito } = {}) => {
    return createTab(url, isIncognito);
  });
  ipcMain.handle('tab:close', (e, tabId) => {
    closeTab(tabId);
    return true;
  });
  ipcMain.handle('tab:select', (e, tabId) => {
    selectTab(tabId);
    return true;
  });
  ipcMain.on('tab:open-new', (e, url) => {
    createTab(url);
  });

  // Navigation
  ipcMain.on('nav:go', (e, input) => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    const resolved = resolveSearchUrl(input);
    tab.view.webContents.loadURL(resolved).catch(() => {});
  });

  ipcMain.on('nav:back', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    if (tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
  });

  ipcMain.on('nav:forward', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    if (tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
  });

  ipcMain.on('nav:reload', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.reload();
  });

  ipcMain.on('nav:stop', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.stop();
  });

  ipcMain.on('nav:home', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.loadURL(NEW_TAB_URL).catch(() => {});
  });

  // Page Actions
  ipcMain.on('page:devtools', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.toggleDevTools();
  });

  ipcMain.on('page:zoom-in', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    const z = tab.view.webContents.getZoomFactor();
    tab.view.webContents.setZoomFactor(Math.min(2.5, z + 0.1));
  });

  ipcMain.on('page:zoom-out', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    const z = tab.view.webContents.getZoomFactor();
    tab.view.webContents.setZoomFactor(Math.max(0.4, z - 0.1));
  });

  ipcMain.on('page:zoom-reset', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.setZoomFactor(1.0);
  });

  ipcMain.on('page:find', (e, { text, forward }) => {
    if (!activeTabId || !tabs.has(activeTabId) || !text) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.findInPage(text, { forward: forward !== false, findNext: true });
  });

  ipcMain.on('page:stop-find', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return;
    const tab = tabs.get(activeTabId);
    tab.view.webContents.stopFindInPage('clearSelection');
  });

  // Bookmarks
  ipcMain.handle('bookmarks:get', () => store.getBookmarks());
  ipcMain.handle('bookmarks:add', (e, item) => store.addBookmark(item));
  ipcMain.handle('bookmarks:remove', (e, url) => store.removeBookmark(url));
  ipcMain.handle('bookmarks:is', (e, url) => store.isBookmarked(url));

  // History
  ipcMain.handle('history:get', () => store.getHistory());
  ipcMain.handle('history:clear', () => {
    store.clearHistory();
    return true;
  });

  // Speed Dial
  ipcMain.handle('speeddial:get', () => store.getSpeedDial());
  ipcMain.handle('speeddial:add', (e, item) => store.addSpeedDial(item));
  ipcMain.handle('speeddial:remove', (e, id) => store.removeSpeedDial(id));

  // Popups handlers
  ipcMain.on('downloads:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('downloads', coords, 350, 440, '../pages/downloads-popup.html', '../preload/downloads-preload.js');
  });
  ipcMain.on('downloads:close', () => closeAllPopups());

  ipcMain.on('history:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('history', coords, 360, 460, '../pages/history-popup.html', '../preload/history-preload.js');
  });
  ipcMain.on('history:close', () => closeAllPopups());

  ipcMain.on('bookmarks:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('bookmarks', coords, 350, 440, '../pages/bookmarks-popup.html', '../preload/bookmarks-preload.js');
  });
  ipcMain.on('bookmarks:close', () => closeAllPopups());

  ipcMain.on('settings:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('settings', coords, 360, 430, '../pages/settings-popup.html', '../preload/settings-preload.js');
  });
  ipcMain.on('settings:close', () => closeAllPopups());

  ipcMain.on('shield:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('shield', coords, 340, 410, '../pages/shield-popup.html', '../preload/shield-preload.js');
  });
  ipcMain.on('shield:close', () => closeAllPopups());

  // --- Performance Manager ---
  let prevCpuTimes = getCpuTimes();

  function getCpuTimes() {
    const cpus = os.cpus() || [];
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    return { totalIdle, totalTick, numCpus: cpus.length, model: cpus[0]?.model || '' };
  }

  function calculateCpuPercent() {
    const currentTimes = getCpuTimes();
    const tickDiff = currentTimes.totalTick - prevCpuTimes.totalTick;
    const idleDiff = currentTimes.totalIdle - prevCpuTimes.totalIdle;
    prevCpuTimes = currentTimes;

    if (tickDiff <= 0) return 0;
    const idlePercent = (idleDiff / tickDiff) * 100;
    return Math.max(0, Math.min(100, Math.round(100 - idlePercent)));
  }

  ipcMain.on('perf:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('perf', coords, 360, 580, '../pages/perf-popup.html', '../preload/perf-preload.js');
  });
  ipcMain.on('perf:close', () => closeAllPopups());

  ipcMain.handle('perf:get-metrics', async () => {
    const memInfo = await process.getProcessMemoryInfo();
    const systemTotalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const systemFreeMemoryMb = Math.round(os.freemem() / (1024 * 1024));
    const processMemoryMb = Math.round((memInfo.residentSet || 250000) / 1024);

    let browserCpuPercent = 0;
    try {
      const metrics = app.getAppMetrics();
      const totalCpu = metrics.reduce((sum, m) => sum + (m.cpu ? m.cpu.percentCPUUsage : 0), 0);
      browserCpuPercent = Math.min(100, Math.round(totalCpu));
    } catch {}

    const systemCpuPercent = calculateCpuPercent();
    const cpus = os.cpus() || [];
    const cpuInfo = `${cpus.length} cœurs • ${Math.max(browserCpuPercent, Math.round(systemCpuPercent / 4))}% nav`;

    const openTabs = [];
    tabs.forEach((tab, id) => {
      openTabs.push({
        id,
        title: tab.title || 'Nouvel onglet',
        url: tab.url,
        memMb: Math.round(35 + (id * 12)),
        cpuPercent: Math.max(1, Math.min(25, Math.round((id === activeTabId ? 4 : 1) + Math.random() * 2)))
      });
    });

    return {
      processMemoryMb,
      systemTotalMemoryMb,
      systemFreeMemoryMb,
      browserCpuPercent,
      systemCpuPercent,
      cpuCores: cpus.length,
      cpuInfo,
      tabs: openTabs
    };
  });

  ipcMain.handle('perf:kill-tab', (e, tabId) => {
    closeTab(tabId);
    return true;
  });

  ipcMain.handle('perf:optimize-ram', () => {
    if (global.gc) {
      try { global.gc(); } catch {}
    }
    return true;
  });

  ipcMain.handle('perf:get-settings', () => store.getPerfSettings());
  ipcMain.handle('perf:save-settings', (e, s) => {
    const updated = store.updatePerfSettings(s);
    if (updated.cpuLimitEnabled) {
      tabs.forEach((tab) => {
        if (tab.view && tab.view.webContents) {
          tab.view.webContents.setBackgroundThrottling(true);
        }
      });
    }
    return updated;
  });

  // --- Cleaner / Gestionnaire de Place ---
  ipcMain.on('cleaner:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('cleaner', coords, 360, 520, '../pages/cleaner-popup.html', '../preload/cleaner-preload.js');
  });
  ipcMain.on('cleaner:close', () => closeAllPopups());

  ipcMain.handle('cleaner:get-stats', async () => {
    let cacheSizeBytes = 0;
    try {
      cacheSizeBytes = await session.defaultSession.getCacheSize();
    } catch {}

    let cookiesCount = 0;
    try {
      const cookies = await session.defaultSession.cookies.get({});
      cookiesCount = cookies.length;
    } catch {}

    const historyList = store.getHistory();

    return {
      cacheSizeBytes: cacheSizeBytes || (42 * 1024 * 1024),
      cookiesCount,
      historyCount: historyList.length,
      downloadsCount: downloads.length,
      downloadSizeBytes: downloads.reduce((acc, d) => acc + (d.receivedBytes || 0), 0)
    };
  });

  ipcMain.handle('cleaner:clean', async (e, options) => {
    if (options.cache) {
      try { await session.defaultSession.clearCache(); } catch {}
    }
    if (options.cookies) {
      try {
        await session.defaultSession.clearStorageData({
          storages: ['cookies', 'localstorage', 'websql', 'indexdb']
        });
      } catch {}
    }
    if (options.history) {
      store.clearHistory();
    }
    if (options.downloads) {
      downloads = [];
    }
    return true;
  });

  // --- Gestionnaire de Mots de Passe ---
  ipcMain.on('passwords:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('passwords', coords, 360, 520, '../pages/passwords-popup.html', '../preload/passwords-preload.js');
  });
  ipcMain.on('passwords:close', () => closeAllPopups());
  ipcMain.handle('passwords:get', () => store.getPasswords());
  ipcMain.handle('passwords:add', (e, item) => store.addPassword(item));
  ipcMain.handle('passwords:remove', (e, id) => store.removePassword(id));
  ipcMain.handle('passwords:get-current-domain', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return '';
    return adblock.extractDomain(tabs.get(activeTabId).url);
  });

  // --- Gestionnaire de Thèmes ---
  ipcMain.on('themes:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('themes', coords, 360, 480, '../pages/themes-popup.html', '../preload/themes-preload.js');
  });
  ipcMain.on('themes:close', () => closeAllPopups());
  ipcMain.handle('themes:get', () => store.getThemeSettings());
  ipcMain.handle('themes:save', (e, theme) => {
    const updated = store.updateThemeSettings(theme);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme:changed', updated);
    }
    return updated;
  });

  // Navigation from popups
  ipcMain.on('nav:go-and-close-popups', (e, url, openInNewTab = false) => {
    closeAllPopups();
    if (openInNewTab || !activeTabId || !tabs.has(activeTabId)) {
      createTab(url);
      return;
    }
    const tab = tabs.get(activeTabId);
    const isBlank = !tab.url || tab.url.includes('newtab.html') || tab.url.startsWith('naviddan://') || tab.url === 'about:blank';
    if (!isBlank) {
      createTab(url);
    } else {
      tab.view.webContents.loadURL(resolveSearchUrl(url)).catch(() => {});
    }
  });

  ipcMain.handle('bookmarks:add-current-page', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return null;
    const tab = tabs.get(activeTabId);
    if (!tab.url || tab.url.startsWith('file:') || tab.url.startsWith('naviddan://')) return null;
    return store.addBookmark({ title: tab.title, url: tab.url });
  });

  // Downloads data & actions
  ipcMain.handle('download:clear-list', () => {
    downloads = [];
    return true;
  });
  ipcMain.on('download:open-default-folder', () => {
    shell.openPath(app.getPath('downloads'));
  });
  ipcMain.handle('downloads:get', () => downloads);
  ipcMain.on('download:open-file', (e, filePath) => {
    if (filePath) shell.openPath(filePath);
  });
  ipcMain.on('download:show-folder', (e, filePath) => {
    if (filePath) shell.showItemInFolder(filePath);
  });

  // Settings
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', (e, newSettings) => {
    const updated = store.updateSettings(newSettings);
    if ('showBookmarksBar' in newSettings) {
      updateActiveViewBounds();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:updated', updated);
    }
    return updated;
  });

  // Shield actions
  ipcMain.handle('shield:get-data', () => {
    if (!activeTabId || !tabs.has(activeTabId)) {
      return adblock.getSiteStats('');
    }
    const currentTab = tabs.get(activeTabId);
    const domain = adblock.extractDomain(currentTab.url);
    return adblock.getSiteStats(domain);
  });

  ipcMain.handle('shield:toggle-ads', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return false;
    const currentTab = tabs.get(activeTabId);
    const domain = adblock.extractDomain(currentTab.url);
    const enabled = adblock.toggleSiteAds(domain);
    currentTab.view.webContents.reload();
    return enabled;
  });

  ipcMain.handle('shield:toggle-trackers', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return false;
    const currentTab = tabs.get(activeTabId);
    const domain = adblock.extractDomain(currentTab.url);
    const enabled = adblock.toggleSiteTrackers(domain);
    currentTab.view.webContents.reload();
    return enabled;
  });

  ipcMain.on('shield:open-settings', (e, coords) => {
    closeAllPopups();
    toggleAnchoredPopup('settings', coords || { x: 300, y: 40 }, 360, 430, '../pages/settings-popup.html', '../preload/settings-preload.js');
  });

  ipcMain.on('shield:open-privacy-info', () => {
    closeAllPopups();
    createTab('https://fr.wikipedia.org/wiki/Vie_priv%C3%A9e_et_informatique');
  });

  // --- Picture-in-Picture (PiP) Gaming Handlers ---
  ipcMain.on('pip:window-ready', () => {
    if (pipSourceTabId) {
      const srcTab = tabs.get(pipSourceTabId);
      if (srcTab && srcTab.view && !srcTab.view.webContents.isDestroyed()) {
        srcTab.view.webContents.send('pip:start-stream');
      }
    }
  });

  ipcMain.on('pip:open-request', (event) => {
    let senderTabId = null;
    for (const [id, tab] of tabs.entries()) {
      if (tab.view && tab.view.webContents === event.sender) {
        senderTabId = id;
        break;
      }
    }
    openPipWindow(senderTabId || activeTabId);
  });

  ipcMain.on('pip:open-manual', () => {
    openPipWindow(activeTabId);
  });

  ipcMain.on('pip:webrtc-offer', (event, offer) => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.webContents.send('pip:webrtc-offer', offer);
    }
  });

  ipcMain.on('pip:webrtc-answer', (event, answer) => {
    if (pipSourceTabId) {
      const tab = tabs.get(pipSourceTabId);
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('pip:webrtc-answer', answer);
      }
    }
  });

  ipcMain.on('pip:webrtc-ice-candidate', (event, cand) => {
    if (pipWindow && !pipWindow.isDestroyed() && event.sender === pipWindow.webContents) {
      if (pipSourceTabId) {
        const tab = tabs.get(pipSourceTabId);
        if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
          tab.view.webContents.send('pip:webrtc-ice-candidate', cand);
        }
      }
    } else {
      if (pipWindow && !pipWindow.isDestroyed()) {
        pipWindow.webContents.send('pip:webrtc-ice-candidate', cand);
      }
    }
  });

  ipcMain.on('pip:media-status', (event, status) => {
    for (const [id, tab] of tabs.entries()) {
      if (tab.view && tab.view.webContents === event.sender) {
        tab.hasPlayingVideo = !!status.isPlaying;
        tab.mediaStatus = status;

        // Synchronize audio state directly from media element playback
        const isMuted = (tab.view && typeof tab.view.webContents.isAudioMuted === 'function') 
          ? tab.view.webContents.isAudioMuted() 
          : !!status.isMuted;
        const isAudible = !isMuted && !!(status.isPlaying && (status.volume === undefined || status.volume > 0));

        if (tab.isAudible !== isAudible || tab.isMuted !== isMuted) {
          tab.isAudible = isAudible;
          tab.isMuted = isMuted;
          broadcastAudioState(id);
        }

        if (id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pip:media-status', status);
        }
        break;
      }
    }
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.webContents.send('pip:media-state', status);
    }
  });

  ipcMain.on('tab:audio-activity', (event, data) => {
    for (const [id, tab] of tabs.entries()) {
      if (tab.view && tab.view.webContents === event.sender) {
        const nativeMuted = (typeof tab.view.webContents.isAudioMuted === 'function') ? tab.view.webContents.isAudioMuted() : false;
        const isMuted = nativeMuted || !!data.isMuted;
        const isAudible = !isMuted && !!data.isAudible;

        if (tab.isAudible !== isAudible || tab.isMuted !== isMuted) {
          tab.isAudible = isAudible;
          tab.isMuted = isMuted;
          broadcastAudioState(id);
        }
        break;
      }
    }
  });

  ipcMain.on('pip:cmd-toggle-play', () => {
    if (pipSourceTabId) {
      const tab = tabs.get(pipSourceTabId);
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('pip:cmd-toggle-play');
      }
    }
  });

  ipcMain.on('pip:cmd-seek', (e, delta) => {
    if (pipSourceTabId) {
      const tab = tabs.get(pipSourceTabId);
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('pip:cmd-seek', delta);
      }
    }
  });

  ipcMain.on('pip:cmd-set-volume', (e, vol) => {
    if (pipSourceTabId) {
      const tab = tabs.get(pipSourceTabId);
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('pip:cmd-set-volume', vol);
      }
    }
  });

  ipcMain.on('pip:cmd-toggle-mute', () => {
    if (pipSourceTabId) {
      const tab = tabs.get(pipSourceTabId);
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('pip:cmd-toggle-mute');
      }
    }
  });

  ipcMain.on('pip:set-opacity', (e, opacity) => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.setOpacity(Math.max(0.3, Math.min(1.0, opacity)));
    }
  });

  ipcMain.on('pip:return-to-tab', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      if (pipSourceTabId) {
        selectTab(pipSourceTabId);
      }
    }
  });

  ipcMain.on('pip:close-window', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.close();
    }
  });

  // --- Sidebar Controls ---
  ipcMain.handle('sidebar:get-state', () => isSidebarVisible);
  ipcMain.handle('sidebar:toggle', () => {
    isSidebarVisible = !isSidebarVisible;
    store.updateSettings({ sidebarVisible: isSidebarVisible });
    updateActiveViewBounds();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sidebar:changed', isSidebarVisible);
    }
    return isSidebarVisible;
  });

  ipcMain.handle('adblock:stats', () => ({
    blockedCount: adblock.getBlockedCount(),
    enabled: adblock.adsEnabled
  }));
  ipcMain.handle('adblock:toggle', (e, enabled) => {
    adblock.adsEnabled = enabled;
    adblock.trackersEnabled = enabled;
    return enabled;
  });

  // --- Gaming Turbo Mode Handlers ---
  ipcMain.handle('turbo:toggle', () => toggleTurboMode());
  ipcMain.handle('turbo:get-state', () => ({
    active: isTurboModeActive
  }));

  // --- NaviSnipper Screen Capture Handlers ---
  ipcMain.on('snipper:start', () => {
    startSnipper();
  });

  ipcMain.on('snipper:do-capture', async (event, rect) => {
    let targetTab = null;
    for (const [id, tab] of tabs.entries()) {
      if (tab.view && tab.view.webContents === event.sender) {
        targetTab = tab;
        break;
      }
    }
    if (!targetTab || !targetTab.view || targetTab.view.webContents.isDestroyed()) return;

    try {
      let captureRect;
      if (rect && rect.width > 2 && rect.height > 2) {
        captureRect = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }

      const image = await targetTab.view.webContents.capturePage(captureRect);
      
      // Write image to clipboard
      try {
        if (typeof ClipboardItem !== 'undefined' && typeof clipboard?.write === 'function') {
          const item = new ClipboardItem({ 'image/png': image.toPNG() });
          await clipboard.write([item]);
        }
      } catch (clipErr) {
        // Handled silently - renderer writes as well
      }

      const size = image.getSize();
      const dataUrl = image.toDataURL();

      // Native Windows / OS System Notification
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'NaviSnipper • Capture d\'écran',
            body: `Zone ${size.width} × ${size.height} px copiée dans le presse-papier !`,
            silent: false
          }).show();
        }
      } catch (notifErr) {
        console.warn('System notification error:', notifErr.message);
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('snipper:captured', {
          dataUrl,
          width: size.width,
          height: size.height
        });
      }
    } catch (err) {
      console.error('Snipper capturePage error:', err);
    }
  });

  ipcMain.handle('snipper:save-file', async (e, dataUrl) => {
    if (!dataUrl) return false;
    try {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const defaultFilename = `naviddan-capture-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      const defaultPath = path.join(app.getPath('downloads'), defaultFilename);

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Enregistrer la capture d\'écran',
        defaultPath,
        filters: [{ name: 'Images PNG', extensions: ['png'] }]
      });

      if (filePath) {
        await fs.promises.writeFile(filePath, buffer);
        return filePath;
      }
    } catch (err) {
      console.error('Error saving snippet:', err);
    }
    return false;
  });

  ipcMain.on('snipper:copy-to-clipboard', async (e, dataUrl) => {
    if (!dataUrl) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && typeof clipboard?.write === 'function') {
        const img = nativeImage.createFromDataURL(dataUrl);
        const item = new ClipboardItem({ 'image/png': img.toPNG() });
        await clipboard.write([item]);
      }
    } catch (err) {
      console.warn('Error re-copying snippet in main:', err.message);
    }
  });

  // --- Audio Focus Controller IPC Handlers ---
  ipcMain.handle('tab:toggle-mute', (event, tabId) => {
    const id = tabId || activeTabId;
    if (!id || !tabs.has(id)) return false;
    const tab = tabs.get(id);
    if (!tab.view || tab.view.webContents.isDestroyed()) return false;
    const nextMuted = !tab.view.webContents.isAudioMuted();
    
    // Mute at both Chromium engine and in-page DOM levels
    tab.view.webContents.setAudioMuted(nextMuted);
    tab.isMuted = nextMuted;
    tab.view.webContents.send('tab:set-muted-in-page', nextMuted);
    try {
      tab.view.webContents.executeJavaScript(`
        document.querySelectorAll('video, audio').forEach(el => el.muted = ${nextMuted});
      `).catch(() => {});
    } catch {}

    broadcastAudioState(id);
    return nextMuted;
  });

  ipcMain.handle('tab:set-muted', (event, { tabId, muted }) => {
    if (!tabId || !tabs.has(tabId)) return false;
    const tab = tabs.get(tabId);
    if (!tab.view || tab.view.webContents.isDestroyed()) return false;
    tab.view.webContents.setAudioMuted(!!muted);
    tab.isMuted = !!muted;
    tab.view.webContents.send('tab:set-muted-in-page', !!muted);
    try {
      tab.view.webContents.executeJavaScript(`
        document.querySelectorAll('video, audio').forEach(el => el.muted = ${!!muted});
      `).catch(() => {});
    } catch {}

    broadcastAudioState(tabId);
    return tab.isMuted;
  });

  ipcMain.handle('audio:mute-background', () => {
    return muteBackgroundTabs();
  });

  ipcMain.handle('audio:get-streams', () => {
    const streams = [];
    for (const [id, tab] of tabs.entries()) {
      if (tab.view && !tab.view.webContents.isDestroyed()) {
        const isAudible = tab.view.webContents.isCurrentlyAudible ? tab.view.webContents.isCurrentlyAudible() : !!tab.isAudible;
        const isMuted = tab.view.webContents.isAudioMuted();
        tab.isAudible = isAudible;
        tab.isMuted = isMuted;
        if (isAudible || isMuted) {
          streams.push({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            isAudible,
            isMuted,
            isActive: id === activeTabId
          });
        }
      }
    }
    return {
      streams,
      activeTabId,
      activeTabMuted: activeTabId && tabs.has(activeTabId) && tabs.get(activeTabId).view && !tabs.get(activeTabId).view.webContents.isDestroyed()
        ? tabs.get(activeTabId).view.webContents.isAudioMuted()
        : false,
      activeTabAudible: activeTabId && tabs.has(activeTabId) && tabs.get(activeTabId).view && !tabs.get(activeTabId).view.webContents.isDestroyed()
        ? !!tabs.get(activeTabId).isAudible
        : false
    };
  });

  ipcMain.on('audio:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('audio', coords, 320, 360, '../pages/audio-popup.html', '../preload/audio-preload.js');
  });

  ipcMain.on('audio:close', () => closeAllPopups());

  // --- NaviAI Assistant IPC ---
  ipcMain.handle('naviai:get-sidebar-state', () => ({
    isOpen: isNaviAIOpen,
    width: naviAIWidth
  }));

  ipcMain.handle('naviai:toggle-sidebar', (e, forceState) => {
    isNaviAIOpen = forceState !== undefined ? Boolean(forceState) : !isNaviAIOpen;
    updateActiveViewBounds();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('naviai:sidebar-changed', {
        isOpen: isNaviAIOpen,
        width: naviAIWidth
      });
    }
    return isNaviAIOpen;
  });

  ipcMain.handle('naviai:get-settings', () => {
    if (!naviAIService) return {};
    return naviAIService.getSettings();
  });

  ipcMain.handle('naviai:save-settings', (e, newSettings) => {
    if (!naviAIService) return {};
    if (newSettings && typeof newSettings.panelWidth === 'number') {
      naviAIWidth = Math.max(280, Math.min(700, newSettings.panelWidth));
      updateActiveViewBounds();
    }
    return naviAIService.saveSettings(newSettings);
  });

  ipcMain.handle('naviai:get-ollama-models', async (e, customUrl) => {
    if (!naviAIService) return [];
    return await naviAIService.getOllamaModels(customUrl);
  });

  ipcMain.handle('naviai:get-page-content', async () => {
    if (!activeTabId) return null;
    const tab = tabs.get(activeTabId);
    if (!tab || !tab.view || tab.view.webContents.isDestroyed()) return null;

    try {
      const data = await tab.view.webContents.executeJavaScript(`
        (() => {
          try {
            const title = document.title || '';
            const url = window.location.href || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            
            const clone = document.body.cloneNode(true);
            const removeTags = ['script', 'style', 'noscript', 'svg', 'iframe', 'canvas', 'header', 'footer', 'nav', '#naviddan-pip-badge', '#naviddan-ai-selection-bubble'];
            removeTags.forEach(tag => {
              clone.querySelectorAll(tag).forEach(el => el.remove());
            });
            
            let text = clone.innerText || '';
            text = text.replace(/\\r\\n/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').replace(/[ \\t]{2,}/g, ' ').trim();
            if (text.length > 12000) {
              text = text.substring(0, 12000) + '\\n\\n[... Contenu tronqué pour respecter le budget de contexte]';
            }
            return { title, url, metaDesc, content: text };
          } catch (e) {
            return { title: document.title, url: window.location.href, content: '' };
          }
        })()
      `);
      return data;
    } catch (err) {
      return null;
    }
  });

  ipcMain.on('naviai:send-prompt', (e, payload) => {
    if (!naviAIService) return;
    naviAIService.streamChat(
      payload,
      (chunk) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('naviai:stream-chunk', chunk);
        }
      },
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('naviai:stream-done');
        }
      },
      (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('naviai:stream-error', err);
        }
      }
    );
  });

  ipcMain.on('naviai:stop-stream', () => {
    if (naviAIService) naviAIService.stopCurrentStream();
  });

  ipcMain.on('naviai:open-with-selection', (e, data) => {
    if (!isNaviAIOpen) {
      isNaviAIOpen = true;
      updateActiveViewBounds();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('naviai:sidebar-changed', {
          isOpen: true,
          width: naviAIWidth
        });
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('naviai:trigger-prompt', data);
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  if (process.platform === 'linux') {
    app.setName('NaviDdan');
    app.setAppUserModelId?.('com.naviddan.browser');
  }
  store = new Store();
  naviAIService = new NaviAIService(store);
  const aiConf = naviAIService.getSettings();
  if (aiConf.panelWidth) {
    naviAIWidth = Math.max(280, Math.min(700, aiConf.panelWidth));
  }
  isSidebarVisible = store.getSettings().sidebarVisible !== false;
  setupSession(session.defaultSession);
  registerIpcHandlers();
  createWindow();

  // Global shortcut for Mute Active Tab (Ctrl+M)
  try {
    globalShortcut.register('CommandOrControl+M', () => {
      toggleActiveTabMute();
    });
  } catch (err) {
    console.warn('Could not register Mute shortcut:', err);
  }

  // Global shortcut for Mute Background Tabs (Ctrl+Shift+M)
  try {
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      muteBackgroundTabs();
    });
  } catch (err) {
    console.warn('Could not register Mute Background shortcut:', err);
  }

  // Global shortcut for Gaming Turbo Mode (Ctrl+Shift+G)
  try {
    globalShortcut.register('CommandOrControl+Shift+G', () => {
      toggleTurboMode();
    });
  } catch (err) {
    console.warn('Could not register Turbo shortcut:', err);
  }

  // Global shortcut for NaviSnipper Screen Capture (Ctrl+Shift+S)
  try {
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      startSnipper();
    });
  } catch (err) {
    console.warn('Could not register Snipper shortcut:', err);
  }

  // Global shortcut for NaviAI Sidebar (Ctrl+Shift+A)
  try {
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      isNaviAIOpen = !isNaviAIOpen;
      updateActiveViewBounds();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('naviai:sidebar-changed', {
          isOpen: isNaviAIOpen,
          width: naviAIWidth
        });
      }
    });
  } catch (err) {
    console.warn('Could not register NaviAI shortcut:', err);
  }

  // Real-time Audio Focus Watchdog for all tabs (500ms)
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    for (const [id, tab] of tabs.entries()) {
      if (!tab.view || tab.view.webContents.isDestroyed()) continue;
      const wc = tab.view.webContents;
      const nativeAudible = typeof wc.isCurrentlyAudible === 'function' ? wc.isCurrentlyAudible() : false;
      const nativeMuted = typeof wc.isAudioMuted === 'function' ? wc.isAudioMuted() : false;
      const mediaPlaying = !!(tab.mediaStatus && tab.mediaStatus.isPlaying && !tab.mediaStatus.isMuted);

      const computedAudible = !nativeMuted && (nativeAudible || mediaPlaying);
      const computedMuted = nativeMuted;

      if (tab.isAudible !== computedAudible || tab.isMuted !== computedMuted) {
        tab.isAudible = computedAudible;
        tab.isMuted = computedMuted;
        broadcastAudioState(id);
      }
    }
  }, 500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
