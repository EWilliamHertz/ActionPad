// FILE: js/taskController.js
import * as firebaseService from './firebase-service.js';
import { showToast } from './toast.js';

let appState = null;

export const initTaskController = (state) => {
    appState = state;
};

export const setupProjectForm = (state) => {
    const form = document.getElementById('add-project-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-project-input');
        const projectName = input.value.trim();
        if (projectName && state.profile) {
            const projectData = {
                name: projectName,
                companyId: state.profile.companyId,
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

const handleAddTask = (text) => {
    const taskData = parseTaskInput(text);
    taskData.projectId = appState.currentProjectId === 'all' ? null : appState.currentProjectId;

    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };
    firebaseService.addTask(taskData, appState.profile.companyId, author)
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

// IMPROVEMENT: This function now generates a detailed log of all changes made during an edit.
export const handleEditTask = async () => {
    const taskId = document.getElementById('edit-task-id').value;
    
    const taskSnap = await firebaseService.getTask(taskId);
    if (!taskSnap.exists()) {
        throw new Error("Task not found. It may have been deleted.");
    }
    const existingTaskData = taskSnap.data();
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };

    const selectedOptions = document.querySelectorAll('#edit-task-assignees option:checked');
    const assignees = Array.from(selectedOptions).map(el => el.value);

    const updatedData = {
        name: document.getElementById('edit-task-name').value,
        description: document.getElementById('edit-task-description').value,
        dueDate: document.getElementById('edit-task-due-date').value,
        priority: document.getElementById('edit-task-priority').value,
        status: document.getElementById('edit-task-status').value,
        assignedTo: assignees,
        projectId: document.getElementById('edit-task-project').value
    };

    // --- Generate Detailed Activity Logs ---
    const changes = [];
    if (existingTaskData.name !== updatedData.name) changes.push(`renamed the task to "${updatedData.name}"`);
    if (existingTaskData.status !== updatedData.status) changes.push(`changed the status from ${existingTaskData.status || 'todo'} to ${updatedData.status}`);
    if (existingTaskData.priority !== updatedData.priority) changes.push(`set the priority to ${updatedData.priority}`);
    if (existingTaskData.dueDate !== updatedData.dueDate) changes.push(`set the due date to ${updatedData.dueDate || 'none'}`);
    
    // Log assignee changes
    const oldAssignees = new Set(existingTaskData.assignedTo || []);
    const newAssignees = new Set(updatedData.assignedTo || []);
    appState.team.forEach(member => {
        if (oldAssignees.has(member.id) && !newAssignees.has(member.id)) changes.push(`unassigned ${member.nickname}`);
        if (!oldAssignees.has(member.id) && newAssignees.has(member.id)) changes.push(`assigned the task to ${member.nickname}`);
    });

    if (changes.length > 0) {
        const activityText = `${author.nickname} ${changes.join(', ')}.`;
        firebaseService.logActivity(taskId, { text: activityText, author });
    }
    
    // We merge the updated fields with the existing data to ensure fields like companyId are preserved.
    const finalPayload = { ...existingTaskData, ...updatedData };

    return firebaseService.updateTask(taskId, finalPayload)
        .then(() => {
            showToast('Task updated!', 'success');
        })
        .catch(err => {
            console.error("Controller caught task update error:", err);
            showToast(`Update failed: ${err.message}`, 'error');
            throw err;
        });
};

export const toggleTaskStatus = (taskId, isDone) => {
    const newStatus = isDone ? 'done' : 'todo';
    const task = appState.tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
        const author = { uid: appState.user.uid, nickname: appState.profile.nickname };
        const activityText = `${author.nickname} changed the status to ${newStatus}.`;
        firebaseService.logActivity(taskId, { text: activityText, author });
        updateTaskStatus(taskId, newStatus);
    }
};

export const updateTaskStatus = (taskId, newStatus) => {
    firebaseService.updateTask(taskId, { status: newStatus })
        .catch(err => {
            console.error("Error updating task status:", err);
            showToast(`Error: ${err.message}`, 'error');
        });
};

// IMPROVEMENT: Confirmation dialog now includes the task name to prevent accidents.
export const deleteTask = (taskId) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const taskName = task ? task.name : 'this task';
    if (confirm(`Are you sure you want to delete the task: "${taskName}"?\nThis action cannot be undone.`)) {
        firebaseService.deleteTask(taskId)
            .then(() => showToast('Task deleted.', 'success'))
            .catch(err => {
                console.error("Error deleting task:", err)
                showToast(`Deletion failed: ${err.message}`, 'error');
            });
    }
};

// IMPROVEMENT: Added activity logging for subtask actions.
export const addSubtask = (taskId, text) => {
    const newSubtask = { text, isCompleted: false };
    const task = appState.tasks.find(t => t.id === taskId);
    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };
    const activityText = `${author.nickname} added subtask: "${text}".`;
    firebaseService.logActivity(taskId, { text: activityText, author });
    firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
};

export const toggleSubtask = (taskId, subtaskIndex, isCompleted) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex].isCompleted = isCompleted;
    const subtaskText = updatedSubtasks[subtaskIndex].text;
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };
    const action = isCompleted ? 'completed' : 'marked as incomplete';
    const activityText = `${author.nickname} ${action} the subtask: "${subtaskText}".`;
    firebaseService.logActivity(taskId, { text: activityText, author });
    firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
};

export const deleteSubtask = (taskId, subtaskIndex) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const subtaskText = task.subtasks[subtaskIndex].text;
    const updatedSubtasks = task.subtasks.filter((_, index) => index !== subtaskIndex);
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };
    const activityText = `${author.nickname} deleted the subtask: "${subtaskText}".`;
    firebaseService.logActivity(taskId, { text: activityText, author });
    firebaseService.updateTask(taskId, { subtasks: updatedSubtasks });
};

export const addComment = (taskId, text) => {
    const commentData = {
        text,
        author: {
            uid: appState.user.uid,
            nickname: appState.profile.nickname,
            avatarURL: appState.profile.avatarURL || null
        }
    };
    firebaseService.addComment(taskId, commentData);
};

/**
 * Parses a string for "natural language" date and priority keywords.
 * @param {string} text The user's input string for a new task.
 * @returns {object} A task data object with name, priority, dueDate, etc.
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
