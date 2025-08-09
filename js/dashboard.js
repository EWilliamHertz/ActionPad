import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { 
    getUserProfile, 
    getCompanyDashboardData,
    signOut,
    joinCompanyWithReferralId,
    createNewCompany,
    getUpcomingDeadlines
} from './services/index.js'; // Assuming a new index.js for services
import { showToast } from './toast.js';

let currentUser = null;

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
            renderDashboardWidgets(user.uid);
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

    card.innerHTML = `
        <div class="company-card-header">
            <h3>${company.name}</h3>
            <p>Your role: ${membership.role}</p>
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
            <button class="switch-company-btn">Go to Company</button>
        </div>
    `;

    card.querySelector('.switch-company-btn').addEventListener('click', () => {
        localStorage.setItem('selectedCompanyId', membership.companyId);
        window.location.href = 'index.html';
    });

    return card;
}


async function renderDashboardWidgets(userId) {
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
}


// Modal Handling
const joinModal = document.getElementById('join-company-modal');
const createModal = document.getElementById('create-company-modal');

document.getElementById('join-company-btn').addEventListener('click', () => joinModal.classList.remove('hidden'));
document.getElementById('create-company-btn').addEventListener('click', () => createModal.classList.remove('hidden'));

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal-overlay').classList.add('hidden');
    });
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
