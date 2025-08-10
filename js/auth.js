// FILE: js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { signIn, registerUser, signOut, sendVerificationEmail, sendPasswordReset, deleteUserAccount } from './services/auth.js';
import { initializeI18n, getTranslatedString } from './i18n.js';
import { showToast } from './toast.js';
import { validateForm, setupLiveValidation } from './validation.js';

// --- Main Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Centralized DOM element selection
    const pageElements = {
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        forgotPasswordLink: document.getElementById('forgot-password-link'),
        forgotPasswordModal: document.getElementById('forgot-password-modal'),
        forgotPasswordForm: document.getElementById('forgot-password-form'),
        emailVerificationNotice: document.getElementById('email-verification-notice'),
        passwordStrengthIndicator: document.getElementById('password-strength')
    };

    onAuthStateChanged(auth, user => {
        if (user && user.emailVerified && !window.location.pathname.includes('index.html')) {
            window.location.replace('index.html');
        }
    });

    initializeI18n();
    setupFormHandlers(pageElements);
});

// --- Form Handlers ---
function setupFormHandlers(elements) {
    if (elements.loginForm) {
        setupLiveValidation(elements.loginForm);
        elements.loginForm.addEventListener('submit', (e) => handleLogin(e, elements));
        elements.forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            elements.forgotPasswordModal.classList.remove('hidden');
        });
        elements.forgotPasswordModal.querySelector('.modal-close').addEventListener('click', () => {
            elements.forgotPasswordModal.classList.add('hidden');
        });
        elements.forgotPasswordForm.addEventListener('submit', (e) => handleForgotPassword(e, elements));
    }

    if (elements.registerForm) {
        setupLiveValidation(elements.registerForm);
        elements.registerForm.addEventListener('submit', (e) => handleRegistration(e));
        const passwordInput = elements.registerForm.querySelector('#register-password');
        passwordInput.addEventListener('input', () => checkPasswordStrength(passwordInput, elements.passwordStrengthIndicator));
        setupReferralId(elements.registerForm);
    }
}

// --- Logic Functions ---

async function handleLogin(event, elements) {
    event.preventDefault();
    const { loginForm, emailVerificationNotice } = elements;
    if (!validateForm(loginForm)) return;

    const email = loginForm.querySelector('#login-email').value;
    const password = loginForm.querySelector('#login-password').value;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const userCredential = await signIn(email, password);
        if (!userCredential.user.emailVerified) {
            await handleUnverifiedUser(userCredential.user, emailVerificationNotice);
        }
    } catch (error) {
        console.error("Login failed:", error.code);
        showToast(getTranslatedString('invalidCredentials'), 'error');
        emailVerificationNotice.classList.add('hidden');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleRegistration(event) {
    event.preventDefault();
    const form = event.target;
    if (!validateForm(form)) return;

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Registering...';

    const userData = {
        email: form.querySelector('#register-email').value,
        password: form.querySelector('#register-password').value,
        fullName: form.querySelector('#register-fullname').value,
        nickname: form.querySelector('#register-nickname').value,
        companyName: form.querySelector('#register-companyname').value,
        companyRole: form.querySelector('#register-companyrole').value,
        referralId: form.querySelector('#register-referralid').value || null
    };

    try {
        await registerUser(userData);
        const authBox = document.querySelector('.auth-box');
        authBox.innerHTML = `
            <h2 style="text-align: center;">Registration Successful!</h2>
            <p style="text-align: center;">We've sent a verification link to <strong>${userData.email}</strong>.</p>
            <p style="text-align: center;">Please check your inbox and click the link to activate your account.</p>
            <a href="login.html" class="success-button">Go to Login Page</a>
        `;
    } catch (error) {
        // This will now log the full error from Firebase, including the index link
        console.error("Full Firebase Error:", error);
        
        let message;
        if (error.code === 'auth/email-already-in-use') {
            message = getTranslatedString('emailInUse');
        } else if (error.code === 'failed-precondition') {
            message = getTranslatedString('requiredIndex');
        } else {
            message = getTranslatedString('genericError');
        }
        
        showToast(message, 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Register & Join';
    }
}

async function handleUnverifiedUser(user, noticeDiv) {
    noticeDiv.innerHTML = `
        <p>Please verify your email.</p>
        <p>A verification link was sent to ${user.email}.</p>
        <button id="resend-verification-btn">Resend Verification Email</button>
    `;
    noticeDiv.classList.remove('hidden');

    const resendButton = noticeDiv.querySelector('#resend-verification-btn');
    resendButton.addEventListener('click', async () => {
        resendButton.disabled = true;
        try {
            await sendVerificationEmail(user);
            showToast('A new verification email has been sent.', 'success');
            let countdown = 60;
            resendButton.textContent = `Sent! Try again in ${countdown}s`;
            const interval = setInterval(() => {
                countdown--;
                resendButton.textContent = `Sent! Try again in ${countdown}s`;
                if (countdown <= 0) {
                    clearInterval(interval);
                    resendButton.textContent = 'Resend Verification Email';
                    resendButton.disabled = false;
                }
            }, 1000);
        } catch (err) {
            showToast('Failed to send email. Please try again later.', 'error');
            resendButton.disabled = false;
        }
    });
}

async function handleForgotPassword(event, elements) {
    event.preventDefault();
    const { forgotPasswordForm, forgotPasswordModal } = elements;
    const email = forgotPasswordForm.querySelector('#reset-email').value;
    try {
        await sendPasswordReset(email);
        showToast('Password reset link sent! Check your email.', 'success');
        forgotPasswordModal.classList.add('hidden');
    } catch (error) {
        console.error("Password reset failed:", error.code);
        showToast('Could not send reset email. Please check the address.', 'error');
    }
}

function setupReferralId(form) {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref');
    if (refId) {
        form.querySelector('#register-referralid').value = refId;
        const companyNameInput = form.querySelector('#register-companyname');
        companyNameInput.disabled = true;
        companyNameInput.value = "Joining existing company...";
    }
}

function checkPasswordStrength(passwordInput, strengthIndicator) {
    const password = passwordInput.value;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    if (!strengthIndicator) return;
    strengthIndicator.className = 'password-strength-indicator';
    const strengthText = strengthIndicator.querySelector('.strength-text');

    if (password.length === 0) {
        if(strengthText) strengthText.textContent = '';
        return;
    }

    if (strength < 2) {
        strengthIndicator.classList.add('weak');
        if(strengthText) strengthText.textContent = 'Weak';
    } else if (strength < 4) {
        strengthIndicator.classList.add('medium');
        if(strengthText) strengthText.textContent = 'Medium';
    } else {
        strengthIndicator.classList.add('strong');
        if(strengthText) strengthText.textContent = 'Strong';
    }
}
