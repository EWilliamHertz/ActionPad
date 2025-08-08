// FILE: js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signIn, registerUser } from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import { showToast } from './toast.js';
import { validateForm, setupLiveValidation } from './validation.js';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user && !window.location.pathname.includes('index.html')) {
            window.location.replace('index.html');
        }
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
            } catch (error) {
                console.error("Login failed:", error.code, error.message);
                showToast(error.message, 'error');
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        setupLiveValidation(registerForm);

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
            const submitButton = registerForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Registering...';

            if (!validateForm(registerForm)) {
                submitButton.disabled = false;
                submitButton.textContent = 'Register & Join';
                return;
            }
            
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
                // **MODIFIED**: Show a clear success message instead of just a toast.
                const authBox = document.querySelector('.auth-box');
                authBox.innerHTML = `
                    <h2>Registration Successful!</h2>
                    <p>We've sent a verification link to <strong>${userData.email}</strong>.</p>
                    <p>Please check your inbox and click the link to activate your account before logging in.</p>
                    <a href="login.html" class="button">Go to Login Page</a>
                `;

            } catch (error) {
                console.error("Registration failed:", error.code, error.message);
                let message = error.message || 'An unknown error occurred.';
                if (error.code === 'auth/email-already-in-use') {
                    message = 'This email address is already registered. Please try logging in.';
                }
                showToast(message, 'error');
                submitButton.disabled = false;
                submitButton.textContent = 'Register & Join';
            }
        });
    }
});
