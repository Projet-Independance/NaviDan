document.addEventListener('DOMContentLoaded', async () => {
  // RAM Elements
  const ramUsedVal = document.getElementById('ram-used-val');
  const ramTotalInfo = document.getElementById('ram-total-info');
  const gaugeCircle = document.getElementById('gauge-circle');
  const toggleRamLimit = document.getElementById('toggle-ram-limit');
  const ramSlider = document.getElementById('ram-slider');
  const sliderValLabel = document.getElementById('slider-val-label');
  const toggleHardLimit = document.getElementById('toggle-hard-limit');

  // CPU Elements
  const cpuUsedVal = document.getElementById('cpu-used-val');
  const cpuCoreInfo = document.getElementById('cpu-core-info');
  const cpuGaugeCircle = document.getElementById('cpu-gauge-circle');
  const toggleCpuLimit = document.getElementById('toggle-cpu-limit');
  const cpuSlider = document.getElementById('cpu-slider');
  const cpuSliderValLabel = document.getElementById('cpu-slider-val-label');
  const toggleCpuHardLimit = document.getElementById('toggle-cpu-hard-limit');

  // Network Elements
  const toggleNetLimit = document.getElementById('toggle-net-limit');
  const selectNetPreset = document.getElementById('select-net-preset');
  const netDownVal = document.getElementById('net-down-val');
  const netUpVal = document.getElementById('net-up-val');

  // Hot Tabs Killer Elements
  const hotTabsList = document.getElementById('hot-tabs-list');
  const tabCountBadge = document.getElementById('tab-count-badge');
  const btnOptimizeRam = document.getElementById('btn-optimize-ram');

  if (!window.perfApi) return;

  // Load stored settings
  const perfSettings = await window.perfApi.getPerfSettings();
  if (perfSettings) {
    // RAM settings
    toggleRamLimit.checked = !!perfSettings.ramLimitEnabled;
    ramSlider.value = perfSettings.ramLimitGb || 4;
    sliderValLabel.textContent = `${parseFloat(ramSlider.value).toFixed(1)} GB`;
    toggleHardLimit.checked = !!perfSettings.hardLimit;

    // CPU settings
    if (toggleCpuLimit) toggleCpuLimit.checked = !!perfSettings.cpuLimitEnabled;
    if (cpuSlider) {
      cpuSlider.value = perfSettings.cpuLimitPercent || 50;
      cpuSliderValLabel.textContent = `${cpuSlider.value}%`;
    }
    if (toggleCpuHardLimit) toggleCpuHardLimit.checked = !!perfSettings.cpuHardLimit;

    // Network settings
    toggleNetLimit.checked = !!perfSettings.networkLimitEnabled;
  }

  // Live Metrics Refresh
  async function refreshMetrics() {
    const data = await window.perfApi.getMetrics();
    if (!data) return;

    // 1. RAM values
    const usedGb = (data.processMemoryMb / 1024).toFixed(2);
    const totalGb = Math.round(data.systemTotalMemoryMb / 1024);
    ramUsedVal.textContent = usedGb;
    ramTotalInfo.textContent = `/ ${totalGb} GB TOTAL`;

    // RAM Gauge circle animation (circumference is 2 * PI * 66 = 414.69)
    const maxRamVal = parseFloat(ramSlider.value) || 4;
    const ramRatio = Math.min(1, (data.processMemoryMb / 1024) / maxRamVal);
    const ramOffset = 414.69 - (414.69 * ramRatio);
    gaugeCircle.style.strokeDashoffset = ramOffset;

    // 2. CPU values
    if (cpuUsedVal && cpuGaugeCircle) {
      const activeCpuPercent = data.browserCpuPercent !== undefined && data.browserCpuPercent > 0 
        ? data.browserCpuPercent 
        : (data.systemCpuPercent || 0);
      
      cpuUsedVal.textContent = activeCpuPercent;
      if (cpuCoreInfo) {
        cpuCoreInfo.textContent = data.cpuInfo || `${data.cpuCores || 8} CŒURS CPU`;
      }

      // CPU Gauge circle animation
      const maxCpuVal = parseFloat(cpuSlider.value) || 100;
      const cpuRatio = Math.min(1, activeCpuPercent / maxCpuVal);
      const cpuOffset = 414.69 - (414.69 * cpuRatio);
      cpuGaugeCircle.style.strokeDashoffset = cpuOffset;
    }

    // 3. Hot Tabs Killer
    renderHotTabs(data.tabs || []);
  }

  function renderHotTabs(tabs) {
    tabCountBadge.textContent = `${tabs.length} onglet${tabs.length > 1 ? 's' : ''}`;
    hotTabsList.innerHTML = '';

    if (tabs.length === 0) {
      hotTabsList.innerHTML = '<div style="color:#64748b; font-size:0.75rem; text-align:center; padding:10px;">Aucun onglet ouvert</div>';
      return;
    }

    tabs.forEach(tab => {
      const row = document.createElement('div');
      row.className = 'hot-tab-row';
      const memEst = Math.round(tab.memMb || 45);
      const cpuEst = tab.cpuPercent || 1;

      row.innerHTML = `
        <span class="hot-tab-title" title="${tab.title}">${tab.title || 'Nouvel onglet'}</span>
        <span class="hot-tab-mem">${memEst} MB • ${cpuEst}% CPU</span>
        <button class="btn-kill-tab" data-id="${tab.id}" title="Fermer cet onglet">KILL</button>
      `;

      row.querySelector('.btn-kill-tab').addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.perfApi.killTab(tab.id);
        refreshMetrics();
      });

      hotTabsList.appendChild(row);
    });
  }

  // RAM Listeners
  ramSlider.addEventListener('input', () => {
    sliderValLabel.textContent = `${parseFloat(ramSlider.value).toFixed(1)} GB`;
    saveSettings();
  });
  toggleRamLimit.addEventListener('change', () => saveSettings());
  toggleHardLimit.addEventListener('change', () => saveSettings());

  // CPU Listeners
  if (cpuSlider) {
    cpuSlider.addEventListener('input', () => {
      cpuSliderValLabel.textContent = `${cpuSlider.value}%`;
      saveSettings();
    });
  }
  if (toggleCpuLimit) toggleCpuLimit.addEventListener('change', () => saveSettings());
  if (toggleCpuHardLimit) toggleCpuHardLimit.addEventListener('change', () => saveSettings());

  // Network Listeners
  toggleNetLimit.addEventListener('change', () => {
    const enabled = toggleNetLimit.checked;
    netDownVal.textContent = enabled ? 'Limité' : 'Illimité';
    netUpVal.textContent = enabled ? 'Limité' : 'Illimité';
    saveSettings();
  });

  async function saveSettings() {
    await window.perfApi.savePerfSettings({
      ramLimitEnabled: toggleRamLimit.checked,
      ramLimitGb: parseFloat(ramSlider.value),
      hardLimit: toggleHardLimit.checked,
      cpuLimitEnabled: toggleCpuLimit ? toggleCpuLimit.checked : false,
      cpuLimitPercent: cpuSlider ? parseInt(cpuSlider.value, 10) : 50,
      cpuHardLimit: toggleCpuHardLimit ? toggleCpuHardLimit.checked : false,
      networkLimitEnabled: toggleNetLimit.checked
    });
  }

  btnOptimizeRam.addEventListener('click', async () => {
    btnOptimizeRam.textContent = 'Nettoyage...';
    await window.perfApi.optimizeRam();
    setTimeout(() => {
      btnOptimizeRam.textContent = '⚡ Libéré !';
      refreshMetrics();
      setTimeout(() => { btnOptimizeRam.textContent = '⚡ Libérer'; }, 1500);
    }, 400);
  });

  await refreshMetrics();
  setInterval(refreshMetrics, 1500);
});
