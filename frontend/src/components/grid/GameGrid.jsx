import React from 'react';
import Cell from './Cell.jsx';
import { useGameStore } from '../../store/gameStore';

const CELL_SIZE = 90;

export default function GameGrid({ overrideState, overrideKb, overrideFog }) {
    const storeState = useGameStore(s => s.worldState);
    const storeFog = useGameStore(s => s.fogMode);
    const storeKb = useGameStore(s => s.kbSnapshot);

    const worldState = overrideState ?? storeState;
    const fogMode = overrideFog ?? storeFog;
    const kbSnapshot = overrideKb ?? storeKb;

    if (!worldState) {
        return (
            <div className="game-grid-outer">
                <div style={{
                    color: '#2c2137',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 12,
                    textShadow: '2px 2px 0 rgba(255,255,255,0.5)',
                }}>
                    Loading world…
                </div>
            </div>
        );
    }

    const { cells = [], agent, config = {} } = worldState;
    const gridSize = config.size || 4;

    const isCellFogged = (r, c) => {
        if (fogMode === 'off') return false;
        const isCurrent = (r === agent?.row && c === agent?.col);
        if (fogMode === 'full') return !isCurrent;
        if (fogMode === 'adjacent') {
            if (isCurrent) return false;
            const dr = Math.abs(r - (agent?.row ?? 0));
            const dc = Math.abs(c - (agent?.col ?? 0));
            return (dr + dc) > 1;
        }
        if (fogMode === 'memory') {
            return !cells[r]?.[c]?.visited;
        }
        return false;
    };

    const gridPx = gridSize * CELL_SIZE + (gridSize + 1) * 2;

    return (
        <div className="game-grid-outer">
            <div
                className="game-grid-board"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize}, ${CELL_SIZE}px)`,
                    gridTemplateRows: `repeat(${gridSize}, ${CELL_SIZE}px)`,
                    gap: '2px',
                    padding: '4px',
                    /* Ground / underground border */
                    backgroundColor: '#3a2a1a',
                    border: '4px solid #2a1a0a',
                    width: gridPx + 4,
                    height: gridPx + 4,
                    /* Chunky pixel shadow */
                    boxShadow:
                        '6px 6px 0 0 rgba(0,0,0,0.4),' +
                        'inset 3px 3px 0 0 rgba(255,255,255,0.08),' +
                        'inset -3px -3px 0 0 rgba(0,0,0,0.3)',
                    imageRendering: 'pixelated',
                }}
            >
                {(cells || []).slice().reverse().map((rowArr, revR) => {
                    const r = gridSize - 1 - revR;
                    return (rowArr || []).map((cell, c) => {
                        const isCurrent = (r === agent?.row && c === agent?.col);
                        const kbCell = kbSnapshot?.cells?.[r]?.[c];
                        return (
                            <Cell
                                key={`${r}-${c}`}
                                cell={cell}
                                row={r}
                                col={c}
                                isFogged={isCellFogged(r, c)}
                                isCurrent={isCurrent}
                                agentState={agent}
                                kbCell={kbCell}
                            />
                        );
                    });
                })}
            </div>
        </div>
    );
}
