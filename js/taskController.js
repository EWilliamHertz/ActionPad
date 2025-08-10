// FILE: js/taskController.js
import { db, storage } from './firebase-config.js'; // Direct import from firebase-config
import {
    addDoc,
    collection,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'; // Direct import of Firestore functions
import { showToast } from './toast.js';
// Keep safe service imports that don't cause a dependency cycle
import { createNotification } from './services/notification.js';
import { addComment, logActivity } from './services/comment.js';
import { generateSubtasksAI } from './services/ai.js';
import { uploadTaskAttachment } from './services/attachment.js';

let appState = null;

/**
 * Initializes the task controller with the global application state.
 * @param {Object} state - The main application state object.
 */
export const initTaskController = (state) => {
    appState = state;
};

/**
 * Sets up the event listener for the 'add project' form.
 * @param {Object} state - The main application state object.
 */
export const setupProjectForm = (state) => {
    const form = document.getElementById('add-project-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-project-input');
        const projectName = input.value.trim();
        if (projectName && state.profile) {
            const projectData = {
                name: projectName,
                companyId: state.company.id,
                createdAt: serverTimestamp()
            };
            // FIX: Direct SDK call instead of firebaseService.addProject
            addDoc(collection(db, 'projects'), projectData)
                .then(() => {
                    input.value = '';
                    showToast('Project created!', 'success');
                })
                .catch(err => {
                    console.error("Error adding project:", err);
                    showToast(`Error: ${err.message}`, 'error');
                });
        }
    });
};

/**
 * Sets up the event listener for the 'add task' form.
 */
export const setupTaskForm = () => {
    document.getElementById('add-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-task-input');
        if (input.value.trim() && appState.profile) {
            handleAddTask(input.value.trim());
            input.value = '';
        }
    });
};

/**
 * Handles the logic for adding a new task.
 * @param {string} text - The raw text from the task input field.
 */
const handleAddTask = (text) => {
    const taskData = parseTaskInput(text);
    taskData.projectId = appState.currentProjectId === 'all' ? null : appState.currentProjectId;
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };

    // FIX: Add all required fields directly
    const fullTaskData = {
        ...taskData,
        companyId: appState.company.id,
        author,
        assignedTo: [],
        subtasks: [],
        attachments: [],
        language: localStorage.getItem('actionPadLanguage') || 'en',
        order: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // FIX: Direct SDK call instead of firebaseService.addTask
    addDoc(collection(db, 'tasks'), fullTaskData)
        .then((docRef) => {
            const activityText = `${author.nickname} created this task.`;
            logActivity(docRef.id, { text: activityText, author });
            showToast('Task added!', 'success');
        })
        .catch(err => {
            console.error("Error adding task:", err)
            showToast(`Error: ${err.message}`, 'error');
        });
};

/**
 * Handles the submission of the edit task form.
 */
export const handleEditTask = async () => {
    const taskId = document.getElementById('edit-task-id').value;
    if (!taskId) return showToast("Error: No task ID found.", "error");

    try {
        const taskRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskRef); // FIX: Direct SDK call
        if (!taskSnap.exists()) {
            return showToast("Task not found. It may have been deleted.", "error");
        }

        const oldAssignees = taskSnap.data().assignedTo || [];
        const newAssignees = Array.from(document.getElementById('edit-task-assignees').selectedOptions).map(option => option.value);

        const updatedData = {
            name: document.getElementById('edit-task-name').value,
            description: document.getElementById('edit-task-description').value,
            dueDate: document.getElementById('edit-task-due-date').value,
            priority: document.getElementById('edit-task-priority').value,
            status: document.getElementById('edit-task-status').value,
            projectId: document.getElementById('edit-task-project').value,
            assignedTo: newAssignees,
            updatedAt: serverTimestamp() // Add timestamp on update
        };

        newAssignees.forEach(userId => {
            if (!oldAssignees.includes(userId)) {
                createNotification(userId, {
                    text: `${appState.profile.nickname} assigned you a new task: "${updatedData.name}"`,
                    taskId: taskId
                });
            }
        });

        await updateDoc(taskRef, updatedData); // FIX: Direct SDK call
        showToast('Task updated successfully!', 'success');

    } catch (err) {
        console.error("An error occurred in handleEditTask:", err);
        showToast(`Update failed: ${err.message}`, 'error');
        throw err; // Re-throw for modal manager to handle
    }
};

/**
 * Toggles a task's status.
 */
export const toggleTaskStatus = (taskId, isDone) => {
    updateTaskStatus(taskId, isDone ? 'done' : 'todo');
};

/**
 * Updates the status of a task.
 */
export const updateTaskStatus = (taskId, newStatus) => {
    // FIX: Direct SDK call
    updateDoc(doc(db, 'tasks', taskId), { status: newStatus, updatedAt: serverTimestamp() })
        .catch(err => {
            console.error("Error updating task status:", err);
            showToast(`Error: ${err.message}`, 'error');
        });
};

/**
 * Deletes a task after user confirmation.
 */
export const deleteTask = (taskId) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const taskName = task ? task.name : 'this task';
    if (confirm(`Are you sure you want to delete the task: "${taskName}"?`)) {
        // FIX: Direct SDK call
        deleteDoc(doc(db, 'tasks', taskId))
            .then(() => showToast('Task deleted.', 'success'))
            .catch(err => {
                showToast(`Deletion failed: ${err.message}`, 'error');
            });
    }
};

// --- Subtask, Comment, and Attachment Functions ---
// These functions call other services, which is fine, or are updated to call the SDK directly.

export const addSubtask = (taskId, text) => {
    const newSubtask = { text, isCompleted: false };
    // FIX: Direct SDK call
    updateDoc(doc(db, 'tasks', taskId), { subtasks: arrayUnion(newSubtask) });
};

export const toggleSubtask = async (taskId, subtaskIndex, isCompleted) => {
    const taskSnap = await getDoc(doc(db, 'tasks', taskId));
    if (!taskSnap.exists()) return;
    const updatedSubtasks = [...taskSnap.data().subtasks];
    updatedSubtasks[subtaskIndex].isCompleted = isCompleted;
    // FIX: Direct SDK call
    updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks });
};

export const deleteSubtask = async (taskId, subtaskIndex) => {
    const taskSnap = await getDoc(doc(db, 'tasks', taskId));
    if (!taskSnap.exists()) return;
    const updatedSubtasks = taskSnap.data().subtasks.filter((_, index) => index !== subtaskIndex);
    // FIX: Direct SDK call
    updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks });
};

export const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    const taskId = document.getElementById('edit-task-id').value;
    if (!file || !taskId) return;
    showToast('Uploading attachment...', 'success');
    try {
        await uploadTaskAttachment(taskId, file);
        showToast('Attachment added!', 'success');
    } catch (error) {
        showToast('Attachment upload failed.', 'error');
    }
    e.target.value = '';
};

// Re-exporting these is fine as they don't create a circular dependency.
export { addComment, generateSubtasksAI };

/**
 * Parses raw text input to extract task details like priority and due date.
 */
const parseTaskInput = (text) => {
    let taskName = text;
    let priority = 'medium';
    let dueDate = null;
    const priorityRegex = /\b(high|medium|low)\s?priority\b/i;
    const priorityMatch = text.match(priorityRegex);
    if (priorityMatch) {
        priority = priorityMatch[1].toLowerCase();
        taskName = taskName.replace(priorityRegex, '').trim();
    }
    const today = new Date();
    if (/\btomorrow\b/i.test(taskName)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + 1);
        taskName = taskName.replace(/\btomorrow\b/i, '').trim();
    } else if (/\bnext monday\b/i.test(taskName)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7);
        taskName = taskName.replace(/\bnext monday\b/i, '').trim();
    } else if (/\bnext friday\b/i.test(taskName)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + (5 + 7 - today.getDay()) % 7);
        taskName = taskName.replace(/\bnext friday\b/i, '').trim();
    }
    return {
        name: taskName,
        priority: priority,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
        status: 'todo',
        description: ''
    };
};
