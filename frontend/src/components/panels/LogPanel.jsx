import React, { useEffect, useState } from 'react';
import CRTLog from './CRTLog';
import { useGameStore } from '../../store/gameStore';

export default function LogPanel() {
    const [logs, setLogs] = useState([]);
    const { worldState } = useGameStore();

    useEffect(() => {
        if (worldState) {
            setLogs(prev => {
                let actionStr = 'SYSTEM ONLINE';
                if (worldState.agent.steps === 0) actionStr = `GAME START / SEED: ${worldState.seed}`;
                else if (!worldState.agent.alive) actionStr = `AGENT DIED: ${worldState.result.replace(/_/g, ' ')}`;
                else if (worldState.result === 'WIN') actionStr = worldState.agent.has_gold
                    ? `MISSION SUCCESS: GOLD RETRIEVED! SCORE: ${worldState.agent.score}`
                    : `MISSION SUCCESS: ESCAPED! SCORE: ${worldState.agent.score}`;
                else if (worldState.result === 'TIMEOUT') actionStr = 'MISSION FAILURE: TIMEOUT';

                const newLine = `> STEP ${worldState.agent.steps} — ${actionStr}`;
                if (prev[prev.length - 1] === newLine) return prev;
                return [...prev, newLine];
            });
        }
    }, [worldState?.agent?.steps, worldState?.agent?.alive, worldState?.result]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{
                color: 'var(--gold)',
                fontSize: '11px', margin: '0 0 8px 0',
                fontFamily: "'Press Start 2P', monospace",
                textTransform: 'uppercase', flexShrink: 0,
                textShadow: '2px 2px 0 #000'
            }}>📜 MISSION LOG</h3>
            <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex' }}>
                <CRTLog lines={logs} maxLines={500} />
            </div>
        </div>
    );
}
