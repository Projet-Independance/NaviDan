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

  // Gaming HUD Overlay Elements & Loop
  const gamingHud = document.getElementById('gaming-hud');
  const gamingHudFps = document.getElementById('gaming-hud-fps');
  const gamingHudPing = document.getElementById('gaming-hud-ping');
  const gamingHudRam = document.getElementById('gaming-hud-ram');
  const gamingHudClose = document.getElementById('gaming-hud-close');
  let hudInterval = null;
  let fpsFrames = 0;
  let fpsLastTime = performance.now();
  let currentFps = 60;
  let isHudManuallyClosed = false;

  function countFps(now) {
    fpsFrames++;
    if (now - fpsLastTime >= 1000) {
      currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
      fpsFrames = 0;
      fpsLastTime = now;
      if (gamingHudFps) gamingHudFps.textContent = currentFps;
    }
    if (gamingHud && !gamingHud.classList.contains('hidden')) {
      requestAnimationFrame(countFps);
    }
  }

  gamingHudClose?.addEventListener('click', () => {
    isHudManuallyClosed = true;
    if (gamingHud) gamingHud.classList.add('hidden');
    if (hudInterval) {
      clearInterval(hudInterval);
      hudInterval = null;
    }
  });

  async function refreshHudMetrics() {
    if (!window.naviddan?.getTurboHudMetrics) return;
    try {
      const data = await window.naviddan.getTurboHudMetrics();
      if (data && gamingHudPing) {
        gamingHudPing.textContent = `${data.pingMs} ms`;
      }
    } catch {}
  }

  function startGamingHud(state) {
    if (isHudManuallyClosed || !gamingHud) return;
    gamingHud.classList.remove('hidden');
    if (gamingHudRam) {
      gamingHudRam.textContent = `+${state.memSavedMb || 180} MB`;
    }
    fpsFrames = 0;
    fpsLastTime = performance.now();
    requestAnimationFrame(countFps);
    refreshHudMetrics();
    if (!hudInterval) {
      hudInterval = setInterval(refreshHudMetrics, 2000);
    }
  }

  function stopGamingHud() {
    if (gamingHud) gamingHud.classList.add('hidden');
    if (hudInterval) {
      clearInterval(hudInterval);
      hudInterval = null;
    }
  }
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
  const btnExtensions = document.getElementById('btn-extensions');
  const extensionsToolbar = document.getElementById('extensions-toolbar');
  const btnAdblock = document.getElementById('btn-adblock');
  const adblockCounter = document.getElementById('adblock-counter');
  const btnDownloads = document.getElementById('btn-downloads');
  const btnSettings = document.getElementById('btn-settings');
  const bookmarksBarEl = document.getElementById('bookmarks-bar');

  // Sidebar Elements
  const browserSidebarEl = document.getElementById('browser-sidebar');
  const sidebarWorkspacesEl = document.getElementById('sidebar-workspaces');
  const btnAddWorkspace = document.getElementById('btn-add-workspace');
  const sidebarBtnPerf = document.getElementById('sidebar-btn-perf');
  const sidebarBtnCleaner = document.getElementById('sidebar-btn-cleaner');
  const sidebarBtnPasswords = document.getElementById('sidebar-btn-passwords');
  const sidebarBtnThemes = document.getElementById('sidebar-btn-themes');
  const sidebarBtnExtensions = document.getElementById('sidebar-btn-extensions');
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
  let currentWorkspaces = [];
  let currentWorkspaceId = 'gaming';
  let settings = await window.naviddan.getSettings();

  // Incognito Window Mode Check
  const isIncognitoWindowMode = window.location.search.includes('incognito=1') || (window.naviddan?.isIncognitoWindow && window.naviddan.isIncognitoWindow());
  if (isIncognitoWindowMode) {
    document.body.classList.add('incognito-window');
    const badge = document.getElementById('incognito-badge');
    if (badge) badge.classList.remove('hidden');
    if (bookmarksBarEl) bookmarksBarEl.classList.add('hidden');
  }

  window.naviddan?.onInitIncognito?.(() => {
    document.body.classList.add('incognito-window');
    const badge = document.getElementById('incognito-badge');
    if (badge) badge.classList.remove('hidden');
    if (bookmarksBarEl) bookmarksBarEl.classList.add('hidden');
  });

  // Apply initial settings
  applyTheme(settings.theme || 'dark');
  applyLanguage(settings.language || 'fr');
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

  // Workspaces initialization
  if (window.naviddan.getWorkspaces) {
    const wsData = await window.naviddan.getWorkspaces();
    if (wsData) {
      currentWorkspaceId = wsData.activeWorkspaceId || 'gaming';
      currentWorkspaces = wsData.workspaces || [];
      const cur = currentWorkspaces.find(w => w.id === currentWorkspaceId);
      if (cur?.color) {
        document.documentElement.style.setProperty('--accent-color', cur.color);
      }
      renderWorkspaces();
    }
  }

  if (window.naviddan.onWorkspaceChanged) {
    window.naviddan.onWorkspaceChanged((data) => {
      if (!data) return;
      currentWorkspaceId = data.activeWorkspaceId || currentWorkspaceId;
      currentWorkspaces = data.workspaces || currentWorkspaces;
      if (data.workspace?.color) {
        document.documentElement.style.setProperty('--accent-color', data.workspace.color);
      }
      renderWorkspaces();
      renderTabs();
    });
  }

  function renderWorkspaces() {
    if (!sidebarWorkspacesEl) return;
    sidebarWorkspacesEl.innerHTML = '';

    currentWorkspaces.forEach(ws => {
      const pill = document.createElement('div');
      const isActive = ws.id === currentWorkspaceId;
      const wsIcon = ws.icon || ws.emoji || '🪐';
      pill.className = `ws-pill ${isActive ? 'active' : ''}`;
      pill.title = `${wsIcon} ${ws.name} (Alt+...)`;
      pill.style.setProperty('--ws-color', ws.color || '#3b82f6');

      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = wsIcon;
      pill.appendChild(emojiSpan);

      const tabCount = currentTabs.filter(t => t.workspaceId === ws.id).length;
      if (tabCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'ws-count-badge';
        badge.textContent = tabCount;
        pill.appendChild(badge);
      }

      pill.addEventListener('click', () => {
        window.naviddan.switchWorkspace?.(ws.id);
      });

      sidebarWorkspacesEl.appendChild(pill);
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

  sidebarBtnExtensions?.addEventListener('click', (e) => {
    if (isIncognitoWindowMode) return;
    e.stopPropagation();
    window.naviddan.openExtensionsMenu(getSidebarAnchorCoords(sidebarBtnExtensions));
  });

  sidebarBtnHistory?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openHistoryMenu(getSidebarAnchorCoords(sidebarBtnHistory));
  });

  sidebarBtnBookmarks?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.openBookmarksMenu(getSidebarAnchorCoords(sidebarBtnBookmarks));
  });

  btnAddWorkspace?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.naviddan.toggleWorkspacePopup?.(getSidebarAnchorCoords(btnAddWorkspace));
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
  btnNewTab?.addEventListener('click', () => {
    if (isIncognitoWindowMode) {
      window.naviddan.createTab(null, true);
    } else {
      window.naviddan.createTab();
    }
  });
  btnNewIncognito?.addEventListener('click', () => {
    if (isIncognitoWindowMode) {
      window.naviddan.createTab(null, true);
    } else {
      window.naviddan.openIncognitoWindow();
    }
  });

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

  // Chrome Extensions Toolbar & Manager
  async function refreshExtensionsToolbar() {
    if (!extensionsToolbar || !window.naviddan?.getExtensions) return;
    if (isIncognitoWindowMode) {
      extensionsToolbar.innerHTML = '';
      if (btnExtensions) btnExtensions.style.display = 'none';
      if (sidebarBtnExtensions) sidebarBtnExtensions.style.display = 'none';
      return;
    }
    try {
      const list = await window.naviddan.getExtensions();
      extensionsToolbar.innerHTML = '';
      if (!list) return;

      list.filter(e => e.enabled).forEach(ext => {
        const btn = document.createElement('button');
        btn.className = 'ext-action-btn';
        btn.title = `${ext.actionTitle || ext.name}${ext.hasActionPopup ? ' (Clic pour ouvrir)' : ''}`;

        if (ext.iconData) {
          btn.innerHTML = `<img src="${ext.iconData}" alt="${ext.name}" />`;
        } else {
          btn.textContent = '🧩';
        }

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = btn.getBoundingClientRect();
          if (ext.hasActionPopup) {
            window.naviddan.openExtensionAction(ext.id, {
              x: Math.round(rect.right),
              y: Math.round(rect.bottom)
            });
          } else {
            window.naviddan.openExtensionsMenu({
              x: Math.round(rect.right),
              y: Math.round(rect.bottom)
            });
          }
        });

        extensionsToolbar.appendChild(btn);
      });
    } catch (err) {
      console.error('Failed refreshing extensions toolbar:', err);
    }
  }

  btnExtensions?.addEventListener('click', (e) => {
    if (isIncognitoWindowMode) return;
    e.stopPropagation();
    const rect = btnExtensions.getBoundingClientRect();
    window.naviddan.openExtensionsMenu({
      x: Math.round(rect.right),
      y: Math.round(rect.bottom)
    });
  });

  window.naviddan?.onExtensionsUpdated?.(() => {
    refreshExtensionsToolbar();
  });

  refreshExtensionsToolbar();

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
      isHudManuallyClosed = false;
      showTurboToast(`${state.memSavedMb || 180} MB LIBÉRÉS • ${state.tabsFrozen || 0} ONGLET(S) GELÉ(S)`, true);
      startGamingHud(state);
    } else {
      showTurboToast('REPRISE NORMALE DES RESSOURCES', false);
      stopGamingHud();
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

  // Update theme & bookmarks bar & language when settings change from popup
  if (window.naviddan.onSettingsUpdated) {
    window.naviddan.onSettingsUpdated((newSettings) => {
      if (newSettings.language) applyLanguage(newSettings.language);
      if (newSettings.theme) applyTheme(newSettings.theme);
      if ('showBookmarksBar' in newSettings) {
        if (newSettings.showBookmarksBar) bookmarksBarEl.classList.remove('hidden');
        else bookmarksBarEl.classList.add('hidden');
      }
    });
  }

  function applyLanguage(lang) {
    if (!window.NaviI18n) return;
    const l = window.NaviI18n.setLang(lang || 'fr');
    window.NaviI18n.applyToDOM(document, l);

    const t = window.NaviI18n.t;
    if (omniboxInput) {
      omniboxInput.placeholder = t('url_placeholder');
    }
    const btnNewTab = document.getElementById('btn-new-tab');
    if (btnNewTab) btnNewTab.title = t('new_tab') + ' (Ctrl+T)';
    const incognitoBadgeText = document.getElementById('incognito-badge-text');
    if (incognitoBadgeText) incognitoBadgeText.textContent = (l === 'fr' ? 'Navigation privée' : 'Private');
    const btnNewIncognito = document.getElementById('btn-new-incognito');
    if (btnNewIncognito) {
      btnNewIncognito.title = isIncognitoWindowMode
        ? (l === 'fr' ? 'Nouvel onglet privé (Ctrl+T)' : 'New private tab (Ctrl+T)')
        : (l === 'fr' ? 'Nouvelle fenêtre privée (Ctrl+Shift+N)' : 'New private window (Ctrl+Shift+N)');
    }
    const btnBack = document.getElementById('btn-back');
    if (btnBack) btnBack.title = t('btn_back') + ' (Alt+Left)';
    const btnForward = document.getElementById('btn-forward');
    if (btnForward) btnForward.title = t('btn_forward') + ' (Alt+Right)';
    const btnReload = document.getElementById('btn-reload');
    if (btnReload) btnReload.title = t('btn_reload') + ' (F5 / Ctrl+R)';
    const btnHome = document.getElementById('btn-home');
    if (btnHome) btnHome.title = t('btn_home');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    if (btnToggleSidebar) btnToggleSidebar.title = (l === 'fr' ? 'Afficher/Masquer barre latérale' : 'Toggle sidebar') + ' (Ctrl+\\)';
    const btnExtensions = document.getElementById('btn-extensions');
    if (btnExtensions) btnExtensions.title = t('btn_extensions');
    const btnShield = document.getElementById('btn-shield');
    if (btnShield) btnShield.title = t('btn_shield');
    const btnDownloads = document.getElementById('btn-downloads');
    if (btnDownloads) btnDownloads.title = t('btn_downloads');
    const btnHistory = document.getElementById('btn-history');
    if (btnHistory) btnHistory.title = t('btn_history');
    const btnBookmarks = document.getElementById('btn-bookmarks');
    if (btnBookmarks) btnBookmarks.title = t('btn_bookmarks');
    const btnPasswords = document.getElementById('btn-passwords');
    if (btnPasswords) btnPasswords.title = t('btn_passwords');
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) btnSettings.title = t('btn_settings');
    const btnTurbo = document.getElementById('btn-gaming-turbo');
    if (btnTurbo) btnTurbo.title = t('btn_turbo');
    const btnAudio = document.getElementById('btn-audio-hub');
    if (btnAudio) btnAudio.title = t('btn_audio_panel');

    // NaviAI Panel translations
    const naviaiTabAssist = document.getElementById('naviai-tab-assist');
    if (naviaiTabAssist) naviaiTabAssist.innerHTML = t('naviai_tab_assist');
    const naviaiTabDuck = document.getElementById('naviai-tab-duck');
    if (naviaiTabDuck) {
      naviaiTabDuck.innerHTML = `<span class="free-pill">${l === 'fr' ? 'GRATUIT' : 'FREE'}</span> ${t('naviai_tab_duck')}`;
    }
    const naviaiInput = document.getElementById('naviai-input');
    if (naviaiInput) naviaiInput.placeholder = t('naviai_input_placeholder');
    const naviaiBtnSend = document.getElementById('naviai-btn-send');
    if (naviaiBtnSend) naviaiBtnSend.title = t('naviai_send_btn');
    const naviaiBtnClear = document.getElementById('naviai-btn-clear');
    if (naviaiBtnClear) naviaiBtnClear.title = t('naviai_clear_chat');
    const naviaiBtnSettings = document.getElementById('naviai-btn-settings');
    if (naviaiBtnSettings) naviaiBtnSettings.title = t('naviai_settings');
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
      if (isIncognitoWindowMode) {
        window.naviddan.createTab(null, true);
      } else {
        window.naviddan.createTab();
      }
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (isIncognitoWindowMode) {
        window.naviddan.createTab(null, true);
      } else {
        window.naviddan.openIncognitoWindow();
      }
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
      renderTabs();
      if (tab.id === activeTabId) {
        updateNavbarState(tab);
        updateActivePageContext();
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
    updateActivePageContext();
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

  window.naviddan.onAdblockUpdated?.((data) => {
    if (adblockCounter) {
      adblockCounter.textContent = data.totalBlocked || 0;
    }
  });

  // --- In-App Updater Banner ---
  const updateBanner = document.getElementById('update-banner');
  const updateBannerTitle = document.getElementById('update-banner-title');
  const updateBannerSub = document.getElementById('update-banner-sub');
  const updateBannerProgress = document.getElementById('update-banner-progress');
  const updateBannerProgressFill = document.getElementById('update-banner-progress-fill');
  const btnUpdateAction = document.getElementById('btn-update-action');
  const btnUpdateDismiss = document.getElementById('btn-update-dismiss');

  let activeUpdateData = null;
  let updateReadyToInstall = false;

  window.naviddan?.onUpdateAvailable?.((update) => {
    if (!update || !update.updateAvailable || !update.asset) return;
    activeUpdateData = update;
    const isEn = settings.language === 'en';
    if (updateBannerTitle) {
      updateBannerTitle.textContent = isEn
        ? `NaviDan v${update.latestVersion} available`
        : `Mise à jour v${update.latestVersion} disponible`;
    }
    if (updateBannerSub) {
      updateBannerSub.textContent = isEn
        ? 'Download to get the latest features & fixes'
        : 'Télécharger pour installer les correctifs et nouveautés';
    }
    if (btnUpdateAction) {
      btnUpdateAction.textContent = isEn ? 'Update now' : 'Mettre à jour';
    }
    updateBanner?.classList.remove('hidden');
  });

  btnUpdateDismiss?.addEventListener('click', () => {
    updateBanner?.classList.add('hidden');
  });

  btnUpdateAction?.addEventListener('click', async () => {
    const isEn = settings.language === 'en';
    if (updateReadyToInstall) {
      btnUpdateAction.disabled = true;
      btnUpdateAction.textContent = isEn ? 'Restarting...' : 'Relance...';
      await window.naviddan.installUpdate();
      return;
    }

    if (!activeUpdateData || !activeUpdateData.asset) return;

    btnUpdateAction.disabled = true;
    btnUpdateAction.textContent = '...';
    updateBannerProgress?.classList.remove('hidden');

    window.naviddan.onUpdateProgress?.((p) => {
      if (updateBannerProgressFill) updateBannerProgressFill.style.width = `${p.percent}%`;
      const mb = (p.transferred / 1048576).toFixed(1);
      const totalMb = (p.total / 1048576).toFixed(1);
      if (updateBannerSub) {
        updateBannerSub.textContent = `${p.percent}% (${mb} / ${totalMb} Mo)`;
      }
    });

    try {
      await window.naviddan.downloadUpdate(activeUpdateData.asset.downloadUrl, activeUpdateData.asset.name);
      updateReadyToInstall = true;
      btnUpdateAction.disabled = false;
      btnUpdateAction.classList.add('install-mode');
      btnUpdateAction.textContent = isEn ? 'Install & Restart' : 'Installer & Relancer';
      if (updateBannerSub) {
        updateBannerSub.textContent = isEn ? 'Ready to install!' : 'Prêt à installer !';
      }
    } catch (err) {
      btnUpdateAction.disabled = false;
      btnUpdateAction.textContent = isEn ? 'Retry' : 'Réessayer';
      if (updateBannerSub) {
        updateBannerSub.textContent = isEn ? 'Download failed' : 'Échec du téléchargement';
      }
    }
  });

  window.naviddan.onFoundInPage?.((result) => {
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

    // Filter tabs: pinned first, then tabs belonging to the current workspace
    const pinnedTabs = currentTabs.filter(t => !!t.isPinned);
    const wsTabs = currentTabs.filter(t => !t.isPinned && (t.workspaceId === currentWorkspaceId || !t.workspaceId));
    const visibleTabs = [...pinnedTabs, ...wsTabs];

    visibleTabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      const isPinned = !!tab.isPinned;
      const isHibernated = !!tab.isHibernated;

      tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isIncognito ? 'incognito' : ''} ${isPinned ? 'pinned' : ''} ${isHibernated ? 'hibernated' : ''}`;
      tabEl.id = `tab-${tab.id}`;
      tabEl.dataset.tabId = tab.id;

      if (isPinned) {
        const pinBadge = document.createElement('span');
        pinBadge.className = 'tab-pin-badge';
        pinBadge.textContent = '📌';
        tabEl.appendChild(pinBadge);
      }

      const favicon = document.createElement('span');
      favicon.className = 'tab-favicon';
      favicon.textContent = tab.isIncognito ? '🕶️' : '🌐';

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || (tab.isIncognito ? 'Navigation privée' : 'Nouvel onglet');
      title.title = tab.title || '';

      if (isHibernated) {
        const sleepBadge = document.createElement('span');
        sleepBadge.className = 'tab-sleep-badge';
        sleepBadge.textContent = '💤';
        sleepBadge.title = 'Onglet en veille (mémoire RAM libérée)';
        title.appendChild(sleepBadge);
      }

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

      // Tab Cyber Right-Click Context Menu
      tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.naviddan.showTabContextMenu?.({
          tabId: tab.id,
          x: e.screenX,
          y: e.screenY
        });
      });

      tabEl.appendChild(favicon);
      tabEl.appendChild(title);
      tabEl.appendChild(audioBtn);
      tabEl.appendChild(closeBtn);
      tabsListEl.appendChild(tabEl);
    });

    renderWorkspaces();
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

  // ==========================================
  // NAVIAI ASSISTANT CONTROLLER
  // ==========================================
  const btnNaviAI = document.getElementById('btn-naviai');
  const sidebarBtnAI = document.getElementById('sidebar-btn-ai');
  const naviaiPanel = document.getElementById('naviai-panel');
  const naviaiResizer = document.getElementById('naviai-resizer');
  const naviaiModelBadge = document.getElementById('naviai-model-badge');
  const naviaiBtnSettings = document.getElementById('naviai-btn-settings');
  const naviaiBtnClear = document.getElementById('naviai-btn-clear');
  const naviaiBtnClose = document.getElementById('naviai-btn-close');

  const naviaiChipSummary = document.getElementById('naviai-chip-summary');
  const naviaiChipTranslate = document.getElementById('naviai-chip-translate');
  const naviaiChipKeypoints = document.getElementById('naviai-chip-keypoints');
  const naviaiChipExplain = document.getElementById('naviai-chip-explain');

  // Mode Switcher Tabs
  const naviaiTabAssist = document.getElementById('naviai-tab-assist');
  const naviaiTabDuck = document.getElementById('naviai-tab-duck');
  const naviaiViewAssist = document.getElementById('naviai-view-assist');
  const naviaiViewDuck = document.getElementById('naviai-view-duck');
  const naviaiDuckFrame = document.getElementById('naviai-duck-frame');

  // Free Key Direct Links
  const naviaiLinkGemini = document.getElementById('naviai-link-gemini');
  const naviaiLinkGroq = document.getElementById('naviai-link-groq');

  const naviaiSettingsDrawer = document.getElementById('naviai-settings-drawer');
  const naviaiSettingsCloseBtn = document.getElementById('naviai-settings-close-btn');
  const naviaiProviderSelect = document.getElementById('naviai-provider-select');
  const naviaiKeyGemini = document.getElementById('naviai-key-gemini');
  const naviaiKeyGroq = document.getElementById('naviai-key-groq');
  const naviaiKeyOpenai = document.getElementById('naviai-key-openai');
  const naviaiGroupGemini = document.getElementById('naviai-group-gemini');
  const naviaiGroupGroq = document.getElementById('naviai-group-groq');
  const naviaiGroupOpenai = document.getElementById('naviai-group-openai');
  const naviaiGroupOllama = document.getElementById('naviai-group-ollama');
  const naviaiOllamaUrl = document.getElementById('naviai-ollama-url');
  const naviaiBtnScanOllama = document.getElementById('naviai-btn-scan-ollama');
  const naviaiOllamaModelSelect = document.getElementById('naviai-ollama-model-select');
  const naviaiCustomModel = document.getElementById('naviai-custom-model');
  const naviaiBtnSaveSettings = document.getElementById('naviai-btn-save-settings');

  const naviaiMessages = document.getElementById('naviai-messages');
  const naviaiContextPill = document.getElementById('naviai-context-pill');
  const naviaiContextTitle = document.getElementById('naviai-context-title');
  const naviaiBtnToggleContext = document.getElementById('naviai-btn-toggle-context');
  const naviaiInput = document.getElementById('naviai-input');
  const naviaiBtnSend = document.getElementById('naviai-btn-send');
  const naviaiBtnStop = document.getElementById('naviai-btn-stop');

  let isNaviAIOpen = false;
  let isContextActive = true;
  let isNaviAIStreaming = false;
  let naviaiHistory = [];
  let currentAssistantMsgEl = null;
  let currentAssistantText = '';

  // Load initial settings
  async function loadNaviAISettings() {
    try {
      const conf = await window.naviddan.getNaviAISettings();
      if (!conf) return;

      if (conf.panelWidth) {
        document.documentElement.style.setProperty('--naviai-panel-width', `${conf.panelWidth}px`);
      }

      naviaiProviderSelect.value = conf.provider || 'gemini';
      updateProviderKeyVisibility(conf.provider || 'gemini');

      if (conf.apiKeys) {
        naviaiKeyGemini.value = conf.apiKeys.gemini || '';
        naviaiKeyGroq.value = conf.apiKeys.groq || '';
        naviaiKeyOpenai.value = conf.apiKeys.openai || '';
      }

      naviaiOllamaUrl.value = conf.ollamaUrl || 'http://127.0.0.1:11434';
      naviaiCustomModel.value = conf.model || 'gemini-1.5-flash';
      updateModelBadge(conf.provider, conf.model);
    } catch (err) {
      console.warn('Erreur chargement réglages NaviAI:', err);
    }
  }

  function updateModelBadge(provider, model) {
    if (!naviaiModelBadge) return;
    const provName = provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : provider === 'ollama' ? 'Ollama' : 'OpenAI';
    naviaiModelBadge.textContent = `${provName} • ${model || 'default'}`;
  }

  function updateProviderKeyVisibility(provider) {
    naviaiGroupGemini.classList.toggle('hidden', provider !== 'gemini');
    naviaiGroupGroq.classList.toggle('hidden', provider !== 'groq');
    naviaiGroupOpenai.classList.toggle('hidden', provider !== 'openai');
    naviaiGroupOllama.classList.toggle('hidden', provider !== 'ollama');

    if (provider === 'gemini' && (!naviaiCustomModel.value || naviaiCustomModel.value.includes('llama') || naviaiCustomModel.value.includes('gpt'))) {
      naviaiCustomModel.value = 'gemini-1.5-flash';
    } else if (provider === 'groq' && (!naviaiCustomModel.value || naviaiCustomModel.value.includes('gemini') || naviaiCustomModel.value.includes('gpt'))) {
      naviaiCustomModel.value = 'llama-3.3-70b-versatile';
    } else if (provider === 'openai' && (!naviaiCustomModel.value || naviaiCustomModel.value.includes('gemini') || naviaiCustomModel.value.includes('llama'))) {
      naviaiCustomModel.value = 'gpt-4o-mini';
    }
  }

  // Toggle Eye on passwords
  document.querySelectorAll('.naviai-key-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  naviaiProviderSelect.addEventListener('change', () => {
    updateProviderKeyVisibility(naviaiProviderSelect.value);
  });

  naviaiBtnScanOllama.addEventListener('click', async () => {
    naviaiBtnScanOllama.textContent = '⏳';
    const models = await window.naviddan.getOllamaModels(naviaiOllamaUrl.value);
    naviaiBtnScanOllama.textContent = '🔄';
    naviaiOllamaModelSelect.innerHTML = '';
    if (models.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Aucun modèle détecté (lance ollama pull)';
      naviaiOllamaModelSelect.appendChild(opt);
    } else {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        naviaiOllamaModelSelect.appendChild(opt);
      });
      naviaiCustomModel.value = models[0];
    }
  });

  naviaiOllamaModelSelect.addEventListener('change', () => {
    if (naviaiOllamaModelSelect.value) {
      naviaiCustomModel.value = naviaiOllamaModelSelect.value;
    }
  });

  naviaiBtnSaveSettings.addEventListener('click', async () => {
    const updated = {
      provider: naviaiProviderSelect.value,
      model: naviaiCustomModel.value.trim(),
      apiKeys: {
        gemini: naviaiKeyGemini.value.trim(),
        groq: naviaiKeyGroq.value.trim(),
        openai: naviaiKeyOpenai.value.trim()
      },
      ollamaUrl: naviaiOllamaUrl.value.trim()
    };
    await window.naviddan.saveNaviAISettings(updated);
    updateModelBadge(updated.provider, updated.model);
    naviaiSettingsDrawer.classList.add('hidden');
  });

  naviaiBtnSettings.addEventListener('click', () => {
    naviaiSettingsDrawer.classList.toggle('hidden');
  });

  naviaiSettingsCloseBtn.addEventListener('click', () => {
    naviaiSettingsDrawer.classList.add('hidden');
  });

  // Toggle NaviAI Sidebar
  async function setNaviAIOpen(open) {
    isNaviAIOpen = open;
    naviaiPanel.classList.toggle('hidden', !open);
    if (btnNaviAI) btnNaviAI.classList.toggle('active', open);
    if (sidebarBtnAI) sidebarBtnAI.classList.toggle('active', open);
    await window.naviddan.toggleNaviAI(open);
    if (open) {
      updateActivePageContext();
      naviaiInput.focus();
    }
  }

  if (btnNaviAI) {
    btnNaviAI.addEventListener('click', (e) => {
      e.stopPropagation();
      setNaviAIOpen(!isNaviAIOpen);
    });
  }
  if (sidebarBtnAI) {
    sidebarBtnAI.addEventListener('click', (e) => {
      e.stopPropagation();
      setNaviAIOpen(!isNaviAIOpen);
    });
  }
  if (naviaiBtnClose) {
    naviaiBtnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      setNaviAIOpen(false);
    });
  }

  window.naviddan.onNaviAISidebarChanged((state) => {
    isNaviAIOpen = state.isOpen;
    naviaiPanel.classList.toggle('hidden', !isNaviAIOpen);
    if (btnNaviAI) btnNaviAI.classList.toggle('active', isNaviAIOpen);
    if (sidebarBtnAI) sidebarBtnAI.classList.toggle('active', isNaviAIOpen);
    if (state.width) {
      document.documentElement.style.setProperty('--naviai-panel-width', `${state.width}px`);
    }
  });

  // Resizer Dragging
  let isResizing = false;
  naviaiResizer.addEventListener('mousedown', () => {
    isResizing = true;
    naviaiResizer.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = Math.max(280, Math.min(700, window.innerWidth - e.clientX));
    document.documentElement.style.setProperty('--naviai-panel-width', `${newWidth}px`);
  });

  window.addEventListener('mouseup', async () => {
    if (!isResizing) return;
    isResizing = false;
    naviaiResizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const computedWidth = parseInt(getComputedStyle(naviaiPanel).width, 10);
    if (computedWidth) {
      await window.naviddan.saveNaviAISettings({ panelWidth: computedWidth });
    }
  });

  // Context Pill
  function updateActivePageContext() {
    const activeTab = currentTabs.find(t => t.id === activeTabId);
    if (activeTab && naviaiContextTitle) {
      naviaiContextTitle.textContent = activeTab.title || activeTab.url || 'Nouvel onglet';
    }
  }

  naviaiBtnToggleContext.addEventListener('click', () => {
    isContextActive = !isContextActive;
    naviaiContextPill.classList.toggle('disabled', !isContextActive);
    naviaiBtnToggleContext.textContent = isContextActive ? '✓' : '✕';
    naviaiBtnToggleContext.title = isContextActive ? 'Désactiver le contexte' : 'Activer le contexte';
  });

  // Clear Chat
  naviaiBtnClear.addEventListener('click', () => {
    naviaiHistory = [];
    naviaiMessages.innerHTML = `
      <div class="naviai-welcome">
        <div class="welcome-icon">⚡</div>
        <h3>NaviAI Assistant</h3>
        <p>Pose une question, résume l'onglet actif ou sélectionne un texte sur n'importe quel site web.</p>
      </div>
    `;
  });

  // Markdown rendering helper
  function renderMarkdown(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks with copy button (CSP-safe event delegation)
    escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><button class="code-copy-btn" type="button">Copier</button><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    escaped = escaped.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

    return escaped;
  }

  naviaiMessages?.addEventListener('click', (e) => {
    const btn = e.target.closest('.code-copy-btn');
    if (btn && btn.nextElementSibling) {
      navigator.clipboard.writeText(btn.nextElementSibling.innerText || '');
      btn.textContent = 'Copié !';
      setTimeout(() => { btn.textContent = 'Copier'; }, 1500);
    }
  });

  // Send Prompt to NaviAI
  async function submitNaviAIPrompt(promptText, extraContext = null) {
    const text = (promptText || naviaiInput.value).trim();
    if (!text || isNaviAIStreaming) return;

    naviaiInput.value = '';
    naviaiInput.style.height = 'auto';

    // Remove welcome screen if present
    const welcome = naviaiMessages.querySelector('.naviai-welcome');
    if (welcome) welcome.remove();

    // Append User Message
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'naviai-msg user';
    userMsgEl.textContent = text;
    naviaiMessages.appendChild(userMsgEl);

    // Retrieve active page content if context enabled
    let pageData = null;
    if (isContextActive) {
      pageData = await window.naviddan.getActivePageContent();
    }

    // Append Assistant Placeholder
    currentAssistantMsgEl = document.createElement('div');
    currentAssistantMsgEl.className = 'naviai-msg assistant';
    currentAssistantMsgEl.innerHTML = '<span class="streaming-cursor"></span>';
    naviaiMessages.appendChild(currentAssistantMsgEl);
    naviaiMessages.scrollTop = naviaiMessages.scrollHeight;

    currentAssistantText = '';
    isNaviAIStreaming = true;
    naviaiBtnSend.classList.add('hidden');
    naviaiBtnStop.classList.remove('hidden');

    const payload = {
      prompt: text,
      history: naviaiHistory.slice(-8), // Keep last 8 turns for memory
      pageContext: extraContext || (pageData ? pageData.content : null),
      pageTitle: pageData ? pageData.title : null,
      pageUrl: pageData ? pageData.url : null
    };

    naviaiHistory.push({ role: 'user', content: text });
    window.naviddan.sendNaviAIPrompt(payload);
  }

  // Stop Stream
  naviaiBtnStop.addEventListener('click', () => {
    window.naviddan.stopNaviAIStream();
    finishStreaming();
  });

  function finishStreaming() {
    isNaviAIStreaming = false;
    naviaiBtnStop.classList.add('hidden');
    naviaiBtnSend.classList.remove('hidden');
    if (currentAssistantMsgEl) {
      const cursor = currentAssistantMsgEl.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();
      currentAssistantMsgEl.innerHTML = renderMarkdown(currentAssistantText);
    }
    if (currentAssistantText.trim()) {
      naviaiHistory.push({ role: 'assistant', content: currentAssistantText });
    }
    naviaiMessages.scrollTop = naviaiMessages.scrollHeight;
  }

  // Stream Event Listeners
  window.naviddan.onNaviAIChunk((chunk) => {
    if (!currentAssistantMsgEl) return;
    currentAssistantText += chunk;
    currentAssistantMsgEl.innerHTML = renderMarkdown(currentAssistantText) + '<span class="streaming-cursor"></span>';
    naviaiMessages.scrollTop = naviaiMessages.scrollHeight;
  });

  window.naviddan.onNaviAIDone(() => {
    finishStreaming();
  });

  // Mode Switcher (Assistant vs Duck.ai)
  function switchNaviAIMode(mode) {
    const isDuck = mode === 'duck';
    naviaiTabAssist?.classList.toggle('active', !isDuck);
    naviaiTabDuck?.classList.toggle('active', isDuck);
    naviaiViewAssist?.classList.toggle('hidden', isDuck);
    naviaiViewDuck?.classList.toggle('hidden', !isDuck);

    if (isDuck && naviaiDuckFrame && (!naviaiDuckFrame.src || naviaiDuckFrame.src === 'about:blank')) {
      naviaiDuckFrame.src = 'https://duck.ai/';
    }
  }

  if (naviaiDuckFrame) {
    naviaiDuckFrame.addEventListener('dom-ready', () => {
      naviaiDuckFrame.executeJavaScript(`
        try {
          if (!localStorage.getItem('duckaiHasAgreedToTerms')) {
            localStorage.setItem('duckaiHasAgreedToTerms', 'true');
          }
        } catch (_) {}

        // Keep submit button unlocked and interactive
        setInterval(() => {
          const textarea = document.querySelector('textarea[name="user-prompt"]');
          const submitBtn = document.querySelector('button[type="submit"]') || document.querySelector('form[data-chat-footer] button');
          if (textarea && textarea.value.trim().length > 0 && submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('disabled');
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.classList.remove('jHEvwgq4Tf_c8h9Sl_vG');
          }
        }, 120);

        // Allow instant submit on Enter
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            const textarea = document.querySelector('textarea[name="user-prompt"]');
            if (textarea && document.activeElement === textarea && textarea.value.trim().length > 0) {
              const submitBtn = document.querySelector('button[type="submit"]') || document.querySelector('form[data-chat-footer] button');
              if (submitBtn) {
                e.preventDefault();
                submitBtn.disabled = false;
                submitBtn.click();
              } else {
                const form = textarea.closest('form');
                if (form) {
                  e.preventDefault();
                  form.requestSubmit();
                }
              }
            }
          }
        }, true);
      `).catch(() => {});
    });
  }

  naviaiTabAssist?.addEventListener('click', () => switchNaviAIMode('assist'));
  naviaiTabDuck?.addEventListener('click', () => switchNaviAIMode('duck'));

  document.getElementById('btn-open-duck-tab')?.addEventListener('click', () => {
    window.naviddan.createTab('https://duck.ai/');
  });

  // Free Key Direct Links
  naviaiLinkGemini?.addEventListener('click', () => {
    window.naviddan.createTab('https://aistudio.google.com/app/apikey');
  });

  naviaiLinkGroq?.addEventListener('click', () => {
    window.naviddan.createTab('https://console.groq.com/keys');
  });

  // Local Smart Extractive Summary (100% Free & Offline fallback)
  function generateLocalSmartSummary(pageData) {
    if (!pageData || !pageData.content) {
      return "<p>Aucun contenu textuel détecté sur cet onglet.</p>";
    }

    const sentences = pageData.content
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && s.length < 220);

    const wordCount = pageData.content.split(/\s+/).length;
    const readMinutes = Math.max(1, Math.round(wordCount / 200));
    const topSentences = sentences.slice(0, 5);

    let html = `
      <div style="border-left: 3px solid #10b981; padding-left: 8px; margin-bottom: 8px;">
        <strong style="color:#6ee7b7;">⚡ Synthèse Express Locale (100% Gratuite / Sans Clé)</strong><br>
        <span style="font-size:10.5px;color:var(--text-muted);">📄 ~${wordCount} mots • ⏱️ ${readMinutes} min de lecture estimée</span>
      </div>
      <ul style="margin: 6px 0; padding-left: 18px; line-height: 1.5; font-size: 12px;">
    `;

    if (topSentences.length > 0) {
      topSentences.forEach(s => {
        html += `<li>${s}</li>`;
      });
    } else {
      html += `<li>${pageData.content.substring(0, 300)}...</li>`;
    }
    html += `</ul>`;
    return html;
  }

  window.naviddan.onNaviAIError((err) => {
    if (currentAssistantMsgEl) {
      if (err && (err.includes('Clé API') || err.includes('manquante'))) {
        window.naviddan.getActivePageContent().then(pageData => {
          let localSummary = '';
          if (pageData && pageData.content && pageData.content.length > 100) {
            localSummary = generateLocalSmartSummary(pageData);
          }

          currentAssistantMsgEl.innerHTML = `
            ${localSummary}
            <div class="naviai-free-card">
              <h4>🎁 Activer l'IA Complète Gratuitement (0€ / Sans Carte)</h4>
              <p>NaviAI te propose 3 options 100% gratuites selon tes préférences :</p>
              <div class="free-actions-col">
                <button class="free-act-btn primary" id="btn-switch-duckai-now">
                  <span>🌐 <strong>Duck.ai Chat</strong> (GPT-4o mini / Claude sans clé)</span>
                  <span>Ouvrir ➔</span>
                </button>
                <button class="free-act-btn" id="btn-get-gemini-now">
                  <span>🔑 <strong>Clé Google Gemini</strong> (1 500 req/jour gratuites)</span>
                  <span>Obtenir ↗</span>
                </button>
                <button class="free-act-btn" id="btn-get-groq-now">
                  <span>⚡ <strong>Clé Groq</strong> (14 400 req/jour ultra-rapides)</span>
                  <span>Obtenir ↗</span>
                </button>
              </div>
            </div>
          `;

          document.getElementById('btn-switch-duckai-now')?.addEventListener('click', () => switchNaviAIMode('duck'));
          document.getElementById('btn-get-gemini-now')?.addEventListener('click', () => window.naviddan.createTab('https://aistudio.google.com/app/apikey'));
          document.getElementById('btn-get-groq-now')?.addEventListener('click', () => window.naviddan.createTab('https://console.groq.com/keys'));
          naviaiMessages.scrollTop = naviaiMessages.scrollHeight;
        });
      } else {
        currentAssistantMsgEl.innerHTML = `<span style="color:#ef4444;font-weight:600;">⚠️ ${err}</span>`;
      }
    }
    finishStreaming();
  });

  // In-page selection trigger handler
  window.naviddan.onNaviAITrigger((data) => {
    setNaviAIOpen(true);
    if (data.prompt) {
      submitNaviAIPrompt(data.prompt, data.selectedText ? `[Extrait sélectionné]\n${data.selectedText}` : null);
    }
  });

  // Quick Action Chips
  naviaiChipSummary.addEventListener('click', () => {
    submitNaviAIPrompt("Résume le contenu essentiel de cette page en 4 à 5 points clés percutants et clairs :");
  });

  naviaiChipTranslate.addEventListener('click', () => {
    submitNaviAIPrompt("Traduis fidèlement le contenu principal de cette page en français fluide et élégant :");
  });

  naviaiChipKeypoints.addEventListener('click', () => {
    submitNaviAIPrompt("Extrais les points clés majeurs, les dates/faits importants et la synthèse opérationnelle de cette page :");
  });

  naviaiChipExplain.addEventListener('click', () => {
    submitNaviAIPrompt("Explique simplement les concepts et sujets abordés sur cette page, de manière pédagogique et accessible :");
  });

  // Input listeners
  naviaiBtnSend.addEventListener('click', () => submitNaviAIPrompt());

  naviaiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitNaviAIPrompt();
    }
  });

  naviaiInput.addEventListener('input', () => {
    naviaiInput.style.height = 'auto';
    naviaiInput.style.height = `${Math.min(120, naviaiInput.scrollHeight)}px`;
  });

  loadNaviAISettings();
});
