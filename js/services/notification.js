import { collection, addDoc, writeBatch, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';

export const createNotification = (userId, notificationData) => {
    const userNotificationsCollection = collection(db, 'users', userId, 'notifications');
    return addDoc(userNotificationsCollection, {
        ...notificationData,
        isRead: false,
        createdAt: serverTimestamp()
    });
};

export const listenToNotifications = (userId, callback) => {
    const q = query(collection(db, 'users', userId, 'notifications'), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifications);
    });
};

export const markNotificationsAsRead = (userId, notifications) => {
    const batch = writeBatch(db);
    notifications.forEach(notif => {
        if (!notif.isRead) {
            const notifRef = doc(db, 'users', userId, 'notifications', notif.id);
            batch.update(notifRef, { isRead: true });
        }
    });
    return batch.commit();
};
