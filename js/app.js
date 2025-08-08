// This is the main entry point for the application logic in index.html.
// It orchestrates all other modules after ensuring the user is authenticated.

import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signOut, getUserProfile, getCompany, listenToCompanyTasks } from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import * as uiManager from './uiManager.js';
import * as taskController from './taskController.js';

// --- Application State ---
// A central object to hold the current state of the app.
const appState = {
    user: null,
    profile: null,
    company: null,
    tasks: [],
    currentView: 'list-view'
};

// --- Authentication Guard ---
// This is the first thing that runs. It checks if a user is logged in.
onAuthStateChanged(auth, user => {
    if (user) {
        // If logged in, start the main application initialization.
        appState.user = user;
        initialize();
    } else {
        // If not logged in, redirect to the login page. This protects the app.
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('login.html');
        }
    }
});

// --- Main Initialization Function ---
async function initialize() {
    try {
        // Fetch the user's profile from Firestore.
        const profileSnap = await getUserProfile(appState.user.uid);
        if (!profileSnap.exists()) throw new Error("User profile not found.");
        appState.profile = profileSnap.data();

        // Fetch the user's company details.
        const companySnap = await getCompany(appState.profile.companyId);
        if (!companySnap.exists()) throw new Error("Company not found.");
        appState.company = companySnap.data();

        // Initialize all modules that need app state.
        taskController.initTaskController(appState);
        
        // Setup all UI elements and event listeners.
        setupUI();

        // Start listening for real-time task updates for the user's company.
        listenToCompanyTasks(appState.profile.companyId, (tasks) => {
            appState.tasks = tasks;
            // Re-render the current view with the new tasks.
            uiManager.renderView(appState.currentView, appState.tasks);
        });

        // Show the main application container.
        document.getElementById('app-container').classList.remove('hidden');

    } catch (error) {
        console.error("Initialization Failed:", error);
        alert("Could not initialize the application. Signing out.");
        signOut();
    }
}

// --- UI & Event Listener Setup ---
function setupUI() {
    // Initialize the language switcher.
    initializeI18n();

    // Populate user-specific UI elements.
    document.getElementById('user-nickname').textContent = appState.profile.nickname;
    document.getElementById('user-company').textContent = appState.company.name;

    // Setup event listeners for buttons and forms.
    document.getElementById('logout-button').addEventListener('click', signOut);
    
    document.getElementById('view-switcher').addEventListener('click', (e) => {
        if (e.target.matches('.view-btn')) {
            appState.currentView = e.target.dataset.view;
            uiManager.switchView(appState.currentView);
            uiManager.renderView(appState.currentView, appState.tasks);
        }
    });

    document.getElementById('share-invite-button').addEventListener('click', () => {
        const inviteLink = `${window.location.origin}/register.html?ref=${appState.company.referralId}`;
        document.getElementById('invite-link-input').value = inviteLink;
        uiManager.openModal(document.getElementById('invite-modal'));
    });

    taskController.setupTaskForm();
    uiManager.setupModals();
    uiManager.setupEventListeners(appState);
}
