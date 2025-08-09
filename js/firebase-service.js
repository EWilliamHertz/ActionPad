// FILE: js/firebase-service.js
import { auth, db, storage } from './firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential, 
    sendEmailVerification as firebaseSendEmailVerification,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
    query, where, serverTimestamp, setDoc, onSnapshot, orderBy, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { showToast } from './toast.js';

const usersCollection = collection(db, 'users');
const companiesCollection = collection(db, 'companies');
const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');
const chatCollection = collection(db, 'team_chat');

const GEMINI_API_KEY = "AIzaSyC9VG3fpf0VAsKfWgJE60lGWcmH6qObCN0";

// --- Authentication & User Management ---
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const sendVerificationEmail = (user) => firebaseSendEmailVerification(user);
export const sendPasswordReset = (email) => firebaseSendPasswordResetEmail(auth, email);

export const signOut = () => {
    // This function might need adjustment based on multi-company presence.
    // For now, it signs out globally.
    return firebaseSignOut(auth);
};

export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendVerificationEmail(user);

    let companyId;
    let finalCompanyName = companyName;

    if (referralId) {
        const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const companyDoc = querySnapshot.docs[0];
            companyId = companyDoc.id;
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
    
    // NEW: User profile now stores an array of companies
    await setDoc(doc(usersCollection, user.uid), {
        fullName, 
        nickname, 
        email,
        companies: [{
            companyId: companyId,
            role: companyRole
        }]
    });

    // Store the first companyId for redirection after registration
    localStorage.setItem('selectedCompanyId', companyId);
    return user;
};

// NEW: Function to join an existing company
export const joinCompanyWithReferralId = async (user, referralId) => {
    const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Invalid Referral ID. Company not found.");
    }
    
    const companyDoc = querySnapshot.docs[0];
    const companyId = companyDoc.id;
    const userRef = doc(usersCollection, user.uid);

    // Add the new company to the user's list of companies
    // For simplicity, the role is set to 'Member'. This could be expanded upon.
    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: 'Member' 
        })
    });
};

// NEW: Function to create a new company for an existing user
export const createNewCompany = async (user, companyName, userRole) => {
    const newCompanyRef = await addDoc(companiesCollection, { 
        name: companyName, 
        referralId: Math.floor(100000 + Math.random() * 900000), 
        createdAt: serverTimestamp() 
    });
    const companyId = newCompanyRef.id;
    const userRef = doc(usersCollection, user.uid);

    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: userRole
        })
    });
    return companyId;
};


export const getUserProfile = (userId) => getDoc(doc(usersCollection, userId));
export const getCompany = (companyId) => getDoc(doc(companiesCollection, companyId));
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

// --- Presence Management (Firestore-only) ---
export const manageUserPresence = async (user, companyId) => {
    // Presence is now company-specific
    const userStatusFirestoreRef = doc(db, 'users', user.uid);
    await updateDoc(userStatusFirestoreRef, { 
        online: true, 
        last_changed: serverTimestamp(),
        activeCompany: companyId // Track which company the user is active in
    });
};

export const listenToCompanyPresence = (companyId, callback) => {
    // This query needs to change to look inside the companies array
    const q = query(usersCollection, where("companies", "array-contains", { companyId: companyId }));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            const companyInfo = data.companies.find(c => c.companyId === companyId);
            return {
                id: doc.id,
                ...data,
                companyRole: companyInfo?.role // Extract role for this company
            };
        });
        callback(users);
    });
};


// --- Projects ---
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

// --- Tasks ---
export const addTask = (taskData, companyId, author) => {
    const language = localStorage.getItem('actionPadLanguage') || 'en';
    return addDoc(tasksCollection, { 
        ...taskData, 
        companyId, 
        author: { uid: author.uid, nickname: author.nickname }, 
        assignedTo: [], 
        subtasks: [], 
        attachments: [], 
        language,
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp() 
    });
}

export const getTask = (taskId) => getDoc(doc(tasksCollection, taskId));

export const updateTask = (taskId, updatedData) => {
    return updateDoc(doc(tasksCollection, taskId), { ...updatedData, updatedAt: serverTimestamp() });
};

export const deleteTask = (taskId) => deleteDoc(doc(tasksCollection, taskId));

export const listenToCompanyTasks = (companyId, projectId, callback) => {
    let q;
    if (projectId === 'all') {
        q = query(tasksCollection, 
            where("companyId", "==", companyId), 
            orderBy("createdAt", "desc")
        );
    } else {
        q = query(tasksCollection, 
            where("companyId", "==", companyId), 
            where("projectId", "==", projectId), 
            orderBy("createdAt", "desc")
        );
    }
    
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(tasks);
    }, (error) => {
        console.error("Error listening to tasks: ", error);
        showToast("Database error: A required index is missing. Check console.", "error");
    });
};

// --- Comments & Activity ---
export const addComment = (taskId, commentData) => {
     const language = localStorage.getItem('actionPadLanguage') || 'en';
    return addDoc(collection(db, 'tasks', taskId, 'comments'), { 
        ...commentData, 
        type: 'comment',
        language,
        createdAt: serverTimestamp() 
    });
}
export const logActivity = (taskId, activityData) => addDoc(collection(db, 'tasks', taskId, 'comments'), { ...activityData, type: 'activity', createdAt: serverTimestamp() });
export const listenToTaskComments = (taskId, callback) => {
    const q = query(collection(db, 'tasks', taskId, 'comments'), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
};


// --- Team Chat ---
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

// --- NEW: Dashboard Data Fetching ---
export const getCompanyDashboardData = async (companyId) => {
    // 1. Get Company Info
    const companySnap = await getCompany(companyId);
    const company = companySnap.exists() ? { id: companySnap.id, ...companySnap.data() } : null;

    // 2. Get all tasks for the company
    const tasksQuery = query(tasksCollection, where("companyId", "==", companyId));
    const tasksSnap = await getDocs(tasksQuery);
    const tasks = tasksSnap.docs.map(doc => doc.data());

    // 3. Get all members of the company
    const membersQuery = query(usersCollection, where("companies", "array-contains", { companyId: companyId }));
    const membersSnap = await getDocs(membersQuery);
    const members = membersSnap.docs.map(doc => doc.data());

    return { company, tasks, members };
};


// --- Translation Service ---
export const translateText = async (text, targetLanguage) => {
    if (!text || !targetLanguage) return text;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Translate this text to ${targetLanguage}: "${text}"`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Translation API Error:", response.status, errorBody);
            return text;
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        } else {
            console.error("Invalid translation response structure:", data);
            return text;
        }
    } catch (error) {
        console.error('Failed to fetch translation:', error);
        return text;
    }
};
