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
    let finalCompanyName = companyName;

    if (referralId) {
        const company = await joinCompanyWithReferralId(user, referralId, companyRole);
        companyId = company.id;
        finalCompanyName = company.name;
    } else {
        companyId = await createNewCompany(user, companyName, companyRole);
    }

    await setDoc(doc(usersCollection, user.uid), {
        fullName,
        nickname,
        email,
        companies: [{
            companyId: companyId,
            role: companyRole,
            projects: [] // Array of { projectId, role }
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
