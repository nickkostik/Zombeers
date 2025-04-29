import { generateId, formatTime } from './utils.js';
import * as State from './state.js';
import * as Timer from './timer.js';
import * as UI from './ui.js'; // Import UI module

// --- Game Actions ---

function addPlayer() {
    console.log("addPlayer function called"); // <-- Add log here
    const name = UI.playerNameInput.value.trim();
    const players = State.getGameState().players;

    if (name && players.length < 10) { // Limit players
         if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
             alert("Player name already exists!");
             return;
         }
        const newPlayer = {
            id: generateId(),
            name: name,
            points: 0,
            beers: 0,
            shots: 0
        };
        State.addPlayerToState(newPlayer);
        UI.updateSetupPlayerList(State.getGameState().players); // Update UI
        UI.playerNameInput.value = '';
        UI.playerNameInput.focus();
    } else if (name === "") {
         alert("Please enter a player name.");
     } else {
         alert("Maximum number of players reached (10).");
     }
    console.log("addPlayer function finished. Current players:", State.getGameState().players); // <-- Add log here
}

function removePlayer(id) {
     State.removePlayerFromState(id);
     UI.updateSetupPlayerList(State.getGameState().players); // Update UI
}

function startGame() {
    const { players } = State.getGameState();
    if (players.length === 0) {
        alert("Add at least one player to start!");
        return;
    }
    State.resetHistory(); // Clear history for new game session
    State.setGameActive(true, Date.now()); // Mark active and set start time
    Timer.startTimer(); // Start the timer
    updateAllGameDisplays(); // Initial render of game screen elements
    UI.showScreen(UI.gameScreen);
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

    let pointsChange = 0;
    let logMessage = '';
    let animationType = null;
    let playerUpdates = {}; // Collect updates for the player

    const settings = state.settings; // Use settings from state

    switch (action) {
        case 'beer':
            playerUpdates = { beers: player.beers + 1, points: player.points + settings.pointsPerBeer };
            pointsChange = settings.pointsPerBeer;
            logMessage = `${player.name} drank a beer! (+${pointsChange.toLocaleString()} pts)`;
            animationType = 'increase';
            break;
        case 'shot':
            if (player.shots < settings.shotLimit) {
                playerUpdates = { shots: player.shots + 1, points: player.points + settings.pointsPerShot };
                pointsChange = settings.pointsPerShot;
                logMessage = `${player.name} took a shot! (+${pointsChange.toLocaleString()} pts) (${playerUpdates.shots}/${settings.shotLimit})`;
                animationType = 'increase';
            } else {
                alert(`${player.name} has reached the shot limit!`);
                return; // Do nothing if limit reached
            }
            break;
        case 'revive':
             playerUpdates = { points: player.points + settings.pointsPerRevive };
            pointsChange = settings.pointsPerRevive;
            logMessage = `${player.name} got a revive! (+${pointsChange.toLocaleString()} pts)`;
            animationType = 'increase';
            break;
        case 'redeem':
            if (player.points >= settings.redemptionCost) {
                playerUpdates = { points: player.points - settings.redemptionCost };
                pointsChange = -settings.redemptionCost; // Negative change
                logMessage = `${player.name} redeemed points! (${pointsChange.toLocaleString()} pts)`;
                animationType = 'decrease';
            } else {
                alert(`${player.name} doesn't have enough points to redeem!`);
                return; // Do nothing if not enough points
            }
            break;
        default:
            console.warn("Unknown player action:", action);
            return; // Unknown action
    }

    // Update player state
    const updatedPlayer = State.updatePlayerInState(playerId, playerUpdates);

    // Log the action
    addLogEntry(player, action, pointsChange, logMessage);

    // Update UI
    if (updatedPlayer) {
        UI.updatePlayerCard(playerId, updatedPlayer, settings); // Update specific card efficiently
        UI.updateGameStats(state.players, state.history, settings); // Update overall stats
        UI.renderLeaderboard(state.players); // Leaderboard might change
        if (animationType) {
             UI.applyPointAnimation(playerId, animationType);
        }
    }
}


function resetGame() {
    if (confirm("Are you sure you want to reset the current game? All progress for this session and player list will be lost.")) {
        Timer.resetTimer(); // Stops timer and resets start time in state
        State.resetFullState(); // Resets players, history, active status etc.
        UI.updateSetupPlayerList(State.getGameState().players); // Clear setup list UI
        UI.showScreen(UI.setupScreen); // Show setup
        console.log("Game Reset Confirmed.");
    }
}

function handleNewGame() {
     const state = State.getGameState();
    if (!state.gameActive) {
        alert("No active game to end.");
        // Optionally just go to setup screen if desired
        UI.showScreen(UI.setupScreen);
        return;
    }

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
    UI.updateAllGameDisplays(); // Clear game screen stats etc.
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
    State.updateSettings(newSettings);
    UI.closeOptionsModal(); // Close modal
    updateAllGameDisplays(); // Update UI elements reflecting new settings
    alert("Settings saved!");
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
   // Setup Screen
   console.log("Setting up listener for addPlayerBtn:", UI.addPlayerBtn); // <-- Add log here
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

// --- Initialization ---
function initializeApp() {
    console.log("Initializing Zombeers App...");
    UI.initUI(); // Initialize UI elements after DOM is ready
    console.log("Initializing Zombeers App...");
    // State is loaded automatically when state.js module is imported
    const state = State.getGameState();
    console.log("Initial State:", state);

    UI.applySettingsToInputs(state.settings); // Apply loaded/default settings to inputs

    if (state.gameActive && state.startTime) {
        // Resume active game
        console.log("Resuming active game session.");
        UI.showScreen(UI.gameScreen);
        Timer.startTimer(); // Restart timer based on saved start time
        updateAllGameDisplays(); // Render everything based on loaded state
    } else {
        // No active game found or load failed, show setup
        console.log("Showing setup screen.");
         // Ensure game state is not active if startTime is missing
         if (state.gameActive) {
             State.setGameActive(false, null);
         }
        UI.updateSetupPlayerList(state.players); // Update setup list if players were loaded
        UI.showScreen(UI.setupScreen);
        updateAllGameDisplays(); // Ensure game screen elements are cleared/updated if needed
    }

    setupEventListeners(); // Setup all event listeners after initial render
    console.log("App Initialized.");
}

// --- Run Initialization on Load ---
// Use DOMContentLoaded to ensure HTML is parsed before selecting elements
document.addEventListener('DOMContentLoaded', initializeApp);