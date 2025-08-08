// This module contains the "business logic" for tasks. It orchestrates
// calls to the firebase service and handles data manipulation, like parsing text.

import * as firebaseService from './firebase-service.js';

let appState = null;

// Initialize the controller with a reference to the main app's state
export const initTaskController = (state) => {
    appState = state;
};

// --- Task Form Handling ---
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
    firebaseService.addTask(taskData, appState.profile.companyId)
        .catch(err => console.error("Error adding task:", err));
};

// --- Task CRUD Operations ---
export const handleEditTask = () => {
    const id = document.getElementById('edit-task-id').value;
    const taskData = {
        name: document.getElementById('edit-task-name').value,
        description: document.getElementById('edit-task-description').value,
        dueDate: document.getElementById('edit-task-due-date').value,
        priority: document.getElementById('edit-task-priority').value,
        status: document.getElementById('edit-task-status').value,
    };
    firebaseService.updateTask(id, taskData)
        .catch(err => console.error("Error updating task:", err));
};

export const toggleTaskStatus = (taskId, isDone) => {
    const newStatus = isDone ? 'done' : 'todo';
    updateTaskStatus(taskId, newStatus);
};

export const updateTaskStatus = (taskId, newStatus) => {
    firebaseService.updateTask(taskId, { status: newStatus })
        .catch(err => console.error("Error updating task status:", err));
};

export const deleteTask = (taskId) => {
    // A non-blocking confirmation would be better, but this is simple.
    if (confirm("Are you sure you want to delete this task?")) {
        firebaseService.deleteTask(taskId)
            .catch(err => console.error("Error deleting task:", err));
    }
};

// --- Natural Language Parsing (Simple Implementation) ---
const parseTaskInput = (text) => {
    let taskName = text;
    let priority = 'medium'; // Default priority
    let dueDate = null;

    // Regex to find and remove priority keywords
    const priorityRegex = /\b(high|medium|low)\s?priority\b/i;
    const priorityMatch = text.match(priorityRegex);
    if (priorityMatch) {
        priority = priorityMatch[1].toLowerCase();
        taskName = taskName.replace(priorityRegex, '').trim();
    }

    // Simple date parsing
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
