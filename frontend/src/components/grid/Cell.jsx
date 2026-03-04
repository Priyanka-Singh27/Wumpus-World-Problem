import React from 'react';
import { SpriteAgent, SpriteWumpus, SpriteGold } from './Sprites.jsx';
import './Cell.css';

const CELL_SIZE = 90; // px

export default function Cell({ cell, row, col, isFogged, isCurrent, agentState, kbCell }) {
    const { has_pit, has_wumpus, has_gold, visited } = cell;

    // Fog: show plain dark stone if fogged
    if (isFogged) {
        return (
            <div className="grid-cell fogged" style={{ width: CELL_SIZE, height: CELL_SIZE }}>
                <div className="stone-bevel" />
            </div>
        );
    }

    // Determine tile colour variant
    const isStart = (row === 0 && col === 0);
    const isKbSafe = kbCell?.safe && !has_pit && !has_wumpus;
    const tileClass = isStart || isKbSafe ? 'tile-green' : 'tile-stone';

    // KB overlay
    let kbBorder = '';
    if (kbCell) {
        if (kbCell.has_pit === true) kbBorder = 'kb-pit';
        else if (kbCell.danger_prob > 0.6) kbBorder = 'kb-danger';
        else if (kbCell.safe) kbBorder = 'kb-safe';
    }

    // Percept labels (shown on visited cells)
    const showBreeze = visited && cell.breeze;
    const showStench = visited && cell.stench;

    return (
        <div
            className={`grid-cell ${tileClass} ${kbBorder}`}
            style={{ width: CELL_SIZE, height: CELL_SIZE }}
        >
            {/* 3-D bevel overlay */}
            <div className="stone-bevel" />

            {/* 1. Pit hole */}
            {has_pit && (
                <div className="pit-hole">
                    <div className="pit-lip" />
                </div>
            )}

            {/* 2. Gold */}
            {has_gold && !has_pit && (
                <div className="sprite-wrap">
                    <SpriteGold />
                </div>
            )}

            {/* 3. Wumpus */}
            {has_wumpus && (
                <div className="sprite-wrap">
                    <SpriteWumpus />
                </div>
            )}

            {/* 4. Player */}
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

            {/* 5. Percept label */}
            {(showBreeze || showStench) && (
                <div className="percept-label">
                    {showBreeze && <span>Breeze</span>}
                    {showStench && <span>Stench</span>}
                </div>
            )}

            {/* KB danger-prob number (tiny overlay top-right) */}
            {kbCell && kbCell.danger_prob > 0 && kbCell.danger_prob < 1 && (
                <div className="kb-prob">{Math.round(kbCell.danger_prob * 100)}%</div>
            )}
        </div>
    );
}
