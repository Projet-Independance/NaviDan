document.addEventListener('DOMContentLoaded', async () => {
  const bookmarksListEl = document.getElementById('bookmarks-list');
  const btnAddBookmark = document.getElementById('btn-add-bookmark');

  async function renderBookmarks() {
    if (!window.bookmarksApi) return;
    const list = await window.bookmarksApi.getBookmarks();
    bookmarksListEl.innerHTML = '';

    if (!list || list.length === 0) {
      bookmarksListEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔖</span>
          <span>Aucun favori enregistré</span>
        </div>
      `;
      return;
    }

    list.forEach(bm => {
      const row = document.createElement('div');
      row.className = 'list-item';
      
      row.innerHTML = `
        <div class="item-left">
          <span class="item-title" title="${bm.title}">🔖 ${bm.title}</span>
          <span class="item-url">${bm.url}</span>
        </div>
        <button class="delete-btn-sm" data-url="${bm.url}" title="Supprimer">✕</button>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn-sm')) {
          e.stopPropagation();
          window.bookmarksApi.removeBookmark(bm.url).then(() => renderBookmarks());
          return;
        }
        window.bookmarksApi.navigateTo(bm.url, true);
      });

      row.addEventListener('auxclick', (e) => {
        if (e.button === 1) { // Middle click
          window.bookmarksApi.navigateTo(bm.url, true);
        }
      });

      bookmarksListEl.appendChild(row);
    });
  }

  btnAddBookmark.addEventListener('click', async () => {
    await window.bookmarksApi.addCurrentPage();
    renderBookmarks();
  });

  await renderBookmarks();
});

