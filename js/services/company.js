import { collection, addDoc, doc, getDoc, getDocs, query, where, serverTimestamp, arrayUnion, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { db, storage } from '../firebase-config.js';
import { listenToCompanyPresence as originalListen } from './presence.js';

// Create direct references to collections
const companiesCol = collection(db, 'companies');
const usersCol = collection(db, 'users');

export const getCompany = (companyId) => getDoc(doc(companiesCol, companyId));

export const createNewCompany = async (user, companyName, userRole) => {
    const newCompanyRef = await addDoc(companiesCol, {
        name: companyName,
        ownerId: user.uid,
        members: [user.uid],
        referralId: Math.floor(100000 + Math.random() * 900000),
        createdAt: serverTimestamp()
    });
    const companyId = newCompanyRef.id;
    const userRef = doc(usersCol, user.uid);

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
    const q = query(companiesCol, where("referralId", "==", Number(referralId)));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Invalid Referral ID. Company not found.");
    }

    const companyDoc = querySnapshot.docs[0];
    const companyId = companyDoc.id;
    const userRef = doc(usersCol, user.uid);

    await updateDoc(companyDoc.ref, {
        members: arrayUnion(user.uid)
    });

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
    const userRef = doc(usersCol, userId);
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

export const updateCompany = (companyId, data) => updateDoc(doc(companiesCol, companyId), data);

export const uploadCompanyLogo = async (companyId, file) => {
    const filePath = `company_logos/${companyId}/${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
};

export const listenToCompanyPresence = originalListen;
