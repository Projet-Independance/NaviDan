document.addEventListener('DOMContentLoaded', async () => {
  const historyListEl = document.getElementById('history-list');
  const searchInput = document.getElementById('history-search');
  const btnClearHistory = document.getElementById('btn-clear-history');

  async function renderHistory(filter = '') {
    if (!window.historyApi) return;
    const list = await window.historyApi.getHistory();
    historyListEl.innerHTML = '';

    const filtered = filter 
      ? list.filter(h => (h.title && h.title.toLowerCase().includes(filter.toLowerCase())) || (h.url && h.url.toLowerCase().includes(filter.toLowerCase())))
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
      const timeStr = item.visitedAt ? new Date(item.visitedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      
      row.innerHTML = `
        <div class="item-left">
          <span class="item-title" title="${item.title || item.url}">${item.title || item.url}</span>
          <span class="item-url">${item.url}</span>
        </div>
        ${timeStr ? `<span class="item-time">${timeStr}</span>` : ''}
        <button class="delete-btn-sm" title="Supprimer">✕</button>
      `;

      row.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn-sm')) {
          e.stopPropagation();
          await window.historyApi.removeHistory(item.id || item.url);
          renderHistory(searchInput.value.trim());
          return;
        }
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

  let confirmTimeout = null;
  btnClearHistory?.addEventListener('click', async () => {
    if (btnClearHistory.dataset.confirming === 'true') {
      clearTimeout(confirmTimeout);
      btnClearHistory.dataset.confirming = 'false';
      btnClearHistory.classList.remove('confirming');
      btnClearHistory.disabled = true;
      btnClearHistory.textContent = '...';
      await window.historyApi.clearHistory();
      btnClearHistory.disabled = false;
      btnClearHistory.textContent = 'Effacer tout';
      await renderHistory();
      return;
    }

    btnClearHistory.dataset.confirming = 'true';
    btnClearHistory.classList.add('confirming');
    btnClearHistory.textContent = 'Confirmer ?';

    confirmTimeout = setTimeout(() => {
      btnClearHistory.dataset.confirming = 'false';
      btnClearHistory.classList.remove('confirming');
      btnClearHistory.textContent = 'Effacer tout';
    }, 3500);
  });

  await renderHistory();
});
