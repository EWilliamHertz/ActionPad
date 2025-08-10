// FILE: js/chat.js

// --- Import necessary Firebase services and the ALREADY INITIALIZED instances ---
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, collection, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, deleteDoc, serverTimestamp, writeBatch, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, auth } from './firebase-config.js';

// --- Import your existing services ---
import { signOut } from './services/auth.js';
import { getUserProfile } from './services/user.js';
import { getCompany } from './services/company.js';
import { listenToCompanyProjects } from './services/project.js';
import { listenToCompanyPresence } from './services/presence.js';
import { listenToProjectChat, addChatMessage } from './services/chat.js';
import { showToast } from './toast.js';

// --- STATE MANAGEMENT ---
let appState = {
    user: null,
    profile: null,
    company: null,
    projects: [],
    team: [],
    selectedProjectId: null,
    listeners: {
        projects: null,
        team: null,
        voiceRooms: null,
        chat: null,
        // Map to store unsubscribe functions for each voice room's peer listener
        voiceRoomPeerListeners: new Map(),
    },
    localStream: null,
    peerConnections: {},
    currentVoiceRoom: null,
    voiceRoomUnsubscribe: null,
    voiceActivityDetectors: new Map(),
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
    remoteAudioContainer: document.getElementById('remote-audio-container'),
};

// --- WebRTC Configuration ---
const rtcConfiguration = {
    iceServers: [{
        urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
        ],
    }, ],
};


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
    if (!companyId) {
        window.location.replace('dashboard.html');
        return;
    }
    const companySnap = await getCompany(companyId);
    if (!companySnap.exists()) throw new Error("Company not found.");
    appState.company = { id: companySnap.id, ...companySnap.data() };

    setupUIEvents();
    setupListeners();
}

function setupListeners() {
    // Detach any existing listeners to prevent duplicates
    Object.values(appState.listeners).forEach(listener => {
        if (typeof listener === 'function') listener();
    });
    appState.listeners.voiceRoomPeerListeners.forEach(unsub => unsub());
    appState.listeners.voiceRoomPeerListeners.clear();


    appState.listeners.projects = listenToCompanyProjects(appState.company.id, (projects) => {
        appState.projects = projects;
        renderProjectList();
        if (!appState.selectedProjectId && projects.length > 0) {
            switchProject(projects[0].id);
        }
    });

    appState.listeners.team = listenToCompanyPresence(appState.company.id, (team) => {
        appState.team = team;
        renderTeamList();
    });

    // CORRECTED: This listener now manages individual peer listeners for each room
    const voiceRoomsCollectionRef = collection(db, 'rooms');
    appState.listeners.voiceRooms = onSnapshot(voiceRoomsCollectionRef, (snapshot) => {
        const currentRoomIds = new Set(snapshot.docs.map(doc => doc.id));

        // Set up new listeners for added rooms
        currentRoomIds.forEach(roomId => {
            if (!appState.listeners.voiceRoomPeerListeners.has(roomId)) {
                const peersCollectionRef = collection(db, 'rooms', roomId, 'peers');
                const unsubscribe = onSnapshot(peersCollectionRef, (peersSnapshot) => {
                    const peerIds = peersSnapshot.docs.map(peerDoc => peerDoc.id);
                    renderVoiceRoomMembers(roomId, peerIds);
                });
                appState.listeners.voiceRoomPeerListeners.set(roomId, unsubscribe);
            }
        });

        // Clean up listeners for removed rooms
        appState.listeners.voiceRoomPeerListeners.forEach((unsubscribe, roomId) => {
            if (!currentRoomIds.has(roomId)) {
                unsubscribe();
                appState.listeners.voiceRoomPeerListeners.delete(roomId);
            }
        });
    });
}


// --- UI EVENT HANDLERS ---
function setupUIEvents() {
    document.getElementById('logout-button').addEventListener('click', async () => {
        await handleLeaveVoiceRoom();
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
            e.stopPropagation();
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

// This is now the single source of truth for rendering voice room members
function renderVoiceRoomMembers(roomName, peerIds) {
    const roomEl = DOM.voiceRoomList.querySelector(`.voice-room-item[data-room-name="${roomName}"]`);
    if (!roomEl) return;

    const membersDiv = roomEl.querySelector('.voice-room-members');
    if (!membersDiv) return;

    if (peerIds.length > 0) {
        membersDiv.innerHTML = peerIds.map(uid => {
            const user = appState.team.find(m => m.id === uid);
            if (!user) return ''; // Don't render if user data isn't loaded yet
            const avatarSrc = user.avatarURL || `https://placehold.co/32x32/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;
            return `
                <div class="avatar-small" id="avatar-${uid}" title="${user.nickname}">
                    <img src="${avatarSrc}" alt="${user.nickname}">
                </div>`;
        }).join('');
    } else {
        membersDiv.innerHTML = ''; // Clear if no members
    }
}


// =================================================================
// --- VOICE CHAT (WebRTC) LOGIC ---
// =================================================================

async function handleJoinVoiceRoom(roomName) {
    if (appState.currentVoiceRoom) await handleLeaveVoiceRoom();

    try {
        appState.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    } catch (err) {
        console.error("Failed to get audio stream:", err);
        return showToast("Microphone access denied. Please check settings.", "error");
    }

    appState.currentVoiceRoom = roomName;
    const roomRef = doc(db, 'rooms', roomName);
    const peersCollection = collection(roomRef, 'peers');

    const selfRef = doc(peersCollection, appState.user.uid);
    await setDoc(selfRef, {
        id: appState.user.uid,
        nickname: appState.profile.nickname,
        joinedAt: serverTimestamp()
    });

    appState.voiceRoomUnsubscribe = onSnapshot(peersCollection, (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const peerId = change.doc.id;
            if (peerId === appState.user.uid) continue;

            if (change.type === 'added') {
                console.log(`Peer ${peerId} joined. Creating offer.`);
                createPeerConnection(peerId, roomName, true);
            } else if (change.type === 'removed') {
                console.log(`Peer ${peerId} left.`);
                removeParticipant(peerId);
            }
        }
        
        const localAvatar = document.querySelector(`#avatar-${appState.user.uid}`);
        if(localAvatar && appState.localStream) {
             setupVoiceActivityDetector(appState.localStream, localAvatar, appState.user.uid);
        }
    });

    updateVoiceRoomUI();
    showToast(`Joined voice room: ${roomName}`, 'success');
}

async function handleLeaveVoiceRoom() {
    if (!appState.currentVoiceRoom) return;

    const roomName = appState.currentVoiceRoom;
    console.log(`Leaving room: ${roomName}`);

    if (appState.voiceRoomUnsubscribe) {
        appState.voiceRoomUnsubscribe();
        appState.voiceRoomUnsubscribe = null;
    }

    Object.values(appState.peerConnections).forEach(({ pc }) => pc.close());
    appState.peerConnections = {};

    if (appState.localStream) {
        appState.localStream.getTracks().forEach(track => track.stop());
        appState.localStream = null;
    }
    
    appState.voiceActivityDetectors.forEach(({ context, animationFrameId }) => {
        cancelAnimationFrame(animationFrameId);
        if (context.state !== 'closed') context.close();
    });
    appState.voiceActivityDetectors.clear();

    const selfRef = doc(db, 'rooms', roomName, 'peers', appState.user.uid);
    await deleteDoc(selfRef);
    
    DOM.remoteAudioContainer.innerHTML = '';
    
    showToast(`Left voice room: ${roomName}`, 'info');
    appState.currentVoiceRoom = null;
    updateVoiceRoomUI();
}

async function createPeerConnection(remoteUserId, roomId, isOffering = false) {
    if (appState.peerConnections[remoteUserId]) {
        console.warn(`Connection to ${remoteUserId} already exists.`);
        return;
    }

    console.log(`Creating peer connection to ${remoteUserId}`);
    const pc = new RTCPeerConnection(rtcConfiguration);
    
    appState.peerConnections[remoteUserId] = { pc, listener: null };

    appState.localStream.getTracks().forEach(track => pc.addTrack(track, appState.localStream));

    pc.ontrack = event => {
        console.log(`Track received from ${remoteUserId}`);
        if (event.streams && event.streams[0]) {
            addRemoteAudio(remoteUserId, event.streams[0]);
        }
    };

    const roomRef = doc(db, 'rooms', roomId);
    const localPeerRef = doc(roomRef, 'peers', appState.user.uid);
    const remotePeerRef = doc(roomRef, 'peers', remoteUserId);

    pc.onicecandidate = event => {
        if (event.candidate) {
            addDoc(collection(localPeerRef, 'candidates'), event.candidate.toJSON());
        }
    };

    onSnapshot(collection(remotePeerRef, 'candidates'), snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(candidate);
                }
            }
        });
    });

    appState.peerConnections[remoteUserId].listener = onSnapshot(remotePeerRef, async (docSnapshot) => {
        const data = docSnapshot.data();
        if (!pc.currentRemoteDescription && data?.offer) {
            console.log(`Received offer from ${remoteUserId}, creating answer.`);
            const offer = new RTCSessionDescription(data.offer);
            await pc.setRemoteDescription(offer);

            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
            await updateDoc(localPeerRef, { answer });
        }

        if (data?.answer && pc.signalingState !== "stable") {
             console.log(`Received answer from ${remoteUserId}.`);
             const answer = new RTCSessionDescription(data.answer);
             await pc.setRemoteDescription(answer);
        }
    });

    if (isOffering) {
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);
        const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
        await updateDoc(localPeerRef, { offer });
    }
}


// --- UI & UTILITY FUNCTIONS ---

function removeParticipant(peerId) {
    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();

    if (appState.peerConnections[peerId]) {
        appState.peerConnections[peerId].pc.close();
        if (appState.peerConnections[peerId].listener) {
            appState.peerConnections[peerId].listener();
        }
        delete appState.peerConnections[peerId];
    }
    
    stopVoiceActivityDetector(peerId);
}

function addRemoteAudio(peerId, stream) {
    if (document.getElementById(`audio-${peerId}`)) return;

    const audio = document.createElement('audio');
    audio.id = `audio-${peerId}`;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    DOM.remoteAudioContainer.appendChild(audio);

    const avatar = document.getElementById(`avatar-${peerId}`);
    if (avatar) {
        setupVoiceActivityDetector(stream, avatar, peerId);
    }
}

function setupVoiceActivityDetector(stream, element, userId) {
    stopVoiceActivityDetector(userId);

    const audioContext = new(window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const speakingThreshold = 10;
    let speakingCooldown = 0;
    let animationFrameId;

    const detect = () => {
        if (!document.body.contains(element)) {
            stopVoiceActivityDetector(userId);
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        let average = sum / bufferLength;

        if (average > speakingThreshold) {
            element.classList.add('speaking');
            speakingCooldown = 30;
        } else {
            if (speakingCooldown > 0) {
                speakingCooldown--;
            } else {
                element.classList.remove('speaking');
            }
        }
        animationFrameId = requestAnimationFrame(detect);
        appState.voiceActivityDetectors.set(userId, { context: audioContext, animationFrameId });
    };
    detect();
}

function stopVoiceActivityDetector(userId) {
    if (appState.voiceActivityDetectors.has(userId)) {
        const { context, animationFrameId } = appState.voiceActivityDetectors.get(userId);
        cancelAnimationFrame(animationFrameId);
        if(context.state !== 'closed') context.close();
        appState.voiceActivityDetectors.delete(userId);
    }
}

function updateVoiceRoomUI() {
    DOM.voiceRoomList.querySelectorAll('.voice-room-item').forEach(el => {
        const roomName = el.dataset.roomName;
        const btn = el.querySelector('.join-voice-room-btn');
        if (appState.currentVoiceRoom === roomName) {
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


// --- ORIGINAL CHAT & PROJECT FUNCTIONS ---

function switchProject(projectId) {
    if (appState.listeners.chat) appState.listeners.chat();
    appState.selectedProjectId = projectId;
    const project = appState.projects.find(p => p.id === projectId);
    DOM.chatProjectName.textContent = project ? project.name : 'Select a Project';
    document.querySelectorAll('.project-item-chat').forEach(item => {
        item.classList.toggle('active', item.dataset.projectId === projectId);
    });
    DOM.chatMessages.innerHTML = '<div class="loader">Loading messages...</div>';
    appState.listeners.chat = listenToProjectChat(projectId, (messages) => {
        renderChatMessages(messages);
    });
}

function renderProjectList() {
    if (!DOM.projectList) return;
    DOM.projectList.innerHTML = '';
    appState.projects.forEach(project => {
        const listItem = document.createElement('div');
        listItem.className = `project-item-chat ${appState.selectedProjectId === project.id ? 'active' : ''}`;
        listItem.dataset.projectId = project.id;
        listItem.innerHTML = `<span class="project-icon">#</span><span>${project.name}</span>`;
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
        item.innerHTML = `<img src="${member.avatarURL || `https://placehold.co/36x36/E9ECEF/495057?text=${member.nickname.charAt(0).toUpperCase()}`}" alt="${member.nickname}" class="avatar-img"><span style="font-weight: 500;">${member.nickname}</span>`;
        DOM.teamList.appendChild(item);
    });
}

function renderChatMessages(messages) {
    DOM.chatMessages.innerHTML = '';
    if (messages.length === 0) {
        DOM.chatMessages.innerHTML = '<div class="loader">Start the conversation!</div>';
        return;
    }
    messages.forEach(message => {
        const isSelf = message.author.uid === appState.user.uid;
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message-full ${isSelf ? 'is-self' : ''}`;
        const avatarSrc = message.author.avatarURL || `https://placehold.co/40x40/E9ECEF/495057?text=${message.author.nickname.charAt(0).toUpperCase()}`;
        const timestamp = message.createdAt ? message.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        messageEl.innerHTML = `<img src="${avatarSrc}" alt="${message.author.nickname}" class="chat-avatar"><div class="chat-message-content"><div class="chat-message-header"><span class="chat-author">${message.author.nickname}</span><span class="chat-timestamp">${timestamp}</span></div><div class="chat-text">${message.text}</div></div>`;
        DOM.chatMessages.appendChild(messageEl);
    });
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

async function handleSendMessage(e) {
    e.preventDefault();
    const text = DOM.chatInput.value.trim();
    if (!text || !appState.selectedProjectId) return;
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname, avatarURL: appState.profile.avatarURL || null };
    try {
        await addChatMessage(appState.selectedProjectId, author, text);
        DOM.chatInput.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
        showToast("Failed to send message.", "error");
    }
}
