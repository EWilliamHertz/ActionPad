// FILE: js/services/comment.js
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { createNotification } from './notification.js';

export const addComment = (taskId, commentData, mentions) => {
     const language = localStorage.getItem('actionPadLanguage') || 'en';
     const commentRef =  addDoc(collection(db, 'tasks', taskId, 'comments'), {
        ...commentData,
        type: 'comment',
        language,
        createdAt: serverTimestamp()
    });
    mentions.forEach(userId => {
        createNotification(userId, {
            text: `${commentData.author.nickname} mentioned you in a comment on a task.`,
            taskId: taskId
        });
    });
    return commentRef;
};

export const logActivity = (taskId, activityData) => {
    return addDoc(collection(db, 'tasks', taskId, 'comments'), {
        ...activityData,
        type: 'activity',
        createdAt: serverTimestamp()
    });
};

export const listenToTaskComments = (taskId, callback) => {
    const q = query(collection(db, 'tasks', taskId, 'comments'), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
};
