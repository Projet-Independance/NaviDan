document.addEventListener('DOMContentLoaded', async () => {
  const totalStorageVal = document.getElementById('total-storage-val');
  const totalStorageUnit = document.getElementById('total-storage-unit');
  const dlStorageVal = document.getElementById('dl-storage-val');
  const cookiesCountVal = document.getElementById('cookies-count-val');

  const cacheSizeHint = document.getElementById('cache-size-hint');
  const cookiesSizeHint = document.getElementById('cookies-size-hint');
  const historySizeHint = document.getElementById('history-size-hint');
  const dlSizeHint = document.getElementById('dl-size-hint');

  const chkCache = document.getElementById('chk-cache');
  const chkCookies = document.getElementById('chk-cookies');
  const chkHistory = document.getElementById('chk-history');
  const chkDownloads = document.getElementById('chk-downloads');

  const btnStartCleaning = document.getElementById('btn-start-cleaning');
  const presetMin = document.getElementById('preset-min');
  const presetMed = document.getElementById('preset-med');
  const presetMax = document.getElementById('preset-max');

  if (!window.cleanerApi) return;

  async function loadStats() {
    const stats = await window.cleanerApi.getStorageStats();
    if (!stats) return;

    // Total cache size
    const cacheMb = (stats.cacheSizeBytes / (1024 * 1024)).toFixed(1);
    if (parseFloat(cacheMb) >= 1024) {
      totalStorageVal.textContent = (parseFloat(cacheMb) / 1024).toFixed(1);
      totalStorageUnit.textContent = 'GB';
    } else {
      totalStorageVal.textContent = cacheMb;
      totalStorageUnit.textContent = 'MB';
    }

    cacheSizeHint.textContent = `${cacheMb} MB`;
    dlStorageVal.textContent = `${(stats.downloadSizeBytes / (1024 * 1024)).toFixed(0)} MB`;
    dlSizeHint.textContent = `${stats.downloadsCount} fichiers`;
    cookiesCountVal.textContent = stats.cookiesCount || 0;
    cookiesSizeHint.textContent = `${stats.cookiesCount} cookies`;
    historySizeHint.textContent = `${stats.historyCount} URLs`;
  }

  // Presets handling
  presetMin.addEventListener('click', () => {
    setActivePreset(presetMin);
    chkCache.checked = true;
    chkCookies.checked = false;
    chkHistory.checked = false;
    chkDownloads.checked = false;
  });

  presetMed.addEventListener('click', () => {
    setActivePreset(presetMed);
    chkCache.checked = true;
    chkCookies.checked = true;
    chkHistory.checked = false;
    chkDownloads.checked = false;
  });

  presetMax.addEventListener('click', () => {
    setActivePreset(presetMax);
    chkCache.checked = true;
    chkCookies.checked = true;
    chkHistory.checked = true;
    chkDownloads.checked = true;
  });

  function setActivePreset(btn) {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // Cleaning action
  btnStartCleaning.addEventListener('click', async () => {
    btnStartCleaning.textContent = 'Nettoyage en cours...';
    btnStartCleaning.disabled = true;

    await window.cleanerApi.cleanStorage({
      cache: chkCache.checked,
      cookies: chkCookies.checked,
      history: chkHistory.checked,
      downloads: chkDownloads.checked
    });

    setTimeout(() => {
      btnStartCleaning.textContent = '✓ Nettoyage terminé !';
      loadStats();
      setTimeout(() => {
        btnStartCleaning.textContent = 'Commencer à nettoyer';
        btnStartCleaning.disabled = false;
      }, 2000);
    }, 600);
  });

  await loadStats();
});

