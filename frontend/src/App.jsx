import React, { useEffect, useState } from 'react';
import HeaderBar from './components/layout/HeaderBar';
import BottomBar from './components/layout/BottomBar';
import GameGrid from './components/grid/GameGrid';
import RightPanel from './components/layout/RightPanel';
import { useGameStore } from './store/gameStore';
import { newGame } from './api/client';
import { useGame } from './hooks/useGame';
import { useAgent } from './hooks/useAgent';
import { useMetrics } from './hooks/useMetrics';
import { GameOverlay, SeedBrowser, MomentToast } from './components/ui/Overlays';
import MultiplayerLayout from './components/multiplayer/MultiplayerLayout';

function App() {
    const { difficulty, startGame, sessionId, multiplayerMode, worldState } = useGameStore();
    const [showSeedBrowser, setShowSeedBrowser] = useState(false);

    useGame();
    useAgent();
    useMetrics();

    // Auto-start new game on first load
    useEffect(() => {
        if (!sessionId) {
            newGame(difficulty, null).then(res => {
                startGame(res.session_id, res.state, res.percept, res.state.seed);
            }).catch(console.error);
        }
    }, [difficulty, sessionId, startGame]);

    // Reset: start a completely new game
    const handleReset = async (seed = null, diff = null) => {
        try {
            const res = await newGame(diff || difficulty, seed);
            startGame(res.session_id, res.state, res.percept, res.state.seed);
        } catch (e) { console.error(e); }
    };

    const gameResult = worldState?.result;
    const gameOver = gameResult && gameResult !== 'ONGOING';

    return (
        <div className="app-container">
            <HeaderBar onOpenSeedBrowser={() => setShowSeedBrowser(true)} />
            <div className="main-area" style={{ position: 'relative' }}>
                {multiplayerMode ? (
                    <MultiplayerLayout />
                ) : (
                    <>
                        {/* Grid pane — position relative so overlay covers only it */}
                        <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                            <GameGrid />
                            {gameOver && <GameOverlay onReset={() => handleReset()} />}
                        </div>
                        <RightPanel />
                    </>
                )}
            </div>
            <BottomBar onReset={handleReset} />

            {/* Seed browser modal */}
            {showSeedBrowser && (
                <SeedBrowser
                    onClose={() => setShowSeedBrowser(false)}
                    onLoad={(seed, diff) => {
                        setShowSeedBrowser(false);
                        handleReset(seed, diff);
                    }}
                />
            )}

            {/* Moment celebration toast — gold grab / wumpus kill */}
            <MomentToast />
        </div>
    );
}

export default App;
