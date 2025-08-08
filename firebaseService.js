import { auth, db } from './firebaseConfig.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Re-export onAuthStateChanged to be used in app.js
export { onAuthStateChanged };

// --- Authentication Functions ---
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const signOut = () => firebaseSignOut(auth);

// --- Firestore Functions ---
const tasksCollection = collection(db, 'tasks');

export const addTask = (taskData) => {
    const user = auth.currentUser;
    if (!user) return Promise.reject("User not authenticated");

    return addDoc(tasksCollection, {
        ...taskData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};

export const updateTask = (taskId, updatedData) => {
    const taskDocRef = doc(db, 'tasks', taskId);
    return updateDoc(taskDocRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
    });
};

export const deleteTask = (taskId) => {
    const taskDocRef = doc(db, 'tasks', taskId);
    return deleteDoc(taskDocRef);
};

export const listenToTasks = (userId, callback) => {
    const q = query(tasksCollection, where("userId", "==", userId), orderBy("createdAt", "desc"));

    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(tasks);
    });
};
