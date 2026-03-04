import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useMetricsStore } from '../store/metricsStore';
import { kbStep, stepGame, rlStep } from '../api/client';

// Actions available for random agent (frontend-only, no backend endpoint needed)
const RANDOM_ACTIONS = ['MOVE_FORWARD', 'MOVE_FORWARD', 'MOVE_FORWARD',
    'TURN_LEFT', 'TURN_RIGHT', 'GRAB', 'SHOOT'];

function randomAction() {
    return RANDOM_ACTIONS[Math.floor(Math.random() * RANDOM_ACTIONS.length)];
}

export function useAgent() {
    const { sessionId, isRunning, speed, agentType, stepOnce, toggleAutoRun, worldState } = useGameStore();
    const recordEpisode = useMetricsStore(s => s.recordEpisode);

    // ── KB agent auto-step ──────────────────────────────────────────────────
    useEffect(() => {
        let interval;
        if (isRunning && sessionId && agentType === 'kb') {
            interval = setInterval(async () => {
                try {
                    const res = await kbStep(sessionId);
                    if (res.state && res.percept) {
                        stepOnce(res.state, res.percept, res.kb_snapshot);
                    }
                    if (res.done) {
                        recordEpisode(res.result);
                        toggleAutoRun();
                    }
                } catch (e) {
                    console.error('KB step error:', e);
                    toggleAutoRun();
                }
            }, Math.max(speed, 50));
        }
        return () => clearInterval(interval);
    }, [isRunning, sessionId, speed, agentType, stepOnce, recordEpisode, toggleAutoRun]);

    // ── Random agent auto-step (frontend random action selection) ───────────
    useEffect(() => {
        let interval;
        if (isRunning && sessionId && agentType === 'random') {
            interval = setInterval(async () => {
                try {
                    const action = randomAction();
                    const res = await stepGame(sessionId, action);
                    if (res.state && res.percept) {
                        stepOnce(res.state, res.percept, null);
                    }
                    if (res.done) {
                        recordEpisode(res.result);
                        toggleAutoRun();
                    }
                } catch (e) {
                    console.error('Random step error:', e);
                    toggleAutoRun();
                }
            }, Math.max(speed, 50));
        }
        return () => clearInterval(interval);
    }, [isRunning, sessionId, speed, agentType, stepOnce, recordEpisode, toggleAutoRun]);

    // ── RL agent auto-step ──────────────────────────────────────────────────
    useEffect(() => {
        let interval;
        if (isRunning && sessionId && agentType === 'rl') {
            interval = setInterval(async () => {
                try {
                    const res = await rlStep(sessionId);
                    if (res.state && res.percept) {
                        stepOnce(res.state, res.percept, null);
                    }
                    if (res.done) {
                        recordEpisode(res.result);
                        toggleAutoRun();
                    }
                } catch (e) {
                    console.error('RL step error:', e);
                    toggleAutoRun();
                }
            }, Math.max(speed, 50));
        }
        return () => clearInterval(interval);
    }, [isRunning, sessionId, speed, agentType, stepOnce, recordEpisode, toggleAutoRun]);
}
