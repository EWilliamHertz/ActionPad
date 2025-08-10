// FILE: js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { showToast } from './toast.js';
import { initializeI18n, getTranslatedString } from './i18n.js';
import { validateForm, setupLiveValidation } from './validation.js';
// Import the service functions we created
import { signIn, registerUser, sendPasswordReset } from './services/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
    setupFormHandlers();
    
    // This listener handles redirection for ALREADY logged-in users.
    onAuthStateChanged(auth, user => {
        if (user && user.emailVerified) {
            if (localStorage.getItem('selectedCompanyId')) {
                window.location.replace('index.html');
            } else {
                window.location.replace('dashboard.html');
            }
        }
    });
});

function setupFormHandlers() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        setupLiveValidation(loginForm);
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        setupLiveValidation(registerForm);
        registerForm.addEventListener('submit', handleRegistration);
        setupReferralId(registerForm);
    }

    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('forgot-password-modal').classList.remove('hidden');
        });
    }
    
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if(forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handlePasswordReset);
    }

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
    });
}

async function handleLogin(event) {
    event.preventDefault();
    const loginForm = event.target;
    if (!validateForm(loginForm)) return;

    const email = loginForm.querySelector('#login-email').value;
    const password = loginForm.querySelector('#login-password').value;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        // Use the signIn service function
        const userCredential = await signIn(email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            const notice = document.getElementById('email-verification-notice');
            notice.textContent = `A verification email was sent to ${user.email}. Please verify your email before logging in.`;
            notice.classList.remove('hidden');
            submitButton.disabled = false;
            return;
        }
        // On successful login, the onAuthStateChanged listener will handle redirection.
    } catch (error) {
        showToast(getTranslatedString('invalidCredentials'), 'error');
        submitButton.disabled = false;
    }
}

async function handleRegistration(event) {
    event.preventDefault();
    const form = event.target;
    if (!validateForm(form)) return;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

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
        // Use the registerUser service function
        await registerUser(userData);
        document.querySelector('.auth-box').innerHTML = `<h2>Registration Successful!</h2><p>A verification link has been sent to <strong>${userData.email}</strong>. Please check your inbox and verify your account before logging in.</p>`;
    } catch (error) {
        const message = error.code === 'auth/email-already-in-use' 
            ? getTranslatedString('emailInUse') 
            : error.message;
        showToast(message, 'error');
        submitButton.disabled = false;
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.querySelector('#reset-email').value;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        await sendPasswordReset(email);
        showToast(`Password reset link sent to ${email}`, 'success');
        form.closest('.modal-overlay').classList.add('hidden');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

function setupReferralId(form) {
    const refId = new URLSearchParams(window.location.search).get('ref');
    if (refId) {
        const referralInput = form.querySelector('#register-referralid');
        const companyNameInput = form.querySelector('#register-companyname');
        
        referralInput.value = refId;
        companyNameInput.disabled = true;
        companyNameInput.value = "Joining existing company...";
    }
}
