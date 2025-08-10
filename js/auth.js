// FILE: js/auth.js
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    writeBatch,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast } from './toast.js';
import { initializeI18n, getTranslatedString } from './i18n.js';
import { validateForm, setupLiveValidation } from './validation.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
    setupFormHandlers();
    
    // This listener handles redirection for ALREADY logged-in users.
    onAuthStateChanged(auth, user => {
        if (user && user.emailVerified) {
            // If user is on an auth page but is already logged in, they should not be here.
            // Check localStorage to see if a company is selected.
            if (localStorage.getItem('selectedCompanyId')) {
                window.location.replace('index.html');
            } else {
                // If no company is selected, they need to go to the dashboard to choose one.
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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            document.getElementById('email-verification-notice').classList.remove('hidden');
            submitButton.disabled = false;
            return;
        }

        const userProfileSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userProfileSnap.exists()) throw new Error("User profile not found.");
        
        const userProfile = userProfileSnap.data();
        const firstCompanyId = userProfile.companies?.[0]?.companyId;

        if (firstCompanyId) {
            localStorage.setItem('selectedCompanyId', firstCompanyId);
            window.location.replace('index.html');
        } else {
            window.location.replace('dashboard.html');
        }
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
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;
        const batch = writeBatch(db);
        let companyId;
        let finalRole = userData.companyRole;

        if (userData.referralId) {
            finalRole = 'Member';
            const q = query(collection(db, "companies"), where("referralId", "==", Number(userData.referralId)));
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
                name: userData.companyName, ownerId: user.uid, members: [user.uid],
                referralId: Math.floor(100000 + Math.random() * 900000), createdAt: serverTimestamp()
            });
        }
        
        batch.set(doc(db, 'users', user.uid), {
            uid: user.uid, email: userData.email, fullName: userData.fullName, nickname: userData.nickname,
            avatarURL: '', createdAt: serverTimestamp(),
            companies: [{ companyId, role: finalRole }], companyIds: [companyId]
        });

        await batch.commit();
        await sendEmailVerification(user);

        document.querySelector('.auth-box').innerHTML = `<h2>Registration Successful!</h2><p>A verification link has been sent to <strong>${userData.email}</strong>. Please check your inbox.</p>`;
    } catch (error) {
        showToast(error.message, 'error');
        submitButton.disabled = false;
    }
}

function setupReferralId(form) {
    const refId = new URLSearchParams(window.location.search).get('ref');
    if (refId) {
        form.querySelector('#register-referralid').value = refId;
        form.querySelector('#register-companyname').disabled = true;
        form.querySelector('#register-companyname').value = "Joining existing company...";
    }
}
