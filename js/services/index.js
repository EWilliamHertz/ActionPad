// FILE: js/services/index.js
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

// This function is still needed by dashboard.js and uses functions from multiple services
import { getCompany } from './company.js';
import { tasksCollection, usersCollection } from './firestore.js';
import { query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export const getCompanyDashboardData = async (companyId) => {
    const companySnap = await getCompany(companyId);
    const company = companySnap.exists() ? { id: companySnap.id, ...companySnap.data() } : null;

    const tasksQuery = query(tasksCollection, where("companyId", "==", companyId), orderBy("updatedAt", "desc"));
    const tasksSnap = await getDocs(tasksQuery);
    const tasks = tasksSnap.docs.map(doc => doc.data());

    const membersQuery = query(usersCollection, where("companyIds", "array-contains", companyId));
    const membersSnap = await getDocs(membersQuery);
    const members = membersSnap.docs.map(doc => doc.data());

    return { company, tasks, members };
};
