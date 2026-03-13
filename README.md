# IPD MARL Lab (GitHub Pages)

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

## Deploy on GitHub Pages

### Option A (already configured): GitHub Actions

1. Push this repo to GitHub.
2. Ensure default branch is `main`.
3. Go to `Settings -> Pages`.
4. Under `Build and deployment`, set **Source** to `GitHub Actions`.
5. Push to `main` (or run workflow manually).
6. Site will be published at:
   - `https://<your-username>.github.io/<repo-name>/`

### Option B: Branch/Folder mode

You can also serve from branch root, but this repo includes a Pages Actions workflow by default.

## Notes

- All computation happens client-side in the user browser.
- Large settings (very high episodes/rounds + all modules enabled) can take longer on low-power devices.
- Run comparison is stored in `localStorage` (per browser/device).
