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
                        if (!winner) setWinner(humanWon ? 'HUMAN' : 'DRAW');
                    }
                } catch (e) { }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [humanData?.session, winner]);

    if (!humanData || !aiData) return <div style={{ color: 'var(--gold)', padding: '16px' }}>LOADING DUAL SESSIONS...</div>;

    const hScore = humanData.state.agent.score;
    const aScore = aiData.state.agent.score;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <div style={{ display: 'flex', padding: '8px', borderBottom: '2px solid var(--border)', background: 'var(--panel2)', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, color: 'var(--green)', fontSize: '8px' }}>HUMAN: {hScore}</div>
                <div style={{ flex: 2, position: 'relative', height: '16px', background: '#1a1a2e', border: '1px solid #fff' }}>
                    <div style={{ position: 'absolute', left: 0, height: '100%', width: `${Math.max(0, Math.min(100, (hScore + 1000) / 20))}%`, background: 'var(--green)', opacity: 0.5, transition: 'width 0.2s' }} />
                    <div style={{ position: 'absolute', right: 0, height: '100%', width: `${Math.max(0, Math.min(100, (aScore + 1000) / 20))}%`, background: 'var(--blue)', opacity: 0.5, transition: 'width 0.2s' }} />
                </div>
                <div style={{ flex: 1, color: 'var(--blue)', fontSize: '8px', textAlign: 'right' }}>AI: {aScore}</div>
                <PixelButton label="EXIT VS" color="red" onClick={() => setMultiplayer(false)} />
            </div>

            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '8px', textAlign: 'center', color: 'var(--gold)', fontSize: '8px', background: 'var(--panel)', borderBottom: '2px solid var(--border)' }}>HUMAN (FOG ON)</div>
                    <GameGrid overrideState={humanData.state} overrideFog="full" />
                </div>
                <VSBadge />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '8px', textAlign: 'center', color: 'var(--gold)', fontSize: '8px', background: 'var(--panel)', borderBottom: '2px solid var(--border)' }}>KB AGENT (BRAIN VIS)</div>
                    <GameGrid overrideState={aiData.state} overrideKb={aiData.kb} overrideFog="off" />
                </div>

                {winner && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', zIndex: 50,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column'
                    }}>
                        {Array.from({ length: 30 }).map((_, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                width: '8px', height: '8px',
                                backgroundColor: ['#f00', '#0f0', '#00f', '#ff0', '#0ff'][Math.floor(Math.random() * 5)],
                                left: `${Math.random() * 100}%`,
                                top: `-10%`,
                                animation: `confettiFall ${1 + Math.random() * 2}s linear forwards`,
                                animationDelay: `${Math.random()}s`
                            }} />
                        ))}
                        <h1 style={{ color: winner === 'HUMAN' ? 'var(--green)' : 'var(--blue)', textShadow: '4px 4px 0 #000' }}>
                            {winner} WINS!
                        </h1>
                        <PixelButton label="PLAY AGAIN" color="gold" onClick={() => {
                            setAiRunning(false); setWinner(null);
                            setMultiplayer(false); setTimeout(() => setMultiplayer(true), 100);
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
}
