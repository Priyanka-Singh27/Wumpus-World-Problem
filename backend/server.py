"""
wumpus/api/server.py
─────────────────────
Pure-stdlib HTTP API server (no FastAPI/uvicorn required).
Uses Python's http.server + json for all communication.

Endpoints
─────────
  POST /api/game/new          Create a new game session
  POST /api/game/step         Send an action, get percept + state
  GET  /api/game/state        Get current world state
  POST /api/game/reset        Reset current session
  GET  /api/game/history      Full action history for replay

  POST /api/agent/kb/step     KB agent auto-step (returns action + KB snapshot)
  POST /api/agent/rl/train    Train RL agent (n episodes), stream results
  GET  /api/agent/rl/snapshot RL Q-table heatmap snapshot
  POST /api/bench/run         Run full benchmark (blocking)

  GET  /api/world/generate    Generate world preview (for seed browser)
  GET  /health                Health check

Sessions are stored in memory (dict keyed by session_id).
For production, swap with Redis or a DB.
"""

from __future__ import annotations

import json
import sys
import os
import uuid
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from typing import Optional

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game.world import (
    Action, Direction, GameResult, Percept,
    WumpusWorld, WorldConfig, DIFFICULTY
)
from agents.knowledge_agent import KnowledgeAgent
from agents.rl_agent import RLAgent, RLConfig, RLTrainer
from agents.random_agent import RandomAgent
from game.benchmarker import Benchmarker


# ─── Session store ────────────────────────────────────────────────────────────

class Session:
    def __init__(self, world: WumpusWorld, session_id: str):
        self.id         = session_id
        self.world      = world
        self.kb_agent   = KnowledgeAgent(
            world_size=world.size,
            n_arrows=world.config.n_arrows
        )
        self.rl_agent: Optional[RLAgent] = None
        self.trainer:  Optional[RLTrainer] = None
        self.created   = time.time()
        self.last_used = time.time()

    def touch(self):
        self.last_used = time.time()


SESSIONS: dict[str, Session] = {}
SESSION_LOCK = threading.Lock()

# Global trained RL agent (persists across sessions)
GLOBAL_RL_TRAINER: Optional[RLTrainer] = None
GLOBAL_RL_LOCK = threading.Lock()


def get_session(sid: str) -> Optional[Session]:
    with SESSION_LOCK:
        s = SESSIONS.get(sid)
        if s:
            s.touch()
        return s


def new_session(world: WumpusWorld) -> Session:
    sid = str(uuid.uuid4())[:8]
    s = Session(world, sid)
    with SESSION_LOCK:
        SESSIONS[sid] = s
    return s


# ─── Request handler ──────────────────────────────────────────────────────────

class WumpusHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Suppress default request logging; use custom
        print(f"[API] {self.command} {self.path} → {args[1] if len(args) > 1 else ''}")

    # ── Route dispatcher ──────────────────────────────────────────────────────

    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path
        params = parse_qs(parsed.query)

        routes = {
            "/health":              self._health,
            "/api/game/state":      self._game_state,
            "/api/game/history":    self._game_history,
            "/api/agent/rl/snapshot": self._rl_snapshot,
            "/api/world/generate":  self._world_generate,
        }

        handler = routes.get(path)
        if handler:
            handler(params)
        else:
            self._send(404, {"error": f"Unknown endpoint: {path}"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        parsed = urlparse(self.path)
        path   = parsed.path

        routes = {
            "/api/game/new":        self._game_new,
            "/api/game/step":       self._game_step,
            "/api/game/reset":      self._game_reset,
            "/api/agent/kb/step":   self._kb_step,
            "/api/agent/rl/step":   self._rl_step,
            "/api/agent/rl/train":  self._rl_train,
            "/api/bench/run":       self._bench_run,
        }

        handler = routes.get(path)
        if handler:
            handler(body)
        else:
            self._send(404, {"error": f"Unknown endpoint: {path}"})

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    # ── Game endpoints ────────────────────────────────────────────────────────

    def _game_new(self, body: dict):
        """
        POST /api/game/new
        Body: { difficulty?: str, seed?: int, config?: {...} }
        """
        difficulty = body.get("difficulty", "medium")
        seed       = body.get("seed", None)
        custom_cfg = body.get("config", None)

        if custom_cfg:
            cfg = WorldConfig(seed=seed, **custom_cfg)
        else:
            d   = DIFFICULTY[difficulty]
            cfg = WorldConfig(seed=seed, **d)

        world   = WumpusWorld(cfg)
        session = new_session(world)
        percept = world._last_percept

        self._send(200, {
            "session_id": session.id,
            "percept":    percept.to_dict(),
            "state":      world.to_dict(reveal=False),
            "message":    "New game created",
        })

    def _game_step(self, body: dict):
        """
        POST /api/game/step
        Body: { session_id: str, action: str }
        """
        sid    = body.get("session_id", "")
        action_str = body.get("action", "")

        session = get_session(sid)
        if not session:
            return self._send(404, {"error": "Session not found"})

        try:
            action = Action(action_str)
        except ValueError:
            return self._send(400, {"error": f"Invalid action: {action_str}. "
                                    f"Valid: {[a.value for a in Action]}"})

        if session.world.result != GameResult.ONGOING:
            return self._send(400, {"error": "Game is over. Call /api/game/reset"})

        percept, reward, done = session.world.step(action)

        self._send(200, {
            "percept":    percept.to_dict(),
            "reward":     reward,
            "done":       done,
            "result":     session.world.result.value,
            "state":      session.world.to_dict(reveal=done),
        })

    def _game_state(self, params: dict):
        """GET /api/game/state?session_id=xxx&reveal=false"""
        sid    = params.get("session_id", [""])[0]
        reveal = params.get("reveal", ["false"])[0].lower() == "true"

        session = get_session(sid)
        if not session:
            return self._send(404, {"error": "Session not found"})

        self._send(200, session.world.to_dict(reveal=reveal))

    def _game_reset(self, body: dict):
        """POST /api/game/reset  Body: { session_id: str, seed?: int }"""
        sid  = body.get("session_id", "")
        seed = body.get("seed", None)

        session = get_session(sid)
        if not session:
            return self._send(404, {"error": "Session not found"})

        if seed is not None:
            session.world.config.seed = seed
            session.world.seed        = seed

        percept = session.world.reset()
        session.kb_agent.reset()

        self._send(200, {
            "percept": percept.to_dict(),
            "state":   session.world.to_dict(reveal=False),
            "message": "Game reset",
        })

    def _game_history(self, params: dict):
        """GET /api/game/history?session_id=xxx"""
        sid     = params.get("session_id", [""])[0]
        session = get_session(sid)
        if not session:
            return self._send(404, {"error": "Session not found"})
        self._send(200, {"history": session.world.get_history()})

    # ── KB Agent endpoints ────────────────────────────────────────────────────

    def _kb_step(self, body: dict):
        """
        POST /api/agent/kb/step
        Body: { session_id: str }

        Runs ONE KB agent step on the session's world.
        Returns chosen action + KB snapshot + new world state.
        """
        sid     = body.get("session_id", "")
        session = get_session(sid)
        if not session:
            return self._send(404, {"error": "Session not found"})

        if session.world.result != GameResult.ONGOING:
            return self._send(400, {"error": "Game over"})

        world   = session.world
        agent   = session.kb_agent
        percept = world._last_percept

        action = agent.choose_action(
            percept,
            (world.agent.row, world.agent.col),
            world.agent.direction,
        )

        percept, reward, done = world.step(action)

        self._send(200, {
            "action":      action.value,
            "percept":     percept.to_dict(),
            "reward":      reward,
            "done":        done,
            "result":      world.result.value,
            "state":       world.to_dict(reveal=done),
            "kb_snapshot": agent.kb_snapshot(),
        })

    # ── RL Agent endpoints ────────────────────────────────────────────────────

    def _rl_step(self, body: dict):
        """
        POST /api/agent/rl/step
        Body: { session_id: str }

        Runs ONE RL agent step using the globally trained Q-table.
        Falls back to random action if no trained agent exists.
        """
        sid     = body.get("session_id", "")
        session = get_session(sid)
        if not session:
            return self._send(404, {"error": "Session not found"})

        if session.world.result != GameResult.ONGOING:
            return self._send(400, {"error": "Game over"})

        world   = session.world
        percept = world._last_percept

        with GLOBAL_RL_LOCK:
            agent = GLOBAL_RL_TRAINER.agent if GLOBAL_RL_TRAINER else None

        if agent:
            action, _ = agent.choose_action(
                percept,
                (world.agent.row, world.agent.col),
                world.agent.direction,
                world.agent.has_gold,
                world.agent.arrows,
            )
        else:
            # No trained agent yet — use random
            import random as _random
            action = _random.choice(list(Action))

        percept, reward, done = world.step(action)

        self._send(200, {
            "action":  action.value,
            "percept": percept.to_dict(),
            "reward":  reward,
            "done":    done,
            "result":  world.result.value,
            "state":   world.to_dict(reveal=done),
            "rl_trained": GLOBAL_RL_TRAINER is not None,
        })

    def _rl_train(self, body: dict):
        """
        POST /api/agent/rl/train
        Body: { difficulty?: str, n_episodes?: int, alpha?: float,
                gamma?: float, epsilon_decay?: float }

        Trains RL agent and returns full learning curve + summary.
        (Blocking — for large n_episodes use in a background thread.)
        """
        global GLOBAL_RL_TRAINER

        difficulty = body.get("difficulty", "medium")
        n_episodes = int(body.get("n_episodes", 500))
        alpha      = float(body.get("alpha",   0.2))
        gamma      = float(body.get("gamma",   0.95))
        e_decay    = float(body.get("epsilon_decay", 0.995))

        cfg = RLConfig(
            n_episodes    = n_episodes,
            alpha         = alpha,
            gamma         = gamma,
            epsilon_decay = e_decay,
        )

        with GLOBAL_RL_LOCK:
            GLOBAL_RL_TRAINER = RLTrainer(
                difficulty=difficulty,
                rl_config=cfg
            )
            t0 = time.time()
            GLOBAL_RL_TRAINER.run()
            elapsed = round(time.time() - t0, 2)

        self._send(200, {
            "elapsed_sec":   elapsed,
            "summary":       GLOBAL_RL_TRAINER.summary(),
            "learning_curve": GLOBAL_RL_TRAINER.rolling_stats(window=50),
            "agent":         GLOBAL_RL_TRAINER.agent.to_dict(),
        })

    def _rl_snapshot(self, params: dict):
        """
        GET /api/agent/rl/snapshot?direction=EAST&has_gold=false&arrows=1
        Returns Q-value heatmap for current agent state.
        """
        if not GLOBAL_RL_TRAINER:
            return self._send(404, {"error": "No trained RL agent. Call /api/agent/rl/train first"})

        direction_str = params.get("direction", ["EAST"])[0]
        has_gold      = params.get("has_gold", ["false"])[0].lower() == "true"
        arrows        = int(params.get("arrows", [1])[0])

        try:
            direction = Direction(direction_str)
        except ValueError:
            direction = Direction.EAST

        agent = GLOBAL_RL_TRAINER.agent

        self._send(200, {
            "q_heatmap":  agent.q_heatmap(direction, has_gold, arrows),
            "agent_info": agent.to_dict(),
            "summary":    GLOBAL_RL_TRAINER.summary(),
        })

    # ── Benchmark endpoint ────────────────────────────────────────────────────

    def _bench_run(self, body: dict):
        """
        POST /api/bench/run
        Body: { difficulty?: str, n_episodes?: int, rl_pretrain?: int }
        """
        difficulty  = body.get("difficulty",  "medium")
        n_episodes  = int(body.get("n_episodes",  100))
        rl_pretrain = int(body.get("rl_pretrain", 500))

        bench  = Benchmarker(
            difficulty  = difficulty,
            n_episodes  = n_episodes,
            rl_pretrain = rl_pretrain,
        )
        report = bench.run()
        self._send(200, report)

    # ── World generator ───────────────────────────────────────────────────────

    def _world_generate(self, params: dict):
        """
        GET /api/world/generate?difficulty=medium&seed=42
        Returns a revealed world state (for the seed browser / preview).
        """
        difficulty = params.get("difficulty", ["medium"])[0]
        seed_str   = params.get("seed", [None])[0]
        seed       = int(seed_str) if seed_str else None

        d   = DIFFICULTY[difficulty]
        cfg = WorldConfig(seed=seed, **d)
        w   = WumpusWorld(cfg)

        self._send(200, w.to_dict(reveal=True))

    # ── Health ────────────────────────────────────────────────────────────────

    def _health(self, _params):
        self._send(200, {
            "status":   "ok",
            "sessions": len(SESSIONS),
            "rl_trained": GLOBAL_RL_TRAINER is not None,
        })

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _send(self, status: int, data: dict):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type",   "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


# ─── Server entrypoint ────────────────────────────────────────────────────────

def run(host: str = "0.0.0.0", port: int = 8765):
    server = HTTPServer((host, port), WumpusHandler)
    print(f"""
╔══════════════════════════════════════════════╗
║     WUMPUS WORLD — BACKEND API SERVER        ║
╠══════════════════════════════════════════════╣
║  Host : {host:<36} ║
║  Port : {port:<36} ║
╠══════════════════════════════════════════════╣
║  Endpoints:                                  ║
║  POST /api/game/new          New session     ║
║  POST /api/game/step         Take action     ║
║  GET  /api/game/state        World state     ║
║  POST /api/game/reset        Reset           ║
║  GET  /api/game/history      Replay data     ║
║  POST /api/agent/kb/step     KB auto-step    ║
║  POST /api/agent/rl/train    Train RL        ║
║  GET  /api/agent/rl/snapshot Q-heatmap       ║
║  POST /api/bench/run         Benchmark all   ║
║  GET  /health                Status          ║
╚══════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Wumpus World API Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    run(args.host, args.port)
