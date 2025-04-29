const STORAGE_KEY = 'zombeersGameState';

// Default settings structure
const defaultSettings = {
    pointsPerBeer: 2500,
    pointsPerShot: 1000,
    pointsPerRevive: 500,
    redemptionCost: 500,
    shotLimit: 3
};

// Initial game state structure
let gameState = {
    gameActive: false,
    players: [], // { id: string, name: string, points: number, beers: number, shots: number }
    settings: { ...defaultSettings }, // Clone defaults
    startTime: null, // Use null instead of Date.now() initially
    history: [], // { timestamp: number, player: string, action: string, change: number, message: string }
    lastGameStats: null
};

export function getGameState() {
    // Return a deep copy to prevent direct mutation elsewhere?
    // For simplicity now, returning direct reference. Be mindful.
    return gameState;
}

export function updateGameState(newState) {
    // Allow partial updates
    gameState = { ...gameState, ...newState };
    saveState();
}

export function updateSettings(newSettings) {
    gameState.settings = { ...gameState.settings, ...newSettings };
    saveState();
}

export function addPlayerToState(player) {
    gameState.players.push(player);
    saveState();
}

export function removePlayerFromState(playerId) {
    gameState.players = gameState.players.filter(p => p.id !== playerId);
    saveState();
}

export function updatePlayerInState(playerId, updates) {
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
        gameState.players[playerIndex] = { ...gameState.players[playerIndex], ...updates };
        saveState();
        return gameState.players[playerIndex]; // Return updated player
    }
    return null;
}

export function addHistoryEntry(entry) {
     gameState.history.push(entry);
     // Keep history log manageable (e.g., last 100 entries)
    if (gameState.history.length > 100) {
        gameState.history.shift(); // Remove oldest entry
    }
    saveState(); // Save state when history is updated
}

export function resetHistory() {
    gameState.history = [];
    saveState();
}

export function setGameActive(isActive, startTime = null) {
    gameState.gameActive = isActive;
    gameState.startTime = startTime;
    saveState();
}

export function setLastGameStats(stats) {
    gameState.lastGameStats = stats;
    // No need to save this to localStorage usually, it's transient
}

export function saveState() {
    try {
        // Only save relevant parts, exclude transient data like lastGameStats
        const stateToSave = {
            gameActive: gameState.gameActive,
            players: gameState.players,
            settings: gameState.settings,
            startTime: gameState.startTime,
            history: gameState.history,
            // Explicitly exclude lastGameStats
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
        console.error("Error saving game state:", e);
        alert("Could not save game state. Local storage might be full or disabled.");
    }
}

export function loadState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            // Merge saved state with defaults carefully
            gameState = {
                // Start with current structure/defaults
                gameActive: false,
                players: [],
                settings: { ...defaultSettings },
                startTime: null,
                history: [],
                lastGameStats: null, // Ensure it's reset on load
                // Overwrite with saved data
                ...parsedState,
                // Ensure nested objects like settings merge correctly
                settings: {
                    ...defaultSettings, // Start with defaults
                    ...(parsedState.settings || {}) // Merge saved settings
                },
                // Ensure arrays are arrays
                players: parsedState.players || [],
                history: parsedState.history || []
            };
            console.log("Game state loaded:", gameState);
            return true;
        } catch (e) {
            console.error("Error loading game state:", e);
            localStorage.removeItem(STORAGE_KEY); // Clear corrupted state
            // Reset to default state
            gameState = {
                gameActive: false,
                players: [],
                settings: { ...defaultSettings },
                startTime: null,
                history: [],
                lastGameStats: null,
            };
            return false;
        }
    }
     console.log("No saved state found, using defaults.");
    return false; // No state loaded
}

export function resetFullState() {
     // Reset to initial state but keep settings potentially?
     // Or full reset:
     gameState = {
        gameActive: false,
        players: [],
        settings: { ...gameState.settings }, // Keep current settings
        startTime: null,
        history: [],
        lastGameStats: null,
     };
     localStorage.removeItem(STORAGE_KEY); // Clear storage
     console.log("Game state reset.");
     // Note: Caller should handle UI updates
}

// Initialize by trying to load state immediately when module loads
loadState();