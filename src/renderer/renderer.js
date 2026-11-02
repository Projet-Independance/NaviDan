/**
 * NaviDdan Renderer Process
 * Connects the UI Chrome with Electron Main Process via window.naviddan
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Tabs Elements
  const tabsListEl = document.getElementById('tabs-list');
  const btnNewTab = document.getElementById('btn-new-tab');
  const btnNewIncognito = document.getElementById('btn-new-incognito');

  // Navigation Elements
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnReload = document.getElementById('btn-reload');
  const btnHome = document.getElementById('btn-home');

  // Omnibox Elements
  const omniboxInput = document.getElementById('omnibox-input');
  const btnOmniboxPip = document.getElementById('btn-omnibox-pip');
  const btnStarBookmark = document.getElementById('btn-star-bookmark');
  const securityBadge = document.getElementById('security-badge');

  // Top Action Buttons
  const btnTurboMode = document.getElementById('btn-turbo-mode');
  const turboToast = document.getElementById('turbo-toast');
  let turboToastTimeout = null;
  const btnSnipper = document.getElementById('btn-snipper');
  const snipperResultBar = document.getElementById('snipper-result-bar');
  const snipperThumb = document.getElementById('snipper-thumb');
  const snipperDimensions = document.getElementById('snipper-dimensions');
  const btnSnipperSave = document.getElementById('btn-snipper-save');
  const btnSnipperCopy = document.getElementById('btn-snipper-copy');
  const btnSnipperClose = document.getElementById('btn-snipper-close');
  let currentSnippetDataUrl = null;
  let snipperBarTimeout = null;

  // Audio Focus Controller Elements
  const btnAudioMute = document.getElementById('btn-audio-mute');
  const btnAudioMenu = document.getElementById('btn-audio-menu');
  const audioStreamsCount = document.getElementById('audio-streams-count');
  const btnAdblock = document.getElementById('btn-adblock');
  const adblockCounter = document.getElementById('adblock-counter');
  const btnDownloads = document.getElementById('btn-downloads');
  const btnSettings = document.getElementById('btn-settings');
  const bookmarksBarEl = document.getElementById('bookmarks-bar');

  // Sidebar Elements
  const browserSidebarEl = document.getElementById('browser-sidebar');
  const sidebarBtnPerf = document.getElementById('sidebar-btn-perf');
  const sidebarBtnCleaner = document.getElementById('sidebar-btn-cleaner');
  const sidebarBtnPasswords = document.getElementById('sidebar-btn-passwords');
  const sidebarBtnThemes = document.getElementById('sidebar-btn-themes');
  const sidebarBtnHistory = document.getElementById('sidebar-btn-history');
  const sidebarBtnBookmarks = document.getElementById('sidebar-btn-bookmarks');
  const sidebarBtnCollapse = document.getElementById('sidebar-btn-collapse');

  // Window Controls
  const winMin = document.getElementById('win-min');
  const winMax = document.getElementById('win-max');
  const winClose = document.getElementById('win-close');

  // Find In Page Elements
  const findBar = document.getElementById('find-bar');
  const findInput = document.getElementById('find-input');
  const findCount = document.getElementById('find-count');
  const findPrev = document.getElementById('find-prev');
  const findNext = document.getElementById('find-next');
  const findClose = document.getElementById('find-close');

  // Local state
  let currentTabs = [];
  let activeTabId = null;
  let currentZoom = 100;
  let settings = await window.naviddan.getSettings();

  // Apply initial settings
  applyTheme(settings.theme || 'dark');
  if (!settings.showBookmarksBar) bookmarksBarEl.classList.add('hidden');

  // Load Bookmarks Bar
  refreshBookmarksBar();

  // Sidebar initialization
  if (window.naviddan.getSidebarState) {
    const isSidebarOpen = await window.naviddan.getSidebarState();
    if (browserSidebarEl) {
      browserSidebarEl.classList.toggle('collapsed', !isSidebarOpen);
    }
  }

  if (window.naviddan.onSidebarChanged) {
    window.naviddan.onSidebarChanged((visible) => {
      if (browserSidebarEl) {
        browserSidebarEl.classList.toggle('collapsed', !visible);
      }
    });
  }

  function handleToggleSidebar() {
    if (window.naviddan.toggleSidebar) {
      window.naviddan.toggleSidebar();
    }
  }

  btnToggleSidebar?.addEventListener('click', handleToggleSidebar);
  sidebarBtnCollapse?.addEventListener('click', handleToggleSidebar);

  // Helper to calculate popover coordinates relative to sidebar buttons
  function getSidebarAnchorCoords(btn) {
    const rect = btn.getBoundingClientRect();
    return {
      fromSidebar: true,
      x: Math.round(rect.right),
      y: Math.round(rect.top + rect.height / 2)
    };
  }

  // Sidebar Action Buttons
  sidebarBtnPerf?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openPerfMenu(getSidebarAnchorCoords(sidebarBtnPerf));
  });

  sidebarBtnCleaner?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openCleanerMenu(getSidebarAnchorCoords(sidebarBtnCleaner));
  });

  sidebarBtnPasswords?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openPasswordsMenu(getSidebarAnchorCoords(sidebarBtnPasswords));
  });

  sidebarBtnThemes?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openThemesMenu(getSidebarAnchorCoords(sidebarBtnThemes));
  });

  sidebarBtnHistory?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openHistoryMenu(getSidebarAnchorCoords(sidebarBtnHistory));
  });

  sidebarBtnBookmarks?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openBookmarksMenu(getSidebarAnchorCoords(sidebarBtnBookmarks));
  });

  // Window Controls
  winMin?.addEventListener('click', () => window.naviddan.minimize());
  winMax?.addEventListener('click', () => window.naviddan.maximize());
  winClose?.addEventListener('click', () => window.naviddan.close());

  // Double click titlebar to maximize / restore
  const titlebarEl = document.getElementById('titlebar');
  if (titlebarEl) {
    titlebarEl.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.no-drag') && !e.target.closest('.tab-item')) {
        window.naviddan.maximize();
      }
    });
  }

  // Tab Action Buttons
  btnNewTab?.addEventListener('click', () => window.naviddan.createTab());
  btnNewIncognito?.addEventListener('click', () => window.naviddan.createTab(null, true));

  // Navigation Buttons
  btnBack?.addEventListener('click', () => window.naviddan.goBack());
  btnForward?.addEventListener('click', () => window.naviddan.goForward());
  btnReload?.addEventListener('click', () => window.naviddan.reload());
  btnHome?.addEventListener('click', () => window.naviddan.goHome());

  // Omnibox Navigation & Search
  omniboxInput?.addEventListener('focus', () => {
    omniboxInput.select();
  });

  omniboxInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = omniboxInput.value.trim();
      if (val) {
        window.naviddan.navigate(val);
        omniboxInput.blur();
      }
    } else if (e.key === 'Escape') {
      const activeTab = currentTabs.find(t => t.id === activeTabId);
      if (activeTab) omniboxInput.value = formatDisplayUrl(activeTab.url);
      omniboxInput.blur();
    }
  });

  // Bookmark Star in Omnibox
  btnStarBookmark?.addEventListener('click', async () => {
    const activeTab = currentTabs.find(t => t.id === activeTabId);
    if (!activeTab || !activeTab.url || activeTab.url.startsWith('naviddan://')) return;

    const isFav = await window.naviddan.isBookmarked(activeTab.url);
    if (isFav) {
      await window.naviddan.removeBookmark(activeTab.url);
      btnStarBookmark.classList.remove('active');
    } else {
      await window.naviddan.addBookmark({ title: activeTab.title, url: activeTab.url });
      btnStarBookmark.classList.add('active');
    }
    refreshBookmarksBar();
  });

  // Omnibox Picture-in-Picture Button
  btnOmniboxPip?.addEventListener('click', () => {
    window.naviddan.openPip();
  });

  if (window.naviddan.onPipMediaStatus) {
    window.naviddan.onPipMediaStatus((status) => {
      if (btnOmniboxPip) {
        if (status && status.hasVideo) {
          btnOmniboxPip.classList.remove('hidden');
          btnOmniboxPip.title = status.isPlaying 
            ? 'Vidéo détectée en lecture • Ouvrir en PiP Gaming (Alt+P)' 
            : 'Ouvrir en PiP Gaming (Alt+P)';
        } else {
          btnOmniboxPip.classList.add('hidden');
        }
      }
    });
  }

  // Top Toolbar Popovers
  btnAdblock?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btnAdblock.getBoundingClientRect();
    window.naviddan.openShieldMenu({
      x: Math.round(rect.right),
      y: Math.round(rect.bottom)
    });
  });

  btnDownloads?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btnDownloads.getBoundingClientRect();
    window.naviddan.openDownloadsMenu({
      x: Math.round(rect.right),
      y: Math.round(rect.bottom)
    });
  });

  btnSettings?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btnSettings.getBoundingClientRect();
    window.naviddan.openSettingsMenu({
      x: Math.round(rect.right),
      y: Math.round(rect.bottom)
    });
  });

  // Gaming Turbo Mode UI Controls
  function showTurboToast(msg, isTagActive = true) {
    if (!turboToast) return;
    if (turboToastTimeout) clearTimeout(turboToastTimeout);
    turboToast.innerHTML = `
      <span class="turbo-toast-tag ${isTagActive ? '' : 'off'}">${isTagActive ? 'TURBO ACTIF' : 'TURBO INACTIF'}</span>
      <span>${msg}</span>
    `;
    turboToast.classList.remove('hidden');
    turboToastTimeout = setTimeout(() => {
      turboToast.classList.add('hidden');
    }, 2500);
  }

  function updateTurboUI(state) {
    if (!btnTurboMode) return;
    const isActive = !!state.active;
    btnTurboMode.classList.toggle('active', isActive);
    if (isActive) {
      showTurboToast(`${state.memSavedMb || 180} MB LIBÉRÉS • ${state.tabsFrozen || 0} ONGLET(S) GELÉ(S)`, true);
    } else {
      showTurboToast('REPRISE NORMALE DES RESSOURCES', false);
    }
  }

  btnTurboMode?.addEventListener('click', async () => {
    if (window.naviddan.toggleTurbo) {
      const res = await window.naviddan.toggleTurbo();
      updateTurboUI(res);
    }
  });

  if (window.naviddan.onTurboState) {
    window.naviddan.onTurboState((state) => {
      updateTurboUI(state);
    });
  }

  if (window.naviddan.getTurboState) {
    window.naviddan.getTurboState().then(s => {
      if (s && btnTurboMode) btnTurboMode.classList.toggle('active', !!s.active);
    });
  }

  // NaviSnipper UI Handlers
  let snipperSuccessTimeout = null;
  function triggerSnipperButtonFeedback() {
    if (!btnSnipper) return;
    if (snipperSuccessTimeout) clearTimeout(snipperSuccessTimeout);
    btnSnipper.classList.add('snip-success');
    snipperSuccessTimeout = setTimeout(() => {
      btnSnipper.classList.remove('snip-success');
    }, 2500);
  }

  btnSnipper?.addEventListener('click', () => {
    window.naviddan.startSnipper();
  });

  if (window.naviddan.onSnippetCaptured) {
    window.naviddan.onSnippetCaptured(async (data) => {
      currentSnippetDataUrl = data.dataUrl;
      triggerSnipperButtonFeedback();
      if (snipperResultBar) {
        snipperResultBar.classList.remove('hidden');
        if (snipperBarTimeout) clearTimeout(snipperBarTimeout);
        snipperBarTimeout = setTimeout(() => {
          snipperResultBar.classList.add('hidden');
        }, 8000);
      }

      // Write directly to system clipboard via standard Chromium Async Clipboard API
      try {
        const response = await fetch(data.dataUrl);
        const blob = await response.blob();
        if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
        }
      } catch (e) {
        console.warn('Renderer clipboard write:', e);
      }
    });
  }

  btnSnipperSave?.addEventListener('click', async () => {
    if (currentSnippetDataUrl && window.naviddan.saveSnippet) {
      const savedPath = await window.naviddan.saveSnippet(currentSnippetDataUrl);
      if (savedPath) {
        btnSnipperSave.textContent = '✓ ENREGISTRÉ !';
        setTimeout(() => {
          btnSnipperSave.textContent = '💾 ENREGISTRER';
          snipperResultBar?.classList.add('hidden');
        }, 1500);
      }
    }
  });

  btnSnipperCopy?.addEventListener('click', async () => {
    if (currentSnippetDataUrl) {
      if (window.naviddan.copySnippet) {
        window.naviddan.copySnippet(currentSnippetDataUrl);
      }
      try {
        const response = await fetch(currentSnippetDataUrl);
        const blob = await response.blob();
        if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
        }
      } catch (e) {}

      btnSnipperCopy.textContent = '✓ COPIÉ !';
      setTimeout(() => {
        btnSnipperCopy.textContent = '📋 COPIER';
      }, 1500);
    }
  });

  btnSnipperClose?.addEventListener('click', () => {
    snipperResultBar?.classList.add('hidden');
  });

  // --- Audio Focus Controller Toolbar Actions ---
  function updateToolbarAudioButton(isMuted, isAudible) {
    if (!btnAudioMute) return;
    const iconUnmuted = btnAudioMute.querySelector('.audio-icon-unmuted');
    const iconMuted = btnAudioMute.querySelector('.audio-icon-muted');

    if (isMuted) {
      btnAudioMute.classList.add('muted');
      iconUnmuted?.classList.add('hidden');
      iconMuted?.classList.remove('hidden');
      btnAudioMute.title = "Onglet actif en sourdine (Clic pour rétablir Ctrl+M)";
    } else {
      btnAudioMute.classList.remove('muted');
      iconUnmuted?.classList.remove('hidden');
      iconMuted?.classList.add('hidden');
      btnAudioMute.title = isAudible 
        ? "Son actif (Clic pour couper Ctrl+M | Clic droit : Mini-Cockpit)" 
        : "Contrôleur Audio Focus (Ctrl+M | Clic droit : Mini-Cockpit)";
    }
  }

  btnAudioMute?.addEventListener('click', async () => {
    if (activeTabId) {
      const nextMuted = await window.naviddan.toggleTabMute(activeTabId);
      const activeTab = currentTabs.find(t => t.id === activeTabId);
      if (activeTab) {
        activeTab.isMuted = nextMuted;
        updateToolbarAudioButton(nextMuted, activeTab.isAudible);
        const tabEl = document.getElementById(`tab-${activeTab.id}`);
        if (tabEl) updateTabAudioVisuals(tabEl, activeTab);
      }
    }
  });

  const openAudioCockpit = () => {
    const targetEl = btnAudioMenu || btnAudioMute;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    window.naviddan.openAudioMenu({
      x: Math.round(rect.left),
      y: Math.round(rect.bottom + 4)
    });
  };

  btnAudioMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
    openAudioCockpit();
  });

  btnAudioMute?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openAudioCockpit();
  });

  // Update theme & bookmarks bar when settings change from popup
  if (window.naviddan.onSettingsUpdated) {
    window.naviddan.onSettingsUpdated((newSettings) => {
      if (newSettings.theme) applyTheme(newSettings.theme);
      if ('showBookmarksBar' in newSettings) {
        if (newSettings.showBookmarksBar) bookmarksBarEl.classList.remove('hidden');
        else bookmarksBarEl.classList.add('hidden');
      }
    });
  }

  function applyCustomTheme(theme) {
    if (!theme) return;
    if (theme.accentColor) {
      document.documentElement.style.setProperty('--accent-color', theme.accentColor);
      document.documentElement.style.setProperty('--accent-hover', theme.accentColor);
    }
    if (theme.preset === 'light') {
      document.body.className = 'theme-light';
    } else {
      document.body.className = `theme-dark theme-${theme.preset || 'cyber-dark'}`;
    }
  }

  if (window.naviddan.getThemeSettings) {
    window.naviddan.getThemeSettings().then(applyCustomTheme);
  }
  if (window.naviddan.onThemeChanged) {
    window.naviddan.onThemeChanged(applyCustomTheme);
  }

  // Find In Page
  findInput?.addEventListener('input', () => {
    const text = findInput.value;
    if (text) {
      window.naviddan.findInPage(text, true);
    } else {
      window.naviddan.stopFindInPage();
      findCount.textContent = '0/0';
    }
  });

  findInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.naviddan.findInPage(findInput.value, !e.shiftKey);
    } else if (e.key === 'Escape') {
      findBar.classList.add('hidden');
      window.naviddan.stopFindInPage();
    }
  });

  findNext?.addEventListener('click', () => {
    if (findInput.value) window.naviddan.findInPage(findInput.value, true);
  });

  findPrev?.addEventListener('click', () => {
    if (findInput.value) window.naviddan.findInPage(findInput.value, false);
  });

  findClose?.addEventListener('click', () => {
    findBar.classList.add('hidden');
    window.naviddan.stopFindInPage();
  });

  // Keyboard Shortcuts (Window Level)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      window.naviddan.createTab();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      window.naviddan.createTab(null, true);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTabId) window.naviddan.closeTab(activeTabId);
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      window.naviddan.muteBackgroundTabs();
    } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (activeTabId) window.naviddan.toggleTabMute(activeTabId);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      omniboxInput?.focus();
      omniboxInput?.select();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      window.naviddan.reload();
    } else if (e.key === 'F5') {
      e.preventDefault();
      window.naviddan.reload();
    } else if (e.key === 'F12') {
      e.preventDefault();
      window.naviddan.toggleDevTools();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      if (sidebarBtnHistory) {
        window.naviddan.openHistoryMenu(getSidebarAnchorCoords(sidebarBtnHistory));
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      if (btnDownloads) {
        const rect = btnDownloads.getBoundingClientRect();
        window.naviddan.openDownloadsMenu({
          x: Math.round(rect.right),
          y: Math.round(rect.bottom)
        });
      }
    } else if ((e.ctrlKey && e.key === '\\') || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
      e.preventDefault();
      handleToggleSidebar();
    } else if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      window.naviddan.zoomIn();
      currentZoom = Math.min(200, currentZoom + 10);
    } else if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      window.naviddan.zoomOut();
      currentZoom = Math.max(50, currentZoom - 10);
    } else if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      window.naviddan.resetZoom();
      currentZoom = 100;
    } else if (e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.naviddan.openPip();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      btnTurboMode?.click();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      window.naviddan.startSnipper();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      findBar?.classList.remove('hidden');
      findInput?.focus();
      findInput?.select();
    }
  });

  // IPC Event Listeners from Main
  window.naviddan.onTabCreated((tab) => {
    currentTabs.push(tab);
    renderTabs();
  });

  window.naviddan.onTabUpdated((tab) => {
    const idx = currentTabs.findIndex(t => t.id === tab.id);
    if (idx !== -1) {
      currentTabs[idx] = tab;
      updateTabElement(tab);
      if (tab.id === activeTabId) {
        updateNavbarState(tab);
      }
    }
  });

  window.naviddan.onTabClosed((tabId) => {
    currentTabs = currentTabs.filter(t => t.id !== tabId);
    renderTabs();
  });

  window.naviddan.onTabActivated((tabId) => {
    activeTabId = tabId;
    btnOmniboxPip?.classList.add('hidden');
    renderTabs();
    const activeTab = currentTabs.find(t => t.id === tabId);
    if (activeTab) {
      updateNavbarState(activeTab);
    }
  });

  window.naviddan.onNavStateChanged((state) => {
    if (btnBack) btnBack.disabled = !state.canGoBack;
    if (btnForward) btnForward.disabled = !state.canGoForward;
    
    // Toggle reload vs stop icon
    if (btnReload) {
      const iconReload = btnReload.querySelector('.icon-reload');
      const iconStop = btnReload.querySelector('.icon-stop');
      if (state.isLoading) {
        iconReload?.classList.add('hidden');
        iconStop?.classList.remove('hidden');
      } else {
        iconReload?.classList.remove('hidden');
        iconStop?.classList.add('hidden');
      }
    }
  });

  window.naviddan.onAdblockUpdated((data) => {
    if (adblockCounter) {
      adblockCounter.textContent = data.totalBlocked || 0;
    }
  });

  window.naviddan.onFoundInPage((result) => {
    if (findCount && result) {
      findCount.textContent = `${result.activeMatchOrdinal || 0}/${result.matches || 0}`;
    }
  });

  // Audio Focus Events
  window.naviddan.onTabAudioChanged?.((data) => {
    const tab = currentTabs.find(t => t.id === data.id);
    if (tab) {
      tab.isAudible = data.isAudible;
      tab.isMuted = data.isMuted;
      const tabEl = document.getElementById(`tab-${tab.id}`);
      if (tabEl) updateTabAudioVisuals(tabEl, tab);
    }
    if (data.id === activeTabId) {
      updateToolbarAudioButton(data.isMuted, data.isAudible);
    }
  });

  window.naviddan.onAudioStreamsUpdated?.((data) => {
    if (!data) return;
    const count = data.streams ? data.streams.length : 0;
    if (audioStreamsCount) {
      if (count > 0) {
        audioStreamsCount.textContent = count;
        audioStreamsCount.classList.remove('hidden');
      } else {
        audioStreamsCount.classList.add('hidden');
      }
    }
    if (data.activeTabId === activeTabId) {
      updateToolbarAudioButton(data.activeTabMuted, data.activeTabAudible);
    }
  });

  // Render Tabs List
  function renderTabs() {
    if (!tabsListEl) return;
    tabsListEl.innerHTML = '';

    currentTabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isIncognito ? 'incognito' : ''}`;
      tabEl.id = `tab-${tab.id}`;

      const favicon = document.createElement('span');
      favicon.className = 'tab-favicon';
      favicon.textContent = tab.isIncognito ? '🕶️' : '🌐';

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || (tab.isIncognito ? 'Navigation privée' : 'Nouvel onglet');
      title.title = tab.title || '';

      // Tab Audio Focus Indicator & Mute Button
      const audioBtn = document.createElement('button');
      const isMuted = !!tab.isMuted;
      const isPlaying = !!tab.isAudible && !isMuted;
      audioBtn.className = `tab-audio-btn no-drag ${isMuted ? 'muted' : (isPlaying ? 'playing' : 'hidden')}`;
      audioBtn.title = isMuted ? 'Rétablir le son de cet onglet' : 'Couper le son de cet onglet';
      audioBtn.innerHTML = `
        <div class="tab-eq-bars">
          <span class="tab-eq-bar b1"></span>
          <span class="tab-eq-bar b2"></span>
          <span class="tab-eq-bar b3"></span>
        </div>
        <svg class="tab-speaker-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <svg class="tab-muted-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      `;

      audioBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        tab.isMuted = !tab.isMuted;
        updateTabAudioVisuals(tabEl, tab);
        if (tab.id === activeTabId) {
          updateToolbarAudioButton(tab.isMuted, tab.isAudible);
        }
        const serverMuted = await window.naviddan.toggleTabMute(tab.id);
        tab.isMuted = serverMuted;
        updateTabAudioVisuals(tabEl, tab);
        if (tab.id === activeTabId) {
          updateToolbarAudioButton(tab.isMuted, tab.isAudible);
        }
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn no-drag';
      closeBtn.innerHTML = '✕';
      closeBtn.title = 'Fermer';

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.naviddan.closeTab(tab.id);
      });

      tabEl.addEventListener('click', () => {
        window.naviddan.selectTab(tab.id);
      });

      tabEl.appendChild(favicon);
      tabEl.appendChild(title);
      tabEl.appendChild(audioBtn);
      tabEl.appendChild(closeBtn);
      tabsListEl.appendChild(tabEl);
    });
  }

  function updateTabAudioVisuals(tabEl, tab) {
    if (!tabEl) return;
    const audioBtn = tabEl.querySelector('.tab-audio-btn');
    if (!audioBtn) return;
    const isMuted = !!tab.isMuted;
    const isPlaying = !!tab.isAudible && !isMuted;

    if (isMuted) {
      audioBtn.className = 'tab-audio-btn no-drag muted';
      audioBtn.title = 'Rétablir le son de cet onglet';
    } else if (isPlaying) {
      audioBtn.className = 'tab-audio-btn no-drag playing';
      audioBtn.title = 'Couper le son de cet onglet';
    } else {
      audioBtn.className = 'tab-audio-btn no-drag hidden';
    }
  }

  function updateTabElement(tab) {
    const tabEl = document.getElementById(`tab-${tab.id}`);
    if (tabEl) {
      const titleEl = tabEl.querySelector('.tab-title');
      if (titleEl) {
        titleEl.textContent = tab.title || 'Nouvel onglet';
        titleEl.title = tab.title || '';
      }
      updateTabAudioVisuals(tabEl, tab);
    }
  }

  async function updateNavbarState(tab) {
    if (omniboxInput) {
      omniboxInput.value = formatDisplayUrl(tab.url);
    }
    
    // Security padlock status
    if (securityBadge) {
      if (tab.url.startsWith('https://')) {
        securityBadge.classList.add('secure');
        securityBadge.title = 'Connexion sécurisée (HTTPS)';
      } else {
        securityBadge.classList.remove('secure');
        securityBadge.title = 'Non sécurisé ou page locale';
      }
    }

    // Bookmark star status
    if (btnStarBookmark) {
      const isFav = await window.naviddan.isBookmarked(tab.url);
      if (isFav) {
        btnStarBookmark.classList.add('active');
      } else {
        btnStarBookmark.classList.remove('active');
      }
    }
  }

  function formatDisplayUrl(url) {
    if (!url || url.startsWith('naviddan://newtab') || url.includes('newtab.html') || url === 'about:blank') {
      return '';
    }
    return url;
  }

  function applyTheme(theme) {
    document.body.className = theme === 'light' ? 'theme-light' : 'theme-dark';
  }

  async function refreshBookmarksBar() {
    if (!bookmarksBarEl) return;
    const bookmarks = await window.naviddan.getBookmarks();
    bookmarksBarEl.innerHTML = '';
    bookmarks.forEach(bm => {
      const a = document.createElement('a');
      a.className = 'bookmark-pill';
      a.innerHTML = `<span>🔖</span><span>${bm.title}</span>`;
      a.title = `${bm.title} (${bm.url})\nClic pour ouvrir • Molette/Ctrl+clic pour nouvel onglet`;
      
      a.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          window.naviddan.createTab(bm.url);
        } else {
          const activeTab = currentTabs.find(t => t.id === activeTabId);
          const isBlank = activeTab && (activeTab.url.includes('newtab.html') || activeTab.url.startsWith('naviddan://') || activeTab.url === 'about:blank');
          if (isBlank) {
            window.naviddan.navigate(bm.url);
          } else {
            window.naviddan.createTab(bm.url);
          }
        }
      });

      a.addEventListener('auxclick', (e) => {
        if (e.button === 1) { // Middle click (wheel)
          window.naviddan.createTab(bm.url);
        }
      });

      bookmarksBarEl.appendChild(a);
    });
  }
});
