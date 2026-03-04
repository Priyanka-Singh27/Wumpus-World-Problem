"""
wumpus/game/world.py
────────────────────
Core Wumpus World engine.

Responsibilities
  • Procedural world generation (seeded, reproducible)
  • Full game-rule enforcement (movement, shooting, grabbing, climbing)
  • Percept computation per cell
  • Scoring
  • Serialisation to plain dicts (JSON-safe) for the API layer
"""

from __future__ import annotations

import copy
import json
import random
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


# ─── Enumerations ─────────────────────────────────────────────────────────────

class Direction(str, Enum):
    NORTH = "NORTH"
    EAST  = "EAST"
    SOUTH = "SOUTH"
    WEST  = "WEST"

    def turn_left(self) -> "Direction":
        order = [Direction.NORTH, Direction.WEST, Direction.SOUTH, Direction.EAST]
        return order[(order.index(self) + 1) % 4]

    def turn_right(self) -> "Direction":
        order = [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST]
        return order[(order.index(self) + 1) % 4]

    def delta(self) -> tuple[int, int]:
        """Returns (dr, dc) — row increases downward."""
        return {
            Direction.NORTH: (-1,  0),
            Direction.SOUTH: ( 1,  0),
            Direction.EAST:  ( 0,  1),
            Direction.WEST:  ( 0, -1),
        }[self]


class Action(str, Enum):
    MOVE_FORWARD = "MOVE_FORWARD"
    TURN_LEFT    = "TURN_LEFT"
    TURN_RIGHT   = "TURN_RIGHT"
    SHOOT        = "SHOOT"
    GRAB         = "GRAB"
    CLIMB        = "CLIMB"


class GameResult(str, Enum):
    ONGOING  = "ONGOING"
    WIN      = "WIN"
    DEAD_PIT = "DEAD_PIT"
    DEAD_WUMPUS = "DEAD_WUMPUS"
    TIMEOUT  = "TIMEOUT"


# ─── Difficulty presets ───────────────────────────────────────────────────────

DIFFICULTY = {
    "easy":   {"size": 4, "n_pits": 2, "n_wumpuses": 1, "n_arrows": 3},
    "medium": {"size": 6, "n_pits": 4, "n_wumpuses": 1, "n_arrows": 2},
    "hard":   {"size": 8, "n_pits": 8, "n_wumpuses": 2, "n_arrows": 1},
    "expert": {"size":10, "n_pits":12, "n_wumpuses": 3, "n_arrows": 1},
}


# ─── Score constants ──────────────────────────────────────────────────────────

SCORE_STEP          = -1
SCORE_SHOOT_MISS    = -10
SCORE_SHOOT_HIT     = +500
SCORE_DIE           = -1000
SCORE_GRAB_GOLD     = +1000
SCORE_CLIMB_SUCCESS = +500
SCORE_CLIMB_NO_GOLD = -50


# ─── Data structures ─────────────────────────────────────────────────────────

@dataclass
class Cell:
    row: int
    col: int
    has_pit:    bool = False
    has_wumpus: bool = False
    has_gold:   bool = False
    visited:    bool = False


@dataclass
class Percept:
    stench:  bool = False   # adjacent wumpus (alive)
    breeze:  bool = False   # adjacent pit
    glitter: bool = False   # gold in same cell
    bump:    bool = False   # walked into wall
    scream:  bool = False   # wumpus just died

    def to_tuple(self) -> tuple:
        return (self.stench, self.breeze, self.glitter, self.bump, self.scream)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AgentState:
    row: int = 0
    col: int = 0
    direction: Direction = Direction.EAST
    has_gold:  bool = False
    arrows:    int  = 1
    alive:     bool = True
    score:     int  = 0
    steps:     int  = 0


@dataclass
class WorldConfig:
    size:       int = 4
    n_pits:     int = 2
    n_wumpuses: int = 1
    n_arrows:   int = 1
    seed:       Optional[int] = None
    max_steps:  int = 0   # 0 = auto (10 * size^2)

    def __post_init__(self):
        if self.max_steps == 0:
            self.max_steps = 10 * self.size * self.size


# ─── World ────────────────────────────────────────────────────────────────────

class WumpusWorld:
    """
    Complete Wumpus World simulation.

    Usage
    -----
        world = WumpusWorld.from_difficulty("medium", seed=42)
        percept = world.reset()

        while world.result == GameResult.ONGOING:
            action = agent.choose(percept)
            percept, reward, done = world.step(action)
    """

    def __init__(self, config: WorldConfig):
        self.config   = config
        self.size     = config.size
        self._rng     = random.Random(config.seed)
        self.seed     = config.seed

        # will be populated by reset()
        self.grid:    list[list[Cell]] = []
        self.agent:   AgentState       = AgentState()
        self.result:  GameResult       = GameResult.ONGOING
        self.wumpus_positions: list[tuple[int,int]] = []
        self._last_percept: Percept    = Percept()
        self._history: list[dict]      = []   # for replay / visualization

        self.reset()

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    def from_difficulty(cls, level: str = "medium",
                        seed: Optional[int] = None) -> "WumpusWorld":
        d = DIFFICULTY[level]
        cfg = WorldConfig(seed=seed, **d)
        return cls(cfg)

    @classmethod
    def from_config(cls, config: dict) -> "WumpusWorld":
        cfg = WorldConfig(**config)
        return cls(cfg)

    # ── Reset / Generation ────────────────────────────────────────────────────

    def reset(self) -> Percept:
        """Re-generate the world and return the initial percept."""
        self._rng = random.Random(self.config.seed)   # reproducible
        self._history.clear()

        # Build empty grid
        self.grid = [
            [Cell(r, c) for c in range(self.size)]
            for r in range(self.size)
        ]

        # Agent always starts at (0,0) facing EAST
        self.agent = AgentState(arrows=self.config.n_arrows)
        self.grid[0][0].visited = True
        self.result = GameResult.ONGOING

        # Place hazards — never in (0,0)
        forbidden = {(0, 0)}
        self.wumpus_positions = self._place_entities(
            self.config.n_wumpuses, forbidden, "wumpus"
        )
        self._place_entities(self.config.n_pits, forbidden, "pit")
        self._place_entities(1, forbidden, "gold")

        percept = self._compute_percept()
        self._last_percept = percept
        self._record_step(None, percept, 0)
        return percept

    def _place_entities(self, n: int, forbidden: set,
                        kind: str) -> list[tuple[int,int]]:
        placed = []
        candidates = [
            (r, c)
            for r in range(self.size)
            for c in range(self.size)
            if (r, c) not in forbidden
        ]
        chosen = self._rng.sample(candidates, min(n, len(candidates)))
        for (r, c) in chosen:
            if kind == "wumpus":
                self.grid[r][c].has_wumpus = True
            elif kind == "pit":
                self.grid[r][c].has_pit = True
            elif kind == "gold":
                self.grid[r][c].has_gold = True
            forbidden.add((r, c))
            placed.append((r, c))
        return placed

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(self, action: Action) -> tuple[Percept, int, bool]:
        """
        Apply an action.

        Returns
        -------
        percept : Percept
        reward  : int   (delta score this step)
        done    : bool
        """
        if self.result != GameResult.ONGOING:
            raise RuntimeError("Game is already over. Call reset().")

        reward = 0
        percept = Percept()

        # ── Timeout check ────────────────────────────────────────────────────
        if self.agent.steps >= self.config.max_steps:
            self.result = GameResult.TIMEOUT
            self._record_step(action, percept, reward)
            return percept, reward, True

        self.agent.steps += 1

        # ── Action dispatch ──────────────────────────────────────────────────
        if action == Action.TURN_LEFT:
            self.agent.direction = self.agent.direction.turn_left()
            reward += SCORE_STEP

        elif action == Action.TURN_RIGHT:
            self.agent.direction = self.agent.direction.turn_right()
            reward += SCORE_STEP

        elif action == Action.MOVE_FORWARD:
            reward += SCORE_STEP
            dr, dc = self.agent.direction.delta()
            nr = self.agent.row + dr
            nc = self.agent.col + dc

            if not self._in_bounds(nr, nc):
                percept.bump = True
            else:
                self.agent.row = nr
                self.agent.col = nc
                self.grid[nr][nc].visited = True

                cell = self.grid[nr][nc]
                if cell.has_pit:
                    reward += SCORE_DIE
                    self.agent.alive = False
                    self.result = GameResult.DEAD_PIT
                elif cell.has_wumpus:
                    reward += SCORE_DIE
                    self.agent.alive = False
                    self.result = GameResult.DEAD_WUMPUS

        elif action == Action.SHOOT:
            if self.agent.arrows > 0:
                self.agent.arrows -= 1
                hit, pos = self._shoot_arrow()
                if hit:
                    reward += SCORE_SHOOT_HIT
                    percept.scream = True
                    # Remove wumpus from grid
                    self.grid[pos[0]][pos[1]].has_wumpus = False
                    self.wumpus_positions = [
                        p for p in self.wumpus_positions if p != pos
                    ]
                else:
                    reward += SCORE_SHOOT_MISS
            reward += SCORE_STEP

        elif action == Action.GRAB:
            reward += SCORE_STEP
            cell = self.grid[self.agent.row][self.agent.col]
            if cell.has_gold:
                cell.has_gold = False
                self.agent.has_gold = True
                reward += SCORE_GRAB_GOLD

        elif action == Action.CLIMB:
            reward += SCORE_STEP
            if self.agent.row == 0 and self.agent.col == 0:
                if self.agent.has_gold:
                    reward += SCORE_CLIMB_SUCCESS
                    self.result = GameResult.WIN
                else:
                    reward += SCORE_CLIMB_NO_GOLD
                    # Allow climbing without gold (just loses points)
                    self.result = GameResult.WIN
            # If not at (0,0), climb does nothing (costs a step)

        # ── Update score ──────────────────────────────────────────────────────
        self.agent.score += reward

        # ── Compute percept ───────────────────────────────────────────────────
        # Preserve transient flags (bump/scream) set during action processing
        had_bump   = percept.bump
        had_scream = percept.scream

        if self.result == GameResult.ONGOING:
            base = self._compute_percept()
            base.bump   = had_bump
            base.scream = had_scream
            percept = base

        self._last_percept = percept
        done = self.result != GameResult.ONGOING
        self._record_step(action, percept, reward)
        return percept, reward, done

    # ── Percept computation ───────────────────────────────────────────────────

    def _compute_percept(self) -> Percept:
        r, c = self.agent.row, self.agent.col
        p = Percept()

        # Gold glitter
        p.glitter = self.grid[r][c].has_gold

        # Check neighbours for stench / breeze
        for nr, nc in self._neighbours(r, c):
            if self.grid[nr][nc].has_wumpus:
                p.stench = True
            if self.grid[nr][nc].has_pit:
                p.breeze = True

        # Also check current cell (wumpus / pit already handled in step)
        return p

    # ── Arrow mechanics ───────────────────────────────────────────────────────

    def _shoot_arrow(self) -> tuple[bool, Optional[tuple[int,int]]]:
        """Shoot arrow in current direction; returns (hit, position_if_hit)."""
        dr, dc = self.agent.direction.delta()
        r, c   = self.agent.row, self.agent.col
        while True:
            r += dr
            c += dc
            if not self._in_bounds(r, c):
                return False, None
            if self.grid[r][c].has_wumpus:
                return True, (r, c)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _in_bounds(self, r: int, c: int) -> bool:
        return 0 <= r < self.size and 0 <= c < self.size

    def _neighbours(self, r: int, c: int) -> list[tuple[int,int]]:
        result = []
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r + dr, c + dc
            if self._in_bounds(nr, nc):
                result.append((nr, nc))
        return result

    def _record_step(self, action, percept: Percept, reward: int):
        self._history.append({
            "step":    self.agent.steps,
            "action":  action.value if action else None,
            "pos":     (self.agent.row, self.agent.col),
            "dir":     self.agent.direction.value,
            "percept": percept.to_dict(),
            "reward":  reward,
            "score":   self.agent.score,
            "result":  self.result.value,
        })

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self, reveal: bool = False) -> dict:
        """
        Serialise world state.

        reveal=True  → expose full grid (for debugging / post-game)
        reveal=False → only expose visited cells (fog of war)
        """
        cells = []
        for r in range(self.size):
            row = []
            for c in range(self.size):
                cell = self.grid[r][c]
                visible = cell.visited or reveal
                # Compute static percepts (breeze/stench) for this cell
                nbrs = self._neighbours(r, c)
                cell_breeze = any(self.grid[nr][nc].has_pit    for nr, nc in nbrs)
                cell_stench = any(self.grid[nr][nc].has_wumpus for nr, nc in nbrs)
                row.append({
                    "row":        r,
                    "col":        c,
                    "visited":    cell.visited,
                    "has_pit":    cell.has_pit    if visible else None,
                    "has_wumpus": cell.has_wumpus if visible else None,
                    "has_gold":   cell.has_gold   if visible else None,
                    "breeze":     cell_breeze      if visible else None,
                    "stench":     cell_stench      if visible else None,
                })
            cells.append(row)

        return {
            "size":   self.size,
            "seed":   self.seed,
            "cells":  cells,
            "agent": {
                "row":       self.agent.row,
                "col":       self.agent.col,
                "direction": self.agent.direction.value,
                "has_gold":  self.agent.has_gold,
                "arrows":    self.agent.arrows,
                "alive":     self.agent.alive,
                "score":     self.agent.score,
                "steps":     self.agent.steps,
            },
            "result":        self.result.value,
            "percept":       self._last_percept.to_dict(),
            "wumpus_alive":  len(self.wumpus_positions) > 0,
            "config": {
                "size":       self.config.size,
                "n_pits":     self.config.n_pits,
                "n_wumpuses": self.config.n_wumpuses,
                "n_arrows":   self.config.n_arrows,
                "max_steps":  self.config.max_steps,
            }
        }

    def get_history(self) -> list[dict]:
        return copy.deepcopy(self._history)

    def __repr__(self) -> str:  # pragma: no cover
        lines = []
        for r in range(self.size - 1, -1, -1):
            row_str = ""
            for c in range(self.size):
                cell = self.grid[r][c]
                if self.agent.row == r and self.agent.col == c:
                    ch = "A"
                elif cell.has_wumpus:
                    ch = "W"
                elif cell.has_pit:
                    ch = "P"
                elif cell.has_gold:
                    ch = "G"
                else:
                    ch = "."
                row_str += f"[{ch}]"
            lines.append(f"{r} {row_str}")
        lines.append("  " + "  ".join(str(c) for c in range(self.size)))
        return "\n".join(lines)
