// ═══════════════════════════════════════════════════
//  UI CONTROLLER — ui.js
// ═══════════════════════════════════════════════════

// ── Slider live-update helper ──────────────────────
function bindSlider(id, valId, suffix = 's', decimals = 0) {
  const el = document.getElementById(id);
  const vl = document.getElementById(valId);
  if (!el || !vl) return;
  const update = () => {
    const v = parseFloat(el.value);
    vl.textContent = decimals ? v.toFixed(decimals) + suffix : Math.round(v) + suffix;
    const pct = ((v - el.min) / (el.max - el.min) * 100).toFixed(1);
    el.style.setProperty('--pct', pct + '%');
  };
  el.addEventListener('input', update);
  update();
}

// ── Gather config from setup form ─────────────────
function gatherConfig() {
  const val  = id => +document.getElementById(id)?.value || 0;
  const mode = document.querySelector('input[name="vehicleMode"]:checked')?.value ?? 'sightseeing';
  return {
    greenDuration:  val('greenDuration'),
    leftDuration:   val('leftDuration'),
    yellowDuration: val('yellowDuration'),
    redDuration:    val('redDuration'),
    rateNS: val('rateNS'), rateSN: val('rateSN'),
    rateWE: val('rateWE'), rateEW: val('rateEW'),
    sightseeing: mode === 'sightseeing',
    lightsOn: document.getElementById('lightsEnabled')?.checked ?? true,
    genMethod: document.getElementById('genMethod')?.value ?? 'GEN_3',
  };
}

// ── Chart factory ─────────────────────────────────
function makeChart(id, label, color) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#94a3b8',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
        }
      },
      scales: {
        x: { display: false },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#4b5563',
            font: { size: 9, family: 'JetBrains Mono' },
            maxTicksLimit: 4,
          },
          border: { display: false }
        }
      },
      layout: { padding: { top: 2, bottom: 2 } }
    }
  });
}

function pushChart(chart, value, max = 40) {
  if (!chart) return;
  chart.data.labels.push('');
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > max) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}

// ── Signal panel ──────────────────────────────────
function updateSignalPanel(lights) {
  const keys = { NS: 'NS', SN: 'SN', WE: 'WE', EW: 'EW' };
  const phaseClass = { green: 'green', 'left-green': 'left-green', yellow: 'yellow', red: 'red' };
  for (const [key, reg] of Object.entries(keys)) {
    const light  = lights?.get(reg);
    const bulb   = document.getElementById(`light-${key}`);
    const cnt    = document.getElementById(`cnt-${key}`);
    if (!bulb || !cnt) continue;
    if (!light || !light.enabled) {
      bulb.className = 'sig-light';
      cnt.textContent = 'OFF';
      continue;
    }
    bulb.className = `sig-light ${phaseClass[light.phase] ?? ''}`;
    cnt.textContent = (light.phaseTimeLeft / 1000).toFixed(1) + 's';
  }
}

// ── Time formatter ────────────────────────────────
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

// ══════════════════════════════════════════════════
//  UI CLASS
// ══════════════════════════════════════════════════
class UI {
  constructor() {
    this.sim    = null;
    this.charts = {};
    this._statsInterval = null;
    this._setupSliders();
    this._setupModeOptions();
    this._bindIntroButtons();
  }

  _setupSliders() {
    bindSlider('greenDuration',  'greenVal',    's');
    bindSlider('leftDuration',   'leftVal',     's');
    bindSlider('yellowDuration', 'yellowVal',   's');
    bindSlider('redDuration',    'redVal',      's');
    bindSlider('rateNS',         'rateNSVal',   's');
    bindSlider('rateSN',         'rateSNVal',   's');
    bindSlider('rateWE',         'rateWEVal',   's');
    bindSlider('rateEW',         'rateEWVal',   's');
    bindSlider('simSpeed',       'simSpeedVal', 'x', 2);
    bindSlider('rtGreen',  'rtGreenVal',  's');
    bindSlider('rtLeft',   'rtLeftVal',   's');
    bindSlider('rtYellow', 'rtYellowVal', 's');
    bindSlider('rtRed',    'rtRedVal',    's');
    bindSlider('rtNS',     'rtNSVal',     's');
    bindSlider('rtSN',     'rtSNVal',     's');
    bindSlider('rtWE',     'rtWEVal',     's');
    bindSlider('rtEW',     'rtEWVal',     's');
  }

  _setupModeOptions() {
    document.querySelectorAll('input[name="vehicleMode"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('.mode-option').forEach(el => el.classList.remove('selected'));
        r.closest('.mode-option')?.classList.add('selected');
      });
    });
  }

  _bindIntroButtons() {
    document.getElementById('startBtn')?.addEventListener('click', () => {
      this._startSimulation(gatherConfig());
    });
  }

  _startSimulation(config) {
    document.getElementById('intro-screen').classList.remove('active');
    document.getElementById('sim-screen').classList.add('active');

    const canvas = document.getElementById('simCanvas');
    this.sim = new Simulation(canvas, config);
    this.sim.start(config);

    this._syncRuntimeControls(config);
    this._bindSimControls();
    this._initCharts();
    this._startStatsLoop();

    window.addEventListener('resize', () => {
      this.sim?._resize();
      Object.values(this.charts).forEach(c => c?.resize());
    });
  }

  _syncRuntimeControls(cfg) {
    const setV = (id, v) => {
      const el = document.getElementById(id);
      if (el) { el.value = v; el.dispatchEvent(new Event('input')); }
    };
    setV('rtGreen',  cfg.greenDuration);
    setV('rtLeft',   cfg.leftDuration);
    setV('rtYellow', cfg.yellowDuration);
    setV('rtRed',    cfg.redDuration);
    setV('rtNS', cfg.rateNS); setV('rtSN', cfg.rateSN);
    setV('rtWE', cfg.rateWE); setV('rtEW', cfg.rateEW);
    const rtLights = document.getElementById('rtLights');
    if (rtLights) rtLights.checked = cfg.lightsOn;
    setV('simSpeed', 1);
  }

  _bindSimControls() {
    const pauseBtn = document.getElementById('pauseBtn');
    const badge    = document.getElementById('stateBadge');

    // Pause / Resume
    pauseBtn?.addEventListener('click', () => {
      if (this.sim.state === 'running') {
        this.sim.pause();
        pauseBtn.textContent = '▶ Resume';
        pauseBtn.classList.add('is-paused');
        badge.textContent = 'Paused';
        badge.classList.add('paused');
      } else {
        this.sim.resume();
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.classList.remove('is-paused');
        badge.textContent = 'Running';
        badge.classList.remove('paused');
      }
    });

    // Restart
    document.getElementById('restartBtn')?.addEventListener('click', () => {
      this.sim.stop();
      this.sim.start(this.sim.config);
      if (pauseBtn) { pauseBtn.textContent = '⏸ Pause'; pauseBtn.classList.remove('is-paused'); }
      badge.textContent = 'Running';
      badge.classList.remove('paused');
    });

    // Toggles
    document.getElementById('rtLights')?.addEventListener('change', e => this.sim.updateConfig({ lightsOn: e.target.checked }));
    document.getElementById('rtVision')?.addEventListener('change', e => { this.sim.showVision = e.target.checked; });
    document.getElementById('rtPaths')?.addEventListener('change',  e => { this.sim.showPath   = e.target.checked; });

    // Speed
    document.getElementById('simSpeed')?.addEventListener('input', e => { this.sim.speedMult = parseFloat(e.target.value); });

    // Settings modal
    document.getElementById('settingsBtn')?.addEventListener('click', () => document.getElementById('settingsModal')?.classList.add('open'));
    document.getElementById('closeSettings')?.addEventListener('click', () => document.getElementById('settingsModal')?.classList.remove('open'));
    document.getElementById('settingsModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });

    document.getElementById('applySettings')?.addEventListener('click', () => {
      const v = id => +document.getElementById(id)?.value || 0;
      this.sim.updateConfig({
        greenDuration:  v('rtGreen'), leftDuration:   v('rtLeft'),
        yellowDuration: v('rtYellow'), redDuration:   v('rtRed'),
        rateNS: v('rtNS'), rateSN: v('rtSN'),
        rateWE: v('rtWE'), rateEW: v('rtEW'),
      });
      document.getElementById('settingsModal')?.classList.remove('open');
    });
  }

  _initCharts() {
    Chart.defaults.color = '#64748b';
    this.charts.vehicles   = makeChart('chartVehicles',   'Vehicles',   '#6366f1');
    this.charts.congestion = makeChart('chartCongestion', 'Congestion', '#ef4444');
    this.charts.throughput = makeChart('chartThroughput', 'Throughput', '#22c55e');
  }

  _startStatsLoop() {
    if (this._statsInterval) clearInterval(this._statsInterval);
    this._statsInterval = setInterval(() => {
      const m = this.sim?.metrics;
      if (!m) return;

      // Sidebar stats
      document.getElementById('statTotal').textContent      = m.totalVehicles;
      document.getElementById('statMoving').textContent     = m.activeVehicles;
      document.getElementById('statQueued').textContent     = m.queuedVehicles;
      document.getElementById('statThroughput').textContent = m.throughput + '/min';
      document.getElementById('statTime').textContent       = fmtTime(m.elapsed);

      const pct = (m.congestion * 100).toFixed(0);
      document.getElementById('statCongestion').textContent = pct + '%';
      const fill = document.getElementById('congestionFill');
      if (fill) fill.style.width = pct + '%';

      // Signal indicators
      updateSignalPanel(this.sim?.lights);

      // Push charts
      const h = m.history;
      if (h.vehicles.length) {
        pushChart(this.charts.vehicles,   h.vehicles[h.vehicles.length - 1]);
        pushChart(this.charts.congestion, h.congestion[h.congestion.length - 1]);
        pushChart(this.charts.throughput, h.throughput[h.throughput.length - 1]);
      }
    }, 500);
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => { window._ui = new UI(); });
