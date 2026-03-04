import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useMetricsStore } from '../../store/metricsStore';
import CRTLog from './CRTLog';
import PixelBar from '../ui/PixelBar';

export default function BrainPanel() {
    const { agentType, kbSnapshot } = useGameStore();
    const { qHeatmap, learningCurve, rlSummary, isTraining } = useMetricsStore();

    if (agentType === 'human' || agentType === 'random') {
        return (
            <div style={{ padding: '16px', color: 'var(--dim)', textAlign: 'center' }}>
                <h3>NO BRAIN ACTIVITY</h3>
            </div>
        );
    }

    if (agentType === 'kb') {
        return <KBBrainView kbSnapshot={kbSnapshot} />;
    }

    if (agentType === 'rl') {
        return <RLBrainView
            qHeatmap={qHeatmap}
            learningCurve={learningCurve}
            rlSummary={rlSummary}
            isTraining={isTraining}
        />;
    }
    return null;
}

function KBBrainView({ kbSnapshot }) {
    const [logLines, setLogLines] = useState([]);

    useEffect(() => {
        if (kbSnapshot?.inference_log) {
            const newLogs = kbSnapshot.inference_log.map(item =>
                `> [R${item.rule}] ${item.cell} ${item.conclusion} (${item.confidence})`
            );

            let i = 0;
            const timer = setInterval(() => {
                if (i < newLogs.length) {
                    setLogLines(prev => {
                        const up = [...prev, newLogs[i]];
                        return up.slice(-500);
                    });
                    i++;
                } else {
                    clearInterval(timer);
                }
            }, 50);
            return () => clearInterval(timer);
        }
    }, [kbSnapshot?.inference_log]);

    if (!kbSnapshot) return <div style={{ color: 'var(--gold)' }}>WAITING FOR KB SNAPSHOT...</div>;

    const { cells, wumpus_loc, plan_length } = kbSnapshot;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: '8px', flexShrink: 0 }}>
                <h3 style={{ color: '#996600', fontSize: '8px', margin: '0 0 8px 0', fontFamily: "'Press Start 2P', monospace", textTransform: 'uppercase' }}>KB INFERENCE STATE</h3>
                {wumpus_loc && <div style={{ color: '#c62828', fontSize: '11px', fontFamily: 'sans-serif' }}>🎯 Wumpus located: [{wumpus_loc.toString()}]</div>}
                <div style={{ color: '#0077aa', fontSize: '11px', fontFamily: 'sans-serif' }}>Plan queue depth: {plan_length}</div>
            </div>

            <div style={{ alignSelf: 'center', marginBottom: '8px', flexShrink: 0 }}>
                <MiniGrid cells={cells} wumpusLoc={wumpus_loc} />
            </div>

            <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex' }}>
                <CRTLog lines={logLines} maxLines={100} />
            </div>
        </div>
    );
}

function MiniGrid({ cells, wumpusLoc }) {
    if (!cells || !cells.length) return null;
    const size = cells.length;
    const cellSize = 16;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
            border: '2px solid #aaa',
            backgroundColor: '#ccc',
            gap: 1, padding: 1,
        }}>
            {[...cells].reverse().map((rowArr, revR) => {
                const r = size - 1 - revR;
                return rowArr.map((cell, c) => {
                    let bg = '#d0d0d0';
                    let borderColor = 'transparent';
                    if (cell.safe) bg = '#b8dfb8';
                    else if (cell.danger_prob > 0.6) bg = '#f4adad';
                    else if (cell.danger_prob > 0.2) bg = '#fdd8a0';

                    const isWumpus = wumpusLoc && wumpusLoc[0] === r && wumpusLoc[1] === c;
                    if (isWumpus) { borderColor = '#c62828'; bg = '#f4adad'; }

                    let color = '#222';
                    if (cell.danger_prob < 0.2) color = '#2a7a2a';
                    else if (cell.danger_prob <= 0.6) color = '#994400';
                    else color = '#c62828';

                    return (
                        <div key={`${r}-${c}`} style={{
                            width: cellSize, height: cellSize,
                            backgroundColor: bg,
                            boxShadow: `inset 0 0 0 1px ${borderColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '5px',
                            fontFamily: '"Press Start 2P"',
                            color,
                            boxSizing: 'border-box'
                        }}>
                            {cell.danger_prob > 0 && cell.danger_prob < 1 && Math.round(cell.danger_prob * 100)}
                        </div>
                    );
                });
            })}
        </div>
    );
}

function RLBrainView({ qHeatmap, learningCurve, rlSummary, isTraining }) {
    if (isTraining) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div className="sprite-pit-swirl" style={{ color: '#2255cc' }} />
                <h3 style={{ color: '#2255cc', fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>TRAINING RL AGENT...</h3>
            </div>
        );
    }

    const epsilon = rlSummary ? rlSummary.epsilon : 1.0;
    // red to green depending on decay
    const rGauge = Math.floor(epsilon * 255);
    const gGauge = Math.floor((1 - epsilon) * 255);
    const epsColor = `rgb(${rGauge},${gGauge},0)`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: '8px', flexShrink: 0 }}>
                <h3 style={{ color: '#2255cc', fontFamily: "'Press Start 2P', monospace", fontSize: 8, margin: '0 0 8px 0', textTransform: 'uppercase' }}>Q-LEARNING MAPPING</h3>
                <PixelBar
                    label="EXPLORE RATE"
                    value={epsilon}
                    color={epsColor}
                    showNumber={epsilon.toFixed(2)}
                />
            </div>

            {qHeatmap && qHeatmap.length > 0 && (
                <div style={{ alignSelf: 'center', marginBottom: '8px', flexShrink: 0 }}>
                    <RLMiniGrid heatmap={qHeatmap} />
                </div>
            )}

            {learningCurve && learningCurve.length > 0 && (
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <h4 style={{ color: '#996600', fontFamily: "'Press Start 2P', monospace", fontSize: 6, margin: '0 0 4px 0', textTransform: 'uppercase' }}>REWARD CURVE</h4>
                    <div style={{ flexGrow: 1, position: 'relative', backgroundColor: '#e8e8e8', border: '1px solid #bbb' }}>
                        <RLRewardChart data={learningCurve} />
                    </div>
                </div>
            )}
        </div>
    );
}

function RLMiniGrid({ heatmap }) {
    const size = heatmap.length;
    const cellSize = 16;

    let minQ = Infinity, maxQ = -Infinity;
    heatmap.forEach(row => row.forEach(cell => {
        if (cell.max_q < minQ) minQ = cell.max_q;
        if (cell.max_q > maxQ) maxQ = cell.max_q;
    }));

    const interpolateColor = (val) => {
        if (maxQ === minQ) return '#1a1a2e';
        const norm = Math.max(0, Math.min(1, (val - minQ) / (maxQ - minQ)));
        const r = Math.floor(26 + norm * (255 - 26));
        const g = Math.floor(26 + norm * (214 - 26));
        const b = Math.floor(46 + norm * (10 - 46));
        return `rgb(${r},${g},${b})`;
    };

    const drawArrow = (action) => {
        switch (action) {
            case 'MOVE_FORWARD': return '↑';
            case 'TURN_LEFT': return '↶';
            case 'TURN_RIGHT': return '↷';
            case 'SHOOT': return '🏹';
            case 'GRAB': return 'G';
            case 'CLIMB': return 'C';
            default: return '';
        }
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
            border: '1px solid var(--border)',
            backgroundColor: '#000'
        }}>
            {[...heatmap].reverse().map((rowArr, revR) => {
                const r = size - 1 - revR;
                return rowArr.map((cell, c) => {
                    const bg = interpolateColor(cell.max_q);
                    return (
                        <div key={`${r}-${c}`} style={{
                            width: cellSize, height: cellSize,
                            backgroundColor: bg,
                            boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.5)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '8px',
                            fontFamily: 'sans-serif',
                            color: '#000'
                        }}>
                            {cell.best_action && drawArrow(cell.best_action)}
                        </div>
                    );
                });
            })}
        </div>
    );
}

function RLRewardChart({ data }) {
    const maxWin = Math.max(0.01, ...data.map(d => d.win_rate));
    return (
        <div style={{
            display: 'flex',
            height: '100%',
            alignItems: 'flex-end',
            borderBottom: '1px solid var(--border)',
            position: 'absolute',
            bottom: 0, left: 0, right: 0
        }}>
            {data.map((pt, i) => {
                const heightPct = (pt.win_rate / maxWin) * 100;
                const color = `rgb(${Math.floor(255 - heightPct * 2.5)}, ${Math.floor(heightPct * 2.5)}, 0)`;
                return (
                    <div
                        key={i}
                        title={`EPS: ${i} Win: ${pt.win_rate.toFixed(2)}`}
                        style={{
                            width: '4px',
                            height: `${Math.max(1, heightPct)}%`,
                            backgroundColor: color,
                            flexShrink: 0
                        }}
                    />
                );
            })}
        </div>
    );
}
