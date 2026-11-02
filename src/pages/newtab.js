// Live Clock & Date
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.textContent = `${hours}:${minutes}`;

  const dateEl = document.getElementById('date');
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('fr-FR', options);
    dateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }

  const greetingEl = document.getElementById('greeting');
  if (greetingEl) {
    const h = now.getHours();
    if (h >= 5 && h < 12) greetingEl.textContent = 'Bonjour, bonne navigation';
    else if (h >= 12 && h < 18) greetingEl.textContent = 'Bon après-midi sur NaviDdan';
    else greetingEl.textContent = 'Bonne soirée sur NaviDdan';
  }
}

setInterval(updateClock, 1000);
updateClock();

// Default shortcuts fallback in case localStorage / IPC
const DEFAULT_SHORTCUTS = [
  { id: '1', title: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { id: '2', title: 'YouTube', url: 'https://www.youtube.com', icon: '▶' },
  { id: '3', title: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: '4', title: 'Wikipedia', url: 'https://fr.wikipedia.org', icon: '📚' },
  { id: '5', title: 'Twitter / X', url: 'https://x.com', icon: '✖' },
  { id: '6', title: 'Twitch', url: 'https://www.twitch.tv', icon: '👾' },
  { id: '7', title: 'Reddit', url: 'https://www.reddit.com', icon: '🤖' },
  { id: '8', title: 'Amazon', url: 'https://www.amazon.fr', icon: '📦' }
];

function getStoredShortcuts() {
  try {
    const stored = localStorage.getItem('naviddan_shortcuts');
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_SHORTCUTS;
}

function saveStoredShortcuts(list) {
  try {
    localStorage.setItem('naviddan_shortcuts', JSON.stringify(list));
  } catch {}
}

function renderShortcuts() {
  const grid = document.getElementById('shortcuts-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const list = getStoredShortcuts();
  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'shortcut-item';
    card.innerHTML = `
      <div class="shortcut-icon-wrapper">${item.icon || '🌐'}</div>
      <div class="shortcut-title" title="${item.title}">${item.title}</div>
      <button class="delete-shortcut-btn" title="Supprimer">✕</button>
    `;

    // Click to open shortcut in a new tab
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-shortcut-btn')) {
        e.stopPropagation();
        removeShortcut(item.id);
        return;
      }
      window.open(item.url, '_blank');
    });

    // Middle click (wheel click) also opens in a new tab
    card.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        window.open(item.url, '_blank');
      }
    });

    grid.appendChild(card);
  });
}

function removeShortcut(id) {
  let list = getStoredShortcuts();
  list = list.filter(item => item.id !== id);
  saveStoredShortcuts(list);
  renderShortcuts();
}

function addShortcut(title, url) {
  const list = getStoredShortcuts();
  const id = Date.now().toString();
  let icon = '🌐';
  if (url.includes('youtube')) icon = '▶';
  else if (url.includes('github')) icon = '🐙';
  else if (url.includes('google')) icon = '🔍';
  else if (url.includes('twitch')) icon = '👾';

  list.push({ id, title, url, icon });
  saveStoredShortcuts(list);
  renderShortcuts();
}

// Search form handler
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

if (searchForm && searchInput) {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    // Check if query is a URL or domain
    let targetUrl = query;
    const isUrl = /^https?:\/\//i.test(query) || (query.includes('.') && !query.includes(' ') && query.length > 3);
    
    if (isUrl) {
      if (!/^https?:\/\//i.test(query)) {
        targetUrl = 'https://' + query;
      }
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }

    window.location.href = targetUrl;
  });
}

// Modal handling
const addBtn = document.getElementById('add-shortcut-btn');
const modal = document.getElementById('add-modal');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const modalName = document.getElementById('modal-name');
const modalUrl = document.getElementById('modal-url');

if (addBtn && modal) {
  addBtn.addEventListener('click', () => {
    modalName.value = '';
    modalUrl.value = 'https://';
    modal.classList.remove('hidden');
    modalName.focus();
  });

  modalCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modalSave.addEventListener('click', () => {
    const title = modalName.value.trim() || 'Site';
    let url = modalUrl.value.trim();
    if (!url || url === 'https://') return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    addShortcut(title, url);
    modal.classList.add('hidden');
  });
}

renderShortcuts();

