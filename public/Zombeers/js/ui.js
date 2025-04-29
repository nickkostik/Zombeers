import { $, $$ } from './utils.js';
import { getGameState } from './state.js'; // To access settings, players etc.

// --- DOM Element References ---
// Screens
export let setupScreen;
export let gameScreen;
// Modals (using <dialog>)
export let optionsDialog;
export let endGameDialog;
// Setup Screen Elements
export let playerNameInput;
export let addPlayerBtn;
export let playerListSetup;
export let startGameBtn;
// Game Screen Elements
export let gameTimerDisplay;
export let optionsBtn;
export let resetGameBtn;
export let newGameBtn;
export let playersContainer;
// Game Info Sections
export let totalPointsEarnedDisplay;
export let totalPointsSpentDisplay;
export let totalBeersDisplay;
export let totalShotsDisplay;
export let totalRevivesDisplay;
export let leaderboardList;
export let historyLogList;
// Options Modal Elements
export let closeOptionsBtn;
export let optionsForm;
export let settingPointsBeer;
export let settingPointsShot;
export let settingPointsRevive;
export let settingCostRedeem;
export let settingShotLimit;
export let saveSettingsBtn;
export let cancelOptionsBtn;
// End Game Modal Elements
export let closeEndGameBtn;
export let endGameStatsContainer;
export let challengeWinnerSelect;
export let confirmNewGameBtn;

// Function to initialize UI element references
export function initUI() {
    console.log("Initializing UI elements..."); // Add log for debugging
    setupScreen = $('#setup-screen');
    gameScreen = $('#game-screen');
    optionsDialog = $('#options-panel');
    endGameDialog = $('#end-game-modal');
    playerNameInput = $('#player-name-input');
    addPlayerBtn = $('#add-player-btn');
    playerListSetup = $('#player-list-setup');
    startGameBtn = $('#start-game-btn');
    gameTimerDisplay = $('#game-timer');
    optionsBtn = $('#options-btn');
    resetGameBtn = $('#reset-game-btn');
    newGameBtn = $('#new-game-btn');
    playersContainer = $('#players-container');
    totalPointsEarnedDisplay = $('#total-points-earned');
    totalPointsSpentDisplay = $('#total-points-spent');
    totalBeersDisplay = $('#total-beers');
    totalShotsDisplay = $('#total-shots');
    totalRevivesDisplay = $('#total-revives');
    leaderboardList = $('#leaderboard-list');
    historyLogList = $('#history-log-list');
    closeOptionsBtn = $('#close-options-btn');
    optionsForm = $('#options-form');
    settingPointsBeer = $('#setting-points-beer');
    settingPointsShot = $('#setting-points-shot');
    settingPointsRevive = $('#setting-points-revive');
    settingCostRedeem = $('#setting-cost-redeem');
    settingShotLimit = $('#setting-shot-limit');
    saveSettingsBtn = $('#save-settings-btn');
    cancelOptionsBtn = $('#cancel-options-btn');
    closeEndGameBtn = $('#close-end-game-btn');
    endGameStatsContainer = $('#end-game-stats');
    challengeWinnerSelect = $('#challenge-winner');
    confirmNewGameBtn = $('#confirm-new-game-btn');
    console.log("UI elements initialized."); // Add log for debugging
}


// --- UI Update Functions ---

export function showScreen(screenToShow) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    if (screenToShow) {
        screenToShow.classList.add('active');
    }
}

export function updateSetupPlayerList(players) {
    playerListSetup.innerHTML = ''; // Clear existing list
    if (!players || players.length === 0) {
         const li = document.createElement('li');
         li.textContent = "No survivors yet...";
         li.style.justifyContent = 'center';
         li.style.opacity = '0.7';
         playerListSetup.appendChild(li);
    } else {
        players.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${escapeHTML(player.name)}</span>
                <button data-id="${player.id}" class="remove-player-btn" aria-label="Remove ${escapeHTML(player.name)}">Remove</button>
            `;
            playerListSetup.appendChild(li);
        });
    }
    // Enable/disable start button
    startGameBtn.disabled = !players || players.length === 0;
}

// Helper to prevent basic HTML injection
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}


export function renderPlayerCards(players, settings) {
    playersContainer.innerHTML = ''; // Clear existing cards
    if (!players || !settings) return;

    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.dataset.playerId = player.id;

        // Use textContent for safety where possible, innerHTML for structure
        const canRedeem = player.points >= settings.redemptionCost;
        const shotLimitReached = player.shots >= settings.shotLimit;

        card.innerHTML = `
            <h3>${escapeHTML(player.name)}</h3>
            <span class="player-points">${player.points.toLocaleString()} pts</span>
            <div class="player-stats">
                <span><i class="icon icon-beer"></i>&nbsp;Beers: <span class="beer-count">${player.beers}</span></span>
                <span><i class="icon icon-shot"></i>&nbsp;Shots: <span class="shot-count">${player.shots}</span> / ${settings.shotLimit}</span>
            </div>
            <div class="player-actions">
                <button class="btn-beer" data-action="beer" aria-label="Add Beer for ${escapeHTML(player.name)}">🍺 Beer (+${settings.pointsPerBeer.toLocaleString()})</button>
                <button class="btn-shot" data-action="shot" ${shotLimitReached ? 'disabled' : ''} aria-label="Add Shot for ${escapeHTML(player.name)}">🥃 Shot (+${settings.pointsPerShot.toLocaleString()})</button>
                <button class="btn-revive" data-action="revive" aria-label="Add Revive for ${escapeHTML(player.name)}">➕ Revive (+${settings.pointsPerRevive.toLocaleString()})</button>
                <button class="btn-redeem" data-action="redeem" ${!canRedeem ? 'disabled' : ''} aria-label="Redeem points for ${escapeHTML(player.name)}">💸 Redeem (-${settings.redemptionCost.toLocaleString()})</button>
            </div>
        `;
        playersContainer.appendChild(card);
    });
}

// More targeted update after an action
export function updatePlayerCard(playerId, player, settings) {
     if (!player || !settings) return;
    const card = $(`.player-card[data-player-id="${playerId}"]`);
    if (!card) return;

    const pointsDisplay = $('.player-points', card);
    const beerCount = $('.beer-count', card);
    const shotCount = $('.shot-count', card);
    const shotBtn = $('.btn-shot', card);
    const redeemBtn = $('.btn-redeem', card);

    if (pointsDisplay) pointsDisplay.textContent = `${player.points.toLocaleString()} pts`;
    if (beerCount) beerCount.textContent = player.beers;
    if (shotCount) shotCount.textContent = player.shots;

    const shotLimitReached = player.shots >= settings.shotLimit;
    const canRedeem = player.points >= settings.redemptionCost;

    if (shotBtn) shotBtn.disabled = shotLimitReached;
    if (redeemBtn) redeemBtn.disabled = !canRedeem;
}


export function applyPointAnimation(playerId, type) { // type = 'increase' or 'decrease'
     const card = $(`.player-card[data-player-id="${playerId}"]`);
     if (!card) return;
     const pointsDisplay = $('.player-points', card);
     if (!pointsDisplay) return;

     pointsDisplay.classList.remove('increase', 'decrease'); // Clear previous animations
     void pointsDisplay.offsetWidth; // Trigger reflow to restart animation if class is the same
     pointsDisplay.classList.add(type);

     // Remove class after animation ends to allow re-triggering
     // Use event listener for more robust timing if needed
     setTimeout(() => {
         pointsDisplay.classList.remove(type);
     }, 500); // Match animation duration in CSS
}

export function updateGameStats(players, history, settings) {
    let totalPointsEarned = 0;
    let totalPointsSpent = 0;
    let totalBeers = 0;
    let totalShots = 0;
    let totalRevives = 0;

    if (players) {
        players.forEach(p => {
            totalBeers += p.beers;
            totalShots += p.shots;
        });
    }

     // Calculate totals from history for accuracy, especially earned/spent
     totalRevives = 0; // Reset revives count
     if(history) {
        history.forEach(entry => {
            if (entry.action === 'revive') {
                totalRevives++;
            }
            // Ensure change is a number before adding
            const change = Number(entry.change) || 0;
             if (change > 0 && entry.action !== 'redeem') { // Earned points (excluding redeem action which is negative)
                 totalPointsEarned += change;
             } else if (entry.action === 'redeem' && change < 0) { // Spent points (redeem is negative)
                 totalPointsSpent += Math.abs(change);
             }
        });
     }


    if (totalPointsEarnedDisplay) totalPointsEarnedDisplay.textContent = totalPointsEarned.toLocaleString();
    if (totalPointsSpentDisplay) totalPointsSpentDisplay.textContent = totalPointsSpent.toLocaleString();
    if (totalBeersDisplay) totalBeersDisplay.textContent = totalBeers;
    if (totalShotsDisplay) totalShotsDisplay.textContent = totalShots;
    if (totalRevivesDisplay) totalRevivesDisplay.textContent = totalRevives;
}

export function renderHistoryLog(history) {
    if (!historyLogList) return;
    historyLogList.innerHTML = ''; // Clear existing log
    if (!history) return;

    // Show latest entries first
    [...history].reverse().forEach(entry => {
        const li = document.createElement('li');
        // Format timestamp robustly
        let time = '??:??';
        try {
            time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) { console.error("Invalid timestamp in history:", entry.timestamp); }

        // Use textContent for safety
        li.textContent = `[${time}] ${entry.message}`;
        historyLogList.appendChild(li);
    });
    // Scroll to top
    historyLogList.scrollTop = 0;
}

export function renderLeaderboard(players) {
     if (!leaderboardList) return;
    leaderboardList.innerHTML = ''; // Clear existing list
    if (!players || players.length === 0) {
        leaderboardList.innerHTML = '<li>No players ranked yet.</li>';
        return;
    }

    const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
    sortedPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        // Use textContent for safety
        const rankSpan = document.createElement('span');
        rankSpan.textContent = `${index + 1}. ${player.name}`;

        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'leader-points';
        pointsSpan.textContent = `${player.points.toLocaleString()} pts`;

        li.appendChild(rankSpan);
        li.appendChild(pointsSpan);
        leaderboardList.appendChild(li);
    });
}

export function updateTimerDisplay(timeString) {
    if (gameTimerDisplay) {
        gameTimerDisplay.textContent = timeString;
    }
}

export function applySettingsToInputs(settings) {
    if (!settings) return;
    settingPointsBeer.value = settings.pointsPerBeer;
    settingPointsShot.value = settings.pointsPerShot;
    settingPointsRevive.value = settings.pointsPerRevive;
    settingCostRedeem.value = settings.redemptionCost;
    settingShotLimit.value = settings.shotLimit;
}

export function populateEndGameModal(stats, players) {
    if (!stats || !endGameStatsContainer) return;

    endGameStatsContainer.innerHTML = `
        <p><strong>Duration:</strong> ${stats.duration || 'N/A'}</p>
        <p><strong>Overall Points Earned:</strong> ${(stats.totalPointsEarned || 0).toLocaleString()}</p>
        <p><strong>Overall Points Spent:</strong> ${(stats.totalPointsSpent || 0).toLocaleString()}</p>
        <p><strong>Overall Beers:</strong> ${stats.totalBeers || 0}</p>
        <p><strong>Overall Shots:</strong> ${stats.totalShots || 0}</p>
        <p><strong>Overall Revives:</strong> ${stats.totalRevives || 0}</p>
        <h4>Player Stats:</h4>
        <ul>
            ${stats.players && stats.players.length > 0
                ? stats.players.map(p => `<li><strong>${escapeHTML(p.name)}:</strong> ${p.points.toLocaleString()} pts (${p.beers} beers, ${p.shots} shots)</li>`).join('')
                : '<li>No player data available.</li>'
            }
        </ul>
    `;

    // Populate challenge winner dropdown
    if (challengeWinnerSelect && players) {
        challengeWinnerSelect.innerHTML = '<option value="none">None</option>'; // Reset
        players.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = escapeHTML(p.name);
            challengeWinnerSelect.appendChild(option);
        });
         challengeWinnerSelect.value = 'none'; // Ensure default is selected
    }
}

// Functions to handle modal visibility using <dialog>
export function showOptionsModal() {
    const state = getGameState();
    applySettingsToInputs(state.settings);
    optionsDialog?.showModal();
}

export function closeOptionsModal() {
    optionsDialog?.close();
}

export function showEndGameModal() {
    endGameDialog?.showModal();
}

export function closeEndGameModal() {
    endGameDialog?.close();
}