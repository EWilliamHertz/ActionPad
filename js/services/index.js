export * from './auth.js';
export * from './user.js';
export * from './company.js';
export * from './project.js';
export * from './task.js';
export * from './notification.js';
export * from './presence.js';
export * from './chat.js';
export * from './comment.js';
export * from './ai.js';
export * from './attachment.js';

import { getCompany } from './company.js';
import { db } from '../firebase-config.js';
import { query, where, orderBy, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const getCompanyDashboardData = async (companyId) => {
    const companySnap = await getCompany(companyId);
    const company = companySnap.exists() ? { id: companySnap.id, ...companySnap.data() } : null;

    const tasksQuery = query(collection(db, 'tasks'), where("companyId", "==", companyId), orderBy("updatedAt", "desc"));
    const tasksSnap = await getDocs(tasksQuery);
    const tasks = tasksSnap.docs.map(doc => doc.data());

    const membersQuery = query(collection(db, 'users'), where("companyIds", "array-contains", companyId));
    const membersSnap = await getDocs(membersQuery);
    const members = membersSnap.docs.map(doc => doc.data());

    return { company, tasks, members };
};
