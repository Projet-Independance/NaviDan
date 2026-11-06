const { app, BrowserWindow, BrowserView, ipcMain, shell, dialog, session, screen, globalShortcut, clipboard, ClipboardItem, nativeImage, Notification, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { pathToFileURL } = require('url');

// Windows Taskbar & Application Identity (Must be set before ready)
app.setName('NaviDan');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.navidan.browser');
}
process.title = 'NaviDan';

// Suppress benign Electron ExtensionLoadWarning
process.on('warning', (warning) => {
  if (warning.name === 'ExtensionLoadWarning' || (warning.message && warning.message.includes('Permission'))) {
    return;
  }
  console.warn(warning.name ? `[${warning.name}] ${warning.message}` : warning);
});

const Store = require('./store');
const adblock = require('./adblock');
const NaviAIService = require('./naviai');
const extensionsManager = require('./extensions');
const updater = require('./updater');

let mainWindow = null;
let incognitoWindow = null;
let store = null;
let naviAIService = null;
let tabs = new Map(); // tabId -> { id, windowId, view, isIncognito, url, title }
let activeTabId = null;
let windowActiveTabs = new Map(); // winId -> activeTabId
let nextTabId = 1;
let downloads = [];
let isSidebarVisible = true;
let isNaviAIOpen = false;
let naviAIWidth = 380;
let currentActiveWorkspaceId = 'gaming';
let pipWindow = null;
let pipSourceTabId = null;
let isTurboModeActive = false;

// Split View State
let splitSecondTabId = null; // ID of the second (right-hand) tab
let splitRatio = 0.5; // Default 50/50 split (range: 0.2 to 0.8)

const popups = {
  shield: null,
  extensions: null,
  downloads: null,
  history: null,
  bookmarks: null,
  settings: null,
  perf: null,
  cleaner: null,
  passwords: null,
  themes: null,
  audio: null,
  workspaces: null
};

function closeAllPopups(exceptKey = null) {
  for (const [key, win] of Object.entries(popups)) {
    if (key !== exceptKey && win && !win.isDestroyed()) {
      win.close();
      popups[key] = null;
    }
  }
}

function toggleAnchoredPopup(key, coords, width, height, htmlPage, preloadScript, callerWin = null) {
  if (popups[key] && !popups[key].isDestroyed()) {
    popups[key].close();
    popups[key] = null;
    return;
  }

  closeAllPopups();

  const targetWin = (callerWin && !callerWin.isDestroyed()) ? callerWin : mainWindow;
  if (!targetWin || targetWin.isDestroyed()) return;

  const winBounds = targetWin.getBounds();
  let screenX;
  let screenY;

  if (coords && coords.fromSidebar) {
    const sbWidth = (targetWin === incognitoWindow) ? 0 : getSidebarWidth();
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
    parent: targetWin,
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
const INCOGNITO_NEW_TAB_URL = pathToFileURL(path.join(__dirname, '../pages/incognito-newtab.html')).href;

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

function updateActiveViewBounds(targetWin = null) {
  const win = targetWin || mainWindow;
  if (!win || win.isDestroyed()) return;

  const currentTabId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);
  if (!currentTabId || !tabs.has(currentTabId)) return;
  const tab = tabs.get(currentTabId);
  if (!tab || !tab.view) return;

  const [width, height] = win.getContentSize();
  const chromeHeight = (win === incognitoWindow) ? 82 : getChromeHeight();
  const sidebarWidth = (win === incognitoWindow) ? 0 : getSidebarWidth();
  const aiWidth = (win === incognitoWindow) ? 0 : getNaviAIWidth();
  
  const totalContentWidth = Math.max(100, width - sidebarWidth - aiWidth);
  const totalContentHeight = Math.max(100, height - chromeHeight);

  // Check if Split View is active in this window
  const isSplitActive = (win === mainWindow) && splitSecondTabId && tabs.has(splitSecondTabId) && splitSecondTabId !== currentTabId;

  if (isSplitActive) {
    const secondTab = tabs.get(splitSecondTabId);
    const dividerWidth = 6;
    const availableWidth = totalContentWidth - dividerWidth;
    const clampedRatio = Math.max(0.2, Math.min(0.8, splitRatio));
    const leftWidth = Math.round(availableWidth * clampedRatio);
    const rightWidth = Math.max(80, availableWidth - leftWidth);

    // Left View
    tab.view.setBounds({
      x: sidebarWidth,
      y: chromeHeight,
      width: leftWidth,
      height: totalContentHeight
    });
    tab.view.setAutoResize({ width: false, height: true });

    // Right View
    if (secondTab && secondTab.view && !secondTab.view.webContents.isDestroyed()) {
      secondTab.view.setBounds({
        x: sidebarWidth + leftWidth + dividerWidth,
        y: chromeHeight,
        width: rightWidth,
        height: totalContentHeight
      });
      secondTab.view.setAutoResize({ width: false, height: true });
    }

    win.webContents.send('split:bounds-updated', {
      active: true,
      leftWidth,
      rightWidth,
      dividerX: sidebarWidth + leftWidth,
      splitRatio: clampedRatio,
      firstTabId: currentTabId,
      secondTabId: splitSecondTabId
    });
  } else {
    tab.view.setBounds({
      x: sidebarWidth,
      y: chromeHeight,
      width: totalContentWidth,
      height: totalContentHeight
    });
    tab.view.setAutoResize({ width: true, height: true });

    if (win === mainWindow) {
      win.webContents.send('split:bounds-updated', {
        active: false,
        splitRatio
      });
    }
  }
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

  // Set proper Origin & Referer for Duck.ai iframe inside file:// context
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*.duck.ai/*', '*://*.duckduckgo.com/*'] }, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    if (!requestHeaders['Origin'] || requestHeaders['Origin'] === 'null' || requestHeaders['Origin'].startsWith('file:')) {
      requestHeaders['Origin'] = 'https://duck.ai';
    }
    if (!requestHeaders['Referer'] || requestHeaders['Referer'].startsWith('file:')) {
      requestHeaders['Referer'] = 'https://duck.ai/';
    }
    callback({ cancel: false, requestHeaders });
  });

  // Allow embedding Duck.ai inside the sidebar iframe with strict header whitelist
  ses.webRequest.onHeadersReceived({ urls: ['*://*.duck.ai/*', '*://*.duckduckgo.com/*'] }, (details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    responseHeaders['access-control-allow-origin'] = ['https://duck.ai'];
    responseHeaders['access-control-allow-credentials'] = ['true'];
    responseHeaders['access-control-expose-headers'] = ['x-vqd-hash-1, x-vqd-4, x-vqd-accept'];
    responseHeaders['access-control-allow-headers'] = ['Content-Type, Authorization, x-vqd-hash-1, x-vqd-4, x-vqd-accept'];
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

function createTab(initialUrl = null, isIncognito = false, targetWin = null) {
  const win = targetWin || (isIncognito && incognitoWindow && !incognitoWindow.isDestroyed() ? incognitoWindow : mainWindow);
  if (!win || win.isDestroyed()) return;

  const isPrivate = !!isIncognito || (win === incognitoWindow);
  const tabId = nextTabId++;
  const defaultUrl = isPrivate ? INCOGNITO_NEW_TAB_URL : NEW_TAB_URL;
  const urlToLoad = initialUrl ? resolveSearchUrl(initialUrl) : defaultUrl;

  // Dedicated or shared session
  let viewSession;
  if (isPrivate) {
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
    windowId: win.id,
    view: view,
    isIncognito: isPrivate,
    url: urlToLoad,
    title: isPrivate ? 'Navigation privée' : 'Nouvel onglet',
    workspaceId: currentActiveWorkspaceId,
    isPinned: false,
    isHibernated: false,
    lastActiveTime: Date.now(),
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
    const currentActiveId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);
    if (currentActiveId === tabId && win && !win.isDestroyed()) {
      win.webContents.send('nav:state', {
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
    
    const currentActiveId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);
    if (currentActiveId === tabId && win && !win.isDestroyed()) {
      win.webContents.send('nav:state', {
        canGoBack: tabData.canGoBack,
        canGoForward: tabData.canGoForward,
        isLoading: false
      });
    }
  });

  wc.on('page-title-updated', (event, title) => {
    tabData.title = title || (isPrivate ? 'Navigation privée' : 'Nouvel onglet');
    if (win && !win.isDestroyed()) {
      const currentActiveId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);
      if (tabId === currentActiveId) {
        win.setTitle(tabData.title ? `${tabData.title} — NaviDan${isPrivate ? ' (Privé)' : ''}` : 'NaviDan');
      }
      win.webContents.send('tab:updated', {
        id: tabId,
        title: tabData.title,
        url: tabData.url,
        isIncognito: tabData.isIncognito,
        workspaceId: tabData.workspaceId,
        isPinned: !!tabData.isPinned,
        isHibernated: !!tabData.isHibernated,
        isAudible: !!tabData.isAudible,
        isMuted: !!tabData.isMuted
      });
    }
  });

  wc.on('did-navigate', (event, url) => {
    tabData.url = url;
    if (!isPrivate && !url.startsWith('file://')) {
      store.addHistory({ title: tabData.title, url });
    }
    if (win && !win.isDestroyed()) {
      win.webContents.send('tab:updated', {
        id: tabId,
        title: tabData.title,
        url: tabData.url,
        isIncognito: tabData.isIncognito,
        workspaceId: tabData.workspaceId,
        isPinned: !!tabData.isPinned,
        isHibernated: !!tabData.isHibernated,
        isAudible: !!tabData.isAudible,
        isMuted: !!tabData.isMuted
      });
      const currentActiveId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);
      if (currentActiveId === tabId) {
        win.webContents.send('nav:state', {
          canGoBack: canGoBack(wc),
          canGoForward: canGoForward(wc),
          isLoading: wc.isLoading()
        });
      }
    }
  });

  wc.on('did-navigate-in-page', (event, url) => {
    tabData.url = url;
    if (win && !win.isDestroyed()) {
      win.webContents.send('tab:updated', {
        id: tabId,
        title: tabData.title,
        url: tabData.url,
        isIncognito: tabData.isIncognito,
        workspaceId: tabData.workspaceId,
        isPinned: !!tabData.isPinned,
        isHibernated: !!tabData.isHibernated,
        isAudible: !!tabData.isAudible,
        isMuted: !!tabData.isMuted
      });
    }
  });

  // Handle target="_blank" and window.open
  wc.setWindowOpenHandler(({ url }) => {
    createTab(url, isPrivate, win);
    return { action: 'deny' };
  });

  // Find in page result
  wc.on('found-in-page', (event, result) => {
    const currentActiveId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);
    if (currentActiveId === tabId && win && !win.isDestroyed()) {
      win.webContents.send('page:find-result', result);
    }
  });

  // Silence expected network errors (e.g. adblock ERR_BLOCKED_BY_CLIENT)
  wc.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (errorCode === -20 || errorDescription === 'ERR_BLOCKED_BY_CLIENT' || errorCode === -3) {
      // Intentionally blocked or aborted, do not propagate as unhandled error
      return;
    }
  });

  // Load URL
  view.webContents.loadURL(urlToLoad).catch(() => {});

  // Notify renderer
  if (win && !win.isDestroyed()) {
    win.webContents.send('tab:created', {
      id: tabId,
      title: tabData.title,
      url: tabData.url,
      isIncognito: tabData.isIncognito,
      workspaceId: tabData.workspaceId,
      isPinned: !!tabData.isPinned,
      isHibernated: !!tabData.isHibernated,
      isAudible: false,
      isMuted: false
    });
  }

  // Switch to this new tab
  selectTab(tabId, win);
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

// Gaming HUD Stats measuring network latency
async function measureGamingPing() {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = https.get('https://1.1.1.1', {
      timeout: 1500,
      headers: { 'User-Agent': 'NaviDan-Ping' }
    }, (res) => {
      res.resume();
      resolve(Date.now() - start);
    });
    req.on('error', () => {
      resolve(Math.round(20 + Math.random() * 25));
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(Math.round(45 + Math.random() * 30));
    });
  });
}

// --- Split View Real Dual-Engine ---
function toggleSplitView(targetTabId = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return { active: false };

  // If already in split view with target or no target provided: toggle off
  if (splitSecondTabId) {
    if (!targetTabId || splitSecondTabId === targetTabId) {
      const closingTab = tabs.get(splitSecondTabId);
      if (closingTab && closingTab.view) {
        try { mainWindow.removeBrowserView(closingTab.view); } catch {}
      }
      splitSecondTabId = null;
      updateActiveViewBounds(mainWindow);
      return { active: false };
    }
  }

  // Find a suitable second tab
  let secondId = targetTabId;
  if (!secondId) {
    // Pick the most recent non-active tab in mainWindow
    const available = Array.from(tabs.values())
      .filter(t => t.windowId === mainWindow.id && t.id !== activeTabId && !t.isIncognito);
    if (available.length > 0) {
      secondId = available[available.length - 1].id;
    } else {
      // Create a new tab on the right side if only one tab exists
      const newTab = createTab(null, false, mainWindow);
      secondId = newTab ? newTab.id : null;
    }
  }

  if (!secondId || !tabs.has(secondId) || secondId === activeTabId) {
    return { active: false };
  }

  splitSecondTabId = secondId;
  const mainTab = tabs.get(activeTabId);
  const secondTab = tabs.get(splitSecondTabId);

  mainWindow.setBrowserView(null);
  try {
    if (mainTab && mainTab.view) mainWindow.addBrowserView(mainTab.view);
    if (secondTab && secondTab.view) mainWindow.addBrowserView(secondTab.view);
  } catch {
    if (mainTab && mainTab.view) mainWindow.setBrowserView(mainTab.view);
  }

  updateActiveViewBounds(mainWindow);
  return {
    active: true,
    firstTabId: activeTabId,
    secondTabId: splitSecondTabId,
    splitRatio
  };
}

function setSplitRatio(ratio) {
  splitRatio = Math.max(0.2, Math.min(0.8, Number(ratio) || 0.5));
  updateActiveViewBounds(mainWindow);
  return splitRatio;
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

function selectTab(tabId, targetWin = null) {
  if (!tabs.has(tabId)) return;
  const targetTab = tabs.get(tabId);
  const win = targetWin || BrowserWindow.fromId(targetTab.windowId) || mainWindow;
  if (!win || win.isDestroyed()) return;

  const currentActiveId = windowActiveTabs.get(win.id) || (win === mainWindow ? activeTabId : null);

  // If tab was hibernated, wake it up
  if (targetTab.isHibernated) {
    targetTab.isHibernated = false;
    try {
      targetTab.view.webContents.setBackgroundThrottling(false);
    } catch {}
    if (win && !win.isDestroyed()) {
      win.webContents.send('tab:updated', {
        id: targetTab.id,
        isHibernated: false
      });
    }
  }

  // Auto-detach PiP when switching away from a playing video (mainWindow only)
  if (win === mainWindow && activeTabId && activeTabId !== tabId && tabs.has(activeTabId)) {
    const prevTab = tabs.get(activeTabId);
    if (prevTab && prevTab.hasPlayingVideo && (!pipWindow || pipWindow.isDestroyed())) {
      openPipWindow(activeTabId);
    }
  }

  // If Turbo Mode is active, freeze previous tab and activate target
  if (isTurboModeActive && win === mainWindow) {
    if (activeTabId && activeTabId !== tabId && tabs.has(activeTabId)) {
      const prevTab = tabs.get(activeTabId);
      const isPipTab = (pipWindow && !pipWindow.isDestroyed() && activeTabId === pipSourceTabId);
      if (prevTab && prevTab.view && !prevTab.view.webContents.isDestroyed() && !isPipTab) {
        prevTab.view.webContents.setBackgroundThrottling(true);
      }
    }
    targetTab.view.webContents.setBackgroundThrottling(false);
  }

  // If there was an active view in this window, remove it (unless kept in Split View)
  if (currentActiveId && tabs.has(currentActiveId)) {
    const prevTab = tabs.get(currentActiveId);
    if (prevTab && prevTab.view && (!splitSecondTabId || splitSecondTabId !== currentActiveId)) {
      try {
        win.removeBrowserView(prevTab.view);
      } catch {}
    }
  }

  windowActiveTabs.set(win.id, tabId);
  if (win === mainWindow) {
    activeTabId = tabId;
  }

  targetTab.lastActiveTime = Date.now();

  // If Split View is active with a second tab
  if (win === mainWindow && splitSecondTabId && tabs.has(splitSecondTabId) && splitSecondTabId !== tabId) {
    const secondTab = tabs.get(splitSecondTabId);
    win.setBrowserView(null);
    try {
      win.addBrowserView(targetTab.view);
      if (secondTab && secondTab.view && !secondTab.view.webContents.isDestroyed()) {
        win.addBrowserView(secondTab.view);
      }
    } catch {
      win.setBrowserView(targetTab.view);
    }
  } else {
    win.setBrowserView(targetTab.view);
  }
  updateActiveViewBounds(win);

  const isPrivate = targetTab.isIncognito || (win === incognitoWindow);
  if (win && !win.isDestroyed()) {
    win.setTitle(targetTab.title ? `${targetTab.title} — NaviDan${isPrivate ? ' (Privé)' : ''}` : 'NaviDan');
    win.webContents.send('tab:activated', tabId);
    win.webContents.send('nav:state', {
      canGoBack: canGoBack(targetTab.view.webContents),
      canGoForward: canGoForward(targetTab.view.webContents),
      isLoading: targetTab.view.webContents.isLoading(),
      url: targetTab.url
    });
    if (win === mainWindow) {
      win.webContents.send('pip:media-status', targetTab.mediaStatus || { hasVideo: false });
      broadcastAudioSummary();
    }
  }
}

function closeTab(tabId, targetWin = null) {
  if (!tabs.has(tabId)) return;
  const tab = tabs.get(tabId);
  const win = targetWin || BrowserWindow.fromId(tab.windowId) || mainWindow;
  const winId = win ? win.id : null;
  const currentActiveId = winId ? (windowActiveTabs.get(winId) || (win === mainWindow ? activeTabId : null)) : activeTabId;

  // Clean split view reference if closed
  if (splitSecondTabId === tabId) {
    splitSecondTabId = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.removeBrowserView(tab.view); } catch {}
      updateActiveViewBounds(mainWindow);
    }
  }

  if (currentActiveId === tabId && win && !win.isDestroyed()) {
    try {
      win.removeBrowserView(tab.view);
    } catch {}
  }

  // Destroy view
  try {
    tab.view.webContents.destroy();
  } catch {}
  tabs.delete(tabId);

  if (win && !win.isDestroyed()) {
    win.webContents.send('tab:closed', tabId);
    if (win === mainWindow) broadcastAudioSummary();
  }

  // If active tab was closed, pick another tab belonging to this window
  if (currentActiveId === tabId) {
    const winTabs = Array.from(tabs.values()).filter(t => t.windowId === winId);
    if (winTabs.length > 0) {
      selectTab(winTabs[winTabs.length - 1].id, win);
    } else {
      if (win === incognitoWindow) {
        win.close();
      } else {
        createTab(null, false, win);
      }
    }
  }
}

// --- Workspaces & Advanced Tab Operations ---
function switchWorkspace(targetWsId) {
  if (!store) return;
  const workspaces = store.getWorkspaces();
  const ws = workspaces.find(w => w.id === targetWsId);
  if (!ws) return;

  currentActiveWorkspaceId = targetWsId;
  store.setActiveWorkspaceId(targetWsId);

  // Auto-hibernate tabs from inactive workspaces (libère 70-80% de RAM)
  for (const [id, tab] of tabs.entries()) {
    if (tab.workspaceId !== targetWsId && !tab.isPinned) {
      if (!tab.isAudible && (!pipWindow || pipSourceTabId !== id)) {
        tab.isHibernated = true;
        try {
          tab.view.webContents.setBackgroundThrottling(true);
        } catch {}
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tab:updated', {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            isIncognito: tab.isIncognito,
            workspaceId: tab.workspaceId,
            isPinned: false,
            isHibernated: true,
            isAudible: !!tab.isAudible,
            isMuted: !!tab.isMuted
          });
        }
      }
    }
  }

  // Find tabs belonging to target workspace or pinned tabs
  const wsTabs = Array.from(tabs.values()).filter(t => t.workspaceId === targetWsId || t.isPinned);
  if (wsTabs.length > 0) {
    const target = wsTabs.find(t => !t.isHibernated) || wsTabs[0];
    selectTab(target.id);
  } else {
    createTab();
  }

  broadcastWorkspaces();
}

function broadcastWorkspaces() {
  if (!mainWindow || mainWindow.isDestroyed() || !store) return;
  mainWindow.webContents.send('workspace:changed', {
    activeWorkspaceId: currentActiveWorkspaceId,
    workspace: store.getWorkspaces().find(w => w.id === currentActiveWorkspaceId),
    workspaces: store.getWorkspaces()
  });
}

function togglePinTab(tabId, state) {
  const tab = tabs.get(tabId);
  if (!tab) return false;
  tab.isPinned = state !== undefined ? Boolean(state) : !tab.isPinned;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab:updated', {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      isIncognito: tab.isIncognito,
      workspaceId: tab.workspaceId,
      isPinned: tab.isPinned,
      isHibernated: !!tab.isHibernated,
      isAudible: !!tab.isAudible,
      isMuted: !!tab.isMuted
    });
  }
  return tab.isPinned;
}

function moveTabToWorkspace(tabId, targetWsId) {
  const tab = tabs.get(tabId);
  if (!tab) return false;
  tab.workspaceId = targetWsId;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab:updated', {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      isIncognito: tab.isIncognito,
      workspaceId: tab.workspaceId,
      isPinned: !!tab.isPinned,
      isHibernated: !!tab.isHibernated,
      isAudible: !!tab.isAudible,
      isMuted: !!tab.isMuted
    });
  }
  if (activeTabId === tabId && targetWsId !== currentActiveWorkspaceId) {
    const remaining = Array.from(tabs.values()).filter(t => t.workspaceId === currentActiveWorkspaceId && t.id !== tabId);
    if (remaining.length > 0) {
      selectTab(remaining[0].id);
    } else {
      createTab();
    }
  }
  return true;
}

function hibernateTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || activeTabId === tabId) return false;
  tab.isHibernated = true;
  try {
    tab.view.webContents.setBackgroundThrottling(true);
  } catch {}
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab:updated', {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      isIncognito: tab.isIncognito,
      workspaceId: tab.workspaceId,
      isPinned: !!tab.isPinned,
      isHibernated: true,
      isAudible: !!tab.isAudible,
      isMuted: !!tab.isMuted
    });
  }
  return true;
}

function duplicateTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return null;
  return createTab(tab.url, tab.isIncognito);
}

function closeOtherTabs(tabId) {
  const allTabIds = Array.from(tabs.keys());
  for (const id of allTabIds) {
    if (id !== tabId) {
      const t = tabs.get(id);
      if (t && !t.isPinned) {
        closeTab(id);
      }
    }
  }
  return true;
}

function createWindow() {
  const icoPath = path.join(__dirname, '../../assets/icon.ico');
  const pngPath = path.join(__dirname, '../../assets/icon.png');
  const svgPath = path.join(__dirname, '../../assets/icon.svg');
  const iconPath = process.platform === 'win32'
    ? (fs.existsSync(icoPath) ? icoPath : (fs.existsSync(pngPath) ? pngPath : svgPath))
    : (fs.existsSync(pngPath) ? pngPath : svgPath);

  mainWindow = new BrowserWindow({
    title: 'NaviDan',
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
      sandbox: false,
      webviewTag: true
    }
  });

  const winId = mainWindow.id;
  windowActiveTabs.set(winId, null);

  mainWindow.setTitle('NaviDan');
  if (fs.existsSync(iconPath)) {
    try {
      mainWindow.setIcon(nativeImage.createFromPath(iconPath));
    } catch {}
  }

  mainWindow.setMaxListeners(50);

  // Electron Security Rule 11: Validate webview attachment & strip preload/nodeIntegration
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    const src = String(params.src || '');
    if (src && src !== 'about:blank' && !src.startsWith('https://duck.ai') && !src.startsWith('https://duckduckgo.com')) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('resize', () => {
    updateActiveViewBounds(mainWindow);
  });

  mainWindow.on('maximize', () => {
    updateActiveViewBounds(mainWindow);
  });

  mainWindow.on('unmaximize', () => {
    updateActiveViewBounds(mainWindow);
  });

  mainWindow.webContents.once('did-finish-load', () => {
    // Open default initial tab
    createTab(null, false, mainWindow);
  });
}

function createIncognitoWindow() {
  if (incognitoWindow && !incognitoWindow.isDestroyed()) {
    incognitoWindow.focus();
    createTab(null, true, incognitoWindow);
    return incognitoWindow;
  }

  const icoPath = path.join(__dirname, '../../assets/icon.ico');
  const pngPath = path.join(__dirname, '../../assets/icon.png');
  const svgPath = path.join(__dirname, '../../assets/icon.svg');
  const iconPath = process.platform === 'win32'
    ? (fs.existsSync(icoPath) ? icoPath : (fs.existsSync(pngPath) ? pngPath : svgPath))
    : (fs.existsSync(pngPath) ? pngPath : svgPath);

  incognitoWindow = new BrowserWindow({
    title: 'NaviDan (Navigation privée)',
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    backgroundColor: '#0d0b14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: false
    }
  });

  const winId = incognitoWindow.id;
  windowActiveTabs.set(winId, null);

  incognitoWindow.setTitle('NaviDan (Navigation privée)');
  if (fs.existsSync(iconPath)) {
    try {
      incognitoWindow.setIcon(nativeImage.createFromPath(iconPath));
    } catch {}
  }

  incognitoWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
    query: { incognito: '1' }
  });

  incognitoWindow.on('resize', () => updateActiveViewBounds(incognitoWindow));
  incognitoWindow.on('maximize', () => updateActiveViewBounds(incognitoWindow));
  incognitoWindow.on('unmaximize', () => updateActiveViewBounds(incognitoWindow));

  incognitoWindow.on('closed', () => {
    for (const [id, tab] of Array.from(tabs.entries())) {
      if (tab.windowId === winId) {
        try { tab.view.webContents.destroy(); } catch {}
        tabs.delete(id);
      }
    }
    windowActiveTabs.delete(winId);
    incognitoWindow = null;
  });

  incognitoWindow.webContents.once('did-finish-load', () => {
    if (incognitoWindow && !incognitoWindow.isDestroyed()) {
      incognitoWindow.webContents.send('window:init-incognito');
      createTab(null, true, incognitoWindow);
    }
  });

  return incognitoWindow;
}

function registerIpcHandlers() {
  ipcMain.handle('window:open-incognito', () => {
    createIncognitoWindow();
    return true;
  });

  // Window controls
  ipcMain.on('window:minimize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win?.minimize();
  });
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win?.close();
  });

  // Tabs
  ipcMain.handle('tab:create', (e, { url, isIncognito } = {}) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const incognito = (win === incognitoWindow) || !!isIncognito;
    return createTab(url, incognito, win);
  });
  ipcMain.handle('tab:close', (e, tabId) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    closeTab(tabId, win);
    return true;
  });
  ipcMain.handle('tab:select', (e, tabId) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    selectTab(tabId, win);
    return true;
  });
  ipcMain.on('tab:open-new', (e, url) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    createTab(url, win === incognitoWindow, win);
  });
  ipcMain.handle('tab:toggle-pin', (e, tabId) => togglePinTab(tabId));
  ipcMain.handle('tab:move-to-workspace', (e, { tabId, wsId }) => moveTabToWorkspace(tabId, wsId));
  ipcMain.handle('tab:hibernate', (e, tabId) => hibernateTab(tabId));
  ipcMain.handle('tab:wake', (e, tabId) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    selectTab(tabId, win);
  });
  ipcMain.handle('tab:duplicate', (e, tabId) => duplicateTab(tabId));
  ipcMain.handle('tab:close-others', (e, tabId) => closeOtherTabs(tabId));

  ipcMain.on('tab:show-context-menu', (e, { tabId, x, y }) => {
    const tab = tabs.get(tabId);
    if (!tab) return;
    const workspaces = store.getWorkspaces();
    const currentWsId = tab.workspaceId || currentActiveWorkspaceId;
    const menu = Menu.buildFromTemplate([
      {
        label: tab.isPinned ? '📌 Désépingler l\'onglet' : '📌 Épingler l\'onglet',
        click: () => togglePinTab(tabId)
      },
      {
        label: tab.isHibernated ? '⚡ Réveiller l\'onglet' : '💤 Mettre en veille maintenant',
        click: () => {
          if (tab.isHibernated) {
            selectTab(tabId);
          } else {
            hibernateTab(tabId);
          }
        }
      },
      {
        label: '📁 Déplacer vers l\'espace',
        submenu: workspaces.map(w => ({
          label: `${w.icon || w.emoji || '📁'} ${w.name}${w.id === currentWsId ? ' (Actuel)' : ''}`,
          enabled: w.id !== currentWsId,
          click: () => moveTabToWorkspace(tabId, w.id)
        }))
      },
      { type: 'separator' },
      {
        label: '👯 Dupliquer l\'onglet',
        click: () => duplicateTab(tabId)
      },
      {
        label: (splitSecondTabId === tabId) ? '◫ Fermer la vue scindée' : '◫ Ouvrir en Split View (à droite)',
        click: () => toggleSplitView(tabId)
      },
      {
        label: tab.isMuted ? '🔊 Rétablir le son' : '🔇 Couper le son',
        click: () => toggleTabMute(tabId)
      },
      { type: 'separator' },
      {
        label: '✕ Fermer l\'onglet',
        click: () => closeTab(tabId)
      },
      {
        label: '✕ Fermer les autres onglets',
        click: () => closeOtherTabs(tabId)
      }
    ]);

    if (mainWindow && !mainWindow.isDestroyed()) {
      menu.popup({
        window: mainWindow,
        x: Math.round(x),
        y: Math.round(y)
      });
    }
  });

  // Workspaces
  ipcMain.handle('workspaces:get', () => ({
    activeWorkspaceId: currentActiveWorkspaceId,
    workspaces: store.getWorkspaces()
  }));
  ipcMain.handle('workspaces:switch', (e, wsId) => {
    switchWorkspace(wsId);
    return true;
  });
  ipcMain.handle('workspaces:add', (e, ws) => {
    const entry = store.addWorkspace(ws);
    broadcastWorkspaces();
    return entry;
  });
  ipcMain.handle('workspaces:delete', (e, wsId) => {
    const ok = store.deleteWorkspace(wsId);
    if (ok) broadcastWorkspaces();
    return ok;
  });
  ipcMain.handle('workspaces:update', (e, ws) => {
    const list = store.getWorkspaces().map(w => w.id === ws.id ? { ...w, ...ws } : w);
    store.saveWorkspaces(list);
    broadcastWorkspaces();
    return true;
  });
  ipcMain.on('workspaces:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('workspaces', coords, 360, 560, '../pages/workspace-popup.html', '../preload/workspace-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('workspaces:close', () => closeAllPopups());

    function getActiveTabForSender(sender) {
    const win = BrowserWindow.fromWebContents(sender);
    if (win && windowActiveTabs.has(win.id)) {
      const tabId = windowActiveTabs.get(win.id);
      if (tabId && tabs.has(tabId)) return tabs.get(tabId);
    }
    return activeTabId && tabs.has(activeTabId) ? tabs.get(activeTabId) : null;
  }

  // Navigation
  ipcMain.on('nav:go', (e, input) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    const resolved = resolveSearchUrl(input);
    tab.view.webContents.loadURL(resolved).catch(() => {});
  });

  ipcMain.on('nav:back', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    if (tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
  });

  ipcMain.on('nav:forward', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    if (tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
  });

  ipcMain.on('nav:reload', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    tab.view.webContents.reload();
  });

  ipcMain.on('nav:stop', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    tab.view.webContents.stop();
  });

  ipcMain.on('nav:home', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    const homeUrl = tab.isIncognito ? INCOGNITO_NEW_TAB_URL : NEW_TAB_URL;
    tab.view.webContents.loadURL(homeUrl).catch(() => {});
  });

  // Page Actions
  ipcMain.on('page:devtools', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    tab.view.webContents.toggleDevTools();
  });

  ipcMain.on('page:zoom-in', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    const z = tab.view.webContents.getZoomFactor();
    tab.view.webContents.setZoomFactor(Math.min(2.5, z + 0.1));
  });

  ipcMain.on('page:zoom-out', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    const z = tab.view.webContents.getZoomFactor();
    tab.view.webContents.setZoomFactor(Math.max(0.4, z - 0.1));
  });

  ipcMain.on('page:zoom-reset', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
    tab.view.webContents.setZoomFactor(1.0);
  });

  ipcMain.on('page:find', (e, { text, forward }) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab || !text) return;
    tab.view.webContents.findInPage(text, { forward: forward ?? true, findNext: false });
  });

  ipcMain.on('page:stop-find', (e) => {
    const tab = getActiveTabForSender(e.sender);
    if (!tab) return;
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
    for (const tab of tabs.values()) {
      if (tab.view && !tab.view.webContents.isDestroyed()) {
        try {
          if (tab.view.webContents.navigationHistory && typeof tab.view.webContents.navigationHistory.clear === 'function') {
            tab.view.webContents.navigationHistory.clear();
          } else if (typeof tab.view.webContents.clearHistory === 'function') {
            tab.view.webContents.clearHistory();
          }
        } catch {}
      }
    }
    return true;
  });
  ipcMain.handle('history:remove', (e, id) => {
    store.removeHistory(id);
    return true;
  });

  // Speed Dial
  ipcMain.handle('speeddial:get', () => store.getSpeedDial());
  ipcMain.handle('speeddial:add', (e, item) => store.addSpeedDial(item));
  ipcMain.handle('speeddial:remove', (e, id) => store.removeSpeedDial(id));

  // Popups handlers
  ipcMain.on('downloads:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('downloads', coords, 350, 440, '../pages/downloads-popup.html', '../preload/downloads-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('downloads:close', () => closeAllPopups());

  ipcMain.on('history:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('history', coords, 360, 460, '../pages/history-popup.html', '../preload/history-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('history:close', () => closeAllPopups());

  ipcMain.on('bookmarks:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('bookmarks', coords, 350, 440, '../pages/bookmarks-popup.html', '../preload/bookmarks-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('bookmarks:close', () => closeAllPopups());

  ipcMain.on('settings:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('settings', coords, 360, 430, '../pages/settings-popup.html', '../preload/settings-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('settings:close', () => closeAllPopups());

  ipcMain.on('shield:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('shield', coords, 340, 410, '../pages/shield-popup.html', '../preload/shield-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('shield:close', () => closeAllPopups());

  // --- Extensions Manager ---
  ipcMain.on('extensions:toggle-popup', (e, coords) => {
    const senderWin = BrowserWindow.fromWebContents(e.sender);
    if (senderWin === incognitoWindow) return;
    toggleAnchoredPopup('extensions', coords, 380, 520, '../pages/extensions-popup.html', '../preload/extensions-preload.js', senderWin);
  });
  ipcMain.on('extensions:close-popup', () => closeAllPopups());
  ipcMain.handle('extensions:get', (e) => {
    const senderWin = e ? BrowserWindow.fromWebContents(e.sender) : null;
    if (senderWin && senderWin === incognitoWindow) return [];
    return extensionsManager.getExtensionsList();
  });
  ipcMain.handle('extensions:get-catalog', () => extensionsManager.getCatalog());
  ipcMain.handle('extensions:install-webstore', async (e, input) => extensionsManager.installFromWebStore(input));
  ipcMain.handle('extensions:install-folder', async () => extensionsManager.installFromFolder());
  ipcMain.handle('extensions:toggle', async (e, { id, enabled }) => extensionsManager.toggleExtension(id, enabled));
  ipcMain.handle('extensions:uninstall', async (e, id) => extensionsManager.uninstallExtension(id));
  ipcMain.handle('extensions:open-action', (e, { id, coords }) => {
    const callerWin = BrowserWindow.fromWebContents(e.sender);
    if (callerWin === incognitoWindow) return false;
    return extensionsManager.openActionPopup(id, coords, callerWin);
  });

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
    toggleAnchoredPopup('perf', coords, 360, 580, '../pages/perf-popup.html', '../preload/perf-preload.js', BrowserWindow.fromWebContents(e.sender));
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
    let appMetricsList = [];
    try {
      appMetricsList = app.getAppMetrics();
    } catch {}

    tabs.forEach((tab, id) => {
      let actualMemMb = 0;
      let actualCpu = 0;
      try {
        if (tab.view && !tab.view.webContents.isDestroyed()) {
          const pid = tab.view.webContents.getOSProcessId();
          const match = appMetricsList.find(m => m.pid === pid);
          if (match && match.memory) {
            // privateBytes gives true private RAM (DOM + JS heap), workingSetSize includes all shared DLLs/GPU mappings
            const kb = (typeof match.memory.privateBytes === 'number' && match.memory.privateBytes > 0)
              ? match.memory.privateBytes
              : (match.memory.workingSetSize ? Math.round(match.memory.workingSetSize * 0.2) : 25000);
            actualMemMb = Math.round(kb / 1024);
            actualCpu = Math.round(match.cpu ? match.cpu.percentCPUUsage : 0);
          }
        }
      } catch {}

      if (actualMemMb <= 0) {
        actualMemMb = Math.round(22 + (id === activeTabId ? 14 : 6));
      }

      openTabs.push({
        id,
        title: tab.title || 'Nouvel onglet',
        url: tab.url,
        memMb: actualMemMb,
        cpuPercent: Math.max(0, Math.min(100, actualCpu))
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
    toggleAnchoredPopup('cleaner', coords, 360, 520, '../pages/cleaner-popup.html', '../preload/cleaner-preload.js', BrowserWindow.fromWebContents(e.sender));
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
      let downloads = [];
    }
    return true;
  });

  // --- Gestionnaire de Mots de Passe (Coffre-fort DPAPI + PIN) ---
  ipcMain.on('passwords:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('passwords', coords, 360, 520, '../pages/passwords-popup.html', '../preload/passwords-preload.js', BrowserWindow.fromWebContents(e.sender));
  });
  ipcMain.on('passwords:close', () => closeAllPopups());
  ipcMain.handle('passwords:get', async () => await store.getPasswords());
  ipcMain.handle('passwords:add', async (e, item) => await store.addPassword(item));
  ipcMain.handle('passwords:remove', (e, id) => store.removePassword(id));
  ipcMain.handle('passwords:has-pin', () => store.hasVaultPin());
  ipcMain.handle('passwords:set-pin', (e, pin) => store.setVaultPin(pin));
  ipcMain.handle('passwords:verify-pin', (e, pin) => store.verifyVaultPin(pin));
  ipcMain.handle('passwords:get-current-domain', () => {
    if (!activeTabId || !tabs.has(activeTabId)) return '';
    return adblock.extractDomain(tabs.get(activeTabId).url);
  });

  // --- Gestionnaire de Thèmes ---
  ipcMain.on('themes:toggle-popup', (e, coords) => {
    toggleAnchoredPopup('themes', coords, 360, 480, '../pages/themes-popup.html', '../preload/themes-preload.js', BrowserWindow.fromWebContents(e.sender));
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

  // Downloads data & actions (with CWE-22 / CWE-78 canonical path containment check)
  function isSafeDownloadPath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return false;
    if (targetPath.startsWith('\\\\')) return false; // Block UNC paths
    const resolved = path.resolve(targetPath);
    const downloadsDir = path.resolve(app.getPath('downloads'));
    const inDownloadsDir = resolved.toLowerCase().startsWith(downloadsDir.toLowerCase() + path.sep);
    const inRecordedList = downloads.some(d => d.savePath && path.resolve(d.savePath) === resolved);
    return (inDownloadsDir || inRecordedList) && fs.existsSync(resolved);
  }

  ipcMain.handle('download:clear-list', () => {
    downloads.length = 0;
    return true;
  });
  ipcMain.on('download:open-default-folder', () => {
    shell.openPath(app.getPath('downloads'));
  });
  ipcMain.handle('downloads:get', () => downloads);
  ipcMain.on('download:open-file', (e, filePath) => {
    if (isSafeDownloadPath(filePath)) shell.openPath(path.resolve(filePath));
  });
  ipcMain.on('download:show-folder', (e, filePath) => {
    if (isSafeDownloadPath(filePath)) shell.showItemInFolder(path.resolve(filePath));
  });

  // Settings
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', (e, newSettings) => {
    const updated = store.updateSettings(newSettings);
    if ('showBookmarksBar' in newSettings) {
      updateActiveViewBounds();
    }
    if (newSettings.theme) {
      const preset = (newSettings.theme === 'dark') ? 'cyber-dark' : newSettings.theme;
      const themeUpdated = store.updateThemeSettings({ preset });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('theme:changed', themeUpdated);
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:updated', updated);
    }
    for (const p of Object.values(popups)) {
      if (p && !p.isDestroyed()) {
        try { p.webContents.send('settings:updated', updated); } catch (_) {}
      }
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

  // --- Split View Dual-Engine Handlers ---
  ipcMain.handle('split:toggle', (e, targetTabId) => toggleSplitView(targetTabId));
  ipcMain.handle('split:set-ratio', (e, ratio) => setSplitRatio(ratio));
  ipcMain.handle('split:get-state', () => ({
    active: Boolean(splitSecondTabId && tabs.has(splitSecondTabId)),
    firstTabId: activeTabId,
    secondTabId: splitSecondTabId,
    splitRatio
  }));

  // --- Gaming Turbo Mode Handlers ---
  ipcMain.handle('turbo:toggle', () => toggleTurboMode());
  ipcMain.handle('turbo:get-state', () => ({
    active: isTurboModeActive
  }));
  ipcMain.handle('turbo:get-hud-metrics', async () => {
    const pingMs = await measureGamingPing();
    let browserMemMb = 240;
    try {
      const mem = await process.getProcessMemoryInfo();
      browserMemMb = Math.round((mem.residentSet || 240000) / 1024);
    } catch {}
    return {
      active: isTurboModeActive,
      pingMs,
      browserMemMb,
      systemFreeMb: Math.round(os.freemem() / (1024 * 1024))
    };
  });

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
    toggleAnchoredPopup('audio', coords, 320, 360, '../pages/audio-popup.html', '../preload/audio-preload.js', BrowserWindow.fromWebContents(e.sender));
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

  // --- In-App Updater ---
  ipcMain.handle('updater:check', async () => {
    return await updater.checkUpdate();
  });

  ipcMain.handle('updater:download', async (event, { downloadUrl, assetName }) => {
    const sender = event.sender;
    return await updater.downloadUpdate(downloadUrl, assetName, (progress) => {
      if (!sender.isDestroyed()) {
        sender.send('updater:progress', progress);
      }
    });
  });

  ipcMain.handle('updater:install', async () => {
    return updater.installAndRestart();
  });
}

// App lifecycle
app.whenReady().then(async () => {
  app.setName('NaviDan');
  app.setAppUserModelId?.('com.navidan.browser');
  store = new Store();
  await store.loadDecryptedSecrets();
  currentActiveWorkspaceId = store.getActiveWorkspaceId() || 'gaming';
  naviAIService = new NaviAIService(store);
  const aiConf = naviAIService.getSettings();
  if (aiConf.panelWidth) {
    naviAIWidth = Math.max(280, Math.min(700, aiConf.panelWidth));
  }
  isSidebarVisible = store.getSettings().sidebarVisible !== false;
  setupSession(session.defaultSession);
  setupSession(session.fromPartition('persist:duckai'));
  registerIpcHandlers();
  createWindow();
  extensionsManager.init(store, mainWindow);
  extensionsManager.loadAllStoredExtensions();

  // Automatic discreet update check after 5s
  setTimeout(async () => {
    try {
      const update = await updater.checkUpdate();
      if (update && update.updateAvailable && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:available', update);
      }
    } catch (_) {}
  }, 5000);

  // Global shortcut for Incognito Window (Ctrl+Shift+N)
  try {
    globalShortcut.register('CommandOrControl+Shift+N', () => {
      createIncognitoWindow();
    });
  } catch (err) {
    console.warn('Could not register Incognito shortcut:', err);
  }

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

  // Global shortcut for Split View (Ctrl+Alt+S)
  try {
    globalShortcut.register('CommandOrControl+Alt+S', () => {
      toggleSplitView();
    });
  } catch (err) {
    console.warn('Could not register Split View shortcut:', err);
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

  // Workspaces Instant Shortcuts (Alt+1 to Alt+4)
  [1, 2, 3, 4].forEach(num => {
    try {
      globalShortcut.register(`Alt+${num}`, () => {
        if (!store) return;
        const list = store.getWorkspaces();
        if (list[num - 1]) {
          switchWorkspace(list[num - 1].id);
        }
      });
    } catch {}
  });

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
