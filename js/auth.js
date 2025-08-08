// FILE: js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signIn, registerUser } from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import { showToast } from './toast.js';
import { validateForm, setupLiveValidation } from './validation.js';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        // If user is logged in, redirect to the main app page
        if (user && !window.location.pathname.includes('index.html')) {
            window.location.replace('index.html');
        }
    });

    // Initialize internationalization (language support)
    initializeI18n();

    // --- Login Form Logic ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        setupLiveValidation(loginForm);
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(loginForm)) return; // Stop if validation fails
            try {
                await signIn(document.getElementById('login-email').value, document.getElementById('login-password').value);
                window.location.href = 'index.html';
            } catch (error) {
                showToast("Login failed. Please check your email and password.", 'error');
            }
        });
    }

    // --- Registration Form Logic ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        setupLiveValidation(registerForm);

        // Check for a referral ID in the URL to pre-fill the form
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('ref');
        if (refId) {
            document.getElementById('register-referralid').value = refId;
            const companyNameInput = document.getElementById('register-companyname');
            companyNameInput.disabled = true;
            companyNameInput.value = "Joining existing company...";
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(registerForm)) return; // Stop if validation fails
            const userData = {
                email: document.getElementById('register-email').value,
                password: document.getElementById('register-password').value,
                fullName: document.getElementById('register-fullname').value,
                nickname: document.getElementById('register-nickname').value,
                companyName: document.getElementById('register-companyname').value,
                companyRole: document.getElementById('register-companyrole').value,
                referralId: document.getElementById('register-referralid').value || null
            };
            try {
                await registerUser(userData);
                window.location.href = 'index.html';
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }
});
