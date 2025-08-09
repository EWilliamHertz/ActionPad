// FILE: js/ui/taskRenderer.js
import { openModal } from './modalManager.js';
import * as taskController from '../taskController.js';
import { renderTranslatedText } from './i18n.js';
import { DOM } from './domElements.js';

export const createTaskElement = (task, state) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.status === 'done' ? 'done' : ''} ${task.isNew ? 'new-item' : ''}`;
    item.dataset.id = task.id;
    item.setAttribute('draggable', true);

    const assignees = (task.assignedTo && state.team)
        ? task.assignedTo.map(id => state.team.find(m => m.id === id)).filter(Boolean)
        : [];

    const assigneeAvatars = assignees.slice(0, 3).map(user => {
        const avatarSrc = user.avatarURL || `https://placehold.co/28x28/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;
        return `<div class="avatar" title="${user.nickname}"><img src="${avatarSrc}" alt="${user.nickname}"></div>`;
    }).join('');

    item.innerHTML = `
        <div class="task-item-main">
            <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-name">Loading...</div>
                <div class="task-details">
                    ${task.dueDate ? `<span>📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                    <span class="priority-dot priority-${task.priority || 'low'}"></span>
                </div>
            </div>
            <div class="task-actions">
                <button class="edit-task-btn">✏️</button>
                <button class="delete-task-btn">🗑️</button>
            </div>
        </div>
        <div class="task-item-footer">
            <div class="assignee-avatars">
                ${assigneeAvatars}
            </div>
        </div>
    `;

    const taskNameEl = item.querySelector('.task-name');
    renderTranslatedText(taskNameEl, task.name, task.language);

    item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
    item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(DOM.taskModal, task));
    return item;
};

export const renderListView = (tasks, state) => {
    if (!DOM.listView) return;
    const taskList = document.createElement('div');
    taskList.className = 'task-list';

    if (tasks && tasks.length > 0) {
        tasks.forEach(task => taskList.appendChild(createTaskElement(task, state)));
    } else {
        taskList.innerHTML = `<div class="empty-state"><h3>No tasks here!</h3><p>Create a new task in this project to get started.</p></div>`;
    }
    DOM.listView.innerHTML = '';
    DOM.listView.appendChild(taskList);
};

export const renderKanbanView = (tasks, state) => {
    const columns = {
        todo: document.getElementById('kanban-todo'),
        'in-progress': document.getElementById('kanban-in-progress'),
        done: document.getElementById('kanban-done'),
    };
    
    // Clear all columns first
    Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });

    if (tasks && tasks.length > 0) {
       tasks.forEach(task => {
            const status = task.status || 'todo';
            if(columns[status]) columns[status].appendChild(createTaskElement(task, state));
        });
    } else {
        if (columns.todo) {
            columns.todo.innerHTML = `<p class="empty-state-small">No tasks</p>`;
        }
    }
};
