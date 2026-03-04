import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useMetricsStore } from '../store/metricsStore';
import { kbStep, stepGame, rlStep, randomStep } from '../api/client';

// Actions available for random agent (frontend-only, no backend endpoint needed)
const RANDOM_ACTIONS = ['MOVE_FORWARD', 'MOVE_FORWARD', 'MOVE_FORWARD',
    'TURN_LEFT', 'TURN_RIGHT', 'GRAB', 'SHOOT'];

function randomAction() {
    return RANDOM_ACTIONS[Math.floor(Math.random() * RANDOM_ACTIONS.length)];
}

// Helper: fire toast based on response
function checkToast(res, prevWorldState, showToast) {
    if (res.percept?.scream) {
        showToast({ type: 'kill', message: '💀 WUMPUS SLAIN!' });
    } else if (res.state?.agent?.has_gold && !prevWorldState?.agent?.has_gold) {
        showToast({ type: 'gold', message: '🥇 GOLD GRABBED!' });
    }
}

export function useAgent() {
    const { sessionId, isRunning, speed, agentType, stepOnce, toggleAutoRun, showToast } = useGameStore();
    const recordEpisode = useMetricsStore(s => s.recordEpisode);

    // ── KB agent auto-step ──────────────────────────────────────────────────
    useEffect(() => {
        let interval;
        if (isRunning && sessionId && agentType === 'kb') {
            interval = setInterval(async () => {
                try {
                    const prev = useGameStore.getState().worldState;
                    const res = await kbStep(sessionId);
                    if (res.state && res.percept) {
                        stepOnce(res.state, res.percept, res.kb_snapshot);
                        checkToast(res, prev, showToast);
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
    }, [isRunning, sessionId, speed, agentType, stepOnce, recordEpisode, toggleAutoRun, showToast]);

    // ── Random agent auto-step (uses backend smart-random endpoint) ─────────
    useEffect(() => {
        let interval;
        if (isRunning && sessionId && agentType === 'random') {
            interval = setInterval(async () => {
                try {
                    const prev = useGameStore.getState().worldState;
                    const res = await randomStep(sessionId);
                    if (res.state && res.percept) {
                        stepOnce(res.state, res.percept, null);
                        checkToast(res, prev, showToast);
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
    }, [isRunning, sessionId, speed, agentType, stepOnce, recordEpisode, toggleAutoRun, showToast]);

    // ── RL agent auto-step ──────────────────────────────────────────────────
    useEffect(() => {
        let interval;
        if (isRunning && sessionId && agentType === 'rl') {
            interval = setInterval(async () => {
                try {
                    const prev = useGameStore.getState().worldState;
                    const res = await rlStep(sessionId);
                    if (res.state && res.percept) {
                        stepOnce(res.state, res.percept, null);
                        checkToast(res, prev, showToast);
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
    }, [isRunning, sessionId, speed, agentType, stepOnce, recordEpisode, toggleAutoRun, showToast]);
}

