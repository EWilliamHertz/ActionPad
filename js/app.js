// FILE: js/app.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signOut } from './services/auth.js';
import { getUserProfile } from './services/user.js';
import { getCompany } from './services/company.js';
import { listenToCompanyTasks } from './services/task.js';
import { listenToCompanyProjects, uploadProjectLogo, updateProject } from './services/project.js';
import { manageUserPresence, listenToCompanyPresence } from './services/presence.js';
import { listenToCompanyChat, addChatMessage } from './services/chat.js';
import { listenToNotifications, markNotificationsAsRead } from './services/notification.js';

import { initializeI18n, setLanguage } from './i18n.js';
import * as UImanager from './ui/uiManager.js';
import * as taskController from './taskController.js';
import { initCommandPalette } from './ui/commandPalette.js';
import { showToast } from './toast.js';

const appState = {
    user: null, profile: null, company: null, team: [], projects: [], tasks: [],
    notifications: [],
    currentView: 'list-view', currentProjectId: 'all', searchTerm: '',
    filterAssignee: 'all',
    sortTasks: 'createdAt-desc',
    tasksListener: null,
    projectsListener: null,
    presenceListener: null,
    chatListener: null,
    notificationsListener: null,
};

// Make appState globally accessible for the command palette
window.appState = appState;

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

            const companies = profile.companies || [];
            const companyIdToLoad = localStorage.getItem('selectedCompanyId') || companies[0]?.companyId;

            if (companyIdToLoad) {
                initialize(companyIdToLoad);
            } else {
                window.location.replace('dashboard.html');
            }
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
            companyRole: companyMembership.role // Set the role for the current company
        };

        const companySnap = await getCompany(companyId);
        if (!companySnap.exists()) throw new Error("Company data not found.");
        appState.company = {id: companySnap.id, ...companySnap.data()};

        taskController.initTaskController(appState);
        UImanager.initUIManager(appState);
        UImanager.initModalManager(appState);
        initCommandPalette(appState, { openModal: UImanager.openModal, switchProject });

        setupUI();
        setupListeners();
        manageUserPresence(appState.user, companyId);

        document.getElementById('app-container').classList.remove('hidden');
        console.log("Initialization complete. App is ready.");

    } catch (error) {
        console.error("CRITICAL INITIALIZATION FAILURE:", error);
        showToast(error.message || 'Could not initialize the application.', 'error');
        localStorage.removeItem('selectedCompanyId');
        window.location.href = 'dashboard.html';
    }
}

function setupListeners() {
    if (appState.projectsListener) appState.projectsListener();
    if (appState.presenceListener) appState.presenceListener();
    if (appState.chatListener) appState.chatListener();
    if (appState.notificationsListener) appState.notificationsListener();

    appState.projectsListener = listenToCompanyProjects(appState.company.id, (projects) => {
        appState.projects = projects;
        UImanager.renderProjectList(appState.projects, appState.currentProjectId);
        if (appState.currentProjectId !== 'all') {
            const updatedProject = projects.find(p => p.id === appState.currentProjectId);
            if (updatedProject) UImanager.updateProjectHeader(updatedProject);
        }
    });

    appState.presenceListener = listenToCompanyPresence(appState.company.id, (users) => {
        appState.team = users;
        UImanager.renderTeamList(appState.team, appState.user.uid);
        populateAssigneeFilter(users);
    });

    appState.chatListener = listenToCompanyChat(appState.company.id, (messages) => {
        UImanager.renderChatMessages(messages, appState.user.uid);
    });

    appState.notificationsListener = listenToNotifications(appState.user.uid, (notifications) => {
        appState.notifications = notifications;
    });

    switchProject('all');
}

function switchProject(projectId) {
    appState.currentProjectId = projectId;
    if (appState.tasksListener) appState.tasksListener();

    UImanager.renderProjectList(appState.projects, projectId);
    if (projectId === 'all') {
        UImanager.hideProjectHeader();
    } else {
        const project = appState.projects.find(p => p.id === projectId);
        if (project) UImanager.updateProjectHeader(project);
    }

    appState.tasksListener = listenToCompanyTasks(appState.company.id, projectId, (tasks) => {
        appState.tasks = tasks;
        renderFilteredTasks();
    });
}

function renderFilteredTasks() {
    const processedTasks = applyFiltersAndSorts(appState.tasks);
    UImanager.renderView(appState.currentView, processedTasks, appState);
}

function applyFiltersAndSorts(tasks) {
    let filteredTasks = [...tasks];

    // Search term filter
    if (appState.searchTerm) {
        const lowercasedTerm = appState.searchTerm.toLowerCase();
        filteredTasks = filteredTasks.filter(task => task.name.toLowerCase().includes(lowercasedTerm));
    }

    // Assignee filter
    if (appState.filterAssignee !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.assignedTo && task.assignedTo.includes(appState.filterAssignee));
    }

    // Sorting
    const [sortBy, direction] = appState.sortTasks.split('-');
    const dir = direction === 'asc' ? 1 : -1;
    const priorityMap = { high: 3, medium: 2, low: 1 };

    filteredTasks.sort((a, b) => {
        switch (sortBy) {
            case 'dueDate':
                return (new Date(a.dueDate || 0) - new Date(b.dueDate || 0)) * dir;
            case 'priority':
                return ((priorityMap[a.priority] || 0) - (priorityMap[b.priority] || 0)) * dir;
            case 'createdAt':
            default:
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return (timeA - timeB) * dir;
        }
    });

    return filteredTasks;
}

function setupUI() {
    initializeI18n();
    UImanager.updateUserInfo(appState.profile, appState.company);

    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('selectedCompanyId');
        signOut();
    });

    document.getElementById('view-switcher').addEventListener('click', (e) => {
        if (e.target.matches('.view-btn')) {
            appState.currentView = e.target.dataset.view;
            UImanager.switchView(appState.currentView);
            renderFilteredTasks();
        }
    });
    
    document.getElementById('project-list').addEventListener('click', (e) => {
        if (e.target.matches('.project-item')) {
            const projectId = e.target.dataset.projectId;
            if (projectId !== appState.currentProjectId) switchProject(projectId);
        }
    });

    document.getElementById('search-bar').addEventListener('input', (e) => {
        appState.searchTerm = e.target.value;
        renderFilteredTasks();
    });

    // Filter and Sort event listeners
    document.getElementById('filter-assignee').addEventListener('change', (e) => {
        appState.filterAssignee = e.target.value;
        renderFilteredTasks();
    });
    document.getElementById('sort-tasks').addEventListener('change', (e) => {
        appState.sortTasks = e.target.value;
        renderFilteredTasks();
    });

    // Other UI setups
    const logoUploadInput = document.getElementById('logo-upload-input');
    const changeLogoBtn = document.getElementById('change-logo-btn');
    if(changeLogoBtn) changeLogoBtn.addEventListener('click', () => logoUploadInput.click());
    if(logoUploadInput) logoUploadInput.addEventListener('change', handleLogoUpload);

    document.getElementById('share-invite-button').addEventListener('click', () => {
        const currentPath = window.location.href;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        const inviteLink = `${basePath}register.html?ref=${appState.company.referralId}`;
        UImanager.openModal(UImanager.DOM.inviteModal);
        document.getElementById('invite-link-input').value = inviteLink;
    });

    document.getElementById('hamburger-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('team-chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('team-chat-input');
        const text = input.value.trim();
        if (text) {
            const author = { uid: appState.user.uid, nickname: appState.profile.nickname, avatarURL: appState.profile.avatarURL || null };
            addChatMessage(appState.company.id, author, text);
            input.value = '';
        }
    });
    
    taskController.setupProjectForm(appState);
    taskController.setupTaskForm();
    UImanager.setupModals();
    UImanager.setupDragDrop();
}

function populateAssigneeFilter(team) {
    const select = document.getElementById('filter-assignee');
    select.innerHTML = '<option value="all">All Members</option>'; // Reset
    team.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.nickname;
        select.appendChild(option);
    });
    select.value = appState.filterAssignee; // Restore previous selection
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
