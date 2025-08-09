// FILE: js/ui/sidebarRenderer.js
import { formatLastSeen, formatTime } from './utils.js'; // <-- IMPORT FROM UTILS

export const renderTeamList = (team) => {
    const teamListEl = document.getElementById('team-list');
    if (!teamListEl) return;
    teamListEl.innerHTML = '';
    
    team.sort((a, b) => (b.online === true ? 1 : -1) - (a.online === true ? 1 : -1) || a.nickname.localeCompare(b.nickname));

    team.forEach(user => {
        const userEl = document.createElement('li');
        userEl.className = 'team-member';
        const statusClass = user.online ? 'online' : 'offline';
        const statusText = user.online ? 'Online' : formatLastSeen(user.last_changed);
        const avatarSrc = user.avatarURL || `https://placehold.co/36x36/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;

        userEl.innerHTML = `
            <div class="team-member-avatar">
                <img src="${avatarSrc}" alt="${user.nickname}" class="avatar-img">
                <span class="presence-dot ${statusClass}"></span>
            </div>
            <div class="team-member-info">
                <span class="team-member-name">${user.nickname}</span>
                <span class="team-member-status ${statusClass}">${statusText}</span>
            </div>
        `;
        teamListEl.appendChild(userEl);
    });
};

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
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
};
