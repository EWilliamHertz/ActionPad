import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signIn, registerUser } from './firebase-service.js';
import { initializeI18n } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            if (!window.location.pathname.includes('index.html')) {
                window.location.replace('index.html');
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
                console.error("Login failed:", error);
                errorEl.textContent = "Login failed. Please check your email and password.";
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('ref');
        if (refId) {
            document.getElementById('register-referralid').value = refId;
            document.getElementById('register-companyname').disabled = true;
            document.getElementById('register-companyname').value = "Joining existing company...";
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
                console.error("Registration failed:", error);
                errorEl.textContent = error.message;
            }
        });
    }
});
