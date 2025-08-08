// FILE: js/settings.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getUserProfile, updateUserProfile, uploadAvatar, updateUserPassword } from './firebase-service.js';
import { showToast } from './toast.js';

let currentUser = null;

// Listen for authentication state changes
onAuthStateChanged(auth, user => {
    if (user) {
        // If user is logged in, set the current user and load their profile
        currentUser = user;
        loadProfileData();
    } else {
        // If user is not logged in, redirect to the login page
        window.location.replace('login.html');
    }
});

// Get references to DOM elements on the settings page
const profileForm = document.getElementById('profile-info-form');
const passwordForm = document.getElementById('change-password-form');
const avatarInput = document.getElementById('avatar-upload-input');
const avatarButton = document.getElementById('avatar-upload-button');
const avatarPreview = document.getElementById('avatar-preview');

/**
 * Fetches the current user's profile data from Firestore and populates the form.
 */
async function loadProfileData() {
    if (!currentUser) return;
    const profileSnap = await getUserProfile(currentUser.uid);
    if (profileSnap.exists()) {
        const profile = profileSnap.data();
        document.getElementById('profile-nickname').value = profile.nickname;
        document.getElementById('profile-companyrole').value = profile.companyRole;
        if (profile.avatarURL) {
            avatarPreview.src = profile.avatarURL;
        }
    }
}

// --- Event Listeners ---

// Only add event listeners if the elements exist on the page
if (avatarButton) {
    avatarButton.addEventListener('click', () => avatarInput.click());
}

if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;

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
        if (!currentUser) return;
        const newData = {
            nickname: document.getElementById('profile-nickname').value,
            companyRole: document.getElementById('profile-companyrole').value,
        };
        try {
            await updateUserProfile(currentUser.uid, newData);
            showToast('Profile saved successfully!');
        } catch (error) {
            showToast('Failed to save profile.', 'error');
        }
    });
}

if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;

        try {
            await updateUserPassword(currentPassword, newPassword);
            showToast('Password updated successfully!');
            passwordForm.reset();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}
