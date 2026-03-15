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
    """
    All tunable hyperparameters for the Q-learning agent in one place.

    alpha (learning rate):
        Controls how much each new experience overwrites the old Q-value.
        0.0 = agent never updates (learns nothing).
        1.0 = agent completely overwrites old Q-value with new estimate.
        0.2 = gentle update — blends 20% new info into 80% existing knowledge.
        Too high → unstable, forgets past. Too low → learns very slowly.

    gamma (discount factor):
        Controls how much the agent values future rewards vs immediate ones.
        0.0 = agent only cares about the immediate reward (completely myopic).
        1.0 = agent values future rewards equally to immediate ones.
        0.95 = a reward 10 steps away is worth 0.95^10 ≈ 0.60 of its face value.
        High gamma encourages long-horizon planning (find gold even if far away).

    epsilon_start / epsilon_end / epsilon_decay:
        Control the exploration-exploitation trade-off over training.
        See RLAgent.end_episode() for how decay works.
    """
    alpha:          float = 0.2    # learning rate — how fast Q-values update
    gamma:          float = 0.95   # discount factor — how much future rewards matter
    epsilon_start:  float = 1.0    # start fully random (pure exploration)
    epsilon_end:    float = 0.05   # never go below 5% random (always explore a little)
    epsilon_decay:  float = 0.995  # multiply epsilon by this after each episode
    n_episodes:     int   = 1000   # total training episodes
    max_steps:      int   = 0      # 0 = use world's own default step limit


# All six possible actions the agent can take, in a stable list order.
# This order determines which index in the Q-value array maps to which action.
ACTIONS = list(Action)

# Reverse mapping: Action → array index.
# Used in update() to know which slot in the Q array to update.
# e.g. ACTION_IDX[Action.GRAB] = 4
ACTION_IDX = {a: i for i, a in enumerate(ACTIONS)}


# ─── Q-Learning Agent ─────────────────────────────────────────────────────────

class RLAgent:
    """
    Tabular Q-learning agent for the Wumpus World.

    How it works at a high level:
    ─────────────────────────────
    The agent maintains a Q-table: a dictionary mapping every (state, action)
    pair it has ever seen to an estimated future reward (the Q-value).

    At each step:
        1. Encode the current situation as a state string.
        2. ε-greedy: with probability ε pick a random action (explore),
           otherwise pick the action with the highest Q-value (exploit).
        3. Execute the action, receive a reward from the world.
        4. Update the Q-value using the Bellman equation.

    Over thousands of episodes, Q-values converge toward accurate estimates
    of expected future reward, and the policy (argmax of Q) improves.

    Usage
    -----
        agent = RLAgent(world_size=4, config=RLConfig())
        agent.reset_episode()
        action = agent.choose_action(percept, pos, direction, has_gold, arrows)
        agent.update(state, action, reward, next_state, done)
    """

    def __init__(self, world_size: int = 4, config: Optional[RLConfig] = None):
        self.size    = world_size          # grid is size × size
        self.config  = config or RLConfig()
        self.epsilon = self.config.epsilon_start  # starts at 1.0 (fully random)

        # ── Q-table ──────────────────────────────────────────────────────────
        # Maps state_key (str) → numpy array of shape (6,)
        # One float per action — the estimated total future reward from that state.
        #
        # We use defaultdict so any unseen state automatically gets a zero array.
        # Zero means "no opinion yet" — the agent treats all actions as equally
        # unknown at first, which causes random tie-breaking until it learns.
        #
        # State space size example:
        #   4×4 grid, 2^5 percept combos, 4 directions, 2 gold states, 4 arrow levels
        #   = 32 × 4 × 4 × 4 × 2 × 4 = 16,384 states maximum
        #   In practice far fewer states are ever visited.
        self.q_table: dict[str, np.ndarray] = defaultdict(
            lambda: np.zeros(len(ACTIONS))
        )

        self.episode = 0                   # incremented by end_episode()
        self._last_state: Optional[str] = None  # used for debugging / continuity

    # ── State encoding ────────────────────────────────────────────────────────

    def encode_state(self, percept: Percept,
                     pos: tuple[int,int],
                     direction: Direction,
                     has_gold: bool,
                     arrows: int) -> str:
        """
        Convert the agent's full situation into a compact string key.

        Why a string key instead of a tuple?
        - Readable for debugging ("10000_2_3_1_0_1" is interpretable at a glance)
        - Works as a dict key just like a tuple would
        - JSON-serializable for saving/loading the Q-table

        Format: '{stench}{breeze}{glitter}{bump}{scream}_{row}_{col}_{dir_idx}_{has_gold}_{arrows}'

        Example: '10000_2_3_1_0_1'
            stench=1, breeze=0, glitter=0, bump=0, scream=0
            position [2,3], facing EAST (index 1), no gold, 1 arrow

        Why cap arrows at 3?
            Arrows beyond 3 are treated identically — the marginal value of a
            4th arrow vs a 3rd is negligible, so we collapse them to keep the
            state space small and avoid sparse Q-table entries.

        Why include position, not just percepts?
            Two cells can have identical percepts but very different values.
            E.g. [0,0] with stench=0 is the exit cell — very valuable (can CLIMB).
            [3,3] with stench=0 is just a random safe cell. Without position,
            the agent can't distinguish these.

        Why NOT include the full grid layout (pit/wumpus/gold locations)?
            That would create 4^(N×N) states — completely intractable.
            For 6×6: 4^36 ≈ 5 trillion states. The featurized state is an
            intentional approximation trading accuracy for tractability.
        """
        dir_idx = list(Direction).index(direction)  # N=0, E=1, S=2, W=3
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
        Decide what action to take given the current situation.

        Returns both the chosen action AND the state key, because the caller
        (RLTrainer.step_episode) needs the state key to call update() afterward.
        We encode the state here once rather than encoding it again separately.

        ε-greedy policy:
        ────────────────
        With probability ε  → EXPLORE: pick a uniformly random action.
        With probability 1-ε → EXPLOIT: pick argmax_a Q(state, a).

        Why keep exploring at all once we have Q-values?
        - The world is different each episode (random seed). States we've rarely
          visited may have wrong Q-values. Random exploration discovers corrections.
        - Without exploration the agent can get permanently stuck exploiting a
          mediocre policy (local optimum) and never find better strategies.

        Why argmax and not softmax (sampling proportional to Q-values)?
        - Argmax is simpler, more stable, and standard for tabular Q-learning.
        - Softmax introduces another temperature hyperparameter to tune.
        - The epsilon mechanism already handles the explore/exploit balance.

        Tie-breaking:
        - np.argmax returns the FIRST max index when multiple actions tie.
        - Early in training all Q-values are 0, so it always picks ACTIONS[0]
          (MOVE_FORWARD) deterministically. This is fine — epsilon is high early
          so most actions are random anyway. Tie-breaking only matters late
          in training when Q-values have diverged.
        """
        state = self.encode_state(percept, pos, direction, has_gold, arrows)
        self._last_state = state

        if random.random() < self.epsilon:
            # ── Exploration branch ──
            # Uniform random over all 6 actions regardless of Q-values.
            # This fires with probability ε, which starts at 1.0 and decays.
            action = random.choice(ACTIONS)
        else:
            # ── Exploitation branch ──
            # Look up the Q-value array for this state and pick the best action.
            # If this state has never been seen, defaultdict returns zeros,
            # so argmax picks ACTIONS[0] — functionally random but deterministic.
            q_vals = self.q_table[state]
            action = ACTIONS[int(np.argmax(q_vals))]

        return action, state

    # ── Q-update ─────────────────────────────────────────────────────────────

    def update(self, state: str, action: Action,
               reward: float, next_state: str, done: bool):
        """
        Apply the Q-learning (Bellman) update after one step.

        The update rule:
            Q(s, a) ← Q(s, a) + α × [r + γ × max_a' Q(s', a') - Q(s, a)]

        Broken down:
            td_target = r + γ × max Q(s')
                The "target" — what we now believe Q(s,a) should be.
                It's the immediate reward PLUS the discounted best possible
                future reward from the next state.
                If this episode is done (terminal state), there is no future,
                so max Q(s') = 0 and td_target = r only.

            td_error  = td_target - Q(s, a)
                The "surprise" — how wrong our current estimate was.
                Positive: outcome was better than expected → Q goes up.
                Negative: outcome was worse than expected  → Q goes down.
                Zero:     outcome exactly matched expectation → no change.

            Q(s, a) += α × td_error
                Nudge Q toward the target by a fraction α.
                α=0.2 means: take 20% of the new estimate, keep 80% of old.

        Why not just set Q(s,a) = td_target directly?
            Because td_target itself uses Q(s') which is also an estimate.
            Overwriting completely would make learning unstable — one bad episode
            could destroy all previously learned knowledge. The α blend smooths
            out noise across many experiences.

        This is called "bootstrapping" — we use our own Q-estimates to improve
        our Q-estimates, without needing a separate supervisor or model.

        Concrete example:
            state: at [1,1] facing East, no percepts
            action: MOVE_FORWARD
            reward: -1 (step cost)
            next_state: at [1,2] with breeze (pit nearby)
            Q(s, MOVE_FORWARD) was: +5.2 (agent thought this was a good move)
            max Q(s'): -12.3 (agent knows [1,2] leads to bad outcomes)

            td_target = -1 + 0.95 × (-12.3) = -12.685
            td_error  = -12.685 - 5.2        = -17.885   (big negative surprise)
            new Q     = 5.2 + 0.2 × (-17.885) = +1.623   (Q drops significantly)

            Repeated across many episodes: Q(move toward breezy cell) → negative.
            The agent learns to avoid moving toward breezy cells.
        """
        idx = ACTION_IDX[action]    # which slot in the Q-array to update

        q_current = self.q_table[state][idx]   # current estimate we're updating

        # If the episode is done, there is no future state to consider.
        # The terminal reward is the entire value — no discounting needed.
        q_next_max = 0.0 if done else float(np.max(self.q_table[next_state]))

        td_target  = reward + self.config.gamma * q_next_max   # what Q should be
        td_error   = td_target - q_current                     # how wrong we were
        self.q_table[state][idx] += self.config.alpha * td_error  # nudge toward target

    def end_episode(self):
        """
        Call at the end of each episode to decay epsilon.

        Epsilon schedule:
            ε_new = max(ε_end, ε_current × ε_decay)

        With default values (decay=0.995, end=0.05):
            Episode 1:    ε = 1.000  → 100% random
            Episode 100:  ε ≈ 0.606  → 60% random, 40% exploit
            Episode 300:  ε ≈ 0.223  → 22% random
            Episode 600:  ε ≈ 0.050  → floor reached, stays at 5%
            Episode 1000: ε = 0.050  → 5% random forever

        Why keep 5% random at the floor?
        - The agent will encounter world configurations it has rarely seen.
          A small random chance means it occasionally tries something new.
        - Prevents the policy from getting permanently stuck in a local optimum.
        - In practice it causes ~1 random action every 20 steps — low enough
          to not ruin a good run, high enough to keep learning alive.
        """
        self.episode += 1
        self.epsilon = max(
            self.config.epsilon_end,
            self.epsilon * self.config.epsilon_decay
        )

    def reset_episode(self):
        """
        Reset per-episode state tracking (does NOT clear the Q-table).

        The Q-table persists across all episodes — that IS the learned knowledge.
        This only resets lightweight per-episode bookkeeping like _last_state.
        Called at the start of each new episode in RLTrainer.step_episode().
        """
        self._last_state = None

    # ── Q-value heatmap for visualization ────────────────────────────────────

    def q_heatmap(self, direction: Direction,
                  has_gold: bool, arrows: int) -> list[list[dict]]:
        """
        Build a 2D grid of Q-value statistics for the frontend heatmap visualization.

        For each cell (r, c) in the grid, we compute:
            - max_q:       the average best Q-value across percept combinations
            - best_action: the greedy action for this cell
            - q_values:    per-action average Q-values (for detailed inspection)

        Why average over percept combinations?
        ────────────────────────────────────
        The Q-table is keyed by full state including percepts (stench, breeze, etc.).
        But for a heatmap we want a single number per cell — not 32 numbers (2^5 combos).
        We average over the 4 main percept combos (stench × breeze) as a proxy
        for "expected quality of being at this cell" regardless of current percepts.

        Simplification:
        - We only vary stench and breeze (the two informative percepts).
        - glitter, bump, scream are left False — they're transient signals that
          don't characterize the cell's inherent danger or value.

        What the heatmap looks like after training:
        - Cells near pits: dark (negative max_q, agent learned they're dangerous)
        - Cells near gold: bright gold (high max_q, agent learned they're valuable)
        - Cell [0,0] with gold: highest values in the whole grid (exit with gold = win)
        - Unvisited cells: mid-range (Q still near zero, never experienced)

        The best_action arrows on the heatmap form a "policy field" — arrows pointing
        away from danger zones and toward gold once the agent has trained sufficiently.

        direction, has_gold, arrows:
        - These are fixed for the heatmap query (e.g. "show me the policy facing East,
          without gold, with 1 arrow"). The frontend lets the user change these.
        """
        grid = []
        for r in range(self.size):
            row = []
            for c in range(self.size):
                # ── Sample Q-values across the key percept combinations ──
                # We try all 4 combos of (stench, breeze) for this cell.
                # This gives a more robust estimate than any single percept combo.
                q_vals_all = []    # list of Q-arrays, one per percept combo
                best_actions = []  # list of greedy actions, one per percept combo

                for stench in [False, True]:
                    for breeze in [False, True]:
                        # Build a minimal percept for this combination.
                        # glitter/bump/scream are transient and not characteristic
                        # of the cell's position, so we leave them False.
                        p = Percept(stench=stench, breeze=breeze)
                        state = self.encode_state(
                            p, (r, c), direction, has_gold, arrows
                        )
                        q_vals = self.q_table[state]    # zero array if never seen
                        q_vals_all.append(q_vals)
                        best_actions.append(ACTIONS[int(np.argmax(q_vals))])

                # Average the max Q across all percept combinations.
                # This gives a single "how valuable is this cell" number.
                avg_q  = np.mean([np.max(q) for q in q_vals_all])

                # Use the first percept combo's best action as a simplification.
                # In practice the greedy action is often the same across percepts.
                best_a = best_actions[0].value

                row.append({
                    "row":         r,
                    "col":         c,
                    "max_q":       round(float(avg_q), 2),    # cell background intensity
                    "best_action": best_a,                    # arrow direction overlay
                    "q_values": {
                        # Per-action average Q — shown in detailed cell tooltip
                        a.value: round(float(np.mean([q[i] for q in q_vals_all])), 2)
                        for i, a in enumerate(ACTIONS)
                    }
                })
            grid.append(row)
        return grid

    # ── Serialization ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """
        Lightweight summary dict for API responses.
        Does NOT include the full Q-table (use save() for that).
        Sent with every agent step response so the frontend can display
        current epsilon, episode count, and Q-table size live.
        """
        return {
            "episode":  self.episode,
            "epsilon":  round(self.epsilon, 4),
            "n_states": len(self.q_table),   # how many unique states have been visited
            "config": {
                "alpha":         self.config.alpha,
                "gamma":         self.config.gamma,
                "epsilon_start": self.config.epsilon_start,
                "epsilon_end":   self.config.epsilon_end,
                "epsilon_decay": self.config.epsilon_decay,
            }
        }

    def save(self, path: str):
        """
        Persist the complete Q-table to a JSON file.

        The Q-table is the agent's entire learned knowledge — without it,
        training would have to start from scratch every time.

        numpy arrays are not JSON-serializable directly, so we call .tolist()
        to convert them to plain Python lists before writing.

        Typical Q-table size after 1000 episodes on a 6×6 grid:
        - ~5,000–15,000 unique state keys
        - Each key maps to a list of 6 floats
        - File size: roughly 2–5 MB as JSON
        """
        data = {
            "episode": self.episode,
            "epsilon": self.epsilon,
            "config":  self.config.__dict__,
            "q_table": {k: v.tolist() for k, v in self.q_table.items()}
        }
        with open(path, "w") as f:
            json.dump(data, f)

    def load(self, path: str):
        """
        Restore a previously saved Q-table from JSON.

        After loading, the agent can immediately run in exploit mode
        (set epsilon to epsilon_end) without any further training.
        Or training can be resumed from where it was left off.

        The defaultdict factory must be re-applied after loading because
        JSON deserialization produces a plain dict, not a defaultdict.
        """
        with open(path) as f:
            data = json.load(f)
        self.episode = data["episode"]
        self.epsilon = data["epsilon"]
        self.config  = RLConfig(**data["config"])
        # Reconstruct as defaultdict so unseen states still get zero arrays
        self.q_table = defaultdict(
            lambda: np.zeros(len(ACTIONS)),
            {k: np.array(v) for k, v in data["q_table"].items()}
        )


# ─── Episode runner / Trainer ─────────────────────────────────────────────────

@dataclass
class EpisodeResult:
    """
    Records the outcome of one complete episode.
    Collected by RLTrainer into self.history and used by:
    - rolling_stats() to compute learning curves for the frontend chart
    - summary() to compute aggregate training statistics
    - The benchmark system to compare agents fairly
    """
    episode:    int     # episode number (1-indexed, set by agent.episode)
    result:     str     # "WIN" / "DEAD_PIT" / "DEAD_WUMPUS" / "TIMEOUT"
    score:      int     # final score for this episode (can be negative)
    steps:      int     # total steps taken before episode ended
    won:        bool    # True only if agent grabbed gold AND climbed out
    epsilon:    float   # epsilon at END of this episode (after decay)
    gold_found: bool    # True if agent grabbed gold (even if died before climbing)


class RLTrainer:
    """
    Orchestrates the full Q-learning training loop.

    Responsibilities:
    - Creates a fresh WumpusWorld with a random seed each episode
      (critical: different worlds force generalization, not memorization)
    - Runs the agent through each episode step by step
    - Calls agent.update() after every step
    - Calls agent.end_episode() after each episode to decay epsilon
    - Records EpisodeResult objects for statistics and charting

    Two modes of use:
    ─────────────────
    1. Blocking (for simple scripts):
           results = trainer.run()
       Runs all n_episodes synchronously and returns the full history.

    2. Streaming (for the API server):
           result = trainer.step_episode()   # call in a loop
       Runs exactly one episode per call, allowing the server to
       stream progress back to the frontend without blocking.

    Usage:
        trainer = RLTrainer(difficulty="medium", rl_config=RLConfig(n_episodes=500))
        results = trainer.run()         # blocking
        print(trainer.summary())
    """

    def __init__(self,
                 world_config: Optional[dict] = None,
                 rl_config: Optional[RLConfig] = None,
                 difficulty: str = "medium"):

        # ── World configuration ───────────────────────────────────────────────
        # Either use explicit world_config dict or load from named difficulty preset.
        # The world_config stores the template — actual worlds are generated fresh
        # each episode with seed=None to ensure different layouts every time.
        wc = world_config or {}
        if not wc and difficulty:
            from game.world import DIFFICULTY
            wc = DIFFICULTY[difficulty]

        self.world_config = WorldConfig(**wc)

        # ── Agent setup ───────────────────────────────────────────────────────
        self.rl_config = rl_config or RLConfig()
        self.agent = RLAgent(
            world_size=self.world_config.size,
            config=self.rl_config
        )

        self.history: list[EpisodeResult] = []  # one entry per completed episode

        # Rolling window of the last 100 win outcomes.
        # Used by win_rate_last_100() for fast lookup without scanning all history.
        self._win_window: list[bool] = []

    # ── Full training run ─────────────────────────────────────────────────────

    def run(self, callback=None) -> list[EpisodeResult]:
        """
        Run all n_episodes synchronously and return the complete history.

        callback (optional):
            Called after each episode with the EpisodeResult.
            Useful for printing progress or streaming results to a UI.
            Example: trainer.run(callback=lambda r: print(r.score))
        """
        for _ in range(self.rl_config.n_episodes):
            result = self.step_episode()
            if callback:
                callback(result)
        return self.history

    # ── Single episode ────────────────────────────────────────────────────────

    def step_episode(self) -> EpisodeResult:
        """
        Run exactly one complete episode from start to terminal state.

        This is the core training loop:

            1. Create a fresh world with seed=None (random seed each time).
               WHY: If we reused the same world, the agent would memorize
               the gold location rather than learning general navigation.
               A different layout each episode forces it to learn policies
               that work across all configurations.

            2. Reset the agent's per-episode state (not the Q-table).

            3. Step loop:
               a. encode current state
               b. ε-greedy: choose action
               c. execute action → get (percept, reward, done)
               d. encode next state from new position/percept
               e. Q-update using Bellman equation
               f. advance to next state

            4. After terminal state: decay epsilon, record result.

        Note on next_state encoding:
            We call choose_action() to get next_state because it conveniently
            returns the encoded state string. But we immediately discard the
            chosen action — we only need the STATE KEY from that call.
            The actual action for the NEXT step will be chosen at the top of
            the next loop iteration, where epsilon is applied fresh.

        Returns an EpisodeResult capturing everything about this episode.
        """
        # ── Fresh world each episode ──────────────────────────────────────────
        # seed=None → Python's random module picks a new seed → different layout.
        # All other parameters (size, n_pits, etc.) come from the stored config.
        world = WumpusWorld(WorldConfig(
            size       = self.world_config.size,
            n_pits     = self.world_config.n_pits,
            n_wumpuses = self.world_config.n_wumpuses,
            n_arrows   = self.world_config.n_arrows,
            seed       = None,               # ← random seed → different world each time
            max_steps  = self.world_config.max_steps,
        ))

        percept = world.reset()              # returns initial percept at (0,0)
        self.agent.reset_episode()           # clear _last_state etc. (NOT the Q-table)

        # Snapshot initial agent state (used for state encoding each step)
        pos       = (world.agent.row, world.agent.col)
        direction = world.agent.direction
        has_gold  = world.agent.has_gold
        arrows    = world.agent.arrows
        done      = False

        # ── Step loop ─────────────────────────────────────────────────────────
        while not done:
            # 1. Choose action using current state (encodes state internally)
            action, state = self.agent.choose_action(
                percept, pos, direction, has_gold, arrows
            )

            # 2. Execute action in the world → get new percept, reward, done flag
            percept, reward, done = world.step(action)

            # 3. Update agent snapshot from world's new state
            pos       = (world.agent.row, world.agent.col)
            direction = world.agent.direction
            has_gold  = world.agent.has_gold
            arrows    = world.agent.arrows

            # 4. Encode the next state (what situation we're now in after the action)
            #    We call choose_action for its side effect of encoding the state,
            #    but discard the suggested action — the real next action will be
            #    chosen at the top of the next loop iteration.
            next_state_key = self.agent.encode_state(
                percept, pos, direction, has_gold, arrows
            )

            # 5. Q-update: adjust Q(state, action) based on the reward received
            #    and the estimated future value of the new state.
            self.agent.update(state, action, reward, next_state_key, done)

        # ── Episode complete ──────────────────────────────────────────────────

        # Decay epsilon (must happen AFTER the episode, not during)
        self.agent.end_episode()

        # Win = grabbed gold AND successfully climbed out
        # Note: agent.has_gold can be True even if the agent died after grabbing,
        # so we check BOTH the result AND the gold flag.
        won = world.result == GameResult.WIN and world.agent.has_gold

        result = EpisodeResult(
            episode    = self.agent.episode,   # already incremented by end_episode()
            result     = world.result.value,   # string: "WIN", "DEAD_PIT", etc.
            score      = world.agent.score,
            steps      = world.agent.steps,
            won        = won,
            epsilon    = round(self.agent.epsilon, 4),
            gold_found = world.agent.has_gold,
        )

        # Record in full history and rolling win window
        self.history.append(result)
        self._win_window.append(won)

        # Keep rolling window at max 100 entries
        if len(self._win_window) > 100:
            self._win_window.pop(0)

        return result

    # ── Stats helpers ─────────────────────────────────────────────────────────

    def win_rate_last_100(self) -> float:
        """
        Fast win rate over the most recent 100 episodes.
        Uses the pre-maintained _win_window list instead of scanning all history.
        Returns 0.0 if no episodes have been run yet.
        """
        if not self._win_window:
            return 0.0
        return round(sum(self._win_window) / len(self._win_window), 3)

    def rolling_stats(self, window: int = 50) -> list[dict]:
        """
        Compute rolling statistics across all episodes for the learning curve chart.

        For each episode i, computes averages over the window ending at i
        (i.e. episodes [i-window+1 ... i]).

        Returned fields per episode:
            episode:   episode number
            score:     raw score for THIS episode (not averaged)
            steps:     raw step count for THIS episode
            epsilon:   epsilon value at this episode (shows decay curve)
            won:       whether THIS episode was a win
            win_rate:  rolling win rate over the past `window` episodes
            avg_score: rolling average score over the past `window` episodes
            avg_steps: rolling average steps over the past `window` episodes
            result:    terminal state string ("WIN", "DEAD_PIT", etc.)

        The frontend uses win_rate over episodes to draw the S-curve:
        near-0% early (mostly random), rising through training, plateauing at ~65%.
        """
        results = []
        for i, ep in enumerate(self.history):
            start = max(0, i - window + 1)        # start of the window
            window_eps = self.history[start:i+1]  # slice of EpisodeResult objects
            results.append({
                "episode":   ep.episode,
                "score":     ep.score,
                "steps":     ep.steps,
                "epsilon":   ep.epsilon,
                "won":       ep.won,
                "win_rate":  round(
                    sum(e.won for e in window_eps) / len(window_eps), 3
                ),
                "avg_score": round(
                    sum(e.score for e in window_eps) / len(window_eps), 1
                ),
                "avg_steps": round(
                    sum(e.steps for e in window_eps) / len(window_eps), 1
                ),
                "result": ep.result,
            })
        return results

    def summary(self) -> dict:
        """
        Aggregate statistics over the entire training run.
        Returned by POST /api/agent/rl/train and displayed on the Metrics panel.

        Key fields:
            win_rate:          overall win rate across all episodes
            win_rate_last_100: win rate over the most recent 100 (performance plateau)
            best_score:        highest single-episode score achieved
            q_table_size:      number of unique states visited (proxy for coverage)
            final_epsilon:     epsilon at end of training (should be near epsilon_end)
            deaths_*:          breakdown of how the agent died (pit / wumpus / timeout)
        """
        if not self.history:
            return {}

        scores = [e.score  for e in self.history]
        steps  = [e.steps  for e in self.history]
        wins   = [e.won    for e in self.history]

        return {
            "total_episodes":    len(self.history),
            "win_rate":          round(sum(wins) / len(wins), 3),
            "win_rate_last_100": self.win_rate_last_100(),
            "avg_score":         round(float(np.mean(scores)), 1),
            "best_score":        int(max(scores)),
            "worst_score":       int(min(scores)),
            "avg_steps":         round(float(np.mean(steps)), 1),
            "q_table_size":      len(self.agent.q_table),   # unique states explored
            "final_epsilon":     round(self.agent.epsilon, 4),
            "deaths_pit":        sum(1 for e in self.history if e.result == "DEAD_PIT"),
            "deaths_wumpus":     sum(1 for e in self.history if e.result == "DEAD_WUMPUS"),
            "timeouts":          sum(1 for e in self.history if e.result == "TIMEOUT"),
        }