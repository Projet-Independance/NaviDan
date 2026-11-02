document.addEventListener('DOMContentLoaded', async () => {
  const adsStatusText = document.getElementById('ads-status-text');
  const btnToggleAds = document.getElementById('btn-toggle-ads');
  const shieldIconBadge = document.getElementById('shield-icon-badge');

  const trackersStatusText = document.getElementById('trackers-status-text');
  const btnToggleTrackers = document.getElementById('btn-toggle-trackers');
  const trackerIconBadge = document.getElementById('tracker-icon-badge');

  const blockedCountText = document.getElementById('blocked-count-text');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const linkPrivacy = document.getElementById('link-privacy');

  async function refreshUI() {
    if (!window.shieldApi) return;
    const data = await window.shieldApi.getSiteData();
    if (!data) return;

    // Ads state
    if (data.adsEnabled) {
      adsStatusText.textContent = 'Bloqueur de publicités activé sur ce site';
      adsStatusText.classList.remove('disabled');
      btnToggleAds.textContent = 'Désactiver sur ce site';
      shieldIconBadge.classList.add('active');
    } else {
      adsStatusText.textContent = 'Bloqueur de publicités désactivé sur ce site';
      adsStatusText.classList.add('disabled');
      btnToggleAds.textContent = 'Activer sur ce site';
      shieldIconBadge.classList.remove('active');
    }

    // Trackers state
    if (data.trackersEnabled) {
      trackersStatusText.textContent = 'Blocage des traqueurs activé sur ce site';
      trackersStatusText.classList.remove('disabled');
      btnToggleTrackers.textContent = 'Désactiver sur ce site';
      trackerIconBadge.classList.add('active');
    } else {
      trackersStatusText.textContent = 'Blocage des traqueurs désactivé sur ce site';
      trackersStatusText.classList.add('disabled');
      btnToggleTrackers.textContent = 'Activer sur ce site';
      trackerIconBadge.classList.remove('active');
    }

    // Stats
    const count = data.siteBlockedCount || 0;
    const domain = data.domain || 'cette page';
    blockedCountText.textContent = count > 0 
      ? `${count} élément${count > 1 ? 's' : ''} bloqué${count > 1 ? 's' : ''} sur ${domain}`
      : `0 élément bloqué sur ${domain}`;
  }

  btnToggleAds.addEventListener('click', async () => {
    await window.shieldApi.toggleAds();
    refreshUI();
  });

  btnToggleTrackers.addEventListener('click', async () => {
    await window.shieldApi.toggleTrackers();
    refreshUI();
  });

  btnOpenSettings.addEventListener('click', () => {
    window.shieldApi.openSettings();
  });

  linkPrivacy.addEventListener('click', (e) => {
    e.preventDefault();
    window.shieldApi.openPrivacyInfo();
  });

  await refreshUI();
});

