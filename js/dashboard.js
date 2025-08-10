// --- Import initialized Firebase services and SDK functions ---
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    doc, 
    getDocs,
    setDoc, 
    serverTimestamp,
    Timestamp,
    updateDoc,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Import your UI and utility modules ---
import { showToast } from './toast.js';
import { initializeI18n } from './i18n.js';

// --- Main Setup ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard DOM Loaded. Initializing...');
    initializeI18n();
    
    // This listener is the entry point for the dashboard
    onAuthStateChanged(auth, user => {
        console.log('Auth state changed. User:', user ? user.uid : 'No User');
        if (user) {
            if (!user.emailVerified) {
                console.log('User not verified. Redirecting to login.');
                window.location.replace('login.html');
                return;
            }
            // User is logged in and verified, load their data.
            console.log('User is verified. Loading dashboard data...');
            loadDashboardData(user);
            setupEventListeners(user);
        } else {
            // No user is signed in, redirect to login.
            console.log('No user found. Redirecting to login.');
            window.location.replace('login.html');
        }
    });
});

// --- Event Listeners Setup ---
function setupEventListeners(user) {
    console.log('Setting up event listeners.');
    const createCompanyBtn = document.getElementById('create-company-btn');
    const joinCompanyBtn = document.getElementById('join-company-btn');
    const createCompanyModal = document.getElementById('create-company-modal');
    const joinCompanyModal = document.getElementById('join-company-modal');
    const createCompanyForm = document.getElementById('create-company-form');
    const joinCompanyForm = document.getElementById('join-company-form');
    const logoutButton = document.getElementById('logout-button');

    if (createCompanyBtn) createCompanyBtn.addEventListener('click', () => createCompanyModal.classList.remove('hidden'));
    if (joinCompanyBtn) joinCompanyBtn.addEventListener('click', () => joinCompanyModal.classList.remove('hidden'));
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
    });

    if (createCompanyForm) createCompanyForm.addEventListener('submit', (e) => handleCreateCompany(e, user));
    if (joinCompanyForm) joinCompanyForm.addEventListener('submit', (e) => handleJoinCompany(e, user));
    if (logoutButton) logoutButton.addEventListener('click', () => signOut(auth));
}

// --- Data Loading and Rendering ---

async function loadDashboardData(user) {
    console.log('Executing loadDashboardData...');
    try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('members', 'array-contains', user.uid));
        
        console.log('Querying for companies...');
        const querySnapshot = await getDocs(q);
        const companies = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${companies.length} companies.`);

        await renderDashboard(user, companies);
    } catch (error) {
        console.error("Failed to load dashboard data:", error);
        const mainContent = document.getElementById('dashboard-main-content');
        if(mainContent) mainContent.innerHTML = '<p class="error">Could not load your dashboard. Please try again later.</p>';
        showToast('Error loading dashboard.', 'error');
    }
}

async function renderDashboard(user, companies) {
    console.log('Rendering dashboard with', companies.length, 'companies.');
    const companiesContainer = document.getElementById('companies-container');
    const tasksByStatusContainer = document.getElementById('tasks-by-status');
    const upcomingDeadlinesContainer = document.getElementById('upcoming-deadlines');

    if (!companiesContainer || !tasksByStatusContainer || !upcomingDeadlinesContainer) {
        console.error('One or more dashboard containers are missing from the HTML!');
        return;
    }

    // Render Companies
    if (companies.length > 0) {
        companiesContainer.innerHTML = companies.map(company => `
            <div class="company-card" data-company-id="${company.id}">
                <h3>${company.name}</h3>
                <p>Click to view projects</p>
            </div>
        `).join('');
        companiesContainer.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', () => {
                localStorage.setItem('selectedCompanyId', card.dataset.companyId);
                window.location.href = 'index.html';
            });
        });
    } else {
        companiesContainer.innerHTML = '<p>You are not a member of any companies yet.</p>';
    }

    // Render Task Widgets
    if (companies.length > 0) {
        const companyIds = companies.map(c => c.id);
        const tasksRef = collection(db, 'tasks');
        
        console.log('Querying tasks for status widget...');
        const statusQuery = query(tasksRef, where('companyId', 'in', companyIds));
        const statusSnapshot = await getDocs(statusQuery);
        const allTasks = statusSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const tasksByStatus = {
            todo: allTasks.filter(t => t.status === 'todo').length,
            inprogress: allTasks.filter(t => t.status === 'inprogress').length,
            done: allTasks.filter(t => t.status === 'done').length,
        };
        tasksByStatusContainer.innerHTML = `
            <div class="task-status-item todo"><span>${tasksByStatus.todo}</span> To Do</div>
            <div class="task-status-item inprogress"><span>${tasksByStatus.inprogress}</span> In Progress</div>
            <div class="task-status-item done"><span>${tasksByStatus.done}</span> Done</div>
        `;

        console.log('Querying tasks for deadline widget...');
        const sevenDaysFromNow = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const upcomingQuery = query(tasksRef, 
            where('companyId', 'in', companyIds), 
            where('dueDate', '<=', sevenDaysFromNow)
        );
        const upcomingSnapshot = await getDocs(upcomingQuery);
        const upcomingTasks = upcomingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
    } else {
        tasksByStatusContainer.innerHTML = '<p>No tasks to show.</p>';
        upcomingDeadlinesContainer.innerHTML = '<p>No tasks to show.</p>';
    }
    console.log('Dashboard rendering complete.');
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
        const companyRef = doc(collection(db, 'companies'));
        const companyId = companyRef.id;
        const referralId = `ref-${companyId.substring(0, 6)}`;
        
        await setDoc(companyRef, {
            name: companyName,
            ownerId: user.uid,
            members: [user.uid],
            createdAt: serverTimestamp(),
            referralId: referralId
        });
        
        showToast('Company created successfully!', 'success');
        form.closest('.modal').classList.add('hidden');
        loadDashboardData(user);
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
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where("referralId", "==", referralId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showToast('Invalid referral ID. No company found.', 'error');
            return;
        }

        const companyDoc = querySnapshot.docs[0];
        const companyData = companyDoc.data();

        if (companyData.members && companyData.members.includes(user.uid)) {
            showToast("You are already a member of this company.", 'info');
            form.closest('.modal').classList.add('hidden');
            return;
        }

        await updateDoc(companyDoc.ref, {
            members: arrayUnion(user.uid)
        });

        showToast(`Successfully joined ${companyData.name}!`, 'success');
        form.closest('.modal').classList.add('hidden');
        loadDashboardData(user);

    } catch (error) {
        console.error("Error joining company:", error);
        showToast('Failed to join company. Please try again.', 'error');
    }
}
