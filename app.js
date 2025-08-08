import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signOut, getUserProfile, listenToCompanyTasks } from './firebase-service.js';
import { initializeI18n } from './i18n.js';
// The UI Manager and Task Controller logic would be here
// For simplicity in this example, they are merged, but in a real app, they would be separate modules.

let currentUserProfile = null;
let currentTasks = [];
let currentView = 'list-view';

// --- Auth Guard ---
onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in, fetch profile and initialize app
        initialize(user);
    } else {
        // User is signed out, redirect to login
        window.location.href = 'login.html';
    }
});

async function initialize(user) {
    try {
        const profileSnap = await getUserProfile(user.uid);
        if (profileSnap.exists()) {
            currentUserProfile = profileSnap.data();
            document.getElementById('app-container').classList.remove('hidden');
            setupUI();
            listenToCompanyTasks(currentUserProfile.companyId, (tasks) => {
                currentTasks = tasks;
                renderView(currentView, tasks);
            });
        } else {
            // Profile doesn't exist, something is wrong
            throw new Error("User profile not found.");
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        signOut(); // Sign out on failure
    }
}

function setupUI() {
    initializeI18n();
    document.getElementById('user-nickname').textContent = currentUserProfile.nickname;
    document.getElementById('user-company').textContent = currentUserProfile.companyName;

    document.getElementById('logout-button').addEventListener('click', signOut);
    
    // Setup view switcher, modals, forms, etc.
    // This logic is similar to your previous uiManager and taskController
    // but would now be initialized here.
    
    // Example: Share invite button
    const shareBtn = document.getElementById('share-invite-button');
    shareBtn.addEventListener('click', async () => {
        const companyData = await getCompanyByReferralId(currentUserProfile.referralId);
        if (companyData) {
            const referralId = companyData.referralId;
            const inviteLink = `${window.location.origin}/register.html?ref=${referralId}`;
            const inviteInput = document.getElementById('invite-link-input');
            inviteInput.value = inviteLink;
            document.getElementById('invite-modal').classList.remove('hidden');
        }
    });
}

function renderView(viewId, tasks) {
    // This function would contain all the logic from your previous uiManager.js
    // to render the list, kanban, and calendar views based on the `tasks` data.
    console.log(`Rendering ${viewId} with ${tasks.length} tasks.`);
}

// ... The rest of your UI and task controller logic would go here ...
