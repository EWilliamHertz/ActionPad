// FILE: js/ui/utils.js

export function formatDateTime(timestamp) {
    if (!timestamp) return '';
    return timestamp.toDate().toLocaleString();
}

export function formatTime(timestamp) {
    if (!timestamp) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatLastSeen(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'Offline';
    const now = new Date();
    const lastSeen = timestamp.toDate();
    const diffSeconds = Math.floor((now - lastSeen) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return lastSeen.toLocaleDateString();
}
