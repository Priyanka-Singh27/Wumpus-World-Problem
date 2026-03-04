"""
wumpus/agents/rl_agent.py
──────────────────────────
Tabular Q-Learning agent for the Wumpus World.

State space
───────────
  Rather than the exponential full-grid state, we use a compact
  featurized state that is tractable for tabular Q-learning:

    state = (stench, breeze, glitter, bump, scream,
             row, col, direction_idx,
             has_gold, arrows_remaining)

  This gives at most 2^5 × N × N × 4 × 2 × (max_arrows+1) states.
  For a 4×4 grid with 1 arrow → 32 × 16 × 4 × 2 × 2 = 8192 states.

Q-table
───────
  Stored as a nested dict:  q[state_key][action] = float
  Serialisable to JSON for persistence.

Training
────────
  trainer = RLTrainer(world_config, agent_config)
  results = trainer.run(n_episodes=1000)
  # results contains per-episode stats for the learning curve
"""

from __future__ import annotations

import json
import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from game.world import Action, Direction, GameResult, Percept, WumpusWorld, WorldConfig


# ─── Hyperparameter config ────────────────────────────────────────────────────

@dataclass
class RLConfig:
    alpha:          float = 0.2    # learning rate
    gamma:          float = 0.95   # discount factor
    epsilon_start:  float = 1.0    # initial exploration rate
    epsilon_end:    float = 0.05   # minimum exploration rate
    epsilon_decay:  float = 0.995  # multiplicative decay per episode
    n_episodes:     int   = 1000
    max_steps:      int   = 0      # 0 = use world default


ACTIONS = list(Action)
ACTION_IDX = {a: i for i, a in enumerate(ACTIONS)}


# ─── Q-Learning Agent ─────────────────────────────────────────────────────────

class RLAgent:
    """
    Tabular Q-learning agent.

    Usage
    -----
        agent = RLAgent(world_size=4, config=RLConfig())
        agent.reset_episode()
        action = agent.choose_action(percept, pos, direction,
                                     has_gold, arrows)
        agent.update(state, action, reward, next_state, done)
    """

    def __init__(self, world_size: int = 4, config: Optional[RLConfig] = None):
        self.size    = world_size
        self.config  = config or RLConfig()
        self.epsilon = self.config.epsilon_start

        # Q-table: state_key → {action_idx: Q_value}
        self.q_table: dict[str, np.ndarray] = defaultdict(
            lambda: np.zeros(len(ACTIONS))
        )

        self.episode = 0
        self._last_state: Optional[str] = None

    # ── State encoding ────────────────────────────────────────────────────────

    def encode_state(self, percept: Percept,
                     pos: tuple[int,int],
                     direction: Direction,
                     has_gold: bool,
                     arrows: int) -> str:
        dir_idx = list(Direction).index(direction)
        arrows_capped = min(arrows, 3)
        return (
            f"{int(percept.stench)}{int(percept.breeze)}"
            f"{int(percept.glitter)}{int(percept.bump)}{int(percept.scream)}"
            f"_{pos[0]}_{pos[1]}_{dir_idx}_{int(has_gold)}_{arrows_capped}"
        )

    # ── Action selection (ε-greedy) ───────────────────────────────────────────

    def choose_action(self, percept: Percept,
                      pos: tuple[int,int],
                      direction: Direction,
                      has_gold: bool,
                      arrows: int) -> tuple[Action, str]:
        """
        Returns (action, state_key).
        State key is needed for the subsequent update() call.
        """
        state = self.encode_state(percept, pos, direction, has_gold, arrows)
        self._last_state = state

        if random.random() < self.epsilon:
            # Exploration: random action
            action = random.choice(ACTIONS)
        else:
            # Exploitation: greedy
            q_vals = self.q_table[state]
            action = ACTIONS[int(np.argmax(q_vals))]

        return action, state

    # ── Q-update ─────────────────────────────────────────────────────────────

    def update(self, state: str, action: Action,
               reward: float, next_state: str, done: bool):
        """Standard Q-learning update."""
        idx        = ACTION_IDX[action]
        q_current  = self.q_table[state][idx]
        q_next_max = 0.0 if done else float(np.max(self.q_table[next_state]))
        td_target  = reward + self.config.gamma * q_next_max
        td_error   = td_target - q_current
        self.q_table[state][idx] += self.config.alpha * td_error

    def end_episode(self):
        """Call at the end of each episode to decay epsilon."""
        self.episode += 1
        self.epsilon = max(
            self.config.epsilon_end,
            self.epsilon * self.config.epsilon_decay
        )

    def reset_episode(self):
        """Reset per-episode tracking (not the Q-table)."""
        self._last_state = None

    # ── Q-value heatmap for visualization ────────────────────────────────────

    def q_heatmap(self, direction: Direction,
                  has_gold: bool, arrows: int) -> list[list[dict]]:
        """
        Returns a 2D grid of per-cell Q statistics for the frontend heatmap.
        For each cell: max Q-value, best action, Q-values per action.
        """
        grid = []
        for r in range(self.size):
            row = []
            for c in range(self.size):
                # Try all percept combos, take the average max Q
                q_vals_all = []
                best_actions = []
                for stench in [False, True]:
                    for breeze in [False, True]:
                        p = Percept(stench=stench, breeze=breeze)
                        state = self.encode_state(
                            p, (r,c), direction, has_gold, arrows
                        )
                        q_vals = self.q_table[state]
                        q_vals_all.append(q_vals)
                        best_actions.append(ACTIONS[int(np.argmax(q_vals))])

                avg_q   = np.mean([np.max(q) for q in q_vals_all])
                best_a  = best_actions[0].value   # simplification

                row.append({
                    "row":         r,
                    "col":         c,
                    "max_q":       round(float(avg_q), 2),
                    "best_action": best_a,
                    "q_values":    {
                        a.value: round(float(np.mean([q[i] for q in q_vals_all])), 2)
                        for i, a in enumerate(ACTIONS)
                    }
                })
            grid.append(row)
        return grid

    # ── Serialization ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "episode": self.episode,
            "epsilon": round(self.epsilon, 4),
            "n_states": len(self.q_table),
            "config": {
                "alpha":         self.config.alpha,
                "gamma":         self.config.gamma,
                "epsilon_start": self.config.epsilon_start,
                "epsilon_end":   self.config.epsilon_end,
                "epsilon_decay": self.config.epsilon_decay,
            }
        }

    def save(self, path: str):
        data = {
            "episode": self.episode,
            "epsilon": self.epsilon,
            "config":  self.config.__dict__,
            "q_table": {k: v.tolist() for k, v in self.q_table.items()}
        }
        with open(path, "w") as f:
            json.dump(data, f)

    def load(self, path: str):
        with open(path) as f:
            data = json.load(f)
        self.episode = data["episode"]
        self.epsilon = data["epsilon"]
        self.config  = RLConfig(**data["config"])
        self.q_table = defaultdict(
            lambda: np.zeros(len(ACTIONS)),
            {k: np.array(v) for k, v in data["q_table"].items()}
        )


# ─── Episode runner / Trainer ─────────────────────────────────────────────────

@dataclass
class EpisodeResult:
    episode:   int
    result:    str    # WIN / DEAD_PIT / DEAD_WUMPUS / TIMEOUT
    score:     int
    steps:     int
    won:       bool
    epsilon:   float
    gold_found: bool


class RLTrainer:
    """
    Runs the RL training loop.

    trainer = RLTrainer(world_config={"size":4,"n_pits":2,...},
                        rl_config=RLConfig(n_episodes=500))
    results = trainer.run()         # blocking, returns list[EpisodeResult]

    For async/streamed training (API use), call trainer.step_episode()
    in a loop and collect results one at a time.
    """

    def __init__(self,
                 world_config: Optional[dict] = None,
                 rl_config: Optional[RLConfig] = None,
                 difficulty: str = "medium"):
        wc = world_config or {}
        if not wc and difficulty:
            from game.world import DIFFICULTY
            wc = DIFFICULTY[difficulty]

        self.world_config = WorldConfig(**wc)
        self.rl_config    = rl_config or RLConfig()
        self.agent        = RLAgent(
            world_size=self.world_config.size,
            config=self.rl_config
        )
        self.history:  list[EpisodeResult] = []

        # Running stats
        self._win_window: list[bool] = []   # last 100 outcomes

    # ── Full training run ─────────────────────────────────────────────────────

    def run(self, callback=None) -> list[EpisodeResult]:
        """
        Run all episodes synchronously.
        Optional callback(episode_result) called after each episode.
        """
        for _ in range(self.rl_config.n_episodes):
            result = self.step_episode()
            if callback:
                callback(result)
        return self.history

    # ── Single episode ────────────────────────────────────────────────────────

    def step_episode(self) -> EpisodeResult:
        """Run one complete episode, update Q-table, return result."""
        # Fresh world with random seed each episode for generalization
        world = WumpusWorld(WorldConfig(
            size       = self.world_config.size,
            n_pits     = self.world_config.n_pits,
            n_wumpuses = self.world_config.n_wumpuses,
            n_arrows   = self.world_config.n_arrows,
            seed       = None,   # random each episode
            max_steps  = self.world_config.max_steps,
        ))

        percept = world.reset()
        self.agent.reset_episode()

        pos       = (world.agent.row, world.agent.col)
        direction = world.agent.direction
        has_gold  = world.agent.has_gold
        arrows    = world.agent.arrows
        done      = False

        while not done:
            action, state = self.agent.choose_action(
                percept, pos, direction, has_gold, arrows
            )
            percept, reward, done = world.step(action)

            pos       = (world.agent.row, world.agent.col)
            direction = world.agent.direction
            has_gold  = world.agent.has_gold
            arrows    = world.agent.arrows

            next_state, _ = self.agent.choose_action(
                percept, pos, direction, has_gold, arrows
            )
            # We use the state encoding as next_state (no action side effect)
            next_state_key = self.agent.encode_state(
                percept, pos, direction, has_gold, arrows
            )
            self.agent.update(state, action, reward, next_state_key, done)

        self.agent.end_episode()

        won = world.result == GameResult.WIN and world.agent.has_gold
        result = EpisodeResult(
            episode   = self.agent.episode,
            result    = world.result.value,
            score     = world.agent.score,
            steps     = world.agent.steps,
            won       = won,
            epsilon   = round(self.agent.epsilon, 4),
            gold_found= world.agent.has_gold,
        )
        self.history.append(result)
        self._win_window.append(won)
        if len(self._win_window) > 100:
            self._win_window.pop(0)
        return result

    # ── Stats helpers ─────────────────────────────────────────────────────────

    def win_rate_last_100(self) -> float:
        if not self._win_window:
            return 0.0
        return round(sum(self._win_window) / len(self._win_window), 3)

    def rolling_stats(self, window: int = 50) -> list[dict]:
        """Returns per-episode rolling averages for charting."""
        results = []
        for i, ep in enumerate(self.history):
            start = max(0, i - window + 1)
            window_eps = self.history[start:i+1]
            results.append({
                "episode":      ep.episode,
                "score":        ep.score,
                "steps":        ep.steps,
                "epsilon":      ep.epsilon,
                "won":          ep.won,
                "win_rate":     round(
                    sum(e.won for e in window_eps) / len(window_eps), 3
                ),
                "avg_score":    round(
                    sum(e.score for e in window_eps) / len(window_eps), 1
                ),
                "avg_steps":    round(
                    sum(e.steps for e in window_eps) / len(window_eps), 1
                ),
                "result":       ep.result,
            })
        return results

    def summary(self) -> dict:
        if not self.history:
            return {}
        scores = [e.score for e in self.history]
        steps  = [e.steps for e in self.history]
        wins   = [e.won   for e in self.history]
        return {
            "total_episodes":     len(self.history),
            "win_rate":           round(sum(wins) / len(wins), 3),
            "win_rate_last_100":  self.win_rate_last_100(),
            "avg_score":          round(float(np.mean(scores)), 1),
            "best_score":         int(max(scores)),
            "worst_score":        int(min(scores)),
            "avg_steps":          round(float(np.mean(steps)), 1),
            "q_table_size":       len(self.agent.q_table),
            "final_epsilon":      round(self.agent.epsilon, 4),
            "deaths_pit":         sum(1 for e in self.history if e.result == "DEAD_PIT"),
            "deaths_wumpus":      sum(1 for e in self.history if e.result == "DEAD_WUMPUS"),
            "timeouts":           sum(1 for e in self.history if e.result == "TIMEOUT"),
        }
