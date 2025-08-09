import { auth } from '../firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    sendEmailVerification as firebaseSendEmailVerification,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { usersCollection } from './firestore.js';
import { createNewCompany, joinCompanyWithReferralId } from './company.js';

export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const sendVerificationEmail = (user) => firebaseSendEmailVerification(user);
export const sendPasswordReset = (email) => firebaseSendPasswordResetEmail(auth, email);

export const signOut = () => {
    return firebaseSignOut(auth);
};

export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendVerificationEmail(user);

    let companyId;
    let finalRole = companyRole;

    if (referralId) {
        // Users joining an existing company are Members by default.
        finalRole = 'Member';
        const company = await joinCompanyWithReferralId(user, referralId, finalRole);
        companyId = company.id;
    } else {
        // The creator of a new company is an Admin.
        finalRole = 'Admin';
        companyId = await createNewCompany(user, companyName, finalRole);
    }

    await setDoc(doc(usersCollection, user.uid), {
        fullName,
        nickname,
        email,
        companies: [{
            companyId: companyId,
            role: finalRole,
        }],
        companyIds: [companyId]
    });

    localStorage.setItem('selectedCompanyId', companyId);
    return user;
};

export const updateUserPassword = async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
};
