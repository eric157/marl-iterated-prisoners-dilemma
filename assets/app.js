const STORAGE_KEY = "ipd_marl_runs_v1";

const elements = {
  runForm: document.getElementById("runForm"),
  runBtn: document.getElementById("runBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  summaryCards: document.getElementById("summaryCards"),
  experimentSelect: document.getElementById("experimentSelect"),
  leaderboardBody: document.querySelector("#leaderboardTable tbody"),
  qTableView: document.getElementById("qTableView"),
  compareA: document.getElementById("compareA"),
  compareB: document.getElementById("compareB"),
  compareMetrics: document.getElementById("compareMetrics"),
  episodes: document.getElementById("episodes"),
  rounds: document.getElementById("rounds"),
  memory: document.getElementById("memory"),
  noise: document.getElementById("noise"),
  alpha: document.getElementById("alpha"),
  gamma: document.getElementById("gamma"),
  epsilon: document.getElementById("epsilon"),
  epsilonDecay: document.getElementById("epsilonDecay"),
  epsilonMin: document.getElementById("epsilonMin"),
  seed: document.getElementById("seed"),
  enablePopulation: document.getElementById("enablePopulation"),
  enableSweeps: document.getElementById("enableSweeps"),
  enableTournament: document.getElementById("enableTournament"),
};

const palette = {
  primary: "#2ec4b6",
  amber: "#f2b65c",
  red: "#ff6b6b",
  blue: "#6c8bff",
  purple: "#8e7dff",
  green: "#55d187",
  slate: "#93a4b8",
};

const EXPERIMENT_LABELS = {
  Q_vs_AllC: "Q-learning vs Always Cooperate (AllC)",
  Q_vs_AllD: "Q-learning vs Always Defect (AllD)",
  Q_vs_Random: "Q-learning vs Random",
  Q_vs_TFT: "Q-learning vs Tit For Tat (TFT)",
  Q_vs_Grim: "Q-learning vs Grim Trigger",
  Q_vs_Q: "Q-learning vs Q-learning",
};

const STRATEGY_LABELS = {
  ALLC: "Always Cooperate (AllC)",
  ALLD: "Always Defect (AllD)",
  RANDOM: "Random",
  TFT: "Tit For Tat (TFT)",
  GRIM: "Grim Trigger",
  COPYKITTEN: "Copykitten",
};

const state = {
  worker: null,
  running: false,
  lastResult: null,
  runHistory: [],
  charts: {
    coop: null,
    reward: null,
    sweepCoop: null,
    sweepReward: null,
  },
};

function friendlyExperimentName(name) {
  return EXPERIMENT_LABELS[name] ?? name;
}

function friendlyStrategyName(name) {
  return STRATEGY_LABELS[name] ?? name;
}

function asPercent(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function init() {
  initCharts();
  loadHistory();
  bindEvents();
  setProgress(0, "Idle");
  renderCompare();
}

function bindEvents() {
  elements.runForm.addEventListener("submit", onRun);
  elements.cancelBtn.addEventListener("click", cancelRun);
  elements.downloadBtn.addEventListener("click", downloadLastResult);
  elements.experimentSelect.addEventListener("change", renderSelectedExperiment);
  elements.compareA.addEventListener("change", renderCompare);
  elements.compareB.addEventListener("change", renderCompare);
}

function getSelectedExperiments() {
  return Array.from(elements.runForm.querySelectorAll('input[type="checkbox"][value]:checked'))
    .map((box) => box.value)
    .filter(Boolean);
}

function getRunConfig() {
  const cfg = {
    episodes: Number(elements.episodes.value),
    rounds: Number(elements.rounds.value),
    memory: Number(elements.memory.value),
    noise: Number(elements.noise.value),
    alpha: Number(elements.alpha.value),
    gamma: Number(elements.gamma.value),
    epsilon: Number(elements.epsilon.value),
    epsilonDecay: Number(elements.epsilonDecay.value),
    epsilonMin: Number(elements.epsilonMin.value),
    seed: Number(elements.seed.value),
    experiments: getSelectedExperiments(),
    enablePopulation: elements.enablePopulation.checked,
    enableSweeps: elements.enableSweeps.checked,
    enableTournament: elements.enableTournament.checked,
  };
  return cfg;
}

function validateConfig(cfg) {
  if (!cfg.experiments.length) {
    throw new Error("Select at least one core experiment.");
  }
  if (cfg.episodes < 50 || cfg.rounds < 20) {
    throw new Error("Episodes must be >= 50 and rounds must be >= 20.");
  }
  if (cfg.memory < 1 || cfg.memory > 5) {
    throw new Error("Memory must be in [1,5].");
  }
}

function onRun(event) {
  event.preventDefault();
  if (state.running) return;
  try {
    const cfg = getRunConfig();
    validateConfig(cfg);
    startRun(cfg);
  } catch (err) {
    setProgress(0, `Cannot start: ${err.message}`);
  }
}

function startRun(config) {
  if (state.worker) {
    state.worker.terminate();
  }
  state.worker = new Worker("assets/worker.js");
  state.worker.onmessage = handleWorkerMessage;
  state.worker.onerror = (err) => {
    setProgress(0, `Worker failed: ${err.message}`);
    finishRun(false);
  };
  state.running = true;
  elements.runBtn.disabled = true;
  elements.cancelBtn.disabled = false;
  elements.downloadBtn.disabled = true;
  setProgress(0, "Starting simulation...");
  state.worker.postMessage({ type: "run", config });
}

function cancelRun() {
  if (!state.worker) return;
  state.worker.terminate();
  state.worker = null;
  setProgress(0, "Run cancelled.");
  finishRun(false);
}

function finishRun(success) {
  state.running = false;
  elements.runBtn.disabled = false;
  elements.cancelBtn.disabled = true;
  elements.downloadBtn.disabled = !success || !state.lastResult;
}

function handleWorkerMessage(event) {
  const payload = event.data;
  if (!payload || typeof payload !== "object") return;
  if (payload.type === "progress") {
    setProgress(payload.progress ?? 0, payload.message ?? "Running...");
    return;
  }
  if (payload.type === "error") {
    setProgress(0, `Run failed: ${payload.message}`);
    finishRun(false);
    return;
  }
  if (payload.type === "done") {
    state.lastResult = payload.result;
    renderResult(payload.result);
    appendRunHistory(payload.result);
    setProgress(100, "Completed.");
    finishRun(true);
  }
}

function setProgress(percent, text) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  elements.progressFill.style.width = `${p}%`;
  elements.progressText.textContent = text;
}

function initCharts() {
  state.charts.coop = createLineChart("coopChart", "Cooperation");
  state.charts.reward = createLineChart("rewardChart", "Joint Reward");
  state.charts.sweepCoop = createMultiLineChart("sweepCoopChart", "Tail Cooperation");
  state.charts.sweepReward = createMultiLineChart("sweepRewardChart", "Tail Reward");
}

function createLineChart(canvasId, yTitle) {
  const ctx = document.getElementById(canvasId);
  return new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: "Episode", color: "#d3dacd" }, ticks: { color: "#aeb7c5" } },
        y: { title: { display: true, text: yTitle, color: "#d3dacd" }, ticks: { color: "#aeb7c5" } },
      },
    },
  });
}

function createMultiLineChart(canvasId, yTitle) {
  const chart = createLineChart(canvasId, yTitle);
  chart.options.plugins.legend.display = true;
  return chart;
}

function makeDataset(label, color, points, yKey) {
  return {
    label,
    borderColor: color,
    pointRadius: 0,
    borderWidth: 2,
    data: points.map((p) => p[yKey]),
    tension: 0.15,
    fill: false,
  };
}

function renderResult(result) {
  renderSummary(result);
  renderExperimentSelector(result);
  renderSelectedExperiment();
  renderTournament(result);
  renderSweeps(result);
  renderQTable(result);
}

function renderSummary(result) {
  const entries = Object.entries(result.summary?.experiments ?? {});
  const cards = entries
    .map(([name, metrics]) => {
      const coop = Number(metrics.tailCooperation ?? 0);
      const rew = Number(metrics.tailReward ?? 0);
      const final = Number(metrics.finalCooperation ?? 0);
      return `
        <article class="summary-card">
          <h4>${friendlyExperimentName(name)}</h4>
          <p>Trust rate (last segment): ${asPercent(coop)}</p>
          <p>Final trust rate: ${asPercent(final)}</p>
          <p>Average reward (last segment): ${rew.toFixed(3)}</p>
        </article>
      `;
    })
    .join("");
  const pop = result.summary?.population;
  const popCard =
    pop && Number(pop.episodes) > 0
      ? `
      <article class="summary-card">
        <h4>Population Mode (10 Q-learning agents)</h4>
        <p>Trust rate (last segment): ${asPercent(pop.tailCooperation ?? 0)}</p>
        <p>Average reward (last segment): ${(pop.tailReward ?? 0).toFixed(3)}</p>
        <p>Episodes run: ${pop.episodes}</p>
      </article>
    `
      : "";
  elements.summaryCards.innerHTML = cards + popCard;
}

function renderExperimentSelector(result) {
  const names = Object.keys(result.experiments ?? {});
  elements.experimentSelect.innerHTML = names
    .map((name) => `<option value="${name}">${friendlyExperimentName(name)}</option>`)
    .join("");
}

function renderSelectedExperiment() {
  const result = state.lastResult;
  if (!result) return;
  const name = elements.experimentSelect.value;
  const exp = result.experiments?.[name];
  if (!exp) return;
  const points = exp.series ?? [];
  const labels = points.map((p) => p.episode);

  state.charts.coop.data.labels = labels;
  state.charts.coop.data.datasets = [makeDataset(name, palette.primary, points, "cooperation")];
  state.charts.coop.update();

  state.charts.reward.data.labels = labels;
  state.charts.reward.data.datasets = [makeDataset(name, palette.amber, points, "jointReward")];
  state.charts.reward.update();
}

function renderTournament(result) {
  const rows = result.tournament?.leaderboard ?? [];
  elements.leaderboardBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.rank}</td>
        <td>${friendlyStrategyName(row.strategy)}</td>
        <td>${row.meanReward.toFixed(3)}</td>
        <td>${asPercent(row.meanCooperation)}</td>
      </tr>
    `
    )
    .join("");
}

function renderSweeps(result) {
  const sweeps = result.sweeps ?? {};
  const coopDatasets = [];
  const rewardDatasets = [];
  state.charts.sweepCoop.data.labels = [];
  state.charts.sweepReward.data.labels = [];
  const colorMap = {
    gamma: palette.blue,
    noise: palette.red,
    memory: palette.green,
  };
  for (const [name, points] of Object.entries(sweeps)) {
    if (!points.length) continue;
    const labels = points.map((p) => p.value);
    state.charts.sweepCoop.data.labels = labels;
    state.charts.sweepReward.data.labels = labels;
    coopDatasets.push({
      label: name === "gamma" ? "Discount Factor (gamma)" : name === "noise" ? "Noise" : "Memory",
      borderColor: colorMap[name] ?? palette.slate,
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.1,
      data: points.map((p) => p.tailCooperation),
    });
    rewardDatasets.push({
      label: name === "gamma" ? "Discount Factor (gamma)" : name === "noise" ? "Noise" : "Memory",
      borderColor: colorMap[name] ?? palette.slate,
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.1,
      data: points.map((p) => p.tailReward),
    });
  }
  state.charts.sweepCoop.data.datasets = coopDatasets;
  state.charts.sweepReward.data.datasets = rewardDatasets;
  state.charts.sweepCoop.update();
  state.charts.sweepReward.update();
}

function renderQTable(result) {
  const candidates = Object.values(result.experiments ?? {});
  let text = "No Q-table available for selected run.";
  for (const exp of candidates) {
    if (!exp.qTable || !exp.qTable.length) continue;
    const rows = exp.qTable
      .slice(0, 40)
      .map((row) => `${row.stateLabel}: C=${row.qCooperate.toFixed(3)}, D=${row.qDefect.toFixed(3)}`);
    text = rows.join("\n");
    break;
  }
  elements.qTableView.textContent = text;
}

function downloadLastResult() {
  if (!state.lastResult) return;
  const blob = new Blob([JSON.stringify(state.lastResult, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ipd_run_${state.lastResult.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.runHistory = raw ? JSON.parse(raw) : [];
  } catch {
    state.runHistory = [];
  }
  refreshCompareSelectors();
}

function appendRunHistory(result) {
  const entry = {
    id: result.id,
    createdAt: result.generatedAt,
    config: result.config,
    summary: result.summary,
  };
  state.runHistory = [entry, ...state.runHistory.filter((r) => r.id !== entry.id)].slice(0, 30);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.runHistory));
  refreshCompareSelectors();
  renderCompare();
}

function refreshCompareSelectors() {
  const options = state.runHistory.map((run) => `<option value="${run.id}">${formatRunLabel(run)}</option>`).join("");
  elements.compareA.innerHTML = options;
  elements.compareB.innerHTML = options;
  if (state.runHistory.length) {
    elements.compareA.value = state.runHistory[0].id;
    elements.compareB.value = state.runHistory[Math.min(1, state.runHistory.length - 1)].id;
  }
}

function formatRunLabel(run) {
  const t = new Date(run.createdAt);
  const stamp = Number.isNaN(t.getTime()) ? run.id : t.toLocaleString();
  return `${stamp} | ep:${run.config.episodes}, rounds:${run.config.rounds}, noise:${run.config.noise}`;
}

function getRunById(id) {
  return state.runHistory.find((run) => run.id === id);
}

function metricPair(name, a, b, options = {}) {
  const asPct = Boolean(options.percent);
  const av = Number(a ?? 0);
  const bv = Number(b ?? 0);
  const delta = av - bv;
  const cls = delta >= 0 ? "pos" : "neg";
  const sign = delta >= 0 ? "+" : "";
  const aText = asPct ? asPercent(av) : av.toFixed(3);
  const bText = asPct ? asPercent(bv) : bv.toFixed(3);
  const dText = asPct ? `${sign}${(delta * 100).toFixed(1)}%` : `${sign}${delta.toFixed(3)}`;
  return `
    <article class="compare-card">
      <h4>${name}</h4>
      <p>Run A: ${aText}</p>
      <p>Run B: ${bText}</p>
      <p class="${cls}">Delta: ${dText}</p>
    </article>
  `;
}

function renderCompare() {
  const runA = getRunById(elements.compareA.value);
  const runB = getRunById(elements.compareB.value);
  if (!runA || !runB) {
    elements.compareMetrics.innerHTML = '<article class="compare-card"><p>No runs yet. Execute experiments to build history.</p></article>';
    return;
  }
  const qA = runA.summary?.experiments?.Q_vs_Q ?? {};
  const qB = runB.summary?.experiments?.Q_vs_Q ?? {};
  const allDA = runA.summary?.experiments?.Q_vs_AllD ?? {};
  const allDB = runB.summary?.experiments?.Q_vs_AllD ?? {};
  const popA = runA.summary?.population ?? {};
  const popB = runB.summary?.population ?? {};

  elements.compareMetrics.innerHTML = [
    metricPair("Q-learning vs Q-learning: Trust Rate", qA.tailCooperation, qB.tailCooperation, { percent: true }),
    metricPair("Q-learning vs Q-learning: Reward", qA.tailReward, qB.tailReward),
    metricPair("Q-learning vs Always Defect: Trust Rate", allDA.tailCooperation, allDB.tailCooperation, { percent: true }),
    metricPair("Population Mode: Trust Rate", popA.tailCooperation, popB.tailCooperation, { percent: true }),
    metricPair("Population Mode: Reward", popA.tailReward, popB.tailReward),
  ].join("");
}

init();
