import { doc, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { usersCollection } from './firestore.js';
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export const manageUserPresence = async (user, companyId) => {
    const userStatusFirestoreRef = doc(db, 'users', user.uid);
    await updateDoc(userStatusFirestoreRef, {
        online: true,
        last_changed: serverTimestamp(),
        activeCompany: companyId
    });
};

export const listenToCompanyPresence = (companyId, callback) => {
    const q = query(usersCollection, where("companyIds", "array-contains", companyId));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            const companyInfo = data.companies.find(c => c.companyId === companyId);
            return {
                id: doc.id,
                ...data,
                companyRole: companyInfo?.role
            };
        });
        callback(users);
    });
};
