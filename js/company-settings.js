// FILE: js/company-settings.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getCompany, listenToCompanyPresence, updateUserRole, uploadCompanyLogo, updateCompany } from './services/company.js';
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
            const companyData = companySnap.data();
            document.getElementById('company-name-header').textContent = `${companyData.name} - Settings`;
            // NEW: Display existing company logo
            const logoPreview = document.getElementById('company-logo-preview');
            if (companyData.logoURL) {
                logoPreview.src = companyData.logoURL;
            }
        }

        if (membersListener) membersListener();
        membersListener = listenToCompanyPresence(companyId, (members) => {
            renderMembersList(members);
        });

        document.getElementById('save-roles-button').addEventListener('click', handleSaveChanges);
        // NEW: Event listeners for logo upload
        document.getElementById('logo-upload-button').addEventListener('click', () => {
            document.getElementById('logo-upload-input').click();
        });
        document.getElementById('logo-upload-input').addEventListener('change', handleLogoUpload);

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
        
        if (initialRoles[userId] !== newRole) {
            promises.push(updateUserRole(companyId, userId, newRole));
        }
    });

    try {
        await Promise.all(promises);
        showToast("User roles updated successfully!", "success");
        initialRoles = {};
    } catch (error) {
        console.error("Error saving roles:", error);
        showToast("An error occurred while saving roles.", "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
}

// NEW: Function to handle the logo file upload process
async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Uploading logo...', 'success');
    try {
        const logoURL = await uploadCompanyLogo(companyId, file);
        await updateCompany(companyId, { logoURL });
        document.getElementById('company-logo-preview').src = logoURL;
        showToast('Company logo updated!', 'success');
    } catch (error) {
        console.error("Logo upload failed:", error);
        showToast('Logo upload failed.', 'error');
    }
}
