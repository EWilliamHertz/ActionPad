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
        if (!window.location.pathname.includes('login.html')) window.location.replace('login.html');
    }
});
async function initialize() {
    try {
        const profileSnap = await getUserProfile(appState.user.uid);
        if (!profileSnap.exists()) throw new Error("User profile not found.");
        appState.profile = { uid: appState.user.uid, ...profileSnap.data() };
        const companySnap = await getCompany(appState.profile.companyId);
        if (!companySnap.exists()) throw new Error("Company not found.");
        appState.company = companySnap.data();
        taskController.initTaskController(appState);
        uiManager.initUIManager(appState);
        setupUI();
        listenToCompanyProjects(appState.profile.companyId, (projects) => {
            appState.projects = projects;
            uiManager.renderProjectList(appState.projects, appState.currentProjectId);
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
    uiManager.updateUserInfo(appState.profile);
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
    taskController.setupProjectForm();
    taskController.setupTaskForm();
    uiManager.setupModals();
    uiManager.setupEventListeners();
}
function filterTasks(tasks, searchTerm) {
    if (!searchTerm) return tasks;
    const lowercasedTerm = searchTerm.toLowerCase();
    return tasks.filter(task => task.name.toLowerCase().includes(lowercasedTerm));
}
