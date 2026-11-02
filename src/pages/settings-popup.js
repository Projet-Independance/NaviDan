document.addEventListener('DOMContentLoaded', async () => {
  const settingTheme = document.getElementById('setting-theme');
  const settingEngine = document.getElementById('setting-engine');
  const settingAdblock = document.getElementById('setting-adblock');
  const settingBookmarksBar = document.getElementById('setting-bookmarks-bar');

  if (!window.settingsApi) return;
  const currentSettings = await window.settingsApi.getSettings();

  if (settingTheme) settingTheme.value = currentSettings.theme || 'dark';
  if (settingEngine) settingEngine.value = currentSettings.searchEngine || 'google';
  if (settingAdblock) settingAdblock.checked = currentSettings.adblockEnabled !== false;
  if (settingBookmarksBar) settingBookmarksBar.checked = currentSettings.showBookmarksBar !== false;

  settingTheme.addEventListener('change', async (e) => {
    await window.settingsApi.updateSettings({ theme: e.target.value });
  });

  settingEngine.addEventListener('change', async (e) => {
    await window.settingsApi.updateSettings({ searchEngine: e.target.value });
  });

  settingAdblock.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await window.settingsApi.toggleAdblock(enabled);
    await window.settingsApi.updateSettings({ adblockEnabled: enabled });
  });

  settingBookmarksBar.addEventListener('change', async (e) => {
    await window.settingsApi.updateSettings({ showBookmarksBar: e.target.checked });
  });
});

