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
    query, where, serverTimestamp, setDoc, onSnapshot, orderBy, arrayUnion, writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { showToast } from './toast.js';

const usersCollection = collection(db, 'users');
const companiesCollection = collection(db, 'companies');
const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');
const chatCollection = collection(db, 'team_chat');

const GEMINI_API_KEY = "AIzaSyC9VG3fpf0VAsKfWgJE60lGWcmH6qObCN0"; // Replace with your actual key

// --- Authentication & User Management ---
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const sendVerificationEmail = (user) => firebaseSendEmailVerification(user);
export const sendPasswordReset = (email) => firebaseSendPasswordResetEmail(auth, email);

export const signOut = () => {
    return firebaseSignOut(auth);
};

export const registerUser = async (userData) => {
    const { email, password, fullName, nickname, companyName, companyRole, referralId } = userData;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendVerificationEmail(user);

    let companyId;

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
    
    await setDoc(doc(usersCollection, user.uid), {
        fullName, 
        nickname, 
        email,
        companies: [{
            companyId: companyId,
            role: companyRole
        }]
    });

    localStorage.setItem('selectedCompanyId', companyId);
    return user;
};

export const joinCompanyWithReferralId = async (user, referralId) => {
    const q = query(companiesCollection, where("referralId", "==", Number(referralId)));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Invalid Referral ID. Company not found.");
    }
    
    const companyDoc = querySnapshot.docs[0];
    const companyId = companyDoc.id;
    const userRef = doc(usersCollection, user.uid);

    await updateDoc(userRef, {
        companies: arrayUnion({
            companyId: companyId,
            role: 'Member' 
        })
    });
};

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

// --- Presence Management ---
export const manageUserPresence = async (user, companyId) => {
    const userStatusFirestoreRef = doc(db, 'users', user.uid);
    await updateDoc(userStatusFirestoreRef, { 
        online: true, 
        last_changed: serverTimestamp(),
        activeCompany: companyId 
    });
};

export const listenToCompanyPresence = (companyId, callback) => {
    const q = query(usersCollection, where("activeCompany", "==", companyId));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            const companyInfo = data.companies.find(c => c.companyId === companyId);
            return {
                id: doc.id,
                ...data,
                companyRole: companyInfo?.role
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
        order: Date.now(), // For drag-and-drop reordering
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
            orderBy("order", "asc") // Changed to 'order' for drag-and-drop
        );
    } else {
        q = query(tasksCollection, 
            where("companyId", "==", companyId), 
            where("projectId", "==", projectId), 
            orderBy("order", "asc") // Changed to 'order' for drag-and-drop
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

// NEW: Get all tasks assigned to a user across all companies
export const getTasksAssignedToUser = async (userId) => {
    const q = query(tasksCollection, where("assignedTo", "array-contains", userId));
    const querySnapshot = await getDocs(q);
    
    const tasks = [];
    // We need to fetch company and project names for context
    for (const taskDoc of querySnapshot.docs) {
        const taskData = { id: taskDoc.id, ...taskDoc.data() };

        if(taskData.companyId) {
            const companySnap = await getCompany(taskData.companyId);
            taskData.companyName = companySnap.exists() ? companySnap.data().name : 'Unknown Company';
        }
        if(taskData.projectId) {
            const projectSnap = await getDoc(doc(projectsCollection, taskData.projectId));
            taskData.projectName = projectSnap.exists() ? projectSnap.data().name : 'No Project';
        }
        tasks.push(taskData);
    }
    return tasks;
};


// --- Comments & Activity ---
export const addComment = (taskId, commentData, mentions) => {
     const language = localStorage.getItem('actionPadLanguage') || 'en';
     const commentRef =  addDoc(collection(db, 'tasks', taskId, 'comments'), { 
        ...commentData, 
        type: 'comment',
        language,
        createdAt: serverTimestamp() 
    });
    // Create notifications for mentioned users
    mentions.forEach(userId => {
        createNotification(userId, {
            text: `${commentData.author.nickname} mentioned you in a comment on task.`,
            taskId: taskId
        });
    });
    return commentRef;
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

// --- Dashboard Data Fetching ---
export const getCompanyDashboardData = async (companyId) => {
    const companySnap = await getCompany(companyId);
    const company = companySnap.exists() ? { id: companySnap.id, ...companySnap.data() } : null;

    // Get all tasks for the company, ordered by latest update
    const tasksQuery = query(tasksCollection, where("companyId", "==", companyId), orderBy("updatedAt", "desc"));
    const tasksSnap = await getDocs(tasksQuery);
    const tasks = tasksSnap.docs.map(doc => doc.data());

    const membersQuery = query(usersCollection, where("companies", "array-contains", { companyId: companyId }));
    const membersSnap = await getDocs(membersQuery);
    const members = membersSnap.docs.map(doc => doc.data());

    return { company, tasks, members };
};

// --- File Attachments ---
export const uploadTaskAttachment = async (taskId, file) => {
    const filePath = `task_attachments/${taskId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    const attachmentData = {
        name: file.name,
        url: downloadURL,
        path: filePath, // Store path for deletion
        size: file.size,
        type: file.type,
        uploadedAt: serverTimestamp()
    };
    // Add this attachment to the task document
    const taskRef = doc(tasksCollection, taskId);
    await updateDoc(taskRef, {
        attachments: arrayUnion(attachmentData)
    });
    return attachmentData;
};

export const deleteAttachment = async (taskId, attachment) => {
    // Delete file from storage
    const fileRef = storageRef(storage, attachment.path);
    await deleteObject(fileRef);

    // Remove from task document
    const taskRef = doc(tasksCollection, taskId);
    const taskSnap = await getDoc(taskRef);
    if(taskSnap.exists()){
        const existingAttachments = taskSnap.data().attachments || [];
        const updatedAttachments = existingAttachments.filter(att => att.url !== attachment.url);
        await updateDoc(taskRef, { attachments: updatedAttachments });
    }
};

// --- Notifications ---
export const createNotification = (userId, notificationData) => {
    // Notifications are a subcollection under each user
    const userNotificationsCollection = collection(db, 'users', userId, 'notifications');
    return addDoc(userNotificationsCollection, {
        ...notificationData,
        isRead: false,
        createdAt: serverTimestamp()
    });
};

export const listenToNotifications = (userId, callback) => {
    const q = query(collection(db, 'users', userId, 'notifications'), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifications);
    });
};

export const markNotificationsAsRead = (userId, notifications) => {
    const batch = writeBatch(db);
    notifications.forEach(notif => {
        if (!notif.isRead) {
            const notifRef = doc(db, 'users', userId, 'notifications', notif.id);
            batch.update(notifRef, { isRead: true });
        }
    });
    return batch.commit();
};

// --- AI & Translation Services ---
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
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('Failed to fetch translation:', error);
        return text;
    }
};

// NEW: AI Subtask Generation
export const generateSubtasksAI = async (taskName, taskDescription) => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `You are a project management assistant. Break down the following task into a short, actionable list of subtasks.
    Task Name: "${taskName}"
    Description: "${taskDescription || 'No description'}"
    Respond ONLY with a JavaScript-style array of strings, like this: ["First subtask", "Second subtask", "Third subtask"]`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`AI API error: ${response.status} - ${errorBody.error.message}`);
        }
        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        
        // Clean up the response to be valid JSON
        const jsonText = rawText.replace(/`/g, '').replace('javascript', '').trim();
        const subtasks = JSON.parse(jsonText);
        return subtasks.map(text => ({ text, isCompleted: false }));

    } catch (error) {
        console.error('Failed to generate subtasks with AI:', error);
        throw error; // Re-throw to be caught by the UI
    }
};
