import { io } from "socket.io-client"; // Import io from the installed package
import { formatTime } from './utils.js';
import * as State from './state.js';
import * as Timer from './timer.js';
import * as UI from './ui.js'; // Import UI module (includes showNotification)

// --- Socket.io Connection ---
// --- IMPORTANT: Set this to your deployed backend server URL ---
const BACKEND_URL = window.location.origin; // Connect to the same origin the page was loaded from
// Connect to the specific backend server
const socket = io(BACKEND_URL, {
    // Optional: Add transports if needed, though defaults usually work
    // transports: ['websocket', 'polling']
});

// --- Room Management ---

function createRoom() {
    UI.roomErrorMessage.textContent = ''; // Clear any previous errors
    
    socket.emit('createRoom', (response) => {
        if (response && response.roomCode) {
            console.log('Room created:', response.roomCode);
            // Store room code in state
            State.setRoomCode(response.roomCode);
            // Update room info display
            UI.roomInfoBar.textContent = `Room: ${response.roomCode}`;
            // Move to setup screen
            UI.showScreen(UI.setupScreen);
        } else {
            UI.roomErrorMessage.textContent = 'Failed to create room. Please try again.';
        }
    });
}

function joinRoom() {
    UI.roomErrorMessage.textContent = ''; // Clear any previous errors
    const roomCode = UI.roomCodeInput.value.trim().toUpperCase();
    
    if (!roomCode || roomCode.length !== 4) {
        UI.roomErrorMessage.textContent = 'Please enter a valid 4-character room code.';
        return;
    }
    
    socket.emit('joinRoom', roomCode, (response) => {
        if (response.success) {
            console.log('Joined room:', response.roomCode);
            // Store room code in state
            State.setRoomCode(response.roomCode);
            // Update room info display
            UI.roomInfoBar.textContent = `Room: ${response.roomCode}`;
            // Update state with server state
            State.updateGameState(response.state);
            // Update UI based on received state
            UI.updateSetupPlayerList(response.state.players);
            // Move to setup screen
            UI.showScreen(UI.setupScreen);
        } else {
            UI.roomErrorMessage.textContent = response.message || 'Failed to join room. Please check the code and try again.';
        }
    });
}

function leaveRoom() {
    if (confirm("Are you sure you want to leave this room? You'll return to the room selection screen.")) {
        // Reset state but keep settings
        State.resetFullState();
        // Clear room code
        State.setRoomCode(null);
        // Clear room info display
        UI.roomInfoBar.textContent = '';
        // Reset UI
        UI.updateSetupPlayerList([]);
        UI.playerNameInput.value = '';
        // Show room selection screen
        UI.showScreen(UI.roomSelectionScreen);
    }
}

// --- Game Actions ---

function addPlayer() {
    console.log("addPlayer function called"); // <-- Add log here
    const name = UI.playerNameInput.value.trim();
    const players = State.getGameState().players;

    if (name && players.length < 10) { // Limit players
         if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
             UI.showNotification("Player name already exists!", 'error');
             return;
         }
        // ID is generated server-side now
        const roomCode = State.getGameState().roomCode;
        if (roomCode) {
            socket.emit('addPlayer', { roomCode, name });
        }
        // No local fallback - server is the source of truth
        
        UI.playerNameInput.value = '';
        UI.playerNameInput.focus();
    } else if (name === "") {
         UI.showNotification("Please enter a player name.", 'error');
     } else {
         UI.showNotification("Maximum number of players reached (10).", 'error');
     }
    console.log("addPlayer function finished. Current players:", State.getGameState().players); // <-- Add log here
}

function removePlayer(id) {
    const roomCode = State.getGameState().roomCode;
    if (roomCode) {
        socket.emit('removePlayer', { roomCode, playerId: id });
    }
    // No local fallback
}

function startGame() {
    const state = State.getGameState();
    const { players, roomCode } = state;
    
    if (players.length === 0) {
        UI.showNotification("Add at least one player to start!", 'error');
        return;
    }
    
    if (roomCode) {
        socket.emit('startGame', { roomCode });
    }
    // No local fallback
    
    console.log("Game started!");
}

function addLogEntry(player, action, change, message) {
    const entry = {
        timestamp: Date.now(),
        player: player ? player.name : 'System',
        action: action,
        change: change, // Store the actual point change
        message: message
    };
    State.addHistoryEntry(entry);
    UI.renderHistoryLog(State.getGameState().history); // Update log immediately
}


function handlePlayerAction(playerId, action) {
    const state = State.getGameState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const roomCode = state.roomCode;
    
    if (roomCode) {
        // Send action to server
        // Send action to server, including the new reset-score action
        socket.emit('playerAction', { roomCode, playerId, action });
    }
    // No local fallback - Server handles state changes and broadcasts updates
    // Note: The server (server.js) will need to be updated to handle the 'reset-score' action.
}


function resetGame() {
    if (confirm("Are you sure you want to reset the current game? All progress for this session will be lost, but players will remain.")) {
        const roomCode = State.getGameState().roomCode;
        
        if (roomCode) {
            socket.emit('resetGame', { roomCode });
        }
        // No local fallback - Server handles reset and broadcasts state/screen change
        
        console.log("Game Reset Confirmed.");
    }
}

function handleNewGame() {
    const state = State.getGameState();
    const roomCode = state.roomCode;
    
    if (!state.gameActive) {
        UI.showNotification("No active game to end.", 'info');
        // Optionally just go to setup screen if desired
        UI.showScreen(UI.setupScreen);
        return;
    }
    
    if (roomCode) {
        socket.emit('newGameSetup', { roomCode });
    }
    // No local fallback - Server handles this flow
    // Note: showEndGameModal was part of the local fallback and is now effectively unused unless triggered differently.
}

function showEndGameModal() {
    const state = State.getGameState();
    Timer.stopTimer(); // Stop the timer first

    // 1. Prepare last game stats
    const finalStats = {
        duration: formatTime(Date.now() - state.startTime),
        players: [...state.players].sort((a, b) => b.points - a.points).map(p => ({
            name: p.name,
            points: p.points,
            beers: p.beers,
            shots: p.shots
        })),
        // Recalculate totals directly for accuracy
        totalPointsEarned: state.history.reduce((sum, entry) => sum + (entry.change > 0 && entry.action !== 'redeem' ? Number(entry.change) || 0 : 0), 0),
        totalPointsSpent: state.history.reduce((sum, entry) => sum + (entry.action === 'redeem' && entry.change < 0 ? Math.abs(Number(entry.change) || 0) : 0), 0),
        totalBeers: state.players.reduce((sum, p) => sum + p.beers, 0),
        totalShots: state.players.reduce((sum, p) => sum + p.shots, 0),
        totalRevives: state.history.filter(entry => entry.action === 'revive').length,
    };
    State.setLastGameStats(finalStats); // Store transiently (not saved to localStorage)

    // 2. Populate and show the end-game modal
    UI.populateEndGameModal(finalStats, state.players);
    UI.showEndGameModal();

    // 3. Current game state is paused here until modal confirmation
    console.log("Game ended. Showing summary modal.");
}

function startFreshGame() {
    const winnerId = UI.challengeWinnerSelect.value;
    if (winnerId !== 'none') {
        const winner = State.getGameState().players.find(p => p.id === winnerId);
        // TODO: Log this persistently or display history across games?
        console.log(`Challenge completed by: ${winner ? winner.name : 'Unknown'}`);
        // Example: Add to a separate log or stats object not cleared on reset
    }

     // Reset state for a truly new game (like reset but keeps settings)
    Timer.resetTimer();
    State.resetFullState(); // Resets players, history, active status etc.

    // Update UI to reflect the reset state
    UI.updateSetupPlayerList(State.getGameState().players);
    updateAllGameDisplays(); // Clear game screen stats etc. (Function is local to main.js)
    UI.showScreen(UI.setupScreen); // Go back to setup

    console.log("Starting fresh game setup.");
}

// --- Settings ---
function saveSettings() {
    const newSettings = {
        pointsPerBeer: parseInt(UI.settingPointsBeer.value) || 0,
        pointsPerShot: parseInt(UI.settingPointsShot.value) || 0,
        pointsPerRevive: parseInt(UI.settingPointsRevive.value) || 0,
        redemptionCost: parseInt(UI.settingCostRedeem.value) || 0,
        shotLimit: parseInt(UI.settingShotLimit.value) || 0
    };
    
    const roomCode = State.getGameState().roomCode;
    
    if (roomCode) {
        socket.emit('updateSettings', { roomCode, newSettings });
    }
    // No local fallback - Server handles settings updates
    
    UI.closeOptionsModal(); // Close modal
    UI.showNotification("Settings saved!", 'success');
    console.log("Settings updated:", newSettings);
}


// --- Helper to Update All Game Related Displays ---
function updateAllGameDisplays() {
    const state = State.getGameState();
    UI.renderPlayerCards(state.players, state.settings);
    UI.updateGameStats(state.players, state.history, state.settings);
    UI.renderHistoryLog(state.history);
    UI.renderLeaderboard(state.players);
     // Update timer display based on current state
     const elapsed = state.gameActive && state.startTime ? Date.now() - state.startTime : 0;
     UI.updateTimerDisplay(formatTime(elapsed));
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    // Room Selection Screen
    UI.createRoomBtn.addEventListener('click', createRoom);
    UI.joinRoomBtn.addEventListener('click', joinRoom);
    UI.roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoom();
        }
    });
    
    // Setup Screen
    console.log("Setting up listener for addPlayerBtn:", UI.addPlayerBtn);
    UI.addPlayerBtn.addEventListener('click', addPlayer);
    UI.playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPlayer();
        }
    });
    UI.playerListSetup.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-player-btn')) {
            removePlayer(e.target.dataset.id);
        }
    });
    UI.startGameBtn.addEventListener('click', startGame);
    UI.leaveRoomBtn.addEventListener('click', leaveRoom);

    // Game Screen - Player Actions (Event Delegation)
    UI.playersContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]'); // Find closest action button
        if (button) {
            const card = button.closest('.player-card');
            if (card) {
                const playerId = card.dataset.playerId;
                const action = button.dataset.action;
                handlePlayerAction(playerId, action);
            }
        }
    });

    // Game Screen - Header Buttons
    UI.optionsBtn.addEventListener('click', UI.showOptionsModal);
    UI.resetGameBtn.addEventListener('click', resetGame);
    UI.newGameBtn.addEventListener('click', handleNewGame);
    UI.leaveRoomBtnGame.addEventListener('click', leaveRoom);

    // Options Modal
    UI.optionsDialog.addEventListener('close', () => {
        // The 'close' event fires when the dialog is closed by ESC or close button/form submit
        console.log("Options dialog closed. Result:", UI.optionsDialog.returnValue);
         // Re-apply potentially unchanged settings if cancelled
         if (UI.optionsDialog.returnValue !== 'saved') { // Check if saved explicitly
             UI.applySettingsToInputs(State.getGameState().settings);
         }
    });
    UI.closeOptionsBtn.addEventListener('click', () => {
         UI.optionsDialog.returnValue = 'closed'; // Set return value
         UI.closeOptionsModal();
     });
     UI.cancelOptionsBtn.addEventListener('click', () => {
          UI.optionsDialog.returnValue = 'cancelled'; // Set return value
          UI.closeOptionsModal();
     });
    UI.optionsForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default form submission
         UI.optionsDialog.returnValue = 'saved'; // Set return value for close event
        saveSettings(); // Save settings function handles closing
    });


    // End Game Modal
    UI.endGameDialog.addEventListener('close', () => {
         console.log("End game dialog closed.");
         // If closed via ESC or close button, don't automatically start fresh
    });
    UI.closeEndGameBtn.addEventListener('click', UI.closeEndGameModal);
    UI.confirmNewGameBtn.addEventListener('click', () => {
        UI.closeEndGameModal(); // Hide modal first
        startFreshGame(); // Then process and start fresh
    });

     // Handle ESC key closing for modals (default <dialog> behavior)
     // No specific listener needed unless overriding default close behavior.
}
// --- Socket Event Listeners ---
function setupSocketListeners() {
    socket.on('gameStateUpdate', (newState) => {
        console.log('Received game state update:', newState);
        State.updateGameState(newState);
        
        // Update UI based on new state
        if (newState.gameActive) {
            updateAllGameDisplays();
            // If we're not already on the game screen, show it
            if (!UI.gameScreen.classList.contains('active')) {
                UI.showScreen(UI.gameScreen);
                Timer.startTimer(); // Start timer if game is active
            }
        } else {
            UI.updateSetupPlayerList(newState.players);
        }
    });
    
    socket.on('showScreen', (screenName) => {
        console.log('Received instruction to show screen:', screenName);
        if (screenName === 'setup') {
            UI.showScreen(UI.setupScreen);
            Timer.stopTimer();
        } else if (screenName === 'game') {
            UI.showScreen(UI.gameScreen);
            Timer.startTimer();
        }
    });
    
    socket.on('actionError', (data) => {
        UI.showNotification(data.message, 'error');
    });
    
    socket.on('actionFeedback', (data) => {
        const { playerId, action } = data;
        // Apply animations or other feedback
        if (action === 'beer' || action === 'shot' || action === 'revive') {
            UI.applyPointAnimation(playerId, 'increase');
        } else if (action === 'redeem') {
            UI.applyPointAnimation(playerId, 'decrease');
        }
    });
    
    socket.on('playerJoined', (socketId) => {
        console.log('Player joined the room:', socketId);
        // Could show a notification or update player list
    });
    
    socket.on('playerLeft', (socketId) => {
        console.log('Player left the room:', socketId);
        // Could show a notification or update player list
    });
    
    socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        // Could show a reconnection message
    });
}

// --- Initialization ---
function initializeApp() {
    console.log("Initializing Zombeers App...");
    UI.initUI(); // Initialize UI elements after DOM is ready
    
    // State is loaded automatically when state.js module is imported
    const state = State.getGameState();
    console.log("Initial State:", state);

    UI.applySettingsToInputs(state.settings); // Apply loaded/default settings to inputs
    
    // Setup socket event listeners
    setupSocketListeners();

    // Check if we have a room code
    if (state.roomCode) {
        UI.roomInfoBar.textContent = `Room: ${state.roomCode}`;
        
        // Request latest state from server
        socket.emit('requestState', state.roomCode, (response) => {
            if (response.success) {
                State.updateGameState(response.state);
                
                if (response.state.gameActive) {
                    // Resume active game
                    console.log("Resuming active game session.");
                    UI.showScreen(UI.gameScreen);
                    Timer.startTimer(); // Restart timer based on saved start time
                    updateAllGameDisplays(); // Render everything based on loaded state
                } else {
                    // Show setup screen within room
                    console.log("Showing setup screen within room.");
                    UI.updateSetupPlayerList(response.state.players);
                    UI.showScreen(UI.setupScreen);
                }
            } else {
                console.log("Failed to get room state:", response.message);
                // Room might no longer exist, go back to room selection
                State.setRoomCode(null);
                UI.roomInfoBar.textContent = '';
                UI.showScreen(UI.roomSelectionScreen);
            }
        });
    } else if (state.gameActive && state.startTime) {
        // Resume active game (local mode)
        console.log("Resuming active game session (local mode).");
        UI.showScreen(UI.gameScreen);
        Timer.startTimer(); // Restart timer based on saved start time
        updateAllGameDisplays(); // Render everything based on loaded state
    } else {
        // No active game or room, show room selection
        console.log("Showing room selection screen.");
        // Ensure game state is not active if startTime is missing
        if (state.gameActive) {
            State.setGameActive(false, null);
        }
        UI.showScreen(UI.roomSelectionScreen);
        updateAllGameDisplays(); // Ensure game screen elements are cleared/updated if needed
    }

    console.log("About to call setupEventListeners..."); // <-- Add log
    setupEventListeners(); // Setup all event listeners after initial render
    console.log("App Initialized.");
    }


// --- Run Initialization on Load ---
// Use DOMContentLoaded to ensure HTML is parsed before selecting elements
document.addEventListener('DOMContentLoaded', initializeApp);