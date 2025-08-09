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

export const handleEditTask = () => {
    const taskId = document.getElementById('edit-task-id').value;
    const selectedOptions = document.querySelectorAll('#edit-task-assignees option:checked');
    const assignees = Array.from(selectedOptions).map(el => el.value);

    const taskData = {
        name: document.getElementById('edit-task-name').value,
        description: document.getElementById('edit-task-description').value,
        dueDate: document.getElementById('edit-task-due-date').value,
        priority: document.getElementById('edit-task-priority').value,
        status: document.getElementById('edit-task-status').value,
        assignedTo: assignees,
        projectId: document.getElementById('edit-task-project').value
    };

    // Return the promise so the UI can await it and handle success/error.
    return firebaseService.updateTask(taskId, taskData)
        .then(() => {
            showToast('Task updated!', 'success');
        })
        .catch(err => {
            console.error("Controller caught task update error:", err);
            showToast(`Update failed: ${err.message}`, 'error');
            // Re-throw the error so the UI layer knows it failed.
            throw err;
        });
};

export const toggleTaskStatus = (taskId, isDone) => {
    const newStatus = isDone ? 'done' : 'todo';
    updateTaskStatus(taskId, newStatus);
};

export const updateTaskStatus = (taskId, newStatus) => {
    firebaseService.updateTask(taskId, { status: newStatus })
        .catch(err => {
            console.error("Error updating task status:", err);
            showToast(`Error: ${err.message}`, 'error');
        });
};

export const deleteTask = (taskId) => {
    if (confirm("Are you sure you want to delete this task?")) {
        firebaseService.deleteTask(taskId)
            .then(() => showToast('Task deleted.', 'success'))
            .catch(err => {
                console.error("Error deleting task:", err)
                showToast(`Deletion failed: ${err.message}`, 'error');
            });
    }
};

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
