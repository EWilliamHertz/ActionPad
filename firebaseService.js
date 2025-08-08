import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- Collections ---
const usersCollection = collection(db, 'users');
const companiesCollection = collection(db, 'companies');
const tasksCollection = collection(db, 'tasks');

// --- Auth Functions ---
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOut = () => firebaseSignOut(auth);

// --- Registration and Profile ---
export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;

    // 1. Check if a company exists with the referral ID
    let companyId;
    let finalCompanyName = companyName;

    if (referralId) {
        const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const companyDoc = querySnapshot.docs[0];
            companyId = companyDoc.id;
            finalCompanyName = companyDoc.data().name; // Use the existing company's name
        } else {
            throw new Error("Invalid Referral ID. Company not found.");
        }
    } else {
        // 2. No referral ID, create a new company
        const newCompanyRef = await addDoc(companiesCollection, {
            name: companyName,
            referralId: Math.floor(100000 + Math.random() * 900000), // Generate 6-digit ID
            createdAt: serverTimestamp()
        });
        companyId = newCompanyRef.id;
    }

    // 3. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 4. Create the user profile in Firestore
    await setDoc(doc(usersCollection, user.uid), {
        fullName,
        nickname,
        email,
        companyRole,
        companyId,
        companyName: finalCompanyName
    });

    return user;
};

// --- User & Company Data ---
export const getUserProfile = (userId) => {
    const userDocRef = doc(db, 'users', userId);
    return getDoc(userDocRef);
};

export const getCompanyByReferralId = async (referralId) => {
    const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data();
    }
    return null;
};

// --- Task Functions (Now Company-based) ---
export const addTask = (taskData, companyId) => {
    if (!companyId) return Promise.reject("Company ID not provided");
    return addDoc(tasksCollection, {
        ...taskData,
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};

export const updateTask = (taskId, updatedData) => {
    const taskDocRef = doc(db, 'tasks', taskId);
    return updateDoc(taskDocRef, { ...updatedData, updatedAt: serverTimestamp() });
};

export const deleteTask = (taskId) => {
    const taskDocRef = doc(db, 'tasks', taskId);
    return deleteDoc(taskDocRef);
};

export const listenToCompanyTasks = (companyId, callback) => {
    const q = query(tasksCollection, where("companyId", "==", companyId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(tasks);
    });
};
