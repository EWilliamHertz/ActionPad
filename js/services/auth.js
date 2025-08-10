import { auth } from '../firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    sendEmailVerification as firebaseSendEmailVerification,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
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
    
    // 1. Create the Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Immediately send verification email
    await sendVerificationEmail(user);

    // 3. Create the user's document in Firestore with their basic info FIRST.
    // This is crucial because the company functions need this document to exist.
    await setDoc(doc(usersCollection, user.uid), {
        fullName,
        nickname,
        email,
        companies: [], // Start with empty arrays
        companyIds: []
    });

    let companyId;
    let finalRole = companyRole;

    // 4. Now, add company information to the newly created user document.
    if (referralId) {
        // Users joining an existing company are Members by default.
        finalRole = 'Member';
        const company = await joinCompanyWithReferralId(user, referralId, finalRole);
        companyId = company.id;
    } else {
        // The creator of a new company is an Admin by default.
        finalRole = 'Admin';
        companyId = await createNewCompany(user, companyName, finalRole);
    }

    // 5. Set the selected company in local storage and return the user.
    localStorage.setItem('selectedCompanyId', companyId);
    return user;
};

export const updateUserPassword = async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
};

export const deleteUserAccount = async (password) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("No user is currently logged in.");
    }

    // Re-authenticate the user with their current password for security
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // After successful re-authentication, delete the user's Firestore document
    await deleteDoc(doc(usersCollection, user.uid));

    // Finally, delete the user's Firebase account
    await deleteUser(user);

    // Note: To fully clean up all data (tasks, comments, attachments, etc.),
    // a Cloud Function or other server-side process would be ideal.
    // This client-side implementation deletes the user's record but
    // leaves orphaned data, which is a known limitation.
};
