const COOPERATE = 0;
const DEFECT = 1;

const ACTION_CHAR = {
  [COOPERATE]: "C",
  [DEFECT]: "D",
};

const EXPERIMENT_DEFS = {
  q_vs_allc: { name: "Q_vs_AllC", a: "q", b: "allc" },
  q_vs_alld: { name: "Q_vs_AllD", a: "q", b: "alld" },
  q_vs_random: { name: "Q_vs_Random", a: "q", b: "random" },
  q_vs_tft: { name: "Q_vs_TFT", a: "q", b: "tft" },
  q_vs_grim: { name: "Q_vs_Grim", a: "q", b: "grim" },
  q_vs_q: { name: "Q_vs_Q", a: "q", b: "q" },
};

self.onmessage = (event) => {
  const payload = event.data;
  if (!payload || typeof payload !== "object") return;
  try {
    if (payload.type === "run") {
      const result = runAll(payload.config);
      self.postMessage({ type: "done", result });
      return;
    }
    if (payload.type === "optimize") {
      const out = runOptimization(payload.config, payload.search);
      self.postMessage({ type: "optimized", result: out.result, optimization: out.optimization });
    }
  } catch (err) {
    self.postMessage({ type: "error", message: err?.message ?? "Unknown worker error" });
  }
};

function clamp(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function normalizeConfig(rawConfig = {}) {
  const learningMode = rawConfig.learningMode === "prosocial" ? "prosocial" : "classic";
  const prosocialWeight = clamp(rawConfig.prosocialWeight, 0, 0.8, 0);
  const negativeAlphaScale = clamp(rawConfig.negativeAlphaScale, 0.05, 1, 1);
  const coopBonus = clamp(rawConfig.coopBonus, 0, 0.3, 0);
  const exploitPenalty = clamp(rawConfig.exploitPenalty, 0, 0.5, 0);
  const tieBreak = rawConfig.tieBreak === "cooperate" ? "cooperate" : "random";
  const optimisticInit = clamp(rawConfig.optimisticInit, -2, 12, 0);
  const seed = Math.max(1, Math.floor(Number(rawConfig.seed) || 42));
  const experiments = Array.isArray(rawConfig.experiments) ? rawConfig.experiments : [];

  return {
    episodes: Math.max(50, Math.floor(Number(rawConfig.episodes) || 2000)),
    rounds: Math.max(20, Math.floor(Number(rawConfig.rounds) || 120)),
    memory: clamp(rawConfig.memory, 1, 5, 1),
    noise: clamp(rawConfig.noise, 0, 0.25, 0.01),
    alpha: clamp(rawConfig.alpha, 0.01, 1, 0.1),
    gamma: clamp(rawConfig.gamma, 0.1, 0.999, 0.95),
    epsilon: clamp(rawConfig.epsilon, 0, 1, 1),
    epsilonDecay: clamp(rawConfig.epsilonDecay, 0.9, 1, 0.9992),
    epsilonMin: clamp(rawConfig.epsilonMin, 0, 1, 0.02),
    seed,
    learningMode,
    prosocialWeight: learningMode === "prosocial" ? prosocialWeight : 0,
    negativeAlphaScale,
    coopBonus: learningMode === "prosocial" ? coopBonus : 0,
    exploitPenalty: learningMode === "prosocial" ? exploitPenalty : 0,
    tieBreak,
    optimisticInit,
    experiments,
    enableSweeps: Boolean(rawConfig.enableSweeps),
    enableTournament: Boolean(rawConfig.enableTournament),
    enablePopulation: rawConfig.enablePopulation !== false,
  };
}

function hashSeed(seed) {
  const s = String(seed ?? "42");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let t = hashSeed(seed) || 123456789;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randint(rng, min, maxInclusive) {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function shuffleInPlace(values, rng) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

function encodeJointAction(actionA, actionB) {
  return (actionA << 1) | actionB;
}

function decodeJointAction(encoded) {
  return [(encoded >> 1) & 1, encoded & 1];
}

function getReward(actionA, actionB) {
  if (actionA === COOPERATE && actionB === COOPERATE) return [3, 3];
  if (actionA === COOPERATE && actionB === DEFECT) return [0, 5];
  if (actionA === DEFECT && actionB === COOPERATE) return [5, 0];
  return [1, 1];
}

class IPDEnvironment {
  constructor(memory, noise, rng) {
    this.memory = memory;
    this.noise = noise;
    this.rng = rng;
    this.history = [];
  }

  reset() {
    this.history = [];
    const initial = encodeJointAction(COOPERATE, COOPERATE);
    for (let i = 0; i < this.memory; i += 1) this.history.push(initial);
    return this.encodeState();
  }

  encodeState() {
    let state = 0;
    for (let i = 0; i < this.history.length; i += 1) {
      state = state * 4 + this.history[i];
    }
    return state;
  }

  decodeState(state) {
    const arr = new Array(this.memory).fill(0);
    let value = state;
    for (let i = this.memory - 1; i >= 0; i -= 1) {
      arr[i] = value % 4;
      value = Math.floor(value / 4);
    }
    return arr;
  }

  applyNoise(action) {
    if (this.rng() < this.noise) return 1 - action;
    return action;
  }

  step(actionA, actionB) {
    const execA = this.applyNoise(actionA);
    const execB = this.applyNoise(actionB);
    const reward = getReward(execA, execB);
    this.history.push(encodeJointAction(execA, execB));
    if (this.history.length > this.memory) this.history.shift();
    return {
      nextState: this.encodeState(),
      rewardA: reward[0],
      rewardB: reward[1],
      execA,
      execB,
    };
  }
}

function tailMean(values, key, frac = 0.1) {
  if (!values.length) return 0;
  const k = Math.max(1, Math.floor(values.length * frac));
  const tail = values.slice(-k);
  let sum = 0;
  for (const row of tail) sum += row[key];
  return sum / tail.length;
}

function downsampleSeries(series, maxPoints = 550) {
  if (series.length <= maxPoints) return series;
  const step = Math.ceil(series.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < series.length; i += step) sampled.push(series[i]);
  if (sampled[sampled.length - 1]?.episode !== series[series.length - 1].episode) {
    sampled.push(series[series.length - 1]);
  }
  return sampled;
}

function stateLabel(env, state) {
  return env
    .decodeState(state)
    .map((joint) => {
      const [a, b] = decodeJointAction(joint);
      return `${ACTION_CHAR[a]}${ACTION_CHAR[b]}`;
    })
    .join(" | ");
}

function createQAgent(stateSize, cfg, rng, name = "Q") {
  const init = cfg.optimisticInit ?? 0;
  const cooperateInit = cfg.learningMode === "prosocial" ? init + cfg.coopBonus * 2 : init;
  const defectInit = cfg.learningMode === "prosocial" ? init - cfg.exploitPenalty : init;
  const q = Array.from({ length: stateSize }, () => [cooperateInit, defectInit]);
  let epsilon = cfg.epsilon;
  return {
    type: "q",
    name,
    reset() {},
    act(obs) {
      if (rng() < epsilon) return rng() < 0.5 ? COOPERATE : DEFECT;
      const row = q[obs.state];
      if (Math.abs(row[0] - row[1]) < 1e-10) {
        if (cfg.tieBreak === "cooperate") return COOPERATE;
        return rng() < 0.5 ? COOPERATE : DEFECT;
      }
      return row[0] > row[1] ? COOPERATE : DEFECT;
    },
    observe(obs, action, reward, nextObs, done, aux = null) {
      let effectiveReward = reward;
      if (cfg.learningMode === "prosocial" && aux) {
        const oppReward = Number(aux.opponentReward ?? reward);
        effectiveReward = (1 - cfg.prosocialWeight) * reward + cfg.prosocialWeight * oppReward;
        if (aux.ownAction === COOPERATE && aux.oppAction === COOPERATE) {
          effectiveReward += cfg.coopBonus;
        } else if (aux.ownAction === DEFECT && aux.oppAction === COOPERATE) {
          effectiveReward -= cfg.exploitPenalty;
        }
      }
      const current = q[obs.state][action];
      const nextBest = done ? 0 : Math.max(q[nextObs.state][0], q[nextObs.state][1]);
      const target = effectiveReward + cfg.gamma * nextBest;
      const tdError = target - current;
      const lr = tdError < 0 ? cfg.alpha * cfg.negativeAlphaScale : cfg.alpha;
      q[obs.state][action] = current + lr * tdError;
    },
    endEpisode() {
      epsilon = Math.max(cfg.epsilonMin, epsilon * cfg.epsilonDecay);
    },
    epsilon() {
      return epsilon;
    },
    exportQTable(env) {
      return q.map((row, state) => ({
        state,
        stateLabel: stateLabel(env, state),
        qCooperate: row[COOPERATE],
        qDefect: row[DEFECT],
        preferred: row[COOPERATE] >= row[DEFECT] ? "C" : "D",
      }));
    },
  };
}

function createHeuristicAgent(kind, rng, name = kind) {
  const state = {
    grimTriggered: false,
    pavlovMove: COOPERATE,
    pavlovLastOutcome: null,
  };
  return {
    type: kind,
    name,
    reset() {
      state.grimTriggered = false;
      state.pavlovMove = COOPERATE;
      state.pavlovLastOutcome = null;
    },
    act(obs) {
      const oppHist = obs.opponentHistory;
      const n = oppHist.length;
      const lastOpp = n ? oppHist[n - 1] : null;
      if (kind === "allc") return COOPERATE;
      if (kind === "alld") return DEFECT;
      if (kind === "random") return rng() < 0.5 ? COOPERATE : DEFECT;
      if (kind === "tft") return lastOpp === null ? COOPERATE : lastOpp;
      if (kind === "grim") {
        if (state.grimTriggered) return DEFECT;
        if (lastOpp === DEFECT) {
          state.grimTriggered = true;
          return DEFECT;
        }
        return COOPERATE;
      }
      if (kind === "copykitten") {
        if (n < 2) return COOPERATE;
        return oppHist[n - 1] === DEFECT && oppHist[n - 2] === DEFECT ? DEFECT : COOPERATE;
      }
      return COOPERATE;
    },
    observe(_obs, _action, _reward, _nextObs, _done) {},
    endEpisode() {},
  };
}

function createAgent(agentKind, cfg, rng, stateSize, name) {
  if (agentKind === "q") return createQAgent(stateSize, cfg, rng, name);
  return createHeuristicAgent(agentKind, rng, name);
}

function runExperiment(definition, config, seedOffset, progress) {
  const rng = makeRng(config.seed + seedOffset * 104729);
  const env = new IPDEnvironment(config.memory, config.noise, rng);
  const stateSize = 4 ** config.memory;
  const agentA = createAgent(definition.a, config, rng, stateSize, "A");
  const agentB = createAgent(definition.b, config, rng, stateSize, "B");

  const episodes = [];
  for (let episode = 0; episode < config.episodes; episode += 1) {
    agentA.reset();
    agentB.reset();

    let state = env.reset();
    const historyA = [];
    const historyB = [];
    let totalRewardA = 0;
    let totalRewardB = 0;
    let coopActions = 0;

    for (let round = 0; round < config.rounds; round += 1) {
      const obsA = {
        state,
        round,
        ownHistory: historyA,
        opponentHistory: historyB,
      };
      const obsB = {
        state,
        round,
        ownHistory: historyB,
        opponentHistory: historyA,
      };

      const actionA = agentA.act(obsA);
      const actionB = agentB.act(obsB);
      const step = env.step(actionA, actionB);

      const nextObsA = {
        state: step.nextState,
        round: round + 1,
        ownHistory: historyA.concat(step.execA),
        opponentHistory: historyB.concat(step.execB),
      };
      const nextObsB = {
        state: step.nextState,
        round: round + 1,
        ownHistory: historyB.concat(step.execB),
        opponentHistory: historyA.concat(step.execA),
      };

      const done = round === config.rounds - 1;
      agentA.observe(obsA, actionA, step.rewardA, nextObsA, done, {
        ownAction: step.execA,
        oppAction: step.execB,
        opponentReward: step.rewardB,
      });
      agentB.observe(obsB, actionB, step.rewardB, nextObsB, done, {
        ownAction: step.execB,
        oppAction: step.execA,
        opponentReward: step.rewardA,
      });

      historyA.push(step.execA);
      historyB.push(step.execB);
      totalRewardA += step.rewardA;
      totalRewardB += step.rewardB;
      coopActions += (step.execA === COOPERATE ? 1 : 0) + (step.execB === COOPERATE ? 1 : 0);
      state = step.nextState;
    }

    agentA.endEpisode();
    agentB.endEpisode();

    episodes.push({
      episode,
      cooperation: coopActions / (2 * config.rounds),
      jointReward: (totalRewardA + totalRewardB) / (2 * config.rounds),
    });
    progress();
  }

  const summary = {
    finalCooperation: episodes[episodes.length - 1]?.cooperation ?? 0,
    tailCooperation: tailMean(episodes, "cooperation"),
    tailReward: tailMean(episodes, "jointReward"),
  };

  const qTable = agentA.type === "q" ? agentA.exportQTable(env) : agentB.type === "q" ? agentB.exportQTable(env) : [];
  return {
    name: definition.name,
    series: downsampleSeries(episodes),
    summary,
    qTable,
  };
}

function runBaselineTournament(config, seedOffset, progress) {
  const rng = makeRng(config.seed + seedOffset * 2654435761);
  const strategies = ["allc", "alld", "random", "tft", "grim", "copykitten"];
  const rounds = Math.max(40, Math.min(220, config.rounds));

  const totals = {};
  const coops = {};
  const counts = {};
  for (const s of strategies) {
    totals[s] = 0;
    coops[s] = 0;
    counts[s] = 0;
  }

  for (let i = 0; i < strategies.length; i += 1) {
    for (let j = 0; j < strategies.length; j += 1) {
      if (i === j) continue;
      const agentA = createHeuristicAgent(strategies[i], rng);
      const agentB = createHeuristicAgent(strategies[j], rng);
      const env = new IPDEnvironment(1, config.noise, rng);
      agentA.reset();
      agentB.reset();

      let state = env.reset();
      const historyA = [];
      const historyB = [];
      let rewardA = 0;
      let rewardB = 0;
      let coopA = 0;
      let coopB = 0;

      for (let r = 0; r < rounds; r += 1) {
        const a = agentA.act({ state, ownHistory: historyA, opponentHistory: historyB, round: r });
        const b = agentB.act({ state, ownHistory: historyB, opponentHistory: historyA, round: r });
        const step = env.step(a, b);
        historyA.push(step.execA);
        historyB.push(step.execB);
        rewardA += step.rewardA;
        rewardB += step.rewardB;
        coopA += step.execA === COOPERATE ? 1 : 0;
        coopB += step.execB === COOPERATE ? 1 : 0;
        state = step.nextState;
      }

      totals[strategies[i]] += rewardA / rounds;
      totals[strategies[j]] += rewardB / rounds;
      coops[strategies[i]] += coopA / rounds;
      coops[strategies[j]] += coopB / rounds;
      counts[strategies[i]] += 1;
      counts[strategies[j]] += 1;
      progress();
    }
  }

  const leaderboard = strategies
    .map((strategy) => ({
      strategy: strategy.toUpperCase(),
      meanReward: totals[strategy] / Math.max(1, counts[strategy]),
      meanCooperation: coops[strategy] / Math.max(1, counts[strategy]),
    }))
    .sort((a, b) => b.meanReward - a.meanReward)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return { leaderboard };
}

function runSweepSet(config, key, values, def, seedOffset, progress) {
  const rows = [];
  const sweepEpisodes = Math.max(180, Math.floor(config.episodes / 4));
  const sweepRounds = Math.max(50, Math.min(config.rounds, 110));
  for (let idx = 0; idx < values.length; idx += 1) {
    const value = values[idx];
    const override = {
      ...config,
      episodes: sweepEpisodes,
      rounds: sweepRounds,
    };
    if (key === "gamma") override.gamma = value;
    if (key === "noise") override.noise = value;
    if (key === "memory") override.memory = value;
    const run = runExperiment(def, override, seedOffset + idx + 1, progress);
    rows.push({
      value,
      tailCooperation: run.summary.tailCooperation,
      tailReward: run.summary.tailReward,
    });
  }
  return rows;
}

function runPopulation(config, seedOffset, progress) {
  const rng = makeRng(config.seed + seedOffset * 122949829);
  const nAgents = 10;
  const minPopulationEpisodes = Number.isFinite(config.populationMinEpisodes) ? Math.max(20, Math.floor(config.populationMinEpisodes)) : 160;
  const episodes = Math.max(minPopulationEpisodes, Math.floor(config.episodes / 5));
  const rounds = Math.max(60, Math.min(config.rounds, 110));
  const stateSize = 4 ** config.memory;
  const agents = [];
  for (let i = 0; i < nAgents; i += 1) {
    agents.push(createQAgent(stateSize, config, rng, `Q_${i}`));
  }
  const env = new IPDEnvironment(config.memory, config.noise, rng);
  const series = [];

  for (let episode = 0; episode < episodes; episode += 1) {
    const order = Array.from({ length: nAgents }, (_, idx) => idx);
    shuffleInPlace(order, rng);
    let coopMean = 0;
    let rewardMean = 0;
    let matches = 0;

    for (let p = 0; p < nAgents; p += 2) {
      const idxA = order[p];
      const idxB = order[p + 1];
      const agentA = agents[idxA];
      const agentB = agents[idxB];
      agentA.reset();
      agentB.reset();
      let state = env.reset();
      const histA = [];
      const histB = [];
      let rewardsA = 0;
      let rewardsB = 0;
      let coopActions = 0;

      for (let r = 0; r < rounds; r += 1) {
        const obsA = { state, round: r, ownHistory: histA, opponentHistory: histB };
        const obsB = { state, round: r, ownHistory: histB, opponentHistory: histA };
        const actionA = agentA.act(obsA);
        const actionB = agentB.act(obsB);
        const step = env.step(actionA, actionB);
        const done = r === rounds - 1;
        const nextObsA = { state: step.nextState, round: r + 1, ownHistory: histA.concat(step.execA), opponentHistory: histB.concat(step.execB) };
        const nextObsB = { state: step.nextState, round: r + 1, ownHistory: histB.concat(step.execB), opponentHistory: histA.concat(step.execA) };
        agentA.observe(obsA, actionA, step.rewardA, nextObsA, done, {
          ownAction: step.execA,
          oppAction: step.execB,
          opponentReward: step.rewardB,
        });
        agentB.observe(obsB, actionB, step.rewardB, nextObsB, done, {
          ownAction: step.execB,
          oppAction: step.execA,
          opponentReward: step.rewardA,
        });
        histA.push(step.execA);
        histB.push(step.execB);
        rewardsA += step.rewardA;
        rewardsB += step.rewardB;
        coopActions += (step.execA === COOPERATE ? 1 : 0) + (step.execB === COOPERATE ? 1 : 0);
        state = step.nextState;
      }
      agentA.endEpisode();
      agentB.endEpisode();
      matches += 1;
      coopMean += coopActions / (2 * rounds);
      rewardMean += (rewardsA + rewardsB) / (2 * rounds);
    }
    series.push({
      episode,
      cooperation: coopMean / matches,
      jointReward: rewardMean / matches,
    });
    progress();
  }

  return {
    series: downsampleSeries(series),
    summary: {
      tailCooperation: tailMean(series, "cooperation"),
      tailReward: tailMean(series, "jointReward"),
      episodes,
    },
  };
}

function estimateTotalSteps(config) {
  const sweepEpisodes = config.enableSweeps ? Math.max(180, Math.floor(config.episodes / 4)) : 0;
  const populationEpisodes = config.enablePopulation ? Math.max(160, Math.floor(config.episodes / 5)) : 0;
  let totalSteps = config.experiments.length * config.episodes;
  if (config.enableSweeps) totalSteps += sweepEpisodes * (4 + 4 + 3);
  if (config.enablePopulation) totalSteps += populationEpisodes;
  if (config.enableTournament) totalSteps += 30;
  return Math.max(1, totalSteps);
}

function computeOverallScore(summaryExperiments, populationSummary) {
  const qvq = summaryExperiments?.Q_vs_Q ?? {};
  const qvtft = summaryExperiments?.Q_vs_TFT ?? {};
  const qalld = summaryExperiments?.Q_vs_AllD ?? {};
  const pop = populationSummary ?? {};

  const qvqCoop = clamp(qvq.tailCooperation, 0, 1, 0);
  const qvtftCoop = clamp(qvtft.tailCooperation, 0, 1, 0);
  const qalldCoop = clamp(qalld.tailCooperation, 0, 1, 0);
  const popCoop = clamp(pop.tailCooperation, 0, 1, 0);
  const qvqRewardNorm = clamp((Number(qvq.tailReward) || 0) / 3, 0, 1, 0);
  const popRewardNorm = clamp((Number(pop.tailReward) || 0) / 3, 0, 1, 0);

  const score01 =
    0.38 * qvqCoop +
    0.18 * qvqRewardNorm +
    0.18 * qvtftCoop +
    0.08 * (1 - qalldCoop) +
    0.12 * popCoop +
    0.06 * popRewardNorm;
  return score01 * 100;
}

function computeOptimizationScore(summaryExperiments, populationSummary, objective) {
  const qvq = summaryExperiments?.Q_vs_Q ?? {};
  const qvtft = summaryExperiments?.Q_vs_TFT ?? {};
  const qalld = summaryExperiments?.Q_vs_AllD ?? {};
  const pop = populationSummary ?? {};

  const qvqCoop = clamp(qvq.tailCooperation, 0, 1, 0);
  const qvtftCoop = clamp(qvtft.tailCooperation, 0, 1, 0);
  const qalldCoop = clamp(qalld.tailCooperation, 0, 1, 0);
  const popCoop = clamp(pop.tailCooperation, 0, 1, 0);
  const qvqRewardNorm = clamp((Number(qvq.tailReward) || 0) / 3, 0, 1, 0);
  const popRewardNorm = clamp((Number(pop.tailReward) || 0) / 3, 0, 1, 0);

  if (objective === "reward") {
    return (
      0.42 * qvqRewardNorm +
      0.18 * popRewardNorm +
      0.16 * qvqCoop +
      0.14 * qvtftCoop +
      0.1 * (1 - qalldCoop)
    );
  }
  if (objective === "cooperation") {
    return (
      0.5 * qvqCoop +
      0.2 * qvtftCoop +
      0.16 * popCoop +
      0.08 * (1 - qalldCoop) +
      0.06 * qvqRewardNorm
    );
  }
  return (
    0.4 * qvqCoop +
    0.2 * qvqRewardNorm +
    0.17 * qvtftCoop +
    0.08 * (1 - qalldCoop) +
    0.1 * popCoop +
    0.05 * popRewardNorm
  );
}

function sampleOne(values, rng) {
  return values[Math.floor(rng() * values.length)];
}

function configSignature(cfg) {
  return [
    cfg.alpha.toFixed(4),
    cfg.gamma.toFixed(4),
    cfg.epsilonDecay.toFixed(5),
    cfg.epsilonMin.toFixed(4),
    cfg.learningMode,
    cfg.prosocialWeight.toFixed(3),
    cfg.negativeAlphaScale.toFixed(3),
    cfg.coopBonus.toFixed(3),
    cfg.exploitPenalty.toFixed(3),
    cfg.tieBreak,
    cfg.optimisticInit.toFixed(3),
  ].join("|");
}

function buildOptimizationCandidates(base, trials, rng) {
  const candidates = [];
  const seen = new Set();

  function pushCandidate(cfg) {
    const norm = normalizeConfig({
      ...base,
      ...cfg,
      experiments: base.experiments,
      enableSweeps: false,
      enableTournament: false,
      enablePopulation: true,
    });
    const key = configSignature(norm);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(norm);
  }

  // Baseline and a known high-trust seed candidate.
  pushCandidate({ ...base });
  pushCandidate({
    ...base,
    alpha: 0.08,
    gamma: 0.99,
    epsilonDecay: 0.9994,
    epsilonMin: 0.01,
    learningMode: "prosocial",
    prosocialWeight: 0.2,
    negativeAlphaScale: 0.35,
    coopBonus: 0.05,
    exploitPenalty: 0.06,
    tieBreak: "cooperate",
    optimisticInit: 0.9,
  });

  const alphaVals = [0.03, 0.05, 0.08, 0.1, 0.12, 0.16];
  const gammaVals = [0.9, 0.95, 0.97, 0.99];
  const decayVals = [0.9988, 0.999, 0.9992, 0.9994, 0.9996];
  const epsilonMinVals = [0, 0.005, 0.01, 0.02, 0.03];
  const modeVals = ["classic", "prosocial"];
  const prosocialVals = [0.1, 0.2, 0.3, 0.4];
  const negativeVals = [0.2, 0.35, 0.5, 0.7, 1];
  const coopBonusVals = [0, 0.02, 0.05, 0.08];
  const exploitPenaltyVals = [0, 0.03, 0.06, 0.1];
  const optimisticVals = [0, 0.4, 0.8, 1.2, 1.6];

  while (candidates.length < trials) {
    const mode = sampleOne(modeVals, rng);
    const cfg = {
      ...base,
      alpha: sampleOne(alphaVals, rng),
      gamma: sampleOne(gammaVals, rng),
      epsilonDecay: sampleOne(decayVals, rng),
      epsilonMin: sampleOne(epsilonMinVals, rng),
      learningMode: mode,
      prosocialWeight: mode === "prosocial" ? sampleOne(prosocialVals, rng) : 0,
      negativeAlphaScale: sampleOne(negativeVals, rng),
      coopBonus: mode === "prosocial" ? sampleOne(coopBonusVals, rng) : 0,
      exploitPenalty: mode === "prosocial" ? sampleOne(exploitPenaltyVals, rng) : 0,
      tieBreak: mode === "prosocial" ? "cooperate" : sampleOne(["random", "cooperate"], rng),
      optimisticInit: mode === "prosocial" ? sampleOne(optimisticVals.slice(1), rng) : sampleOne(optimisticVals, rng),
    };
    pushCandidate(cfg);
  }

  return candidates.slice(0, trials);
}

function pickOptimizationReportFields(cfg) {
  return {
    alpha: cfg.alpha,
    gamma: cfg.gamma,
    epsilonDecay: cfg.epsilonDecay,
    epsilonMin: cfg.epsilonMin,
    learningMode: cfg.learningMode,
    prosocialWeight: cfg.prosocialWeight,
    negativeAlphaScale: cfg.negativeAlphaScale,
    coopBonus: cfg.coopBonus,
    exploitPenalty: cfg.exploitPenalty,
    tieBreak: cfg.tieBreak,
    optimisticInit: cfg.optimisticInit,
  };
}

function evaluateCandidateConfig(candidate, objective, seedOffset) {
  const evalEpisodes = Math.max(320, Math.floor(candidate.episodes * 0.25));
  const evalRounds = Math.max(70, Math.min(candidate.rounds, 120));
  const evalCfg = normalizeConfig({
    ...candidate,
    episodes: evalEpisodes,
    rounds: evalRounds,
    experiments: ["q_vs_q", "q_vs_tft", "q_vs_alld"],
    enablePopulation: true,
    enableSweeps: false,
    enableTournament: false,
  });
  evalCfg.populationMinEpisodes = 80;

  const runQvQ = runExperiment(EXPERIMENT_DEFS.q_vs_q, evalCfg, seedOffset + 11, () => {});
  const runQvTFT = runExperiment(EXPERIMENT_DEFS.q_vs_tft, evalCfg, seedOffset + 23, () => {});
  const runQvAllD = runExperiment(EXPERIMENT_DEFS.q_vs_alld, evalCfg, seedOffset + 37, () => {});
  const pop = runPopulation(evalCfg, seedOffset + 41, () => {});

  const summaryExperiments = {
    Q_vs_Q: runQvQ.summary,
    Q_vs_TFT: runQvTFT.summary,
    Q_vs_AllD: runQvAllD.summary,
  };
  const score = computeOptimizationScore(summaryExperiments, pop.summary, objective);
  return {
    score,
    summaryExperiments,
    populationSummary: pop.summary,
  };
}

function runOptimization(rawConfig, rawSearch) {
  const base = normalizeConfig(rawConfig);
  if (!base.experiments.length) {
    base.experiments = ["q_vs_allc", "q_vs_alld", "q_vs_random", "q_vs_tft", "q_vs_grim", "q_vs_q"];
  }
  const objective =
    rawSearch?.objective === "cooperation" || rawSearch?.objective === "reward" ? rawSearch.objective : "balanced";
  const trials = Math.floor(clamp(rawSearch?.trials, 4, 48, 18));
  const rng = makeRng(base.seed + 13371337);
  const candidates = buildOptimizationCandidates(base, trials, rng);

  const leaderboard = [];
  let best = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const pct = 4 + (i / Math.max(1, candidates.length)) * 58;
    self.postMessage({
      type: "progress",
      progress: pct,
      message: `Auto-optimizing: trial ${i + 1}/${candidates.length}...`,
    });
    const candidate = candidates[i];
    const evalRes = evaluateCandidateConfig(candidate, objective, 9000 + i * 151);
    leaderboard.push({
      score: evalRes.score * 100,
      config: pickOptimizationReportFields(candidate),
      qvqTailCoop: evalRes.summaryExperiments.Q_vs_Q.tailCooperation,
      qvqTailReward: evalRes.summaryExperiments.Q_vs_Q.tailReward,
      popTailCoop: evalRes.populationSummary.tailCooperation,
    });
    if (!best || evalRes.score > best.score) {
      best = {
        score: evalRes.score,
        config: candidate,
      };
    }
  }

  if (!best) {
    throw new Error("Optimization could not evaluate any candidates.");
  }

  leaderboard.sort((a, b) => b.score - a.score);
  self.postMessage({
    type: "progress",
    progress: 64,
    message: "Optimization complete. Running full simulation with best config...",
  });

  const finalConfig = normalizeConfig({
    ...base,
    ...pickOptimizationReportFields(best.config),
    experiments: base.experiments,
    enablePopulation: base.enablePopulation,
    enableSweeps: base.enableSweeps,
    enableTournament: base.enableTournament,
  });
  const fullResult = runAll(finalConfig, { startPercent: 65, endPercent: 100, messagePrefix: "Best config" });
  const optimization = {
    objective,
    trials: candidates.length,
    bestScore: best.score * 100,
    bestConfig: pickOptimizationReportFields(best.config),
    leaderboard: leaderboard.slice(0, 6),
  };
  fullResult.optimization = optimization;
  return {
    result: fullResult,
    optimization,
  };
}

function runAll(rawConfig, hooks = null) {
  const config = normalizeConfig(rawConfig);
  if (!config.experiments.length) {
    throw new Error("No experiments selected.");
  }

  const totalSteps = estimateTotalSteps(config);
  const startPercent = clamp(hooks?.startPercent, 0, 100, 0);
  const endPercent = clamp(hooks?.endPercent, startPercent, 100, 100);
  const messagePrefix = hooks?.messagePrefix ? `${hooks.messagePrefix}: ` : "";

  let completed = 0;
  const emitEvery = Math.max(1, Math.floor(totalSteps / 140));
  function progress(message) {
    completed += 1;
    if (completed === 1 || completed % emitEvery === 0 || completed >= totalSteps) {
      const ratio = completed / totalSteps;
      const scaledPercent = startPercent + (endPercent - startPercent) * ratio;
      self.postMessage({
        type: "progress",
        progress: scaledPercent,
        message: messagePrefix + message,
      });
    }
  }

  const experiments = {};
  const summaryExperiments = {};
  let seedOffset = 1;

  for (const key of config.experiments) {
    const def = EXPERIMENT_DEFS[key];
    if (!def) continue;
    const run = runExperiment(def, config, seedOffset, () => progress(`Running ${def.name}...`));
    experiments[run.name] = run;
    summaryExperiments[run.name] = run.summary;
    seedOffset += 41;
  }

  let sweeps = { gamma: [], noise: [], memory: [] };
  if (config.enableSweeps) {
    sweeps.gamma = runSweepSet(config, "gamma", [0.1, 0.5, 0.9, 0.99], { name: "Sweep_Gamma_Q_vs_Q", a: "q", b: "q" }, seedOffset, () =>
      progress("Running gamma sweep...")
    );
    seedOffset += 59;
    sweeps.noise = runSweepSet(
      config,
      "noise",
      [0, 0.01, 0.05, 0.1],
      { name: "Sweep_Noise_TFT_vs_Copykitten", a: "tft", b: "copykitten" },
      seedOffset,
      () => progress("Running noise sweep...")
    );
    seedOffset += 59;
    sweeps.memory = runSweepSet(config, "memory", [1, 3, 5], { name: "Sweep_Memory_Q_vs_Q", a: "q", b: "q" }, seedOffset, () =>
      progress("Running memory sweep...")
    );
    seedOffset += 59;
  }

  let tournament = { leaderboard: [] };
  if (config.enableTournament) {
    tournament = runBaselineTournament(config, seedOffset, () => progress("Running baseline tournament..."));
    seedOffset += 97;
  }

  let population = { series: [], summary: { tailCooperation: 0, tailReward: 0, episodes: 0 } };
  if (config.enablePopulation) {
    population = runPopulation(config, seedOffset, () => progress("Running population simulation..."));
  }

  return {
    id: String(Date.now()),
    generatedAt: new Date().toISOString(),
    config,
    experiments,
    sweeps,
    tournament,
    population,
    summary: {
      experiments: summaryExperiments,
      population: population.summary,
      overallScore: computeOverallScore(summaryExperiments, population.summary),
    },
  };
}
