document.addEventListener('DOMContentLoaded', async () => {
  const settingLanguage = document.getElementById('setting-language');
  const settingTheme = document.getElementById('setting-theme');
  const settingEngine = document.getElementById('setting-engine');
  const settingAdblock = document.getElementById('setting-adblock');
  const settingBookmarksBar = document.getElementById('setting-bookmarks-bar');

  if (!window.settingsApi) return;
  const currentSettings = await window.settingsApi.getSettings();

  const currentLang = currentSettings.language || 'fr';
  if (settingLanguage) settingLanguage.value = currentLang;
  if (window.NaviI18n) {
    window.NaviI18n.applyToDOM(document, currentLang);
  }

  if (settingTheme) settingTheme.value = currentSettings.theme || 'dark';
  if (settingEngine) settingEngine.value = currentSettings.searchEngine || 'google';
  if (settingAdblock) settingAdblock.checked = currentSettings.adblockEnabled !== false;
  if (settingBookmarksBar) settingBookmarksBar.checked = currentSettings.showBookmarksBar !== false;

  settingLanguage?.addEventListener('change', async (e) => {
    const lang = e.target.value;
    if (window.NaviI18n) {
      window.NaviI18n.applyToDOM(document, lang);
    }
    await window.settingsApi.updateSettings({ language: lang });
  });

  settingTheme?.addEventListener('change', async (e) => {
    await window.settingsApi.updateSettings({ theme: e.target.value });
  });

  settingEngine?.addEventListener('change', async (e) => {
    await window.settingsApi.updateSettings({ searchEngine: e.target.value });
  });

  settingAdblock?.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await window.settingsApi.toggleAdblock(enabled);
    await window.settingsApi.updateSettings({ adblockEnabled: enabled });
  });

  settingBookmarksBar?.addEventListener('change', async (e) => {
    await window.settingsApi.updateSettings({ showBookmarksBar: e.target.checked });
  });

  // --- Updater Section ---
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const updaterStatusLabel = document.getElementById('updater-status-label');
  const updaterVersionLabel = document.getElementById('updater-version-label');
  const updaterProgressContainer = document.getElementById('updater-progress-container');
  const updaterProgressBar = document.getElementById('updater-progress-bar');

  let pendingUpdate = null;
  let updateReadyToInstall = false;

  if (updaterStatusLabel) {
    updaterStatusLabel.textContent = currentLang === 'fr' ? 'À jour' : 'Up to date';
  }

  btnCheckUpdate?.addEventListener('click', async () => {
    if (updateReadyToInstall) {
      btnCheckUpdate.disabled = true;
      btnCheckUpdate.textContent = currentLang === 'fr' ? 'Relance...' : 'Restarting...';
      await window.settingsApi.installUpdate();
      return;
    }

    if (pendingUpdate && pendingUpdate.asset) {
      btnCheckUpdate.disabled = true;
      updaterStatusLabel.textContent = currentLang === 'fr' ? 'Téléchargement en cours...' : 'Downloading...';
      updaterProgressContainer?.classList.remove('hidden');

      window.settingsApi.onUpdateProgress?.((p) => {
        if (updaterProgressBar) updaterProgressBar.style.width = `${p.percent}%`;
        const mb = (p.transferred / 1048576).toFixed(1);
        const totalMb = (p.total / 1048576).toFixed(1);
        updaterStatusLabel.textContent = `${p.percent}% (${mb} / ${totalMb} Mo)`;
      });

      try {
        await window.settingsApi.downloadUpdate(pendingUpdate.asset.downloadUrl, pendingUpdate.asset.name);
        updateReadyToInstall = true;
        btnCheckUpdate.disabled = false;
        btnCheckUpdate.classList.add('install-btn');
        btnCheckUpdate.textContent = currentLang === 'fr' ? 'Installer & Relancer' : 'Install & Restart';
        updaterStatusLabel.textContent = currentLang === 'fr' ? 'Téléchargement terminé !' : 'Download complete!';
      } catch (err) {
        btnCheckUpdate.disabled = false;
        updaterStatusLabel.textContent = currentLang === 'fr' ? 'Erreur de téléchargement' : 'Download error';
      }
      return;
    }

    // Checking for updates
    btnCheckUpdate.disabled = true;
    btnCheckUpdate.textContent = '...';
    updaterStatusLabel.textContent = currentLang === 'fr' ? 'Vérification en cours...' : 'Checking for updates...';

    const res = await window.settingsApi.checkUpdate();
    btnCheckUpdate.disabled = false;

    if (res && res.currentVersion && updaterVersionLabel) {
      updaterVersionLabel.textContent = `NaviDan v${res.currentVersion}`;
    }

    if (res && res.updateAvailable && res.asset) {
      pendingUpdate = res;
      updaterStatusLabel.textContent = currentLang === 'fr' ? `Version v${res.latestVersion} disponible !` : `Version v${res.latestVersion} available!`;
      btnCheckUpdate.textContent = currentLang === 'fr' ? 'Télécharger' : 'Download';
    } else if (res && res.updateAvailable) {
      updaterStatusLabel.textContent = `v${res.latestVersion} disponible (GitHub)`;
      btnCheckUpdate.textContent = 'Voir';
      btnCheckUpdate.onclick = () => window.open(res.releaseUrl);
    } else {
      updaterStatusLabel.textContent = currentLang === 'fr' ? 'Vous avez la dernière version !' : 'You have the latest version!';
      btnCheckUpdate.textContent = currentLang === 'fr' ? 'Vérifier' : 'Check';
    }
  });
});

