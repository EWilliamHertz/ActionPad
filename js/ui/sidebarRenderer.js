// FILE: js/ui/sidebarRenderer.js
import { formatLastSeen, formatTime } from './utils.js';

/**
 * Renders the list of team members in the sidebar.
 * @param {Array<Object>} team - An array of user objects, each representing a team member.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 */
export const renderTeamList = (team, currentUserId) => {
    const teamListEl = document.getElementById('team-list');
    if (!teamListEl) return;
    teamListEl.innerHTML = ''; // Clear the list before re-rendering

    // Sort users: online users first, then alphabetically by nickname
    team.sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return a.nickname.localeCompare(b.nickname);
    });

    team.forEach(user => {
        const userEl = document.createElement('li');
        userEl.className = 'team-member';
        
        // Add a 'you' class if the user is the current user
        if (user.id === currentUserId) {
            userEl.classList.add('is-current-user');
        }

        const statusClass = user.online ? 'online' : 'offline';
        // FIX: Use the last_changed timestamp from Firestore to get accurate status.
        const statusText = user.online ? 'Online' : formatLastSeen(user.last_changed);
        const avatarSrc = user.avatarURL || `https://placehold.co/36x36/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;

        // The "(You)" text is added here for the current user
        const nicknameDisplay = user.id === currentUserId 
            ? `${user.nickname} (You)` 
            : user.nickname;

        userEl.innerHTML = `
            <div class="team-member-avatar">
                <img src="${avatarSrc}" alt="${user.nickname}" class="avatar-img">
                <span class="presence-dot ${statusClass}"></span>
            </div>
            <div class="team-member-info">
                <span class="team-member-name">${nicknameDisplay}</span>
                <span class="team-member-status ${statusClass}">${statusText}</span>
            </div>
        `;
        teamListEl.appendChild(userEl);
    });
};


/**
 * Renders chat messages in the team chat panel.
 * @param {Array<Object>} messages - An array of chat message objects.
 * @param {string} currentUserId - The ID of the currently logged-in user to identify self-messages.
 */
export const renderChatMessages = (messages, currentUserId) => {
    const chatMessagesEl = document.getElementById('team-chat-messages');
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = '';
    messages.forEach(msg => {
        const item = document.createElement('div');
        const isSelf = msg.author.uid === currentUserId;
        item.className = `chat-message ${isSelf ? 'is-self' : ''}`;

        const author = msg.author?.nickname || 'User';
        const timestamp = msg.createdAt ? formatTime(msg.createdAt) : '';
        const avatarSrc = msg.author?.avatarURL || `https://placehold.co/32x32/E9ECEF/495057?text=${author.charAt(0).toUpperCase()}`;

        item.innerHTML = `
            <img src="${avatarSrc}" alt="${author}" class="avatar chat-avatar">
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-author">${author}</span>
                    <span class="chat-timestamp">${timestamp}</span>
                </div>
                <div class="chat-text">${msg.text}</div>
            </div>
        `;
        chatMessagesEl.appendChild(item);
    });
    // Scroll to the bottom to show the latest message
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
};
