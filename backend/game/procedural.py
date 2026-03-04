"""
wumpus/game/procedural.py
──────────────────────────
Procedural world generation utilities.

Features
────────
  • Seeded deterministic generation
  • Solvability validation (KB agent can find gold)
  • World metadata / fingerprint for seed browser
  • World diversity scoring (how interesting is this world?)
"""

from __future__ import annotations

import hashlib
import random
from typing import Optional

from game.world import WumpusWorld, WorldConfig, DIFFICULTY, GameResult
from agents.knowledge_agent import KnowledgeAgent


def generate_world(difficulty: str = "medium",
                   seed: Optional[int] = None,
                   ensure_solvable: bool = True,
                   max_attempts: int = 50) -> WumpusWorld:
    """
    Generate a world. If ensure_solvable, keep regenerating until
    a KB agent can theoretically solve it (gold is reachable via safe path,
    or at minimum the agent can survive long enough to find it).
    """
    if seed is None:
        seed = random.randint(0, 99999)

    d   = DIFFICULTY[difficulty]
    cfg = WorldConfig(seed=seed, **d)

    for attempt in range(max_attempts):
        world = WumpusWorld(cfg)
        if not ensure_solvable or _is_solvable(world):
            return world
        cfg.seed = (cfg.seed + 1) % 100000   # try next seed

    # Return last attempt even if not confirmed solvable
    return world


def _is_solvable(world: WumpusWorld) -> bool:
    """
    Quick solvability check: simulate KB agent on a copy.
    Returns True if KB agent wins within max_steps.
    Lightweight — runs in microseconds.
    """
    import copy
    from game.world import Action

    w     = copy.deepcopy(world)
    agent = KnowledgeAgent(world_size=w.size, n_arrows=w.config.n_arrows)
    percept = w._last_percept

    for _ in range(w.config.max_steps):
        if w.result != GameResult.ONGOING:
            break
        action = agent.choose_action(
            percept,
            (w.agent.row, w.agent.col),
            w.agent.direction,
        )
        percept, _, done = w.step(action)
        if done:
            break

    return w.result == GameResult.WIN


def world_fingerprint(world: WumpusWorld) -> dict:
    """
    Compute metadata about a world for the seed browser.
    Includes: danger rating, gold location accessibility, world hash.
    """
    size  = world.size
    cells = world.grid

    pits    = sum(cells[r][c].has_pit    for r in range(size) for c in range(size))
    wumpuses= sum(cells[r][c].has_wumpus for r in range(size) for c in range(size))
    gold_pos = next(
        ((r, c) for r in range(size) for c in range(size) if cells[r][c].has_gold),
        None
    )

    # Danger density: % of cells that are hazardous
    total_cells   = size * size - 1   # exclude start
    danger_cells  = pits + wumpuses
    danger_density = round(danger_cells / total_cells, 2)

    # Gold distance from start (Manhattan)
    gold_dist = (abs(gold_pos[0]) + abs(gold_pos[1])) if gold_pos else 0

    # Connectivity: how many cells reachable without hitting hazards
    reachable = _flood_fill(world)

    # World hash (fingerprint for sharing)
    layout = "".join(
        "P" if cells[r][c].has_pit else
        "W" if cells[r][c].has_wumpus else
        "G" if cells[r][c].has_gold else "."
        for r in range(size) for c in range(size)
    )
    w_hash = hashlib.md5(layout.encode()).hexdigest()[:8]

    # Difficulty rating (subjective 1–10)
    difficulty_score = min(10, round(
        danger_density * 8 + (1 - reachable / total_cells) * 4 +
        (1 if gold_dist < 2 else 0) * (-2)
    ))

    return {
        "seed":             world.seed,
        "size":             size,
        "pits":             pits,
        "wumpuses":         wumpuses,
        "gold_pos":         gold_pos,
        "gold_distance":    gold_dist,
        "danger_density":   danger_density,
        "reachable_cells":  reachable,
        "total_cells":      total_cells,
        "difficulty_score": difficulty_score,
        "world_hash":       w_hash,
    }


def _flood_fill(world: WumpusWorld) -> int:
    """Count cells reachable from (0,0) without stepping on hazards."""
    size  = world.size
    cells = world.grid
    visited = set()
    stack   = [(0, 0)]

    while stack:
        r, c = stack.pop()
        if (r, c) in visited:
            continue
        if cells[r][c].has_pit or cells[r][c].has_wumpus:
            continue
        visited.add((r, c))
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r+dr, c+dc
            if 0 <= nr < size and 0 <= nc < size and (nr,nc) not in visited:
                stack.append((nr, nc))

    return len(visited)


def generate_seed_catalog(difficulty: str = "medium",
                          n: int = 20,
                          start_seed: int = 0) -> list[dict]:
    """
    Generate N worlds and return their fingerprints.
    Used by the frontend seed browser to display world previews.
    """
    catalog = []
    for i in range(n):
        seed = start_seed + i
        world = generate_world(difficulty, seed=seed, ensure_solvable=False)
        fp    = world_fingerprint(world)
        catalog.append(fp)
    return catalog
