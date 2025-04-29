import { getGameState, setGameActive } from './state.js';
import { formatTime } from './utils.js';
import { updateTimerDisplay } from './ui.js'; // Import UI function

let timerInterval = null;

export function startTimer() {
    stopTimer(); // Clear any existing timer

    let state = getGameState();
    if (!state.startTime) {
        setGameActive(true, Date.now()); // Set startTime only if not already set (e.g., on resume)
        state = getGameState(); // Get updated state
    } else {
        setGameActive(true, state.startTime); // Ensure game is marked active
    }


    timerInterval = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        updateTimerDisplay(formatTime(elapsed));
    }, 1000);

    // Initial display update
    const initialElapsed = state.startTime ? Date.now() - state.startTime : 0;
    updateTimerDisplay(formatTime(initialElapsed));
    console.log("Timer started at:", new Date(state.startTime));
}

export function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        console.log("Timer stopped.");
    }
}

export function resetTimer() {
    stopTimer();
    setGameActive(false, null); // Reset startTime in state
    updateTimerDisplay(formatTime(0)); // Update display to 00:00:00
    console.log("Timer reset.");
}

export function getTimerIntervalId() {
    return timerInterval;
}