/**
 * NaviDdan Tab Preload Script
 * Handles Video Detection, PiP Overlay Badges, WebRTC Mirroring & Media Controls
 * Fully compatible with TrustedHTML (YouTube CSP compliant)
 */

const { ipcRenderer } = require('electron');

let currentActiveVideo = null;
let peerConnection = null;
let currentStream = null;
let pendingCandidates = [];
let remoteDescriptionSet = false;
let isPipActive = false;
let refreshDebounceTimeout = null;
let healthCheckInterval = null;
let lastKnownDuration = 0;
let lastKnownSrc = '';

// Boost SDP parameters for 60 FPS, ultra-high bitrate (30 Mbps) and zero compression blur
function boostSdp(sdp) {
  if (!sdp) return sdp;
  let modified = sdp;
  if (modified.includes('m=video')) {
    // Inject bandwidth modifiers: b=AS (30 Mbps in kbps) and b=TIAS (bps)
    modified = modified.replace(
      /(m=video [^\r\n]+[\r\n]+)/,
      '$1b=AS:30000\r\nb=TIAS:30000000\r\n'
    );
    // Inject Google congestion control / bitrate hints
    modified = modified.replace(
      /(a=fmtp:\d+ [^\r\n]+)/g,
      '$1;x-google-min-bitrate=10000;x-google-start-bitrate=15000;x-google-max-bitrate=30000'
    );
  }
  return modified;
}

function schedulePipRefresh(reason) {
  if (!isPipActive) return;
  if (refreshDebounceTimeout) clearTimeout(refreshDebounceTimeout);
  refreshDebounceTimeout = setTimeout(() => {
    console.log(`[NaviDdan PiP] Refreshing stream: ${reason}`);
    startPipStream();
  }, 350);
}

// Inject CSS styles for the in-page PiP hover badge
function injectBadgeStyles() {
  if (document.getElementById('naviddan-pip-styles')) return;
  const style = document.createElement('style');
  style.id = 'naviddan-pip-styles';
  style.textContent = `
    .naviddan-pip-badge {
      position: absolute;
      top: 14px;
      right: 14px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(59, 130, 246, 0.5);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 10px rgba(59, 130, 246, 0.3);
      opacity: 0;
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }
    .naviddan-pip-badge:hover {
      background: #2563eb;
      border-color: #60a5fa;
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
    }
    .naviddan-pip-badge svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    .naviddan-pip-badge.visible {
      opacity: 1;
      pointer-events: auto;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function notifyMediaStatus() {
  if (!currentActiveVideo) {
    ipcRenderer.send('pip:media-status', { hasVideo: false, isPlaying: false });
    ipcRenderer.send('tab:audio-activity', { isAudible: false, isMuted: false });
    return;
  }
  const isPlaying = !currentActiveVideo.paused && !currentActiveVideo.ended;
  const isMuted = currentActiveVideo.muted || currentActiveVideo.volume === 0;
  const payload = {
    hasVideo: true,
    isPlaying,
    title: document.title,
    duration: currentActiveVideo.duration || 0,
    currentTime: currentActiveVideo.currentTime || 0,
    volume: currentActiveVideo.volume,
    isMuted
  };
  ipcRenderer.send('pip:media-status', payload);
  ipcRenderer.send('tab:audio-activity', {
    isAudible: isPlaying && !isMuted,
    isMuted
  });
}

function setupVideoTracking(video) {
  if (video._naviddanTracked) return;
  video._naviddanTracked = true;

  // Create badge using DOM elements (NEVER use innerHTML to comply with YouTube TrustedHTML policy)
  const badge = document.createElement('div');
  badge.className = 'naviddan-pip-badge';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  
  const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect1.setAttribute('x', '2');
  rect1.setAttribute('y', '3');
  rect1.setAttribute('width', '20');
  rect1.setAttribute('height', '14');
  rect1.setAttribute('rx', '2');
  rect1.setAttribute('ry', '2');
  
  const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect2.setAttribute('x', '12');
  rect2.setAttribute('y', '9');
  rect2.setAttribute('width', '8');
  rect2.setAttribute('height', '6');
  rect2.setAttribute('rx', '1');
  rect2.setAttribute('ry', '1');
  rect2.setAttribute('fill', 'currentColor');
  
  svg.appendChild(rect1);
  svg.appendChild(rect2);
  
  const span = document.createElement('span');
  span.textContent = 'PiP NAVIDDAN';
  
  badge.appendChild(svg);
  badge.appendChild(span);

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    currentActiveVideo = video;
    ipcRenderer.send('pip:open-request');
  });

  // Attach hover detection
  let hideTimeout = null;
  const showBadge = () => {
    if (hideTimeout) clearTimeout(hideTimeout);
    injectBadgeStyles();
    
    // Position badge over the video container
    const rect = video.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 100) return; // Skip tiny thumbnails
    
    const parent = video.parentElement || document.body;
    if (!badge.parentElement || badge.parentElement !== parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(badge);
    }
    badge.classList.add('visible');
  };

  const hideBadge = () => {
    hideTimeout = setTimeout(() => {
      badge.classList.remove('visible');
    }, 400);
  };

  video.addEventListener('mouseenter', showBadge);
  video.addEventListener('mouseleave', hideBadge);
  badge.addEventListener('mouseenter', () => {
    if (hideTimeout) clearTimeout(hideTimeout);
  });
  badge.addEventListener('mouseleave', hideBadge);

  video.addEventListener('play', () => {
    const wasDifferent = currentActiveVideo !== video;
    currentActiveVideo = video;
    notifyMediaStatus();
    if (isPipActive && wasDifferent) {
      schedulePipRefresh('new_active_video_play');
    }
  });

  video.addEventListener('playing', () => {
    currentActiveVideo = video;
    notifyMediaStatus();
    if (isPipActive) {
      const curDur = video.duration || 0;
      if (Math.abs(curDur - lastKnownDuration) > 3) {
        schedulePipRefresh('duration_changed_on_playing');
      }
    }
  });

  video.addEventListener('ended', () => {
    if (currentActiveVideo === video) {
      notifyMediaStatus();
      if (isPipActive) {
        // Flux or ad finished, schedule immediate switch to next stream
        schedulePipRefresh('video_ended');
      }
    }
  });

  video.addEventListener('loadstart', () => {
    if (isPipActive && currentActiveVideo === video) {
      schedulePipRefresh('video_loadstart');
    }
  });

  video.addEventListener('pause', () => {
    if (currentActiveVideo === video) notifyMediaStatus();
  });

  video.addEventListener('timeupdate', () => {
    if (currentActiveVideo === video && Math.floor(video.currentTime) % 2 === 0) {
      notifyMediaStatus();
    }
  });

  video.addEventListener('volumechange', () => {
    if (currentActiveVideo === video) notifyMediaStatus();
  });

  if (!video.paused) {
    currentActiveVideo = video;
    notifyMediaStatus();
  }
}

function scanForVideos() {
  const mediaElements = document.querySelectorAll('video, audio');
  mediaElements.forEach(v => setupVideoTracking(v));
  for (const m of mediaElements) {
    if (!m.paused && !m.ended) {
      currentActiveVideo = m;
      notifyMediaStatus();
      break;
    }
  }
}

// Observe DOM for newly added video elements (e.g. YouTube SPA navigation)
const observer = new MutationObserver(() => {
  scanForVideos();
});

document.addEventListener('DOMContentLoaded', () => {
  injectBadgeStyles();
  scanForVideos();
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
});

window.addEventListener('load', () => {
  injectBadgeStyles();
  scanForVideos();
});

// Setup & start the high-definition PiP stream
async function startPipStream() {
  isPipActive = true;

  const videos = Array.from(document.querySelectorAll('video'));
  let bestVideo = videos.find(v => !v.paused && v.duration > 0 && (v.offsetHeight > 50 || v.offsetWidth > 50));
  if (!bestVideo) {
    bestVideo = videos.find(v => !v.paused && (v.offsetHeight > 50 || v.offsetWidth > 50)) ||
                videos.find(v => !v.paused) ||
                videos.find(v => v.duration > 0) ||
                videos[0];
  }

  if (!bestVideo) {
    ipcRenderer.send('pip:stream-error', 'Aucune vidéo trouvée sur cette page.');
    return;
  }

  currentActiveVideo = bestVideo;
  lastKnownDuration = currentActiveVideo.duration || 0;
  lastKnownSrc = currentActiveVideo.currentSrc || currentActiveVideo.src || '';

  try {
    if (peerConnection) {
      try { peerConnection.close(); } catch {}
      peerConnection = null;
    }

    if (currentStream) {
      try { currentStream.getTracks().forEach(t => t.stop()); } catch {}
      currentStream = null;
    }

    pendingCandidates = [];
    remoteDescriptionSet = false;

    if (!currentActiveVideo.captureStream && currentActiveVideo.mozCaptureStream) {
      currentActiveVideo.captureStream = currentActiveVideo.mozCaptureStream;
    }

    if (!currentActiveVideo.captureStream) {
      ipcRenderer.send('pip:stream-error', 'captureStream non supporté.');
      return;
    }

    // Capture at 60 FPS for fluid gaming/video quality
    currentStream = currentActiveVideo.captureStream(60);

    // Watch for stream track termination (e.g. ad finished, media source reset)
    currentStream.getVideoTracks().forEach(track => {
      track.onended = () => {
        console.log('[NaviDdan PiP] Video track ended, scheduling refresh...');
        if (isPipActive) schedulePipRefresh('track_onended');
      };
    });

    peerConnection = new RTCPeerConnection();

    currentStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, currentStream);
    });

    // Enforce 30 Mbps ultra high bitrate and resolution priority on video sender
    try {
      const senders = peerConnection.getSenders();
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 30000000; // 30 Mbps
          params.encodings[0].maxFramerate = 60;
          params.encodings[0].priority = 'high';
          params.encodings[0].networkPriority = 'high';
          params.degradationPreference = 'maintain-resolution';
          sender.setParameters(params).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[NaviDdan PiP] Sender parameters setup:', e);
    }

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        ipcRenderer.send('pip:webrtc-ice-candidate', {
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex
        });
      }
    };

    const offer = await peerConnection.createOffer();
    const boostedSdp = boostSdp(offer.sdp);

    await peerConnection.setLocalDescription(new RTCSessionDescription({
      type: offer.type,
      sdp: boostedSdp
    }));

    ipcRenderer.send('pip:webrtc-offer', {
      type: peerConnection.localDescription.type,
      sdp: peerConnection.localDescription.sdp,
      title: document.title,
      duration: currentActiveVideo.duration || 0,
      currentTime: currentActiveVideo.currentTime || 0,
      isPlaying: !currentActiveVideo.paused,
      isMuted: currentActiveVideo.muted,
      volume: currentActiveVideo.volume
    });

    // Start background stream health watchdog
    if (!healthCheckInterval) {
      healthCheckInterval = setInterval(() => {
        if (!isPipActive) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
          return;
        }

        // 1. Check if current video got removed from DOM
        if (!currentActiveVideo || !document.contains(currentActiveVideo)) {
          schedulePipRefresh('video_detached_from_dom');
          return;
        }

        // 2. Check if another video started playing
        const vids = Array.from(document.querySelectorAll('video'));
        const anotherPlaying = vids.find(v => !v.paused && v !== currentActiveVideo && (v.offsetHeight > 50 || v.offsetWidth > 50));
        if (anotherPlaying) {
          currentActiveVideo = anotherPlaying;
          schedulePipRefresh('another_video_playing');
          return;
        }

        // 3. Check if captured stream became inactive or track ended
        if (!currentStream || !currentStream.active) {
          schedulePipRefresh('stream_inactive');
          return;
        }
        const vTracks = currentStream.getVideoTracks();
        if (vTracks.length === 0 || vTracks.some(t => t.readyState === 'ended')) {
          schedulePipRefresh('video_track_ended_state');
          return;
        }

        // 4. Check if duration changed abruptly (e.g. ad finished, main video loaded)
        const curDur = currentActiveVideo.duration || 0;
        if (Math.abs(curDur - lastKnownDuration) > 5 && curDur > 0 && lastKnownDuration > 0) {
          schedulePipRefresh('duration_jump_flux_transition');
          return;
        }
      }, 1000);
    }
  } catch (err) {
    console.error('NaviDdan PiP Stream error:', err);
    ipcRenderer.send('pip:stream-error', err.message);
  }
}

// IPC Commands from Main process / PiP Window
ipcRenderer.on('pip:start-stream', () => {
  startPipStream();
});

ipcRenderer.on('pip:stop-stream', () => {
  isPipActive = false;
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  if (refreshDebounceTimeout) {
    clearTimeout(refreshDebounceTimeout);
    refreshDebounceTimeout = null;
  }
  if (peerConnection) {
    try { peerConnection.close(); } catch {}
    peerConnection = null;
  }
  if (currentStream) {
    try { currentStream.getTracks().forEach(t => t.stop()); } catch {}
    currentStream = null;
  }
});

ipcRenderer.on('pip:webrtc-answer', async (_, answer) => {
  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      remoteDescriptionSet = true;
      for (const cand of pendingCandidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
      pendingCandidates = [];
    } catch (err) {
      console.error('Error setting remote description on tab:', err);
    }
  }
});

ipcRenderer.on('pip:webrtc-ice-candidate', async (_, candidate) => {
  if (peerConnection && candidate) {
    if (!remoteDescriptionSet) {
      pendingCandidates.push(candidate);
    } else {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } catch (err) {
        console.error('Error adding ICE candidate on tab:', err);
      }
    }
  }
});

// Control Commands from PiP
ipcRenderer.on('pip:cmd-toggle-play', () => {
  if (currentActiveVideo) {
    if (currentActiveVideo.paused) {
      currentActiveVideo.play().catch(() => {});
    } else {
      currentActiveVideo.pause();
    }
    notifyMediaStatus();
  }
});

ipcRenderer.on('pip:cmd-seek', (_, deltaSeconds) => {
  if (currentActiveVideo) {
    currentActiveVideo.currentTime = Math.max(0, Math.min(currentActiveVideo.duration || Infinity, currentActiveVideo.currentTime + deltaSeconds));
    notifyMediaStatus();
  }
});

ipcRenderer.on('pip:cmd-set-volume', (_, volume) => {
  if (currentActiveVideo) {
    currentActiveVideo.volume = Math.max(0, Math.min(1, volume));
    if (currentActiveVideo.volume > 0 && currentActiveVideo.muted) {
      currentActiveVideo.muted = false;
    }
    notifyMediaStatus();
  }
});

ipcRenderer.on('pip:cmd-toggle-mute', () => {
  if (currentActiveVideo) {
    currentActiveVideo.muted = !currentActiveVideo.muted;
    notifyMediaStatus();
  }
});

// Middle-click & Ctrl+Click on links to open in a new tab
window.addEventListener('auxclick', (e) => {
  if (e.button === 1) { // Middle click (mouse wheel)
    const link = e.target.closest('a');
    if (link && link.href && !link.href.startsWith('javascript:')) {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.send('tab:open-new', link.href);
    }
  }
}, true);

window.addEventListener('click', (e) => {
  if (e.ctrlKey || e.metaKey) { // Ctrl+Click
    const link = e.target.closest('a');
    if (link && link.href && !link.href.startsWith('javascript:')) {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.send('tab:open-new', link.href);
    }
  }
}, true);

// --- In-page Shortcuts for Audio Focus ---
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      ipcRenderer.invoke('audio:mute-background');
    } else if (!e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      ipcRenderer.invoke('tab:toggle-mute');
    }
  }
}, true);

// Listen to in-page media mute command
ipcRenderer.on('tab:set-muted-in-page', (_, muted) => {
  const mediaElements = document.querySelectorAll('video, audio');
  mediaElements.forEach(m => {
    try {
      m.muted = !!muted;
    } catch {}
  });
});

// --- NaviSnipper Screen Capture Overlay ---
ipcRenderer.on('snipper:open-overlay', () => {
  const existing = document.getElementById('naviddan-snipper-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'naviddan-snipper-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(0, 0, 0, 0.45)',
    userSelect: 'none',
    overflow: 'hidden'
  });

  // Top Control Bar
  const topBar = document.createElement('div');
  Object.assign(topBar.style, {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '6px 12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
    fontFamily: 'ui-monospace, "SF Mono", monospace',
    fontSize: '11px',
    fontWeight: '700',
    color: '#f0f6fc',
    letterSpacing: '0.06em',
    pointerEvents: 'auto'
  });

  const titleSpan = document.createElement('span');
  titleSpan.textContent = '✂️ NAVISNIPPER • GLISSER POUR DÉCOUPER';
  topBar.appendChild(titleSpan);

  const btnFull = document.createElement('button');
  btnFull.textContent = 'PLEINE PAGE';
  Object.assign(btnFull.style, {
    background: '#1f6feb',
    border: '1px solid #388bfd',
    color: '#ffffff',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '3px',
    cursor: 'pointer'
  });
  btnFull.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    triggerShutterFeedback();
    ipcRenderer.send('snipper:do-capture', null);
  });
  topBar.appendChild(btnFull);

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'ÉCHAP : ANNULER';
  Object.assign(btnCancel.style, {
    background: '#21262d',
    border: '1px solid #30363d',
    color: '#8b949e',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '3px',
    cursor: 'pointer'
  });
  btnCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
  });
  topBar.appendChild(btnCancel);

  overlay.appendChild(topBar);

  // Selection Box
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'absolute',
    border: '2px solid #388bfd',
    background: 'rgba(56, 139, 253, 0.15)',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
    pointerEvents: 'none',
    display: 'none'
  });

  const dimTag = document.createElement('div');
  Object.assign(dimTag.style, {
    position: 'absolute',
    bottom: '-24px',
    right: '0',
    background: '#0d1117',
    border: '1px solid #30363d',
    color: '#f0f6fc',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '2px',
    whiteSpace: 'nowrap'
  });
  box.appendChild(dimTag);
  overlay.appendChild(box);

  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let currentBounds = null;

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === btnFull || e.target === btnCancel) return;
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.display = 'block';
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    currentBounds = { x: left, y: top, width, height };

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;

    dimTag.textContent = `${Math.round(width)} × ${Math.round(height)} PX`;
  });

  function triggerShutterFeedback(w, h) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
      }
    } catch {}

    try {
      const flash = document.createElement('div');
      Object.assign(flash.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '2147483647',
        background: 'rgba(255, 255, 255, 0.35)',
        pointerEvents: 'none',
        transition: 'opacity 0.15s ease'
      });
      (document.body || document.documentElement).appendChild(flash);
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 160);
      }, 50);
    } catch {}

    if (w && h) {
      try {
        const existing = document.getElementById('naviddan-snipper-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'naviddan-snipper-toast';
        Object.assign(toast.style, {
          position: 'fixed',
          top: '20px',
          right: '24px',
          background: '#0d1117',
          border: '1px solid #30363d',
          borderLeft: '3px solid #3fb950',
          borderRadius: '4px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
          fontSize: '11px',
          fontWeight: '700',
          color: '#f0f6fc',
          letterSpacing: '0.05em',
          zIndex: '2147483647',
          pointerEvents: 'none',
          opacity: '0',
          transform: 'translateY(-10px)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        });

        const tag = document.createElement('span');
        tag.textContent = '✓ CAPTURE EFFECTUÉE';
        Object.assign(tag.style, {
          color: '#3fb950',
          background: 'rgba(63, 185, 80, 0.12)',
          border: '1px solid rgba(63, 185, 80, 0.3)',
          padding: '2px 6px',
          borderRadius: '2px',
          fontSize: '9px',
          letterSpacing: '0.08em'
        });
        toast.appendChild(tag);

        const info = document.createElement('span');
        info.textContent = `${w} × ${h} PX • COPIÉ DANS LE PRESSE-PAPIER`;
        Object.assign(info.style, {
          color: '#e6edf3',
          fontSize: '11px',
          fontWeight: '600'
        });
        toast.appendChild(info);

        (document.body || document.documentElement).appendChild(toast);

        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-10px)';
          setTimeout(() => toast.remove(), 250);
        }, 3500);
      } catch {}
    }
  }

  const finishCapture = () => {
    if (!isDrawing) return;
    isDrawing = false;
    overlay.remove();

    if (currentBounds && currentBounds.width > 5 && currentBounds.height > 5) {
      triggerShutterFeedback(Math.round(currentBounds.width), Math.round(currentBounds.height));
      ipcRenderer.send('snipper:do-capture', currentBounds);
    }
  };

  overlay.addEventListener('mouseup', finishCapture);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', handleKeyDown);
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  (document.body || document.documentElement).appendChild(overlay);
});

// ==========================================
// NAVIAI SELECTION FLOATING TOOLTIP
// ==========================================
(function initNaviAITooltip() {
  let tooltipEl = null;

  function removeTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  document.addEventListener('mouseup', (e) => {
    // If click inside tooltip, do not dismiss immediately
    if (tooltipEl && tooltipEl.contains(e.target)) return;

    // Small delay to let selection settle
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        removeTooltip();
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length < 3 || text.length > 8000) {
        removeTooltip();
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          removeTooltip();
          return;
        }

        removeTooltip();

        tooltipEl = document.createElement('div');
        tooltipEl.id = 'naviddan-ai-selection-bubble';
        Object.assign(tooltipEl.style, {
          position: 'fixed',
          left: `${Math.max(10, Math.min(window.innerWidth - 320, rect.left + (rect.width / 2) - 150))}px`,
          top: `${rect.top > 46 ? rect.top - 44 : rect.bottom + 8}px`,
          zIndex: '2147483645',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 8px',
          background: 'rgba(13, 17, 26, 0.94)',
          border: '1px solid rgba(59, 130, 246, 0.6)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 14px rgba(59, 130, 246, 0.35)',
          backdropFilter: 'blur(10px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '11px',
          fontWeight: '600',
          color: '#e6edf3',
          userSelect: 'none',
          animation: 'naviaiBubbleFadeIn 0.15s ease-out'
        });

        const brand = document.createElement('span');
        brand.textContent = '⚡ NaviAI';
        Object.assign(brand.style, {
          color: '#60a5fa',
          fontWeight: '700',
          marginRight: '4px',
          display: 'flex',
          alignItems: 'center'
        });
        tooltipEl.appendChild(brand);

        const actions = [
          {
            label: '💡 Résumer',
            prompt: `Résume ce passage de manière claire, concise et percutante :\n\n"${text}"`
          },
          {
            label: '🌐 Traduire',
            prompt: `Traduis ce texte fidèlement en français (ou explique-le si déjà en français) :\n\n"${text}"`
          },
          {
            label: '❓ Expliquer',
            prompt: `Explique simplement et pédagogiquement ce texte et son contexte :\n\n"${text}"`
          }
        ];

        actions.forEach(act => {
          const btn = document.createElement('button');
          btn.textContent = act.label;
          Object.assign(btn.style, {
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#f1f5f9',
            padding: '3px 7px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '500',
            transition: 'all 0.15s ease',
            outline: 'none'
          });

          btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(59, 130, 246, 0.35)';
            btn.style.borderColor = '#60a5fa';
            btn.style.color = '#ffffff';
          });
          btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255, 255, 255, 0.08)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            btn.style.color = '#f1f5f9';
          });

          btn.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            ipcRenderer.send('naviai:open-with-selection', {
              prompt: act.prompt,
              selectedText: text,
              pageUrl: window.location.href,
              pageTitle: document.title
            });
            removeTooltip();
          });

          tooltipEl.appendChild(btn);
        });

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.45)',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '10px',
          marginLeft: '2px'
        });
        closeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          removeTooltip();
        });
        tooltipEl.appendChild(closeBtn);

        (document.body || document.documentElement).appendChild(tooltipEl);
      } catch (err) {
        removeTooltip();
      }
    }, 20);
  });

  document.addEventListener('mousedown', (e) => {
    if (tooltipEl && !tooltipEl.contains(e.target)) {
      removeTooltip();
    }
  });

  window.addEventListener('scroll', removeTooltip, { passive: true });
})();

