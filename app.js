import { auth } from './firebaseConfig.js'; // auth is still needed for its context
import { onAuthStateChanged, signIn, register, signOut, listenToTasks } from './firebaseService.js';
import * as uiManager from './uiManager.js';
import * as taskController from './taskController.js';

let currentTasks = [];
let currentView = 'list-view';

// --- Authentication Logic ---
function setupAuthListeners() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutButton = document.getElementById('logout-button');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        signIn(email, password)
            .catch(error => uiManager.showAuthError('login-error', error.message));
    });

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        register(email, password)
            .catch(error => uiManager.showAuthError('register-error', error.message));
    });

    logoutButton.addEventListener('click', () => {
        signOut();
    });

    showRegister.addEventListener('click', (e) => { e.preventDefault(); uiManager.toggleAuthForms(); });
    showLogin.addEventListener('click', (e) => { e.preventDefault(); uiManager.toggleAuthForms(); });

    onAuthStateChanged(auth, user => {
        if (user) {
            uiManager.showApp(user.email);
            // Listen for real-time task updates
            listenToTasks(user.uid, (tasks) => {
                currentTasks = tasks;
                uiManager.renderView(currentView, tasks);
            });
        } else {
            uiManager.showAuth();
            currentTasks = [];
            uiManager.renderView(currentView, []);
        }
    });
}

// --- View Switching Logic ---
function setupViewSwitcher() {
    const viewSwitcher = document.getElementById('view-switcher');
    viewSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const view = e.target.dataset.view;
            if (view !== currentView) {
                currentView = view;
                uiManager.switchView(currentView);
                uiManager.renderView(currentView, currentTasks);
            }
        }
    });
}

// --- Initialization ---
function init() {
    setupAuthListeners();
    setupViewSwitcher();
    taskController.setupTaskForm();
    uiManager.setupModal();
    uiManager.setupDragAndDrop();
    uiManager.setupCalendarControls();
}

// Start the application
init();
