import { doc, updateDoc, getDoc, arrayUnion, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { storage, db } from '../firebase-config.js';

export const uploadTaskAttachment = async (taskId, file) => {
    const filePath = `task_attachments/${taskId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    const attachmentData = {
        name: file.name,
        url: downloadURL,
        path: filePath,
        size: file.size,
        type: file.type,
        uploadedAt: serverTimestamp()
    };
    const taskRef = doc(collection(db, 'tasks'), taskId);
    await updateDoc(taskRef, {
        attachments: arrayUnion(attachmentData)
    });
    return attachmentData;
};

export const deleteAttachment = async (taskId, attachment) => {
    const fileRef = storageRef(storage, attachment.path);
    await deleteObject(fileRef);

    const taskRef = doc(collection(db, 'tasks'), taskId);
    const taskSnap = await getDoc(taskRef);
    if(taskSnap.exists()){
        const existingAttachments = taskSnap.data().attachments || [];
        const updatedAttachments = existingAttachments.filter(att => att.url !== attachment.url);
        await updateDoc(taskRef, { attachments: updatedAttachments });
    }
};
