import { doc, updateDoc, query, where, onSnapshot, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref, onValue, goOffline, goOnline, onDisconnect, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from '../firebase-config.js';

export const manageUserPresence = (user) => {
    const rtdb = getDatabase();
    const userStatusDatabaseRef = ref(rtdb, '/status/' + user.uid);
    const userStatusFirestoreRef = doc(collection(db, 'users'), user.uid);

    const isOfflineForRTDB = {
        online: false,
        last_changed: serverTimestamp()
    };
    const isOnlineForRTDB = {
        online: true,
        last_changed: serverTimestamp()
    };

    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            updateDoc(userStatusFirestoreRef, isOfflineForRTDB);
            return;
        }

        onDisconnect(userStatusDatabaseRef).set(isOfflineForRTDB).then(() => {
            set(userStatusDatabaseRef, isOnlineForRTDB);
            updateDoc(userStatusFirestoreRef, isOnlineForRTDB);
        });
    });
};

export const listenToCompanyPresence = (companyId, callback) => {
    const q = query(collection(db, 'users'), where("companyIds", "array-contains", companyId));
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

