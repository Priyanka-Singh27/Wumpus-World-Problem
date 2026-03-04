# Wumpus World AI Simulator

A production-quality, fully playable Wumpus World game in the browser with three AI agents: Knowledge-Based (propositional logic), Q-Learning (reinforcement learning), and Random (baseline).

---

## Features

- **Three AI agents** — KB (rule-based inference), RL (tabular Q-learning), Random
- **Human playable** — keyboard controls (WASD + Space + G + E)
- **Seed Browser** — preview and load specific world seeds
- **Fog of War** — Full / Adjacent / Memory / Off modes
- **Live Agent Visualization** — KB inference log (streaming CRT panel), RL Q-heatmap
- **Benchmarking** — head-to-head comparison across all agents
- **Multiplayer (VS AI)** — human vs KB agent racing on the same world
- **Procedural Generation** — seeded, fully reproducible worlds
- **Difficulty Levels** — Easy (4×4) → Expert (10×10)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Zustand |
| Backend | Python 3.12+, stdlib only (`http.server`, `json`, `threading`) |
| AI | Pure Python — no ML frameworks |
| Only external dep | `numpy` (backend only) |

---

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+

### 1. Clone

```bash
git clone <your-repo-url>
cd wumpus
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python server.py
# Runs on http://localhost:8765
```

Optional flags:
```bash
python server.py --host 0.0.0.0 --port 8765
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env          # set VITE_API_BASE if backend on different host/port
npm install
npm run dev
# Opens on http://localhost:5173
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `http://localhost:8765` | Backend API base URL |

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/game/new` | Create a new game session |
| POST | `/api/game/step` | Send an action, get percept + state |
| GET | `/api/game/state` | Get current world state |
| POST | `/api/game/reset` | Reset the current session |
| GET | `/api/game/history` | Full action history for replay |
| POST | `/api/agent/kb/step` | KB agent auto-step |
| POST | `/api/agent/rl/step` | RL agent auto-step (uses trained Q-table) |
| POST | `/api/agent/random/step` | Random agent step (with smart grab/climb biases) |
| POST | `/api/agent/rl/train` | Train RL agent (N episodes) |
| GET | `/api/agent/rl/snapshot` | RL Q-table heatmap |
| POST | `/api/bench/run` | Head-to-head benchmark all agents |
| GET | `/api/world/generate` | Preview a world by seed (Seed Browser) |
| GET | `/health` | Server health check |

---

## Running Tests

From the `backend/` directory:

```bash
# Run full test suite
python test_all.py

# Or via unittest module
python -m unittest test_all -v
```

Test coverage includes:
- World engine (movement, scoring, percepts, serialization, reproducibility)
- KB agent inference rules (R1–R6)
- RL agent (state encoding, Q-updates, epsilon decay, training convergence)
- Benchmarker (all agents, fair seed comparison)
- Procedural generation & world fingerprinting
- RandomAgent smart biases

---

## Keyboard Controls (Human Mode)

| Key | Action |
|-----|--------|
| `W` / `↑` | Move Forward |
| `A` / `←` | Turn Left |
| `D` / `→` | Turn Right |
| `Space` | Shoot Arrow |
| `G` | Grab Gold |
| `E` / `Enter` | Climb (exit cave) |

---

## Project Structure

```
wumpus/
├── backend/
│   ├── game/
│   │   ├── __init__.py
│   │   ├── world.py            # Core game engine
│   │   ├── benchmarker.py      # Head-to-head agent comparison
│   │   └── procedural.py       # Seed generation & fingerprinting
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── knowledge_agent.py  # Propositional logic KB agent
│   │   ├── rl_agent.py         # Tabular Q-learning agent
│   │   └── random_agent.py     # Random baseline
│   ├── server.py               # HTTP API server (stdlib only)
│   ├── test_all.py             # Full test suite
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/client.js       # All API calls
    │   ├── store/              # Zustand state stores
    │   ├── hooks/              # useGame, useAgent, useMetrics
    │   └── components/         # Grid, panels, overlays, UI
    ├── .env.example
    ├── .eslintrc.json
    ├── index.html
    └── package.json
```

---

## License

MIT — free for academic use.