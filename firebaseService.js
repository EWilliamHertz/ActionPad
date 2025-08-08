import { auth, db } from './firebaseConfig.js';

// --- Authentication Functions ---
export const signIn = (email, password) => auth.signInWithEmailAndPassword(email, password);
export const register = (email, password) => auth.createUserWithEmailAndPassword(email, password);
export const signOut = () => auth.signOut();

// --- Firestore Functions ---
const tasksCollection = db.collection('tasks');

export const addTask = (taskData) => {
    const user = auth.currentUser;
    if (!user) return Promise.reject("User not authenticated");

    return tasksCollection.add({
        ...taskData,
        userId: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
};

export const updateTask = (taskId, updatedData) => {
    return tasksCollection.doc(taskId).update({
        ...updatedData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
};

export const deleteTask = (taskId) => {
    return tasksCollection.doc(taskId).delete();
};

export const listenToTasks = (userId, callback) => {
    return tasksCollection.where("userId", "==", userId).orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(tasks);
        });
};
