// FILE: js/taskController.js
import * as firebaseService from './services/index.js';
import { showToast } from './toast.js';

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
            };
            firebaseService.addProject(projectData)
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
    firebaseService.addTask(taskData, appState.company.id, author)
        .then((docRef) => {
            const activityText = `${author.nickname} created this task.`;
            firebaseService.logActivity(docRef.id, { text: activityText, author });
            showToast('Task added!', 'success');
        })
        .catch(err => {
            console.error("Error adding task:", err)
            showToast(`Error: ${err.message}`, 'error');
        });
};

/**
 * Handles the submission of the edit task form.
 * Gathers all data from the modal and updates the task in Firestore.
 */
export const handleEditTask = async () => {
    console.log("%cDEBUG: handleEditTask function initiated.", "color: blue; font-weight: bold;");

    const taskId = document.getElementById('edit-task-id').value;
    console.log("DEBUG: Task ID from form:", taskId);

    if (!taskId) {
        console.error("DEBUG: No task ID found in the form. Aborting update.");
        showToast("Error: No task ID found.", "error");
        return;
    }

    try {
        const taskSnap = await firebaseService.getTask(taskId);
        if (!taskSnap.exists()) {
            console.error("DEBUG: Task with ID not found in Firestore:", taskId);
            showToast("Task not found. It may have been deleted.", "error");
            return; // Stop execution if task doesn't exist
        }

        const existingTaskData = taskSnap.data();
        console.log("DEBUG: Existing task data from Firestore:", existingTaskData);
        const oldAssignees = existingTaskData.assignedTo || [];

        const assigneesSelect = document.getElementById('edit-task-assignees');
        const newAssignees = Array.from(assigneesSelect.selectedOptions).map(option => option.value);
        console.log("DEBUG: New assignees selected in form:", newAssignees);

        const updatedData = {
            name: document.getElementById('edit-task-name').value,
            description: document.getElementById('edit-task-description').value,
            dueDate: document.getElementById('edit-task-due-date').value,
            priority: document.getElementById('edit-task-priority').value,
            status: document.getElementById('edit-task-status').value,
            projectId: document.getElementById('edit-task-project').value,
            assignedTo: newAssignees,
        };
        console.log("DEBUG: Constructed updatedData object to send to Firebase:", updatedData);

        newAssignees.forEach(userId => {
            if (!oldAssignees.includes(userId)) {
                console.log(`DEBUG: Creating notification for new assignee: ${userId}`);
                firebaseService.createNotification(userId, {
                    text: `${appState.profile.nickname} assigned you a new task: "${updatedData.name}"`,
                    taskId: taskId
                });
            }
        });

        console.log("DEBUG: Calling firebaseService.updateTask...");
        await firebaseService.updateTask(taskId, updatedData);
        console.log("%cDEBUG: firebaseService.updateTask successful.", "color: green; font-weight: bold;");
        showToast('Task updated successfully!', 'success');

    } catch (err) {
        console.error("%cDEBUG: An error occurred in handleEditTask:", "color: red; font-weight: bold;", err);
        showToast(`Update failed: ${err.message}`, 'error');
    }
};


/**
 * Toggles a task's status between 'done' and 'todo' based on a checkbox.
 * @param {string} taskId - The ID of the task to update.
 * @param {boolean} isDone - The new checked state of the checkbox.
 */
export const toggleTaskStatus = (taskId, isDone) => {
    const newStatus = isDone ? 'done' : 'todo';
    updateTaskStatus(taskId, newStatus);
};

/**
 * Updates the status of a task (e.g., 'todo', 'in-progress', 'done').
 * @param {string} taskId - The ID of the task to update.
 * @param {string} newStatus - The new status string.
 */
export const updateTaskStatus = (taskId, newStatus) => {
    firebaseService.updateTask(taskId, { status: newStatus })
        .catch(err => {
            console.error("Error updating task status:", err);
            showToast(`Error: ${err.message}`, 'error');
        });
};

/**
 * Deletes a task after user confirmation.
 * @param {string} taskId - The ID of the task to delete.
 */
export const deleteTask = (taskId) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const taskName = task ? task.name : 'this task';
    // Using a custom modal for confirmation would be better than window.confirm
    if (confirm(`Are you sure you want to delete the task: "${taskName}"?`)) {
        firebaseService.deleteTask(taskId)
            .then(() => showToast('Task deleted.', 'success'))
            .catch(err => {
                console.error("Error deleting task:", err)
                showToast(`Deletion failed: ${err.message}`, 'error');
            });
    }
};

// --- Subtask, Comment, and Attachment Functions ---

export const addSubtask = (taskId, text) => {
    const newSubtask = { text, isCompleted: false };
    const task = appState.tasks.find(t => t.id === taskId);
    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
};

export const toggleSubtask = (taskId, subtaskIndex, isCompleted) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex].isCompleted = isCompleted;
    firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
};

export const deleteSubtask = (taskId, subtaskIndex) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const updatedSubtasks = task.subtasks.filter((_, index) => index !== subtaskIndex);
    firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
};

export const addComment = (taskId, text, mentions) => {
    const commentData = {
        text,
        author: {
            uid: appState.user.uid,
            nickname: appState.profile.nickname,
            avatarURL: appState.profile.avatarURL || null
        }
    };
    firebaseService.addComment(taskId, commentData, mentions);
};

export const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    const taskId = document.getElementById('edit-task-id').value;
    if (!file || !taskId) return;

    showToast('Uploading attachment...', 'success');
    try {
        await firebaseService.uploadTaskAttachment(taskId, file);
        showToast('Attachment added!', 'success');
    } catch (error) {
        console.error("Attachment upload failed:", error);
        showToast('Attachment upload failed.', 'error');
    }
    e.target.value = ''; 
};

export const generateSubtasksWithAI = async () => {
    const taskId = document.getElementById('edit-task-id').value;
    const taskName = document.getElementById('edit-task-name').value;
    const taskDescription = document.getElementById('edit-task-description').value;
    
    showToast('🤖 Generating subtasks with AI...', 'success');
    try {
        const aiSubtasks = await firebaseService.generateSubtasksAI(taskName, taskDescription);
        const task = appState.tasks.find(t => t.id === taskId);
        const existingSubtasks = task.subtasks || [];
        const updatedSubtasks = [...existingSubtasks, ...aiSubtasks];
        await firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
        showToast('AI subtasks added!', 'success');
    } catch (error) {
        console.error("AI Subtask generation failed:", error);
        showToast(`AI failed: ${error.message}`, 'error');
    }
};

/**
 * Parses raw text input to extract task details like priority and due date.
 * @param {string} text - The raw text from the task input.
 * @returns {Object} A structured task data object.
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
