import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useMetricsStore } from '../store/metricsStore';
import { stepGame } from '../api/client';

export function useGame() {
    const { sessionId, isRunning, stepOnce, showToast } = useGameStore();
    const recordEpisode = useMetricsStore(s => s.recordEpisode);

    useEffect(() => {
        const handleKeyDown = async (e) => {
            const { agentType, worldState } = useGameStore.getState();
            const gameOver = worldState?.result && worldState.result !== 'ONGOING';
            if (!sessionId || isRunning || agentType !== 'human' || gameOver) return;

            const keyMap = {
                'w': 'MOVE_FORWARD', 'ArrowUp': 'MOVE_FORWARD',
                'a': 'TURN_LEFT', 'ArrowLeft': 'TURN_LEFT',
                'd': 'TURN_RIGHT', 'ArrowRight': 'TURN_RIGHT',
                ' ': 'SHOOT',
                'g': 'GRAB',
                'e': 'CLIMB', 'Enter': 'CLIMB'
            };

            const action = keyMap[e.key] || keyMap[e.key.toLowerCase()];
            if (action) {
                e.preventDefault();
                try {
                    const res = await stepGame(sessionId, action);
                    stepOnce(res.state, res.percept);

                    // 🎉 Celebration toasts
                    if (res.percept?.scream) {
                        showToast({ type: 'kill', message: '💀 WUMPUS SLAIN!' });
                    } else if (res.state?.agent?.has_gold && !worldState?.agent?.has_gold) {
                        showToast({ type: 'gold', message: '🥇 GOLD GRABBED!' });
                    }

                    if (res.done) {
                        recordEpisode(res.result);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sessionId, isRunning, stepOnce, recordEpisode, showToast]);
}

