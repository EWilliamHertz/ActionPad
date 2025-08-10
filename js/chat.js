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
import { doc, collection, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, deleteDoc, query, where, serverTimestamp, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- STATE MANAGEMENT ---
let appState = {
    user: null, profile: null, company: null, projects: [], team: [],
    selectedProjectId: null,
    listeners: {}, // Central object to hold all unsubscribe functions
    localStream: null,
    peerConnections: new Map(), // key: remoteUserId, value: RTCPeerConnection
    currentVoiceRoom: null, // { name, uniqueId }
};

// --- DOM ELEMENTS ---
const DOM = {
    projectList: document.getElementById('project-list-container'),
    teamList: document.getElementById('team-list'),
    chatProjectName: document.getElementById('current-project-name'),
    chatMessages: document.getElementById('chat-messages-container'),
    chatForm: document.getElementById('chat-input-form'),
    chatInput: document.getElementById('chat-input'),
    pageContainer: document.getElementById('chat-page-container'),
    voiceRoomList: document.getElementById('voice-room-list'),
};

const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
const remoteAudioStreams = new Map();

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async user => {
        if (user) {
            appState.user = user;
            try {
                await initialize();
                DOM.pageContainer.classList.remove('hidden');
            } catch (error) {
                console.error("Initialization failed:", error);
                showToast(error.message, 'error');
                setTimeout(() => window.location.replace('dashboard.html'), 3000);
            }
        } else {
            window.location.replace('login.html');
        }
    });
});

async function initialize() {
    const profileSnap = await getUserProfile(appState.user.uid);
    if (!profileSnap.exists()) throw new Error("User profile not found.");
    appState.profile = { uid: appState.user.uid, ...profileSnap.data() };

    const companyId = localStorage.getItem('selectedCompanyId');
    if (!companyId) throw new Error("No company selected.");
    const companySnap = await getCompany(companyId);
    if (!companySnap.exists()) throw new Error("Company not found.");
    appState.company = { id: companySnap.id, ...companySnap.data() };

    setupUIEvents();
    setupListeners();
}

function cleanupListeners() {
    Object.values(appState.listeners).forEach(unsubscribe => unsubscribe && unsubscribe());
    appState.listeners = {};
}

function setupListeners() {
    cleanupListeners();
    appState.listeners.projects = listenToCompanyProjects(appState.company.id, (projects) => {
        appState.projects = projects;
        renderProjectList();
        if (!appState.selectedProjectId && projects.length > 0) switchProject(projects[0].id);
    });

    appState.listeners.team = listenToCompanyPresence(appState.company.id, (team) => {
        appState.team = team;
        renderTeamList();
        if (appState.currentVoiceRoom) {
            // Re-render voice rooms if team data changes (e.g., for avatars)
            const roomRef = doc(db, 'voice_rooms', appState.currentVoiceRoom.uniqueId);
            getDoc(roomRef).then(docSnap => {
                if(docSnap.exists()) renderVoiceRooms([docSnap.data()]);
            });
        }
    });

    const voiceRoomsQuery = query(collection(db, 'voice_rooms'), where('companyId', '==', appState.company.id));
    appState.listeners.voiceRooms = onSnapshot(voiceRoomsQuery, (snapshot) => {
        const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderVoiceRooms(roomsData);
    });
}

// --- UI EVENT HANDLERS ---
function setupUIEvents() {
    document.getElementById('logout-button').addEventListener('click', () => {
        handleLeaveVoiceRoom();
        signOut();
    });
    DOM.projectList.addEventListener('click', (e) => {
        const item = e.target.closest('.project-item-chat');
        if (item) switchProject(item.dataset.projectId);
    });
    DOM.chatForm.addEventListener('submit', handleSendMessage);

    DOM.voiceRoomList.addEventListener('click', (e) => {
        const joinBtn = e.target.closest('.join-voice-room-btn');
        if (joinBtn) {
            e.stopPropagation(); // Prevent dropdown from toggling
            const roomItem = joinBtn.closest('.voice-room-item');
            const roomName = roomItem.dataset.roomName;
            if (joinBtn.classList.contains('active')) {
                handleLeaveVoiceRoom();
            } else {
                handleJoinVoiceRoom(roomName);
            }
        }
        const roomMain = e.target.closest('.voice-room-main');
        if (roomMain) {
            const memberList = roomMain.nextElementSibling;
            if (memberList && memberList.classList.contains('voice-room-members')) {
                memberList.classList.toggle('hidden');
            }
        }
    });
}

// --- RENDER FUNCTIONS ---
function renderVoiceRooms(roomsData) {
    const staticRooms = Array.from(DOM.voiceRoomList.querySelectorAll('.voice-room-item'));
    staticRooms.forEach(roomEl => {
        const roomName = roomEl.dataset.roomName;
        const roomData = roomsData.find(r => r.name === roomName);
        const membersDiv = roomEl.querySelector('.voice-room-members');
        
        if (roomData && roomData.users && roomData.users.length > 0) {
            const membersHtml = roomData.users.map(uid => {
                const user = appState.team.find(m => m.id === uid);
                if (!user) return '';
                const avatarSrc = user.avatarURL || `https://placehold.co/28x28/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;
                return `<div class="avatar-small" title="${user.nickname}"><img src="${avatarSrc}" alt="${user.nickname}" style="width: 28px; height: 28px;"></div>`;
            }).join('');
            membersDiv.innerHTML = membersHtml;
        } else {
            membersDiv.innerHTML = '';
        }
    });
}

// --- VOICE CHAT (WebRTC) LOGIC ---
async function handleJoinVoiceRoom(roomName) {
    if (appState.currentVoiceRoom) await handleLeaveVoiceRoom();

    try {
        appState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        console.error("Failed to get audio stream:", err);
        return showToast("Microphone access denied. Please check browser/OS settings.", "error");
    }
    
    const uniqueId = `${appState.company.id}_${roomName.replace(/\s+/g, '-')}`;
    appState.currentVoiceRoom = { name: roomName, uniqueId };
    
    const roomRef = doc(db, 'voice_rooms', uniqueId);
    await setDoc(roomRef, { 
        name: roomName,
        companyId: appState.company.id, 
        users: arrayUnion(appState.user.uid) 
    }, { merge: true });

    appState.listeners.voiceRoomUsers = onSnapshot(roomRef, (doc) => {
        const users = doc.data()?.users || [];
        const remoteUsers = users.filter(uid => uid !== appState.user.uid);
        
        for (const remoteId of remoteUsers) {
            if (!appState.peerConnections.has(remoteId)) {
                createPeerConnection(remoteId);
            }
        }
        
        appState.peerConnections.forEach((pc, remoteId) => {
            if (!remoteUsers.includes(remoteId)) {
                pc.close();
                appState.peerConnections.delete(remoteId);
                const audioEl = remoteAudioStreams.get(remoteId);
                if (audioEl) audioEl.remove();
                remoteAudioStreams.delete(remoteId);
            }
        });
        renderVoiceRooms([{ id: uniqueId, ...doc.data() }]);
    });
    
    updateVoiceRoomUI();
}

async function handleLeaveVoiceRoom() {
    if (!appState.currentVoiceRoom) return;

    const { uniqueId, name } = appState.currentVoiceRoom;
    const roomRef = doc(db, 'voice_rooms', uniqueId);
    
    if (appState.listeners.voiceRoomUsers) appState.listeners.voiceRoomUsers();
    
    Object.keys(appState.listeners).forEach(key => {
        if(key.startsWith('pc_')) appState.listeners[key]();
    });

    appState.peerConnections.forEach(pc => pc.close());
    appState.peerConnections.clear();
    remoteAudioStreams.forEach(audio => audio.remove());
    remoteAudioStreams.clear();

    if (appState.localStream) {
        appState.localStream.getTracks().forEach(track => track.stop());
        appState.localStream = null;
    }

    await updateDoc(roomRef, { users: arrayRemove(appState.user.uid) });

    const roomSnap = await getDoc(roomRef);
    if ((roomSnap.data()?.users || []).length === 0) {
        const batch = writeBatch(db);
        const subcollections = ['offers', 'answers', 'candidates'];
        for (const sub of subcollections) {
            const subcollRef = collection(db, 'voice_rooms', uniqueId, sub);
            const snapshot = await getDocs(subcollRef);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
        }
        await batch.commit();
        await deleteDoc(roomRef);
    }

    showToast(`Left voice room: ${name}`, 'success');
    appState.currentVoiceRoom = null;
    updateVoiceRoomUI();
}

async function createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection(servers);
    appState.peerConnections.set(remoteId, pc);

    appState.localStream.getTracks().forEach(track => pc.addTrack(track, appState.localStream));

    pc.ontrack = event => {
        if (!remoteAudioStreams.has(remoteId)) {
            const audioEl = document.createElement('audio');
            audioEl.srcObject = event.streams[0];
            audioEl.autoplay = true;
            document.body.appendChild(audioEl);
            remoteAudioStreams.set(remoteId, audioEl);
        }
    };
    
    const { uniqueId } = appState.currentVoiceRoom;
    const signalingRef = collection(db, 'voice_rooms', uniqueId, 'signaling');
    
    pc.onicecandidate = event => {
        if (event.candidate) {
            addDoc(signalingRef, { from: appState.user.uid, to: remoteId, candidate: event.candidate.toJSON() });
        }
    };

    appState.listeners[`pc_${remoteId}`] = onSnapshot(query(signalingRef, where('to', '==', appState.user.uid), where('from', '==', remoteId)), (snapshot) => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (data.offer) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await addDoc(signalingRef, { from: appState.user.uid, to: remoteId, answer });
                } else if (data.answer) {
                    if (!pc.currentRemoteDescription) {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    }
                } else if (data.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        });
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await addDoc(signalingRef, { from: appState.user.uid, to: remoteId, offer });
}

function updateVoiceRoomUI() {
    DOM.voiceRoomList.querySelectorAll('.voice-room-item').forEach(el => {
        const roomName = el.dataset.roomName;
        const btn = el.querySelector('.join-voice-room-btn');
        if (appState.currentVoiceRoom?.name === roomName) {
            el.classList.add('active-room');
            btn.textContent = 'Leave';
            btn.classList.add('active');
        } else {
            el.classList.remove('active-room');
            btn.textContent = 'Join';
            btn.classList.remove('active');
        }
    });
}


// --- Functions below are unchanged but included for completeness ---
function switchProject(projectId) {
    if (appState.listeners.chat) appState.listeners.chat();
    if (appState.listeners.tasks) appState.listeners.tasks();

    appState.selectedProjectId = projectId;
    const project = appState.projects.find(p => p.id === projectId);
    
    DOM.chatProjectName.textContent = project ? project.name : 'General';
    
    document.querySelectorAll('.project-item-chat').forEach(item => {
        item.classList.toggle('active', item.dataset.projectId === projectId);
    });

    DOM.chatMessages.innerHTML = '<div class="loader">Loading...</div>';

    appState.listeners.tasks = listenToCompanyTasks(appState.company.id, projectId, (tasks) => {
        appState.tasks = tasks;
        appState.listeners.chat = listenToProjectChat(projectId, (messages) => {
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
    const projectName = document.getElementById('new-project-input-chat').value.trim();
    if (!projectName || !appState.company || !appState.user) return;

    try {
        await addProject({
            name: projectName,
            companyId: appState.company.id,
        });
        showToast(`Chat room "${projectName}" created!`, 'success');
        document.getElementById('new-project-input-chat').value = '';
    } catch (error) {
        console.error("Error adding project/chat room:", error);
        showToast("Failed to create new chat room.", 'error');
    }
}
