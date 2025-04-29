// server.js
const express = require('express');
const http = require('http'); // Use HTTP
// const fs = require('fs'); // No longer needed for certs
const { Server } = require("socket.io");
// const selfsigned = require('selfsigned'); // No longer needed for certs
const path = require('path');
const cors = require('cors'); // Import CORS middleware
const winston = require('winston'); // Import Winston for logging

const app = express();

// --- Logger Configuration (Winston) ---
const logger = winston.createLogger({
  level: 'info', // Log only info and above by default
  format: winston.format.json(), // Log as JSON
  transports: [
    // In production, write all logs with level `error` or less to `error.log`
    // and all logs with level `info` or less to `combined.log`.
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// If we're not in production, log to the console with a simple format.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    level: 'debug', // Log debug messages and above to console in dev
  }));
} else {
    // Add a basic console transport for production as well, but less verbose
     logger.add(new winston.transports.Console({
        format: winston.format.simple(),
        level: 'info'
     }));
}

logger.info('Logger initialized.');

// --- HTTPS Certificate Configuration (REMOVED) ---
// Certificate handling is now managed by Cloudflare Tunnel.
// The Node.js server runs as plain HTTP.

const server = http.createServer(app); // Create HTTP server
const io = new Server(server, {
  cors: {
    // Allow both localhost (dev) and the production domain
    origin: [ "http://localhost:3000", "https://zombeers.com" ], // Allow HTTP for local dev
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// --- Game State Management (Server-Side) ---
const rooms = new Map(); // Store room states { roomCode: { state: {...}, sockets: Set<socket.id> } }

// Default settings structure (same as original state.js)
const defaultSettings = {
    pointsPerBeer: 2500,
    pointsPerShot: 1000,
    pointsPerRevive: 500,
    redemptionCost: 500,
    shotLimit: 3
};

// --- Helper Functions ---
function generateRoomCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Avoid O, 0
    let code = '';
    do {
        code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms.has(code)); // Ensure uniqueness
    return code;
}

function getInitialRoomState() {
    // Deep clone default settings
    const settings = JSON.parse(JSON.stringify(defaultSettings));
    return {
        gameActive: false,
        players: [], // { id: string, name: string, points: number, beers: number, shots: number, socketId: string? }
        settings: settings,
        startTime: null,
        history: [], // { timestamp: number, player: string, action: string, change: number, message: string }
        // No lastGameStats needed server-side like this
    };
}

function getRoomCodeFromSocket(socket) {
    // Find which room this socket belongs to
    for (const [code, roomData] of rooms.entries()) {
        if (roomData.sockets.has(socket.id)) {
            return code;
        }
    }
    return null;
}

function addHistoryEntry(roomState, entry) {
    roomState.history.push(entry);
    if (roomState.history.length > 100) {
        roomState.history.shift();
    }
}

// --- Serve Static Frontend Files ---
// Assume your original frontend files (index.html, css/, js/) are in a 'public' subdirectory
app.use(express.static(path.join(__dirname, 'public')));

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('createRoom', (callback) => {
        const roomCode = generateRoomCode();
        const initialState = getInitialRoomState();
        rooms.set(roomCode, { state: initialState, sockets: new Set([socket.id]) });
        socket.join(roomCode);
        logger.info(`Room ${roomCode} created by ${socket.id}`);
        // Send back the room code and initial state
        callback({ roomCode, state: initialState });
    });

    socket.on('joinRoom', (roomCode, callback) => {
        roomCode = roomCode.toUpperCase(); // Standardize code
        const roomData = rooms.get(roomCode);

        if (roomData) {
            socket.join(roomCode);
            roomData.sockets.add(socket.id);
            logger.info(`Socket ${socket.id} joined room ${roomCode}`);

            // Notify others in the room
            socket.to(roomCode).emit('playerJoined', socket.id); // Can enhance with user name later

            // Send the current state to the joiner
            callback({ success: true, state: roomData.state, roomCode: roomCode });
        } else {
            callback({ success: false, message: 'Room not found.' });
        }
    });

    socket.on('requestState', (roomCode, callback) => {
         roomCode = roomCode.toUpperCase();
         const roomData = rooms.get(roomCode);
         if (roomData && roomData.sockets.has(socket.id)) {
             callback({ success: true, state: roomData.state });
         } else {
             callback({ success: false, message: 'Not in room or room not found.' });
         }
    });

    // --- Game Actions ---
    socket.on('addPlayer', ({ roomCode, name }) => {
        const roomData = rooms.get(roomCode);
        if (!roomData || !roomData.sockets.has(socket.id)) return; // Basic validation

        const state = roomData.state;
        const players = state.players;

        if (name && players.length < 10) {
            if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                // Handle error - maybe emit back to sender?
                socket.emit('actionError', { message: 'Player name already exists!' });
                return;
            }
            const newPlayer = {
                id: '_' + Math.random().toString(36).substr(2, 9), // Generate ID server-side
                name: name,
                points: 0,
                beers: 0,
                shots: 0
                // Maybe associate socketId if needed: socketId: socket.id
            };
            state.players.push(newPlayer);
            io.to(roomCode).emit('gameStateUpdate', state); // Broadcast updated state
        }
        // Handle other error cases (name empty, max players) if needed
    });

    socket.on('removePlayer', ({ roomCode, playerId }) => {
        const roomData = rooms.get(roomCode);
         if (!roomData || !roomData.sockets.has(socket.id)) return;
         const state = roomData.state;
         state.players = state.players.filter(p => p.id !== playerId);
         io.to(roomCode).emit('gameStateUpdate', state);
    });

    socket.on('startGame', ({ roomCode }) => {
         const roomData = rooms.get(roomCode);
         if (!roomData || !roomData.sockets.has(socket.id)) return;
         const state = roomData.state;
         if (state.players.length === 0) {
             socket.emit('actionError', { message: 'Add players first!' });
             return;
         }
         state.gameActive = true;
         state.startTime = Date.now();
         state.history = []; // Reset history on new game start within room
         logger.info(`Game started in room ${roomCode} at ${state.startTime}`);
         io.to(roomCode).emit('gameStateUpdate', state); // Broadcast game start
    });

     socket.on('playerAction', ({ roomCode, playerId, action }) => {
         const roomData = rooms.get(roomCode);
         if (!roomData || !roomData.sockets.has(socket.id)) return;
         const state = roomData.state;
         const player = state.players.find(p => p.id === playerId);
         if (!player || !state.gameActive) return; // Must have player and game must be active

         let pointsChange = 0;
         let logMessage = '';
         let playerUpdates = {};
         const settings = state.settings;

         switch (action) {
             case 'beer':
                 playerUpdates = { beers: player.beers + 1, points: player.points + settings.pointsPerBeer };
                 pointsChange = settings.pointsPerBeer;
                 logMessage = `${player.name} drank a beer! (+${pointsChange.toLocaleString()} pts)`;
                 break;
             case 'shot':
                 if (player.shots < settings.shotLimit) {
                     playerUpdates = { shots: player.shots + 1, points: player.points + settings.pointsPerShot };
                     pointsChange = settings.pointsPerShot;
                     logMessage = `${player.name} took a shot! (+${pointsChange.toLocaleString()} pts) (${playerUpdates.shots}/${settings.shotLimit})`;
                 } else {
                     socket.emit('actionError', { message: `${player.name} reached shot limit!` });
                     return;
                 }
                 break;
             case 'revive':
                 playerUpdates = { points: player.points + settings.pointsPerRevive };
                 pointsChange = settings.pointsPerRevive;
                 logMessage = `${player.name} got a revive! (+${pointsChange.toLocaleString()} pts)`;
                 break;
             case 'redeem':
                 if (player.points >= settings.redemptionCost) {
                     playerUpdates = { points: player.points - settings.redemptionCost };
                     pointsChange = -settings.redemptionCost;
                     logMessage = `${player.name} redeemed points! (${pointsChange.toLocaleString()} pts)`;
                 } else {
                     socket.emit('actionError', { message: `${player.name} needs more points!` });
                     return;
                 }
                 break;
            case 'reset-score':
                // Reset player's score-related stats
                playerUpdates = { points: 0, beers: 0, shots: 0 };
                pointsChange = -player.points; // Log the amount removed, though the result is 0
                logMessage = `${player.name}'s score was reset by an admin/host.`; // Assuming the clicker has rights
                // No error check needed here, just reset
                break;
             default:
                 logger.warn(`Unknown player action received: ${action} for player ${playerId} in room ${roomCode}`);
                 return; // Unknown action
         }

         // Apply updates
         Object.assign(player, playerUpdates);

         // Log
         addHistoryEntry(state, {
             timestamp: Date.now(),
             player: player.name,
             action: action,
             change: pointsChange,
             message: logMessage
         });

         // Broadcast
         io.to(roomCode).emit('gameStateUpdate', state);
          // Optionally send specific feedback like animation trigger
         io.to(roomCode).emit('actionFeedback', { playerId, action });
     });

     socket.on('updateSettings', ({ roomCode, newSettings }) => {
         const roomData = rooms.get(roomCode);
         if (!roomData || !roomData.sockets.has(socket.id)) return;
         const state = roomData.state;
         // Enhanced validation: Ensure values are non-negative numbers
         let updated = false;
         const settingsToUpdate = {};

         const validateSetting = (key, value) => {
             const num = parseInt(value);
             // Check if it's a number, not NaN, and non-negative
             if (typeof num === 'number' && !isNaN(num) && num >= 0) {
                 return num;
             }
             logger.warn(`Invalid value received for setting '${key}':`, { value });
             socket.emit('actionError', { message: `Invalid value for ${key}. Must be a non-negative number.` });
             return null; // Indicate invalid
         };

         if (newSettings && typeof newSettings === 'object') {
             const keys = ['pointsPerBeer', 'pointsPerShot', 'pointsPerRevive', 'redemptionCost', 'shotLimit'];
             keys.forEach(key => {
                 if (newSettings.hasOwnProperty(key)) {
                     const validatedValue = validateSetting(key, newSettings[key]);
                     if (validatedValue !== null) {
                         settingsToUpdate[key] = validatedValue;
                         updated = true;
                     }
                 }
             });
         } else {
              logger.warn('Received invalid newSettings object:', { received: newSettings });
              socket.emit('actionError', { message: 'Invalid settings format received.' });
              return; // Don't proceed if the whole object is bad
         }

         // Apply validated updates
         if (updated) {
             Object.assign(state.settings, settingsToUpdate);
             logger.info(`Settings updated for room ${roomCode}`, { updates: settingsToUpdate });
         } else {
             logger.info(`No valid settings updates received for room ${roomCode}.`);
             // Optionally inform the user if no settings were valid?
             // socket.emit('actionError', { message: 'No valid settings were provided.' });
             return; // Don't broadcast if nothing changed
         }

         io.to(roomCode).emit('gameStateUpdate', state);
     });

     // --- Reset/New Game (within the same room) ---
     // 'resetGame': Clears scores and history, keeps players/settings, returns to setup.
     socket.on('resetGame', ({ roomCode }) => {
          const roomData = rooms.get(roomCode);
         if (!roomData || !roomData.sockets.has(socket.id)) return;
         // Reset state but keep players and settings
         const originalPlayers = roomData.state.players.map(p => ({ ...p, points: 0, beers: 0, shots: 0 })); // Reset stats
         const originalSettings = roomData.state.settings;
         roomData.state = getInitialRoomState(); // Get fresh state structure
         roomData.state.players = originalPlayers; // Restore players (reset stats)
         roomData.state.settings = originalSettings; // Restore settings
         logger.info(`Game reset in room ${roomCode}`);
         io.to(roomCode).emit('gameStateUpdate', roomData.state);
         io.to(roomCode).emit('showScreen', 'setup'); // Tell clients to go back to setup view within the room
     });

      // 'newGameSetup': Stops the active game, keeps scores/history/players/settings, returns to setup.
      socket.on('newGameSetup', ({ roomCode }) => {
         const roomData = rooms.get(roomCode);
         if (!roomData || !roomData.sockets.has(socket.id)) return;
         // Similar to reset, ends current game, keeps players/settings, goes to setup
         roomData.state.gameActive = false;
         roomData.state.startTime = null;
         // Don't clear players or history immediately, maybe show summary first?
         // For simplicity now, just reset active state and time
         logger.info(`'New Game Setup' requested in room ${roomCode}`);
          io.to(roomCode).emit('gameStateUpdate', roomData.state);
         io.to(roomCode).emit('showScreen', 'setup'); // Or maybe a summary screen first
     });


    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
        const roomCode = getRoomCodeFromSocket(socket);
        if (roomCode) {
            const roomData = rooms.get(roomCode);
            if (roomData) {
                roomData.sockets.delete(socket.id);
                logger.info(`Socket ${socket.id} removed from room ${roomCode}`);
                // Notify others
                socket.to(roomCode).emit('playerLeft', socket.id);

                // Optional: Clean up empty rooms
                if (roomData.sockets.size === 0) {
                    rooms.delete(roomCode);
                    logger.info(`Room ${roomCode} deleted as it is empty.`);
                }
            }
        }
    });
});

// --- Start Server ---
server.listen(PORT, '0.0.0.0', () => { // Listen on all interfaces
    logger.info(`Zombeers server running on port ${PORT}. Access locally via http://localhost:${PORT} or through Cloudflare Tunnel at https://zombeers.com`);
});