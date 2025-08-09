import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { 
    getUserProfile, 
    updateUserProfile, 
    uploadAvatar,
} from './services/user.js';
import { updateUserPassword } from './services/auth.js';
import { getCompany } from './services/company.js';
import { showToast } from './toast.js';

let currentUser = null;
let userProfile = null;
let companyDetails = [];

// Get references to DOM elements
const profileForm = document.getElementById('profile-info-form');
const passwordForm = document.getElementById('change-password-form');
const avatarInput = document.getElementById('avatar-upload-input');
const avatarButton = document.getElementById('avatar-upload-button');
const avatarPreview = document.getElementById('avatar-preview');
const companySelect = document.getElementById('company-select');
const roleInput = document.getElementById('profile-companyrole');
const nicknameInput = document.getElementById('profile-nickname');

// Listen for authentication state changes
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadProfileData();
    } else {
        window.location.replace('login.html');
    }
});

async function loadProfileData() {
    if (!currentUser) return;
    try {
        const profileSnap = await getUserProfile(currentUser.uid);
        if (profileSnap.exists()) {
            userProfile = profileSnap.data();
            
            nicknameInput.value = userProfile.nickname || '';
            if (userProfile.avatarURL) {
                avatarPreview.src = userProfile.avatarURL;
            }

            if (userProfile.companies && userProfile.companies.length > 0) {
                const companyPromises = userProfile.companies.map(async (membership) => {
                    const companySnap = await getCompany(membership.companyId);
                    return {
                        id: membership.companyId,
                        name: companySnap.exists() ? companySnap.data().name : 'Unknown Company',
                        role: membership.role
                    };
                });
                companyDetails = await Promise.all(companyPromises);

                populateCompanyDropdown();
            } else {
                companySelect.innerHTML = '<option>No companies found</option>';
                roleInput.value = 'N/A';
                roleInput.disabled = true;
                companySelect.disabled = true;
            }
        }
    } catch (error) {
        console.error("Error loading profile data:", error);
        showToast("Could not load your profile data.", "error");
    }
}

function populateCompanyDropdown() {
    companySelect.innerHTML = '';
    companyDetails.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        companySelect.appendChild(option);
    });

    if (companyDetails.length > 0) {
        roleInput.value = companyDetails[0].role;
    }

    companySelect.addEventListener('change', handleCompanySelectionChange);
}

function handleCompanySelectionChange() {
    const selectedCompanyId = companySelect.value;
    const selectedCompany = companyDetails.find(c => c.id === selectedCompanyId);
    if (selectedCompany) {
        roleInput.value = selectedCompany.role;
    }
}

if (avatarButton) {
    avatarButton.addEventListener('click', () => avatarInput.click());
}

if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;

        showToast('Uploading avatar...');
        try {
            const avatarURL = await uploadAvatar(currentUser.uid, file);
            await updateUserProfile(currentUser.uid, { avatarURL });
            avatarPreview.src = avatarURL;
            showToast('Avatar updated successfully!');
        } catch (error) {
            showToast('Failed to upload avatar.', 'error');
        }
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !userProfile) return;

        const selectedCompanyId = companySelect.value;
        const newRole = roleInput.value;
        const newNickname = nicknameInput.value;

        const updatedCompanies = userProfile.companies.map(membership => {
            if (membership.companyId === selectedCompanyId) {
                return { ...membership, role: newRole };
            }
            return membership;
        });

        const newData = {
            nickname: newNickname,
            companies: updatedCompanies
        };

        try {
            await updateUserProfile(currentUser.uid, newData);
            showToast('Profile saved successfully!');
            loadProfileData();
        } catch (error) {
            console.error("Error saving profile:", error);
            showToast('Failed to save profile.', 'error');
        }
    });
}

if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;

        if (!currentPassword || !newPassword) {
            showToast("Please fill in all password fields.", "error");
            return;
        }

        try {
            await updateUserPassword(currentPassword, newPassword);
            showToast('Password updated successfully!');
            passwordForm.reset();
        } catch (error) {
            showToast(`Password update failed: ${error.message}`, 'error');
        }
    });
}
