import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getUserProfile, updateUserProfile, uploadAvatar, updateUserPassword } from './firebase-service.js';
import { showToast } from './toast.js';

let currentUser = null;

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadProfileData();
    } else {
        window.location.replace('login.html');
    }
});

const profileForm = document.getElementById('profile-info-form');
const passwordForm = document.getElementById('change-password-form');
const avatarInput = document.getElementById('avatar-upload-input');
const avatarButton = document.getElementById('avatar-upload-button');
const avatarPreview = document.getElementById('avatar-preview');

async function loadProfileData() {
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

avatarButton.addEventListener('click', () => avatarInput.click());

avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const avatarURL = await uploadAvatar(currentUser.uid, file);
        await updateUserProfile(currentUser.uid, { avatarURL });
        avatarPreview.src = avatarURL;
        showToast('Avatar updated successfully!');
    } catch (error) {
        showToast('Failed to upload avatar.', 'error');
    }
});

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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
