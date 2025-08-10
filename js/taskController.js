// FILE: js/taskController.js
import { db, storage } from './firebase-config.js'; // Direct import
import {
    addDoc,
    collection,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'; // Direct import
import { showToast } from './toast.js';
import { createNotification } from './services/notification.js'; // Can keep some service imports if they don't cause a cycle
import { addComment, logActivity } from './services/comment.js';
import { generateSubtasksAI } from './services/ai.js';
import { uploadTaskAttachment } from './services/attachment.js';


let appState = null;

/**
 * Initializes the task controller with the global application state.
 */
export const initTaskController = (state) => {
    appState = state;
};

/**
 * Sets up the event listener for the 'add project' form.
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
                createdAt: serverTimestamp() // Added from service
            };
            addDoc(collection(db, 'projects'), projectData) // Direct call
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
 */
const handleAddTask = (text) => {
    const taskData = parseTaskInput(text);
    taskData.projectId = appState.currentProjectId === 'all' ? null : appState.currentProjectId;
    taskData.companyId = appState.company.id; // Added from service
    taskData.author = { uid: appState.user.uid, nickname: appState.profile.nickname }; // Added from service
    taskData.createdAt = serverTimestamp(); // Added from service
    taskData.updatedAt = serverTimestamp(); // Added from service

    addDoc(collection(db, 'tasks'), taskData) // Direct call
        .then((docRef) => {
            const activityText = `${taskData.author.nickname} created this task.`;
            logActivity(docRef.id, { text: activityText, author: taskData.author });
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
    if (!taskId) {
        showToast("Error: No task ID found.", "error");
        return;
    }

    try {
        const taskRef = doc(db, 'tasks', taskId); // Direct call
        const taskSnap = await getDoc(taskRef); // Direct call
        if (!taskSnap.exists()) {
            showToast("Task not found. It may have been deleted.", "error");
            return;
        }

        const existingTaskData = taskSnap.data();
        const oldAssignees = existingTaskData.assignedTo || [];

        const assigneesSelect = document.getElementById('edit-task-assignees');
        const newAssignees = Array.from(assigneesSelect.selectedOptions).map(option => option.value);

        const updatedData = {
            name: document.getElementById('edit-task-name').value,
            description: document.getElementById('edit-task-description').value,
            dueDate: document.getElementById('edit-task-due-date').value,
            priority: document.getElementById('edit-task-priority').value,
            status: document.getElementById('edit-task-status').value,
            projectId: document.getElementById('edit-task-project').value,
            assignedTo: newAssignees,
            updatedAt: serverTimestamp() // Added from service
        };

        newAssignees.forEach(userId => {
            if (!oldAssignees.includes(userId)) {
                createNotification(userId, {
                    text: `${appState.profile.nickname} assigned you a new task: "${updatedData.name}"`,
                    taskId: taskId
                });
            }
        });

        await updateDoc(taskRef, updatedData); // Direct call
        showToast('Task updated successfully!', 'success');

    } catch (err) {
        console.error("An error occurred in handleEditTask:", err);
        showToast(`Update failed: ${err.message}`, 'error');
        throw err; // Re-throw for modal manager to handle
    }
};


/**
 * Toggles a task's status between 'done' and 'todo' based on a checkbox.
 */
export const toggleTaskStatus = (taskId, isDone) => {
    const newStatus = isDone ? 'done' : 'todo';
    updateTaskStatus(taskId, newStatus);
};

/**
 * Updates the status of a task.
 */
export const updateTaskStatus = (taskId, newStatus) => {
    updateDoc(doc(db, 'tasks', taskId), { status: newStatus, updatedAt: serverTimestamp() }) // Direct call
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
        deleteDoc(doc(db, 'tasks', taskId)) // Direct call
            .then(() => showToast('Task deleted.', 'success'))
            .catch(err => {
                showToast(`Deletion failed: ${err.message}`, 'error');
            });
    }
};

// --- Subtask, Comment, and Attachment Functions ---
// These functions can remain mostly the same, but their calls inside this file are now direct

export const addSubtask = (taskId, text) => {
    const newSubtask = { text, isCompleted: false };
    updateDoc(doc(db, 'tasks', taskId), { // Direct call
        subtasks: arrayUnion(newSubtask)
    });
};

export const toggleSubtask = async (taskId, subtaskIndex, isCompleted) => {
    const taskSnap = await getDoc(doc(db, 'tasks', taskId));
    if (!taskSnap.exists()) return;
    const updatedSubtasks = taskSnap.data().subtasks || [];
    if (updatedSubtasks[subtaskIndex]) {
        updatedSubtasks[subtaskIndex].isCompleted = isCompleted;
        updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks }); // Direct call
    }
};

export const deleteSubtask = async (taskId, subtaskIndex) => {
    const taskSnap = await getDoc(doc(db, 'tasks', taskId));
    if (!taskSnap.exists()) return;
    const updatedSubtasks = taskSnap.data().subtasks.filter((_, index) => index !== subtaskIndex);
    updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks }); // Direct call
};

export const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    const taskId = document.getElementById('edit-task-id').value;
    if (!file || !taskId) return;

    showToast('Uploading attachment...', 'success');
    try {
        await uploadTaskAttachment(taskId, file); // This service is fine to call
        showToast('Attachment added!', 'success');
    } catch (error) {
        console.error("Attachment upload failed:", error);
        showToast('Attachment upload failed.', 'error');
    }
    e.target.value = '';
};

export { addComment, generateSubtasksWithAI }; // Re-exporting functions that are safe to use

/**
 * Parses raw text input to extract task details.
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
