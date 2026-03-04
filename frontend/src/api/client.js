const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8765';

export async function newGame(difficulty, seed) {
    const res = await fetch(`${BASE}/api/game/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, seed })
    });
    return res.json();
}

export async function stepGame(sessionId, action) {
    const res = await fetch(`${BASE}/api/game/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action })
    });
    return res.json();
}

export async function resetGame(sessionId, seed) {
    const res = await fetch(`${BASE}/api/game/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, seed })
    });
    return res.json();
}

export async function getHistory(sessionId) {
    const res = await fetch(`${BASE}/api/game/history?session_id=${sessionId}`);
    return res.json();
}

export async function kbStep(sessionId) {
    const res = await fetch(`${BASE}/api/agent/kb/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
    });
    return res.json();
}

export async function rlStep(sessionId) {
    const res = await fetch(`${BASE}/api/agent/rl/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
    });
    return res.json();
}

export async function trainRL(difficulty, config) {
    const res = await fetch(`${BASE}/api/agent/rl/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, ...config })
    });
    return res.json();
}

export async function getRLSnapshot(direction, hasGold, arrows) {
    const query = new URLSearchParams({ direction, has_gold: hasGold, arrows });
    const res = await fetch(`${BASE}/api/agent/rl/snapshot?${query.toString()}`);
    return res.json();
}

export async function runBenchmark(difficulty, config) {
    const res = await fetch(`${BASE}/api/bench/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, ...config })
    });
    return res.json();
}

export async function previewWorld(difficulty, seed) {
    const query = new URLSearchParams({ difficulty });
    if (seed) query.set('seed', seed);
    const res = await fetch(`${BASE}/api/world/generate?${query.toString()}`);
    return res.json();
}
