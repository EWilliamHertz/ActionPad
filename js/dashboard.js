// FILE: js/dashboard.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { signOut } from './services/auth.js';
import { getUserProfile } from './services/user.js';
import { getCompanyDashboardData, createNewCompany, joinCompanyWithReferralId } from './services/index.js';
import { showToast } from './toast.js';

let currentUser = null;
let taskStatusChart = null;

// --- Main Setup ---
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

    try {
        const profileSnap = await getUserProfile(currentUser.uid);
        if (profileSnap.exists()) {
            const profile = profileSnap.data();
            document.getElementById('user-nickname').textContent = profile.nickname;
            if (profile.avatarURL) {
                document.getElementById('user-avatar-header').src = profile.avatarURL;
            }
        }

        const companiesContainer = document.getElementById('company-cards-container');
        companiesContainer.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

        const userProfile = profileSnap.data();
        const companyMemberships = userProfile.companies || [];

        if (companyMemberships.length === 0) {
            companiesContainer.innerHTML = `<p>You haven't joined any companies yet. Create one or join one to get started!</p>`;
            document.getElementById('upcoming-deadlines-widget').innerHTML = '<h4>Upcoming Deadlines</h4><p>No data</p>';
            return;
        }

        const allCompanyData = await Promise.all(
            companyMemberships.map(mem => getCompanyDashboardData(mem.companyId))
        );

        renderCompanyCards(allCompanyData);
        renderGlobalWidgets(allCompanyData);

    } catch (error) {
        console.error("Dashboard loading failed:", error);
        showToast("Could not load dashboard data.", "error");
    }
}

function renderCompanyCards(allCompanyData) {
    const container = document.getElementById('company-cards-container');
    if (!container) return;

    if (!allCompanyData || allCompanyData.length === 0) {
        container.innerHTML = `<p>You aren't a member of any companies yet.</p>`;
        return;
    }

    container.innerHTML = allCompanyData.map(({ company, tasks, members }) => {
        if (!company) return '';
        const tasksDone = tasks.filter(t => t.status === 'done').length;
        const totalTasks = tasks.length;
        const progress = totalTasks > 0 ? (tasksDone / totalTasks) * 100 : 0;

        return `
            <div class="company-card">
                <div class="company-card-header">
                     <img src="${company.logoURL || `https://placehold.co/48x48/E9ECEF/495057?text=${company.name.charAt(0).toUpperCase()}`}" alt="${company.name} Logo" class="company-logo-small">
                    <div>
                        <h3>${company.name}</h3>
                        <p>${members.length} member(s)</p>
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


function renderGlobalWidgets(allCompanyData) {
    const allTasks = allCompanyData.flatMap(data => data.tasks);

    // Render Task Status Chart
    const tasksByStatus = {
        todo: allTasks.filter(t => t.status === 'todo').length,
        'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
        done: allTasks.filter(t => t.status === 'done').length,
    };
    const ctx = document.getElementById('task-status-chart')?.getContext('2d');
    if (ctx) {
        if (taskStatusChart) {
            taskStatusChart.destroy();
        }
        taskStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['To Do', 'In Progress', 'Done'],
                datasets: [{
                    label: 'Tasks by Status',
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
    const deadlinesContainer = document.getElementById('upcoming-deadlines-widget');
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const upcomingTasks = allTasks
        .filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= nextWeek)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    deadlinesContainer.innerHTML = '<h4>Upcoming Deadlines</h4>';
    if (upcomingTasks.length > 0) {
        deadlinesContainer.innerHTML += `<ul class="widget-list">${upcomingTasks.map(t => `<li>${t.name} - ${new Date(t.dueDate).toLocaleDateString()}</li>`).join('')}</ul>`;
    } else {
        deadlinesContainer.innerHTML += '<p>No deadlines in the next 7 days.</p>';
    }
}

function setupEventListeners() {
    document.getElementById('logout-button').addEventListener('click', signOut);

    document.getElementById('company-cards-container').addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('.switch-company-btn')) {
            localStorage.setItem('selectedCompanyId', target.dataset.companyId);
            window.location.href = 'index.html';
        }
        if (target.closest('.settings-btn')) {
             localStorage.setItem('selectedCompanyId', target.closest('.settings-btn').dataset.companyId);
             window.location.href = 'company-settings.html';
        }
    });

    // Modal Handling
    const joinModal = document.getElementById('join-company-modal');
    const createModal = document.getElementById('create-company-modal');
    document.getElementById('join-company-btn').addEventListener('click', () => joinModal.classList.remove('hidden'));
    document.getElementById('create-company-btn').addEventListener('click', () => createModal.classList.remove('hidden'));

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            joinModal.classList.add('hidden');
            createModal.classList.add('hidden');
        });
    });

    document.getElementById('create-company-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyName = document.getElementById('create-company-name').value;
        const userRole = document.getElementById('create-company-role').value;
        if (!companyName || !userRole) {
            showToast("All fields are required.", "error");
            return;
        }
        try {
            const newCompanyId = await createNewCompany(currentUser, companyName, userRole);
            localStorage.setItem('selectedCompanyId', newCompanyId);
            window.location.href = 'index.html';
        } catch (error) {
            showToast("Failed to create company.", "error");
        }
    });
    
    document.getElementById('join-company-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const referralId = document.getElementById('join-referral-id').value;
        const role = document.getElementById('join-company-role').value;
        if(!referralId || !role) {
             showToast("All fields are required.", "error");
             return;
        }
        try {
            await joinCompanyWithReferralId(currentUser, referralId, role);
            showToast("Successfully joined company!", "success");
            createModal.classList.add('hidden');
            loadDashboard(); // Refresh the dashboard
        } catch (error) {
            showToast(error.message, "error");
        }
    });
}
