const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(filename = 'naviddan-data.json') {
    this.userDataPath = app.getPath('userData');
    this.filePath = path.join(this.userDataPath, filename);
    this.defaults = {
      settings: {
        theme: 'cyber-dark',
        accentColor: '#3b82f6',
        searchEngine: 'google',
        searchEngines: {
          google: 'https://www.google.com/search?q=',
          duckduckgo: 'https://duckduckgo.com/?q=',
          brave: 'https://search.brave.com/search?q=',
          bing: 'https://www.bing.com/search?q=',
          qwant: 'https://www.qwant.com/?q='
        },
        adblockEnabled: true,
        homePage: 'naviddan://newtab',
        showBookmarksBar: true,
        sidebarVisible: true
      },
      themeSettings: {
        preset: 'cyber-dark', // 'cyber-dark', 'tokyo-night', 'ocean-blue', 'matrix', 'light'
        accentColor: '#3b82f6',
        backgroundGradient: 'radial-gradient(circle at 50% 20%, #1e2638 0%, #0d111a 100%)'
      },
      perfSettings: {
        ramLimitEnabled: false,
        ramLimitGb: 4,
        hardLimit: false,
        cpuLimitEnabled: false,
        cpuLimitPercent: 50,
        cpuHardLimit: false,
        networkLimitEnabled: false,
        networkLimitSpeed: '50 MB/s'
      },
      passwords: [
        { id: '1', site: 'google.com', username: 'moncompte@gmail.com', password: 'ExempleMotDePasse123!', createdAt: Date.now() - 86400000 }
      ],
      bookmarks: [
        { id: '1', title: 'Google', url: 'https://www.google.com' },
        { id: '2', title: 'YouTube', url: 'https://www.youtube.com' },
        { id: '3', title: 'GitHub', url: 'https://github.com' },
        { id: '4', title: 'Wikipedia', url: 'https://fr.wikipedia.org' },
        { id: '5', title: 'Reddit', url: 'https://www.reddit.com' }
      ],
      speedDial: [
        { id: '1', title: 'Google', url: 'https://www.google.com', icon: '🔍' },
        { id: '2', title: 'YouTube', url: 'https://www.youtube.com', icon: '▶' },
        { id: '3', title: 'GitHub', url: 'https://github.com', icon: '🐙' },
        { id: '4', title: 'Wikipedia', url: 'https://fr.wikipedia.org', icon: '📚' },
        { id: '5', title: 'Twitter / X', url: 'https://x.com', icon: '✖' },
        { id: '6', title: 'Twitch', url: 'https://www.twitch.tv', icon: '👾' }
      ],
      workspaces: [
        { id: 'gaming', name: 'Gaming', icon: '🎮', color: '#ef4444' },
        { id: 'work', name: 'Travail', icon: '💼', color: '#3b82f6' },
        { id: 'personal', name: 'Perso', icon: '🌐', color: '#10b981' },
        { id: 'dev', name: 'Dev', icon: '⚡', color: '#a855f7' }
      ],
      activeWorkspaceId: 'gaming',
      tabHibernationEnabled: true,
      tabHibernationMinutes: 30,
      history: []
    };
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return Object.assign({}, this.defaults, JSON.parse(raw));
      }
    } catch (err) {
      console.error('Erreur chargement store:', err);
    }
    return Object.assign({}, this.defaults);
  }

  saveData() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erreur sauvegarde store:', err);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.saveData();
  }

  // --- Passwords ---
  getPasswords() {
    return this.data.passwords || [];
  }

  addPassword(item) {
    if (!this.data.passwords) this.data.passwords = [];
    const id = Date.now().toString();
    const entry = {
      id,
      site: item.site.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase(),
      username: item.username,
      password: item.password,
      createdAt: Date.now()
    };
    this.data.passwords.unshift(entry);
    this.saveData();
    return entry;
  }

  removePassword(id) {
    if (!this.data.passwords) return;
    this.data.passwords = this.data.passwords.filter(p => p.id !== id);
    this.saveData();
  }

  // --- Themes ---
  getThemeSettings() {
    return this.data.themeSettings || this.defaults.themeSettings;
  }

  updateThemeSettings(newTheme) {
    this.data.themeSettings = Object.assign({}, this.data.themeSettings, newTheme);
    this.saveData();
    return this.data.themeSettings;
  }

  // --- Performance Settings ---
  getPerfSettings() {
    return this.data.perfSettings || this.defaults.perfSettings;
  }

  updatePerfSettings(newPerf) {
    this.data.perfSettings = Object.assign({}, this.data.perfSettings, newPerf);
    this.saveData();
    return this.data.perfSettings;
  }

  // --- Bookmarks ---
  getBookmarks() {
    return this.data.bookmarks || [];
  }

  addBookmark(item) {
    if (!this.data.bookmarks) this.data.bookmarks = [];
    const id = Date.now().toString();
    const entry = { id, title: item.title || item.url, url: item.url, createdAt: Date.now() };
    this.data.bookmarks.unshift(entry);
    this.saveData();
    return entry;
  }

  removeBookmark(url) {
    if (!this.data.bookmarks) return;
    this.data.bookmarks = this.data.bookmarks.filter(b => b.url !== url && b.id !== url);
    this.saveData();
  }

  isBookmarked(url) {
    if (!this.data.bookmarks) return false;
    return this.data.bookmarks.some(b => b.url === url);
  }

  // --- History ---
  getHistory() {
    return this.data.history || [];
  }

  addHistory(item) {
    if (!item.url || item.url.startsWith('naviddan://') || item.url.startsWith('file:') || item.url === 'about:blank') return;
    if (!this.data.history) this.data.history = [];
    this.data.history = this.data.history.filter(h => h.url !== item.url);
    this.data.history.unshift({
      id: Date.now().toString(),
      title: item.title || item.url,
      url: item.url,
      visitedAt: Date.now()
    });
    if (this.data.history.length > 2000) {
      this.data.history = this.data.history.slice(0, 2000);
    }
    this.saveData();
  }

  clearHistory() {
    this.data.history = [];
    this.saveData();
  }

  // --- Settings ---
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = Object.assign({}, this.data.settings, newSettings);
    this.saveData();
    return this.data.settings;
  }

  // --- Speed Dial ---
  getSpeedDial() {
    return this.data.speedDial || [];
  }

  addSpeedDial(item) {
    if (!this.data.speedDial) this.data.speedDial = [];
    const entry = { id: Date.now().toString(), title: item.title || item.url, url: item.url, icon: item.icon || '🌐' };
    this.data.speedDial.push(entry);
    this.saveData();
    return entry;
  }

  removeSpeedDial(id) {
    if (!this.data.speedDial) return;
    this.data.speedDial = this.data.speedDial.filter(s => s.id !== id);
    this.saveData();
  }

  // --- Picture-in-Picture Bounds ---
  getPipBounds() {
    return this.data.pipBounds || null;
  }

  setPipBounds(bounds) {
    this.data.pipBounds = bounds;
    this.saveData();
  }

  // --- Workspaces ---
  getWorkspaces() {
    return this.data.workspaces || this.defaults.workspaces;
  }

  getActiveWorkspaceId() {
    return this.data.activeWorkspaceId || 'gaming';
  }

  setActiveWorkspaceId(id) {
    this.data.activeWorkspaceId = id;
    this.saveData();
    return id;
  }

  saveWorkspaces(workspaces) {
    this.data.workspaces = workspaces;
    this.saveData();
    return workspaces;
  }

  addWorkspace(ws) {
    if (!this.data.workspaces) this.data.workspaces = [...this.defaults.workspaces];
    const id = ws.id || 'ws_' + Date.now();
    const entry = {
      id,
      name: ws.name || 'Nouvel espace',
      icon: ws.icon || '🚀',
      color: ws.color || '#3b82f6'
    };
    this.data.workspaces.push(entry);
    this.saveData();
    return entry;
  }

  deleteWorkspace(id) {
    if (!this.data.workspaces || this.data.workspaces.length <= 1) return false;
    this.data.workspaces = this.data.workspaces.filter(w => w.id !== id);
    if (this.data.activeWorkspaceId === id) {
      this.data.activeWorkspaceId = this.data.workspaces[0].id;
    }
    this.saveData();
    return true;
  }
}

module.exports = Store;
