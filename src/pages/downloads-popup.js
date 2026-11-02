document.addEventListener('DOMContentLoaded', async () => {
  const downloadsListEl = document.getElementById('downloads-list');
  const btnOpenFolder = document.getElementById('btn-open-folder');
  const btnClearDownloads = document.getElementById('btn-clear-downloads');
  const btnFooterFolder = document.getElementById('btn-footer-folder');

  async function renderDownloads() {
    if (!window.downloadsApi) return;
    const list = await window.downloadsApi.getDownloads();
    downloadsListEl.innerHTML = '';

    if (!list || list.length === 0) {
      downloadsListEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📥</span>
          <span>Aucun téléchargement récent</span>
        </div>
      `;
      return;
    }

    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'download-card';

      const isDone = item.state === 'completed';
      const isCancelled = item.state === 'cancelled' || item.state === 'interrupted';
      const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : (isDone ? 100 : 0);
      const sizeMb = (item.receivedBytes / (1024 * 1024)).toFixed(1);
      const totalMb = item.totalBytes > 0 ? (item.totalBytes / (1024 * 1024)).toFixed(1) : '?';

      let statusBadge = `<span class="file-badge">${percent}%</span>`;
      if (isDone) {
        statusBadge = `<span class="file-badge completed">Terminé</span>`;
      } else if (isCancelled) {
        statusBadge = `<span class="file-badge cancelled">Annulé</span>`;
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="file-name" title="${item.filename}">${item.filename}</span>
          ${statusBadge}
        </div>
        ${!isDone && !isCancelled ? `
          <div class="progress-track">
            <div class="progress-fill" style="width: ${percent}%"></div>
          </div>
        ` : ''}
        <div class="card-bottom">
          <span>${sizeMb} Mo / ${totalMb} Mo</span>
          <div class="card-actions">
            ${isDone ? `
              <span class="card-action-link open-file">Ouvrir</span>
              <span class="card-action-link show-folder">Dossier</span>
            ` : ''}
          </div>
        </div>
      `;

      const openFileBtn = card.querySelector('.open-file');
      if (openFileBtn) {
        openFileBtn.addEventListener('click', () => window.downloadsApi.openFile(item.path));
      }

      const showFolderBtn = card.querySelector('.show-folder');
      if (showFolderBtn) {
        showFolderBtn.addEventListener('click', () => window.downloadsApi.showInFolder(item.path));
      }

      downloadsListEl.appendChild(card);
    });
  }

  btnOpenFolder.addEventListener('click', () => window.downloadsApi.openDownloadsFolder());
  btnFooterFolder.addEventListener('click', () => window.downloadsApi.openDownloadsFolder());

  btnClearDownloads.addEventListener('click', async () => {
    await window.downloadsApi.clearDownloads();
    renderDownloads();
  });

  // Real-time events
  window.downloadsApi.onDownloadStarted(() => renderDownloads());
  window.downloadsApi.onDownloadUpdated(() => renderDownloads());
  window.downloadsApi.onDownloadDone(() => renderDownloads());

  await renderDownloads();
});

