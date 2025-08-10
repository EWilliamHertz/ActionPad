import { db } from '../firebase-config.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const getChatCollection = () => collection(db, 'project_chats');

export const addChatMessage = (projectId, author, text) => {
    return addDoc(getChatCollection(), {
        projectId,
        author,
        text,
        createdAt: serverTimestamp()
    });
};

export const listenToProjectChat = (projectId, callback) => {
    const q = query(getChatCollection(), where("projectId", "==", projectId), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};
