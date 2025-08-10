// FILE: js/services/task.js
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { showToast } from '../toast.js';
import { getCompany } from './company.js';

const getTasksCollection = () => collection(db, 'tasks');
const getProjectsCollection = () => collection(db, 'projects');

export const addTask = (taskData, companyId, author) => {
    const language = localStorage.getItem('actionPadLanguage') || 'en';
    return addDoc(getTasksCollection(), {
        ...taskData,
        companyId,
        author: { uid: author.uid, nickname: author.nickname },
        assignedTo: [],
        subtasks: [],
        attachments: [],
        language,
        order: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

export const getTask = (taskId) => getDoc(doc(getTasksCollection(), taskId));

export const updateTask = (taskId, updatedData) => {
    return updateDoc(doc(getTasksCollection(), taskId), { ...updatedData, updatedAt: serverTimestamp() });
};

export const deleteTask = (taskId) => deleteDoc(doc(getTasksCollection(), taskId));

export const listenToCompanyTasks = (companyId, projectId, callback) => {
    let q;
    if (projectId === 'all') {
        q = query(getTasksCollection(),
            where("companyId", "==", companyId),
            orderBy("order", "asc")
        );
    } else {
        q = query(getTasksCollection(),
            where("companyId", "==", companyId),
            where("projectId", "==", projectId),
            orderBy("order", "asc")
        );
    }

    return onSnapshot(q, (snapshot) => {
        const addedDocs = new Set(snapshot.docChanges().filter(c => c.type === 'added').map(c => c.doc.id));
        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isNew: addedDocs.has(doc.id)
        }));
        callback(tasks);
    }, (error) => {
        console.error("Error listening to tasks: ", error);
        showToast("Database error: A required index is missing. Check console.", "error");
    });
};

export const getTasksAssignedToUser = async (userId) => {
    const q = query(getTasksCollection(), where("assignedTo", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    const tasks = [];
    for (const taskDoc of querySnapshot.docs) {
        const taskData = { id: taskDoc.id, ...taskDoc.data() };

        if(taskData.companyId) {
            const companySnap = await getCompany(taskData.companyId);
            taskData.companyName = companySnap.exists() ? companySnap.data().name : 'Unknown Company';
        }
        if(taskData.projectId) {
            const projectSnap = await getDoc(doc(getProjectsCollection(), taskData.projectId));
            taskData.projectName = projectSnap.exists() ? projectSnap.data().name : 'No Project';
        }
        tasks.push(taskData);
    }
    return tasks;
};

export const getTasksForProject = async (projectId) => {
    const q = query(getTasksCollection(), where("projectId", "==", projectId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUpcomingDeadlines = async (userId) => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const q = query(getTasksCollection(),
        where("assignedTo", "array-contains", userId),
        where("dueDate", ">=", today.toISOString().split('T')[0]),
        where("dueDate", "<=", nextWeek.toISOString().split('T')[0]),
        orderBy("dueDate", "asc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
