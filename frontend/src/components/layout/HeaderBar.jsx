import React from 'react';
import { useGameStore } from '../../store/gameStore';

export default function HeaderBar({ onOpenSeedBrowser }) {
    const { worldState, difficulty } = useGameStore();
    const agent = worldState?.agent;
    const score = agent?.score ?? 0;
    const arrows = agent?.arrows ?? 0;
    const steps = agent?.steps ?? 0;
    const alive = agent?.alive ?? true;
    const hasGold = agent?.has_gold ?? false;
    const goldLeft = worldState?.total_gold ?? 0;

    // Heart display: use alive state — show red heart if alive, grey if dead
    const hearts = alive ? '❤️❤️❤️' : '🖤🖤🖤';

    // Level display based on difficulty
    const levelMap = { easy: '1', medium: '2', hard: '3', expert: '4' };
    const level = levelMap[difficulty] || '?';

    return (
        <div className="header-bar">
            {/* Title */}
            <span className="header-title">WUMPUS WORLD</span>

            {/* HUD Stats */}
            <div className="header-score-bar">
                {/* Hearts */}
                <span title="Health">
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{hearts}</span>
                </span>

                {/* Score as coin */}
                <span title="Score">
                    <span style={{ fontSize: 18 }}>💎</span>
                    <strong style={{
                        color: score >= 0 ? '#22ff88' : '#ff4466',
                        textShadow: '1px 1px 0 #000',
                    }}>
                        {score >= 0 ? '+' : ''}{score}
                    </strong>
                </span>

                {/* Arrows */}
                <span title="Arrows remaining">
                    <span style={{ fontSize: 18 }}>🏹</span>
                    <strong style={{ color: '#ffcc44', textShadow: '1px 1px 0 #000' }}>{arrows}</strong>
                </span>

                {/* Gold */}
                <span title="Gold remaining in world">
                    <span style={{ fontSize: 18 }}>🪙</span>
                    <strong style={{ color: '#ffd700', textShadow: '1px 1px 0 #000' }}>{goldLeft}</strong>
                    {hasGold && <span style={{ fontSize: 12, marginLeft: 2 }}>✅</span>}
                </span>

                {/* Steps */}
                <span title="Steps taken">
                    <span style={{ fontSize: 18 }}>👟</span>
                    <strong style={{ textShadow: '1px 1px 0 #000' }}>{steps}</strong>
                </span>

                {/* Level */}
                <span title="Current level" style={{
                    background: 'rgba(255,215,0,0.2)',
                    padding: '2px 8px',
                    border: '2px solid rgba(255,215,0,0.4)',
                }}>
                    LV.{level}
                </span>
            </div>

            {/* Action buttons */}
            <nav style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                {onOpenSeedBrowser && (
                    <button
                        onClick={onOpenSeedBrowser}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: '#ffd700',
                            border: '2px solid rgba(255,215,0,0.4)',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 7,
                            textTransform: 'uppercase',
                            boxShadow: '0 3px 0 0 rgba(0,0,0,0.3)',
                            transition: 'transform 0.05s',
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
                        onMouseUp={e => e.currentTarget.style.transform = ''}
                        onMouseLeave={e => e.currentTarget.style.transform = ''}
                    >
                        🌍 SEEDS
                    </button>
                )}
            </nav>
        </div>
    );
}
