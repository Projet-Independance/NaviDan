document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('pip-container');
  const pipVideo = document.getElementById('pip-video');
  const loadingOverlay = document.getElementById('loading-overlay');
  const pipTitle = document.getElementById('pip-title');

  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = btnPlayPause.querySelector('.icon-play');
  const iconPause = btnPlayPause.querySelector('.icon-pause');
  const btnRewind = document.getElementById('btn-rewind');
  const btnForward = document.getElementById('btn-forward');
  const pipTime = document.getElementById('pip-time');

  const btnMute = document.getElementById('btn-mute');
  const iconVolHigh = btnMute.querySelector('.icon-vol-high');
  const iconVolMute = btnMute.querySelector('.icon-vol-mute');
  const pipVolumeSlider = document.getElementById('pip-volume-slider');

  const opacitySlider = document.getElementById('pip-opacity-slider');
  const opacityLabel = document.getElementById('pip-opacity-label');
  const btnBackToTab = document.getElementById('btn-back-to-tab');
  const btnClosePip = document.getElementById('btn-close-pip');

  let peerConnection = null;
  let isPlaying = false;
  let hideControlsTimeout = null;
  let pendingCandidates = [];
  let isRemoteDescriptionSet = false;

  function showControlsTemp() {
    container.classList.add('user-active');
    if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
    hideControlsTimeout = setTimeout(() => {
      container.classList.remove('user-active');
    }, 2500);
  }

  container.addEventListener('mousemove', showControlsTemp);
  container.addEventListener('mouseenter', showControlsTemp);

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function boostSdp(sdp) {
    if (!sdp) return sdp;
    let modified = sdp;
    if (modified.includes('m=video')) {
      modified = modified.replace(
        /(m=video [^\r\n]+[\r\n]+)/,
        '$1b=AS:30000\r\nb=TIAS:30000000\r\n'
      );
      modified = modified.replace(
        /(a=fmtp:\d+ [^\r\n]+)/g,
        '$1;x-google-min-bitrate=10000;x-google-start-bitrate=15000;x-google-max-bitrate=30000'
      );
    }
    return modified;
  }

  // WebRTC Setup
  if (window.pipApi) {
    window.pipApi.onOffer(async (offerData) => {
      try {
        if (offerData.title) {
          pipTitle.textContent = offerData.title;
        }

        // Only show loading spinner if we don't already have a running stream
        if (!pipVideo.srcObject || pipVideo.readyState < 2) {
          loadingOverlay.classList.remove('hidden');
        }

        if (peerConnection) {
          try { peerConnection.close(); } catch {}
          peerConnection = null;
        }

        pendingCandidates = [];
        isRemoteDescriptionSet = false;

        peerConnection = new RTCPeerConnection();

        peerConnection.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            pipVideo.srcObject = event.streams[0];
          } else if (event.track) {
            if (!pipVideo.srcObject) {
              pipVideo.srcObject = new MediaStream();
            }
            pipVideo.srcObject.addTrack(event.track);
          }
          pipVideo.muted = true;
          pipVideo.play().catch(() => {});
          loadingOverlay.classList.add('hidden');
        };

        peerConnection.onicecandidate = (e) => {
          if (e.candidate) {
            window.pipApi.sendIceCandidate({
              candidate: e.candidate.candidate,
              sdpMid: e.candidate.sdpMid,
              sdpMLineIndex: e.candidate.sdpMLineIndex
            });
          }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription({
          type: offerData.type,
          sdp: offerData.sdp
        }));

        isRemoteDescriptionSet = true;
        for (const cand of pendingCandidates) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        pendingCandidates = [];

        const answer = await peerConnection.createAnswer();
        const boostedAnswerSdp = boostSdp(answer.sdp);
        await peerConnection.setLocalDescription(new RTCSessionDescription({
          type: answer.type,
          sdp: boostedAnswerSdp
        }));

        window.pipApi.sendAnswer({
          type: answer.type,
          sdp: boostedAnswerSdp
        });
      } catch (err) {
        console.error('PiP WebRTC error:', err);
      }
    });

    window.pipApi.onIceCandidate(async (cand) => {
      if (peerConnection && cand) {
        if (!isRemoteDescriptionSet) {
          pendingCandidates.push(cand);
        } else {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.error('Error adding ICE candidate in PiP:', err);
          }
        }
      }
    });

    window.pipApi.onMediaState((state) => {
      if (state.title) pipTitle.textContent = state.title;
      
      isPlaying = !!state.isPlaying;
      if (isPlaying) {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
      } else {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
      }

      if (state.duration) {
        pipTime.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
      }

      if (state.isMuted) {
        iconVolHigh.classList.add('hidden');
        iconVolMute.classList.remove('hidden');
      } else {
        iconVolHigh.classList.remove('hidden');
        iconVolMute.classList.add('hidden');
      }

      if (state.volume !== undefined) {
        pipVolumeSlider.value = Math.round(state.volume * 100);
      }
    });

    // Control Handlers
    btnPlayPause.addEventListener('click', () => {
      window.pipApi.togglePlay();
      isPlaying = !isPlaying;
      iconPlay.classList.toggle('hidden', isPlaying);
      iconPause.classList.toggle('hidden', !isPlaying);
    });

    btnRewind.addEventListener('click', () => window.pipApi.seek(-10));
    btnForward.addEventListener('click', () => window.pipApi.seek(10));

    btnMute.addEventListener('click', () => window.pipApi.toggleMute());

    pipVolumeSlider.addEventListener('input', () => {
      const val = parseFloat(pipVolumeSlider.value) / 100;
      window.pipApi.setVolume(val);
    });

    opacitySlider.addEventListener('input', () => {
      const val = parseInt(opacitySlider.value, 10);
      opacityLabel.textContent = `${val}%`;
      window.pipApi.setOpacity(val / 100);
    });

    btnBackToTab.addEventListener('click', () => {
      window.pipApi.returnToTab();
    });

    btnClosePip.addEventListener('click', () => {
      window.pipApi.close();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        btnPlayPause.click();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        window.pipApi.seek(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        window.pipApi.seek(10);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        window.pipApi.toggleMute();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        window.pipApi.close();
      }
    });

    window.pipApi.notifyReady();
  }
});
