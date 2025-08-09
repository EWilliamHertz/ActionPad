import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { db, storage } from '../firebase-config.js';

const projectsCollection = collection(db, 'projects');

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
