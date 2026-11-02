document.addEventListener('DOMContentLoaded', async () => {
  const audioCountEl = document.getElementById('audio-count');
  const btnMuteBg = document.getElementById('btn-mute-bg');
  const streamsListEl = document.getElementById('streams-list');
  const streamsEmptyEl = document.getElementById('streams-empty');

  function renderStreams(data) {
    if (!data) return;
    const streams = data.streams || [];
    const count = streams.length;

    if (audioCountEl) {
      audioCountEl.textContent = `${count} ${count > 1 ? 'FLUX' : 'FLUX'}`;
    }

    if (!streamsListEl || !streamsEmptyEl) return;

    if (count === 0) {
      streamsListEl.innerHTML = '';
      streamsEmptyEl.classList.remove('hidden');
      return;
    }

    streamsEmptyEl.classList.add('hidden');
    streamsListEl.innerHTML = '';

    streams.forEach((stream) => {
      const item = document.createElement('div');
      item.className = `stream-item ${stream.isActive ? 'active-tab' : ''} ${stream.isMuted ? 'muted' : ''}`;

      const isPlaying = stream.isAudible && !stream.isMuted;

      item.innerHTML = `
        <div class="stream-info">
          <span class="stream-favicon">🌐</span>
          <div class="stream-title-col">
            <span class="stream-title" title="${escapeHtml(stream.title || 'Onglet')}">${escapeHtml(stream.title || 'Onglet')}</span>
            <div class="stream-status ${stream.isMuted ? 'muted-text' : (isPlaying ? 'playing' : '')}">
              ${stream.isMuted 
                ? '<span>🔇 EN SOURDINE</span>' 
                : (isPlaying 
                    ? '<div class="mini-eq"><span class="bar"></span><span class="bar"></span><span class="bar"></span></div><span>LECTURE ACTIVE</span>' 
                    : '<span>PAUSE</span>')}
              ${stream.isActive ? '<span>• ACTIF</span>' : ''}
            </div>
          </div>
        </div>
        <button class="btn-tab-mute ${stream.isMuted ? 'is-muted' : ''}" title="${stream.isMuted ? 'Rétablir le son' : 'Couper le son'}" data-tab-id="${stream.id}">
          ${stream.isMuted 
            ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>' 
            : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'}
        </button>
      `;

      const muteBtn = item.querySelector('.btn-tab-mute');
      muteBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.audioApi.toggleTabMute(stream.id);
        const updated = await window.audioApi.getStreams();
        renderStreams(updated);
      });

      streamsListEl.appendChild(item);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Master Mute Background Tabs
  btnMuteBg?.addEventListener('click', async () => {
    await window.audioApi.muteBackgroundTabs();
    const updated = await window.audioApi.getStreams();
    renderStreams(updated);
  });

  // Listen to live stream updates
  window.audioApi?.onStreamsUpdated((data) => {
    renderStreams(data);
  });

  // Initial load
  try {
    const initialData = await window.audioApi.getStreams();
    renderStreams(initialData);
  } catch (err) {
    console.error('Error fetching initial audio streams:', err);
  }
});

