// FILE: js/firebase-service.js
import { auth, db, rtdb, storage } from './firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential, 
    sendEmailVerification as firebaseSendEmailVerification,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
    query, where, serverTimestamp, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { ref, onValue, onDisconnect, set as rtSet, serverTimestamp as rtServerTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const usersCollection = collection(db, 'users');
const companiesCollection = collection(db, 'companies');
const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');

export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);

export const sendVerificationEmail = (user) => firebaseSendEmailVerification(user);

export const sendPasswordReset = (email) => firebaseSendPasswordResetEmail(auth, email);

export const signOut = () => {
    const user = auth.currentUser;
    if (user) {
        const userStatusFirestoreRef = doc(db, '/users/' + user.uid);
        updateDoc(userStatusFirestoreRef, { online: false, last_changed: serverTimestamp() }).catch(err => console.error("Error signing out:", err));
    }
    return firebaseSignOut(auth);
};

export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendVerificationEmail(user);
    try {
        let companyId;
        let finalCompanyName = companyName;
        if (referralId) {
            const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const companyDoc = querySnapshot.docs[0];
                companyId = companyDoc.id;
                finalCompanyName = companyDoc.data().name;
            } else {
                throw new Error("Invalid Referral ID. Company not found.");
            }
        } else {
            const newCompanyRef = await addDoc(companiesCollection, { name: companyName, referralId: Math.floor(100000 + Math.random() * 900000), createdAt: serverTimestamp() });
            companyId = newCompanyRef.id;
        }
        await setDoc(doc(usersCollection, user.uid), {
            fullName, nickname, email, companyRole, companyId,
            companyName: finalCompanyName, online: false, last_changed: serverTimestamp()
        });
        return user;
    } catch (error) {
        console.error("Error creating user profile in Firestore:", error);
        throw new Error("Your account was created, but we failed to set up your profile. Please contact support.");
    }
};

export const getUserProfile = (userId) => getDoc(doc(usersCollection, userId));
export const getCompany = (companyId) => getDoc(doc(companiesCollection, companyId));
export const getCompanyUsers = (companyId) => getDocs(query(usersCollection, where("companyId", "==", companyId)));
export const updateUserProfile = (userId, newData) => updateDoc(doc(db, 'users', userId), newData);
export const uploadAvatar = async (userId, file) => {
    const filePath = `avatars/${userId}/${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
};
export const updateUserPassword = async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
};
export const addProject = (projectData) => addDoc(projectsCollection, { ...projectData, createdAt: serverTimestamp() });
export const updateProject = (projectId, data) => updateDoc(doc(db, 'projects', projectId), data);
export const uploadProjectLogo = async (projectId, file) => {
    const filePath = `project_logos/${projectId}/${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
};
export const listenToCompanyProjects = (companyId, callback) => {
    const q = query(projectsCollection, where("companyId", "==", companyId));
    return onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(projects);
    });
};
export const addTask = (taskData, companyId, author) => addDoc(tasksCollection, { ...taskData, companyId, author: { uid: author.uid, nickname: author.nickname }, assignedTo: [], subtasks: [], attachments: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
export const updateTask = (taskId, updatedData) => updateDoc(doc(tasksCollection, taskId), { ...updatedData, updatedAt: serverTimestamp() });
export const deleteTask = (taskId) => deleteDoc(doc(tasksCollection, taskId));
export const listenToCompanyTasks = (companyId, projectId, callback) => {
    let q;
    if (projectId === 'all') {
        q = query(tasksCollection, where("companyId", "==", companyId));
    } else {
        q = query(tasksCollection, where("companyId", "==", companyId), where("projectId", "==", projectId));
    }
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
};
export const addComment = (taskId, commentData) => addDoc(collection(db, 'tasks', taskId, 'comments'), { ...commentData, type: 'comment', createdAt: serverTimestamp() });
export const logActivity = (taskId, activityData) => addDoc(collection(db, 'tasks', taskId, 'comments'), { ...activityData, type: 'activity', createdAt: serverTimestamp() });
export const listenToTaskComments = (taskId, callback) => {
    const q = query(collection(db, 'tasks', taskId, 'comments'), { orderBy: ["createdAt", "asc"] });
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
};
export const manageUserPresence = (user) => {
    const userStatusDatabaseRef = ref(rtdb, '/status/' + user.uid);
    const userStatusFirestoreRef = doc(db, '/users/' + user.uid);
    const isOfflineForDatabase = { state: 'offline', last_changed: rtServerTimestamp() };
    const isOnlineForDatabase = { state: 'online', last_changed: rtServerTimestamp() };
    const isOfflineForFirestore = { online: false, last_changed: serverTimestamp() };
    const isOnlineForFirestore = { online: true, last_changed: serverTimestamp() };
    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            updateDoc(userStatusFirestoreRef, isOfflineForFirestore).catch(()=>{});
            return;
        }
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
            rtSet(userStatusDatabaseRef, isOnlineForDatabase);
            updateDoc(userStatusFirestoreRef, isOnlineForFirestore).catch(()=>{});
        });
    });
};
export const listenToCompanyPresence = (companyId, callback) => {
    const q = query(usersCollection, where("companyId", "==", companyId));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
};
