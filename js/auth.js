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

    // --- Login Form Logic ---
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
                // Log the specific error and show a user-friendly message
                console.error("Login failed:", error.code, error.message);
                showToast(error.message, 'error');
            }
        });
    }

    // --- Registration Form Logic ---
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
            if (!validateForm(registerForm)) return;
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
                // After successful registration and email sending
                showToast('Registration successful! Please check your email to verify your account.', 'success');
                // Redirect to login page to wait for verification
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);

            } catch (error) {
                // **MODIFIED**: Added detailed console logging and user-friendly messages.
                console.error("Registration failed with error code:", error.code);
                console.error("Full error object:", error);
                
                let message = 'An unknown error occurred during registration.';
                if (error.code === 'auth/email-already-in-use') {
                    message = 'This email address is already registered. Please try logging in.';
                } else if (error.code) {
                    message = error.message; // Use the default Firebase message
                }
                
                showToast(message, 'error');
            }
        });
    }
});
