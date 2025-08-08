import * as firebaseService from './firebase-service.js';

let appState = null;

export const initTaskController = (state) => {
    appState = state;
};

/**
 * **NEW**: Sets up the form for adding new projects.
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
                companyId: state.profile.companyId,
            };
            firebaseService.addProject(projectData)
                .then(() => {
                    input.value = '';
                })
                .catch(err => {
                    console.error("Error adding project:", err);
                    // Optionally show a toast notification on error
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
    // Ensure new tasks are associated with the current project or none if 'All Tasks' is selected
    taskData.projectId = appState.currentProjectId === 'all' ? null : appState.currentProjectId;

    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };
    firebaseService.addTask(taskData, appState.profile.companyId, author)
        .then((docRef) => {
            const activityText = `${author.nickname} created this task.`;
            firebaseService.logActivity(docRef.id, { text: activityText, author });
        })
        .catch(err => console.error("Error adding task:", err));
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
    firebaseService.updateTask(taskId, taskData)
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
    // Using a simple confirm dialog for now. A custom modal would be better for UX.
    if (confirm("Are you sure you want to delete this task?")) {
        firebaseService.deleteTask(taskId)
            .catch(err => console.error("Error deleting task:", err));
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
            nickname: appState.profile.nickname
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
