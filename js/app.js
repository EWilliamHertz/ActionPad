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

const appState = {
    user: null, profile: null, company: null, team: [], projects: [], tasks: [],
    currentView: 'list-view', currentProjectId: 'all', searchTerm: ''
};

onAuthStateChanged(auth, user => {
    if (user) {
        appState.user = user;
        initialize();
    } else {
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
            window.location.replace('login.html');
        }
    }
});

/**
 * **NEW**: Retries fetching a user profile to solve race conditions on registration.
 * @param {string} userId - The ID of the user to fetch.
 * @param {number} retries - The number of times to retry.
 * @param {number} delay - The delay in ms between retries.
 * @returns {Promise<DocumentSnapshot>}
 */
const getUserProfileWithRetry = async (userId, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        const profileSnap = await getUserProfile(userId);
        if (profileSnap.exists()) {
            return profileSnap;
        }
        // Wait before trying again
        await new Promise(res => setTimeout(res, delay));
    }
    throw new Error("User profile not found after multiple retries.");
};


async function initialize() {
    try {
        // **MODIFIED**: Use the new retry function to prevent race conditions.
        const profileSnap = await getUserProfileWithRetry(appState.user.uid);
        
        appState.profile = { uid: appState.user.uid, ...profileSnap.data() };
        
        const companySnap = await getCompany(appState.profile.companyId);
        if (!companySnap.exists()) throw new Error("Company not found.");
        
        appState.company = companySnap.data();
        
        taskController.initTaskController(appState);
        uiManager.initUIManager(appState);
        setupUI();
        
        listenToCompanyProjects(appState.profile.companyId, (projects) => {
            appState.projects = projects;
            // This function needs to be defined in uiManager.js
            // uiManager.renderProjectList(appState.projects, appState.currentProjectId);
        });
        
        listenToCompanyTasks(appState.profile.companyId, appState.currentProjectId, (tasks) => {
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
        console.error("Initialization Failed:", error);
        alert("Could not initialize the application. Signing out.");
        signOut();
    }
}

function setupUI() {
    initializeI18n();
    // This function needs to be defined in uiManager.js
    // uiManager.updateUserInfo(appState.profile);
    
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
        // This function needs to be defined in uiManager.js
        // uiManager.openInviteModal(inviteLink);
    });
    
    document.getElementById('hamburger-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    document.getElementById('search-bar').addEventListener('input', (e) => {
        appState.searchTerm = e.target.value;
        uiManager.renderView(appState.currentView, filterTasks(appState.tasks, appState.searchTerm));
    });

    // These functions need to be defined in taskController.js
    // taskController.setupProjectForm();
    taskController.setupTaskForm();
    
    uiManager.setupModals();
    uiManager.setupEventListeners();
}

function filterTasks(tasks, searchTerm) {
    if (!searchTerm) return tasks;
    const lowercasedTerm = searchTerm.toLowerCase();
    return tasks.filter(task => task.name.toLowerCase().includes(lowercasedTerm));
}
