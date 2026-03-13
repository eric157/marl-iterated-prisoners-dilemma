# IPD MARL

Interactive browser-based lab for **Emergence of Cooperation in Iterated Prisoner's Dilemma using Multi-Agent Reinforcement Learning**.

This repository is now a **pure static web app**:

- No offline Python pipelines
- No server/backend required
- Simulations run in-browser via `Web Worker`
- Users can tune parameters and run experiments on the fly

## Live Features

- Adjustable RL and environment parameters:
  - episodes, rounds, memory, noise
  - alpha, gamma, epsilon, epsilon decay, epsilon min, seed
- Selectable core experiments:
  - `Q vs AllC`, `Q vs AllD`, `Q vs Random`, `Q vs TFT`, `Q vs Grim`, `Q vs Q`
- Optional advanced modules:
  - parameter sweeps (`gamma`, `noise`, `memory`)
  - baseline tournament
  - 10-agent population simulation
- Real-time progress updates
- Live charts for cooperation/reward dynamics
- Q-table snapshot
- Browser-local run history + side-by-side run comparison
- JSON export of a run

## Project Structure

```text
.
├─ index.html
├─ assets/
│  ├─ styles.css
│  ├─ app.js
│  └─ worker.js
├─ .nojekyll
└─ .github/workflows/pages.yml
```
