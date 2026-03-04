import React, { useEffect, useState } from 'react';
import CRTLog from './CRTLog';
import { useGameStore } from '../../store/gameStore';

export default function LogPanel() {
    const [logs, setLogs] = useState([]);
    const { worldState } = useGameStore();

    useEffect(() => {
        if (worldState) {
            setLogs(prev => {
                let actionStr = 'GAME UPDATE';
                if (worldState.agent.steps === 0) actionStr = `GAME START / SEED: ${worldState.seed}`;
                else if (!worldState.agent.alive) actionStr = `AGENT DEAD — ${worldState.result}`;
                else if (worldState.result === 'WIN') actionStr = worldState.agent.has_gold
                    ? `WIN! Climbed out with gold. Score: ${worldState.agent.score}`
                    : `CLIMBED OUT (no gold). Score: ${worldState.agent.score}`;
                else if (worldState.result === 'TIMEOUT') actionStr = 'TIMEOUT — max steps reached';

                const newLine = `> STEP ${worldState.agent.steps} — ${actionStr}`;
                if (prev[prev.length - 1] === newLine) return prev;
                return [...prev, newLine];
            });
        }
    }, [worldState?.agent?.steps, worldState?.agent?.alive, worldState?.result]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{
                color: '#996600',
                fontSize: '8px', margin: '0 0 8px 0',
                fontFamily: "'Press Start 2P', monospace",
                textTransform: 'uppercase', flexShrink: 0,
            }}>System Log</h3>
            <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex' }}>
                <CRTLog lines={logs} maxLines={500} />
            </div>
        </div>
    );
}
