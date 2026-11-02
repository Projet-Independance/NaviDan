document.addEventListener('DOMContentLoaded', async () => {
  const historyListEl = document.getElementById('history-list');
  const searchInput = document.getElementById('history-search');
  const btnClearHistory = document.getElementById('btn-clear-history');

  async function renderHistory(filter = '') {
    if (!window.historyApi) return;
    const list = await window.historyApi.getHistory();
    historyListEl.innerHTML = '';

    const filtered = filter 
      ? list.filter(h => h.title.toLowerCase().includes(filter.toLowerCase()) || h.url.toLowerCase().includes(filter.toLowerCase()))
      : list;

    if (!filtered || filtered.length === 0) {
      historyListEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🕒</span>
          <span>Aucun historique disponible</span>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const timeStr = new Date(item.visitedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      row.innerHTML = `
        <div class="item-left">
          <span class="item-title" title="${item.title}">${item.title}</span>
          <span class="item-url">${item.url}</span>
        </div>
        <span class="item-time">${timeStr}</span>
      `;

      row.addEventListener('click', () => {
        window.historyApi.navigateTo(item.url, true);
      });

      row.addEventListener('auxclick', (e) => {
        if (e.button === 1) { // Middle click
          window.historyApi.navigateTo(item.url, true);
        }
      });

      historyListEl.appendChild(row);
    });
  }

  searchInput.addEventListener('input', () => {
    renderHistory(searchInput.value.trim());
  });

  btnClearHistory.addEventListener('click', async () => {
    if (confirm("Effacer tout l'historique de navigation ?")) {
      await window.historyApi.clearHistory();
      renderHistory();
    }
  });

  await renderHistory();
});

