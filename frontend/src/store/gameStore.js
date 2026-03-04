import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
    sessionId: null,
    difficulty: 'medium',
    agentType: 'human', // "human" | "kb" | "rl" | "random"
    fogMode: 'full', // "full" | "adjacent" | "memory" | "off"
    seed: null,
    worldState: null,
    percept: null,
    kbSnapshot: null,
    isRunning: false,
    speed: 400,
    multiplayerMode: false,
    humanSession: null,
    aiSession: null,

    startGame: (sessionId, state, percept, seed) => set({
        sessionId, worldState: state, percept, seed, isRunning: false, kbSnapshot: null
    }),
    resetGame: (state, percept, seed) => set({
        worldState: state, percept, seed, kbSnapshot: null, isRunning: false
    }),
    stepOnce: (state, percept, kbSnapshot = null) => set((s) => ({
        worldState: state,
        percept,
        kbSnapshot: kbSnapshot || s.kbSnapshot
    })),
    setDifficulty: (difficulty) => set({ difficulty }),
    setAgent: (agentType) => set({ agentType, isRunning: false }),
    setFog: (fogMode) => set({ fogMode }),
    toggleAutoRun: () => set((state) => ({ isRunning: !state.isRunning })),
    setSpeed: (speed) => set({ speed }),
    setMultiplayer: (enabled) => set({ multiplayerMode: enabled }),
    setHumanSession: (id) => set({ humanSession: id }),
    setAiSession: (id) => set({ aiSession: id })
}));
