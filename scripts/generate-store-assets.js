const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const storeAssetsDir = path.join(__dirname, '..', 'store-assets');
  if (!fs.existsSync(storeAssetsDir)) {
    fs.mkdirSync(storeAssetsDir, { recursive: true });
  }

  // 1. Generate Icons (300x300, 150x150, 71x71)
  const sourceIconPath = 'C:/Users/cata_/.gemini/antigravity/brain/276354cd-4491-48ac-badd-60d10749974a/.user_uploaded/media_1793978191569_67f2a15f.png';
  const iconInput = fs.existsSync(sourceIconPath) ? sourceIconPath : path.join(__dirname, '..', 'assets', 'icon.png');
  
  console.log('Generating icons from:', iconInput);
  const baseImg = nativeImage.createFromPath(iconInput);

  const iconSizes = [
    { filename: 'icon-300x300.png', size: 300 },
    { filename: 'icon-150x150.png', size: 150 },
    { filename: 'icon-71x71.png', size: 71 }
  ];

  for (const { filename, size } of iconSizes) {
    const resized = baseImg.resize({ width: size, height: size, quality: 'best' });
    const outPath = path.join(storeAssetsDir, filename);
    fs.writeFileSync(outPath, resized.toPNG());
    console.log(`[ICON] ${filename} created (${size}x${size})`);
  }

  // Convert icon to base64 for embedding in screenshots HTML
  const iconBase64 = 'data:image/png;base64,' + baseImg.resize({ width: 64, height: 64, quality: 'best' }).toPNG().toString('base64');

  // 2. Generate 4 High-Fidelity Screenshots at 1366 x 768
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const generateHtml = (sceneId) => `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { width: 1366px; height: 768px; overflow: hidden; background: #0b0f19; color: #f1f5f9; display: flex; flex-direction: column; }
  
  /* Top Chrome */
  .chrome { background: #131722; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  
  /* Titlebar */
  .titlebar { height: 38px; display: flex; align-items: center; padding: 0 12px; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #3b82f6; }
  .brand img { width: 18px; height: 18px; border-radius: 4px; }
  
  .tabs-strip { display: flex; align-items: center; gap: 4px; margin-left: 20px; flex: 1; }
  .tab { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 5px 14px; border-radius: 6px; font-size: 12px; color: #94a3b8; }
  .tab.active { background: #1e2433; color: #f1f5f9; border-top: 2px solid #3b82f6; font-weight: 500; }
  .tab .tab-close { font-size: 11px; opacity: 0.6; margin-left: 6px; }
  .btn-icon-tab { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px; border-radius: 4px; }
  
  .window-controls { display: flex; gap: 14px; color: #64748b; font-size: 12px; }

  /* Toolbar */
  .toolbar { height: 46px; display: flex; align-items: center; padding: 0 12px; gap: 10px; background: #181d29; }
  .nav-btn { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #94a3b8; background: transparent; font-size: 14px; }
  
  .omnibox { flex: 1; height: 32px; background: #0e121b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; padding: 0 12px; font-size: 12.5px; gap: 8px; color: #cbd5e1; }
  .omnibox .badge-secure { color: #10b981; display: flex; align-items: center; gap: 4px; font-weight: 500; font-size: 11px; }
  .omnibox .badge-internal { color: #3b82f6; font-weight: 600; font-size: 11px; }
  .omnibox .url-tail { color: #64748b; }
  
  .toolbar-actions { display: flex; align-items: center; gap: 6px; }
  .btn-ai-sparkle { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(59,130,246,0.3); }

  /* Main Viewport */
  .viewport { flex: 1; position: relative; overflow: hidden; display: flex; }

  /* Scene 1: Dashboard */
  .dashboard { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 25%, #182236 0%, #0a0d16 80%); padding: 20px; }
  .dash-clock { font-size: 64px; font-weight: 700; color: #ffffff; letter-spacing: -1px; text-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  .dash-date { font-size: 15px; color: #3b82f6; font-weight: 600; margin-top: -4px; text-transform: uppercase; letter-spacing: 1px; }
  .dash-search { width: 560px; height: 48px; background: rgba(22,27,34,0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; display: flex; align-items: center; padding: 0 20px; gap: 12px; margin: 36px 0; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
  .dash-search input { flex: 1; background: transparent; border: none; color: white; font-size: 14px; outline: none; }
  .dash-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; width: 620px; }
  .dial-tile { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11.5px; color: #cbd5e1; font-weight: 500; transition: transform 0.2s; }
  .dial-tile .tile-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; }
  .dash-footer-pill { margin-top: 40px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #34d399; font-size: 12px; padding: 6px 16px; border-radius: 20px; font-weight: 500; display: flex; align-items: center; gap: 8px; }

  /* Scene 2: Web Navigation with Shield Popup */
  .web-content { flex: 1; background: #0d1117; padding: 30px 60px; color: #c9d1d9; }
  .repo-header { border-bottom: 1px solid #30363d; padding-bottom: 20px; margin-bottom: 24px; }
  .repo-title { font-size: 22px; color: #58a6ff; font-weight: 600; display: flex; align-items: center; gap: 10px; }
  .repo-badge { font-size: 12px; background: #21262d; border: 1px solid #30363d; border-radius: 12px; padding: 2px 8px; color: #8b949e; }
  .repo-desc { color: #8b949e; margin-top: 8px; font-size: 14px; }
  .repo-stats { display: flex; gap: 20px; margin-top: 14px; font-size: 13px; color: #8b949e; }
  .files-box { border: 1px solid #30363d; border-radius: 6px; background: #161b22; }
  .file-row { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #21262d; font-size: 13px; }
  
  .shield-modal { position: absolute; top: 10px; left: 160px; width: 340px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.7); z-index: 100; overflow: hidden; }
  .shield-head { background: #21262d; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #30363d; }
  .shield-head h3 { font-size: 13.5px; font-weight: 600; color: #f0f6fc; display: flex; align-items: center; gap: 8px; }
  .shield-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .shield-card { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px; }
  .shield-stat-num { font-size: 20px; font-weight: 700; color: #34d399; }
  .shield-stat-label { font-size: 12px; color: #8b949e; margin-top: 2px; }
  .shield-toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; }
  .pill-on { background: #238636; color: white; padding: 2px 8px; border-radius: 10px; font-weight: 600; font-size: 10.5px; }

  /* Scene 3: NaviAI Sidebar */
  .ai-layout { display: flex; width: 100%; height: 100%; }
  .doc-view { flex: 1; background: #111827; padding: 30px 40px; color: #e5e7eb; overflow: hidden; }
  .doc-h1 { font-size: 26px; font-weight: 700; margin-bottom: 12px; color: #60a5fa; }
  .doc-lead { font-size: 14px; line-height: 1.6; color: #9ca3af; margin-bottom: 20px; }
  .code-demo { background: #030712; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12.5px; color: #a5f3fc; line-height: 1.5; }
  
  .ai-sidebar { width: 440px; background: #131722; border-left: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; }
  .ai-head { height: 50px; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 16px; display: flex; align-items: center; justify-content: space-between; }
  .ai-title { font-weight: 700; font-size: 14px; background: linear-gradient(135deg, #60a5fa, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: flex; align-items: center; gap: 8px; }
  .ai-badge { background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.3); color: #93c5fd; padding: 2px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 600; }
  .ai-messages { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
  .msg-user { align-self: flex-end; background: #2563eb; color: white; padding: 10px 14px; border-radius: 14px 14px 2px 14px; font-size: 12.5px; max-width: 85%; }
  .msg-bot { align-self: flex-start; background: #1e2433; border: 1px solid rgba(255,255,255,0.08); padding: 12px 14px; border-radius: 14px 14px 14px 2px; font-size: 12px; line-height: 1.5; color: #e2e8f0; max-width: 90%; }
  .msg-bot code { background: #0b0f19; padding: 2px 5px; border-radius: 4px; color: #67e8f9; font-size: 11.5px; }
  .ai-input-box { padding: 12px; border-top: 1px solid rgba(255,255,255,0.08); background: #181d29; }
  .ai-input { width: 100%; height: 38px; background: #0e121b; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0 12px; color: white; font-size: 12px; }

  /* Scene 4: Settings & Themes */
  .settings-view { width: 100%; height: 100%; background: #0d1117; display: flex; }
  .set-nav { width: 240px; border-right: 1px solid #21262d; padding: 24px 16px; display: flex; flex-direction: column; gap: 6px; }
  .set-nav-item { padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #8b949e; font-weight: 500; display: flex; align-items: center; gap: 10px; }
  .set-nav-item.active { background: #161b22; color: #58a6ff; font-weight: 600; border-left: 3px solid #58a6ff; }
  .set-content { flex: 1; padding: 30px 50px; overflow: hidden; }
  .set-h2 { font-size: 20px; font-weight: 600; color: #f0f6fc; margin-bottom: 20px; }
  .theme-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 30px; }
  .theme-card { border: 2px solid #30363d; border-radius: 10px; padding: 12px; background: #161b22; text-align: center; font-size: 12px; font-weight: 500; color: #c9d1d9; }
  .theme-card.active { border-color: #58a6ff; background: #1f2937; color: white; box-shadow: 0 0 15px rgba(88,166,255,0.3); }
  .theme-preview { height: 44px; border-radius: 6px; margin-bottom: 8px; }
  .sec-card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
  .sec-title { font-size: 13.5px; font-weight: 600; color: #f0f6fc; }
  .sec-desc { font-size: 12px; color: #8b949e; margin-top: 3px; }
</style>
</head>
<body>
  <!-- Top Chrome -->
  <div class="chrome">
    <div class="titlebar">
      <div class="brand">
        <img src="${iconBase64}" alt="NaviDan" />
        <span>NaviDan</span>
      </div>
      <div class="tabs-strip">
        ${sceneId === 1 ? `
          <div class="tab active">
            <span>🏠 Nouvel onglet</span>
            <span class="tab-close">✕</span>
          </div>
          <div class="tab"><span>GitHub - Projet-Independance</span></div>
        ` : sceneId === 2 ? `
          <div class="tab active">
            <span>🛡️ GitHub - Projet-Independance/NaviDan</span>
            <span class="tab-close">✕</span>
          </div>
          <div class="tab"><span>MDN Web Docs</span></div>
        ` : sceneId === 3 ? `
          <div class="tab active">
            <span>📚 JavaScript | MDN Web Docs</span>
            <span class="tab-close">✕</span>
          </div>
          <div class="tab"><span>Nouvel onglet</span></div>
        ` : `
          <div class="tab active">
            <span>⚙️ Paramètres NaviDan</span>
            <span class="tab-close">✕</span>
          </div>
          <div class="tab"><span>Nouvel onglet</span></div>
        `}
        <div class="btn-icon-tab">+</div>
      </div>
      <div class="window-controls">
        <span>—</span>
        <span>▢</span>
        <span>✕</span>
      </div>
    </div>
    
    <div class="toolbar">
      <div class="nav-btn">←</div>
      <div class="nav-btn">→</div>
      <div class="nav-btn">↻</div>
      
      <div class="omnibox">
        ${sceneId === 1 ? `
          <span class="badge-internal">navidan://</span><span>newtab</span>
        ` : sceneId === 2 ? `
          <span class="badge-secure">🔒 Sécurisé</span><span>https://github.com</span><span class="url-tail">/Projet-Independance/NaviDan</span>
        ` : sceneId === 3 ? `
          <span class="badge-secure">🔒 Sécurisé</span><span>https://developer.mozilla.org</span><span class="url-tail">/fr/docs/Web/JavaScript</span>
        ` : `
          <span class="badge-internal">navidan://</span><span>settings</span>
        `}
      </div>
      
      <div class="toolbar-actions">
        <div class="btn-ai-sparkle">✨ NaviAI</div>
        <div class="nav-btn">🛡️</div>
        <div class="nav-btn">⭐</div>
        <div class="nav-btn">⚙️</div>
      </div>
    </div>
  </div>

  <!-- Viewport -->
  <div class="viewport">
    ${sceneId === 1 ? `
      <!-- Scene 1: Dashboard -->
      <div class="dashboard">
        <div class="dash-clock">16:30</div>
        <div class="dash-date">Vendredi 6 Novembre • Mode Ultra-Rapide</div>
        <div class="dash-search">
          <span style="font-size: 16px;">🔍</span>
          <input type="text" value="Rechercher sur le Web en toute confidentialité..." readonly />
          <span style="font-size: 12px; color: #3b82f6; font-weight: 600;">DuckDuckGo ▾</span>
        </div>
        <div class="dash-grid">
          <div class="dial-tile"><div class="tile-icon" style="background:#24292f; color:white;">GH</div><span>GitHub</span></div>
          <div class="dial-tile"><div class="tile-icon" style="background:#ff0000; color:white;">YT</div><span>YouTube</span></div>
          <div class="dial-tile"><div class="tile-icon" style="background:#ff4500; color:white;">RD</div><span>Reddit</span></div>
          <div class="dial-tile"><div class="tile-icon" style="background:#0a84ff; color:white;">W</div><span>Wikipedia</span></div>
          <div class="dial-tile"><div class="tile-icon" style="background:#10a37f; color:white;">AI</div><span>ChatGPT</span></div>
          <div class="dial-tile"><div class="tile-icon" style="background:#1da1f2; color:white;">X</div><span>Twitter</span></div>
        </div>
        <div class="dash-footer-pill">
          <span>🛡️ Bouclier Anti-Traqueurs &amp; Anti-Pubs Actif</span>
          <span>•</span>
          <span>🔒 Chiffrement DPAPI des données</span>
          <span>•</span>
          <span>⚡ Moteur Chromium Souverain</span>
        </div>
      </div>
    ` : sceneId === 2 ? `
      <!-- Scene 2: Navigation & Shield -->
      <div class="web-content">
        <div class="repo-header">
          <div class="repo-title">
            <span>Projet-Independance / NaviDan</span>
            <span class="repo-badge">Public</span>
            <span class="repo-badge" style="color:#34d399; border-color: rgba(52,211,153,0.3);">v1.0.3</span>
          </div>
          <div class="repo-desc">Navigateur web moderne, rapide et ultra-sécurisé avec blocage natif des traqueurs et assistant IA.</div>
          <div class="repo-stats">
            <span>⭐ 142 étoiles</span>
            <span>🍴 28 forks</span>
            <span>📦 Electron 45 + Chromium</span>
            <span>🛡️ Bouclier AdBlock intégré</span>
          </div>
        </div>
        <div class="files-box">
          <div class="file-row"><span>📁 src/main/</span><span style="color:#8b949e;">Moteur Electron DPAPI sécurisé</span></div>
          <div class="file-row"><span>📁 src/renderer/</span><span style="color:#8b949e;">Interface tactile &amp; desktop moderne</span></div>
          <div class="file-row"><span>📁 src/mobile/</span><span style="color:#8b949e;">Support Android WebView natif</span></div>
          <div class="file-row"><span>📄 package.json</span><span style="color:#8b949e;">Version 1.0.3 release</span></div>
        </div>
      </div>
      <!-- Floating Shield -->
      <div class="shield-modal">
        <div class="shield-head">
          <h3>🛡️ Bouclier NaviDan</h3>
          <span class="pill-on">Actif</span>
        </div>
        <div class="shield-body">
          <div class="shield-card" style="display: flex; justify-content: space-around; text-align: center;">
            <div>
              <div class="shield-stat-num">48</div>
              <div class="shield-stat-label">Traqueurs bloqués</div>
            </div>
            <div style="border-left: 1px solid #30363d;"></div>
            <div>
              <div class="shield-stat-num" style="color: #60a5fa;">19</div>
              <div class="shield-stat-label">Pubs éliminées</div>
            </div>
          </div>
          <div class="shield-toggle-row">
            <span>Blocage strict des traceurs tiers</span>
            <span class="pill-on">OUI</span>
          </div>
          <div class="shield-toggle-row">
            <span>Protection anti-fingerprinting</span>
            <span class="pill-on">OUI</span>
          </div>
          <div class="shield-toggle-row">
            <span>HTTPS Strict Forcé</span>
            <span class="pill-on">OUI</span>
          </div>
        </div>
      </div>
    ` : sceneId === 3 ? `
      <!-- Scene 3: NaviAI Assistant -->
      <div class="ai-layout">
        <div class="doc-view">
          <div class="doc-h1">JavaScript Asynchrone Moderne</div>
          <div class="doc-lead">Guide complet sur la gestion des tâches asynchrones, des Promises, de l'Event Loop et des Web Workers dans les applications haute performance.</div>
          <div class="code-demo">
            // Exemple : Traitement lourd délégué au Web Worker<br>
            const worker = new Worker('compute.worker.js');<br>
            worker.postMessage({ data: largeDataset });<br>
            worker.onmessage = (event) =&gt; {<br>
            &nbsp;&nbsp;console.log('Résultat sans saccade UI:', event.data);<br>
            };
          </div>
        </div>
        <div class="ai-sidebar">
          <div class="ai-head">
            <div class="ai-title">✨ NaviAI Copilot</div>
            <div class="ai-badge">Gemini 2.5 Pro</div>
          </div>
          <div class="ai-messages">
            <div class="msg-user">Résume-moi l'intérêt des Web Workers pour une application fluide ?</div>
            <div class="msg-bot">
              Les <b>Web Workers</b> permettent d'exécuter du JavaScript en tâche de fond sur un thread isolé :<br><br>
              • <b>Zéro gel de l'UI</b> : L'Event Loop principal reste à 60 FPS constants.<br>
              • <b>Calcul parallèle</b> : Idéal pour chiffrement local, parsing lourd et flux vidéo.<br>
              • <b>Communication sécurisée</b> : Messages sérialisés via <code>postMessage()</code>.
            </div>
            <div class="msg-user">Peux-tu me générer le squelette du worker ?</div>
            <div class="msg-bot">
              Bien sûr ! Voici l'implémentation standard prête à l'emploi avec gestion d'erreurs intégrée...
            </div>
          </div>
          <div class="ai-input-box">
            <input class="ai-input" type="text" value="Demander une explication, un résumé ou du code..." readonly />
          </div>
        </div>
      </div>
    ` : `
      <!-- Scene 4: Settings & Themes -->
      <div class="settings-view">
        <div class="set-nav">
          <div class="set-nav-item active">🎨 Thèmes &amp; Apparence</div>
          <div class="set-nav-item">🔒 Confidentialité &amp; Sécurité</div>
          <div class="set-nav-item">✨ NaviAI Configuration</div>
          <div class="set-nav-item">🔍 Moteur de recherche</div>
          <div class="set-nav-item">⚡ Système &amp; Performances</div>
          <div class="set-nav-item">ℹ️ À propos de NaviDan</div>
        </div>
        <div class="set-content">
          <div class="set-h2">Palette de Thèmes Personnalisés</div>
          <div class="theme-grid">
            <div class="theme-card active">
              <div class="theme-preview" style="background: linear-gradient(135deg, #0b0f19, #1e2433);"></div>
              <span>Cyber Dark (Défaut)</span>
            </div>
            <div class="theme-card">
              <div class="theme-preview" style="background: linear-gradient(135deg, #161224, #a855f7);"></div>
              <span>Tokyo Night</span>
            </div>
            <div class="theme-card">
              <div class="theme-preview" style="background: linear-gradient(135deg, #071727, #06b6d4);"></div>
              <span>Ocean Blue</span>
            </div>
            <div class="theme-card">
              <div class="theme-preview" style="background: linear-gradient(135deg, #051a0e, #10b981);"></div>
              <span>Matrix Green</span>
            </div>
          </div>

          <div class="set-h2">Sécurité &amp; Données Souveraines</div>
          <div class="sec-card">
            <div>
              <div class="sec-title">Chiffrement matériel des mots de passe</div>
              <div class="sec-desc">Protection Windows DPAPI via safeStorage matériel au repos</div>
            </div>
            <span class="pill-on" style="background:#2563eb;">ACTIF</span>
          </div>
          <div class="sec-card">
            <div>
              <div class="sec-title">Zéro Télémétrie &amp; Zéro Pistage</div>
              <div class="sec-desc">Aucune donnée de navigation n'est transmise à l'extérieur</div>
            </div>
            <span class="pill-on">GARANTI</span>
          </div>
          <div class="sec-card">
            <div>
              <div class="sec-title">Protection contre le Fingerprinting Canvas/Audio</div>
              <div class="sec-desc">Bruit aléatoire cryptographique pour empêcher l'identification unique</div>
            </div>
            <span class="pill-on">ACTIF</span>
          </div>
        </div>
      </div>
    `}
  </div>
</body>
</html>
  `;

  const screenshotConfigs = [
    { id: 1, filename: 'screenshot-1-nouvel-onglet-1366x768.png', label: 'Nouvel Onglet & Recherche Rapide' },
    { id: 2, filename: 'screenshot-2-bouclier-protection-1366x768.png', label: 'Navigation Web & Bouclier Anti-Traqueurs' },
    { id: 3, filename: 'screenshot-3-assistant-naviai-1366x768.png', label: 'Assistant Intelligent NaviAI Intégré' },
    { id: 4, filename: 'screenshot-4-parametres-themes-1366x768.png', label: 'Thèmes Personnalisés & Confidentialité' }
  ];

  for (const item of screenshotConfigs) {
    const htmlContent = generateHtml(item.id);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    // Wait for rendering
    await new Promise(r => setTimeout(r, 600));

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1366, height: 768 });
    const outPath = path.join(storeAssetsDir, item.filename);
    fs.writeFileSync(outPath, image.toPNG());
    console.log(`[SCREENSHOT] ${item.filename} (1366x768) - ${item.label}`);
  }

  console.log('--- ALL STORE ASSETS GENERATED SUCCESSFULLY ---');
  app.quit();
});

