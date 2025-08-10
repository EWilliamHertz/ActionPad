import { addDoc, query, where, orderBy, onSnapshot, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';

const chatCollection = collection(db, 'project_chats');

export const addChatMessage = (projectId, author, text) => {
    return addDoc(chatCollection, {
        projectId,
        author,
        text,
        createdAt: serverTimestamp()
    });
};

export const listenToProjectChat = (projectId, callback) => {
    const q = query(chatCollection, where("projectId", "==", projectId), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};
