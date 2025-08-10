import { auth, db } from '../firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    sendEmailVerification as firebaseSendEmailVerification,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { setDoc, doc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { createNewCompany, joinCompanyWithReferralId } from './company.js';

// Create a direct reference to the users collection
const usersCol = collection(db, 'users');

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

    // Use the direct collection reference
    await setDoc(doc(usersCol, user.uid), {
        fullName,
        nickname,
        email,
        companies: [],
        companyIds: []
    });

    let companyId;
    let finalRole = companyRole;

    if (referralId) {
        finalRole = 'Member';
        const company = await joinCompanyWithReferralId(user, referralId, finalRole);
        companyId = company.id;
    } else {
        finalRole = 'Admin';
        companyId = await createNewCompany(user, companyName, finalRole);
    }

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

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // Use the direct collection reference
    await deleteDoc(doc(usersCol, user.uid));

    await deleteUser(user);
};
