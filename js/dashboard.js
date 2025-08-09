import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { 
    getUserProfile, 
    getCompanyDashboardData,
    signOut,
    joinCompanyWithReferralId,
    createNewCompany
} from './firebase-service.js';
import { showToast } from './toast.js';

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const profileSnap = await getUserProfile(user.uid);
        if (profileSnap.exists()) {
            const profile = profileSnap.data();
            updateUserInfo(profile);
            renderCompanyCards(profile.companies || []);
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
    container.innerHTML = '<div class="loader">Loading company data...</div>';

    if (companyMemberships.length === 0) {
        container.innerHTML = '<p>You are not a member of any company yet.</p>';
        return;
    }

    const cardPromises = companyMemberships.map(membership => getCompanyDashboardData(membership.companyId));
    const companiesData = await Promise.all(cardPromises);

    container.innerHTML = ''; // Clear loader

    companiesData.forEach((data, index) => {
        if (data.company) {
            const membership = companyMemberships[index];
            const card = createCompanyCard(data, membership);
            container.appendChild(card);
        }
    });
}

function createCompanyCard(data, membership) {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.dataset.companyId = membership.companyId;

    const { company, tasks, members } = data;
    const openTasks = tasks.filter(t => t.status !== 'done').length;

    card.innerHTML = `
        <div class="company-card-header">
            <h3>${company.name}</h3>
            <p>Your role: ${membership.role}</p>
        </div>
        <div class="company-card-body">
            <div class="stat">
                <span class="stat-value">${openTasks}</span>
                <span class="stat-label">Open Tasks</span>
            </div>
            <div class="stat">
                <span class="stat-value">${tasks.length}</span>
                <span class="stat-label">Total Tasks</span>
            </div>
            <div class="stat">
                <span class="stat-value">${members.length}</span>
                <span class="stat-label">Members</span>
            </div>
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
        location.reload(); // Reload to show the new company
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
