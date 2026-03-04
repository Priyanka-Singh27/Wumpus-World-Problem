import React from 'react';
import PixelDropdown from '../ui/PixelDropdown';
import PixelButton from '../ui/PixelButton';
import { useGameStore } from '../../store/gameStore';
import { useMetricsStore } from '../../store/metricsStore';
import { trainRL, getRLSnapshot } from '../../api/client';

export default function BottomBar({ onReset }) {
    const {
        agentType, setAgent,
        difficulty, setDifficulty,
        fogMode, setFog,
        isRunning, toggleAutoRun,
        worldState,
        multiplayerMode, setMultiplayer,
        speed, setSpeed
    } = useGameStore();

    const { startTraining, setTrainingData, setQHeatmap } = useMetricsStore();

    const gameOver = worldState?.result && worldState.result !== 'ONGOING';

    const handleTrain = async () => {
        if (agentType !== 'rl') return;
        startTraining();
        try {
            const res = await trainRL(difficulty, { n_episodes: 100, alpha: 0.2, gamma: 0.95 });
            setTrainingData(res.learning_curve, res.summary);
            const { direction, has_gold, arrows } = worldState.agent;
            const snap = await getRLSnapshot(direction, has_gold, arrows);
            setQHeatmap(snap.q_heatmap);
        } catch (e) {
            console.error(e);
            setTrainingData([], null);
        }
    };

    return (
        <div className="bottom-bar">
            <div style={{ display: 'flex', gap: '16px' }}>
                <PixelDropdown
                    label="AGENT"
                    selected={agentType}
                    onChange={setAgent}
                    options={[
                        { value: 'kb', label: 'KB' },
                        { value: 'rl', label: 'RL' },
                        { value: 'random', label: 'RANDOM' },
                        { value: 'human', label: 'HUMAN' }
                    ]}
                />
                <PixelDropdown
                    label="DIFFICULTY"
                    selected={difficulty}
                    onChange={setDifficulty}
                    options={[
                        { value: 'easy', label: 'EASY' },
                        { value: 'medium', label: 'MED' },
                        { value: 'hard', label: 'HARD' },
                        { value: 'expert', label: 'EXPERT' }
                    ]}
                />
                <PixelDropdown
                    label="FOG"
                    selected={fogMode}
                    onChange={setFog}
                    options={[
                        { value: 'full', label: 'FULL' },
                        { value: 'adjacent', label: 'ADJACENT' },
                        { value: 'memory', label: 'MEMORY' },
                        { value: 'off', label: 'OFF' }
                    ]}
                />
                <PixelDropdown
                    label="SPD"
                    selected={speed}
                    onChange={setSpeed}
                    options={[
                        { value: 1000, label: 'SLOW' },
                        { value: 400, label: 'NORM' },
                        { value: 100, label: 'FAST' },
                        { value: 0, label: 'MAX' }
                    ]}
                />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
                <PixelButton
                    label={isRunning ? '⏸ PAUSE' : '▶ RUN'}
                    color="green"
                    onClick={toggleAutoRun}
                    disabled={agentType === 'human' || gameOver}
                />
                <PixelButton
                    label="↺ RESET"
                    color="navy"
                    onClick={() => onReset ? onReset() : null}
                />
                <PixelButton
                    label="⚡ 100 EPS"
                    color="amber"
                    onClick={handleTrain}
                    disabled={agentType !== 'rl'}
                />
                <PixelButton
                    label={multiplayerMode ? "EXIT VS" : "VS AI"}
                    color="purple"
                    onClick={() => setMultiplayer(!multiplayerMode)}
                />
            </div>
        </div>
    );
}
