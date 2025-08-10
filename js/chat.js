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

// Import necessary Firestore functions for signaling
import { doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion, collection, query, where, orderBy, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

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
    // New state for voice chat
    localStream: null,
    voiceRoomRef: null,
    peerConnections: new Map(),
    voiceRoomUsers: new Map(),
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

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
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

    setupListeners();
    setupUIEvents();
}

function setupListeners() {
    if (appState.projectListener) appState.projectListener();
    if (appState.teamListener) appState.teamListener();

    appState.projectListener = listenToCompanyProjects(appState.company.id, (projects) => {
        appState.projects = projects;
        renderProjectList();
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
        const joinBtn = e.target.closest('.join-voice-room-btn');
        if (joinBtn) {
            const roomName = joinBtn.closest('.voice-room-item').dataset.roomName;
            if (joinBtn.classList.contains('active')) {
                handleLeaveVoiceRoom(roomName, joinBtn);
            } else {
                handleJoinVoiceRoom(roomName, joinBtn);
            }
        }
    });
}

function switchProject(projectId) {
    if (appState.chatListener) appState.chatListener();
    if (appState.tasksListener) appState.tasksListener();

    appState.selectedProjectId = projectId;
    const project = appState.projects.find(p => p.id === projectId);
    
    DOM.chatProjectName.textContent = project ? project.name : 'General';
    
    document.querySelectorAll('.project-item-chat').forEach(item => {
        item.classList.toggle('active', item.dataset.projectId === projectId);
    });

    DOM.chatMessages.innerHTML = '<div class="loader">Loading...</div>';

    appState.tasksListener = listenToCompanyTasks(appState.company.id, projectId, (tasks) => {
        appState.tasks = tasks;
        appState.chatListener = listenToProjectChat(projectId, (messages) => {
            appState.messages = messages;
            renderChatContent(tasks, messages);
        });
    });
}

function renderChatContent(tasks, messages) {
    DOM.chatMessages.innerHTML = '';
    
    if (tasks.length > 0) {
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

    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function renderProjectList() {
    if (!DOM.projectList) return;
    DOM.projectList.innerHTML = '';
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
        });
        showToast(`Chat room "${projectName}" created!`, 'success');
        DOM.newProjectInput.value = '';
    } catch (error) {
        console.error("Error adding project/chat room:", error);
        showToast("Failed to create new chat room.", 'error');
    }
}

async function handleJoinVoiceRoom(roomName, button) {
    showToast(`Attempting to join voice room: ${roomName}...`, 'info');
    
    const uniqueRoomId = `${appState.company.id}_${roomName.replace(/\s+/g, '-')}`;
    const voiceRoomRef = doc(db, 'voice_rooms', uniqueRoomId);
    appState.voiceRoomRef = voiceRoomRef;

    try {
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        appState.localStream = localStream;

        const onRoomUpdate = async (snapshot) => {
            const data = snapshot.data();
            const users = data ? data.users || [] : [];
            const remoteUsers = users.filter(uid => uid !== appState.user.uid);
            
            appState.peerConnections.forEach((pc, uid) => {
                if (!remoteUsers.includes(uid)) {
                    pc.close();
                    appState.peerConnections.delete(uid);
                }
            });

            for (const remoteUserId of remoteUsers) {
                if (!appState.peerConnections.has(remoteUserId)) {
                    await startPeerConnection(remoteUserId, localStream, uniqueRoomId);
                }
            }
        };

        const unsubscribe = onSnapshot(voiceRoomRef, onRoomUpdate);
        
        await setDoc(voiceRoomRef, {
            users: arrayUnion(appState.user.uid),
            companyId: appState.company.id, // <-- Important for security rules
            createdAt: serverTimestamp()
        }, { merge: true });

        button.textContent = 'Leave';
        button.classList.add('active');
        button.style.backgroundColor = 'var(--priority-high)';
        showToast(`Joined voice room: ${roomName}!`, 'success');
        
    } catch (err) {
        console.error("Failed to get audio stream:", err);
        showToast("Microphone access denied. Please allow access to join.", "error");
        button.textContent = 'Join';
        button.classList.remove('active');
        button.style.backgroundColor = 'var(--primary-color)';
    }
}

async function startPeerConnection(remoteUserId, localStream, uniqueRoomId) {
    const peerConnection = new RTCPeerConnection(servers);
    appState.peerConnections.set(remoteUserId, peerConnection);
    
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    peerConnection.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
    };
    
    const candidatesCollection = collection(db, 'voice_rooms', uniqueRoomId, 'candidates');
    
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            await addDoc(candidatesCollection, {
                candidate: event.candidate.toJSON(),
                sender: appState.user.uid,
                receiver: remoteUserId,
            });
        }
    };
    
    onSnapshot(query(candidatesCollection, where("receiver", "==", appState.user.uid)), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data().candidate));
                } catch (e) {
                    console.error("Error adding received ICE candidate:", e);
                }
            }
        });
    });

    const offerDocRef = doc(db, 'voice_rooms', uniqueRoomId, 'offers', appState.user.uid);
    const answerDocRef = doc(db, 'voice_rooms', uniqueRoomId, 'answers', remoteUserId);

    onSnapshot(answerDocRef, async (snapshot) => {
        if (snapshot.exists()) {
            const answer = snapshot.data();
            if (!peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        }
    });
    
    if (appState.peerConnections.size > 0) { // Only create offer if we are initiating
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await setDoc(offerDocRef, offer.toJSON());
    }
}

async function handleLeaveVoiceRoom(roomName, button) {
    if (appState.localStream) {
        appState.localStream.getTracks().forEach(track => track.stop());
        appState.localStream = null;
    }

    if (appState.voiceRoomRef) {
        const roomDoc = await getDoc(appState.voiceRoomRef);
        if(roomDoc.exists()){
            const users = roomDoc.data().users || [];
            const updatedUsers = users.filter(uid => uid !== appState.user.uid);
            await updateDoc(appState.voiceRoomRef, { users: updatedUsers });

            if(updatedUsers.length === 0) {
                 await deleteDoc(appState.voiceRoomRef);
            }
        }
    }

    appState.peerConnections.forEach(pc => pc.close());
    appState.peerConnections.clear();
    appState.voiceRoomUsers.clear();
    appState.voiceRoomRef = null;

    showToast(`Left voice room: ${roomName}`, 'success');

    button.textContent = 'Join';
    button.classList.remove('active');
    button.style.backgroundColor = 'var(--primary-color)';
}
