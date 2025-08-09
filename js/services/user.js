// FILE: js/services/user.js
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { db, storage } from '../firebase-config.js';
import { usersCollection } from './firestore.js';

export const getUserProfile = (userId) => getDoc(doc(usersCollection, userId));
export const updateUserProfile = (userId, newData) => updateDoc(doc(usersCollection, userId), newData);

export const uploadAvatar = async (userId, file) => {
    const filePath = `avatars/${userId}/${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
};
