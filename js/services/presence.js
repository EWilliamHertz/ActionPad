import { doc, updateDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getDatabase, ref, onValue, goOffline, goOnline, onDisconnect, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { db } from '../firebase-config.js';
import { usersCollection } from './firestore.js';

// This function now uses both Firestore and the Realtime Database for presence.
export const manageUserPresence = (user) => {
    const rtdb = getDatabase();
    const userStatusDatabaseRef = ref(rtdb, '/status/' + user.uid);
    const userStatusFirestoreRef = doc(db, 'users', user.uid);

    const isOfflineForRTDB = {
        online: false,
        last_changed: serverTimestamp()
    };
    const isOnlineForRTDB = {
        online: true,
        last_changed: serverTimestamp()
    };

    // Listen for connection state changes
    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            // If we lose connection, update our Firestore status
            updateDoc(userStatusFirestoreRef, isOfflineForRTDB);
            return;
        }

        // When we connect, set up the onDisconnect hook.
        // This is the magic of RTDB: it runs on the server when the client disconnects.
        onDisconnect(userStatusDatabaseRef).set(isOfflineForRTDB).then(() => {
            // Once the disconnect hook is configured, set the user's status to online.
            set(userStatusDatabaseRef, isOnlineForRTDB);
            // Also update Firestore to be online.
            updateDoc(userStatusFirestoreRef, isOnlineForRTDB);
        });
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
