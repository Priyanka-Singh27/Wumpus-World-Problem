import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useMetricsStore } from '../store/metricsStore';
import { getRLSnapshot } from '../api/client';

export function useMetrics() {
    const { agentType, worldState } = useGameStore();
    const setQHeatmap = useMetricsStore(s => s.setQHeatmap);
    const isTraining = useMetricsStore(s => s.isTraining);

    useEffect(() => {
        if (agentType === 'rl' && worldState?.agent && !isTraining) {
            const { direction, has_gold, arrows } = worldState.agent;
            getRLSnapshot(direction, has_gold, arrows)
                .then(res => {
                    if (res.q_heatmap) setQHeatmap(res.q_heatmap);
                })
                .catch(console.error);
        }
    }, [agentType, worldState?.agent?.direction, worldState?.agent?.has_gold, worldState?.agent?.arrows, isTraining, setQHeatmap]);
}
