// FILE: js/app.js
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { initializeI18n } from './i18n.js';
import * as UImanager from './ui/uiManager.js';
import * as taskController from './taskController.js';
import { initCommandPalette } from './ui/commandPalette.js';
import { showToast } from './toast.js';

console.log("App.js loaded, checking imports...");
console.log("Auth:", auth);
console.log("DB:", db);
console.log("Storage:", storage);

const appState = {
    user: null, profile: null, company: null, team: [], projects: [], tasks: [],
    notifications: [],
    currentView: 'list-view', currentProjectId: 'all', searchTerm: '',
    filterAssignee: 'all',
    sortTasks: 'createdAt-desc',
    tasksListener: null,
    projectsListener: null,
    presenceListener: null,
};

window.appState = appState;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async user => {
        if (user && user.emailVerified) {
            appState.user = user;
            const companyIdToLoad = localStorage.getItem('selectedCompanyId');
            if (companyIdToLoad) {
                initialize(companyIdToLoad);
            } else {
                // This is the safety net for private Browse
                window.location.replace('dashboard.html');
            }
        } else if (!user) {
            window.location.replace('login.html');
        }
    });
});

async function initialize(companyId) {
    try {
        console.log("Starting initialization with companyId:", companyId);
        
        const profileSnap = await getDoc(doc(db, 'users', appState.user.uid));
        if (!profileSnap.exists()) throw new Error("User profile not found.");
        console.log("Profile loaded successfully");

        const fullProfile = profileSnap.data();
        const companyMembership = fullProfile.companies.find(c => c.companyId === companyId);
        
        // Safety check: if stored company is invalid, go back to dashboard
        if (!companyMembership) {
            console.log("Company membership not found, redirecting to dashboard");
            localStorage.removeItem('selectedCompanyId');
            window.location.replace('dashboard.html');
            return;
        }
        console.log("Company membership found:", companyMembership);

        appState.profile = {
            uid: appState.user.uid,
            ...fullProfile,
            companyRole: companyMembership.role
        };

        const companySnap = await getDoc(doc(db, 'companies', companyId));
        if (!companySnap.exists()) throw new Error("Company data not found.");
        appState.company = { id: companySnap.id, ...companySnap.data() };
        console.log("Company data loaded:", appState.company);

        console.log("Initializing controllers and UI...");
        taskController.initTaskController(appState);
        UImanager.initUIManager(appState);
        UImanager.initModalManager(appState);
        initCommandPalette(appState, { openModal: UImanager.openModal, switchProject });

        console.log("Setting up UI and listeners...");
        setupUI();
        setupListeners();

        console.log("Making app container visible...");
        document.getElementById('app-container').classList.remove('hidden');
        console.log("Initialization completed successfully!");

    } catch (error) {
        console.error("CRITICAL INITIALIZATION FAILURE:", error);
        showToast(error.message || 'Could not initialize the application.', 'error');
        localStorage.removeItem('selectedCompanyId');
        window.location.href = 'dashboard.html';
    }
}

function setupListeners() {
    console.log("Setting up Firebase listeners...");
    console.log("DB object in setupListeners:", db);
    if (appState.projectsListener) appState.projectsListener();
    if (appState.presenceListener) appState.presenceListener();

    console.log("Creating projects query for company:", appState.company.id);
    console.log("About to call collection(db, 'projects') with db:", db);
    const projectsQuery = query(collection(db, 'projects'), where("companyId", "==", appState.company.id));
    appState.projectsListener = onSnapshot(projectsQuery, (snapshot) => {
        console.log("Projects snapshot received, docs count:", snapshot.docs.length);
        appState.projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        UImanager.renderProjectList(appState.projects, appState.currentProjectId);
        if (appState.currentProjectId !== 'all') {
            const updatedProject = appState.projects.find(p => p.id === appState.currentProjectId);
            if (updatedProject) UImanager.updateProjectHeader(updatedProject);
        }
    }, (error) => {
        console.error("Projects listener error:", error);
    });

    console.log("Creating users query for company:", appState.company.id);
    console.log("About to call collection(db, 'users') with db:", db);
    const usersQuery = query(collection(db, 'users'), where("companyIds", "array-contains", appState.company.id));
    appState.presenceListener = onSnapshot(usersQuery, (snapshot) => {
        console.log("Users snapshot received, docs count:", snapshot.docs.length);
        appState.team = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        UImanager.renderTeamList(appState.team, appState.user.uid);
        populateAssigneeFilter(appState.team);
    }, (error) => {
        console.error("Users listener error:", error);
    });

    console.log("Switching to project 'all'...");
    switchProject('all');
}

function switchProject(projectId) {
    console.log("Switching to project:", projectId);
    appState.currentProjectId = projectId;
    if (appState.tasksListener) appState.tasksListener();

    UImanager.renderProjectList(appState.projects, projectId);
    if (projectId === 'all') {
        UImanager.hideProjectHeader();
    } else {
        const project = appState.projects.find(p => p.id === projectId);
        if (project) UImanager.updateProjectHeader(project);
    }

    console.log("Creating tasks query for company:", appState.company.id, "project:", projectId);
    let tasksQuery;
    const baseTasksQuery = query(collection(db, 'tasks'), where("companyId", "==", appState.company.id));
    tasksQuery = (projectId === 'all') ? baseTasksQuery : query(baseTasksQuery, where("projectId", "==", projectId));
    
    appState.tasksListener = onSnapshot(tasksQuery, (snapshot) => {
        console.log("Tasks snapshot received, docs count:", snapshot.docs.length);
        appState.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFilteredTasks();
    }, (error) => {
        console.error("Tasks listener error:", error);
    });
}

function renderFilteredTasks() {
    const processedTasks = applyFiltersAndSorts(appState.tasks);
    UImanager.renderView(appState.currentView, processedTasks, appState);
}

function applyFiltersAndSorts(tasks) {
    let filteredTasks = [...tasks];
    if (appState.searchTerm) {
        filteredTasks = filteredTasks.filter(task => task.name.toLowerCase().includes(appState.searchTerm.toLowerCase()));
    }
    if (appState.filterAssignee !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.assignedTo?.includes(appState.filterAssignee));
    }
    const [sortBy, direction] = appState.sortTasks.split('-');
    const dir = direction === 'asc' ? 1 : -1;
    const priorityMap = { high: 3, medium: 2, low: 1 };
    return filteredTasks.sort((a, b) => {
        switch (sortBy) {
            case 'dueDate': return (new Date(a.dueDate || 0) - new Date(b.dueDate || 0)) * dir;
            case 'priority': return ((priorityMap[a.priority] || 0) - (priorityMap[b.priority] || 0)) * dir;
            default: return ((a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) * dir;
        }
    });
}

function setupUI() {
    initializeI18n();
    UImanager.updateUserInfo(appState.profile, appState.company);

    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('selectedCompanyId');
        firebaseSignOut(auth);
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
            switchProject(e.target.dataset.projectId);
        }
    });

    document.getElementById('search-bar').addEventListener('input', (e) => {
        appState.searchTerm = e.target.value;
        renderFilteredTasks();
    });

    document.getElementById('filter-assignee').addEventListener('change', (e) => {
        appState.filterAssignee = e.target.value;
        renderFilteredTasks();
    });
    document.getElementById('sort-tasks').addEventListener('change', (e) => {
        appState.sortTasks = e.target.value;
        renderFilteredTasks();
    });

    document.getElementById('logo-upload-input').addEventListener('change', handleLogoUpload);
    document.getElementById('change-logo-btn').addEventListener('click', () => document.getElementById('logo-upload-input').click());

    document.getElementById('share-invite-button').addEventListener('click', () => {
        const inviteLink = `${window.location.origin}/register.html?ref=${appState.company.referralId}`;
        UImanager.openModal(UImanager.DOM.inviteModal);
        document.getElementById('invite-link-input').value = inviteLink;
    });

    taskController.setupProjectForm(appState);
    taskController.setupTaskForm();
    UImanager.setupModals();
    UImanager.setupDragDrop();
}

function populateAssigneeFilter(team) {
    const select = document.getElementById('filter-assignee');
    const currentVal = select.value;
    select.innerHTML = '<option value="all">All Members</option>';
    team.forEach(user => {
        const option = new Option(user.nickname, user.id);
        select.appendChild(option);
    });
    select.value = currentVal;
}

async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file || appState.currentProjectId === 'all') return;
    showToast('Uploading logo...', 'success');
    try {
        const filePath = `project_logos/${appState.currentProjectId}/${file.name}`;
        const fileRef = storageRef(storage, filePath);
        await uploadBytes(fileRef, file);
        const logoURL = await getDownloadURL(fileRef);
        await updateDoc(doc(db, 'projects', appState.currentProjectId), { logoURL });
        showToast('Logo updated!', 'success');
    } catch (error) {
        console.error("Logo upload failed:", error);
        showToast('Logo upload failed.', 'error');
    }
}
