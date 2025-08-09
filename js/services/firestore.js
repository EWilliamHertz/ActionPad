import { collection } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from '../firebase-config.js';

export const usersCollection = collection(db, 'users');
export const companiesCollection = collection(db, 'companies');
export const tasksCollection = collection(db, 'tasks');
export const projectsCollection = collection(db, 'projects');
export const chatCollection = collection(db, 'team_chat');
