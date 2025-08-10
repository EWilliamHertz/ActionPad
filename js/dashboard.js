// --- Import initialized Firebase services and SDK functions ---
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    getDoc, 
    getDocs,
    setDoc, 
    serverTimestamp,
    Timestamp,
    updateDoc,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Import your UI and utility modules ---
import { showToast } from './toast.js';
import { initializeI18n, getTranslatedString } from './i18n.js';

// --- Main Setup ---
document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
    
    // This listener is the entry point for the dashboard
    onAuthStateChanged(auth, user => {
        if (user) {
            if (!user.emailVerified) {
                // If the user is not verified, they shouldn't be on the dashboard.
                // Redirect them to the login page where the verification notice is shown.
                window.location.replace('login.html');
                return;
            }
            // User is logged in and verified, load their data.
            loadDashboardData(user);
            setupEventListeners(user);
        } else {
            // No user is signed in, redirect to login.
            window.location.replace('login.html');
        }
    });
});

// --- Event Listeners Setup ---
function setupEventListeners(user) {
    const createCompanyBtn = document.getElementById('create-company-btn');
    const joinCompanyBtn = document.getElementById('join-company-btn');
    const createCompanyModal = document.getElementById('create-company-modal');
    const joinCompanyModal = document.getElementById('join-company-modal');
    const createCompanyForm = document.getElementById('create-company-form');
    const joinCompanyForm = document.getElementById('join-company-form');

    if (createCompanyBtn) {
        createCompanyBtn.addEventListener('click', () => createCompanyModal.classList.remove('hidden'));
    }
    if (joinCompanyBtn) {
        joinCompanyBtn.addEventListener('click', () => joinCompanyModal.classList.remove('hidden'));
    }

    // Generic modal close logic
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });

    if (createCompanyForm) {
        createCompanyForm.addEventListener('submit', (e) => handleCreateCompany(e, user));
    }
    if (joinCompanyForm) {
        joinCompanyForm.addEventListener('submit', (e) => handleJoinCompany(e, user));
    }
}

// --- Data Loading and Rendering ---

async function loadDashboardData(user) {
    const mainContent = document.getElementById('dashboard-main-content');
    if(mainContent) mainContent.innerHTML = '<div class="loader">Loading your dashboard...</div>';

    try {
        // --- Inlined logic from services/company.js ---
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('members', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        const companies = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // --- End of inlined logic ---

        renderDashboard(user, companies);
    } catch (error) {
        console.error("Failed to load dashboard data:", error);
        if(mainContent) mainContent.innerHTML = '<p class="error">Could not load your dashboard. Please try again later.</p>';
        showToast('Error loading dashboard.', 'error');
    }
}

async function renderDashboard(user, companies) {
    const companiesContainer = document.getElementById('companies-container');
    const tasksByStatusContainer = document.getElementById('tasks-by-status');
    const upcomingDeadlinesContainer = document.getElementById('upcoming-deadlines');

    // Render Companies
    if (companiesContainer) {
        if (companies.length > 0) {
            companiesContainer.innerHTML = companies.map(company => `
                <div class="company-card" data-company-id="${company.id}">
                    <h3>${company.name}</h3>
                    <p>Click to view projects</p>
                </div>
            `).join('');
            // Add event listeners to company cards
            companiesContainer.querySelectorAll('.company-card').forEach(card => {
                card.addEventListener('click', () => {
                    localStorage.setItem('selectedCompanyId', card.dataset.companyId);
                    window.location.href = 'index.html'; // Or chat.html, or your main app view
                });
            });
        } else {
            companiesContainer.innerHTML = '<p>You are not a member of any companies yet.</p>';
        }
    }

    // Render Task Widgets (if there are companies)
    if (companies.length > 0) {
        const companyIds = companies.map(c => c.id);
        
        // --- Inlined logic from services/task.js ---
        const tasksRef = collection(db, 'tasks');
        
        // Tasks by Status
        const statusQuery = query(tasksRef, where('companyId', 'in', companyIds));
        const statusSnapshot = await getDocs(statusQuery);
        const allTasks = statusSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const tasksByStatus = {
            todo: allTasks.filter(t => t.status === 'todo').length,
            inprogress: allTasks.filter(t => t.status === 'inprogress').length,
            done: allTasks.filter(t => t.status === 'done').length,
        };

        // Upcoming Deadlines
        const sevenDaysFromNow = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const upcomingQuery = query(tasksRef, 
            where('companyId', 'in', companyIds), 
            where('dueDate', '<=', sevenDaysFromNow)
        );
        const upcomingSnapshot = await getDocs(upcomingQuery);
        const upcomingTasks = upcomingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // --- End of inlined logic ---

        if (tasksByStatusContainer) {
            tasksByStatusContainer.innerHTML = `
                <div class="task-status-item todo"><span>${tasksByStatus.todo}</span> To Do</div>
                <div class="task-status-item inprogress"><span>${tasksByStatus.inprogress}</span> In Progress</div>
                <div class="task-status-item done"><span>${tasksByStatus.done}</span> Done</div>
            `;
        }

        if (upcomingDeadlinesContainer) {
            if (upcomingTasks.length > 0) {
                upcomingDeadlinesContainer.innerHTML = upcomingTasks
                    .sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis())
                    .map(task => `
                        <div class="deadline-item">
                            <span class="task-name">${task.name}</span>
                            <span class="task-due-date">Due: ${task.dueDate.toDate().toLocaleDateString()}</span>
                        </div>
                    `).join('');
            } else {
                upcomingDeadlinesContainer.innerHTML = '<p>No upcoming deadlines in the next 7 days.</p>';
            }
        }
    } else {
        if (tasksByStatusContainer) tasksByStatusContainer.innerHTML = '';
        if (upcomingDeadlinesContainer) upcomingDeadlinesContainer.innerHTML = '';
    }
}

// --- Company Management Handlers ---

async function handleCreateCompany(event, user) {
    event.preventDefault();
    const form = event.target;
    const companyName = form.querySelector('#new-company-name').value.trim();
    if (!companyName) {
        showToast('Please enter a company name.', 'error');
        return;
    }
    
    try {
        // --- Inlined logic from services/company.js ---
        const companyRef = doc(collection(db, 'companies'));
        const companyId = companyRef.id;
        const referralId = `ref-${companyId.substring(0, 6)}`;
        
        await setDoc(companyRef, {
            name: companyName,
            ownerId: user.uid,
            members: [user.uid], // Add the creator as the first member
            createdAt: serverTimestamp(),
            referralId: referralId
        });
        // --- End of inlined logic ---
        
        showToast('Company created successfully!', 'success');
        form.closest('.modal').classList.add('hidden');
        loadDashboardData(user); // Refresh dashboard
    } catch (error) {
        console.error("Error creating company:", error);
        showToast('Failed to create company.', 'error');
    }
}

async function handleJoinCompany(event, user) {
    event.preventDefault();
    const form = event.target;
    const referralId = form.querySelector('#join-referral-id').value.trim();
    if (!referralId) {
        showToast('Please enter a referral ID.', 'error');
        return;
    }

    try {
        // 1. Find the company with the given referral ID.
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where("referralId", "==", referralId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showToast('Invalid referral ID. No company found.', 'error');
            return;
        }

        const companyDoc = querySnapshot.docs[0];
        const companyData = companyDoc.data();

        // 2. Check if user is already a member.
        if (companyData.members && companyData.members.includes(user.uid)) {
            showToast("You are already a member of this company.", 'info');
            form.closest('.modal').classList.add('hidden');
            return;
        }

        // 3. Add the user to the company's member list using arrayUnion.
        await updateDoc(companyDoc.ref, {
            members: arrayUnion(user.uid)
        });

        showToast(`Successfully joined ${companyData.name}!`, 'success');
        form.closest('.modal').classList.add('hidden');
        loadDashboardData(user); // Refresh the dashboard to show the new company.

    } catch (error) {
        console.error("Error joining company:", error);
        showToast('Failed to join company. Please try again.', 'error');
    }
}
