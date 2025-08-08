// FILE: js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signIn, registerUser } from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import { showToast } from './toast.js';
import { validateForm, setupLiveValidation } from './validation.js';
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user && !window.location.pathname.includes('index.html')) window.location.replace('index.html');
    });
    initializeI18n();
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        setupLiveValidation(loginForm);
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(loginForm)) return;
            try {
                await signIn(document.getElementById('login-email').value, document.getElementById('login-password').value);
                window.location.href = 'index.html';
            } catch (error) { showToast("Login failed. Please check your email and password.", 'error'); }
        });
    }
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        setupLiveValidation(registerForm);
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('ref');
        if (refId) {
            document.getElementById('register-referralid').value = refId;
            document.getElementById('register-companyname').disabled = true;
            document.getElementById('register-companyname').value = "Joining existing company...";
        }
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(registerForm)) return;
            const userData = {
                email: document.getElementById('register-email').value, password: document.getElementById('register-password').value,
                fullName: document.getElementById('register-fullname').value, nickname: document.getElementById('register-nickname').value,
                companyName: document.getElementById('register-companyname').value, companyRole: document.getElementById('register-companyrole').value,
                referralId: document.getElementById('register-referralid').value || null
            };
            try {
                await registerUser(userData);
                window.location.href = 'index.html';
            } catch (error) { showToast(error.message, 'error'); }
        });
    }
});

// =================================================================================

// FILE: js/settings.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getUserProfile, updateUserProfile, uploadAvatar, updateUserPassword } from './firebase-service.js';
import { showToast } from './toast.js';
let currentUser = null;
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadProfileData();
    } else { window.location.replace('login.html'); }
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
        if (profile.avatarURL) avatarPreview.src = profile.avatarURL;
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
    } catch (error) { showToast('Failed to upload avatar.', 'error'); }
});
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newData = { nickname: document.getElementById('profile-nickname').value, companyRole: document.getElementById('profile-companyrole').value };
    try {
        await updateUserProfile(currentUser.uid, newData);
        showToast('Profile saved successfully!');
    } catch (error) { showToast('Failed to save profile.', 'error'); }
});
passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    try {
        await updateUserPassword(currentPassword, newPassword);
        showToast('Password updated successfully!');
        passwordForm.reset();
    } catch (error) { showToast(error.message, 'error'); }
});
