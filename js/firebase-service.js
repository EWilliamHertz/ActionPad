// This module handles all direct communication with Firebase services (Auth and Firestore).
// It abstracts the Firebase calls into functions that the rest of the application can use.

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
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- Collections References ---
const usersCollection = collection(db, 'users');
const companiesCollection = collection(db, 'companies');
const tasksCollection = collection(db, 'tasks');

// --- Authentication Functions ---
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOut = () => firebaseSignOut(auth);

// --- Registration and Profile Management ---
export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;

    let companyId;
    let finalCompanyName = companyName;

    // If a referral ID is provided, find the existing company.
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
        // If no referral ID, create a new company with a unique referral ID.
        const newCompanyRef = await addDoc(companiesCollection, {
            name: companyName,
            referralId: Math.floor(100000 + Math.random() * 900000), // Generate 6-digit ID
            createdAt: serverTimestamp()
        });
        companyId = newCompanyRef.id;
    }

    // Create the user in Firebase Authentication.
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create the user's profile document in Firestore, linking them to the company.
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

// --- User & Company Data Fetching ---
export const getUserProfile = (userId) => {
    const userDocRef = doc(db, 'users', userId);
    return getDoc(userDocRef);
};

export const getCompany = (companyId) => {
    const companyDocRef = doc(db, 'companies', companyId);
    return getDoc(companyDocRef);
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

// Sets up a real-time listener for all tasks belonging to a specific company.
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
