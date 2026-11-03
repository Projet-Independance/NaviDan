document.addEventListener('DOMContentLoaded', async () => {
  const passwordsListEl = document.getElementById('passwords-list');
  const searchInput = document.getElementById('search-pass');
  const btnToggleAdd = document.getElementById('btn-toggle-add-form');
  const addFormBox = document.getElementById('add-form-container');

  const btnTogglePin = document.getElementById('btn-toggle-pin-form');
  const pinFormBox = document.getElementById('pin-form-container');
  const pinFormTitle = document.getElementById('pin-form-title');
  const inputPin = document.getElementById('input-pin');
  const pinFeedback = document.getElementById('pin-feedback');
  const btnRemovePin = document.getElementById('btn-remove-pin');
  const btnCancelPin = document.getElementById('btn-cancel-pin');
  const btnSavePin = document.getElementById('btn-save-pin');
  const vaultStatusBadge = document.getElementById('vault-status-badge');

  const inputSite = document.getElementById('input-site');
  const inputUsername = document.getElementById('input-username');
  const inputPassword = document.getElementById('input-password');
  const btnGenPass = document.getElementById('btn-gen-pass');
  const btnSavePass = document.getElementById('btn-save-pass');
  const btnCancelAdd = document.getElementById('btn-cancel-add');

  if (!window.passwordsApi) return;

  let hasPinConfigured = await window.passwordsApi.hasPin();
  let isSessionUnlocked = !hasPinConfigured;
  let pendingUnlockCallback = null;
  let pinMode = 'config'; // 'config' or 'unlock'

  function updateVaultBadge() {
    if (!hasPinConfigured) {
      vaultStatusBadge.textContent = '🛡️ Chiffré DPAPI OS • PIN désactivé';
      btnTogglePin.textContent = '🔑 +PIN';
    } else if (isSessionUnlocked) {
      vaultStatusBadge.textContent = '🔓 Chiffré DPAPI OS • PIN déverrouillé';
      btnTogglePin.textContent = '🔑 PIN';
    } else {
      vaultStatusBadge.textContent = '🔒 Chiffré DPAPI OS • Verrouillé par PIN';
      btnTogglePin.textContent = '🔒 PIN';
    }
  }

  updateVaultBadge();

  function openPinPromptForUnlock(onSuccess) {
    pinMode = 'unlock';
    pendingUnlockCallback = onSuccess;
    addFormBox.classList.add('hidden');
    pinFormBox.classList.remove('hidden');
    pinFormTitle.textContent = '🔒 Entrez votre code PIN maître pour déverrouiller';
    inputPin.value = '';
    inputPin.placeholder = 'Code PIN maître...';
    pinFeedback.classList.add('hidden');
    btnRemovePin.classList.add('hidden');
    btnSavePin.textContent = 'Déverrouiller';
    inputPin.focus();
  }

  btnTogglePin.addEventListener('click', () => {
    if (!pinFormBox.classList.contains('hidden') && pinMode === 'config') {
      pinFormBox.classList.add('hidden');
      return;
    }
    pinMode = 'config';
    pendingUnlockCallback = null;
    addFormBox.classList.add('hidden');
    pinFormBox.classList.remove('hidden');
    inputPin.value = '';
    pinFeedback.classList.add('hidden');
    if (hasPinConfigured && !isSessionUnlocked) {
      openPinPromptForUnlock(() => {
        btnTogglePin.click();
      });
      return;
    }
    pinFormTitle.textContent = hasPinConfigured
      ? '🔑 Modifier le code PIN maître'
      : '🔑 Activer un code PIN maître (PBKDF2)';
    inputPin.placeholder = 'Nouveau code PIN (min. 4 caractères)';
    btnRemovePin.classList.toggle('hidden', !hasPinConfigured);
    btnSavePin.textContent = 'Enregistrer PIN';
    inputPin.focus();
  });

  btnCancelPin.addEventListener('click', () => {
    pinFormBox.classList.add('hidden');
    pendingUnlockCallback = null;
  });

  btnRemovePin.addEventListener('click', async () => {
    await window.passwordsApi.setPin('');
    hasPinConfigured = false;
    isSessionUnlocked = true;
    pinFormBox.classList.add('hidden');
    updateVaultBadge();
  });

  btnSavePin.addEventListener('click', async () => {
    const val = inputPin.value.trim();
    if (pinMode === 'unlock') {
      const ok = await window.passwordsApi.verifyPin(val);
      if (!ok) {
        pinFeedback.textContent = '❌ Code PIN incorrect';
        pinFeedback.classList.remove('hidden');
        return;
      }
      isSessionUnlocked = true;
      pinFormBox.classList.add('hidden');
      updateVaultBadge();
      const cb = pendingUnlockCallback;
      pendingUnlockCallback = null;
      if (typeof cb === 'function') cb();
      return;
    }

    if (val.length < 4) {
      pinFeedback.textContent = '⚠️ Le PIN doit contenir au moins 4 caractères';
      pinFeedback.classList.remove('hidden');
      return;
    }
    await window.passwordsApi.setPin(val);
    hasPinConfigured = true;
    isSessionUnlocked = true;
    pinFormBox.classList.add('hidden');
    updateVaultBadge();
  });

  inputPin.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSavePin.click();
  });

  function requireUnlocked(actionFn) {
    if (!hasPinConfigured || isSessionUnlocked) {
      actionFn();
    } else {
      openPinPromptForUnlock(actionFn);
    }
  }

  // Pre-fill site from current tab
  const activeDomain = await window.passwordsApi.getCurrentTabDomain();
  if (activeDomain && activeDomain !== 'newtab') {
    inputSite.value = activeDomain;
  }

  // Generate strong CSPRNG password
  function generatePassword(len = 18) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,./-=';
    const randomValues = new Uint32Array(len);
    window.crypto.getRandomValues(randomValues);
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(randomValues[i] % chars.length);
    }
    return res;
  }

  btnGenPass.addEventListener('click', () => {
    inputPassword.type = 'text';
    inputPassword.value = generatePassword(18);
  });

  btnToggleAdd.addEventListener('click', () => {
    pinFormBox.classList.add('hidden');
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
    renderPasswords(searchInput.value.trim());
  });

  async function renderPasswords(filter = '') {
    const list = await window.passwordsApi.getPasswords();
    passwordsListEl.innerHTML = '';

    const filtered = filter
      ? list.filter(p => p.site.includes(filter.toLowerCase()) || p.username.toLowerCase().includes(filter.toLowerCase()))
      : list;

    if (!filtered || filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      const span = document.createElement('span');
      span.textContent = '🔒 Aucun mot de passe enregistré';
      emptyDiv.appendChild(span);
      passwordsListEl.appendChild(emptyDiv);
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'pass-card';

      const topRow = document.createElement('div');
      topRow.className = 'pass-card-top';

      const siteSpan = document.createElement('span');
      siteSpan.className = 'pass-site-name';
      siteSpan.textContent = `🌐 ${item.site}`;

      if (item.encrypted) {
        const dpapiTag = document.createElement('span');
        dpapiTag.className = 'dpapi-tag';
        dpapiTag.textContent = 'DPAPI';
        siteSpan.appendChild(dpapiTag);
      }

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'pass-actions';

      const btnCopy = document.createElement('button');
      btnCopy.className = 'action-icon-btn btn-copy';
      btnCopy.title = 'Copier le mot de passe';
      btnCopy.textContent = '📋';

      const btnVis = document.createElement('button');
      btnVis.className = 'action-icon-btn btn-toggle-vis';
      btnVis.title = 'Afficher/Masquer';
      btnVis.textContent = '👁️';

      const btnDel = document.createElement('button');
      btnDel.className = 'action-icon-btn btn-del';
      btnDel.title = 'Supprimer';
      btnDel.textContent = '🗑️';

      actionsDiv.append(btnCopy, btnVis, btnDel);
      topRow.append(siteSpan, actionsDiv);

      const userSpan = document.createElement('span');
      userSpan.className = 'pass-user-info';
      userSpan.textContent = `👤 ${item.username}`;

      const secretRow = document.createElement('div');
      secretRow.className = 'pass-secret-row';

      const maskedSpan = document.createElement('span');
      maskedSpan.className = 'pass-masked';
      maskedSpan.textContent = '••••••••••••';

      const plainSpan = document.createElement('span');
      plainSpan.className = 'pass-plain hidden';
      plainSpan.textContent = item.password;

      secretRow.append(maskedSpan, plainSpan);
      card.append(topRow, userSpan, secretRow);

      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        requireUnlocked(() => {
          navigator.clipboard.writeText(item.password);
          btnCopy.textContent = '✓';
          setTimeout(() => { btnCopy.textContent = '📋'; }, 1200);
        });
      });

      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!plainSpan.classList.contains('hidden')) {
          maskedSpan.classList.remove('hidden');
          plainSpan.classList.add('hidden');
          return;
        }
        requireUnlocked(() => {
          maskedSpan.classList.add('hidden');
          plainSpan.classList.remove('hidden');
        });
      });

      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        requireUnlocked(async () => {
          if (confirm(`Supprimer l'identifiant pour ${item.site} ?`)) {
            await window.passwordsApi.removePassword(item.id);
            renderPasswords(searchInput.value.trim());
          }
        });
      });

      passwordsListEl.appendChild(card);
    });
  }

  searchInput.addEventListener('input', () => {
    renderPasswords(searchInput.value.trim());
  });

  await renderPasswords();
});
