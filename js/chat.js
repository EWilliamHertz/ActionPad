// FILE: js/chat.js
// This file contains all logic for the dedicated chat page, including text chat and WebRTC voice chat.

// --- Import necessary Firebase services ---
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore, doc, collection, onSnapshot, updateDoc,
    setDoc, getDoc, deleteDoc, serverTimestamp, writeBatch,
    addDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, auth } from './firebase-config.js';

// --- Import your existing helper/service modules ---
import { signOut } from './services/auth.js';
import { getUserProfile } from './services/user.js';
import { getCompany } from './services/company.js';
import { listenToCompanyProjects } from './services/project.js';
import { listenToCompanyPresence } from './services/presence.js';
import { listenToProjectChat, addChatMessage } from './services/chat.js';
import { showToast } from './toast.js';

// --- STATE MANAGEMENT ---
const appState = {
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
        voiceRoomPeerListeners: new Map(),
    },
    localStream: null,
    peerConnections: {}, // Stores { pc, listener, iceCandidateQueue } for each peer
    currentVoiceRoom: null,
    voiceRoomUnsubscribe: null, // Listener for peers in the current room
    voiceActivityDetectors: new Map(), // Stores { context, animationFrameId }
    isAudioUnlocked: false, // Flag to track if user has interacted
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

    // Add the one-time click listener to unlock audio
    document.body.addEventListener('click', unlockAllAudio, { once: true });
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
        if (appState.currentVoiceRoom) {
            const roomEl = DOM.voiceRoomList.querySelector(`.voice-room-item[data-room-name="${appState.currentVoiceRoom}"]`);
            if (roomEl) {
                 const membersDiv = roomEl.querySelector('.voice-room-members');
                 const peerIds = Array.from(membersDiv.children).map(child => child.id.replace('avatar-', ''));
                 renderVoiceRoomMembers(appState.currentVoiceRoom, peerIds);
            }
        }
    });

    const voiceRoomsCollectionRef = collection(db, 'rooms');
    appState.listeners.voiceRooms = onSnapshot(voiceRoomsCollectionRef, (snapshot) => {
        const roomsData = new Map();
        snapshot.docs.forEach(doc => roomsData.set(doc.id, []));

        const peerPromises = snapshot.docs.map(roomDoc =>
            getDocs(collection(db, 'rooms', roomDoc.id, 'peers')).then(peersSnapshot => {
                const peerIds = peersSnapshot.docs.map(peerDoc => peerDoc.id);
                roomsData.set(roomDoc.id, peerIds);
            })
        );
        
        Promise.all(peerPromises).then(() => {
            roomsData.forEach((peerIds, roomId) => {
                renderVoiceRoomMembers(roomId, peerIds);
            });
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

function renderVoiceRoomMembers(roomName, peerIds) {
    const roomEl = DOM.voiceRoomList.querySelector(`.voice-room-item[data-room-name="${roomName}"]`);
    if (!roomEl) return;

    const membersDiv = roomEl.querySelector('.voice-room-members');
    if (!membersDiv) return;

    if (peerIds.length > 0) {
        membersDiv.innerHTML = peerIds.map(uid => {
            const userProfile = appState.team.find(m => m.id === uid);
            const nickname = userProfile?.nickname || 'User';
            const avatarSrc = userProfile?.avatarURL || `https://placehold.co/32x32/E9ECEF/495057?text=${nickname.charAt(0).toUpperCase()}`;
            return `
                <div class="avatar-small" id="avatar-${uid}" title="${nickname}">
                    <img src="${avatarSrc}" alt="${nickname}">
                </div>`;
        }).join('');
    } else {
        membersDiv.innerHTML = '';
    }
}

// --- CORE LOGIC FUNCTIONS ---

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

async function handleSendMessage(e) {
    e.preventDefault();
    const text = DOM.chatInput.value.trim();
    if (!text || !appState.selectedProjectId) return;
    const author = {
        uid: appState.user.uid,
        nickname: appState.profile.nickname,
        avatarURL: appState.profile.avatarURL || null
    };
    try {
        await addChatMessage(appState.selectedProjectId, author, text);
        DOM.chatInput.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
        showToast("Failed to send message.", "error");
    }
}

// =================================================================
// --- VOICE CHAT (WebRTC) LOGIC ---
// =================================================================

function unlockAllAudio() {
    if (appState.isAudioUnlocked) return;
    console.log("Unlocking audio due to user interaction...");
    const audioElements = DOM.remoteAudioContainer.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.muted = false;
        audio.play().catch(error => console.error(`Could not play audio ${audio.id}:`, error));
    });
    appState.isAudioUnlocked = true;
    showToast("Audio enabled!", "success");
}

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

    await setDoc(doc(peersCollection, appState.user.uid), {
        id: appState.user.uid,
        nickname: appState.profile.nickname,
        joinedAt: serverTimestamp()
    });

    appState.voiceRoomUnsubscribe = onSnapshot(peersCollection, (snapshot) => {
        renderVoiceRoomMembers(roomName, snapshot.docs.map(d => d.id));
        for (const change of snapshot.docChanges()) {
            const peerId = change.doc.id;
            if (peerId === appState.user.uid) continue;
            if (change.type === 'added') createPeerConnection(peerId, roomName, true);
            else if (change.type === 'removed') removeParticipant(peerId);
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

    if (appState.voiceRoomUnsubscribe) appState.voiceRoomUnsubscribe();
    Object.values(appState.peerConnections).forEach(({ pc, listener }) => {
        pc.close();
        if (listener) listener();
    });
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

    await deleteDoc(doc(db, 'rooms', roomName, 'peers', appState.user.uid));
    DOM.remoteAudioContainer.innerHTML = '';
    
    showToast(`Left voice room: ${roomName}`, 'info');
    appState.currentVoiceRoom = null;
    updateVoiceRoomUI();
}

async function createPeerConnection(remoteUserId, roomId, isOffering = false) {
    if (appState.peerConnections[remoteUserId]) return;

    const pc = new RTCPeerConnection(rtcConfiguration);
    appState.peerConnections[remoteUserId] = { pc, listener: null, iceCandidateQueue: [] };
    
    // Add logging for connection states
    pc.oniceconnectionstatechange = () => console.log(`ICE connection state for ${remoteUserId}: ${pc.iceConnectionState}`);
    pc.onconnectionstatechange = () => console.log(`Connection state for ${remoteUserId}: ${pc.connectionState}`);
    pc.onsignalingstatechange = () => console.log(`Signaling state for ${remoteUserId}: ${pc.signalingState}`);

    appState.localStream.getTracks().forEach(track => pc.addTrack(track, appState.localStream));

    pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
            addRemoteAudio(remoteUserId, event.streams[0]);
        }
    };

    const roomRef = doc(db, 'rooms', roomId);
    const localPeerRef = doc(roomRef, 'peers', appState.user.uid);
    const remotePeerRef = doc(roomRef, 'peers', remoteUserId);

    pc.onicecandidate = event => {
        if (event.candidate) addDoc(collection(localPeerRef, 'candidates'), event.candidate.toJSON());
    };

    onSnapshot(collection(remotePeerRef, 'candidates'), snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(candidate);
                } else {
                    appState.peerConnections[remoteUserId].iceCandidateQueue.push(candidate);
                }
            }
        });
    });

    appState.peerConnections[remoteUserId].listener = onSnapshot(remotePeerRef, async (docSnapshot) => {
        const data = docSnapshot.data();
        if (data && data.offer && pc.signalingState === 'stable') {
            console.log(`Received offer from ${remoteUserId}, creating answer.`);
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            const queue = appState.peerConnections[remoteUserId].iceCandidateQueue;
            while(queue.length > 0) await pc.addIceCandidate(queue.shift());

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(localPeerRef, { answer: { type: answer.type, sdp: answer.sdp } });

        } else if (data && data.answer && pc.signalingState === 'have-local-offer') {
             console.log(`Received answer from ${remoteUserId}.`);
             await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
             
             const queue = appState.peerConnections[remoteUserId].iceCandidateQueue;
             while(queue.length > 0) await pc.addIceCandidate(queue.shift());
        }
    });

    if (isOffering) {
        console.log(`Creating offer for ${remoteUserId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateDoc(localPeerRef, { offer: { type: offer.type, sdp: offer.sdp } });
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

    console.log(`Adding remote audio for ${peerId}. Audio unlocked: ${appState.isAudioUnlocked}`);
    const audio = document.createElement('audio');
    audio.id = `audio-${peerId}`;
    audio.srcObject = stream;
    audio.playsInline = true; 
    audio.autoplay = true;
    audio.muted = !appState.isAudioUnlocked; 

    DOM.remoteAudioContainer.appendChild(audio);

    if (appState.isAudioUnlocked) {
        audio.play().catch(error => console.error(`Error playing immediate audio for peer ${peerId}:`, error));
    }

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
            if (speakingCooldown > 0) speakingCooldown--;
            else element.classList.remove('speaking');
        }
        animationFrameId = requestAnimationFrame(detect);
    };
    detect();
    appState.voiceActivityDetectors.set(userId, { context: audioContext, animationFrameId });
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
