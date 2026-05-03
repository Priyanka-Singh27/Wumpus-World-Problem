import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { newGame, stepGame, kbStep } from '../../api/client';
import GameGrid from '../grid/GameGrid';
import VSBadge from './VSBadge';
import PixelButton from '../ui/PixelButton';

export default function MultiplayerLayout() {
    const { difficulty, speed, setMultiplayer } = useGameStore();
    const [humanData, setHumanData] = useState(null);
    const [aiData, setAiData] = useState(null);
    const [aiRunning, setAiRunning] = useState(false);
    const [winner, setWinner] = useState(null);

    useEffect(() => {
        // init
        const seed = Math.floor(Math.random() * 10000);
        Promise.all([
            newGame(difficulty, seed),
            newGame(difficulty, seed)
        ]).then(([hRes, aRes]) => {
            setHumanData({ session: hRes.session_id, state: hRes.state, percept: hRes.percept });
            setAiData({ session: aRes.session_id, state: aRes.state, percept: aRes.percept, kb: null });
            setAiRunning(true);
        });
    }, [difficulty]);

    useEffect(() => {
        let interval;
        if (aiRunning && aiData?.session && !winner) {
            interval = setInterval(async () => {
                try {
                    const res = await kbStep(aiData.session);
                    setAiData(prev => ({ ...prev, state: res.state, percept: res.percept, kb: res.kb_snapshot }));
                    if (res.done) {
                        setAiRunning(false);
                        const aiWon = res.result === 'WIN' && res.state?.agent?.has_gold;
                        if (!winner) setWinner(aiWon ? 'AI' : 'DRAW');
                    }
                } catch (e) { console.error(e); }
            }, speed);
        }
        return () => clearInterval(interval);
    }, [aiRunning, aiData?.session, speed, winner]);

    useEffect(() => {
        const handler = async (e) => {
            if (!humanData?.session || winner) return;
            const keyMap = {
                'w': 'MOVE_FORWARD', 'ArrowUp': 'MOVE_FORWARD',
                'a': 'TURN_LEFT', 'ArrowLeft': 'TURN_LEFT',
                'd': 'TURN_RIGHT', 'ArrowRight': 'TURN_RIGHT',
                ' ': 'SHOOT', 'g': 'GRAB', 'e': 'CLIMB', 'Enter': 'CLIMB'
            };
            const action = keyMap[e.key.toLowerCase()] || keyMap[e.key];
            if (action) {
                e.preventDefault();
                try {
                    const res = await stepGame(humanData.session, action);
                    setHumanData(prev => ({ ...prev, state: res.state, percept: res.percept }));
                    if (res.done) {
                        const humanWon = res.result === 'WIN' && res.state?.agent?.has_gold;
                        if (!winner) setWinner(humanWon ? 'YOU' : 'DRAW');
                    }
                } catch (e) { }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [humanData?.session, winner]);

    if (!humanData || !aiData) return (
        <div style={{ 
            color: 'var(--gold)', 
            padding: '48px', 
            textAlign: 'center',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 12
        }}>
            LOADING DUAL DIMENSIONS...
        </div>
    );

    const hScore = humanData.state.agent.score;
    const aScore = aiData.state.agent.score;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            {/* Top VS Bar */}
            <div style={{ 
                display: 'flex', 
                padding: '12px 16px', 
                borderBottom: '4px solid var(--gold-dark)', 
                background: 'var(--hud-bg)', 
                alignItems: 'center', 
                gap: '16px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px'
            }}>
                <div style={{ flex: 1, color: 'var(--green)', textAlign: 'left' }}>🧑 YOU: {hScore}</div>
                
                <div style={{ 
                    flex: 2, 
                    position: 'relative', 
                    height: '20px', 
                    background: '#1a1020', 
                    border: '2px solid var(--border-pixel)',
                    boxShadow: 'inset 0 2px 0 rgba(0,0,0,0.4)'
                }}>
                    <div style={{ 
                        position: 'absolute', left: 0, height: '100%', 
                        width: `${Math.max(0, Math.min(100, (hScore + 1000) / 20))}%`, 
                        background: 'var(--green)', opacity: 0.6, transition: 'width 0.2s',
                        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)'
                    }} />
                    <div style={{ 
                        position: 'absolute', right: 0, height: '100%', 
                        width: `${Math.max(0, Math.min(100, (aScore + 1000) / 20))}%`, 
                        background: 'var(--blue)', opacity: 0.6, transition: 'width 0.2s',
                        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)'
                    }} />
                </div>

                <div style={{ flex: 1, color: 'var(--blue)', textAlign: 'right' }}>🤖 AI: {aScore}</div>
                <PixelButton label="🚪 EXIT" color="red" onClick={() => setMultiplayer(false)} />
            </div>

            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                {/* Left Side: Human */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '2px solid var(--border-pixel)' }}>
                    <div style={{ 
                        padding: '8px', 
                        textAlign: 'center', 
                        color: 'var(--text)', 
                        fontSize: '7px', 
                        background: 'var(--hud-bg2)', 
                        borderBottom: '2px solid var(--border-pixel)',
                        fontFamily: "'Press Start 2P', monospace"
                    }}>PLAYER VIEW (FOG ON)</div>
                    <div style={{ flex: 1, background: 'linear-gradient(180deg, #4ec5f1 0%, #b0e0f6 100%)', overflow: 'auto' }}>
                        <GameGrid overrideState={humanData.state} overrideFog="full" />
                    </div>
                </div>

                <VSBadge />

                {/* Right Side: AI */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ 
                        padding: '8px', 
                        textAlign: 'center', 
                        color: 'var(--gold)', 
                        fontSize: '7px', 
                        background: 'var(--hud-bg2)', 
                        borderBottom: '2px solid var(--border-pixel)',
                        fontFamily: "'Press Start 2P', monospace"
                    }}>AI ANALYSIS (REVEALED)</div>
                    <div style={{ flex: 1, background: 'linear-gradient(180deg, #4ec5f1 0%, #b0e0f6 100%)', overflow: 'auto' }}>
                        <GameGrid overrideState={aiData.state} overrideKb={aiData.kb} overrideFog="off" />
                    </div>
                </div>

                {/* Victory/Defeat Overlay */}
                {winner && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', zIndex: 100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column',
                        fontFamily: "'Press Start 2P', monospace",
                        gap: '24px'
                    }}>
                        {/* Confetti particles */}
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                width: '10px', height: '10px',
                                backgroundColor: ['#ff4466', '#22cc44', '#4488ff', '#ffd700', '#ff8844'][Math.floor(Math.random() * 5)],
                                left: `${Math.random() * 100}%`,
                                top: `-5%`,
                                animation: `confettiFall ${1.5 + Math.random() * 2.5}s linear forwards`,
                                animationDelay: `${Math.random() * 0.5}s`,
                                boxShadow: '2px 2px 0 rgba(0,0,0,0.3)'
                            }} />
                        ))}
                        
                        <div style={{ fontSize: '48px', animation: 'chestBounce 1s ease-in-out infinite' }}>
                            {winner === 'YOU' ? '🏆' : (winner === 'AI' ? '👾' : '🤝')}
                        </div>

                        <h1 style={{ 
                            color: winner === 'YOU' ? 'var(--green)' : (winner === 'AI' ? 'var(--blue)' : 'var(--text)'), 
                            textShadow: '4px 4px 0 #000',
                            fontSize: '24px',
                            textAlign: 'center',
                            lineHeight: 1.5
                        }}>
                            {winner === 'YOU' ? 'VICTORY!' : (winner === 'AI' ? 'AI WINS!' : 'DRAW!')}
                        </h1>

                        <PixelButton label="▶ PLAY AGAIN" color="gold" onClick={() => {
                            setAiRunning(false); setWinner(null);
                            setMultiplayer(false); setTimeout(() => setMultiplayer(true), 100);
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
}
