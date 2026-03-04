"""
wumpus/agents/knowledge_agent.py
─────────────────────────────────
Knowledge-Based Agent using propositional logic inference.

Architecture
────────────
  Percept → KB update → Inference engine → Safe frontier search
         → Action planner → Action

The KB stores:
  • Positive facts:  confirmed pit / wumpus / safe / visited
  • Negative facts:  confirmed NOT pit / NOT wumpus
  • Percept history: per-cell breeze / stench observations
  
Inference rules (Model Elimination style, no external libraries):
  R1: visited(x) ∧ ¬breeze(x)  →  ¬pit(n)  for all n ∈ neighbours(x)
  R2: visited(x) ∧ ¬stench(x)  →  ¬wumpus(n) for all n ∈ neighbours(x)
  R3: ¬pit(x) ∧ ¬wumpus(x)     →  safe(x)
  R4: breeze(x) ∧ only one unknown neighbour → pit(that neighbour)
  R5: stench(x) ∧ only one unknown wumpus candidate → wumpus(that candidate)
  R6: safe(x) ∧ ¬visited(x)    →  frontier candidate
"""

from __future__ import annotations

import copy
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional

from game.world import Action, Direction, Percept, WumpusWorld


# ─── KB Cell record ───────────────────────────────────────────────────────────

@dataclass
class KBCell:
    row: int
    col: int
    # Tri-state: True=confirmed, False=confirmed-not, None=unknown
    has_pit:    Optional[bool] = None
    has_wumpus: Optional[bool] = None
    safe:       bool           = False
    visited:    bool           = False
    breeze:     Optional[bool] = None   # percept observed here
    stench:     Optional[bool] = None


@dataclass
class InferenceLog:
    """Single logged inference step for visualization."""
    rule:       str
    cell:       tuple[int,int]
    conclusion: str
    confidence: float   # 0–1


# ─── Knowledge-Based Agent ────────────────────────────────────────────────────

class KnowledgeAgent:
    """
    A complete propositional-logic Wumpus agent.

    Public interface
    ----------------
    agent = KnowledgeAgent(world_size=4)
    agent.reset()
    action = agent.choose_action(percept, pos, direction)

    After each step:
    agent.inference_log  → list[InferenceLog]  (cleared each step)
    agent.kb_snapshot()  → dict  (full KB state for visualization)
    """

    def __init__(self, world_size: int = 4, n_arrows: int = 1):
        self.size     = world_size
        self.n_arrows = n_arrows
        self.reset()

    def reset(self):
        self.kb: dict[tuple, KBCell] = {}
        for r in range(self.size):
            for c in range(self.size):
                self.kb[(r, c)] = KBCell(r, c)

        # Agent state tracked internally
        self.pos:       tuple[int,int] = (0, 0)
        self.direction: Direction      = Direction.EAST
        self.arrows:    int            = self.n_arrows
        self.has_gold:  bool           = False

        # Mark start as safe/visited
        self.kb[(0,0)].safe    = True
        self.kb[(0,0)].visited = True

        # Action plan queue
        self._plan: deque[Action] = deque()

        # Inference log for this step
        self.inference_log: list[InferenceLog] = []

        # Wumpus location if pinpointed
        self.wumpus_loc: Optional[tuple[int,int]] = None
        self.wumpus_alive: bool = True

        # Danger probability cache (0–1 per cell) for visualization
        self.danger_prob: dict[tuple, float] = {}

    # ── Main interface ────────────────────────────────────────────────────────

    def choose_action(self,
                      percept: Percept,
                      pos: tuple[int,int],
                      direction: Direction) -> Action:
        """
        Given current percept + position + direction, return next action.
        Also updates internal KB and runs inference.
        """
        self.pos       = pos
        self.direction = direction
        self.inference_log.clear()

        # 1. Update KB with percept
        self._observe(percept)

        # 2. Run inference to derive new facts
        self._infer()

        # 3. Update danger probabilities
        self._update_danger_probs()

        # 4. Grab gold if glittering
        if percept.glitter and not self.has_gold:
            self.has_gold = True
            return Action.GRAB

        # 5. Execute existing plan
        if self._plan:
            return self._plan.popleft()

        # 6. If we have gold → plan path back to (0,0) and climb
        if self.has_gold:
            path = self._plan_path(self.pos, (0, 0))
            if path:
                self._plan.extend(path)
                self._plan.append(Action.CLIMB)
                return self._plan.popleft()

        # 7. Shoot wumpus if we know location and have arrows
        if self.wumpus_alive and self.wumpus_loc and self.arrows > 0:
            shoot_actions = self._plan_shoot(self.wumpus_loc)
            if shoot_actions:
                self._plan.extend(shoot_actions)
                return self._plan.popleft()

        # 8. Move to safest unvisited frontier cell
        frontier = self._safe_frontier()
        if frontier:
            target = self._nearest(frontier)
            path   = self._plan_path(self.pos, target)
            if path:
                self._plan.extend(path)
                return self._plan.popleft()

        # 9. No safe moves — take a calculated risk on lowest-danger cell
        risky = self._risky_frontier()
        if risky:
            target = risky[0]
            path   = self._plan_path(self.pos, target)
            if path:
                self._plan.extend(path)
                return self._plan.popleft()

        # 10. Last resort: climb out only if we've explored enough or have gold
        explored = sum(1 for cell in self.kb.values() if cell.visited)
        if self.pos == (0, 0) and (self.has_gold or explored >= 3):
            return Action.CLIMB
        # If stuck at (0,0) but haven't explored enough, try turning to find a path
        if self.pos == (0, 0) and explored < 3:
            # Try all 4 directions for moves
            for turns in [[], [Action.TURN_RIGHT], [Action.TURN_LEFT],
                          [Action.TURN_RIGHT, Action.TURN_RIGHT]]:
                if turns:
                    self._plan.extend(turns)
                self._plan.append(Action.MOVE_FORWARD)
                return self._plan.popleft()
        # Navigate back to exit and climb
        if self.pos != (0, 0):
            path = self._plan_path(self.pos, (0, 0))
            if path:
                self._plan.extend(path)
                self._plan.append(Action.CLIMB)
                return self._plan.popleft()

        return Action.TURN_RIGHT  # absolute last resort: keep turning

    # ── KB update ─────────────────────────────────────────────────────────────

    def _observe(self, percept: Percept):
        r, c = self.pos
        cell = self.kb[(r, c)]
        cell.visited = True
        cell.safe    = True
        cell.breeze  = percept.breeze
        cell.stench  = percept.stench

        # No breeze → no pits in neighbours
        if not percept.breeze:
            for nr, nc in self._neighbours(r, c):
                nb = self.kb[(nr, nc)]
                if nb.has_pit is None:
                    nb.has_pit = False
                    self._log("R1-nobreeze", (nr, nc),
                              f"NOT pit({nr},{nc}) — no breeze at ({r},{c})", 1.0)

        # No stench → no wumpus in neighbours
        if not percept.stench:
            for nr, nc in self._neighbours(r, c):
                nb = self.kb[(nr, nc)]
                if nb.has_wumpus is None:
                    nb.has_wumpus = False
                    self._log("R2-nostench", (nr, nc),
                              f"NOT wumpus({nr},{nc}) — no stench at ({r},{c})", 1.0)

        # Scream → wumpus is dead
        if percept.scream:
            self.wumpus_alive = False
            self.wumpus_loc   = None
            for cell in self.kb.values():
                cell.has_wumpus = False
            self._log("R-scream", self.pos, "Wumpus DEAD — scream heard", 1.0)

    # ── Inference engine ──────────────────────────────────────────────────────

    def _infer(self):
        """
        Iteratively apply inference rules until no new facts are derived.
        Implements a forward-chaining fixpoint loop.
        """
        changed = True
        iterations = 0
        while changed and iterations < 20:
            changed = False
            iterations += 1

            for (r, c), cell in self.kb.items():
                # R3: known not-pit and not-wumpus → safe
                if (cell.has_pit is False and
                        cell.has_wumpus is False and
                        not cell.safe):
                    cell.safe = True
                    changed   = True
                    self._log("R3-safe", (r,c),
                              f"SAFE({r},{c}) — no pit, no wumpus", 1.0)

                # R4: breeze + exactly one unknown neighbour → that cell has pit
                if cell.breeze and cell.visited:
                    unknown_nbrs = [
                        (nr, nc)
                        for nr, nc in self._neighbours(r, c)
                        if self.kb[(nr, nc)].has_pit is None
                    ]
                    if len(unknown_nbrs) == 1:
                        nr, nc = unknown_nbrs[0]
                        if self.kb[(nr, nc)].has_pit is not True:
                            self.kb[(nr, nc)].has_pit = True
                            changed = True
                            self._log("R4-pit", (nr, nc),
                                      f"PIT({nr},{nc}) — only candidate for breeze at ({r},{c})",
                                      0.95)

                # R5: stench + exactly one unknown wumpus candidate → wumpus
                if cell.stench and cell.visited and self.wumpus_alive:
                    unknown_nbrs = [
                        (nr, nc)
                        for nr, nc in self._neighbours(r, c)
                        if self.kb[(nr, nc)].has_wumpus is None
                    ]
                    if len(unknown_nbrs) == 1:
                        nr, nc = unknown_nbrs[0]
                        if self.kb[(nr, nc)].has_wumpus is not True:
                            self.kb[(nr, nc)].has_wumpus = True
                            self.wumpus_loc = (nr, nc)
                            changed = True
                            self._log("R5-wumpus", (nr, nc),
                                      f"WUMPUS({nr},{nc}) — only candidate for stench at ({r},{c})",
                                      0.95)

            # Global wumpus inference: intersection of all stench-neighbour sets
            if self.wumpus_alive and self.wumpus_loc is None:
                self._global_wumpus_inference()
                changed = True  # may have updated

    def _global_wumpus_inference(self):
        """
        Collect all cells adjacent to stench cells that are still possible
        wumpus locations (has_wumpus is not False). If only one remains,
        we know the wumpus location.
        """
        stench_cells = [
            (r, c) for (r, c), cell in self.kb.items()
            if cell.stench and cell.visited
        ]
        if not stench_cells:
            return

        candidate_sets = []
        for (r, c) in stench_cells:
            candidates = frozenset(
                (nr, nc)
                for nr, nc in self._neighbours(r, c)
                if self.kb[(nr, nc)].has_wumpus is not False
            )
            candidate_sets.append(candidates)

        if not candidate_sets:
            return

        intersection = candidate_sets[0]
        for s in candidate_sets[1:]:
            intersection = intersection & s

        if len(intersection) == 1:
            loc = next(iter(intersection))
            if self.kb[loc].has_wumpus is not True:
                self.kb[loc].has_wumpus = True
                self.wumpus_loc = loc
                self._log("R5-global", loc,
                          f"WUMPUS({loc[0]},{loc[1]}) — global stench intersection",
                          0.90)

    # ── Danger probability estimation ─────────────────────────────────────────

    def _update_danger_probs(self):
        """
        Assign a danger probability [0,1] to each cell for visualization.
        Based on:
          • Confirmed safe  → 0.0
          • Confirmed pit   → 1.0
          • Confirmed wumpus → 1.0
          • Unknown, adjacent to breeze → 0.4–0.8
          • Unknown, not adjacent to anything → 0.2
        """
        for (r, c), cell in self.kb.items():
            if cell.safe:
                self.danger_prob[(r, c)] = 0.0
            elif cell.has_pit is True or cell.has_wumpus is True:
                self.danger_prob[(r, c)] = 1.0
            else:
                # Count adjacent breezy / stenchy visited cells
                breeze_adj = sum(
                    1 for nr, nc in self._neighbours(r, c)
                    if self.kb[(nr, nc)].breeze
                )
                stench_adj = sum(
                    1 for nr, nc in self._neighbours(r, c)
                    if self.kb[(nr, nc)].stench
                )
                base = 0.15
                prob = min(1.0, base + 0.2 * breeze_adj + 0.2 * stench_adj)
                self.danger_prob[(r, c)] = prob

    # ── Path planning (BFS on known-safe cells) ───────────────────────────────

    def _plan_path(self,
                   start: tuple[int,int],
                   goal:  tuple[int,int]) -> list[Action]:
        """BFS on safe cells only; returns list of Actions."""
        if start == goal:
            return []

        # State: (row, col, direction)
        init = (start[0], start[1], self.direction)
        queue = deque([(init, [])])
        visited = {init}

        while queue:
            (r, c, d), actions = queue.popleft()

            for action, (nr, nc, nd) in self._transitions(r, c, d):
                if (nr, nc, nd) in visited:
                    continue
                # Allow traversal of safe cells (and goal even if unknown)
                if not self.kb[(nr, nc)].safe and (nr, nc) != goal:
                    continue
                new_actions = actions + [action]
                if (nr, nc) == goal:
                    return new_actions
                visited.add((nr, nc, nd))
                queue.append(((nr, nc, nd), new_actions))

        return []   # No path found

    def _transitions(self, r: int, c: int,
                     d: Direction) -> list[tuple[Action, tuple]]:
        """All (action, result_state) from (r, c, d)."""
        results = []
        # Turns
        results.append((Action.TURN_LEFT,
                         (r, c, d.turn_left())))
        results.append((Action.TURN_RIGHT,
                         (r, c, d.turn_right())))
        # Move forward
        dr, dc = d.delta()
        nr, nc = r + dr, c + dc
        if 0 <= nr < self.size and 0 <= nc < self.size:
            results.append((Action.MOVE_FORWARD, (nr, nc, d)))
        return results

    # ── Shoot planning ────────────────────────────────────────────────────────

    def _plan_shoot(self, target: tuple[int,int]) -> list[Action]:
        """
        Plan to face the target and shoot.
        Returns actions list: [turns..., SHOOT]
        """
        tr, tc = target
        r, c   = self.pos
        d      = self.direction

        # Determine required direction
        if tr == r:
            needed = Direction.EAST if tc > c else Direction.WEST
        elif tc == c:
            needed = Direction.SOUTH if tr > r else Direction.NORTH
        else:
            return []   # Can't shoot diagonally

        turns = self._turns_to_face(d, needed)
        return turns + [Action.SHOOT]

    def _turns_to_face(self, current: Direction,
                       target: Direction) -> list[Action]:
        """Minimum turns to face target direction."""
        if current == target:
            return []
        cw = []
        ccw = []
        d = current
        for _ in range(4):
            d = d.turn_right()
            cw.append(Action.TURN_RIGHT)
            if d == target:
                break
        d = current
        for _ in range(4):
            d = d.turn_left()
            ccw.append(Action.TURN_LEFT)
            if d == target:
                break
        return cw if len(cw) <= len(ccw) else ccw

    # ── Frontier helpers ──────────────────────────────────────────────────────

    def _safe_frontier(self) -> list[tuple[int,int]]:
        """Unvisited cells confirmed safe."""
        return [
            (r, c) for (r, c), cell in self.kb.items()
            if cell.safe and not cell.visited
        ]

    def _risky_frontier(self) -> list[tuple[int,int]]:
        """
        Unvisited cells reachable (adjacent to visited), sorted by danger prob.
        Used when no safe moves exist.
        """
        visited = {(r, c) for (r, c), cell in self.kb.items() if cell.visited}
        candidates = set()
        for (r, c) in visited:
            for nr, nc in self._neighbours(r, c):
                cell = self.kb[(nr, nc)]
                if not cell.visited and cell.has_pit is not True and \
                        cell.has_wumpus is not True:
                    candidates.add((nr, nc))
        return sorted(candidates,
                      key=lambda p: self.danger_prob.get(p, 0.5))

    def _nearest(self, cells: list[tuple[int,int]]) -> tuple[int,int]:
        """Manhattan-distance nearest cell to agent."""
        r, c = self.pos
        return min(cells, key=lambda p: abs(p[0]-r) + abs(p[1]-c))

    def _neighbours(self, r: int, c: int) -> list[tuple[int,int]]:
        result = []
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.size and 0 <= nc < self.size:
                result.append((nr, nc))
        return result

    # ── Logging ───────────────────────────────────────────────────────────────

    def _log(self, rule: str, cell: tuple, conclusion: str, conf: float):
        self.inference_log.append(InferenceLog(
            rule=rule, cell=cell,
            conclusion=conclusion, confidence=conf
        ))

    # ── Snapshot for visualisation ────────────────────────────────────────────

    def kb_snapshot(self) -> dict:
        """
        Returns full KB state as a JSON-safe dict.
        Used by the frontend to render the Agent Brain panel.
        """
        cells = []
        for r in range(self.size):
            row = []
            for c in range(self.size):
                cell = self.kb[(r, c)]
                row.append({
                    "row":        r,
                    "col":        c,
                    "visited":    cell.visited,
                    "safe":       cell.safe,
                    "has_pit":    cell.has_pit,
                    "has_wumpus": cell.has_wumpus,
                    "breeze":     cell.breeze,
                    "stench":     cell.stench,
                    "danger_prob": round(self.danger_prob.get((r,c), 0.5), 3),
                })
            cells.append(row)

        return {
            "type": "knowledge_based",
            "cells": cells,
            "wumpus_loc":   self.wumpus_loc,
            "wumpus_alive": self.wumpus_alive,
            "inference_log": [
                {
                    "rule":       log.rule,
                    "cell":       log.cell,
                    "conclusion": log.conclusion,
                    "confidence": log.confidence,
                }
                for log in self.inference_log
            ],
            "plan_length": len(self._plan),
        }
