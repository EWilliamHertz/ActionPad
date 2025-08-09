import { collection, addDoc, doc, getDoc, getDocs, query, where, serverTimestamp, arrayUnion, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { usersCollection } from './firestore.js';

const companiesCollection = collection(db, 'companies');

export const getCompany = (companyId) => getDoc(doc(companiesCollection, companyId));

export const createNewCompany = async (user, companyName, userRole) => {
    const newCompanyRef = await addDoc(companiesCollection, {
        name: companyName,
        referralId: Math.floor(100000 + Math.random() * 900000),
        createdAt: serverTimestamp()
    });
    const companyId = newCompanyRef.id;
    const userRef = doc(usersCollection, user.uid);

    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: userRole,
            projects: []
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

    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: role,
            projects: []
        }),
        companyIds: arrayUnion(companyId)
    });
    return { id: companyId, name: companyDoc.data().name };
};
