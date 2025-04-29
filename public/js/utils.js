export const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

export const formatTime = (ms) => {
    if (ms === null || ms === undefined || ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

// Helper to safely query the DOM
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}