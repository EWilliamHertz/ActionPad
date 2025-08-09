import { addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { chatCollection } from './firestore.js';

export const addChatMessage = (companyId, author, text) => {
    return addDoc(chatCollection, {
        companyId,
        author,
        text,
        createdAt: serverTimestamp()
    });
};

export const listenToCompanyChat = (companyId, callback) => {
    const q = query(chatCollection, where("companyId", "==", companyId), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};
