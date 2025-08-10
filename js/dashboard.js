// FILE: js/dashboard.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { 
    getUserProfile, 
    getCompanyDashboardData,
    signOut,
    joinCompanyWithReferralId,
    createNewCompany,
    getUpcomingDeadlines
} from './services/index.js';
import { showToast } from './toast.js';

let currentUser = null;
let taskStatusChart = null; 

const getUserProfileWithRetry = async (userId, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        const profileSnap = await getUserProfile(userId);
        if (profileSnap.exists() && profileSnap.data().companies) {
            return profileSnap;
        }
        await new Promise(res => setTimeout(res, delay));
    }
    return getUserProfile(userId);
};


onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const profileSnap = await getUserProfileWithRetry(user.uid); 
        if (profileSnap.exists()) {
            const profile = profileSnap.data();
            updateUserInfo(profile);
            renderCompanyCards(profile.companies || []);
            renderDashboardWidgets(user.uid, profile.companyIds || []);
        } else {
            showToast("Could not load your user profile.", "error");
            renderCompanyCards([]);
        }
    } else {
        window.location.replace('login.html');
    }
});

function updateUserInfo(profile) {
    document.getElementById('user-nickname').textContent = profile.nickname;
    const avatar = document.getElementById('user-avatar-header');
    if (profile.avatarURL) {
        avatar.src = profile.avatarURL;
    } else {
        avatar.src = `https://placehold.co/40x40/E9ECEF/495057?text=${profile.nickname.charAt(0).toUpperCase()}`;
    }
}

async function renderCompanyCards(companyMemberships) {
    const container = document.getElementById('company-cards-container');
    container.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

    if (companyMemberships.length === 0) {
        container.innerHTML = '<p>You are not a member of any company yet.</p>';
        return;
    }

    try {
        const cardPromises = companyMemberships.map(membership => getCompanyDashboardData(membership.companyId));
        const companiesData = await Promise.all(cardPromises);

        container.innerHTML = ''; 

        companiesData.forEach((data, index) => {
            if (data.company) {
                const membership = companyMemberships[index];
                const card = createCompanyCard(data, membership);
                container.appendChild(card);
            }
        });
    } catch (error) {
        console.error("Failed to render company cards:", error);
        container.innerHTML = `<p class="error">An error occurred while loading company data. Please check the console and try refreshing the page.</p>`;
        showToast("Error loading company data. You may need to create a database index.", "error");
    }
}

function createCompanyCard(data, membership) {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.dataset.companyId = membership.companyId;

    const { company, tasks, members } = data;
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const lastActivity = tasks.length > 0 && tasks[0].updatedAt ? new Date(tasks[0].updatedAt.seconds * 1000).toLocaleDateString() : 'N/A';
    const memberAvatars = members.slice(0, 5).map(member => {
        const avatarSrc = member.avatarURL || `https://placehold.co/32x32/E9ECEF/495057?text=${member.nickname.charAt(0).toUpperCase()}`;
        return `<img src="${avatarSrc}" alt="${member.nickname}" class="avatar-small">`;
    }).join('');

    const settingsButtonHtml = membership.role === 'Admin' 
        ? `<a href="company-settings.html" class="settings-btn" title="Company Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </a>`
        : '';

    // NEW: Logic to display company logo or a placeholder
    const companyLogoUrl = company.logoURL || `https://placehold.co/48x48/E9ECEF/495057?text=${company.name.charAt(0).toUpperCase()}`;

    card.innerHTML = `
        <div class="company-card-header">
            <img src="${companyLogoUrl}" alt="${company.name} Logo" class="company-logo-small">
            <div>
                <h3>${company.name}</h3>
                <p>Your role: ${membership.role}</p>
            </div>
        </div>
        <div class="company-card-progress">
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%;"></div>
            </div>
            <span class="progress-text">${completedTasks} / ${totalTasks} tasks done</span>
        </div>
        <div class="company-card-body">
            <div class="stat">
                <span class="stat-value">${members.length}</span>
                <span class="stat-label">Members</span>
            </div>
             <div class="stat">
                <span class="stat-value">${lastActivity}</span>
                <span class="stat-label">Last Active</span>
            </div>
        </div>
        <div class="company-card-members">
            ${memberAvatars}
        </div>
        <div class="company-card-footer">
             <div class="company-card-actions">
                <button class="switch-company-btn">Go to Company</button>
                ${settingsButtonHtml}
            </div>
        </div>
    `;

    card.querySelector('.switch-company-btn').addEventListener('click', () => {
        localStorage.setItem('selectedCompanyId', membership.companyId);
        window.location.href = 'index.html';
    });

    const settingsLink = card.querySelector('.settings-btn');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('selectedCompanyId', membership.companyId);
            window.location.href = 'company-settings.html';
        });
    }

    return card;
}


async function renderDashboardWidgets(userId, companyIds) {
    const upcomingDeadlinesContainer = document.getElementById('upcoming-deadlines-widget');
    upcomingDeadlinesContainer.innerHTML = '<h4>Upcoming Deadlines</h4><div class="skeleton-widget-item"></div><div class="skeleton-widget-item"></div>';
    
    const deadlines = await getUpcomingDeadlines(userId);
    upcomingDeadlinesContainer.innerHTML = '<h4>Upcoming Deadlines</h4>';
    if(deadlines.length > 0) {
        const list = document.createElement('ul');
        list.className = 'widget-list';
        deadlines.forEach(task => {
            const item = document.createElement('li');
            item.innerHTML = `<strong>${task.name}</strong> - ${new Date(task.dueDate).toLocaleDateString()}`;
            list.appendChild(item);
        });
        upcomingDeadlinesContainer.appendChild(list);
    } else {
        upcomingDeadlinesContainer.innerHTML += '<p>No upcoming deadlines in the next 7 days.</p>';
    }

    const allTasks = [];
    for (const id of companyIds) {
        const data = await getCompanyDashboardData(id);
        allTasks.push(...data.tasks);
    }
    renderTaskStatusChart(allTasks);
}

function renderTaskStatusChart(tasks) {
    const ctx = document.getElementById('task-status-chart').getContext('2d');
    
    const statusCounts = tasks.reduce((acc, task) => {
        const status = task.status || 'todo';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const data = {
        labels: ['To Do', 'In Progress', 'Done'],
        datasets: [{
            label: 'Tasks by Status',
            data: [
                statusCounts['todo'] || 0,
                statusCounts['in-progress'] || 0,
                statusCounts['done'] || 0
            ],
            backgroundColor: ['#F6E05E', '#4A90E2', '#68D391'],
            borderColor: '#FFFFFF',
            borderWidth: 2
        }]
    };

    if (taskStatusChart) {
        taskStatusChart.destroy();
    }

    taskStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

const joinModal = document.getElementById('join-company-modal');
const createModal = document.getElementById('create-company-modal');
document.getElementById('join-company-btn').addEventListener('click', () => joinModal.classList.remove('hidden'));
document.getElementById('create-company-btn').addEventListener('click', () => createModal.classList.remove('hidden'));
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
});
document.getElementById('join-company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const referralId = document.getElementById('join-referral-id').value;
    try {
        await joinCompanyWithReferralId(currentUser, referralId);
        showToast('Successfully joined company!', 'success');
        location.reload(); 
    } catch (error) {
        showToast(error.message, 'error');
    }
});
document.getElementById('create-company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const companyName = document.getElementById('create-company-name').value;
    const userRole = document.getElementById('create-company-role').value;
    try {
        const newCompanyId = await createNewCompany(currentUser, companyName, userRole);
        localStorage.setItem('selectedCompanyId', newCompanyId);
        window.location.href = 'index.html';
    } catch (error) {
        showToast(error.message, 'error');
    }
});
document.getElementById('logout-button').addEventListener('click', signOut);
