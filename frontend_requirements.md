# Wumpus World AI — Frontend Requirements & Specifications

This document outlines the functional and structural requirements for the Wumpus World frontend application. The purpose is to provide a comprehensive specification for a UI/UX team or frontend developer to build the client from scratch, completely independent of any specific visual theme.

## 1. Project Overview
Wumpus World is a grid-based puzzle/survival game. The player (or AI agent) must navigate a dangerous cave system to find gold, avoid bottomless pits, kill or avoid the Wumpus monster, and safely climb out of the starting tile.

The backend (Python API) handles all game logic, world generation, and AI agent intelligence. The frontend acts exclusively as a visualizer, state manager, and user input handler.

## 2. Core Features Required

### 2.1 Game Modes
*   **Human Playable**: The user can manually control the character using keyboard inputs (Move, Turn, Grab, Shoot, Climb).
*   **AI Auto-Run**: The user can watch three distinct AI agents play the game automatically at adjustable speeds.
    *   **Knowledge-Based (KB) Agent**: Uses propositional logic to deduce safe paths.
    *   **Reinforcement Learning (RL) Agent**: Uses a pre-trained Q-table to find optimal paths.
    *   **Random Agent**: Baseline random movement.
*   **Multiplayer / VS Mode**: A split-screen mode where a human player races against the KB Agent on the exact same procedurally generated level.

### 2.2 Game Mechanics Controls
*   **Seed Control**: Ability to enter a specific integer seed to generate a deterministic world. Needs a preview mechanism before starting.
*   **Difficulty Selector**: Dropdown or buttons to choose grid dimensions/obstacle density (Easy = 4x4, Medium = 6x6, Hard = 8x8, Expert = 10x10).
*   **Fog of War**: Visibility toggles.
    *   `Full`: Only the current tile is fully visible.
    *   `Adjacent`: The current tile and immediate N/S/E/W neighbors are visible.
    *   `Memory`: Tiles remain visible once visited.
    *   `Off`: See the entire grid (admin/cheat view).

## 3. Required UI Components & Layout Structure

The UI typically uses a central playing field with peripheral control panels. 

### 3.1 Header / Top Bar
*   **Active Agent Dropdown**: Select between Human, KB, RL, or Random.
*   **Difficulty Dropdown**: Select Easy, Medium, Hard, Expert.
*   **Seed configuration button**: Opens the Seed Browser modal.
*   **Stats Display**: Current Score, current Steps taken, Arrows remaining, and Gold status.
*   **Multiplayer Toggle**: Button to enter/exit VS mode.

### 3.2 The Game Grid
*   A responsive 2D grid that dynamically scales based on difficulty (4x4 to 10x10).
*   **Cell States / Entities to Render**:
    *   `Safe/Visited` vs `Unvisited/Fogged`
    *   `Pit` (Obstacle)
    *   `Wumpus` (Monster)
    *   `Gold` (Objective)
    *   `Player Character` (Must indicate which direction they are currently facing: North, South, East, West).
*   **Percept Indicators**: When a tile is visited, it must display sensory hints (returned dynamically by the backend) if adjacent to dangers:
    *   `Breeze` (indicates a Pit nearby)
    *   `Stench` (indicates the Wumpus nearby)
*   **KB Overlays**: When the KB Agent is running, cells need a way to display standard "Safe", "Danger", or "Known Pit/Wumpus" borders, plus a percentage representing "Probability of Danger".

### 3.3 Right-Side Information Panel
This panel changes based on the currently selected agent.

*   **Global Metrics Module**: Shows aggregate data like Win Rate, Average Score, and Total Episodes played.
*   **Knowledge-Based (KB) Module**:
    *   Requires a scrolling "Inference Log" showing the AI's real-time thought process (e.g., "No breeze at (1,1) -> (1,2) is safe").
*   **Reinforcement Learning (RL) Module**:
    *   Needs a UI to trigger training (inputs for Episode Count, Learning Rate, Discount Factor) and a "Train" button.
    *   Needs a "Show Heatmap" toggle to overlay Q-values (mathematical weights) on the Grid cells so the user can see what the AI learned.

### 3.4 Bottom Control Bar (For AI playback)
*   **Play/Pause Button**: Starts or stops the auto-run loop for AI agents.
*   **Speed Slider**: Adjusts the timeout interval between API calls for the AI stepping (e.g., 50ms to 1000ms delay).
*   **Fog Controls**: Toggles for the different fog states.
*   **Reset Button**: Immediately kills the current session and requests a fresh game board with the same settings.

## 4. Modals and Overlays

*   **Game Over Screen**: An overlay that blocks input when the game concludes (Result: `WIN`, `DEAD_PIT`, `DEAD_WUMPUS`, or `TIMEOUT`). Must display the final score and offer a "Play Again" button.
*   **Event Toasts**: Small, temporary popups that appear for 2-3 seconds when significant events happen mid-game (e.g., "Gold Grabbed" or "Wumpus Slain").
*   **Seed Browser Modal**: A popup where users can type a seed number, click "Preview", see a static miniature version of the generated grid, and then click "Play this World" to load it.

## 5. State Management & API Integration Data Flow

The frontend must maintain state and sync with the Python backend via standardized HTTP endpoints.

*   **Sessions**: Every active game requires keeping track of a `session_id`.
*   **Action Flow**:
    *   Human presses key -> Frontend sends `POST /api/game/step { session_id, action }`.
    *   Backend returns new `state` and new `percept`.
    *   Frontend updates the Grid, Score, and active Percept labels.
*   **AI Auto-Step Flow**:
    *   While "Playing", the frontend runs an interval loop.
    *   On ping, sends `POST /api/agent/kb/step` (or `rl/step`, `random/step`).
    *   Backend responds with the specific action chosen by the AI and the resulting new `state`. Frontend animates/updates visually.
*   **Required Client-Side State**:
    *   Target Polling Speed (for AI loops).
    *   Current UI mode (Single vs Multiplayer).
    *   Raw backend data object: `worldState` (contains cell arrays, sizes, agent position).
    *   `kbSnapshot`: Extended data sent back only during KB steps (contains probabilities and logs).
