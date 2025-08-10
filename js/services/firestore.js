import { collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../firebase-config.js';

// Use functions to create collection references lazily
export const getUsersCollection = () => collection(db, 'users');
export const getCompaniesCollection = () => collection(db, 'companies');
export const getTasksCollection = () => collection(db, 'tasks');
export const getProjectsCollection = () => collection(db, 'projects');
export const getChatCollection = () => collection(db, 'team_chat');

// For backward compatibility, also export the old names as functions
export const usersCollection = () => collection(db, 'users');
export const companiesCollection = () => collection(db, 'companies');
export const tasksCollection = () => collection(db, 'tasks');
export const projectsCollection = () => collection(db, 'projects');
export const chatCollection = () => collection(db, 'team_chat');
