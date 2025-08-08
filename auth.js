import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signIn, registerUser } from './firebase-service.js';
import { initializeI18n } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if user is already logged in
    onAuthStateChanged(auth, user => {
        if (user) {
            // Check if we are not already on the main page to prevent redirect loops
            if (!window.location.pathname.endsWith('index.html')) {
                window.location.href = 'index.html';
            }
        }
    });

    initializeI18n();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            try {
                errorEl.textContent = '';
                await signIn(email, password);
                window.location.href = 'index.html';
            } catch (error) {
                errorEl.textContent = error.message;
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        // Prefill referral ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('ref');
        if (refId) {
            document.getElementById('register-referralid').value = refId;
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('register-error');
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
                errorEl.textContent = '';
                await registerUser(userData);
                window.location.href = 'index.html';
            } catch (error) {
                errorEl.textContent = error.message;
            }
        });
    }
});
