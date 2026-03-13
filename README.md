# Trust Lab: Emergence of Cooperation (IPD + MARL)

A public, interactive simulation of how cooperation can emerge (or collapse) when agents repeatedly face the **Iterated Prisoner's Dilemma (IPD)**.

## Live Website

Play it here: [https://eric157.github.io/marl-iterated-prisoners-dilemma/](https://eric157.github.io/marl-iterated-prisoners-dilemma/)

## What This Project Is

This repository is a **pure static web app** (perfect for GitHub Pages):

- No backend server
- No database
- No Python runtime on deploy
- Simulations run directly in the browser (Web Worker)

Users can adjust parameters, run experiments, compare runs side-by-side, and download results as JSON.

## Full Forms (Quick Glossary)

- `IPD` = Iterated Prisoner's Dilemma
- `MARL` = Multi-Agent Reinforcement Learning
- `RL` = Reinforcement Learning
- `Q-learning` = a value-based RL method where an agent learns action values for each state
- `TFT` = Tit For Tat
- `AllC` = Always Cooperate
- `AllD` = Always Defect

## What Visitors Can Do on the Website

- Run core experiments such as:
  - Q-learning vs Always Cooperate
  - Q-learning vs Always Defect
  - Q-learning vs Tit For Tat
  - Q-learning vs Q-learning
- Tune settings like episodes, rounds, noise, memory, discount factor, and exploration
- Run optional advanced modules:
  - baseline strategy tournament
  - parameter sweeps (gamma/noise/memory)
  - 10-agent population simulation
- Compare any two past runs side-by-side in the browser
- Export a run as JSON

## How to Use (Simple)

1. Open the live website.
2. Keep defaults and click **Start Simulation** for a first run.
3. Change one setting (for example, increase noise) and run again.
4. Use **Run Comparison** to see how outcomes changed.

## What Happens in the Background

1. Two (or more) agents repeatedly play Cooperate/Defect.
2. Rewards are assigned by the Prisoner's Dilemma payoff matrix.
3. Learning agents update their Q-values after each round.
4. Metrics (cooperation rate, reward trends, and summaries) are rendered as live charts.

## Repository Structure

```text
.
├─ index.html
├─ assets/
│  ├─ styles.css
│  ├─ app.js
│  └─ worker.js
├─ .github/workflows/pages.yml
└─ .nojekyll
```

## Deployment

This repo is configured for GitHub Pages via GitHub Actions (`.github/workflows/pages.yml`).
Push to `main` and GitHub will deploy automatically.

## Offline Experiments

The original offline/Python experimentation stack has been moved into a **separate repository workspace** so this Pages repo stays clean and web-focused.

Local workspace path:
`C:\Users\ericp\OneDrive - ericthomas15\Desktop\marl-iterated-prisoners-dilemma-offline`
