import * as firebaseService from './firebaseService.js';

export const setupTaskForm = () => {
    document.getElementById('add-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-task-input');
        if (input.value.trim()) {
            handleAddTask(input.value.trim());
            input.value = '';
        }
    });
};

const handleAddTask = (text) => {
    const taskData = parseTaskInput(text);
    firebaseService.addTask(taskData)
        .catch(err => console.error("Error adding task:", err));
};

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
    firebaseService.updateTask(taskId, { status: newStatus })
        .catch(err => console.error("Error updating task status:", err));
};

export const deleteTask = (taskId) => {
    if (confirm("Are you sure you want to delete this task?")) {
        firebaseService.deleteTask(taskId)
            .catch(err => console.error("Error deleting task:", err));
    }
};

// --- Natural Language Parsing (Simple Implementation) ---
const parseTaskInput = (text) => {
    let taskName = text;
    let priority = 'medium';
    let dueDate = null;

    // Parse priority
    const priorityRegex = /\b(high|medium|low)\s?priority\b/i;
    const priorityMatch = text.match(priorityRegex);
    if (priorityMatch) {
        priority = priorityMatch[1].toLowerCase();
        taskName = taskName.replace(priorityRegex, '').trim();
    }

    // Parse due date (very basic)
    const today = new Date();
    if (/\btomorrow\b/i.test(text)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + 1);
        taskName = taskName.replace(/\btomorrow\b/i, '').trim();
    } else if (/\bnext monday\b/i.test(text)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7);
         taskName = taskName.replace(/\bnext monday\b/i, '').trim();
    } else if (/\bnext friday\b/i.test(text)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + (5 + 7 - today.getDay()) % 7);
        taskName = taskName.replace(/\bnext friday\b/i, '').trim();
    }

    return {
        name: taskName,
        priority,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
        status: 'todo',
        description: ''
    };
};
