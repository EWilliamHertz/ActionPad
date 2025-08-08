import { auth, db, rtdb } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
    query, where, orderBy, serverTimestamp, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    ref, onValue, onDisconnect, set as rtSet, serverTimestamp as rtServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

// --- Collections References ---
const usersCollection = collection(db, 'users');
const companiesCollection = collection(db, 'companies');
const tasksCollection = collection(db, 'tasks');

// --- Auth Functions ---
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOut = () => {
    // Before signing out, update presence to offline
    const user = auth.currentUser;
    if (user) {
        const userStatusFirestoreRef = doc(db, '/users/' + user.uid);
        updateDoc(userStatusFirestoreRef, { online: false, last_changed: serverTimestamp() });
    }
    return firebaseSignOut(auth);
};


// --- Registration and Profile ---
export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;

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
        const newCompanyRef = await addDoc(companiesCollection, {
            name: companyName,
            referralId: Math.floor(100000 + Math.random() * 900000),
            createdAt: serverTimestamp()
        });
        companyId = newCompanyRef.id;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(usersCollection, user.uid), {
        fullName,
        nickname,
        email,
        companyRole,
        companyId,
        companyName: finalCompanyName,
        online: false, // Default to offline
        last_changed: serverTimestamp()
    });

    return user;
};

// --- User & Company Data ---
export const getUserProfile = (userId) => getDoc(doc(usersCollection, userId));
export const getCompany = (companyId) => getDoc(doc(companiesCollection, companyId));
export const getCompanyUsers = (companyId) => {
    const q = query(usersCollection, where("companyId", "==", companyId));
    return getDocs(q);
};

// --- Task Functions ---
export const addTask = (taskData, companyId, author) => {
    return addDoc(tasksCollection, {
        ...taskData,
        companyId,
        author: { uid: author.uid, nickname: author.nickname },
        assignedTo: [],
        subtasks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};
export const updateTask = (taskId, updatedData) => updateDoc(doc(tasksCollection, taskId), { ...updatedData, updatedAt: serverTimestamp() });
export const deleteTask = (taskId) => deleteDoc(doc(tasksCollection, taskId));
export const listenToCompanyTasks = (companyId, callback) => {
    const q = query(tasksCollection, where("companyId", "==", companyId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(tasks);
    });
};

// --- Comments & Activity Log ---
export const addComment = (taskId, commentData) => {
    const commentsCol = collection(db, 'tasks', taskId, 'comments');
    return addDoc(commentsCol, {
        ...commentData,
        type: 'comment',
        createdAt: serverTimestamp()
    });
};

export const logActivity = (taskId, activityData) => {
    const commentsCol = collection(db, 'tasks', taskId, 'comments');
    return addDoc(commentsCol, {
        ...activityData,
        type: 'activity',
        createdAt: serverTimestamp()
    });
};

export const listenToTaskComments = (taskId, callback) => {
    const commentsCol = collection(db, 'tasks', taskId, 'comments');
    const q = query(commentsCol, orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(comments);
    });
};

// --- User Presence System ---
export const manageUserPresence = (user) => {
    const userStatusDatabaseRef = ref(rtdb, '/status/' + user.uid);
    const userStatusFirestoreRef = doc(db, '/users/' + user.uid);

    const isOfflineForDatabase = { state: 'offline', last_changed: rtServerTimestamp() };
    const isOnlineForDatabase = { state: 'online', last_changed: rtServerTimestamp() };

    const isOfflineForFirestore = { online: false, last_changed: serverTimestamp() };
    const isOnlineForFirestore = { online: true, last_changed: serverTimestamp() };

    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            updateDoc(userStatusFirestoreRef, isOfflineForFirestore);
            return;
        }

        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
            rtSet(userStatusDatabaseRef, isOnlineForDatabase);
            updateDoc(userStatusFirestoreRef, isOnlineForFirestore);
        });
    });
};

export const listenToCompanyPresence = (companyId, callback) => {
    const q = query(usersCollection, where("companyId", "==", companyId));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(users);
    });
};
