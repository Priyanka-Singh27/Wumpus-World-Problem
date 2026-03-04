"""
wumpus/agents/random_agent.py
──────────────────────────────
Random agent — baseline comparator.
Always chooses a uniformly random action from the full action space.
Used to demonstrate how much better KB and RL agents perform.
"""

from __future__ import annotations

import random
from game.world import Action, Direction, Percept

ACTIONS = list(Action)


class RandomAgent:
    """Uniformly random action selection. No learning, no knowledge."""

    def __init__(self):
        self.step_count = 0

    def reset(self):
        self.step_count = 0

    def choose_action(self, percept: Percept,
                      pos: tuple[int,int],
                      direction: Direction,
                      has_gold: bool = False,
                      arrows: int = 1) -> Action:
        self.step_count += 1
        # Small bias: if glitter, grab; if at (0,0) with gold, climb
        if percept.glitter and not has_gold:
            return Action.GRAB
        if pos == (0, 0) and has_gold:
            return Action.CLIMB
        return random.choice(ACTIONS)

    def kb_snapshot(self) -> dict:
        return {"type": "random", "step_count": self.step_count}
