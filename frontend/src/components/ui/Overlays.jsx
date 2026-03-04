import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { previewWorld, newGame } from '../../api/client';
import GameGrid from '../grid/GameGrid';

/*
 * GameOverlay — shown in single-player when game result != ONGOING
 * Three states:
 *   WIN  → gold chest animation + green text
 *   DEAD_PIT / DEAD_WUMPUS → skull + red text
 *   TIMEOUT → yellow text
 */
export function GameOverlay({ onReset }) {
    const { worldState } = useGameStore();
    const result = worldState?.result;
    const score = worldState?.agent?.score ?? 0;

    if (!result || result === 'ONGOING') return null;

    const isWin = result === 'WIN';
    const isDead = result === 'DEAD_PIT' || result === 'DEAD_WUMPUS';
    const isTimeout = result === 'TIMEOUT';

    const emoji = isWin ? '🏆' : isDead ? '💀' : '⏱';
    const title = isWin ? 'YOU WIN!' : isDead ? 'YOU DIED' : 'TIME OUT';
    const sub = isWin
        ? `Score: ${score >= 0 ? '+' : ''}${score}`
        : result === 'DEAD_PIT'
            ? 'Fell into a pit!'
            : result === 'DEAD_WUMPUS'
                ? 'Eaten by the Wumpus!'
                : `Max steps reached. Score: ${score}`;
    const color = isWin ? '#22aa55' : isDead ? '#cc2222' : '#cc8800';
    const bgColor = isWin ? 'rgba(20,60,30,0.93)' : isDead ? 'rgba(60,10,10,0.93)' : 'rgba(40,35,10,0.93)';

    // Confetti pieces for win
    const confetti = isWin
        ? Array.from({ length: 24 }, (_, i) => ({
            id: i,
            left: `${(i * 4.2) % 100}%`,
            color: ['#ffd700', '#ff4466', '#00ff88', '#4488ff', '#ff8844'][i % 5],
            delay: `${(i * 0.12).toFixed(2)}s`,
            duration: `${1.4 + (i % 4) * 0.3}s`,
        }))
        : [];

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 200,
            background: bgColor,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16,
            overflow: 'hidden',
        }}>
            {/* Confetti */}
            {confetti.map(c => (
                <div key={c.id} style={{
                    position: 'absolute',
                    width: 10, height: 10,
                    backgroundColor: c.color,
                    left: c.left, top: '-5%',
                    animation: `confettiFall ${c.duration} ${c.delay} linear forwards`,
                }} />
            ))}

            <div style={{ fontSize: 64, lineHeight: 1 }}>{emoji}</div>

            <h1 style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 32,
                color,
                textShadow: '4px 4px 0 #000',
                margin: 0,
                textTransform: 'uppercase',
            }}>
                {title}
            </h1>

            <p style={{
                fontFamily: 'sans-serif',
                fontSize: 18,
                color: '#ffffff',
                margin: 0,
                textAlign: 'center',
            }}>
                {sub}
            </p>

            <button
                onClick={onReset}
                style={{
                    marginTop: 16,
                    padding: '12px 32px',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 12,
                    textTransform: 'uppercase',
                    background: color,
                    color: '#fff',
                    border: '3px solid #fff',
                    cursor: 'pointer',
                    boxShadow: '4px 4px 0 #000',
                    letterSpacing: 1,
                }}
            >
                ↺ PLAY AGAIN
            </button>
        </div>
    );
}

/*
 * SeedBrowser — modal for previewing and loading specific world seeds
 */
export function SeedBrowser({ onClose, onLoad }) {
    const [seedInput, setSeedInput] = useState('');
    const [diff, setDiff] = useState('medium');
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handlePreview = async () => {
        setLoading(true);
        try {
            const seed = seedInput ? parseInt(seedInput, 10) : null;
            const world = await previewWorld(diff, seed);
            setPreview({ world, seed: world.seed });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleLoad = async () => {
        if (!preview) return;
        onLoad(preview.seed, diff);
    };

    const DIFFS = ['easy', 'medium', 'hard', 'expert'];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: '#f0f0f0',
                border: '4px solid #4a7aaa',
                width: 640,
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '8px 8px 0 rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{
                    background: '#4a7aaa', color: '#fff',
                    padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: "'Press Start 2P', monospace", fontSize: 11, textTransform: 'uppercase',
                }}>
                    <span>🌍 Seed Browser</span>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#fff',
                        fontSize: 18, cursor: 'pointer', lineHeight: 1,
                    }}>✕</button>
                </div>

                {/* Controls */}
                <div style={{
                    padding: '12px 16px', borderBottom: '2px solid #bbb',
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                }}>
                    <input
                        ref={inputRef}
                        type="number"
                        placeholder="Seed (blank = random)"
                        value={seedInput}
                        onChange={e => setSeedInput(e.target.value)}
                        style={{
                            padding: '6px 10px', border: '2px solid #999',
                            fontFamily: 'sans-serif', fontSize: 13,
                            flex: 1, minWidth: 140,
                        }}
                    />
                    {DIFFS.map(d => (
                        <button key={d}
                            onClick={() => setDiff(d)}
                            style={{
                                padding: '6px 10px',
                                background: diff === d ? '#4a7aaa' : '#ddd',
                                color: diff === d ? '#fff' : '#333',
                                border: '2px solid #999',
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: 7, textTransform: 'uppercase',
                                cursor: 'pointer',
                            }}
                        >{d}</button>
                    ))}
                    <button
                        onClick={handlePreview}
                        disabled={loading}
                        style={{
                            padding: '7px 16px',
                            background: '#3a7d44', color: '#fff',
                            border: '2px solid #2a5a30',
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 8, cursor: 'pointer',
                        }}
                    >{loading ? '...' : 'PREVIEW'}</button>
                </div>

                {/* Preview area */}
                <div style={{
                    flex: 1, overflow: 'auto',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', padding: 16, gap: 12,
                }}>
                    {!preview && !loading && (
                        <div style={{ color: '#888', fontFamily: 'sans-serif', fontSize: 14, marginTop: 40 }}>
                            Enter a seed and click PREVIEW to see the world layout.
                        </div>
                    )}
                    {loading && (
                        <div style={{ color: '#4a7aaa', fontFamily: 'sans-serif', fontSize: 16, marginTop: 40 }}>
                            Generating world…
                        </div>
                    )}
                    {preview && !loading && (
                        <>
                            <div style={{
                                fontFamily: "'Press Start 2P', monospace", fontSize: 9,
                                color: '#333', letterSpacing: 1,
                            }}>
                                SEED: {preview.seed} &nbsp;|&nbsp; SIZE: {preview.world.size}×{preview.world.size}
                                &nbsp;|&nbsp; PITS: {preview.world.cells.flat().filter(c => c.has_pit).length}
                                &nbsp;|&nbsp; WUMPUS: {preview.world.cells.flat().filter(c => c.has_wumpus).length}
                                &nbsp;|&nbsp; GOLD: {preview.world.cells.flat().filter(c => c.has_gold).length}
                            </div>

                            {/* Mini revealed grid */}
                            <SeedPreviewGrid world={preview.world} />

                            <button
                                onClick={handleLoad}
                                style={{
                                    padding: '10px 28px',
                                    background: '#4a7aaa', color: '#fff',
                                    border: '3px solid #2a5a88',
                                    fontFamily: "'Press Start 2P', monospace",
                                    fontSize: 10, cursor: 'pointer',
                                    boxShadow: '3px 3px 0 #000',
                                    textTransform: 'uppercase',
                                }}
                            >
                                ▶ PLAY THIS WORLD
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function SeedPreviewGrid({ world }) {
    const { cells, size } = world;
    const cellPx = Math.max(28, Math.min(52, Math.floor(360 / size)));
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${size}, ${cellPx}px)`,
            gap: 2,
            padding: 2,
            background: '#4a5545',
            border: '3px solid #2a3025',
        }}>
            {[...cells].reverse().map((rowArr, revR) => {
                const r = size - 1 - revR;
                return rowArr.map((cell, c) => {
                    const isStart = r === 0 && c === 0;
                    let bg = isStart ? '#5a8a3a' : '#7a8875';
                    let content = null;
                    const fs = Math.max(10, cellPx / 3);

                    if (cell.has_pit) { bg = '#1a1a1a'; content = <span style={{ fontSize: fs }}>🕳</span>; }
                    if (cell.has_wumpus) { content = <span style={{ fontSize: fs }}>💀</span>; }
                    if (cell.has_gold) { content = <span style={{ fontSize: fs }}>🟡</span>; }
                    if (isStart && !cell.has_pit && !cell.has_wumpus) {
                        content = <span style={{ fontSize: fs }}>🧍</span>;
                    }

                    return (
                        <div key={`${r}-${c}`} style={{
                            width: cellPx, height: cellPx, background: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.2), inset -2px -2px 0 rgba(0,0,0,0.2)',
                            flexShrink: 0,
                        }}>
                            {content}
                        </div>
                    );
                });
            })}
        </div>
    );
}
