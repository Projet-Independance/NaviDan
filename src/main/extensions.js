const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { app, session, BrowserWindow, dialog } = require('electron');
const AdmZip = require('adm-zip');

class ExtensionsManager {
  constructor() {
    this.store = null;
    this.mainWindow = null;
    this.actionPopup = null;
    this.extensionsDir = null;
    this.catalog = [
      {
        id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
        name: 'Dark Reader',
        desc: 'Mode sombre intelligent pour chaque site web, repos des yeux.',
        category: 'Affichage',
        badge: 'Top'
      },
      {
        id: 'ddkjiahejlhfcafbddmgiahcphecmpfh',
        name: 'uBlock Origin Lite',
        desc: 'Bloqueur de publicités et traqueurs ultra-efficace et léger (MV3).',
        category: 'Confidentialité',
        badge: 'Essentiel'
      },
      {
        id: 'nngceckbapebfimnlniiiahkandclblb',
        name: 'Bitwarden',
        desc: 'Gestionnaire de mots de passe chiffré de bout en bout.',
        category: 'Sécurité',
        badge: 'Populaire'
      },
      {
        id: 'cofdbpoegempjloogbagkncekinflcnj',
        name: 'DeepL Traducteur',
        desc: 'Traduction instantanée ultra-précise par IA lors de la lecture.',
        category: 'Productivité',
        badge: 'IA'
      },
      {
        id: 'dhdgffkkebhmkfjojejmpbldmpobfkfo',
        name: 'Tampermonkey',
        desc: 'Exécution et gestion de scripts utilisateurs (Greasemonkey).',
        category: 'Outils',
        badge: 'Avancé'
      },
      {
        id: 'fihnjjcciajhdojfnbdddfaoknhalnja',
        name: "I don't care about cookies",
        desc: 'Masque et accepte automatiquement les avertissements de cookies.',
        category: 'Confort',
        badge: 'Pratique'
      },
      {
        id: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp',
        name: 'Privacy Badger',
        desc: 'Apprend et bloque automatiquement les traqueurs invisibles (EFF).',
        category: 'Confidentialité',
        badge: 'Sécurité'
      },
      {
        id: 'mnjggcdmjocbbbhaepdhchncahnbgone',
        name: 'SponsorBlock',
        desc: 'Passe automatiquement les sponsors intégrés dans les vidéos YouTube.',
        category: 'Médias',
        badge: 'Utile'
      },
      {
        id: 'gebbhagfogifgggkldgodflihgfeippi',
        name: 'Return YouTube Dislike',
        desc: 'Restaure l\'affichage du compteur de dislikes sur YouTube.',
        category: 'Médias',
        badge: 'Pratique'
      },
      {
        id: 'dbepggeogbaibhgnhhndojpepiihcmeb',
        name: 'Vimium',
        desc: 'Navigation web intégrale au clavier sans souris (raccourcis Vim).',
        category: 'Productivité',
        badge: 'Pro'
      },
      {
        id: 'gppongmhjkpfnbhagpmjfkannfbllamg',
        name: 'Wappalyzer',
        desc: 'Détecte les technologies, frameworks et serveurs utilisés sur un site.',
        category: 'Dev',
        badge: 'Dev'
      },
      {
        id: 'jabopobgcpjmedljpbcaablpmlmfcogm',
        name: 'WhatFont',
        desc: 'Identifie la typographie et police exacte de n\'importe quel texte au survol.',
        category: 'Design',
        badge: 'Design'
      },
      {
        id: 'cppjkneekbjaeellbfkmgnhonkkjfpdn',
        name: 'Clear Cache',
        desc: 'Nettoyage en un clic du cache et des cookies du navigateur.',
        category: 'Outils',
        badge: 'Rapide'
      },
      {
        id: 'fmkadmapgofadopljbjfkapdkoienihi',
        name: 'React Developer Tools',
        desc: 'Inspecteur complet de composants React et état hooks.',
        category: 'Dev',
        badge: 'DevTools'
      },
      {
        id: 'lmhkpmbekcpmknklioeibfkpmmfibljd',
        name: 'Redux DevTools',
        desc: 'Visualisation et voyage temporel des actions et du store Redux.',
        category: 'Dev',
        badge: 'DevTools'
      },
      {
        id: 'nhdogjmejiglipccpnnnanhbledajbpd',
        name: 'Vue.js devtools',
        desc: 'Inspecteur d\'applications et composants Vue.js.',
        category: 'Dev',
        badge: 'DevTools'
      }
    ];
  }

  init(store, mainWindow) {
    this.store = store;
    this.mainWindow = mainWindow;
    this.extensionsDir = path.join(app.getPath('userData'), 'extensions');
    if (!fs.existsSync(this.extensionsDir)) {
      fs.mkdirSync(this.extensionsDir, { recursive: true });
    }
  }

  async loadExtensionSafe(dirPath) {
    this.patchExtensionCompatibility(dirPath);
    const ses = session.defaultSession;
    if (ses.extensions && typeof ses.extensions.loadExtension === 'function') {
      return await ses.extensions.loadExtension(dirPath, { allowFileAccess: true });
    }
    return await ses.loadExtension(dirPath, { allowFileAccess: true });
  }

  async removeExtensionSafe(id) {
    const ses = session.defaultSession;
    if (ses.extensions && typeof ses.extensions.removeExtension === 'function') {
      return await ses.extensions.removeExtension(id);
    }
    return await ses.removeExtension(id);
  }

  patchExtensionCompatibility(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    const manifestPath = path.join(dirPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;

    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);

      let manifestModified = false;
      if (manifest.minimum_chrome_version) {
        delete manifest.minimum_chrome_version;
        manifestModified = true;
      }

      if (manifest.manifest_version === 3 && manifest.background && manifest.background.service_worker) {
        if (manifest.background.scripts) {
          delete manifest.background.scripts;
          manifestModified = true;
        }
      }

      // Whitelist only Chromium/Electron recognized permissions to prevent ExtensionLoadWarning
      const supportedPerms = new Set([
        'activeTab', 'alarms', 'declarativeNetRequest', 'declarativeNetRequestFeedback',
        'declarativeNetRequestWithHostAccess', 'scripting', 'storage', 'tabs',
        'unlimitedStorage', 'webRequest', 'webRequestAuthProvider', 'webRequestBlocking'
      ]);
      if (Array.isArray(manifest.permissions)) {
        const filtered = manifest.permissions.filter(p => supportedPerms.has(p) || (typeof p === 'string' && (p.includes('://') || p === '<all_urls>')));
        if (filtered.length !== manifest.permissions.length) {
          manifest.permissions = filtered;
          manifestModified = true;
        }
      }
      if (Array.isArray(manifest.optional_permissions)) {
        const filtered = manifest.optional_permissions.filter(p => supportedPerms.has(p) || (typeof p === 'string' && (p.includes('://') || p === '<all_urls>')));
        if (filtered.length !== manifest.optional_permissions.length) {
          manifest.optional_permissions = filtered;
          manifestModified = true;
        }
      }

      // Strip unsupported modern CSP directives like 'navigate-to'
      function cleanCSP(cspStr) {
        if (!cspStr || typeof cspStr !== 'string') return cspStr;
        return cspStr.replace(/navigate-to[^;]*;?/gi, '').replace(/;\s*;/g, ';').trim();
      }

      if (manifest.content_security_policy) {
        if (typeof manifest.content_security_policy === 'string') {
          const cleaned = cleanCSP(manifest.content_security_policy);
          if (cleaned !== manifest.content_security_policy) {
            manifest.content_security_policy = cleaned;
            manifestModified = true;
          }
        } else if (typeof manifest.content_security_policy === 'object') {
          for (const k of Object.keys(manifest.content_security_policy)) {
            const val = manifest.content_security_policy[k];
            if (typeof val === 'string') {
              const cleaned = cleanCSP(val);
              if (cleaned !== val) {
                manifest.content_security_policy[k] = cleaned;
                manifestModified = true;
              }
            }
          }
        }
      }

      if (!manifest.host_permissions) manifest.host_permissions = [];
      if (!manifest.host_permissions.includes('file:///*')) {
        manifest.host_permissions.push('file:///*');
        manifestModified = true;
      }

      if (manifestModified) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      }

      const bgScripts = [];
      if (manifest.background) {
        if (typeof manifest.background.service_worker === 'string') {
          bgScripts.push(manifest.background.service_worker);
        }
        if (Array.isArray(manifest.background.scripts)) {
          bgScripts.push(...manifest.background.scripts);
        }
      }

      const polyfillCode = `/* NAVI_SHIM_START */
try {
  const g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  if (typeof g.chrome === 'undefined') g.chrome = {};
  const c = g.chrome;

  function createDeepStub() {
    const dummyFn = function(...args) {
      const last = args[args.length - 1];
      if (typeof last === 'function') {
        try { last({}); } catch (_) {}
      }
      return Promise.resolve({});
    };
    const handler = {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'addListener' || prop === 'removeListener' || prop === 'hasListener' || prop === 'hasListeners') {
          return () => {};
        }
        if (prop === 'then') return undefined;
        return new Proxy(dummyFn, handler);
      },
      apply(target, thisArg, args) {
        return dummyFn.apply(thisArg, args);
      }
    };
    return new Proxy(dummyFn, handler);
  }

  const namespaces = [
    'windows', 'commands', 'permissions', 'webNavigation', 'sidePanel',
    'privacy', 'notifications', 'offscreen', 'bookmarks', 'history',
    'cookies', 'declarativeNetRequest', 'scripting', 'identity', 'tabs',
    'contextMenus', 'action'
  ];

  for (const ns of namespaces) {
    if (!c[ns]) {
      c[ns] = createDeepStub();
    } else {
      c[ns] = new Proxy(c[ns], {
        get(target, prop) {
          if (prop in target && target[prop] !== undefined) return target[prop];
          return createDeepStub();
        }
      });
    }
  }

  // FontSettings emulation for extensions like Dark Reader
  c.fontSettings.getFontList = function(cb) {
    const list = [
      { fontId: 'Arial', displayName: 'Arial' },
      { fontId: 'Helvetica', displayName: 'Helvetica' },
      { fontId: 'Times New Roman', displayName: 'Times New Roman' },
      { fontId: 'Courier New', displayName: 'Courier New' },
      { fontId: 'Verdana', displayName: 'Verdana' },
      { fontId: 'Georgia', displayName: 'Georgia' },
      { fontId: 'Segoe UI', displayName: 'Segoe UI' },
      { fontId: 'Roboto', displayName: 'Roboto' }
    ];
    if (typeof cb === 'function') cb(list);
    return Promise.resolve(list);
  };

  // Windows emulation
  c.windows.getAll = function(opt, cb) {
    const callback = typeof opt === 'function' ? opt : cb;
    const list = [{ id: 1, focused: true, state: 'normal' }];
    if (typeof callback === 'function') callback(list);
    return Promise.resolve(list);
  };
  c.windows.getCurrent = function(opt, cb) {
    const callback = typeof opt === 'function' ? opt : cb;
    const win = { id: 1, focused: true, state: 'normal' };
    if (typeof callback === 'function') callback(win);
    return Promise.resolve(win);
  };

  c.commands.getAll = function(cb) {
    if (typeof cb === 'function') cb([]);
    return Promise.resolve([]);
  };

  if (c.storage && !c.storage.sync) {
    c.storage.sync = c.storage.local;
  }

  try {
    const origExt = c.extension || {};
    const extShim = {
      ...origExt,
      isAllowedFileSchemeAccess: function(cb) { if (typeof cb === 'function') cb(true); return Promise.resolve(true); },
      isAllowedIncognitoAccess: function(cb) { if (typeof cb === 'function') cb(true); return Promise.resolve(true); }
    };
    Object.defineProperty(c, 'extension', {
      value: new Proxy(extShim, {
        get(target, prop) {
          if (prop in target && target[prop] !== undefined) return target[prop];
          if (prop === 'isAllowedFileSchemeAccess' || prop === 'isAllowedIncognitoAccess') {
            return function(cb) { if (typeof cb === 'function') cb(true); return Promise.resolve(true); };
          }
          return createDeepStub();
        }
      }),
      configurable: true,
      writable: true
    });
  } catch (_) {}

  if (typeof g.addEventListener === 'function') {
    g.addEventListener('unhandledrejection', (e) => {
      const msg = e && e.reason && (e.reason.message || String(e.reason));
      if (msg && msg.includes('Could not establish connection')) {
        e.preventDefault();
      }
    });
  }

  if (c.tabs && c.tabs.sendMessage) {
    const origSend = c.tabs.sendMessage;
    c.tabs.sendMessage = function(...args) {
      try {
        const res = origSend.apply(this, args);
        if (res && typeof res.catch === 'function') return res.catch(() => {});
        return res;
      } catch (_) {
        return Promise.resolve();
      }
    };
  }

  if (c.scripting) {
    const origExec = c.scripting.executeScript;
    c.scripting.executeScript = function(...args) {
      try {
        const res = origExec.apply(this, args);
        if (res && typeof res.catch === 'function') {
          return res.catch(err => {
            const m = err && err.message;
            if (m && (m.includes('Cannot access contents') || m.includes('permission to access this host'))) {
              return [];
            }
            throw err;
          });
        }
        return res;
      } catch (_) {
        return Promise.resolve([]);
      }
    };
  }

  if (c.tabs && c.tabs.executeScript) {
    const origTabsExec = c.tabs.executeScript;
    c.tabs.executeScript = function(...args) {
      try {
        const res = origTabsExec.apply(this, args);
        if (res && typeof res.catch === 'function') {
          return res.catch(err => {
            const m = err && err.message;
            if (m && (m.includes('Cannot access contents') || m.includes('permission to access this host'))) {
              return [];
            }
            throw err;
          });
        }
        return res;
      } catch (_) {
        return Promise.resolve([]);
      }
    };
  }
} catch (_) {}
/* NAVI_SHIM_END */
`;

      for (const rel of bgScripts) {
        const fullPath = path.join(dirPath, rel);
        if (fs.existsSync(fullPath)) {
          let code = fs.readFileSync(fullPath, 'utf8');
          code = code.replace(/chrome\.extension\.isAllowedFileSchemeAccess\s*\(\s*([^)]+)\s*\)/g, (_, fn) => `${fn}(true)`);
          code = code.replace(/Extension\.startBarrier\.isPending\(\)/g, 'false');
          code = code.replace(/Extension\.startBarrier\.entry\(\)/g, 'Promise.resolve()');
          code = code.replace(/commands\.reduce\s*\(/g, '(Array.isArray(commands) ? commands : []).reduce(');
          code = code.replace(/for\s*\(\s*const\s+r\s+of\s+trie\.regexps\s*\)/g, 'for (const r of (trie && Array.isArray(trie.regexps) ? trie.regexps : []))');
          code = code.replace(/for\s*\(\s*const\s+p\s+of\s+trie\.hardPatterns\s*\)/g, 'for (const p of (trie && Array.isArray(trie.hardPatterns) ? trie.hardPatterns : []))');
          code = code.replace(/function\s+isURLInIndexedList\s*\([\s\S]*?trie[\s\S]*?\)\s*\{/g, 'function isURLInIndexedList(url, trie) { if (!trie || !trie.regexps || !Array.isArray(trie.regexps)) return false;');
          code = code.replace(/function\s+getURLMatchesFromIndexedList\s*\([\s\S]*?breakOnFirstMatch\s*=\s*false[\s\S]*?\)\s*\{/g, 'function getURLMatchesFromIndexedList(url, trie, breakOnFirstMatch = false) { if (!trie || !trie.regexps || !Array.isArray(trie.regexps)) return [];');
          code = code.replace(/static\s+DARK_SITES_INDEX;/g, 'static DARK_SITES_INDEX = { regexps: [], hardPatterns: [], hostNodes: new Map(), pathNodes: new Map() };');
          code = code.replace(/static\s+DETECTOR_HINTS_INDEX;/g, 'static DETECTOR_HINTS_INDEX = { regexps: [], hardPatterns: [], hostNodes: new Map(), pathNodes: new Map() };');
          code = code.replace(/static\s+DYNAMIC_THEME_FIXES_INDEX;/g, 'static DYNAMIC_THEME_FIXES_INDEX = { regexps: [], hardPatterns: [], hostNodes: new Map(), pathNodes: new Map() };');
          code = code.replace(/static\s+INVERSION_FIXES_INDEX;/g, 'static INVERSION_FIXES_INDEX = { regexps: [], hardPatterns: [], hostNodes: new Map(), pathNodes: new Map() };');
          code = code.replace(/static\s+STATIC_THEMES_INDEX;/g, 'static STATIC_THEMES_INDEX = { regexps: [], hardPatterns: [], hostNodes: new Map(), pathNodes: new Map() };');
          code = code.replace(/case\s+MessageTypeUItoBG\.GET_DATA:\s*Messenger\.adapter\s*\.collect\(\)\s*\.then\(\(data\)\s*=>\s*sendResponse\(\{data\}\)\);/g, 
            'case MessageTypeUItoBG.GET_DATA: Messenger.adapter.collect().then((data) => sendResponse({data})).catch((err) => { console.error("collect err:", err); sendResponse({data: { isReady: true, isEnabled: true, settings: { theme: {} }, news: [], shortcuts: [] }}); });');
          if (code.includes('/* NAVI_SHIM_START */')) {
            code = code.replace(/\/\* NAVI_SHIM_START \*\/[\s\S]*?\/\* NAVI_SHIM_END \*\/\s*/, polyfillCode + '\n');
          } else {
            code = polyfillCode + '\n' + code;
          }
          fs.writeFileSync(fullPath, code, 'utf8');
        }
      }

      // Patch Popup HTML & Scripts for UI extensions like Dark Reader
      const action = manifest.action || manifest.browser_action || manifest.page_action;
      if (action && action.default_popup) {
        const popupRel = action.default_popup.replace(/^\.?\//, '');
        const popupHtmlPath = path.join(dirPath, popupRel);
        if (fs.existsSync(popupHtmlPath)) {
          let html = fs.readFileSync(popupHtmlPath, 'utf8');
          const scriptTag = `<script>\n${polyfillCode}\n</script>`;
          if (html.includes('/* NAVI_SHIM_START */')) {
            html = html.replace(/<script>[\s\S]*?\/\* NAVI_SHIM_START \*\/[\s\S]*?<\/script>/, scriptTag);
          } else {
            if (html.includes('<head>')) {
              html = html.replace('<head>', '<head>\n' + scriptTag);
            } else {
              html = scriptTag + '\n' + html;
            }
          }
          fs.writeFileSync(popupHtmlPath, html, 'utf8');

          const popupDir = path.dirname(popupHtmlPath);
          const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
          let match;
          while ((match = scriptSrcRegex.exec(html)) !== null) {
            const src = match[1];
            if (!src.startsWith('http') && !src.startsWith('//')) {
              const fullScriptPath = path.resolve(popupDir, src.split('?')[0]);
              if (fs.existsSync(fullScriptPath)) {
                let code = fs.readFileSync(fullScriptPath, 'utf8');
                code = code.replace(/chrome\.extension\.isAllowedFileSchemeAccess\s*\(\s*([^)]+)\s*\)/g, (_, fn) => `${fn}(true)`);
                code = code.replace(/(async\s+)?function\s+getFontList\(\)\s*\{[\s\S]*?return\s+new\s+Promise[\s\S]*?\}\s*\}\s*\);?\s*(\}\s*\);)?\s*\}/g,
                  'async function getFontList() { return ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]; }');
                code = code.replace(/async\s+function\s+getFontList\(\)\s*\{\s*return\s+\[[^\]]*\];\s*\}\s*\);\s*\}/g,
                  'async function getFontList() { return ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]; }');
                code = code.replace(/\(\{data,\s*error\}\)\s*=>\s*\{/g, '(res) => { const {data, error} = res || {};');
                if (code.includes('/* NAVI_SHIM_START */')) {
                  code = code.replace(/\/\* NAVI_SHIM_START \*\/[\s\S]*?\/\* NAVI_SHIM_END \*\/\s*/, polyfillCode + '\n');
                } else {
                  code = polyfillCode + '\n' + code;
                }
                fs.writeFileSync(fullScriptPath, code, 'utf8');
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Patching extension warning:', err.message);
    }
  }

  async loadAllStoredExtensions() {
    if (!this.store) return;
    const list = this.store.getExtensions();
    for (const item of list) {
      if (item.enabled && item.dirPath && fs.existsSync(item.dirPath)) {
        try {
          const loaded = await this.loadExtensionSafe(item.dirPath);
          if (loaded && loaded.id) {
            item.loadedId = loaded.id;
          }
        } catch (err) {
          console.error(`Erreur chargement extension ${item.name || item.id}:`, err.message);
        }
      }
    }
    this.store.saveExtensions(list);
    this.notifyChanged();
  }

  extractId(input) {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();
    // Direct 32-char ID
    if (/^[a-p]{32}$/i.test(clean)) {
      return clean.toLowerCase();
    }
    // Web store URL: https://chromewebstore.google.com/detail/.../<id>
    const match = clean.match(/\/detail\/(?:[^\/]+\/)?([a-p]{32})/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
    // Query param style or trailing ID
    const match2 = clean.match(/([a-p]{32})/i);
    if (match2 && match2[1]) {
      return match2[1].toLowerCase();
    }
    return null;
  }

  fetchBufferWithRedirects(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) return reject(new Error('Trop de redirections'));
      const client = url.startsWith('https') ? https : http;
      client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(this.fetchBufferWithRedirects(res.headers.location, maxRedirects - 1));
        }
        if (res.statusCode === 204) {
          return reject(new Error('Extension non disponible au téléchargement public (HTTP 204).'));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Erreur HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
  }

  async installFromWebStore(input) {
    const extId = this.extractId(input);
    if (!extId) {
      throw new Error('ID ou URL d\'extension Chrome Web Store invalide.');
    }

    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=9999.0.9999.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;
    const crxBuffer = await this.fetchBufferWithRedirects(crxUrl);

    // CRX to ZIP: locate PK\x03\x04
    const zipOffset = crxBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (zipOffset === -1) {
      throw new Error('Format de fichier CRX non reconnu.');
    }

    const targetDir = path.join(this.extensionsDir, extId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const zip = new AdmZip(crxBuffer.subarray(zipOffset));
    zip.extractAllTo(targetDir, true);

    const manifestPath = path.join(targetDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('manifest.json introuvable dans l\'archive téléchargée.');
    }

    // Load in Electron
    const loadedExt = await this.loadExtensionSafe(targetDir);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const item = {
      id: extId,
      loadedId: (loadedExt && loadedExt.id) || extId,
      name: manifest.name || (loadedExt && loadedExt.name) || extId,
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      dirPath: targetDir,
      enabled: true,
      source: 'webstore',
      installedAt: Date.now()
    };

    const currentList = this.store.getExtensions().filter(e => e.id !== extId);
    currentList.push(item);
    this.store.saveExtensions(currentList);
    this.notifyChanged();

    return this.formatExtension(item, manifest);
  }

  async installFromFolder() {
    const res = await dialog.showOpenDialog(this.mainWindow, {
      title: 'Sélectionner le dossier de l\'extension décompressée',
      properties: ['openDirectory']
    });

    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return null;
    }

    const sourceDir = res.filePaths[0];
    const manifestPath = path.join(sourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Le dossier sélectionné ne contient aucun fichier manifest.json.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const loadedExt = await this.loadExtensionSafe(sourceDir);
    const extId = loadedExt.id || 'ext_' + Date.now();

    const item = {
      id: extId,
      loadedId: (loadedExt && loadedExt.id) || extId,
      name: manifest.name || path.basename(sourceDir),
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      dirPath: sourceDir,
      enabled: true,
      source: 'local',
      installedAt: Date.now()
    };

    const currentList = this.store.getExtensions().filter(e => e.id !== extId);
    currentList.push(item);
    this.store.saveExtensions(currentList);
    this.notifyChanged();

    return this.formatExtension(item, manifest);
  }

  async toggleExtension(id, enabled) {
    const list = this.store.getExtensions();
    const item = list.find(e => e.id === id);
    if (!item) return false;

    item.enabled = !!enabled;

    if (item.enabled) {
      try {
        if (item.dirPath && fs.existsSync(item.dirPath)) {
          await this.loadExtensionSafe(item.dirPath);
        }
      } catch (err) {
        console.error('Erreur activation extension:', err);
      }
    } else {
      try {
        await this.removeExtensionSafe(id);
      } catch (err) {
        console.error('Erreur désactivation extension:', err);
      }
    }

    this.store.saveExtensions(list);
    this.notifyChanged();
    return true;
  }

  resolveI18n(str, dirPath, defaultLocale = 'en') {
    if (!str || typeof str !== 'string' || !str.startsWith('__MSG_') || !str.endsWith('__')) {
      return str;
    }
    const key = str.slice(6, -2);
    const locales = ['fr', defaultLocale, 'en', 'en_US', 'en_GB'];
    for (const loc of locales) {
      if (!loc) continue;
      const locFile = path.join(dirPath, '_locales', loc, 'messages.json');
      if (fs.existsSync(locFile)) {
        try {
          const msgs = JSON.parse(fs.readFileSync(locFile, 'utf8'));
          if (msgs[key] && msgs[key].message) {
            return msgs[key].message;
          }
        } catch (_) { }
      }
    }
    return key;
  }

  async uninstallExtension(id) {
    const list = this.store.getExtensions();
    const item = list.find(e => e.id === id || e.loadedId === id);

    try {
      await this.removeExtensionSafe(id);
    } catch (_) { }

    if (item && item.loadedId) {
      try {
        await this.removeExtensionSafe(item.loadedId);
      } catch (_) { }
    }

    try {
      const ses = session.defaultSession;
      const extApi = ses.extensions || ses;
      const allExts = extApi.getAllExtensions ? extApi.getAllExtensions() : [];
      for (const loaded of allExts) {
        if (item && (loaded.path === item.dirPath || loaded.id === id || loaded.id === item.loadedId)) {
          await this.removeExtensionSafe(loaded.id);
        }
      }
    } catch (_) { }

    if (item && item.dirPath && fs.existsSync(item.dirPath)) {
      try {
        fs.rmSync(item.dirPath, { recursive: true, force: true, maxRetries: 3 });
      } catch (err) {
        console.error('Erreur suppression dossier extension:', err.message);
      }
    }

    const filtered = list.filter(e => e.id !== id && (!item || e.id !== item.id));
    this.store.saveExtensions(filtered);
    this.notifyChanged();
    return true;
  }

  formatExtension(item, manifestOpt = null) {
    let manifest = manifestOpt;
    if (!manifest && item.dirPath) {
      const mfPath = path.join(item.dirPath, 'manifest.json');
      if (fs.existsSync(mfPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
        } catch (_) { }
      }
    }

    let name = (manifest && manifest.name) || item.name;
    let description = (manifest && manifest.description) || item.description;

    if (item.dirPath && manifest) {
      name = this.resolveI18n(name, item.dirPath, manifest.default_locale);
      description = this.resolveI18n(description, item.dirPath, manifest.default_locale);
    }

    let iconData = null;
    let actionPopup = null;
    let actionTitle = name;

    if (manifest) {
      // Find action popup
      const action = manifest.action || manifest.browser_action || manifest.page_action;
      if (action) {
        actionPopup = action.default_popup || null;
        if (action.default_title) actionTitle = this.resolveI18n(action.default_title, item.dirPath, manifest.default_locale);
      }

      // Find icon
      let iconRel = null;
      if (action && action.default_icon) {
        iconRel = typeof action.default_icon === 'string'
          ? action.default_icon
          : (action.default_icon['32'] || action.default_icon['48'] || action.default_icon['16'] || Object.values(action.default_icon)[0]);
      }
      if (!iconRel && manifest.icons) {
        iconRel = manifest.icons['48'] || manifest.icons['32'] || manifest.icons['128'] || manifest.icons['16'] || Object.values(manifest.icons)[0];
      }

      if (iconRel && item.dirPath) {
        const fullIconPath = path.join(item.dirPath, iconRel);
        if (fs.existsSync(fullIconPath)) {
          try {
            const buf = fs.readFileSync(fullIconPath);
            const ext = path.extname(fullIconPath).slice(1) || 'png';
            iconData = `data:image/${ext};base64,${buf.toString('base64')}`;
          } catch (_) { }
        }
      }
    }

    let runtimeId = item.loadedId || null;
    try {
      const ses = session.defaultSession;
      const extApi = ses.extensions || ses;
      const allExts = extApi.getAllExtensions ? extApi.getAllExtensions() : [];
      const found = allExts.find(e => e.path === item.dirPath || e.id === item.loadedId || e.id === item.id);
      if (found) runtimeId = found.id;
    } catch (_) { }

    return {
      id: item.id,
      runtimeId: runtimeId || item.id,
      name,
      version: (manifest && manifest.version) || item.version,
      description,
      enabled: !!item.enabled,
      source: item.source,
      hasActionPopup: !!actionPopup,
      actionPopup,
      actionTitle,
      iconData
    };
  }

  getExtensionsList() {
    const list = this.store ? this.store.getExtensions() : [];
    return list.map(item => this.formatExtension(item));
  }

  getCatalog() {
    const installedIds = new Set((this.store ? this.store.getExtensions() : []).map(e => e.id));
    return this.catalog.map(cat => ({
      ...cat,
      isInstalled: installedIds.has(cat.id)
    }));
  }

  openActionPopup(id, coords, callerWin = null) {
    if (this.actionPopup && !this.actionPopup.isDestroyed()) {
      this.actionPopup.close();
      this.actionPopup = null;
    }

    const list = this.getExtensionsList();
    const ext = list.find(e => e.id === id || e.runtimeId === id);
    if (!ext || !ext.enabled || !ext.actionPopup) {
      return false;
    }

    const targetWin = (callerWin && !callerWin.isDestroyed()) ? callerWin : this.mainWindow;
    if (!targetWin || targetWin.isDestroyed()) return false;

    const targetId = ext.runtimeId || ext.id;
    const popupFile = ext.actionPopup.replace(/^\.?\//, '');
    const popupUrl = `chrome-extension://${targetId}/${popupFile}`;

    const winBounds = targetWin.getBounds();
    const width = 380;
    const height = 520;
    const screenX = Math.round(winBounds.x + (coords.x || 300) - width + 24);
    const screenY = Math.round(winBounds.y + (coords.y || 40) + 8);

    const isLinux = process.platform === 'linux';
    this.actionPopup = new BrowserWindow({
      width,
      height,
      x: screenX,
      y: screenY,
      frame: false,
      transparent: !isLinux,
      backgroundColor: isLinux ? '#12151f' : '#00000000',
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      parent: targetWin,
      hasShadow: true,
      webPreferences: {
        session: session.defaultSession,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.actionPopup.loadURL(popupUrl).catch(err => {
      console.error('Erreur chargement action popup:', popupUrl, err.message);
    });

    this.actionPopup.on('blur', () => {
      if (this.actionPopup && !this.actionPopup.isDestroyed()) {
        this.actionPopup.close();
        this.actionPopup = null;
      }
    });

    return true;
  }

  notifyChanged() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('extensions:updated', this.getExtensionsList());
    }
  }
}

module.exports = new ExtensionsManager();

