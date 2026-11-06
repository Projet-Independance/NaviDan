document.addEventListener('DOMContentLoaded', () => {
  // --- State ---
  let tabs = [];
  let activeTabId = null;
  let nextTabId = 1;
  let bookmarks = [];
  let history = [];
  let currentTheme = 'cyber-dark';

  // Speed Dial items
  const speedDialItems = [
    { name: 'Google', url: 'https://www.google.com', icon: '🔍' },
    { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶' },
    { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
    { name: 'Wikipedia', url: 'https://fr.wikipedia.org', icon: '📚' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com', icon: '🦆' },
    { name: 'Reddit', url: 'https://www.reddit.com', icon: '💬' },
    { name: 'Twitter / X', url: 'https://x.com', icon: '✖' },
    { name: 'Twitch', url: 'https://www.twitch.tv', icon: '👾' }
  ];

  // --- DOM Elements ---
  const omniboxInput = document.getElementById('omnibox-input');
  const btnOmniboxAction = document.getElementById('btn-omnibox-action');
  const headerTabsCount = document.getElementById('header-tabs-count');
  const sheetTabsCount = document.getElementById('sheet-tabs-count');
  const btnOpenTabs = document.getElementById('btn-open-tabs');
  const tabsViewport = document.getElementById('tabs-viewport');
  const progressBar = document.getElementById('page-progress-bar');

  const btnNavBack = document.getElementById('btn-nav-back');
  const btnNavForward = document.getElementById('btn-nav-forward');
  const btnNavHome = document.getElementById('btn-nav-home');
  const btnNavBookmark = document.getElementById('btn-nav-bookmark');
  const btnNavMenu = document.getElementById('btn-nav-menu');
  const iconBookmark = document.getElementById('icon-bookmark');

  // Sheets
  const tabsSheet = document.getElementById('tabs-sheet');
  const tabsGrid = document.getElementById('tabs-grid');
  const btnNewTab = document.getElementById('btn-new-tab');
  const btnCloseTabsSheet = document.getElementById('btn-close-tabs-sheet');
  const tabsSheetBackdrop = document.getElementById('tabs-sheet-backdrop');

  const menuSheet = document.getElementById('menu-sheet');
  const btnCloseMenuSheet = document.getElementById('btn-close-menu-sheet');
  const menuSheetBackdrop = document.getElementById('menu-sheet-backdrop');
  const menuItemBookmarks = document.getElementById('menu-item-bookmarks');
  const menuItemHistory = document.getElementById('menu-item-history');
  const menuItemThemes = document.getElementById('menu-item-themes');
  const menuItemClear = document.getElementById('menu-item-clear');

  const dataSheet = document.getElementById('data-sheet');
  const dataSheetTitle = document.getElementById('data-sheet-title');
  const dataSheetBody = document.getElementById('data-sheet-body');
  const btnCloseDataSheet = document.getElementById('btn-close-data-sheet');
  const dataSheetBackdrop = document.getElementById('data-sheet-backdrop');

  const themesSheet = document.getElementById('themes-sheet');
  const btnCloseThemesSheet = document.getElementById('btn-close-themes-sheet');
  const themesSheetBackdrop = document.getElementById('themes-sheet-backdrop');

  // --- Load Storage ---
  function loadStorage() {
    try {
      bookmarks = JSON.parse(localStorage.getItem('navidan_bookmarks') || '[]');
      history = JSON.parse(localStorage.getItem('navidan_history') || '[]');
      currentTheme = localStorage.getItem('navidan_theme') || 'cyber-dark';
    } catch (_) {
      bookmarks = [];
      history = [];
      currentTheme = 'cyber-dark';
    }
    applyTheme(currentTheme);
  }

  function saveStorage() {
    try {
      localStorage.setItem('navidan_bookmarks', JSON.stringify(bookmarks));
      localStorage.setItem('navidan_history', JSON.stringify(history));
      localStorage.setItem('navidan_theme', currentTheme);
    } catch (_) {}
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.body.className = `theme-${theme}`;
    saveStorage();
  }

  // --- URL Parser ---
  function formatSearchUrl(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) return 'navidan://newtab';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  // --- Tab Management ---
  function createTab(initialUrl = 'navidan://newtab', switchTo = true) {
    const id = nextTabId++;
    const tab = {
      id,
      url: initialUrl,
      title: initialUrl === 'navidan://newtab' ? 'Nouvel Onglet' : initialUrl,
      history: [initialUrl],
      historyIndex: 0
    };
    tabs.push(tab);

    // Create wrapper in viewport
    const wrapper = document.createElement('div');
    wrapper.id = `tab-wrapper-${id}`;
    wrapper.className = 'tab-frame-wrapper';
    tabsViewport.appendChild(wrapper);

    renderTabContent(tab);

    if (switchTo || activeTabId === null) {
      switchTab(id);
    }
    updateTabsBadge();
    return tab;
  }

  function switchTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    activeTabId = id;

    // Toggle wrapper visibility
    document.querySelectorAll('.tab-frame-wrapper').forEach(el => el.classList.remove('active'));
    const currentWrapper = document.getElementById(`tab-wrapper-${id}`);
    if (currentWrapper) currentWrapper.classList.add('active');

    // Update omnibox
    if (tab.url === 'navidan://newtab') {
      omniboxInput.value = '';
      omniboxInput.placeholder = 'Rechercher ou entrer une URL';
    } else {
      omniboxInput.value = tab.url;
    }

    updateNavButtons();
    updateBookmarkStatus();
    updateTabsBadge();
  }

  function closeTab(id) {
    if (tabs.length === 1) {
      // Reinitialize to newtab if only 1 tab left
      const tab = tabs[0];
      navigateTab(tab.id, 'navidan://newtab');
      renderTabsGrid();
      return;
    }

    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const wrapper = document.getElementById(`tab-wrapper-${id}`);
    if (wrapper) wrapper.remove();

    tabs.splice(idx, 1);

    if (activeTabId === id) {
      const nextActive = tabs[Math.max(0, idx - 1)];
      switchTab(nextActive.id);
    }

    updateTabsBadge();
    renderTabsGrid();
  }

  function navigateTab(tabId, rawUrl) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const resolved = formatSearchUrl(rawUrl);
    tab.url = resolved;
    tab.title = resolved === 'navidan://newtab' ? 'Nouvel Onglet' : resolved;

    // Truncate forward history and push new
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(resolved);
    tab.historyIndex = tab.history.length - 1;

    renderTabContent(tab);

    if (tab.id === activeTabId) {
      if (resolved === 'navidan://newtab') {
        omniboxInput.value = '';
      } else {
        omniboxInput.value = resolved;
      }
      updateNavButtons();
      updateBookmarkStatus();
    }

    // Record in history if external
    if (resolved !== 'navidan://newtab') {
      history.unshift({
        id: Date.now().toString(),
        title: tab.title,
        url: resolved,
        visitedAt: Date.now()
      });
      if (history.length > 500) history = history.slice(0, 500);
      saveStorage();
    }
  }

  function renderTabContent(tab) {
    const wrapper = document.getElementById(`tab-wrapper-${tab.id}`);
    if (!wrapper) return;
    wrapper.innerHTML = '';

    if (tab.url === 'navidan://newtab') {
      // Render New Tab Dashboard
      const dash = document.createElement('div');
      dash.className = 'newtab-dashboard';
      dash.innerHTML = `
        <div class="newtab-brand">
          <span class="newtab-logo">⚡</span>
          <h1 class="newtab-title">NaviDan</h1>
          <p class="newtab-subtitle">Navigateur Cybernétique Mobile</p>
        </div>
        <div class="speeddial-grid" id="speeddial-grid-${tab.id}"></div>
      `;
      wrapper.appendChild(dash);

      const grid = dash.querySelector(`#speeddial-grid-${tab.id}`);
      speedDialItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'speeddial-card';
        card.innerHTML = `
          <div class="speeddial-icon-box">${item.icon}</div>
          <span class="speeddial-name">${item.name}</span>
        `;
        card.addEventListener('click', () => {
          navigateTab(tab.id, item.url);
        });
        grid.appendChild(card);
      });
    } else {
      // Embed iframe
      showLoading();
      const iframe = document.createElement('iframe');
      iframe.className = 'tab-frame';
      iframe.src = tab.url;
      iframe.setAttribute('allow', 'fullscreen; camera; microphone; geolocation');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

      iframe.onload = () => {
        hideLoading();
        try {
          if (iframe.contentDocument && iframe.contentDocument.title) {
            tab.title = iframe.contentDocument.title;
          }
        } catch (_) {}
      };

      iframe.onerror = () => {
        hideLoading();
      };

      wrapper.appendChild(iframe);
    }
  }

  function showLoading() {
    progressBar.classList.remove('hidden');
    progressBar.style.width = '30%';
    setTimeout(() => { progressBar.style.width = '75%'; }, 150);
  }

  function hideLoading() {
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.classList.add('hidden');
      progressBar.style.width = '0%';
    }, 200);
  }

  function updateTabsBadge() {
    const count = tabs.length;
    headerTabsCount.textContent = count;
    sheetTabsCount.textContent = count;
  }

  function updateNavButtons() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    btnNavBack.disabled = tab.historyIndex <= 0;
    btnNavForward.disabled = tab.historyIndex >= tab.history.length - 1;
  }

  function updateBookmarkStatus() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.url === 'navidan://newtab') {
      iconBookmark.setAttribute('fill', 'none');
      return;
    }
    const isBookmarked = bookmarks.some(b => b.url === tab.url);
    iconBookmark.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
  }

  // --- Render Tabs Grid in Modal ---
  function renderTabsGrid() {
    tabsGrid.innerHTML = '';
    tabs.forEach(tab => {
      const card = document.createElement('div');
      card.className = `tab-card ${tab.id === activeTabId ? 'active' : ''}`;
      card.innerHTML = `
        <div class="tab-card-header">
          <span class="tab-card-title">${tab.title || 'Nouvel Onglet'}</span>
          <button class="tab-card-close" data-id="${tab.id}">✕</button>
        </div>
        <span class="tab-card-url">${tab.url === 'navidan://newtab' ? 'navidan://newtab' : tab.url}</span>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-card-close')) {
          e.stopPropagation();
          closeTab(tab.id);
          return;
        }
        switchTab(tab.id);
        tabsSheet.classList.add('hidden');
      });

      tabsGrid.appendChild(card);
    });
  }

  // --- Omnibox Events ---
  btnOmniboxAction.addEventListener('click', () => {
    if (omniboxInput.value.trim() && activeTabId !== null) {
      navigateTab(activeTabId, omniboxInput.value.trim());
      omniboxInput.blur();
    }
  });

  omniboxInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (omniboxInput.value.trim() && activeTabId !== null) {
        navigateTab(activeTabId, omniboxInput.value.trim());
        omniboxInput.blur();
      }
    }
  });

  // --- Bottom Footer Navigation ---
  btnNavBack.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.historyIndex > 0) {
      tab.historyIndex--;
      tab.url = tab.history[tab.historyIndex];
      renderTabContent(tab);
      omniboxInput.value = tab.url === 'navidan://newtab' ? '' : tab.url;
      updateNavButtons();
      updateBookmarkStatus();
    }
  });

  btnNavForward.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      tab.url = tab.history[tab.historyIndex];
      renderTabContent(tab);
      omniboxInput.value = tab.url === 'navidan://newtab' ? '' : tab.url;
      updateNavButtons();
      updateBookmarkStatus();
    }
  });

  btnNavHome.addEventListener('click', () => {
    if (activeTabId !== null) {
      navigateTab(activeTabId, 'navidan://newtab');
    }
  });

  btnNavBookmark.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.url === 'navidan://newtab') return;

    const idx = bookmarks.findIndex(b => b.url === tab.url);
    if (idx !== -1) {
      bookmarks.splice(idx, 1);
    } else {
      bookmarks.unshift({
        id: Date.now().toString(),
        title: tab.title,
        url: tab.url
      });
    }
    saveStorage();
    updateBookmarkStatus();
  });

  // --- Tabs Sheet Modal ---
  btnOpenTabs.addEventListener('click', () => {
    renderTabsGrid();
    tabsSheet.classList.remove('hidden');
  });

  btnCloseTabsSheet.addEventListener('click', () => {
    tabsSheet.classList.add('hidden');
  });

  tabsSheetBackdrop.addEventListener('click', () => {
    tabsSheet.classList.add('hidden');
  });

  btnNewTab.addEventListener('click', () => {
    createTab('navidan://newtab', true);
    tabsSheet.classList.add('hidden');
  });

  // --- Menu Sheet Modal ---
  btnNavMenu.addEventListener('click', () => {
    menuSheet.classList.remove('hidden');
  });

  btnCloseMenuSheet.addEventListener('click', () => {
    menuSheet.classList.add('hidden');
  });

  menuSheetBackdrop.addEventListener('click', () => {
    menuSheet.classList.add('hidden');
  });

  menuItemBookmarks.addEventListener('click', () => {
    menuSheet.classList.add('hidden');
    openDataSheet('Favoris', bookmarks, (item) => {
      navigateTab(activeTabId, item.url);
      dataSheet.classList.add('hidden');
    }, (id) => {
      bookmarks = bookmarks.filter(b => b.id !== id);
      saveStorage();
      updateBookmarkStatus();
    });
  });

  menuItemHistory.addEventListener('click', () => {
    menuSheet.classList.add('hidden');
    openDataSheet('Historique', history, (item) => {
      navigateTab(activeTabId, item.url);
      dataSheet.classList.add('hidden');
    }, (id) => {
      history = history.filter(h => h.id !== id);
      saveStorage();
    });
  });

  menuItemClear.addEventListener('click', () => {
    history = [];
    saveStorage();
    menuSheet.classList.add('hidden');
    alert('Historique effacé avec succès.');
  });

  menuItemThemes.addEventListener('click', () => {
    menuSheet.classList.add('hidden');
    themesSheet.classList.remove('hidden');
  });

  // --- Data Sheet (Bookmarks / History) ---
  function openDataSheet(title, list, onSelect, onDelete) {
    dataSheetTitle.textContent = title;
    dataSheetBody.innerHTML = '';

    if (!list || list.length === 0) {
      dataSheetBody.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted);">Aucun élément enregistré</div>`;
    } else {
      list.forEach(item => {
        const row = document.createElement('div');
        row.className = 'data-row';
        row.innerHTML = `
          <div class="data-row-left">
            <span class="data-title">${item.title || item.url}</span>
            <span class="data-sub">${item.url}</span>
          </div>
          <button class="data-delete-btn">✕</button>
        `;

        row.addEventListener('click', (e) => {
          if (e.target.classList.contains('data-delete-btn')) {
            e.stopPropagation();
            onDelete(item.id);
            row.remove();
            return;
          }
          onSelect(item);
        });

        dataSheetBody.appendChild(row);
      });
    }

    dataSheet.classList.remove('hidden');
  }

  btnCloseDataSheet.addEventListener('click', () => {
    dataSheet.classList.add('hidden');
  });

  dataSheetBackdrop.addEventListener('click', () => {
    dataSheet.classList.add('hidden');
  });

  // --- Themes Sheet ---
  btnCloseThemesSheet.addEventListener('click', () => {
    themesSheet.classList.add('hidden');
  });

  themesSheetBackdrop.addEventListener('click', () => {
    themesSheet.classList.add('hidden');
  });

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.getAttribute('data-theme');
      applyTheme(selected);
      themesSheet.classList.add('hidden');
    });
  });

  // --- Startup ---
  loadStorage();
  createTab('navidan://newtab', true);
});

