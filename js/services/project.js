import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { db, storage } from '../firebase-config.js';

const getProjectsCollection = () => collection(db, 'projects');

export const addProject = (projectData) => addDoc(getProjectsCollection(), { ...projectData, createdAt: serverTimestamp() });

export const updateProject = (projectId, data) => updateDoc(doc(db, 'projects', projectId), data);

export const uploadProjectLogo = async (projectId, file) => {
    const filePath = `project_logos/${projectId}/${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
};

export const listenToCompanyProjects = (companyId, callback) => {
    const q = query(getProjectsCollection(), where("companyId", "==", companyId));
    return onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(projects);
    });
};
