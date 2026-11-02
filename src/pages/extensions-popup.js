document.addEventListener('DOMContentLoaded', async () => {
  let currentLang = 'fr';
  if (window.extensionsApi && typeof window.extensionsApi.getSettings === 'function') {
    try {
      const s = await window.extensionsApi.getSettings();
      if (s && s.language) currentLang = s.language;
    } catch (_) {}
  }
  if (window.NaviI18n) {
    window.NaviI18n.applyToDOM(document, currentLang);
  }
  const t = (k) => window.NaviI18n ? window.NaviI18n.t(k, currentLang) : k;

  const tabInstalledBtn = document.getElementById('tab-btn-installed');
  const tabCatalogBtn = document.getElementById('tab-btn-catalog');
  const tabInstalled = document.getElementById('tab-installed');
  const tabCatalog = document.getElementById('tab-catalog');
  const installedCount = document.getElementById('installed-count');
  const installedList = document.getElementById('installed-list');
  const catalogList = document.getElementById('catalog-list');
  const inputWebStore = document.getElementById('input-webstore');
  const btnInstallWebStore = document.getElementById('btn-install-webstore');
  const btnInstallFolder = document.getElementById('btn-install-folder');
  const btnClose = document.getElementById('btn-close');
  const statusText = document.getElementById('status-text');

  if (inputWebStore) inputWebStore.placeholder = t('ext_install_input_placeholder');
  if (btnInstallWebStore) btnInstallWebStore.textContent = t('ext_install_action');
  if (tabInstalledBtn) {
    tabInstalledBtn.innerHTML = `${t('ext_tab_my')} <span id="installed-count" class="tab-badge">0</span>`;
  }
  if (tabCatalogBtn) {
    tabCatalogBtn.innerHTML = `${t('ext_tab_catalog')} <span class="tab-badge-hot">${currentLang === 'fr' ? 'POPULAIRE' : 'POPULAR'}</span>`;
  }

  function setStatus(msg, type = 'normal') {
    statusText.textContent = msg;
    statusText.className = 'status-text ' + type;
  }

  // Close button
  btnClose?.addEventListener('click', () => {
    window.extensionsApi?.closePopup();
  });

  // Tab switching
  tabInstalledBtn?.addEventListener('click', () => {
    tabInstalledBtn.classList.add('active');
    tabCatalogBtn.classList.remove('active');
    tabInstalled.classList.add('active');
    tabCatalog.classList.remove('active');
  });

  tabCatalogBtn?.addEventListener('click', () => {
    tabCatalogBtn.classList.add('active');
    tabInstalledBtn.classList.remove('active');
    tabCatalog.classList.add('active');
    tabInstalled.classList.remove('active');
  });

  // Render Installed List
  async function renderInstalled() {
    try {
      const list = await window.extensionsApi.getExtensions();
      installedCount.textContent = list.length;

      if (!list || list.length === 0) {
        installedList.innerHTML = `
          <div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <p>${t('ext_no_installed')}<br>${t('ext_no_installed_hint')}</p>
          </div>
        `;
        return;
      }

      installedList.innerHTML = '';
      list.forEach(ext => {
        const card = document.createElement('div');
        card.className = 'ext-card';

        const iconHtml = ext.iconData
          ? `<img class="ext-icon-img" src="${ext.iconData}" alt="" />`
          : `<span class="ext-icon-fallback">🧩</span>`;

        card.innerHTML = `
          <div class="ext-icon-wrap">${iconHtml}</div>
          <div class="ext-info">
            <div class="ext-name-row">
              <span class="ext-name" title="${ext.name}">${ext.name}</span>
              <span class="ext-version">v${ext.version}</span>
            </div>
            <div class="ext-desc" title="${ext.description || ''}">${ext.description || 'Extension Chromium installée.'}</div>
          </div>
          <div class="ext-actions">
            <label class="switch" title="Activer / Désactiver">
              <input type="checkbox" ${ext.enabled ? 'checked' : ''} data-id="${ext.id}" class="toggle-ext" />
              <span class="slider"></span>
            </label>
            <button class="btn-ext-delete" data-id="${ext.id}" title="Supprimer">✕</button>
          </div>
        `;

        // Toggle listener
        card.querySelector('.toggle-ext').addEventListener('change', async (e) => {
          const checked = e.target.checked;
          setStatus(`Mise à jour de ${ext.name}...`);
          await window.extensionsApi.toggleExtension(ext.id, checked);
          setStatus(`${ext.name} ${checked ? 'activée' : 'désactivée'}.`, 'success');
        });

        // Delete listener with non-blocking 2-step inline confirm
        const deleteBtn = card.querySelector('.btn-ext-delete');
        let confirmTimeout = null;

        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!deleteBtn.classList.contains('confirming')) {
            deleteBtn.classList.add('confirming');
            deleteBtn.textContent = t('ext_uninstall_confirm');
            confirmTimeout = setTimeout(() => {
              deleteBtn.classList.remove('confirming');
              deleteBtn.textContent = '✕';
            }, 3000);
            return;
          }

          if (confirmTimeout) clearTimeout(confirmTimeout);
          deleteBtn.disabled = true;
          deleteBtn.textContent = '...';
          setStatus(`Désinstallation de ${ext.name}...`);

          try {
            await window.extensionsApi.uninstallExtension(ext.id);
            await refreshAll();
            setStatus(`${ext.name} désinstallée.`, 'success');
          } catch (err) {
            console.error('Erreur désinstallation:', err);
            setStatus(`Erreur: ${err.message}`, 'error');
            deleteBtn.disabled = false;
            deleteBtn.classList.remove('confirming');
            deleteBtn.textContent = '✕';
          }
        });

        installedList.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      setStatus('Erreur chargement: ' + err.message, 'error');
    }
  }

  // Category Filter in Catalog
  let selectedCategory = 'all';
  const filterButtons = document.querySelectorAll('.cat-filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-cat');
      renderCatalog();
    });
  });

  // Render Catalog
  async function renderCatalog() {
    try {
      const catalog = await window.extensionsApi.getCatalog();
      catalogList.innerHTML = '';

      const items = selectedCategory === 'all'
        ? catalog
        : catalog.filter(c => c.category.toLowerCase().includes(selectedCategory.toLowerCase()) || (c.badge && c.badge.toLowerCase().includes(selectedCategory.toLowerCase())));

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'ext-card';

        card.innerHTML = `
          <div class="ext-icon-wrap">
            <span class="ext-icon-fallback">✨</span>
          </div>
          <div class="ext-info">
            <div class="ext-name-row">
              <span class="ext-name">${item.name}</span>
              <span class="cat-badge">${item.category}</span>
            </div>
            <div class="ext-desc">${item.desc}</div>
          </div>
          <div class="ext-actions">
            <button class="btn-cat-install" data-id="${item.id}" ${item.isInstalled ? 'disabled' : ''}>
              ${item.isInstalled ? '✓ Installée' : '+ Installer'}
            </button>
          </div>
        `;

        const btnInstall = card.querySelector('.btn-cat-install');
        if (!item.isInstalled) {
          btnInstall.addEventListener('click', async () => {
            btnInstall.disabled = true;
            btnInstall.textContent = '⏳ Téléchargement...';
            setStatus(`Téléchargement de ${item.name} depuis le Chrome Web Store...`);

            try {
              await window.extensionsApi.installFromWebStore(item.id);
              setStatus(`${item.name} installée avec succès !`, 'success');
              await refreshAll();
            } catch (err) {
              console.error(err);
              setStatus(`Échec installation: ${err.message}`, 'error');
              btnInstall.disabled = false;
              btnInstall.textContent = '+ Installer';
            }
          });
        }

        catalogList.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      setStatus('Erreur catalogue: ' + err.message, 'error');
    }
  }

  async function refreshAll() {
    await Promise.all([renderInstalled(), renderCatalog()]);
  }

  // WebStore direct install
  btnInstallWebStore?.addEventListener('click', async () => {
    const val = inputWebStore.value.trim();
    if (!val) {
      setStatus('Veuillez entrer une URL ou un ID.', 'error');
      return;
    }

    btnInstallWebStore.disabled = true;
    btnInstallWebStore.textContent = 'Installation...';
    setStatus('Téléchargement du package CRX...');

    try {
      const ext = await window.extensionsApi.installFromWebStore(val);
      inputWebStore.value = '';
      setStatus(`Extension "${ext.name}" installée avec succès !`, 'success');
      await refreshAll();
    } catch (err) {
      console.error(err);
      setStatus(`Erreur: ${err.message}`, 'error');
    } finally {
      btnInstallWebStore.disabled = false;
      btnInstallWebStore.textContent = 'Installer';
    }
  });

  inputWebStore?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnInstallWebStore.click();
    }
  });

  // Local folder install
  btnInstallFolder?.addEventListener('click', async () => {
    setStatus('Sélection du dossier...');
    try {
      const ext = await window.extensionsApi.installFromFolder();
      if (ext) {
        setStatus(`Extension locale "${ext.name}" chargée !`, 'success');
        await refreshAll();
      } else {
        setStatus('Sélection annulée.');
      }
    } catch (err) {
      console.error(err);
      setStatus(`Erreur: ${err.message}`, 'error');
    }
  });

  // Auto-refresh when background changes
  window.extensionsApi?.onUpdated?.(() => {
    refreshAll();
  });

  await refreshAll();
  setStatus('Prêt');
});

