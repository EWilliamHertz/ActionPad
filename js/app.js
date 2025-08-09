// FILE: js/app.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    signOut, getUserProfile, getCompany, listenToCompanyTasks, listenToCompanyProjects,
    manageUserPresence, listenToCompanyPresence, uploadProjectLogo, updateProject,
    listenToCompanyChat, addChatMessage
} from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import * as uiManager from './uiManager.js';
import * as taskController from './taskController.js';
import { showToast } from './toast.js';

const appState = {
    user: null, profile: null, company: null, team: [], projects: [], tasks: [],
    currentView: 'list-view', currentProjectId: 'all', searchTerm: '',
    tasksListener: null,
    chatListener: null,
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user && user.emailVerified) {
            appState.user = user;
            initialize();
        } else {
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
                window.location.replace('login.html');
            }
        }
    });
});

const getUserProfileWithRetry = async (userId, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        const profileSnap = await getUserProfile(userId);
        if (profileSnap.exists()) {
            return profileSnap;
        }
        await new Promise(res => setTimeout(res, delay));
    }
    throw new Error("Your user profile could not be found. Please contact support.");
};

// FIXED: Re-architected the entire initialization flow to be sequential and prevent race conditions.
async function initialize() {
    try {
        console.log("Initialization started...");

        // 1. Get User Profile
        const profileSnap = await getUserProfileWithRetry(appState.user.uid);
        appState.profile = { uid: appState.user.uid, ...profileSnap.data() };
        console.log("Step 1: Profile loaded", appState.profile);

        // 2. Get Company Info using the profile's companyId
        const companySnap = await getCompany(appState.profile.companyId);
        if (!companySnap.exists()) throw new Error("Company data not found.");
        appState.company = {id: companySnap.id, ...companySnap.data()};
        console.log("Step 2: Company loaded", appState.company);

        // 3. Initialize controllers with the now-complete state
        taskController.initTaskController(appState);
        uiManager.initUIManager(appState);

        // 4. Set up the main UI elements
        setupUI();
        console.log("Step 3: Main UI setup complete.");

        // 5. Set up all real-time listeners
        setupListeners();
        console.log("Step 4: All data listeners attached.");

        // 6. Set user presence to online
        manageUserPresence(appState.user);
        
        // Finally, show the application
        document.getElementById('app-container').classList.remove('hidden');
        console.log("Initialization complete. App is ready.");
        
    } catch (error) {
        console.error("CRITICAL INITIALIZATION FAILURE:", error);
        showToast(error.message || 'Could not initialize the application.', 'error');
        signOut(); 
    }
}

function setupListeners() {
    // Listen to projects
    listenToCompanyProjects(appState.profile.companyId, (projects) => {
        appState.projects = projects;
        uiManager.renderProjectList(appState.projects, appState.currentProjectId);
        if (appState.currentProjectId !== 'all') {
            const updatedProject = projects.find(p => p.id === appState.currentProjectId);
            if (updatedProject) {
                uiManager.updateProjectHeader(updatedProject);
            }
        }
    });
    
    // Set up the initial task listener
    switchProject('all');
    
    // Listen to team member presence
    listenToCompanyPresence(appState.profile.companyId, (users) => {
        appState.team = users;
        uiManager.renderTeamList(appState.team);
    });

    // Listen to company chat
    if (appState.chatListener) appState.chatListener();
    appState.chatListener = listenToCompanyChat(appState.profile.companyId, (messages) => {
        uiManager.renderChatMessages(messages, appState.user.uid);
    });
}


function switchProject(projectId) {
    appState.currentProjectId = projectId;
    
    if (appState.tasksListener) {
        appState.tasksListener(); 
    }
    
    uiManager.renderProjectList(appState.projects, projectId);
    if (projectId === 'all') {
        uiManager.hideProjectHeader();
    } else {
        const project = appState.projects.find(p => p.id === projectId);
        if (project) {
            uiManager.updateProjectHeader(project);
        }
    }

    appState.tasksListener = listenToCompanyTasks(appState.profile.companyId, projectId, (tasks) => {
        appState.tasks = tasks;
        uiManager.renderView(appState.currentView, filterTasks(appState.tasks, appState.searchTerm));
    });
}

async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file || appState.currentProjectId === 'all') return;

    showToast('Uploading logo...', 'success');
    try {
        const logoURL = await uploadProjectLogo(appState.currentProjectId, file);
        await updateProject(appState.currentProjectId, { logoURL });
        showToast('Logo updated!', 'success');
    } catch (error) {
        console.error("Logo upload failed:", error);
        showToast('Logo upload failed.', 'error');
    }
}

function setupUI() {
    initializeI18n();
    uiManager.updateUserInfo(appState.profile, appState.company);
    
    document.getElementById('logout-button').addEventListener('click', signOut);
    
    document.getElementById('view-switcher').addEventListener('click', (e) => {
        if (e.target.matches('.view-btn')) {
            appState.currentView = e.target.dataset.view;
            uiManager.switchView(appState.currentView);
            uiManager.renderView(appState.currentView, filterTasks(appState.tasks, appState.searchTerm));
        }
    });

    document.getElementById('project-list').addEventListener('click', (e) => {
        if (e.target.matches('.project-item')) {
            const projectId = e.target.dataset.projectId;
            if (projectId !== appState.currentProjectId) {
                switchProject(projectId);
            }
        }
    });
    
    const logoUploadInput = document.getElementById('logo-upload-input');
    const changeLogoBtn = document.getElementById('change-logo-btn');
    if(changeLogoBtn) changeLogoBtn.addEventListener('click', () => logoUploadInput.click());
    if(logoUploadInput) logoUploadInput.addEventListener('change', handleLogoUpload);

    document.getElementById('share-invite-button').addEventListener('click', () => {
        const currentPath = window.location.href;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        const inviteLink = `${basePath}register.html?ref=${appState.company.referralId}`;
        uiManager.openInviteModal(inviteLink);
    });
    
    document.getElementById('hamburger-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    document.getElementById('search-bar').addEventListener('input', (e) => {
        appState.searchTerm = e.target.value;
        uiManager.renderView(appState.currentView, filterTasks(appState.tasks, appState.searchTerm));
    });

    document.getElementById('team-chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('team-chat-input');
        const text = input.value.trim();
        if (text) {
            const author = {
                uid: appState.user.uid,
                nickname: appState.profile.nickname,
                avatarURL: appState.profile.avatarURL || null
            };
            addChatMessage(appState.profile.companyId, author, text)
                .catch(err => console.error("Error sending chat message:", err));
            input.value = '';
        }
    });

    taskController.setupProjectForm(appState);
    taskController.setupTaskForm();
    
    uiManager.setupModals();
    uiManager.setupEventListeners();
}

function filterTasks(tasks, searchTerm) {
    if (!searchTerm) return tasks;
    const lowercasedTerm = searchTerm.toLowerCase();
    return tasks.filter(task => task.name.toLowerCase().includes(lowercasedTerm));
}
