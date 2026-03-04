import React from 'react';
import { useGameStore } from '../../store/gameStore';

export default function HeaderBar({ onOpenSeedBrowser }) {
    const { worldState } = useGameStore();
    const agent = worldState?.agent;
    const score = agent?.score ?? 0;
    const arrows = agent?.arrows ?? 0;
    const steps = agent?.steps ?? 0;
    const goldLeft = worldState
        ? worldState.cells?.flat().filter(c => c.has_gold).length ?? 0
        : 0;

    return (
        <div className="header-bar">
            <span className="header-title">Wumpus World Simulator</span>

            <nav style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
                {onOpenSeedBrowser && (
                    <button
                        onClick={onOpenSeedBrowser}
                        style={{
                            background: 'rgba(255,255,255,0.18)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.4)',
                            padding: '4px 12px',
                            borderRadius: 2,
                            cursor: 'pointer',
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 8,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}
                    >
                        🌍 Seeds
                    </button>
                )}
                <a style={{ color: '#fff', textDecoration: 'none', fontSize: 15, cursor: 'default' }}>Controls</a>
                <a style={{ color: '#fff', textDecoration: 'none', fontSize: 15, cursor: 'default' }}>About</a>
            </nav>

            <div className="header-score-bar">
                <span>Score <strong style={{ color: score >= 0 ? '#aaffcc' : '#ffaaaa' }}>{score >= 0 ? '+' : ''}{score}</strong></span>
                <span>⛏ Arrows: <strong>{arrows}</strong></span>
                <span>🟡 Golds left: <strong>{goldLeft}</strong></span>
                <span>Steps: <strong>{steps}</strong></span>
            </div>
        </div>
    );
}
