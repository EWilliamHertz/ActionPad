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
    onAuthStateChanged(auth, async user => {
        if (user && user.emailVerified) {
            appState.user = user;
            const profileSnap = await getUserProfile(user.uid);
            if (!profileSnap.exists()) {
                showToast("User profile not found!", "error");
                signOut();
                return;
            }
            const profile = profileSnap.data();
            
            // NEW: Multi-company logic
            const companies = profile.companies || [];
            if (companies.length > 1 && !localStorage.getItem('selectedCompanyId')) {
                // If user is in multiple companies and hasn't chosen one, go to dashboard
                window.location.replace('dashboard.html');
            } else if (companies.length === 0) {
                 // If user has no companies, go to dashboard to create/join one
                 window.location.replace('dashboard.html');
            }
            else {
                // Load the selected company, or the first one by default
                const companyIdToLoad = localStorage.getItem('selectedCompanyId') || companies[0]?.companyId;
                if(companyIdToLoad) {
                    initialize(companyIdToLoad);
                } else {
                    // This case handles a user with a malformed profile (no companies array). Redirect to dashboard.
                    window.location.replace('dashboard.html');
                }
            }
        } else {
            // If user is not logged in, redirect to login page
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

async function initialize(companyId) {
    try {
        console.log(`Initialization started for company: ${companyId}`);

        const profileSnap = await getUserProfileWithRetry(appState.user.uid);
        const fullProfile = profileSnap.data();
        const companyMembership = fullProfile.companies.find(c => c.companyId === companyId);

        if (!companyMembership) {
            throw new Error("You are not a member of this company.");
        }

        appState.profile = { 
            uid: appState.user.uid, 
            ...fullProfile,
            // Add current company role to top-level of profile for easy access
            companyRole: companyMembership.role 
        };
        
        const companySnap = await getCompany(companyId);
        if (!companySnap.exists()) throw new Error("Company data not found.");
        appState.company = {id: companySnap.id, ...companySnap.data()};
        
        taskController.initTaskController(appState);
        uiManager.initUIManager(appState);

        setupUI();
        setupListeners();
        manageUserPresence(appState.user, companyId);
        
        document.getElementById('app-container').classList.remove('hidden');
        console.log("Initialization complete. App is ready.");
        
    } catch (error) {
        console.error("CRITICAL INITIALIZATION FAILURE:", error);
        showToast(error.message || 'Could not initialize the application.', 'error');
        // Clear selected company on error and go to dashboard
        localStorage.removeItem('selectedCompanyId');
        window.location.href = 'dashboard.html';
    }
}

function setupListeners() {
    listenToCompanyProjects(appState.company.id, (projects) => {
        appState.projects = projects;
        uiManager.renderProjectList(appState.projects, appState.currentProjectId);
        if (appState.currentProjectId !== 'all') {
            const updatedProject = projects.find(p => p.id === appState.currentProjectId);
            if (updatedProject) {
                uiManager.updateProjectHeader(updatedProject);
            }
        }
    });
    
    switchProject('all');
    
    listenToCompanyPresence(appState.company.id, (users) => {
        appState.team = users;
        uiManager.renderTeamList(appState.team);
    });

    if (appState.chatListener) appState.chatListener();
    appState.chatListener = listenToCompanyChat(appState.company.id, (messages) => {
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

    appState.tasksListener = listenToCompanyTasks(appState.company.id, projectId, (tasks) => {
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
    
    document.getElementById('logout-button').addEventListener('click', () => {
        // Clear the selected company when logging out
        localStorage.removeItem('selectedCompanyId');
        signOut();
    });
    
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
            addChatMessage(appState.company.id, author, text)
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
