// FILE: js/company-settings.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getCompany, listenToCompanyPresence, updateUserRole } from './services/company.js';
import { getUserProfile } from './services/user.js';
import { showToast } from './toast.js';

let companyId = null;
let currentUser = null;
let membersListener = null;
let initialRoles = {};

document.addEventListener('DOMContentLoaded', () => {
    companyId = localStorage.getItem('selectedCompanyId');
    if (!companyId) {
        window.location.replace('dashboard.html');
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Security check: Ensure the current user is an admin for this company.
            const profileSnap = await getUserProfile(user.uid);
            if (profileSnap.exists()) {
                const profile = profileSnap.data();
                const companyMembership = profile.companies.find(c => c.companyId === companyId);
                if (companyMembership && companyMembership.role === 'Admin') {
                    initializePage();
                } else {
                    showToast("You don't have permission to view this page.", "error");
                    window.location.replace('dashboard.html');
                }
            }
        } else {
            window.location.replace('login.html');
        }
    });
});

async function initializePage() {
    try {
        const companySnap = await getCompany(companyId);
        if (companySnap.exists()) {
            document.getElementById('company-name-header').textContent = `${companySnap.data().name} - Settings`;
        }

        if (membersListener) membersListener(); // Unsubscribe from any previous listener
        membersListener = listenToCompanyPresence(companyId, (members) => {
            renderMembersList(members);
        });

        document.getElementById('save-roles-button').addEventListener('click', handleSaveChanges);

    } catch (error) {
        console.error("Error initializing settings page:", error);
        showToast("Failed to load settings.", "error");
    }
}

function renderMembersList(members) {
    const container = document.getElementById('members-list-container');
    container.innerHTML = '';

    const list = document.createElement('ul');
    list.className = 'member-roles-list';

    members.sort((a, b) => a.nickname.localeCompare(b.nickname)).forEach(member => {
        const item = document.createElement('li');
        item.className = 'member-role-item';
        item.dataset.userId = member.id;

        // Store initial role to detect changes
        if (!initialRoles[member.id]) {
            initialRoles[member.id] = member.companyRole;
        }

        const avatarSrc = member.avatarURL || `https://placehold.co/40x40/E9ECEF/495057?text=${member.nickname.charAt(0).toUpperCase()}`;

        item.innerHTML = `
            <div class="member-info">
                <img src="${avatarSrc}" alt="${member.nickname}" class="avatar-small">
                <div>
                    <span class="member-name">${member.nickname}</span>
                    <span class="member-email">${member.email}</span>
                </div>
            </div>
            <div class="role-selector">
                <select ${member.id === currentUser.uid ? 'disabled' : ''}>
                    <option value="Admin" ${member.companyRole === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Member" ${member.companyRole === 'Member' ? 'selected' : ''}>Member</option>
                    <option value="Viewer" ${member.companyRole === 'Viewer' ? 'selected' : ''}>Viewer</option>
                </select>
            </div>
        `;
        list.appendChild(item);
    });
    container.appendChild(list);
}

async function handleSaveChanges() {
    const saveButton = document.getElementById('save-roles-button');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const promises = [];
    const roleItems = document.querySelectorAll('.member-role-item');

    roleItems.forEach(item => {
        const userId = item.dataset.userId;
        const newRole = item.querySelector('select').value;
        
        // Only update if the role has changed
        if (initialRoles[userId] !== newRole) {
            promises.push(updateUserRole(companyId, userId, newRole));
        }
    });

    try {
        await Promise.all(promises);
        showToast("User roles updated successfully!", "success");
        // Reset initial roles state after successful save
        initialRoles = {};
    } catch (error) {
        console.error("Error saving roles:", error);
        showToast("An error occurred while saving roles.", "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
}
