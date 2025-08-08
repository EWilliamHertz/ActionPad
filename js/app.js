// FILE: js/app.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    signOut, getUserProfile, getCompany, listenToCompanyTasks, listenToCompanyProjects,
    manageUserPresence, listenToCompanyPresence, uploadProjectLogo, updateProject
} from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import * as uiManager from './uiManager.js';
import * as taskController from './taskController.js';
import { showToast } from './toast.js';

const appState = {
    user: null, profile: null, company: null, team: [], projects: [], tasks: [],
    currentView: 'list-view', currentProjectId: 'all', searchTerm: '',
    tasksListener: null
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
            if (appState.currentProjectId !== 'all') {
                const updatedProject = projects.find(p => p.id === appState.currentProjectId);
                if (updatedProject) {
                    uiManager.updateProjectHeader(updatedProject);
                }
            }
        });
        
        switchProject('all');
        
        listenToCompanyPresence(appState.profile.companyId, (users) => {
            appState.team = users;
            uiManager.renderTeamList(appState.team);
        });
        
        manageUserPresence(appState.user);
        document.getElementById('app-container').classList.remove('hidden');
        
    } catch (error) {
        console.error("Initialization Failed:", error);
        showToast(error.message || 'Could not initialize the application.', 'error');
        signOut(); 
    }
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

    // **MODIFIED**: This now correctly constructs the URL for GitHub Pages.
    document.getElementById('share-invite-button').addEventListener('click', () => {
        // Get the current URL and find the last '/' to determine the base path.
        const currentPath = window.location.href;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        
        // Construct the correct link to the register page.
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
