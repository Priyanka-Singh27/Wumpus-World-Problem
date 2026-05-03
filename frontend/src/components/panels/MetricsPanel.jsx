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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                <h3 style={{ 
                    color: 'var(--gold)', 
                    fontSize: '11px', 
                    margin: 0,
                    fontFamily: "'Press Start 2P', monospace",
                    textShadow: '2px 2px 0 #000'
                }}>📊 STATS</h3>
                <PixelButton
                    label={isBenchmarking ? "RUNNING..." : "BENCHMARK"}
                    color="navy"
                    onClick={handleBenchmark}
                    disabled={isBenchmarking}
                />
            </div>

            {!benchReport && !isBenchmarking && (
                <div style={{ 
                    flexGrow: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'var(--dim)', 
                    fontSize: '8px',
                    textAlign: 'center',
                    fontFamily: "'Press Start 2P', monospace",
                    lineHeight: 2
                }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⚔️</div>
                    READY FOR<br/>HEAD-TO-HEAD
                </div>
            )}

            {isBenchmarking && (
                <div style={{ 
                    flexGrow: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'var(--blue)', 
                    fontSize: '8px',
                    fontFamily: "'Press Start 2P', monospace"
                }}>
                    <div className="sprite-pit-swirl" style={{ marginBottom: '16px' }} />
                    <span>SIMULATING...</span>
                </div>
            )}

            {benchReport && !isBenchmarking && (
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {['knowledge', 'rl'].map(agentType => {
                            const stats = benchReport.agents[agentType];
                            if (!stats) return null;
                            const color = agentType === 'knowledge' ? 'var(--green)' : 'var(--blue)';
                            const title = agentType === 'knowledge' ? 'KB BOT' : 'RL BOT';
                            return (
                                <StatCard key={agentType} title={title} color={color} stats={stats} />
                            );
                        })}
                        {benchReport.agents['random'] && (
                            <StatCard title="RANDOM" color="var(--red)" stats={benchReport.agents['random']} />
                        )}
                        <div style={{
                            border: `2px solid var(--gold-dark)`, padding: '8px',
                            backgroundColor: 'var(--hud-bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <div style={{ color: 'var(--gold)', fontSize: '6px', textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
                                WINNER:<br />{benchReport.comparison.best_agent.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                        <h4 style={{ 
                            color: 'var(--gold)', 
                            fontSize: '6px', 
                            margin: '0 0 8px 0',
                            fontFamily: "'Press Start 2P', monospace"
                        }}>WIN RATE %</h4>
                        <div style={{ 
                            display: 'flex', 
                            height: '64px', 
                            alignItems: 'flex-end', 
                            borderBottom: '2px solid var(--border-pixel)', 
                            padding: '0 8px', 
                            gap: '8px',
                            backgroundColor: 'rgba(0,0,0,0.2)'
                        }}>
                            {['knowledge', 'rl', 'random'].map((agentType) => {
                                const stats = benchReport.agents[agentType];
                                const color = agentType === 'knowledge' ? 'var(--green)' : (agentType === 'rl' ? 'var(--blue)' : 'var(--red)');
                                const heightPct = stats ? (stats.win_rate * 100) : 0;
                                return (
                                    <div key={agentType} style={{
                                        flex: 1,
                                        backgroundColor: color,
                                        height: `${Math.max(2, heightPct)}%`,
                                        position: 'relative',
                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)'
                                    }}>
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '-12px', 
                                            width: '100%', 
                                            textAlign: 'center', 
                                            fontSize: '5px',
                                            fontFamily: "'Press Start 2P', monospace",
                                            color: '#fff'
                                        }}>
                                            {heightPct > 0 ? heightPct.toFixed(0) : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', fontSize: '5px', marginTop: '6px', textAlign: 'center', gap: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                            <div style={{ flex: 1, color: 'var(--green)' }}>KB</div>
                            <div style={{ flex: 1, color: 'var(--blue)' }}>RL</div>
                            <div style={{ flex: 1, color: 'var(--red)' }}>RND</div>
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
            border: `2px solid ${color}`, padding: '8px',
            backgroundColor: 'var(--hud-bg2)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '2px 2px 0 rgba(0,0,0,0.3)'
        }}>
            <h4 style={{ color, margin: '0 0 6px 0', fontSize: '6px', fontFamily: "'Press Start 2P', monospace" }}>{title}</h4>
            <div style={{ fontSize: '5px', lineHeight: '1.8', fontFamily: "'Press Start 2P', monospace", color: '#fff' }}>
                WINS: <span style={{ color: 'var(--gold)' }}>{(stats.win_rate * 100).toFixed(0)}%</span><br />
                STEPS: <span style={{ color: 'var(--cyan)' }}>{Math.round(stats.avg_steps)}</span><br />
                PITS: <span style={{ color: 'var(--red)' }}>{stats.deaths_pit}</span><br />
                BEST: <span style={{ color: 'var(--green)' }}>{stats.best_score}</span>
            </div>
        </div>
    );
}
