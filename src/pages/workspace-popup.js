document.addEventListener('DOMContentLoaded', async () => {
  const workspacesListEl = document.getElementById('workspaces-list');
  const btnClose = document.getElementById('btn-close-popup');
  const inputName = document.getElementById('ws-input-name');
  const emojiChips = document.querySelectorAll('.emoji-chip');
  const colorDots = document.querySelectorAll('.color-dot');
  const btnCreate = document.getElementById('btn-create-ws');

  let selectedEmoji = '🎮';
  let selectedColor = '#ef4444';

  btnClose?.addEventListener('click', () => {
    window.workspaceApi?.closePopup();
  });

  emojiChips.forEach(chip => {
    chip.addEventListener('click', () => {
      emojiChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedEmoji = chip.getAttribute('data-emoji') || '🪐';
    });
  });

  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedColor = dot.getAttribute('data-color') || '#3b82f6';
    });
  });

  async function loadWorkspaces() {
    if (!window.workspaceApi) return;
    const data = await window.workspaceApi.getWorkspaces();
    if (!data) return;

    const { activeWorkspaceId, workspaces } = data;
    renderList(workspaces || [], activeWorkspaceId);
  }

  function renderList(workspaces, activeId) {
    if (!workspacesListEl) return;
    workspacesListEl.innerHTML = '';

    workspaces.forEach(ws => {
      const item = document.createElement('div');
      item.className = `ws-item ${ws.id === activeId ? 'active' : ''}`;
      item.style.setProperty('--ws-color', ws.color || '#3b82f6');

      const isActive = ws.id === activeId;

      const wsIcon = ws.icon || ws.emoji || '🪐';
      item.innerHTML = `
        <div class="ws-item-left">
          <span class="ws-item-emoji">${wsIcon}</span>
          <span class="ws-item-name">${ws.name}</span>
          ${isActive ? '<span class="ws-badge-active">ACTIF</span>' : ''}
        </div>
        <div class="ws-item-right">
          <span class="ws-item-color" style="--ws-color: ${ws.color || '#3b82f6'}; background: ${ws.color || '#3b82f6'};"></span>
          ${!isActive && workspaces.length > 1 ? `<button class="ws-btn-del" data-id="${ws.id}" title="Supprimer cet espace">✕</button>` : ''}
        </div>
      `;

      item.addEventListener('click', async (e) => {
        if (e.target.closest('.ws-btn-del')) return;
        await window.workspaceApi.switchWorkspace(ws.id);
        window.workspaceApi.closePopup();
      });

      const delBtn = item.querySelector('.ws-btn-del');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.workspaceApi.deleteWorkspace(ws.id);
          loadWorkspaces();
        });
      }

      workspacesListEl.appendChild(item);
    });
  }

  btnCreate?.addEventListener('click', async () => {
    const name = inputName.value.trim();
    if (!name) {
      inputName.focus();
      return;
    }

    await window.workspaceApi.addWorkspace({
      name,
      icon: selectedEmoji,
      emoji: selectedEmoji,
      color: selectedColor
    });

    inputName.value = '';
    loadWorkspaces();
  });

  inputName?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnCreate.click();
    }
  });

  // Initial load
  loadWorkspaces();
});

