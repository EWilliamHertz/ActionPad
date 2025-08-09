// FILE: js/chat.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signOut } from './services/auth.js';
import { getUserProfile } from './services/user.js';
import { getCompany } from './services/company.js';
import { listenToCompanyChat, addChatMessage } from './services/chat.js';
import { formatTime } from './ui/utils.js';
import { showToast } from './toast.js';

let appState = {
    user: null,
    profile: null,
    company: null,
    chatListener: null,
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user && user.emailVerified) {
            appState.user = user;
            const companyId = localStorage.getItem('selectedCompanyId');
            if (companyId) {
                initialize(companyId);
            } else {
                showToast("No company selected. Redirecting to dashboard.", "error");
                window.location.replace('dashboard.html');
            }
        } else {
            window.location.replace('login.html');
        }
    });
});

async function initialize(companyId) {
    try {
        const profileSnap = await getUserProfile(appState.user.uid);
        if (!profileSnap.exists()) throw new Error("User profile not found.");
        appState.profile = profileSnap.data();

        const companySnap = await getCompany(companyId);
        if (!companySnap.exists()) throw new Error("Company data not found.");
        appState.company = { id: companySnap.id, ...companySnap.data() };

        setupUI();
        setupListeners();

        document.getElementById('chat-page-container').classList.remove('hidden');
    } catch (error) {
        console.error("Chat page initialization failed:", error);
        showToast(error.message, "error");
        window.location.replace('index.html');
    }
}

function setupUI() {
    // User info in header
    document.getElementById('user-nickname').textContent = appState.profile.nickname;
    const avatar = document.getElementById('user-avatar-header');
    if (appState.profile.avatarURL) {
        avatar.src = appState.profile.avatarURL;
    } else {
        avatar.src = `https://placehold.co/40x40/E9ECEF/495057?text=${appState.profile.nickname.charAt(0).toUpperCase()}`;
    }

    // Company name in header
    document.getElementById('chat-company-name').textContent = appState.company.name;
    
    // Logout button
    document.getElementById('logout-button').addEventListener('click', signOut);

    // Message form
    document.getElementById('full-chat-form').addEventListener('submit', handleSendMessage);
}

function setupListeners() {
    if (appState.chatListener) appState.chatListener(); // Unsubscribe from old listener

    appState.chatListener = listenToCompanyChat(appState.company.id, (messages) => {
        renderMessages(messages);
    });
}

function renderMessages(messages) {
    const chatContainer = document.getElementById('full-chat-messages');
    if (!chatContainer) return;

    chatContainer.innerHTML = ''; // Clear previous messages

    if (messages.length === 0) {
        chatContainer.innerHTML = `<div class="empty-state"><p>No messages yet. Start the conversation!</p></div>`;
        return;
    }

    messages.forEach(msg => {
        const item = document.createElement('div');
        const isSelf = msg.author.uid === appState.user.uid;
        item.className = `chat-message-full ${isSelf ? 'is-self' : ''}`;
        
        const author = msg.author?.nickname || 'User';
        const timestamp = msg.createdAt ? formatTime(msg.createdAt) : '';
        const avatarSrc = msg.author?.avatarURL || `https://placehold.co/40x40/E9ECEF/495057?text=${author.charAt(0).toUpperCase()}`;

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
        chatContainer.appendChild(item);
    });

    // Auto-scroll to the latest message
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function handleSendMessage(event) {
    event.preventDefault();
    const input = document.getElementById('full-chat-input');
    const text = input.value.trim();

    if (text) {
        const author = {
            uid: appState.user.uid,
            nickname: appState.profile.nickname,
            avatarURL: appState.profile.avatarURL || null
        };
        
        input.value = ''; // Clear input immediately for better UX
        try {
            await addChatMessage(appState.company.id, author, text);
        } catch (err) {
            console.error("Error sending chat message:", err);
            showToast("Could not send message.", "error");
            input.value = text; // Restore text if sending failed
        }
    }
}
