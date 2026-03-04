import { create } from 'zustand';

export const useMetricsStore = create((set, get) => ({
    isTraining: false,
    trainProgress: 0,
    learningCurve: [],
    rlSummary: null,
    qHeatmap: [],
    isBenchmarking: false,
    benchReport: null,
    sessionHistory: [],

    startTraining: (config) => set({ isTraining: true, trainProgress: 0 }),
    setTrainingData: (curve, summary) => set({
        learningCurve: curve, rlSummary: summary, isTraining: false
    }),
    setQHeatmap: (heatmap) => set({ qHeatmap: heatmap }),
    runBenchmark: (config) => set({ isBenchmarking: true }),
    setBenchmarkData: (report) => set({
        benchReport: report, isBenchmarking: false
    }),
    recordEpisode: (result) => set((state) => ({
        sessionHistory: [...state.sessionHistory, result]
    }))
}));
