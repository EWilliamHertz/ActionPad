// FILE: js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
// **MODIFIED**: Imported sendVerificationEmail
import { signIn, registerUser, signOut, sendVerificationEmail } from './firebase-service.js';
import { initializeI18n } from './i18n.js';
import { showToast } from './toast.js';
import { validateForm, setupLiveValidation } from './validation.js';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        // **MODIFIED**: This now correctly handles the redirect logic.
        // It only redirects if the user is fully authenticated (logged in AND verified)
        // and is not already on the main app page.
        if (user && user.emailVerified) {
            if (!window.location.pathname.includes('index.html')) {
                window.location.replace('index.html');
            }
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

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const noticeDiv = document.getElementById('email-verification-notice');
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            try {
                const userCredential = await signIn(email, password);
                const user = userCredential.user;

                if (user.emailVerified) {
                    // Success: User is verified, the onAuthStateChanged listener will handle the redirect.
                    noticeDiv.classList.add('hidden');
                } else {
                    // **NEW FLOW**: User exists but is not verified
                    noticeDiv.innerHTML = `
                        <p style="font-weight: 500; margin-bottom: 0.5rem;">Please verify your email.</p>
                        <p style="font-size: 0.9rem; margin-top: 0;">A verification link was sent to ${user.email}.</p>
                        <button id="resend-verification-btn" style="width: 100%; padding: 0.5rem; margin-top: 0.5rem; cursor: pointer; border: 1px solid; border-radius: 4px;">Resend Verification Email</button>
                    `;
                    noticeDiv.classList.remove('hidden');

                    document.getElementById('resend-verification-btn').addEventListener('click', async () => {
                        const resendButton = document.getElementById('resend-verification-btn');
                        resendButton.disabled = true;
                        resendButton.textContent = 'Sending...';
                        try {
                            await sendVerificationEmail(user);
                            showToast('A new verification email has been sent.', 'success');
                            resendButton.textContent = 'Sent!';
                        } catch (err) {
                            showToast('Failed to send email. Please try again later.', 'error');
                            resendButton.disabled = false;
                            resendButton.textContent = 'Resend Verification Email';
                        }
                    });

                    // Sign out the user so they can't access the app without verification
                    await signOut();
                    submitButton.disabled = false;
                }
            } catch (error) {
                console.error("Login failed:", error.code, error.message);
                showToast(error.message, 'error');
                submitButton.disabled = false;
                noticeDiv.classList.add('hidden');
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
                const authBox = document.querySelector('.auth-box');
                authBox.innerHTML = `
                    <h2 style="text-align: center;">Registration Successful!</h2>
                    <p style="text-align: center;">We've sent a verification link to <strong>${userData.email}</strong>.</p>
                    <p style="text-align: center;">Please check your inbox and click the link to activate your account.</p>
                    <a href="login.html" class="button" style="display: block; text-align: center; margin-top: 1.5rem; text-decoration: none; background-color: var(--primary-color); color: white; padding: 0.9rem; border-radius: 6px;">Go to Login Page</a>
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
