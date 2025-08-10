import { collection, addDoc, doc, getDoc, getDocs, query, where, serverTimestamp, arrayUnion, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { db, storage } from '../firebase-config.js';
import { listenToCompanyPresence as originalListen } from './presence.js';

export const getCompany = (companyId) => {
    return getDoc(doc(collection(db, 'companies'), companyId));
}

export const createNewCompany = async (user, companyName, userRole) => {
    const newCompanyRef = await addDoc(collection(db, 'companies'), {
        name: companyName,
        ownerId: user.uid,
        members: [user.uid],
        referralId: Math.floor(100000 + Math.random() * 900000),
        createdAt: serverTimestamp()
    });
    const companyId = newCompanyRef.id;
    const userRef = doc(collection(db, 'users'), user.uid);

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
    const q = query(collection(db, 'companies'), where("referralId", "==", Number(referralId)));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Invalid Referral ID. Company not found.");
    }

    const companyDoc = querySnapshot.docs[0];
    const companyId = companyDoc.id;
    const userRef = doc(collection(db, 'users'), user.uid);

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
    const userRef = doc(collection(db, 'users'), userId);
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

export const updateCompany = (companyId, data) => {
    return updateDoc(doc(collection(db, 'companies'), companyId), data);
}

export const uploadCompanyLogo = async (companyId, file) => {
    const filePath = `company_logos/${companyId}/${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
};

export const listenToCompanyPresence = originalListen;
