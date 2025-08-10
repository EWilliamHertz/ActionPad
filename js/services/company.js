import { collection, addDoc, doc, getDoc, getDocs, query, where, serverTimestamp, arrayUnion, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { usersCollection } from './firestore.js';
import { listenToCompanyPresence as originalListen } from './presence.js';

const companiesCollection = collection(db, 'companies');

export const getCompany = (companyId) => getDoc(doc(companiesCollection, companyId));

export const createNewCompany = async (user, companyName, userRole) => {
    // Create the new company document
    const newCompanyRef = await addDoc(companiesCollection, {
        name: companyName,
        referralId: Math.floor(100000 + Math.random() * 900000),
        createdAt: serverTimestamp()
    });
    const companyId = newCompanyRef.id;
    const userRef = doc(usersCollection, user.uid);

    // Atomically add the new company and role to the user's 'companies' array
    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: userRole,
        }),
        companyIds: arrayUnion(companyId)
    });
    return companyId;
};

export const joinCompanyWithReferralId = async (user, referralId, role) => {
    const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Invalid Referral ID. Company not found.");
    }

    const companyDoc = querySnapshot.docs[0];
    const companyId = companyDoc.id;
    const userRef = doc(usersCollection, user.uid);

    // Atomically add the new company and role to the user's 'companies' array
    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: role,
        }),
        companyIds: arrayUnion(companyId)
    });
    return { id: companyId, name: companyDoc.data().name };
};

export const updateUserRole = async (companyId, userId, newRole) => {
    const userRef = doc(usersCollection, userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedCompanies = userData.companies.map(membership => {
            if (membership.companyId === companyId) {
                return { ...membership, role: newRole };
            }
            return membership;
        });

        await updateDoc(userRef, { companies: updatedCompanies });
    } else {
        throw new Error("User not found.");
    }
};

// Re-exporting this function so it can be accessed via services/company.js
export const listenToCompanyPresence = originalListen;
