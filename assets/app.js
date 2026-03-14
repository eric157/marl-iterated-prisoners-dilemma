const STORAGE_KEY = "ipd_marl_runs_v1";

const elements = {
  runForm: document.getElementById("runForm"),
  runBtn: document.getElementById("runBtn"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  summaryCards: document.getElementById("summaryCards"),
  experimentSelect: document.getElementById("experimentSelect"),
  leaderboardBody: document.querySelector("#leaderboardTable tbody"),
  leagueTableBody: document.querySelector("#leagueTable tbody"),
  leagueMeta: document.getElementById("leagueMeta"),
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
  learningMode: document.getElementById("learningMode"),
  prosocialWeight: document.getElementById("prosocialWeight"),
  negativeAlphaScale: document.getElementById("negativeAlphaScale"),
  coopBonus: document.getElementById("coopBonus"),
  exploitPenalty: document.getElementById("exploitPenalty"),
  tieBreak: document.getElementById("tieBreak"),
  optimisticInit: document.getElementById("optimisticInit"),
  optTrials: document.getElementById("optTrials"),
  optObjective: document.getElementById("optObjective"),
  seed: document.getElementById("seed"),
  enablePopulation: document.getElementById("enablePopulation"),
  enableSweeps: document.getElementById("enableSweeps"),
  enableTournament: document.getElementById("enableTournament"),
  enableLeague: document.getElementById("enableLeague"),
  presetButtons: Array.from(document.querySelectorAll(".preset-btn[data-preset]")),
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

const PRESET_CONFIGS = {
  first_run: {
    episodes: 2000,
    rounds: 120,
    memory: 1,
    noise: 0.01,
    alpha: 0.1,
    gamma: 0.95,
    epsilon: 1,
    epsilonDecay: 0.9992,
    epsilonMin: 0.02,
    learningMode: "classic",
    prosocialWeight: 0,
    negativeAlphaScale: 1,
    coopBonus: 0,
    exploitPenalty: 0,
    tieBreak: "random",
    optimisticInit: 0,
    enablePopulation: true,
    enableSweeps: true,
    enableTournament: true,
    enableLeague: true,
  },
  high_trust: {
    episodes: 3200,
    rounds: 150,
    memory: 1,
    noise: 0.01,
    alpha: 0.1,
    gamma: 0.99,
    epsilon: 1,
    epsilonDecay: 0.9994,
    epsilonMin: 0.01,
    learningMode: "prosocial",
    prosocialWeight: 0.2,
    negativeAlphaScale: 0.35,
    coopBonus: 0.05,
    exploitPenalty: 0.06,
    tieBreak: "cooperate",
    optimisticInit: 0.9,
    enablePopulation: true,
    enableSweeps: true,
    enableTournament: true,
    enableLeague: true,
  },
  offline_best: {
    episodes: 6000,
    rounds: 150,
    memory: 1,
    noise: 0.01,
    alpha: 0.16,
    gamma: 0.95,
    epsilon: 1,
    epsilonDecay: 0.9994,
    epsilonMin: 0,
    learningMode: "oaq",
    prosocialWeight: 0.4,
    negativeAlphaScale: 0.5,
    coopBonus: 0.02,
    exploitPenalty: 0.1,
    tieBreak: "cooperate",
    optimisticInit: 0.8,
    enablePopulation: true,
    enableSweeps: true,
    enableTournament: true,
    enableLeague: true,
  },
  short_term: {
    episodes: 1800,
    rounds: 110,
    memory: 1,
    noise: 0.01,
    alpha: 0.12,
    gamma: 0.3,
    epsilon: 1,
    epsilonDecay: 0.999,
    epsilonMin: 0.03,
    learningMode: "classic",
    prosocialWeight: 0,
    negativeAlphaScale: 1,
    coopBonus: 0,
    exploitPenalty: 0,
    tieBreak: "random",
    optimisticInit: 0,
    enablePopulation: true,
    enableSweeps: true,
    enableTournament: true,
    enableLeague: true,
  },
  high_noise: {
    episodes: 2600,
    rounds: 130,
    memory: 1,
    noise: 0.1,
    alpha: 0.1,
    gamma: 0.95,
    epsilon: 1,
    epsilonDecay: 0.9992,
    epsilonMin: 0.02,
    learningMode: "prosocial",
    prosocialWeight: 0.18,
    negativeAlphaScale: 0.4,
    coopBonus: 0.03,
    exploitPenalty: 0.05,
    tieBreak: "cooperate",
    optimisticInit: 0.6,
    enablePopulation: true,
    enableSweeps: true,
    enableTournament: true,
    enableLeague: true,
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

function learningModeLabel(mode) {
  if (mode === "prosocial") return "Cooperative Q-learning";
  if (mode === "oaq") return "Opponent-Aware Q-learning (OAQ)";
  return "Classic Q-learning";
}

function learningModeShortLabel(mode) {
  if (mode === "prosocial") return "coop-Q";
  if (mode === "oaq") return "oaq";
  return "classic-Q";
}

function init() {
  initCharts();
  loadHistory();
  bindEvents();
  syncLearningControls();
  setProgress(0, "Idle");
  renderCompare();
}

function bindEvents() {
  elements.runForm.addEventListener("submit", onRun);
  elements.optimizeBtn.addEventListener("click", onOptimize);
  elements.cancelBtn.addEventListener("click", cancelRun);
  elements.downloadBtn.addEventListener("click", downloadLastResult);
  elements.experimentSelect.addEventListener("change", renderSelectedExperiment);
  elements.compareA.addEventListener("change", renderCompare);
  elements.compareB.addEventListener("change", renderCompare);
  elements.learningMode.addEventListener("change", syncLearningControls);
  elements.presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
  });
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
    learningMode: String(elements.learningMode.value),
    prosocialWeight: Number(elements.prosocialWeight.value),
    negativeAlphaScale: Number(elements.negativeAlphaScale.value),
    coopBonus: Number(elements.coopBonus.value),
    exploitPenalty: Number(elements.exploitPenalty.value),
    tieBreak: String(elements.tieBreak.value),
    optimisticInit: Number(elements.optimisticInit.value),
    seed: Number(elements.seed.value),
    experiments: getSelectedExperiments(),
    enablePopulation: elements.enablePopulation.checked,
    enableSweeps: elements.enableSweeps.checked,
    enableTournament: elements.enableTournament.checked,
    enableLeague: elements.enableLeague.checked,
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
  if (!["classic", "prosocial", "oaq"].includes(cfg.learningMode)) {
    throw new Error("Learning mode must be classic, prosocial, or OAQ.");
  }
  if (cfg.learningMode !== "classic" && (cfg.prosocialWeight < 0 || cfg.prosocialWeight > 0.8)) {
    throw new Error("Prosocial weight must be in [0, 0.8].");
  }
}

function getOptimizationSearch() {
  const trials = Number(elements.optTrials.value);
  const objective = String(elements.optObjective.value || "balanced");
  return {
    trials: Number.isFinite(trials) ? trials : 18,
    objective: ["balanced", "cooperation", "reward"].includes(objective) ? objective : "balanced",
  };
}

function syncLearningControls() {
  const prosocial = elements.learningMode.value !== "classic";
  const ids = ["prosocialWeight", "negativeAlphaScale", "coopBonus", "exploitPenalty"];
  ids.forEach((id) => {
    const el = elements[id];
    if (!el) return;
    el.disabled = !prosocial;
    el.closest("label")?.classList.toggle("is-disabled", !prosocial);
  });
  if (!prosocial) {
    elements.prosocialWeight.value = "0";
    elements.negativeAlphaScale.value = "1";
    elements.coopBonus.value = "0";
    elements.exploitPenalty.value = "0";
    if (elements.tieBreak.value === "cooperate") {
      elements.tieBreak.value = "random";
    }
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

function onOptimize() {
  if (state.running) return;
  try {
    const cfg = getRunConfig();
    const search = getOptimizationSearch();
    validateConfig(cfg);
    startOptimize(cfg, search);
  } catch (err) {
    setProgress(0, `Cannot optimize: ${err.message}`);
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
  elements.optimizeBtn.disabled = true;
  elements.cancelBtn.disabled = false;
  elements.downloadBtn.disabled = true;
  setProgress(0, "Starting simulation...");
  state.worker.postMessage({ type: "run", config });
}

function startOptimize(config, search) {
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
  elements.optimizeBtn.disabled = true;
  elements.cancelBtn.disabled = false;
  elements.downloadBtn.disabled = true;
  setProgress(1, "Launching auto-optimizer...");
  state.worker.postMessage({ type: "optimize", config, search });
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
  elements.optimizeBtn.disabled = false;
  elements.cancelBtn.disabled = true;
  elements.downloadBtn.disabled = !success || !state.lastResult;
}

function handleWorkerMessage(event) {
  const payload = event.data;
  if (!payload || typeof payload !== "object") return;
  if (payload.type === "progress") {
    setProgress(payload.progress ?? 0, friendlyProgressMessage(payload.message ?? "Running..."));
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
    return;
  }
  if (payload.type === "optimized") {
    const result = payload.result ?? {};
    if (payload.optimization && !result.optimization) {
      result.optimization = payload.optimization;
    }
    state.lastResult = result;
    renderResult(result);
    appendRunHistory(result);
    setProgress(100, "Optimization completed.");
    finishRun(true);
  }
}

function setProgress(percent, text) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  elements.progressFill.style.width = `${p}%`;
  elements.progressText.textContent = text;
}

function initCharts() {
  state.charts.coop = createLineChart("coopChart", "Trust Rate");
  state.charts.reward = createLineChart("rewardChart", "Average Reward");
  state.charts.sweepCoop = createMultiLineChart("sweepCoopChart", "Final Trust Rate");
  state.charts.sweepReward = createMultiLineChart("sweepRewardChart", "Final Average Reward");
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
  renderLeague(result);
  renderSweeps(result);
  renderQTable(result);
}

function renderSummary(result) {
  const entries = Object.entries(result.summary?.experiments ?? {});
  const overall = Number(result.summary?.overallScore ?? 0);
  const mode = result.config?.learningMode ?? "classic";
  const headCard = `
    <article class="summary-card summary-highlight">
      <h4>Run Quality Score</h4>
      <p><strong>${overall.toFixed(2)} / 100</strong></p>
      <p>Learning mode: ${learningModeLabel(mode)}</p>
      <p>${overall >= 72 ? "Strong long-run cooperation profile." : overall >= 55 ? "Moderate cooperation profile." : "Defection pressure remains high."}</p>
    </article>
  `;
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
          <p>${interpretTrust(coop)}</p>
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
        <p>${interpretTrust(pop.tailCooperation ?? 0)}</p>
      </article>
    `
      : "";
  const league = result.league;
  const leagueSummary = result.summary?.league;
  const leagueCard =
    league && Number(league.trainingSummary?.episodes) > 0
      ? `
      <article class="summary-card">
        <h4>League Training (Mixed Opponents)</h4>
        <p>League score: ${Number(leagueSummary?.leagueScore ?? league.leagueScore ?? 0).toFixed(2)}</p>
        <p>Training trust (tail): ${asPercent(leagueSummary?.tailCooperation ?? league.trainingSummary?.tailCooperation ?? 0)}</p>
        <p>Training reward (tail): ${Number(leagueSummary?.tailReward ?? league.trainingSummary?.tailReward ?? 0).toFixed(3)}</p>
        <p>Self-play trust after league: ${asPercent(
          league.evaluation?.find((row) => row.key === "self")?.tailCooperation ?? 0
        )}</p>
      </article>
    `
      : "";
  const opt = result.optimization;
  const optCard = opt
    ? `
      <article class="summary-card">
        <h4>Auto-Optimizer Result</h4>
        <p>Objective: ${formatObjective(opt.objective)}</p>
        <p>Trials tested: ${opt.trials}</p>
        <p>Best search score: ${Number(opt.bestScore ?? 0).toFixed(2)}</p>
        <p>Best mode: ${learningModeLabel(opt.bestConfig?.learningMode)}</p>
        <p>alpha=${Number(opt.bestConfig?.alpha ?? 0).toFixed(3)}, gamma=${Number(opt.bestConfig?.gamma ?? 0).toFixed(3)}</p>
      </article>
    `
    : "";
  elements.summaryCards.innerHTML = headCard + cards + popCard + leagueCard + optCard;
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
  state.charts.coop.data.datasets = [makeDataset(friendlyExperimentName(name), palette.primary, points, "cooperation")];
  state.charts.coop.update();

  state.charts.reward.data.labels = labels;
  state.charts.reward.data.datasets = [makeDataset(friendlyExperimentName(name), palette.amber, points, "jointReward")];
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

function friendlyLeagueOpponent(key) {
  if (key === "self") return "Self-play";
  if (key === "allc") return "Always Cooperate (AllC)";
  if (key === "alld") return "Always Defect (AllD)";
  if (key === "random") return "Random";
  if (key === "tft") return "Tit For Tat (TFT)";
  if (key === "grim") return "Grim Trigger";
  if (key === "copykitten") return "Copykitten";
  return key ?? "Unknown";
}

function renderLeague(result) {
  if (!elements.leagueTableBody || !elements.leagueMeta) return;
  const league = result.league;
  if (
    !league ||
    Number(league.trainingSummary?.episodes ?? 0) <= 0 ||
    !Array.isArray(league.evaluation) ||
    !league.evaluation.length
  ) {
    elements.leagueTableBody.innerHTML = "";
    elements.leagueMeta.textContent = "League not run in this simulation. Enable League training and run again.";
    return;
  }

  elements.leagueTableBody.innerHTML = league.evaluation
    .map((row) => {
      const key = String(row.key || "").toLowerCase();
      return `
      <tr>
        <td>${friendlyLeagueOpponent(key)}</td>
        <td>${asPercent(row.tailCooperation)}</td>
        <td>${Number(row.tailReward ?? 0).toFixed(3)}</td>
      </tr>
    `;
    })
    .join("");

  const t = league.trainingSummary ?? {};
  const counts = Object.entries(t.opponentCounts ?? {})
    .map(([k, v]) => `${friendlyLeagueOpponent(k)}: ${v}`)
    .join(" · ");
  elements.leagueMeta.textContent = `League score: ${Number(league.leagueScore ?? 0).toFixed(2)} | Training tail trust: ${asPercent(
    t.tailCooperation
  )} | Training tail reward: ${Number(t.tailReward ?? 0).toFixed(3)}${counts ? ` | Opponent mix: ${counts}` : ""}`;
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
    optimization: result.optimization ?? null,
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
  const mode = learningModeShortLabel(run.config?.learningMode);
  const score = deriveOverallScore(run.summary).toFixed(1);
  return `${stamp} | ${mode} | score:${score} | ep:${run.config.episodes}, rounds:${run.config.rounds}, noise:${run.config.noise}`;
}

function getRunById(id) {
  return state.runHistory.find((run) => run.id === id);
}

function deriveOverallScore(summary) {
  if (!summary) return 0;
  const stored = Number(summary.overallScore);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const ex = summary.experiments ?? {};
  const pop = summary.population ?? {};
  const qvq = ex.Q_vs_Q ?? {};
  const qvtft = ex.Q_vs_TFT ?? {};
  const qalld = ex.Q_vs_AllD ?? {};
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const qvqCoop = clamp01(qvq.tailCooperation);
  const qvqRewardNorm = clamp01((Number(qvq.tailReward) || 0) / 3);
  const qvtftCoop = clamp01(qvtft.tailCooperation);
  const qalldCoop = clamp01(qalld.tailCooperation);
  const popCoop = clamp01(pop.tailCooperation);
  const popRewardNorm = clamp01((Number(pop.tailReward) || 0) / 3);
  return (
    (0.38 * qvqCoop +
      0.18 * qvqRewardNorm +
      0.18 * qvtftCoop +
      0.08 * (1 - qalldCoop) +
      0.12 * popCoop +
      0.06 * popRewardNorm) *
    100
  );
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

function applyPreset(presetKey) {
  const preset = PRESET_CONFIGS[presetKey];
  if (!preset) return;
  elements.episodes.value = preset.episodes;
  elements.rounds.value = preset.rounds;
  elements.memory.value = preset.memory;
  elements.noise.value = preset.noise;
  elements.alpha.value = preset.alpha;
  elements.gamma.value = preset.gamma;
  elements.epsilon.value = preset.epsilon;
  elements.epsilonDecay.value = preset.epsilonDecay;
  elements.epsilonMin.value = preset.epsilonMin;
  elements.learningMode.value = preset.learningMode;
  elements.prosocialWeight.value = preset.prosocialWeight;
  elements.negativeAlphaScale.value = preset.negativeAlphaScale;
  elements.coopBonus.value = preset.coopBonus;
  elements.exploitPenalty.value = preset.exploitPenalty;
  elements.tieBreak.value = preset.tieBreak;
  elements.optimisticInit.value = preset.optimisticInit;
  elements.enablePopulation.checked = preset.enablePopulation;
  elements.enableSweeps.checked = preset.enableSweeps;
  elements.enableTournament.checked = preset.enableTournament;
  elements.enableLeague.checked = preset.enableLeague !== false;
  syncLearningControls();
  setProgress(0, `Preset loaded: ${presetLabel(presetKey)}. Click Start Simulation.`);
}

function presetLabel(key) {
  if (key === "first_run") return "First Run";
  if (key === "high_trust") return "Long-Term Trust";
  if (key === "offline_best") return "Offline Best (OAQ)";
  if (key === "short_term") return "Short-Term Selfish";
  if (key === "high_noise") return "Miscommunication Stress Test";
  return key;
}

function formatObjective(objective) {
  if (objective === "cooperation") return "Max cooperation";
  if (objective === "reward") return "Max reward";
  return "Balanced";
}

function interpretTrust(value) {
  const v = Number(value ?? 0);
  if (v >= 0.75) return "Interpretation: strong cooperative equilibrium.";
  if (v >= 0.55) return "Interpretation: mixed but mostly cooperative behavior.";
  if (v >= 0.35) return "Interpretation: unstable balance between trust and betrayal.";
  return "Interpretation: defection-heavy dynamics.";
}

function friendlyProgressMessage(message) {
  const map = {
    "Running Q_vs_AllC...": "Running: Q-learning vs Always Cooperate...",
    "Running Q_vs_AllD...": "Running: Q-learning vs Always Defect...",
    "Running Q_vs_Random...": "Running: Q-learning vs Random...",
    "Running Q_vs_TFT...": "Running: Q-learning vs Tit For Tat...",
    "Running Q_vs_Grim...": "Running: Q-learning vs Grim Trigger...",
    "Running Q_vs_Q...": "Running: Q-learning vs Q-learning...",
    "Running gamma sweep...": "Testing discount factor impact...",
    "Running noise sweep...": "Testing miscommunication impact...",
    "Running memory sweep...": "Testing memory length impact...",
    "Running baseline tournament...": "Running strategy tournament...",
    "Running population simulation...": "Running population simulation...",
    "Running league training...": "Training against mixed opponents (league mode)...",
    "Running league evaluation...": "Evaluating league-trained policy...",
  };
  if (message.startsWith("Auto-optimizing:")) return message;
  if (message.startsWith("Best config:")) {
    const raw = message.replace("Best config: ", "");
    return `Final best-config validation: ${map[raw] ?? raw}`;
  }
  return map[message] ?? message;
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
  const leagueA = runA.summary?.league ?? {};
  const leagueB = runB.summary?.league ?? {};
  const scoreA = deriveOverallScore(runA.summary);
  const scoreB = deriveOverallScore(runB.summary);
  const modeA = learningModeLabel(runA.config?.learningMode);
  const modeB = learningModeLabel(runB.config?.learningMode);
  const optA = runA.optimization?.bestScore ?? null;
  const optB = runB.optimization?.bestScore ?? null;

  elements.compareMetrics.innerHTML = [
    metricPair("Overall Run Quality Score", scoreA, scoreB),
    `<article class="compare-card">
      <h4>Learning Mode</h4>
      <p>Run A: ${modeA}</p>
      <p>Run B: ${modeB}</p>
      <p>${modeA === modeB ? "Both runs used the same learning mode." : "Different learning modes were used."}</p>
    </article>`,
    metricPair("Q-learning vs Q-learning: Trust Rate", qA.tailCooperation, qB.tailCooperation, { percent: true }),
    metricPair("Q-learning vs Q-learning: Reward", qA.tailReward, qB.tailReward),
    metricPair("Q-learning vs Always Defect: Trust Rate", allDA.tailCooperation, allDB.tailCooperation, { percent: true }),
    metricPair("Population Mode: Trust Rate", popA.tailCooperation, popB.tailCooperation, { percent: true }),
    metricPair("Population Mode: Reward", popA.tailReward, popB.tailReward),
    metricPair("League Training: Tail Trust Rate", leagueA.tailCooperation, leagueB.tailCooperation, { percent: true }),
    metricPair("League Score", leagueA.leagueScore, leagueB.leagueScore),
    `<article class="compare-card">
      <h4>Auto-Optimizer</h4>
      <p>Run A best score: ${optA === null ? "N/A" : Number(optA).toFixed(2)}</p>
      <p>Run B best score: ${optB === null ? "N/A" : Number(optB).toFixed(2)}</p>
      <p>Only available when Auto Optimize was used.</p>
    </article>`,
  ].join("");
}

init();
