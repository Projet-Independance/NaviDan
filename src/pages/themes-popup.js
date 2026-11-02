document.addEventListener('DOMContentLoaded', async () => {
  if (!window.themesApi) return;

  const currentTheme = await window.themesApi.getThemeSettings();

  // Set active cards
  document.querySelectorAll('.theme-card').forEach(card => {
    if (card.getAttribute('data-preset') === (currentTheme.preset || 'cyber-dark')) {
      card.classList.add('active');
    }

    card.addEventListener('click', async () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const preset = card.getAttribute('data-preset');
      await window.themesApi.saveThemeSettings({ preset });
    });
  });

  // Set active accent
  document.querySelectorAll('.accent-circle').forEach(circle => {
    if (circle.getAttribute('data-color') === (currentTheme.accentColor || '#3b82f6')) {
      circle.classList.add('active');
    }

    circle.addEventListener('click', async () => {
      document.querySelectorAll('.accent-circle').forEach(c => c.classList.remove('active'));
      circle.classList.add('active');
      const accentColor = circle.getAttribute('data-color');
      await window.themesApi.saveThemeSettings({ accentColor });
    });
  });
});

