import React, { useRef, useEffect, useState } from 'react';
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
                <div style={{ color: '#555', fontFamily: 'sans-serif', fontSize: 18 }}>
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

    const gridPx = gridSize * CELL_SIZE + (gridSize + 1) * 2; // cells + grout gaps

    return (
        <div className="game-grid-outer">
            <div
                className="game-grid-board"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize}, ${CELL_SIZE}px)`,
                    gridTemplateRows: `repeat(${gridSize}, ${CELL_SIZE}px)`,
                    gap: '2px',
                    padding: '2px',
                    backgroundColor: '#4a5545', /* grout colour */
                    border: '4px solid #2a3025',
                    width: gridPx,
                    height: gridPx,
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
