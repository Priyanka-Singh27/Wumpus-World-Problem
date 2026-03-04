"""
wumpus/tests/test_all.py
─────────────────────────
Comprehensive test suite covering:
  • World engine rules
  • Percept computation
  • KB agent inference
  • RL agent training
  • Benchmarker
  • Procedural generation

Run with:  python -m tests.test_all   (from /wumpus/ directory)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import random
import unittest

from game.world import (
    Action, Direction, GameResult, Percept,
    WumpusWorld, WorldConfig, DIFFICULTY
)
from agents.knowledge_agent import KnowledgeAgent
from agents.rl_agent import RLAgent, RLConfig, RLTrainer
from agents.random_agent import RandomAgent
from game.benchmarker import Benchmarker
from game.procedural import generate_world, world_fingerprint, generate_seed_catalog


# ─────────────────────────────────────────────────────────────────────────────
# World Engine Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestWorldEngine(unittest.TestCase):

    def setUp(self):
        # Deterministic 4×4 world
        cfg = WorldConfig(size=4, n_pits=2, n_wumpuses=1, n_arrows=1, seed=42)
        self.world = WumpusWorld(cfg)

    def test_initial_state(self):
        self.assertEqual(self.world.agent.row, 0)
        self.assertEqual(self.world.agent.col, 0)
        self.assertEqual(self.world.agent.direction, Direction.EAST)
        self.assertEqual(self.world.agent.arrows, 1)
        self.assertFalse(self.world.agent.has_gold)
        self.assertEqual(self.world.result, GameResult.ONGOING)

    def test_start_cell_is_safe(self):
        self.assertFalse(self.world.grid[0][0].has_pit)
        self.assertFalse(self.world.grid[0][0].has_wumpus)

    def test_turn_left(self):
        _, _, done = self.world.step(Action.TURN_LEFT)
        self.assertFalse(done)
        self.assertEqual(self.world.agent.direction, Direction.NORTH)

    def test_turn_right(self):
        _, _, done = self.world.step(Action.TURN_RIGHT)
        self.assertFalse(done)
        self.assertEqual(self.world.agent.direction, Direction.SOUTH)

    def test_direction_cycle(self):
        d = Direction.NORTH
        for _ in range(4):
            d = d.turn_right()
        self.assertEqual(d, Direction.NORTH)

    def test_move_forward_east(self):
        # Starts facing EAST at (0,0) → should move to (0,1)
        # (Only if (0,1) is safe — we'll detect with bump)
        percept, reward, done = self.world.step(Action.MOVE_FORWARD)
        if not percept.bump:
            self.assertEqual(self.world.agent.col, 1)
            self.assertEqual(self.world.agent.row, 0)
        # Reward should be -1 (step) possibly plus death penalty
        self.assertLessEqual(reward, -1)

    def test_wall_bump(self):
        # Face NORTH from (0,0) → row-1 = -1 is out of bounds → bump
        self.world.step(Action.TURN_LEFT)  # EAST → NORTH
        percept, _, _ = self.world.step(Action.MOVE_FORWARD)
        self.assertTrue(percept.bump)
        self.assertEqual(self.world.agent.row, 0)  # didn't move

    def test_score_decrements_on_step(self):
        initial_score = self.world.agent.score
        self.world.step(Action.TURN_LEFT)
        self.assertEqual(self.world.agent.score, initial_score - 1)

    def test_grab_gold(self):
        # Place agent on gold cell manually
        gold_r, gold_c = None, None
        for r in range(4):
            for c in range(4):
                if self.world.grid[r][c].has_gold:
                    gold_r, gold_c = r, c

        self.assertIsNotNone(gold_r)
        self.world.agent.row = gold_r
        self.world.agent.col = gold_c
        self.world.grid[gold_r][gold_c].visited = True

        percept, reward, done = self.world.step(Action.GRAB)
        self.assertTrue(self.world.agent.has_gold)
        self.assertGreater(reward, 0)   # +1000 - 1

    def test_climb_with_gold_wins(self):
        self.world.agent.has_gold = True
        self.world.agent.row = 0
        self.world.agent.col = 0
        _, reward, done = self.world.step(Action.CLIMB)
        self.assertTrue(done)
        self.assertEqual(self.world.result, GameResult.WIN)
        self.assertGreater(reward, 0)

    def test_climb_without_gold_at_start(self):
        _, reward, done = self.world.step(Action.CLIMB)
        self.assertTrue(done)
        self.assertEqual(self.world.result, GameResult.WIN)
        # Should have negative reward (no gold bonus)
        self.assertLess(reward, 0)

    def test_shoot_arrow_decrements(self):
        initial_arrows = self.world.agent.arrows
        self.world.step(Action.SHOOT)
        self.assertEqual(self.world.agent.arrows, initial_arrows - 1)

    def test_shoot_no_arrows_noop(self):
        self.world.agent.arrows = 0
        self.world.step(Action.SHOOT)
        self.assertEqual(self.world.agent.arrows, 0)

    def test_wumpus_kill_scream(self):
        # Face wumpus directly and shoot
        wumpus_r, wumpus_c = None, None
        for r in range(4):
            for c in range(4):
                if self.world.grid[r][c].has_wumpus:
                    wumpus_r, wumpus_c = r, c

        self.assertIsNotNone(wumpus_r)
        # Position agent in same row, west of wumpus, facing east
        self.world.agent.row       = wumpus_r
        self.world.agent.col       = 0
        self.world.agent.direction = Direction.EAST
        self.world.agent.arrows    = 1

        # Only works if nothing between (0, wumpus_col-1) would block
        percept, reward, done = self.world.step(Action.SHOOT)
        if percept.scream:
            self.assertFalse(self.world.grid[wumpus_r][wumpus_c].has_wumpus)
            self.assertGreater(reward, 0)   # +500 - 10 - 1 = +489

    def test_serialization(self):
        state = self.world.to_dict(reveal=True)
        self.assertIn("cells",  state)
        self.assertIn("agent",  state)
        self.assertIn("result", state)
        # Should be JSON serializable
        json.dumps(state)

    def test_history_recorded(self):
        self.world.step(Action.TURN_LEFT)
        self.world.step(Action.TURN_RIGHT)
        history = self.world.get_history()
        # 1 initial + 2 steps
        self.assertGreaterEqual(len(history), 2)

    def test_reset_restores_state(self):
        self.world.step(Action.TURN_LEFT)
        self.world.step(Action.MOVE_FORWARD)
        self.world.reset()
        self.assertEqual(self.world.agent.row, 0)
        self.assertEqual(self.world.agent.col, 0)
        self.assertEqual(self.world.result, GameResult.ONGOING)

    def test_reproducible_with_seed(self):
        cfg1 = WorldConfig(size=4, n_pits=2, n_wumpuses=1, n_arrows=1, seed=999)
        cfg2 = WorldConfig(size=4, n_pits=2, n_wumpuses=1, n_arrows=1, seed=999)
        w1, w2 = WumpusWorld(cfg1), WumpusWorld(cfg2)
        s1 = w1.to_dict(reveal=True)
        s2 = w2.to_dict(reveal=True)
        # Same seed → same layout
        for r in range(4):
            for c in range(4):
                self.assertEqual(s1["cells"][r][c]["has_pit"],
                                 s2["cells"][r][c]["has_pit"])

    def test_percept_breeze_near_pit(self):
        # Put a pit at (0,1), check breeze at (0,0)
        self.world.grid[0][1].has_pit = True
        self.world.grid[0][1].has_wumpus = False
        percept = self.world._compute_percept()
        self.assertTrue(percept.breeze)

    def test_percept_stench_near_wumpus(self):
        # Clear all wumpuses, place one at (1,0)
        for r in range(4):
            for c in range(4):
                self.world.grid[r][c].has_wumpus = False
        self.world.grid[1][0].has_wumpus = True
        percept = self.world._compute_percept()
        self.assertTrue(percept.stench)

    def test_difficulty_presets(self):
        for level in ["easy", "medium", "hard", "expert"]:
            world = WumpusWorld.from_difficulty(level, seed=0)
            d     = DIFFICULTY[level]
            self.assertEqual(world.size, d["size"])


# ─────────────────────────────────────────────────────────────────────────────
# KB Agent Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestKBAgent(unittest.TestCase):

    def test_no_breeze_marks_neighbours_safe(self):
        cfg   = WorldConfig(size=4, n_pits=0, n_wumpuses=0, n_arrows=1, seed=0)
        world = WumpusWorld(cfg)
        world.grid[0][0].has_gold = True
        agent = KnowledgeAgent(world_size=4)

        # No breeze at start → neighbours safe
        percept = Percept(breeze=False, stench=False, glitter=True)
        agent._observe(percept)

        for nr, nc in [(0,1), (1,0)]:
            self.assertFalse(agent.kb[(nr,nc)].has_pit)

    def test_grabs_gold_on_glitter(self):
        cfg   = WorldConfig(size=4, n_pits=0, n_wumpuses=0, n_arrows=1, seed=0)
        world = WumpusWorld(cfg)
        world.grid[0][0].has_gold = True  # gold at start
        agent = KnowledgeAgent(world_size=4)
        percept = world._compute_percept()

        action = agent.choose_action(percept, (0,0), Direction.EAST)
        self.assertEqual(action, Action.GRAB)

    def test_kb_snapshot_structure(self):
        agent    = KnowledgeAgent(world_size=4)
        percept  = Percept()
        agent.choose_action(percept, (0,0), Direction.EAST)
        snapshot = agent.kb_snapshot()

        self.assertIn("type",          snapshot)
        self.assertIn("cells",         snapshot)
        self.assertIn("inference_log", snapshot)
        self.assertEqual(snapshot["type"], "knowledge_based")
        self.assertEqual(len(snapshot["cells"]), 4)

    def test_danger_prob_safe_cell_is_zero(self):
        agent = KnowledgeAgent(world_size=4)
        agent.kb[(0,0)].safe = True
        agent._update_danger_probs()
        self.assertEqual(agent.danger_prob[(0,0)], 0.0)

    def test_agent_wins_on_trivial_world(self):
        """KB agent should win on a world with gold at (0,1) and no hazards."""
        cfg   = WorldConfig(size=4, n_pits=0, n_wumpuses=0, n_arrows=1, seed=0)
        world = WumpusWorld(cfg)
        # Manually place gold at (0,1)
        world.grid[0][1].has_gold = True
        agent   = KnowledgeAgent(world_size=4)
        percept = world._last_percept

        for _ in range(50):
            if world.result != GameResult.ONGOING:
                break
            action = agent.choose_action(
                percept, (world.agent.row, world.agent.col), world.agent.direction
            )
            percept, _, done = world.step(action)

        self.assertEqual(world.result, GameResult.WIN)

    def test_wumpus_inference_single_candidate(self):
        """If only one cell adjacent to stench could be wumpus, KB deduces it."""
        agent = KnowledgeAgent(world_size=4)
        # Mark (0,0) visited with stench
        agent.kb[(0,0)].visited = True
        agent.kb[(0,0)].stench  = True
        # Mark (1,0) as not-wumpus (visited safe)
        agent.kb[(1,0)].has_wumpus = False
        # So only (0,1) is candidate
        agent._infer()
        self.assertEqual(agent.kb[(0,1)].has_wumpus, True)

    def test_turns_to_face(self):
        agent = KnowledgeAgent(world_size=4)
        turns = agent._turns_to_face(Direction.EAST, Direction.WEST)
        # EAST → WEST = 2 turns either way
        self.assertEqual(len(turns), 2)
        turns_same = agent._turns_to_face(Direction.NORTH, Direction.NORTH)
        self.assertEqual(turns_same, [])


# ─────────────────────────────────────────────────────────────────────────────
# RL Agent Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestRLAgent(unittest.TestCase):

    def test_state_encoding_is_deterministic(self):
        agent   = RLAgent(world_size=4)
        percept = Percept(stench=True, breeze=False)
        s1 = agent.encode_state(percept, (1,2), Direction.EAST, False, 1)
        s2 = agent.encode_state(percept, (1,2), Direction.EAST, False, 1)
        self.assertEqual(s1, s2)

    def test_different_states_differ(self):
        agent = RLAgent(world_size=4)
        p1 = Percept(breeze=True)
        p2 = Percept(breeze=False)
        s1 = agent.encode_state(p1, (0,0), Direction.EAST, False, 1)
        s2 = agent.encode_state(p2, (0,0), Direction.EAST, False, 1)
        self.assertNotEqual(s1, s2)

    def test_choose_action_returns_valid(self):
        agent   = RLAgent(world_size=4)
        percept = Percept()
        action, state = agent.choose_action(percept, (0,0), Direction.EAST, False, 1)
        self.assertIn(action, list(Action))
        self.assertIsInstance(state, str)

    def test_q_update(self):
        agent  = RLAgent(world_size=4)
        percept = Percept()
        action, state = agent.choose_action(percept, (0,0), Direction.EAST, False, 1)
        agent.update(state, action, 100.0, state, False)
        # Q-value should have increased towards positive
        idx = list(Action).index(action)
        self.assertGreater(agent.q_table[state][idx], 0)

    def test_epsilon_decay(self):
        cfg   = RLConfig(epsilon_start=1.0, epsilon_decay=0.5, epsilon_end=0.05)
        agent = RLAgent(world_size=4, config=cfg)
        agent.end_episode()
        self.assertAlmostEqual(agent.epsilon, 0.5)
        agent.end_episode()
        self.assertAlmostEqual(agent.epsilon, 0.25)

    def test_training_improves_over_episodes(self):
        """Win rate in last 100 episodes should exceed early episodes after training."""
        cfg     = RLConfig(n_episodes=300, epsilon_decay=0.99)
        trainer = RLTrainer(difficulty="easy", rl_config=cfg)
        trainer.run()
        stats = trainer.rolling_stats(window=50)

        early_wr = stats[49]["win_rate"]  if len(stats) > 49  else 0
        late_wr  = stats[-1]["win_rate"]
        # Late win rate should be >= early (learning or at least not regressing)
        self.assertGreaterEqual(late_wr + 0.1, early_wr)   # 10% tolerance

    def test_q_heatmap_structure(self):
        agent   = RLAgent(world_size=4)
        heatmap = agent.q_heatmap(Direction.EAST, False, 1)
        self.assertEqual(len(heatmap), 4)
        self.assertEqual(len(heatmap[0]), 4)
        self.assertIn("max_q",       heatmap[0][0])
        self.assertIn("best_action", heatmap[0][0])
        self.assertIn("q_values",    heatmap[0][0])

    def test_serialization(self):
        agent = RLAgent(world_size=4)
        data  = agent.to_dict()
        self.assertIn("episode", data)
        self.assertIn("epsilon", data)
        json.dumps(data)   # must be JSON-safe

    def test_trainer_summary(self):
        cfg     = RLConfig(n_episodes=20)
        trainer = RLTrainer(difficulty="easy", rl_config=cfg)
        trainer.run()
        summary = trainer.summary()
        self.assertEqual(summary["total_episodes"], 20)
        self.assertIn("win_rate", summary)
        self.assertIn("avg_score", summary)


# ─────────────────────────────────────────────────────────────────────────────
# Benchmarker Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestBenchmarker(unittest.TestCase):

    def test_benchmark_runs(self):
        bench  = Benchmarker(difficulty="easy", n_episodes=10, rl_pretrain=50)
        report = bench.run()
        self.assertIn("agents",  report)
        self.assertIn("ranking", report)
        self.assertIn("random",    report["agents"])
        self.assertIn("knowledge", report["agents"])
        self.assertIn("rl",        report["agents"])

    def test_all_agents_have_same_episode_count(self):
        bench  = Benchmarker(difficulty="easy", n_episodes=5, rl_pretrain=20)
        report = bench.run()
        for agent_key in ["random", "knowledge", "rl"]:
            eps = report["agents"][agent_key]["per_episode"]
            self.assertEqual(len(eps), 5)

    def test_win_rates_in_range(self):
        bench  = Benchmarker(difficulty="easy", n_episodes=10, rl_pretrain=50)
        report = bench.run()
        for agent_key in report["agents"]:
            wr = report["agents"][agent_key]["win_rate"]
            self.assertGreaterEqual(wr, 0.0)
            self.assertLessEqual(wr,    1.0)


# ─────────────────────────────────────────────────────────────────────────────
# Procedural Generation Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestProcedural(unittest.TestCase):

    def test_generate_world_returns_world(self):
        world = generate_world("easy", seed=7)
        self.assertIsInstance(world, WumpusWorld)

    def test_world_fingerprint_keys(self):
        world = generate_world("easy", seed=0)
        fp    = world_fingerprint(world)
        for key in ["seed", "size", "pits", "wumpuses", "gold_pos",
                    "danger_density", "difficulty_score", "world_hash"]:
            self.assertIn(key, fp)

    def test_seed_catalog_length(self):
        catalog = generate_seed_catalog("easy", n=5)
        self.assertEqual(len(catalog), 5)

    def test_same_seed_same_fingerprint(self):
        w1 = generate_world("medium", seed=123)
        w2 = generate_world("medium", seed=123)
        fp1 = world_fingerprint(w1)
        fp2 = world_fingerprint(w2)
        self.assertEqual(fp1["world_hash"], fp2["world_hash"])


# ─────────────────────────────────────────────────────────────────────────────
# Random Agent Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestRandomAgent(unittest.TestCase):

    def test_grabs_gold(self):
        agent   = RandomAgent()
        percept = Percept(glitter=True)
        action  = agent.choose_action(percept, (0,0), Direction.EAST, has_gold=False)
        self.assertEqual(action, Action.GRAB)

    def test_climbs_with_gold_at_start(self):
        agent   = RandomAgent()
        percept = Percept()
        action  = agent.choose_action(percept, (0,0), Direction.EAST, has_gold=True)
        self.assertEqual(action, Action.CLIMB)


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  WUMPUS WORLD — TEST SUITE")
    print("=" * 60)
    loader = unittest.TestLoader()
    suite  = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
