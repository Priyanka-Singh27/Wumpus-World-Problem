import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { previewWorld, newGame } from '../../api/client';
import GameGrid from '../grid/GameGrid';

/* ── CSS keyframes injected once ────────────────────────────────────────────*/
const STYLE_ID = 'moment-toast-styles';
if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
@keyframes toastSlideIn {
    0%   { transform: translateX(-50%) translateY(30px) scale(0.7); opacity: 0; }
    60%  { transform: translateX(-50%) translateY(-6px) scale(1.08); opacity: 1; }
    100% { transform: translateX(-50%) translateY(0)    scale(1);    opacity: 1; }
}
@keyframes toastFadeOut {
    from { opacity: 1; transform: translateX(-50%) scale(1); }
    to   { opacity: 0; transform: translateX(-50%) scale(0.9); }
}
@keyframes particleBurst {
    0%   { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
}
@keyframes confettiFall {
    0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
@keyframes chestBounce {
    0%, 100% { transform: scale(1) rotate(0deg); }
    25%      { transform: scale(1.15) rotate(-5deg); }
    50%      { transform: scale(1.2) rotate(5deg); }
    75%      { transform: scale(1.1) rotate(-3deg); }
}
@keyframes skullShake {
    0%, 100% { transform: rotate(0deg); }
    20%      { transform: rotate(-8deg); }
    40%      { transform: rotate(8deg); }
    60%      { transform: rotate(-5deg); }
    80%      { transform: rotate(5deg); }
}
@keyframes letterReveal {
    from { opacity: 0; transform: translateY(-20px) scale(0.5); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}`;
    document.head.appendChild(s);
}

/*
 * MomentToast — brief celebration popup for Wumpus kill or Gold grab.
 */
export function MomentToast() {
    const { toast, clearToast } = useGameStore();
    const [fading, setFading] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!toast) { setFading(false); return; }
        setFading(false);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setFading(true), 1800);
        const clearTimer = setTimeout(() => clearToast(), 2200);
        return () => { clearTimeout(timerRef.current); clearTimeout(clearTimer); };
    }, [toast, clearToast]);

    if (!toast) return null;

    const isKill = toast.type === 'kill';
    const isTraining = toast.type === 'training';
    const accentColor = isKill ? '#aa44cc' : (isTraining ? '#4488ff' : '#ffd700');
    const bgColor = isKill
        ? 'rgba(30,10,40,0.95)'
        : (isTraining ? 'rgba(10,20,40,0.95)' : 'rgba(40,30,10,0.95)');
    const glowColor = isKill ? '#cc66ff' : (isTraining ? '#66aaff' : '#ffaa00');

    const particles = Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * 360;
        const dist = 55 + (i % 3) * 18;
        const rad = (angle * Math.PI) / 180;
        return {
            id: i,
            tx: `${Math.cos(rad) * dist}px`,
            ty: `${Math.sin(rad) * dist}px`,
            color: [accentColor, '#ffffff', '#ff8844', '#44ffaa', '#ff4488'][i % 5],
            delay: `${(i * 0.04).toFixed(2)}s`,
        };
    });

    return (
        <div style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            animation: fading
                ? 'toastFadeOut 0.4s ease forwards'
                : 'toastSlideIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            {/* Particle ring */}
            <div style={{ position: 'absolute', width: 0, height: 0 }}>
                {particles.map(p => (
                    <div key={p.id} style={{
                        position: 'absolute',
                        width: 8, height: 8,
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        '--tx': p.tx,
                        '--ty': p.ty,
                        animation: `particleBurst 0.6s ${p.delay} ease-out forwards`,
                    }} />
                ))}
            </div>

            {/* Toast pill */}
            <div style={{
                background: bgColor,
                border: `3px solid ${accentColor}`,
                boxShadow: `0 0 20px ${glowColor}, 6px 6px 0 rgba(0,0,0,0.5)`,
                padding: '12px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minWidth: 240,
                justifyContent: 'center',
            }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>
                    {isKill ? '⚔️' : (isTraining ? '🧠' : '🏅')}
                </span>
                <span style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 11,
                    color: accentColor,
                    textShadow: `2px 2px 0 #000, 0 0 8px ${glowColor}`,
                    letterSpacing: 1,
                    whiteSpace: 'nowrap',
                }}>
                    {toast.message}
                </span>
            </div>
        </div>
    );
}


/*
 * GameOverlay — pixel-art styled Game Over / You Win screen
 */
export function GameOverlay({ onReset }) {
    const { worldState } = useGameStore();
    const result = worldState?.result;
    const score = worldState?.agent?.score ?? 0;

    if (!result || result === 'ONGOING') return null;

    const isWin = result === 'WIN';
    const isDead = result === 'DEAD_PIT' || result === 'DEAD_WUMPUS';

    const emoji = isWin ? '🏆' : isDead ? '💀' : '⏱';
    const title = isWin ? 'YOU WIN!' : isDead ? 'GAME OVER' : 'TIME OUT';
    const sub = isWin
        ? `SCORE: ${score >= 0 ? '+' : ''}${score}`
        : result === 'DEAD_PIT'
            ? 'FELL INTO A PIT!'
            : result === 'DEAD_WUMPUS'
                ? 'EATEN BY THE WUMPUS!'
                : `MAX STEPS. SCORE: ${score}`;
    const color = isWin ? '#22ff66' : isDead ? '#ff4444' : '#ffaa00';
    const bgColor = isWin
        ? 'rgba(10,30,15,0.95)'
        : isDead
            ? 'rgba(40,5,5,0.95)'
            : 'rgba(30,25,5,0.95)';

    // Confetti for win
    const confetti = isWin
        ? Array.from({ length: 30 }, (_, i) => ({
            id: i,
            left: `${(i * 3.4) % 100}%`,
            color: ['#ffd700', '#ff4466', '#00ff88', '#4488ff', '#ff8844', '#aa44cc'][i % 6],
            delay: `${(i * 0.1).toFixed(2)}s`,
            duration: `${1.4 + (i % 4) * 0.3}s`,
            size: 6 + (i % 3) * 4,
        }))
        : [];

    // Title letters animation
    const titleLetters = title.split('');

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 200,
            background: bgColor,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20,
            overflow: 'hidden',
        }}>
            {/* Confetti */}
            {confetti.map(c => (
                <div key={c.id} style={{
                    position: 'absolute',
                    width: c.size, height: c.size,
                    backgroundColor: c.color,
                    left: c.left, top: '-5%',
                    animation: `confettiFall ${c.duration} ${c.delay} linear forwards`,
                }} />
            ))}

            {/* Emoji icon with animation */}
            <div style={{
                fontSize: 72, lineHeight: 1,
                animation: isWin
                    ? 'chestBounce 1s ease-in-out infinite'
                    : (isDead ? 'skullShake 0.5s ease-in-out infinite' : 'none'),
                filter: `drop-shadow(0 0 20px ${color})`,
            }}>{emoji}</div>

            {/* Pixel-art title with letter-by-letter animation */}
            <h1 style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 28,
                color,
                margin: 0,
                textTransform: 'uppercase',
                display: 'flex',
                gap: 2,
            }}>
                {titleLetters.map((letter, i) => (
                    <span key={i} style={{
                        display: 'inline-block',
                        animation: `letterReveal 0.3s ${i * 0.06}s ease-out both`,
                        textShadow: `3px 3px 0 #000, 0 0 15px ${color}`,
                    }}>
                        {letter === ' ' ? '\u00A0' : letter}
                    </span>
                ))}
            </h1>

            {/* Sub text */}
            <p style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 10,
                color: '#fff',
                margin: 0,
                textAlign: 'center',
                textShadow: '2px 2px 0 #000',
                opacity: 0.8,
            }}>
                {sub}
            </p>

            {/* Retry buttons */}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <button
                    onClick={onReset}
                    style={{
                        padding: '14px 36px',
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 11,
                        textTransform: 'uppercase',
                        background: '#2ca52c',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        letterSpacing: 1,
                        boxShadow:
                            '0 4px 0 0 #1a6a1a, 4px 0 0 0 #1a6a1a,' +
                            'inset 0 2px 0 0 rgba(255,255,255,0.3)',
                        transition: 'transform 0.05s',
                    }}
                    onMouseDown={e => {
                        e.currentTarget.style.transform = 'translateY(3px)';
                        e.currentTarget.style.boxShadow = '0 1px 0 0 #1a6a1a, inset 0 2px 0 0 rgba(0,0,0,0.2)';
                    }}
                    onMouseUp={e => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '0 4px 0 0 #1a6a1a, 4px 0 0 0 #1a6a1a, inset 0 2px 0 0 rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '0 4px 0 0 #1a6a1a, 4px 0 0 0 #1a6a1a, inset 0 2px 0 0 rgba(255,255,255,0.3)';
                    }}
                >
                    ▶ TRY AGAIN?
                </button>
            </div>
        </div>
    );
}

/*
 * SeedBrowser — pixel-art modal for previewing and loading specific world seeds
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
    const DIFF_EMOJI = { easy: '🟢', medium: '🟡', hard: '🔴', expert: '💀' };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: '#1e1529',
                border: '4px solid #5a4a6a',
                width: 640,
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '8px 8px 0 rgba(0,0,0,0.6)',
            }}>
                {/* Header */}
                <div style={{
                    background: '#2c2137',
                    color: '#ffd700',
                    padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: "'Press Start 2P', monospace", fontSize: 10, textTransform: 'uppercase',
                    borderBottom: '3px solid #5a4a6a',
                }}>
                    <span>🌍 Seed Browser</span>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#ff4466',
                        fontSize: 16, cursor: 'pointer', lineHeight: 1,
                        fontFamily: "'Press Start 2P', monospace",
                    }}>✕</button>
                </div>

                {/* Controls */}
                <div style={{
                    padding: '12px 16px', borderBottom: '2px solid #3a2d4a',
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                }}>
                    <input
                        ref={inputRef}
                        type="number"
                        placeholder="Seed..."
                        value={seedInput}
                        onChange={e => setSeedInput(e.target.value)}
                        style={{
                            padding: '6px 10px', border: '2px solid #5a4a6a',
                            fontFamily: "'Press Start 2P', monospace", fontSize: 8,
                            flex: 1, minWidth: 100,
                            background: '#0a0a14', color: '#ffd700',
                        }}
                    />
                    {DIFFS.map(d => (
                        <button key={d}
                            onClick={() => setDiff(d)}
                            style={{
                                padding: '6px 10px',
                                background: diff === d ? '#5a4a6a' : '#2c2137',
                                color: diff === d ? '#ffd700' : '#887799',
                                border: `2px solid ${diff === d ? '#ffd700' : '#5a4a6a'}`,
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: 6, textTransform: 'uppercase',
                                cursor: 'pointer',
                                boxShadow: diff === d ? '0 0 8px rgba(255,215,0,0.3)' : 'none',
                            }}
                        >{DIFF_EMOJI[d]} {d}</button>
                    ))}
                    <button
                        onClick={handlePreview}
                        disabled={loading}
                        style={{
                            padding: '7px 16px',
                            background: '#2ca52c', color: '#fff',
                            border: 'none',
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 7, cursor: 'pointer',
                            boxShadow: '0 3px 0 0 #1a6a1a',
                        }}
                    >{loading ? '...' : '👁 PREVIEW'}</button>
                </div>

                {/* Preview area */}
                <div style={{
                    flex: 1, overflow: 'auto',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', padding: 16, gap: 12,
                }}>
                    {!preview && !loading && (
                        <div style={{
                            color: '#887799',
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 8, marginTop: 40,
                            textAlign: 'center', lineHeight: 2,
                        }}>
                            Enter a seed and click PREVIEW<br/>to see the world layout.
                        </div>
                    )}
                    {loading && (
                        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <div className="sprite-pit-swirl" style={{ color: '#ffd700' }} />
                            <div style={{
                                color: '#ffd700',
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: 8,
                            }}>
                                Generating world…
                            </div>
                        </div>
                    )}
                    {preview && !loading && (
                        <>
                            <div style={{
                                fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                                color: '#ffd700', letterSpacing: 1,
                            }}>
                                SEED: {preview.seed} &nbsp;|&nbsp; SIZE: {preview.world.size}×{preview.world.size}
                                &nbsp;|&nbsp; PITS: {preview.world.cells.flat().filter(c => c.has_pit).length}
                                &nbsp;|&nbsp; WUMPUS: {preview.world.cells.flat().filter(c => c.has_wumpus).length}
                                &nbsp;|&nbsp; GOLD: {preview.world.cells.flat().filter(c => c.has_gold).length}
                            </div>

                            <SeedPreviewGrid world={preview.world} />

                            <button
                                onClick={handleLoad}
                                style={{
                                    padding: '10px 28px',
                                    background: '#2ca52c', color: '#fff',
                                    border: 'none',
                                    fontFamily: "'Press Start 2P', monospace",
                                    fontSize: 9, cursor: 'pointer',
                                    boxShadow: '0 4px 0 0 #1a6a1a, 4px 0 0 0 rgba(0,0,0,0.3)',
                                    textTransform: 'uppercase',
                                    transition: 'transform 0.05s',
                                }}
                                onMouseDown={e => e.currentTarget.style.transform = 'translateY(3px)'}
                                onMouseUp={e => e.currentTarget.style.transform = ''}
                                onMouseLeave={e => e.currentTarget.style.transform = ''}
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
            padding: 3,
            background: '#3a2a1a',
            border: '3px solid #2a1a0a',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
        }}>
            {[...cells].reverse().map((rowArr, revR) => {
                const r = size - 1 - revR;
                return rowArr.map((cell, c) => {
                    const isStart = r === 0 && c === 0;
                    /* Grass-top with dirt/stone */
                    let bg = isStart
                        ? 'linear-gradient(180deg, #5dba3c 0%, #5dba3c 30%, #8b6914 30%)'
                        : 'linear-gradient(180deg, #5dba3c 0%, #5dba3c 30%, #7a7a7a 30%)';
                    let content = null;
                    const fs = Math.max(10, cellPx / 2.5);

                    if (cell.has_pit) {
                        bg = 'radial-gradient(circle, #000 40%, #1a0a0a 80%)';
                        content = <span style={{ fontSize: fs }}>🕳️</span>;
                    }
                    if (cell.has_wumpus) {
                        content = <span style={{ fontSize: fs, filter: 'drop-shadow(0 0 4px red)' }}>👾</span>;
                    }
                    if (cell.has_gold) {
                        content = <span style={{ fontSize: fs, filter: 'drop-shadow(0 0 4px gold)' }}>🪙</span>;
                    }
                    if (isStart && !cell.has_pit && !cell.has_wumpus) {
                        content = <span style={{ fontSize: fs }}>🧝</span>;
                    }

                    return (
                        <div key={`${r}-${c}`} style={{
                            width: cellPx, height: cellPx, background: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -2px 0 rgba(0,0,0,0.25)',
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
