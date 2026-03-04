"""
wumpus/game/benchmarker.py
───────────────────────────
Head-to-head benchmarking of all agents.

Runs N episodes for each agent on the SAME set of world seeds,
ensuring a fair comparison.

Usage
─────
    bench = Benchmarker(difficulty="medium", n_episodes=200)
    report = bench.run()
    print(json.dumps(report, indent=2))
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Optional

import numpy as np

from game.world import (
    Action, Direction, GameResult, Percept,
    WumpusWorld, WorldConfig, DIFFICULTY
)
from agents.knowledge_agent import KnowledgeAgent
from agents.rl_agent import RLAgent, RLConfig, RLTrainer
from agents.random_agent import RandomAgent


@dataclass
class AgentBenchResult:
    name:           str
    n_episodes:     int
    win_rate:       float
    avg_score:      float
    avg_steps:      float
    best_score:     int
    deaths_pit:     int
    deaths_wumpus:  int
    timeouts:       int
    gold_rate:      float    # % episodes gold was found
    per_episode:    list[dict]


class Benchmarker:
    """
    Runs all three agents (KB, RL, Random) on the same worlds and compares them.

    Parameters
    ----------
    difficulty  : "easy" | "medium" | "hard" | "expert"
    n_episodes  : number of episodes per agent
    rl_pretrain : episodes to pretrain RL agent before benchmarking
    seeds       : optional fixed seed list; auto-generated if None
    """

    def __init__(self,
                 difficulty:   str = "medium",
                 n_episodes:   int = 100,
                 rl_pretrain:  int = 500,
                 seeds: Optional[list[int]] = None):
        self.difficulty  = difficulty
        self.n_episodes  = n_episodes
        self.rl_pretrain = rl_pretrain
        self.world_cfg   = DIFFICULTY[difficulty]

        # Generate reproducible seeds
        if seeds:
            self.seeds = seeds[:n_episodes]
        else:
            rng = np.random.default_rng(42)
            self.seeds = [int(s) for s in rng.integers(0, 99999, n_episodes)]

        self.results: dict[str, AgentBenchResult] = {}

    # ── Main entry point ──────────────────────────────────────────────────────

    def run(self, callback=None) -> dict:
        """
        Run full benchmark. Returns comparison report dict.
        callback(agent_name, episode_idx, episode_result) for progress.
        """
        t0 = time.time()

        # 1. Random Agent
        self.results["random"] = self._bench_random(callback)

        # 2. KB Agent
        self.results["knowledge"] = self._bench_kb(callback)

        # 3. RL Agent (pretrained then benchmarked)
        self.results["rl"] = self._bench_rl(callback)

        elapsed = round(time.time() - t0, 2)
        return self._compile_report(elapsed)

    # ── Per-agent runners ─────────────────────────────────────────────────────

    def _bench_random(self, callback) -> AgentBenchResult:
        agent = RandomAgent()
        episodes = []
        for i, seed in enumerate(self.seeds):
            ep = self._run_episode_random(agent, seed)
            episodes.append(ep)
            if callback:
                callback("random", i, ep)
        return self._aggregate("Random Agent", episodes)

    def _bench_kb(self, callback) -> AgentBenchResult:
        episodes = []
        for i, seed in enumerate(self.seeds):
            ep = self._run_episode_kb(seed)
            episodes.append(ep)
            if callback:
                callback("knowledge", i, ep)
        return self._aggregate("Knowledge-Based Agent", episodes)

    def _bench_rl(self, callback) -> AgentBenchResult:
        # Pretrain
        cfg     = RLConfig(n_episodes=self.rl_pretrain, epsilon_start=1.0)
        trainer = RLTrainer(world_config=self.world_cfg, rl_config=cfg)
        trainer.run()
        trained_agent = trainer.agent
        trained_agent.epsilon = 0.05   # exploit during benchmark

        episodes = []
        for i, seed in enumerate(self.seeds):
            ep = self._run_episode_rl(trained_agent, seed)
            episodes.append(ep)
            if callback:
                callback("rl", i, ep)
        return self._aggregate("RL Agent (Q-Learning)", episodes)

    # ── Episode runners ───────────────────────────────────────────────────────

    def _run_episode_random(self, agent: RandomAgent, seed: int) -> dict:
        agent.reset()
        world   = self._make_world(seed)
        percept = world.reset()
        done    = False
        while not done:
            action = agent.choose_action(
                percept,
                (world.agent.row, world.agent.col),
                world.agent.direction,
                world.agent.has_gold,
                world.agent.arrows
            )
            percept, _, done = world.step(action)
        return self._ep_dict(world)

    def _run_episode_kb(self, seed: int) -> dict:
        world = self._make_world(seed)
        agent = KnowledgeAgent(
            world_size=self.world_cfg["size"],
            n_arrows=self.world_cfg["n_arrows"]
        )
        percept = world.reset()
        done    = False
        while not done:
            action = agent.choose_action(
                percept,
                (world.agent.row, world.agent.col),
                world.agent.direction
            )
            percept, _, done = world.step(action)
        return self._ep_dict(world)

    def _run_episode_rl(self, agent: RLAgent, seed: int) -> dict:
        world   = self._make_world(seed)
        percept = world.reset()
        done    = False
        while not done:
            action, _ = agent.choose_action(
                percept,
                (world.agent.row, world.agent.col),
                world.agent.direction,
                world.agent.has_gold,
                world.agent.arrows
            )
            percept, _, done = world.step(action)
        return self._ep_dict(world)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _make_world(self, seed: int) -> WumpusWorld:
        cfg = WorldConfig(seed=seed, **self.world_cfg)
        return WumpusWorld(cfg)

    def _ep_dict(self, world: WumpusWorld) -> dict:
        return {
            "result":     world.result.value,
            "score":      world.agent.score,
            "steps":      world.agent.steps,
            "won":        world.result == GameResult.WIN and world.agent.has_gold,
            "gold_found": world.agent.has_gold,
        }

    def _aggregate(self, name: str, episodes: list[dict]) -> AgentBenchResult:
        scores = [e["score"] for e in episodes]
        steps  = [e["steps"] for e in episodes]
        wins   = [e["won"]   for e in episodes]
        gold   = [e["gold_found"] for e in episodes]
        return AgentBenchResult(
            name          = name,
            n_episodes    = len(episodes),
            win_rate      = round(sum(wins) / len(wins), 3),
            avg_score     = round(float(np.mean(scores)), 1),
            avg_steps     = round(float(np.mean(steps)), 1),
            best_score    = int(max(scores)),
            deaths_pit    = sum(1 for e in episodes if e["result"] == "DEAD_PIT"),
            deaths_wumpus = sum(1 for e in episodes if e["result"] == "DEAD_WUMPUS"),
            timeouts      = sum(1 for e in episodes if e["result"] == "TIMEOUT"),
            gold_rate     = round(sum(gold) / len(gold), 3),
            per_episode   = episodes,
        )

    def _compile_report(self, elapsed: float) -> dict:
        agents = {}
        for key, res in self.results.items():
            agents[key] = {
                "name":          res.name,
                "win_rate":      res.win_rate,
                "avg_score":     res.avg_score,
                "avg_steps":     res.avg_steps,
                "best_score":    res.best_score,
                "deaths_pit":    res.deaths_pit,
                "deaths_wumpus": res.deaths_wumpus,
                "timeouts":      res.timeouts,
                "gold_rate":     res.gold_rate,
                "per_episode":   res.per_episode,
            }

        # Rankings
        sorted_by_win = sorted(
            agents.keys(), key=lambda k: agents[k]["win_rate"], reverse=True
        )

        return {
            "difficulty":    self.difficulty,
            "n_episodes":    self.n_episodes,
            "elapsed_sec":   elapsed,
            "agents":        agents,
            "ranking":       sorted_by_win,
            "comparison": {
                "kb_vs_random_win_delta":
                    round(agents["knowledge"]["win_rate"] -
                          agents["random"]["win_rate"], 3),
                "rl_vs_random_win_delta":
                    round(agents["rl"]["win_rate"] -
                          agents["random"]["win_rate"], 3),
                "best_agent": sorted_by_win[0],
            }
        }
