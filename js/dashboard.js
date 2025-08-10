// FILE: js/dashboard.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    addDoc,
    serverTimestamp,
    updateDoc,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast } from './toast.js';

let currentUser = null;
let taskStatusChart = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            loadDashboard();
            setupEventListeners();
        } else {
            window.location.replace('login.html');
        }
    });
});

async function loadDashboard() {
    if (!currentUser) return;
    const companiesContainer = document.getElementById('company-cards-container');
    const deadlinesContainer = document.getElementById('upcoming-deadlines-widget');

    // Show skeletons while loading
    companiesContainer.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
    deadlinesContainer.innerHTML = '<h4>Upcoming Deadlines</h4><div class="skeleton-widget-item"></div><div class="skeleton-widget-item"></div>';

    try {
        const profileSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (profileSnap.exists()) {
            const profile = profileSnap.data();
            document.getElementById('user-nickname').textContent = profile.nickname;
            if (profile.avatarURL) {
                document.getElementById('user-avatar-header').src = profile.avatarURL;
            }
        }

        // 1. Find companies the user is a member of
        const companiesRef = collection(db, 'companies');
        const userCompaniesQuery = query(companiesRef, where('members', 'array-contains', currentUser.uid));
        const companySnapshots = await getDocs(userCompaniesQuery);

        if (companySnapshots.empty) {
            companiesContainer.innerHTML = `<p>You haven't joined any companies yet. Create one or join one to get started!</p>`;
            document.getElementById('task-status-widget').style.display = 'none';
            deadlinesContainer.style.display = 'none';
            return;
        }
        
        const companies = companySnapshots.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Get all tasks for those companies (if any companies were found)
        let allTasks = [];
        if (companies.length > 0) {
            const companyIds = companies.map(d => d.id);
            const tasksRef = collection(db, 'tasks');
            const tasksQuery = query(tasksRef, where('companyId', 'in', companyIds));
            const tasksSnapshot = await getDocs(tasksQuery);
            allTasks = tasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        renderCompanyCards(companies, allTasks);
        renderGlobalWidgets(allTasks);

    } catch (error) {
        console.error("Dashboard loading failed:", error);
        showToast("Could not load dashboard data. Check console for details.", "error");
        companiesContainer.innerHTML = `<p class="error">Failed to load companies.</p>`;
    }
}

function renderCompanyCards(companies, allTasks) {
    const container = document.getElementById('company-cards-container');
    container.innerHTML = companies.map(company => {
        const companyTasks = allTasks.filter(t => t.companyId === company.id);
        const membersCount = company.members?.length || 0;
        const totalTasks = companyTasks.length;
        const tasksDone = companyTasks.filter(t => t.status === 'done').length;
        const progress = totalTasks > 0 ? (tasksDone / totalTasks) * 100 : 0;


        return `
             <div class="company-card">
                <div class="company-card-header">
                     <img src="${company.logoURL || `https://placehold.co/48x48/E9ECEF/495057?text=${company.name.charAt(0).toUpperCase()}`}" alt="${company.name} Logo" class="company-logo-small">
                    <div>
                        <h3>${company.name}</h3>
                        <p>${membersCount} member(s)</p>
                    </div>
                </div>
                <div class="company-card-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress.toFixed(0)}%;"></div>
                    </div>
                    <span class="progress-text">${tasksDone} of ${totalTasks} tasks complete</span>
                </div>
                <div class="company-card-actions">
                    <button class="switch-company-btn" data-company-id="${company.id}">Enter App</button>
                    <a href="company-settings.html" class="settings-btn" data-company-id="${company.id}">⚙️</a>
                </div>
            </div>
        `;
    }).join('');
}

function renderGlobalWidgets(allTasks) {
    const deadlinesContainer = document.getElementById('upcoming-deadlines-widget');
    // Render Task Status Chart
    const tasksByStatus = {
        todo: allTasks.filter(t => t.status === 'todo').length,
        'in-progress': allTasks.filter(t => t.status === 'in-progress' || !t.status).length,
        done: allTasks.filter(t => t.status === 'done').length,
    };

    const ctx = document.getElementById('task-status-chart')?.getContext('2d');
    if (ctx) {
        if (taskStatusChart) taskStatusChart.destroy();
        taskStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['To Do', 'In Progress', 'Done'],
                datasets: [{
                    data: [tasksByStatus.todo, tasksByStatus['in-progress'], tasksByStatus.done],
                    backgroundColor: ['#F56565', '#F6E05E', '#68D391'],
                    borderColor: 'var(--surface-color)',
                    borderWidth: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Render Upcoming Deadlines
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const upcomingTasks = allTasks
        .filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= nextWeek)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);

    deadlinesContainer.innerHTML = '<h4>Upcoming Deadlines</h4>';
    if (upcomingTasks.length > 0) {
        deadlinesContainer.innerHTML += `<ul class="widget-list">${upcomingTasks.map(t => `<li>${t.name} - ${new Date(t.dueDate).toLocaleDateString()}</li>`).join('')}</ul>`;
    } else {
        deadlinesContainer.innerHTML += '<p>No deadlines in the next 7 days.</p>';
    }
}

function setupEventListeners() {
    document.getElementById('logout-button').addEventListener('click', () => {
        firebaseSignOut(auth);
        localStorage.removeItem('selectedCompanyId');
    });

    document.getElementById('company-cards-container').addEventListener('click', (e) => {
        const switchBtn = e.target.closest('.switch-company-btn');
        const settingsBtn = e.target.closest('.settings-btn');
        
        if (switchBtn) {
            localStorage.setItem('selectedCompanyId', switchBtn.dataset.companyId);
            window.location.href = 'index.html';
        }
        if (settingsBtn) {
             localStorage.setItem('selectedCompanyId', settingsBtn.dataset.companyId);
             window.location.href = 'company-settings.html';
        }
    });

    // Modal Handling
    const joinModal = document.getElementById('join-company-modal');
    const createModal = document.getElementById('create-company-modal');
    document.getElementById('join-company-btn').addEventListener('click', () => joinModal.classList.remove('hidden'));
    document.getElementById('create-company-btn').addEventListener('click', () => createModal.classList.remove('hidden'));
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Only close if the overlay background is clicked
                modal.classList.add('hidden');
            }
        });
    });
     document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.add('hidden');
        });
    });

    document.getElementById('create-company-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyName = document.getElementById('create-company-name').value;
        const userRole = document.getElementById('create-company-role').value;
        if (!companyName || !userRole) return showToast("All fields are required.", "error");

        try {
            const companyRef = await addDoc(collection(db, 'companies'), {
                name: companyName,
                ownerId: currentUser.uid,
                members: [currentUser.uid],
                referralId: Math.floor(100000 + Math.random() * 900000),
                createdAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'users', currentUser.uid), {
                companies: arrayUnion({ companyId: companyRef.id, role: userRole }),
                companyIds: arrayUnion(companyRef.id)
            });
            localStorage.setItem('selectedCompanyId', companyRef.id);
            window.location.href = 'index.html';
        } catch (error) {
            showToast("Failed to create company.", "error");
        }
    });

    document.getElementById('join-company-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const referralId = document.getElementById('join-referral-id').value;
        const role = document.getElementById('join-company-role').value;
        if (!referralId || !role) return showToast("All fields are required.", "error");

        try {
            const q = query(collection(db, "companies"), where("referralId", "==", Number(referralId)));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) throw new Error("Invalid Referral ID.");
            const companyDoc = querySnapshot.docs[0];
            await updateDoc(companyDoc.ref, { members: arrayUnion(currentUser.uid) });
            await updateDoc(doc(db, 'users', currentUser.uid), {
                companies: arrayUnion({ companyId: companyDoc.id, role: role }),
                companyIds: arrayUnion(companyDoc.id)
            });
            showToast("Successfully joined company!", "success");
            joinModal.classList.add('hidden');
            loadDashboard();
        } catch (error) {
            showToast(error.message, "error");
        }
    });
}
