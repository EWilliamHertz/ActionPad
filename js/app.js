// FILE: js/app.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    signOut, getUserProfile, getCompany, listenToCompanyTasks, listenToCompanyProjects,
    manageUserPresence, listenToCompanyPresence
} from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import * as uiManager from './uiManager.js';
import * as taskController from './taskController.js';
import { showToast } from './toast.js';

const appState = {
    user: null, profile: null, company: null, team: [], projects: [], tasks: [],
    currentView: 'list-view', currentProjectId: 'all', searchTerm: ''
};

// **THE FIX**: Wrap all logic in a DOMContentLoaded listener.
// This ensures that the script does not run until the entire HTML page is loaded and ready.
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user && user.emailVerified) {
            appState.user = user;
            initialize();
        } else {
            // If user is not logged in or not verified, ensure they are on the login page.
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
                window.location.replace('login.html');
            }
        }
    });
});


/**
 * Retries fetching a user profile to solve race conditions on registration.
 */
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


async function initialize() {
    try {
        const profileSnap = await getUserProfileWithRetry(appState.user.uid);
        appState.profile = { uid: appState.user.uid, ...profileSnap.data() };
        
        const companySnap = await getCompany(appState.profile.companyId);
        if (!companySnap.exists()) throw new Error("Company data not found.");
        appState.company = {id: companySnap.id, ...companySnap.data()};
        
        taskController.initTaskController(appState);
        uiManager.initUIManager(appState);
        setupUI();
        
        listenToCompanyProjects(appState.profile.companyId, (projects) => {
            appState.projects = projects;
            uiManager.renderProjectList(appState.projects, appState.currentProjectId);
        });
        
        // Listen to all tasks for the company initially
        listenToCompanyTasks(appState.profile.companyId, 'all', (tasks) => {
            appState.tasks = tasks;
            uiManager.renderView(appState.currentView, filterTasks(appState.tasks, appState.searchTerm));
        });
        
        listenToCompanyPresence(appState.profile.companyId, (users) => {
            appState.team = users;
            uiManager.renderTeamList(appState.team);
        });
        
        manageUserPresence(appState.user);
        document.getElementById('app-container').classList.remove('hidden');
        
    } catch (error) {
        // **RESTORED**: The automatic sign-out is now re-enabled.
        console.error("Initialization Failed:", error);
        showToast(error.message || 'Could not initialize the application.', 'error');
        signOut(); 
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
    
    document.getElementById('share-invite-button').addEventListener('click', () => {
        const inviteLink = `${window.location.origin}/register.html?ref=${appState.company.referralId}`;
        uiManager.openInviteModal(inviteLink);
    });
    
    document.getElementById('hamburger-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    document.getElementById('search-bar').addEventListener('input', (e) => {
        appState.searchTerm = e.target.value;
        uiManager.renderView(appState.currentView, filterTasks(appState.tasks, appState.searchTerm));
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
