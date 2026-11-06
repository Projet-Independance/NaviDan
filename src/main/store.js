const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

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
        sidebarVisible: true,
        language: 'fr'
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
      passwords: [],
      bookmarks: [],
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
      extensions: [],
      history: [],
      vaultPinHash: null,
      vaultPinSalt: null
    };
    this._cachedApiKeys = {};
    this.data = this.loadData();
  }

  async isEncryptionReady() {
    if (!safeStorage) return false;
    if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
      try {
        return await safeStorage.isAsyncEncryptionAvailable();
      } catch {
        return false;
      }
    }
    return typeof safeStorage.isEncryptionAvailable === 'function' ? safeStorage.isEncryptionAvailable() : false;
  }

  async encryptSecret(plainText) {
    if (!plainText || typeof plainText !== 'string') return '';
    if (plainText.startsWith('dpapi:')) return plainText;
    try {
      const ready = await this.isEncryptionReady();
      if (ready) {
        let encrypted;
        if (typeof safeStorage.encryptStringAsync === 'function') {
          encrypted = await safeStorage.encryptStringAsync(plainText);
        } else if (typeof safeStorage.encryptString === 'function') {
          encrypted = safeStorage.encryptString(plainText);
        }
        if (encrypted) {
          return 'dpapi:' + encrypted.toString('base64');
        }
      }
    } catch (err) {
      console.warn('Erreur chiffrement safeStorage:', err.message);
    }
    return plainText;
  }

  async decryptSecret(storedValue) {
    if (!storedValue || typeof storedValue !== 'string') return '';
    if (!storedValue.startsWith('dpapi:')) return storedValue;
    try {
      const ready = await this.isEncryptionReady();
      if (ready) {
        const buf = Buffer.from(storedValue.slice(6), 'base64');
        if (typeof safeStorage.decryptStringAsync === 'function') {
          const res = await safeStorage.decryptStringAsync(buf);
          return (res && typeof res === 'object' && 'result' in res) ? res.result : String(res || '');
        } else if (typeof safeStorage.decryptString === 'function') {
          return safeStorage.decryptString(buf);
        }
      }
    } catch (err) {
      console.warn('Erreur déchiffrement safeStorage:', err.message);
    }
    return '';
  }

  async loadDecryptedSecrets() {
    if (this.data.aiSettings && this.data.aiSettings.apiKeys) {
      for (const k of Object.keys(this.data.aiSettings.apiKeys)) {
        const val = this.data.aiSettings.apiKeys[k];
        if (val && typeof val === 'string') {
          if (val.startsWith('dpapi:')) {
            this._cachedApiKeys[k] = await this.decryptSecret(val);
          } else {
            this._cachedApiKeys[k] = val;
          }
        }
      }
    }
    await this.migratePlaintextSecrets();
  }

  async migratePlaintextSecrets() {
    let migrated = false;
    if (Array.isArray(this.data.passwords)) {
      for (const item of this.data.passwords) {
        if (item && item.password && !String(item.password).startsWith('dpapi:')) {
          const enc = await this.encryptSecret(String(item.password));
          if (enc !== item.password) {
            item.password = enc;
            migrated = true;
          }
        }
      }
    }
    if (this.data.aiSettings && this.data.aiSettings.apiKeys) {
      for (const k of Object.keys(this.data.aiSettings.apiKeys)) {
        const val = this.data.aiSettings.apiKeys[k];
        if (val && typeof val === 'string' && !val.startsWith('dpapi:')) {
          const enc = await this.encryptSecret(val);
          if (enc !== val) {
            this.data.aiSettings.apiKeys[k] = enc;
            migrated = true;
          }
        }
      }
    }
    if (migrated) {
      this.saveData();
    }
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
    if (key === 'aiSettings' && this.data.aiSettings) {
      const cloned = JSON.parse(JSON.stringify(this.data.aiSettings));
      if (cloned.apiKeys) {
        for (const k of Object.keys(cloned.apiKeys)) {
          if (this._cachedApiKeys && this._cachedApiKeys[k] !== undefined) {
            cloned.apiKeys[k] = this._cachedApiKeys[k];
          } else if (String(cloned.apiKeys[k]).startsWith('dpapi:')) {
            cloned.apiKeys[k] = '';
          }
        }
      }
      return cloned;
    }
    return this.data[key];
  }

  set(key, value) {
    if (key === 'aiSettings' && value && typeof value === 'object') {
      const cloned = JSON.parse(JSON.stringify(value));
      if (cloned.apiKeys) {
        for (const k of Object.keys(cloned.apiKeys)) {
          const raw = cloned.apiKeys[k];
          if (raw && typeof raw === 'string') {
            this._cachedApiKeys[k] = raw;
          }
        }
      }
      this.data[key] = cloned;
      this.saveData();
      this.migratePlaintextSecrets().catch(() => {});
      return;
    }
    this.data[key] = value;
    this.saveData();
  }

  // --- Vault Master PIN & Passwords ---
  hasVaultPin() {
    return Boolean(this.data.vaultPinHash && this.data.vaultPinSalt);
  }

  setVaultPin(pin) {
    if (!pin || String(pin).trim() === '') {
      this.data.vaultPinHash = null;
      this.data.vaultPinSalt = null;
      this.saveData();
      return { hasPin: false };
    }
    const cleanPin = String(pin).trim();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(cleanPin, salt, 100000, 32, 'sha256').toString('hex');
    this.data.vaultPinSalt = salt;
    this.data.vaultPinHash = hash;
    this.saveData();
    return { hasPin: true };
  }

  verifyVaultPin(pin) {
    if (!this.hasVaultPin()) return true;
    if (!pin) return false;
    try {
      const candidate = crypto.pbkdf2Sync(String(pin).trim(), this.data.vaultPinSalt, 100000, 32, 'sha256');
      const stored = Buffer.from(this.data.vaultPinHash, 'hex');
      if (candidate.length !== stored.length) return false;
      return crypto.timingSafeEqual(candidate, stored);
    } catch {
      return false;
    }
  }

  async getPasswords() {
    const rawList = this.data.passwords || [];
    return Promise.all(rawList.map(async item => ({
      ...item,
      password: await this.decryptSecret(item.password),
      encrypted: String(item.password || '').startsWith('dpapi:')
    })));
  }

  async addPassword(item) {
    if (!this.data.passwords) this.data.passwords = [];
    const id = Date.now().toString();
    const cleanSite = String(item.site || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    const encryptedPassword = await this.encryptSecret(String(item.password || ''));
    const entry = {
      id,
      site: cleanSite,
      username: String(item.username || ''),
      password: encryptedPassword,
      createdAt: Date.now()
    };
    this.data.passwords.unshift(entry);
    this.saveData();
    return {
      ...entry,
      password: String(item.password || ''),
      encrypted: entry.password.startsWith('dpapi:')
    };
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

  removeHistory(id) {
    if (!this.data.history) return;
    this.data.history = this.data.history.filter(h => h.id !== id && h.url !== id);
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

  // --- Extensions ---
  getExtensions() {
    return this.data.extensions || [];
  }

  saveExtensions(list) {
    this.data.extensions = list;
    this.saveData();
    return list;
  }
}

module.exports = Store;
