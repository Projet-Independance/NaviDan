document.addEventListener('DOMContentLoaded', async () => {
  const passwordsListEl = document.getElementById('passwords-list');
  const searchInput = document.getElementById('search-pass');
  const btnToggleAdd = document.getElementById('btn-toggle-add-form');
  const addFormBox = document.getElementById('add-form-container');

  const inputSite = document.getElementById('input-site');
  const inputUsername = document.getElementById('input-username');
  const inputPassword = document.getElementById('input-password');
  const btnGenPass = document.getElementById('btn-gen-pass');
  const btnSavePass = document.getElementById('btn-save-pass');
  const btnCancelAdd = document.getElementById('btn-cancel-add');

  if (!window.passwordsApi) return;

  // Pre-fill site from current tab
  const activeDomain = await window.passwordsApi.getCurrentTabDomain();
  if (activeDomain && activeDomain !== 'newtab') {
    inputSite.value = activeDomain;
  }

  // Generate strong password
  function generatePassword(len = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,./-=';
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  btnGenPass.addEventListener('click', () => {
    inputPassword.type = 'text';
    inputPassword.value = generatePassword(16);
  });

  btnToggleAdd.addEventListener('click', () => {
    addFormBox.classList.toggle('hidden');
    if (!addFormBox.classList.contains('hidden')) {
      inputSite.focus();
    }
  });

  btnCancelAdd.addEventListener('click', () => {
    addFormBox.classList.add('hidden');
  });

  btnSavePass.addEventListener('click', async () => {
    const site = inputSite.value.trim();
    const username = inputUsername.value.trim();
    const password = inputPassword.value.trim();
    if (!site || !username || !password) {
      alert('Veuillez remplir le site, l\'identifiant et le mot de passe.');
      return;
    }

    await window.passwordsApi.addPassword({ site, username, password });
    inputUsername.value = '';
    inputPassword.value = '';
    addFormBox.classList.add('hidden');
    renderPasswords();
  });

  async function renderPasswords(filter = '') {
    const list = await window.passwordsApi.getPasswords();
    passwordsListEl.innerHTML = '';

    const filtered = filter
      ? list.filter(p => p.site.includes(filter.toLowerCase()) || p.username.toLowerCase().includes(filter.toLowerCase()))
      : list;

    if (!filtered || filtered.length === 0) {
      passwordsListEl.innerHTML = `
        <div class="empty-state">
          <span>🔒 Aucun mot de passe enregistré</span>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'pass-card';

      card.innerHTML = `
        <div class="pass-card-top">
          <span class="pass-site-name">🌐 ${item.site}</span>
          <div class="pass-actions">
            <button class="action-icon-btn btn-copy" title="Copier le mot de passe">📋</button>
            <button class="action-icon-btn btn-toggle-vis" title="Afficher/Masquer">👁️</button>
            <button class="action-icon-btn btn-del" title="Supprimer">🗑️</button>
          </div>
        </div>
        <span class="pass-user-info">👤 ${item.username}</span>
        <div class="pass-secret-row">
          <span class="pass-masked">••••••••••••</span>
          <span class="pass-plain hidden">${item.password}</span>
        </div>
      `;

      // Copy password
      card.querySelector('.btn-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(item.password);
        const btn = card.querySelector('.btn-copy');
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📋'; }, 1200);
      });

      // Toggle visibility
      card.querySelector('.btn-toggle-vis').addEventListener('click', (e) => {
        e.stopPropagation();
        const masked = card.querySelector('.pass-masked');
        const plain = card.querySelector('.pass-plain');
        masked.classList.toggle('hidden');
        plain.classList.toggle('hidden');
      });

      // Delete
      card.querySelector('.btn-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Supprimer l'identifiant pour ${item.site} ?`)) {
          await window.passwordsApi.removePassword(item.id);
          renderPasswords(searchInput.value.trim());
        }
      });

      passwordsListEl.appendChild(card);
    });
  }

  searchInput.addEventListener('input', () => {
    renderPasswords(searchInput.value.trim());
  });

  await renderPasswords();
});

