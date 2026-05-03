import React from 'react';
import { SpriteAgent, SpriteWumpus, SpriteGold } from './Sprites.jsx';
import './Cell.css';

const CELL_SIZE = 90; // px

export default function Cell({ cell, row, col, isFogged, fogMode, isCurrent, agentState, kbCell }) {
    // DEBUG: console.log('Rendering cell:', row, col, cell);
    const { has_pit, has_wumpus, has_gold, visited } = cell;

    // Fog: show mysterious dark tile
    if (isFogged) {
        return (
            <div className="grid-cell fogged" style={{ width: CELL_SIZE, height: CELL_SIZE }}>
                <div className="stone-bevel" />
                {/* Mystery sparkle */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 16, opacity: 0.15, pointerEvents: 'none',
                }}>❓</div>
            </div>
        );
    }

    // Determine tile colour variant
    const isStart = (row === 0 && col === 0);
    const isKbSafe = kbCell?.safe && !has_pit && !has_wumpus;
    
    // When fog is OFF, we show everything as safe (grass) since all is visible
    const isVisibleSafe = (!isFogged && !has_pit && !has_wumpus) || (fogMode === 'off');
    const tileClass = (isStart || isKbSafe || isVisibleSafe) ? 'tile-green' : 'tile-stone';

    // KB overlay
    let kbBorder = '';
    if (kbCell) {
        if (kbCell.has_pit === true) kbBorder = 'kb-pit';
        else if (kbCell.danger_prob > 0.6) kbBorder = 'kb-danger';
        else if (kbCell.safe) kbBorder = 'kb-safe';
    }

    // Percept effects
    const hasBreeze = cell.breeze;
    const hasStench = cell.stench;

    // Cell-level animated class
    const cellEffects = [
        hasBreeze ? 'cell-breeze' : '',
        hasStench ? 'cell-stench' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={`grid-cell ${tileClass} ${kbBorder} ${cellEffects}`}
            style={{ width: CELL_SIZE, height: CELL_SIZE }}
        >
            {/* 3-D pixel bevel overlay */}
            <div className="stone-bevel" />

            {/* 1. Pit — dark cave hole with skull warning */}
            {has_pit && (
                <>
                    <div className="pit-hole">
                        <div className="pit-lip" />
                    </div>
                    <div style={{
                        position: 'absolute', top: 4, left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 14, pointerEvents: 'none',
                        filter: 'drop-shadow(0 0 4px rgba(255,0,0,0.5))',
                        zIndex: 2,
                    }}>⚠️</div>
                </>
            )}

            {/* 2. Gold — treasure/coin */}
            {has_gold && !has_pit && (
                isCurrent ? (
                    <div style={{
                        position: 'absolute',
                        bottom: 4, right: 4,
                        fontSize: 18, lineHeight: 1,
                        animation: 'goldShimmer 1.2s ease-in-out infinite',
                        zIndex: 5,
                        pointerEvents: 'none',
                    }}>🪙</div>
                ) : (
                    <div className="sprite-wrap" style={{
                        animation: 'goldShimmer 2s ease-in-out infinite',
                    }}>
                        <SpriteGold />
                    </div>
                )
            )}

            {/* 3. Wumpus — monster */}
            {has_wumpus && (
                <div className="sprite-wrap">
                    <SpriteWumpus />
                </div>
            )}

            {/* 4. Player — adventurer */}
            {isCurrent && agentState && (
                <>
                    <div className="sprite-wrap">
                        <SpriteAgent direction={agentState.direction} isDead={!agentState.alive} />
                    </div>
                    {/* Directional arrow indicator */}
                    {agentState.alive && (
                        <div className={`dir-indicator dir-${agentState.direction}`} />
                    )}
                </>
            )}

            {/* 5. Percept labels */}
            {(hasBreeze || hasStench) && (
                <div className="percept-label">
                    {hasBreeze && <span className="percept-breeze">💨 Breeze</span>}
                    {hasStench && <span className="percept-stench">☠️ Stench</span>}
                </div>
            )}

            {/* KB danger-prob overlay */}
            {kbCell && kbCell.danger_prob > 0 && kbCell.danger_prob < 1 && (
                <div className="kb-prob">{Math.round(kbCell.danger_prob * 100)}%</div>
            )}

            {/* Start cell marker */}
            {isStart && !isCurrent && !has_pit && !has_wumpus && (
                <div style={{
                    position: 'absolute', top: 3, left: 4,
                    fontSize: 10, pointerEvents: 'none',
                    opacity: 0.6, zIndex: 1,
                }}>🏠</div>
            )}
        </div>
    );
}
