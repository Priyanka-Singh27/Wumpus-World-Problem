import React from 'react';
import { useMetricsStore } from '../../store/metricsStore';
import { useGameStore } from '../../store/gameStore';
import PixelButton from '../ui/PixelButton';
import { runBenchmark } from '../../api/client';

export default function MetricsPanel() {
    const { isBenchmarking, benchReport, runBenchmark: startBench, setBenchmarkData } = useMetricsStore();
    const { difficulty } = useGameStore();

    const handleBenchmark = async () => {
        startBench();
        try {
            const report = await runBenchmark(difficulty, { n_episodes: 100, rl_pretrain: 500 });
            setBenchmarkData(report);
        } catch (e) {
            console.error(e);
            setBenchmarkData(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
                <h3 style={{ color: 'var(--gold)', fontSize: '8px', margin: 0 }}>HEAD-TO-HEAD</h3>
                <PixelButton
                    label={isBenchmarking ? "RUNNING..." : "RUN BENCHMARK"}
                    color="navy"
                    onClick={handleBenchmark}
                    disabled={isBenchmarking}
                />
            </div>

            {!benchReport && !isBenchmarking && (
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', fontSize: '8px' }}>
                    PRESS RUN TO COMPARE AGENTS
                </div>
            )}

            {isBenchmarking && (
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontSize: '8px' }}>
                    <div className="sprite-pit-swirl" style={{ position: 'relative', marginTop: '-16px', background: 'var(--blue)' }} />
                    <span style={{ marginLeft: '16px' }}>BENCHMARKING...</span>
                </div>
            )}

            {benchReport && !isBenchmarking && (
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {['knowledge', 'rl'].map(agentType => {
                            const stats = benchReport.agents[agentType];
                            if (!stats) return null;
                            const color = agentType === 'knowledge' ? '#00cc99' : '#4488ff';
                            const title = agentType === 'knowledge' ? 'KB AGENT' : 'Q-LEARNING';
                            return (
                                <StatCard key={agentType} title={title} color={color} stats={stats} />
                            );
                        })}
                        {benchReport.agents['random'] && (
                            <StatCard title="RANDOM BASE" color="#ff4466" stats={benchReport.agents['random']} />
                        )}
                        <div style={{
                            border: `1px solid var(--border)`, padding: '8px',
                            backgroundColor: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <div style={{ color: 'var(--gold)', fontSize: '6px', textAlign: 'center' }}>
                                BEST: <br />{benchReport.comparison.best_agent.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                        <h4 style={{ color: 'var(--gold)', fontSize: '6px', margin: '0 0 4px 0' }}>WIN RATE COMPARISON</h4>
                        <div style={{ display: 'flex', height: '64px', alignItems: 'flex-end', borderBottom: '1px solid var(--border)', padding: '0 8px', gap: '8px' }}>
                            {['knowledge', 'rl', 'random'].map((agentType) => {
                                const stats = benchReport.agents[agentType];
                                const color = agentType === 'knowledge' ? '#00cc99' : (agentType === 'rl' ? '#4488ff' : '#ff4466');
                                const heightPct = stats ? (stats.win_rate * 100) : 0;
                                return (
                                    <div key={agentType} style={{
                                        flex: 1,
                                        backgroundColor: color,
                                        height: `${Math.max(1, heightPct)}%`,
                                        position: 'relative'
                                    }}>
                                        <div style={{ position: 'absolute', top: '-12px', width: '100%', textAlign: 'center', fontSize: '5px' }}>
                                            {heightPct > 0 ? heightPct.toFixed(0) + '%' : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', fontSize: '5px', marginTop: '4px', textAlign: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, color: '#00cc99' }}>KB</div>
                            <div style={{ flex: 1, color: '#4488ff' }}>RL</div>
                            <div style={{ flex: 1, color: '#ff4466' }}>RND</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, color, stats }) {
    return (
        <div style={{
            border: `1px solid ${color}`, padding: '8px',
            backgroundColor: 'var(--panel2)',
            display: 'flex', flexDirection: 'column'
        }}>
            <h4 style={{ color, margin: '0 0 4px 0', fontSize: '6px' }}>{title}</h4>
            <div style={{ fontSize: '5px', lineHeight: '1.5' }}>
                WIN RATE: <span style={{ color: 'var(--gold)' }}>{(stats.win_rate * 100).toFixed(1)}%</span><br />
                AVG STEPS: <span style={{ color: 'var(--cyan)' }}>{Math.round(stats.avg_steps)}</span><br />
                DEATHS: <span style={{ color: 'var(--red)' }}>{stats.deaths_pit}P</span> <span style={{ color: 'var(--orange)' }}>{stats.deaths_wumpus}W</span><br />
                BEST SCORE: <span style={{ color: 'var(--green)' }}>{stats.best_score > 0 ? '+' : ''}{stats.best_score}</span>
            </div>
        </div>
    );
}
