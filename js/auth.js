// FILE: js/auth.js
// --- Import initialized Firebase services and SDK functions ---
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, getDoc, writeBatch, collection, query, where, getDocs, serverTimestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Import your UI and utility modules ---
import { showToast } from './toast.js';
import { initializeI18n, getTranslatedString } from './i18n.js';
import { validateForm, setupLiveValidation } from './validation.js';


// --- Main Setup ---
document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();

    // This listener handles redirection for ALREADY logged-in users visiting auth pages.
    onAuthStateChanged(auth, user => {
        if (user && user.emailVerified) {
            // If user is on login/register page but is logged in, redirect them away.
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
                 window.location.replace('index.html');
            }
        }
    });

    setupFormHandlers();
});


// --- Form Handlers Setup ---
function setupFormHandlers() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    if (loginForm) {
        setupLiveValidation(loginForm);
        loginForm.addEventListener('submit', handleLogin);
        if (forgotPasswordLink) {
             forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                forgotPasswordModal.classList.remove('hidden');
            });
        }
        if (forgotPasswordModal) {
            forgotPasswordModal.querySelector('.modal-close').addEventListener('click', () => {
                forgotPasswordModal.classList.add('hidden');
            });
        }
       if(forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', handleForgotPassword);
       }
    }

    if (registerForm) {
        setupLiveValidation(registerForm);
        registerForm.addEventListener('submit', handleRegistration);
        setupReferralId(registerForm);
    }
}


// --- Logic Functions ---

async function handleLogin(event) {
    event.preventDefault();
    const loginForm = event.target;
    if (!validateForm(loginForm)) return;

    const email = loginForm.querySelector('#login-email').value;
    const password = loginForm.querySelector('#login-password').value;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            // Handle unverified user right on the login page
            const noticeDiv = document.getElementById('email-verification-notice');
            await handleUnverifiedUser(user, noticeDiv);
            submitButton.disabled = false; // Re-enable button
            return;
        }

        // ---- THE FIX: Post-login logic ----
        // 1. Fetch user profile from Firestore
        const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userProfileSnap.exists()) {
            throw new Error("User profile does not exist.");
        }
        const userProfile = userProfileSnap.data();

        // 2. Find their first company
        const firstCompanyId = userProfile.companies?.[0]?.companyId;
        if (!firstCompanyId) {
            // If they have no companies, send them to the dashboard to create/join one.
            window.location.replace('dashboard.html');
            return;
        }

        // 3. Set the selected company in localStorage and go to the main app
        localStorage.setItem('selectedCompanyId', firstCompanyId);
        window.location.replace('index.html');

    } catch (error) {
        console.error("Login failed:", error);
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
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;
        let companyId;
        let finalRole;
        const batch = writeBatch(db);

        if (userData.referralId) {
            finalRole = 'Member';
            const companiesRef = collection(db, "companies");
            const q = query(companiesRef, where("referralId", "==", userData.referralId));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) throw new Error("Invalid Referral ID.");
            const companyDoc = querySnapshot.docs[0];
            companyId = companyDoc.id;
            batch.update(companyDoc.ref, { members: arrayUnion(user.uid) });
        } else {
            finalRole = 'Admin';
            const companyRef = doc(collection(db, 'companies'));
            companyId = companyRef.id;
            batch.set(companyRef, {
                name: userData.companyName,
                ownerId: user.uid,
                members: [user.uid],
                createdAt: serverTimestamp(),
                referralId: `ref-${companyId.substring(0, 6)}`
            });
        }
        
        const userRef = doc(db, 'users', user.uid);
        batch.set(userRef, {
            uid: user.uid,
            email: userData.email,
            fullName: userData.fullName,
            nickname: userData.nickname,
            avatarURL: '',
            createdAt: serverTimestamp(),
            companies: [{ companyId, role: finalRole }],
            companyIds: [companyId]
        });

        await batch.commit();
        await sendEmailVerification(user);

        // Show success message instead of redirecting
        const authBox = document.querySelector('.auth-box');
        authBox.innerHTML = `
            <h2 style="text-align: center;">Registration Successful!</h2>
            <p style="text-align: center;">We've sent a verification link to <strong>${userData.email}</strong>.</p>
            <p style="text-align: center;">Please check your inbox to activate your account, then you can log in.</p>
            <a href="login.html" class="success-button">Go to Login Page</a>
        `;

    } catch (error) {
        console.error("Registration Error:", error);
        showToast(error.message || 'An unknown error occurred.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Register & Join';
    }
}

async function handleUnverifiedUser(user, noticeDiv) {
    if (!noticeDiv) return;
    noticeDiv.innerHTML = `
        <p>Your email is not verified. A new verification link has been sent to ${user.email}.</p>
        <p>Please check your inbox (and spam folder).</p>
    `;
    noticeDiv.classList.remove('hidden');
    await sendEmailVerification(user); // Send email automatically
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('reset-email').value;
    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Password reset link sent! Check your email.', 'success');
        document.getElementById('forgot-password-modal').classList.add('hidden');
    } catch (error) {
        showToast('Could not send reset email. Please check the address.', 'error');
    }
}

function setupReferralId(form) {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref');
    if (refId) {
        form.querySelector('#register-referralid').value = refId;
        form.querySelector('#register-companyname').disabled = true;
        form.querySelector('#register-companyname').value = "Joining existing company...";
        form.querySelector('#register-companyrole').value = "Member";
    }
}
