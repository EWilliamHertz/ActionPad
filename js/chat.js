// FILE: js/chat.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { signOut } from './services/auth.js';
import { getUserProfile } from './services/user.js';
import { getCompany } from './services/company.js';
import { listenToCompanyProjects, addProject } from './services/project.js';
import { listenToCompanyPresence } from './services/presence.js';
import { listenToProjectChat, addChatMessage } from './services/chat.js';
import { listenToCompanyTasks } from './services/task.js';
import { showToast } from './toast.js';

let appState = {
    user: null,
    profile: null,
    company: null,
    projects: [],
    team: [],
    selectedProjectId: null,
    projectListener: null,
    teamListener: null,
    chatListener: null,
    tasksListener: null,
};

const DOM = {
    projectList: document.getElementById('project-list-container'),
    teamList: document.getElementById('team-list'),
    chatProjectName: document.getElementById('current-project-name'),
    chatMessages: document.getElementById('chat-messages-container'),
    chatForm: document.getElementById('chat-input-form'),
    chatInput: document.getElementById('chat-input'),
    pageContainer: document.getElementById('chat-page-container'),
    chatHeader: document.getElementById('chat-header'),
    addProjectForm: document.getElementById('add-project-form-chat'),
    newProjectInput: document.getElementById('new-project-input-chat'),
    voiceRoomList: document.getElementById('voice-room-list'),
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async user => {
        if (user) {
            appState.user = user;
            try {
                await initialize();
                DOM.pageContainer.classList.remove('hidden'); // Show the chat UI
            } catch (error) {
                console.error("Chat app initialization failed:", error);
                showToast(error.message, 'error');
                // Redirect on critical failure after a short delay
                setTimeout(() => window.location.replace('dashboard.html'), 3000);
            }
        } else {
            // User is not signed in, redirect to login
            window.location.replace('login.html');
        }
    });
});

async function initialize() {
    // Fetch user profile and company
    const profileSnap = await getUserProfile(appState.user.uid);
    if (!profileSnap.exists()) {
        throw new Error("User profile not found. Please log out and back in on the dashboard page.");
    }
    appState.profile = { uid: appState.user.uid, ...profileSnap.data() };

    const companyId = localStorage.getItem('selectedCompanyId');
    if (!companyId) {
        throw new Error("No company selected. Please return to the dashboard.");
    }
    const companySnap = await getCompany(companyId);
    if (!companySnap.exists()) {
        throw new Error("Company not found.");
    }
    appState.company = { id: companySnap.id, ...companySnap.data() };

    // Setup listeners for projects and team
    setupListeners();

    // Setup event listeners for UI
    setupUIEvents();
}

function setupListeners() {
    if (appState.projectListener) appState.projectListener();
    if (appState.teamListener) appState.teamListener();

    appState.projectListener = listenToCompanyProjects(appState.company.id, (projects) => {
        appState.projects = projects;
        renderProjectList();
        // Automatically select the first project if none is selected
        if (!appState.selectedProjectId && projects.length > 0) {
            switchProject(projects[0].id);
        }
    });

    appState.teamListener = listenToCompanyPresence(appState.company.id, (team) => {
        appState.team = team;
        renderTeamList();
    });
}

function setupUIEvents() {
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('selectedCompanyId');
        signOut();
    });
    
    DOM.projectList.addEventListener('click', (e) => {
        const item = e.target.closest('.project-item-chat');
        if (item) {
            const projectId = item.dataset.projectId;
            if (projectId !== appState.selectedProjectId) {
                switchProject(projectId);
            }
        }
    });

    DOM.chatForm.addEventListener('submit', handleSendMessage);
    DOM.addProjectForm.addEventListener('submit', handleAddProject);
    DOM.voiceRoomList.addEventListener('click', (e) => {
        const item = e.target.closest('.voice-room-item');
        if (item) {
            handleJoinVoiceRoom(item.dataset.roomName);
        }
    });
}

function switchProject(projectId) {
    if (appState.chatListener) appState.chatListener();
    if (appState.tasksListener) appState.tasksListener();

    appState.selectedProjectId = projectId;
    const project = appState.projects.find(p => p.id === projectId);
    
    // Update the project name in the chat header
    DOM.chatProjectName.textContent = project ? project.name : 'General';
    
    // Update active state in sidebar
    document.querySelectorAll('.project-item-chat').forEach(item => {
        item.classList.toggle('active', item.dataset.projectId === projectId);
    });

    // Clear previous chat messages and show loader
    DOM.chatMessages.innerHTML = '<div class="loader">Loading...</div>';

    // Fetch and render initial tasks
    appState.tasksListener = listenToCompanyTasks(appState.company.id, projectId, (tasks) => {
        appState.tasks = tasks; // Store tasks
        // Fetch chat messages after tasks are loaded
        appState.chatListener = listenToProjectChat(projectId, (messages) => {
            appState.messages = messages;
            renderChatContent(tasks, messages);
        });
    });
}

function renderChatContent(tasks, messages) {
    DOM.chatMessages.innerHTML = '';
    
    if (tasks.length > 0) {
        // Render all tasks as a "system message" at the top
        const taskMessageEl = document.createElement('div');
        taskMessageEl.className = 'chat-tasks-message';
        taskMessageEl.innerHTML = `
            <h4>Project Tasks</h4>
            <ul>
                ${tasks.map(task => `
                    <li class="${task.status}">
                        <span class="task-status-dot ${task.status}"></span>
                        <span>${task.name}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        DOM.chatMessages.appendChild(taskMessageEl);
    }
    
    if (messages.length === 0 && tasks.length === 0) {
        DOM.chatMessages.innerHTML = '<div class="loader">Start the conversation!</div>';
    } else {
         messages.forEach(message => {
            renderChatMessage(message);
        });
    }

    // Auto-scroll to the bottom
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function renderProjectList() {
    if (!DOM.projectList) return;
    DOM.projectList.innerHTML = ''; // Clear existing list
    appState.projects.forEach(project => {
        const listItem = document.createElement('div');
        listItem.className = `project-item-chat ${appState.selectedProjectId === project.id ? 'active' : ''}`;
        listItem.dataset.projectId = project.id;
        listItem.innerHTML = `
            <span class="project-icon">#</span>
            <span>${project.name}</span>
        `;
        DOM.projectList.appendChild(listItem);
    });
}

function renderTeamList() {
    if (!DOM.teamList) return;
    DOM.teamList.innerHTML = '';
    appState.team.forEach(member => {
        const item = document.createElement('li');
        const isOnline = member.online;
        item.className = 'team-member-item';
        item.innerHTML = `
            <img src="${member.avatarURL || `https://placehold.co/36x36/E9ECEF/495057?text=${member.nickname.charAt(0).toUpperCase()}`}" alt="${member.nickname}" class="avatar-img">
            <span class="presence-dot ${isOnline ? 'online' : 'offline'}"></span>
            <span>${member.nickname}</span>
        `;
        DOM.teamList.appendChild(item);
    });
}

function renderChatMessage(message) {
    const isSelf = message.author.uid === appState.user.uid;
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message-full ${isSelf ? 'is-self' : ''}`;
    const avatarSrc = message.author.avatarURL || `https://placehold.co/40x40/E9ECEF/495057?text=${message.author.nickname.charAt(0).toUpperCase()}`;
    const timestamp = message.createdAt ? message.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    messageEl.innerHTML = `
        <img src="${avatarSrc}" alt="${message.author.nickname}" class="chat-avatar">
        <div class="chat-message-content">
            <div class="chat-message-header">
                <span class="chat-author">${message.author.nickname}</span>
                <span class="chat-timestamp">${timestamp}</span>
            </div>
            <div class="chat-text">${message.text}</div>
        </div>
    `;
    DOM.chatMessages.appendChild(messageEl);
}

async function handleSendMessage(e) {
    e.preventDefault();
    const text = DOM.chatInput.value.trim();
    if (!text || !appState.selectedProjectId) return;

    const author = {
        uid: appState.user.uid,
        nickname: appState.profile.nickname,
        avatarURL: appState.profile.avatarURL || null,
    };

    try {
        await addChatMessage(appState.selectedProjectId, author, text);
        DOM.chatInput.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
        showToast("Failed to send message.", "error");
    }
}

async function handleAddProject(e) {
    e.preventDefault();
    const projectName = DOM.newProjectInput.value.trim();
    if (!projectName || !appState.company || !appState.user) return;

    try {
        await addProject({
            name: projectName,
            companyId: appState.company.id,
            createdAt: new Date().toISOString()
        });
        showToast(`Chat room "${projectName}" created!`, 'success');
        DOM.newProjectInput.value = '';
    } catch (error) {
        console.error("Error adding project/chat room:", error);
        showToast("Failed to create new chat room.", 'error');
    }
}

function handleJoinVoiceRoom(roomName) {
    showToast(`Attempting to join voice room: ${roomName}...`, 'info');
    console.log(`VOIP: User ${appState.user.uid} is attempting to join voice room: ${roomName}`);
    // This is where the complex WebRTC logic would be implemented.
    // 1. Get user's media stream (microphone) using navigator.mediaDevices.getUserMedia().
    // 2. Connect to a signaling server (e.g., using WebSockets) to exchange connection info.
    // 3. Create an RTCPeerConnection and add the media stream to it.
    // 4. Handle ICE candidates and SDP offers/answers.
    // 5. When a connection is established, render the remote user's audio stream.
    console.log("VOIP: This is a placeholder. A full WebRTC implementation requires a signaling server and STUN/TURN servers.");
}
