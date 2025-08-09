// FILE: js/ui/taskRenderer.js
import { openModal } from './modalManager.js';
import * as taskController from '../taskController.js';
import { renderTranslatedText } from './i18n.js';
import { DOM } from './domElements.js';

/**
 * Renders the list of subtasks inside a task item.
 * @param {HTMLElement} container - The UL element to render into.
 * @param {Object} task - The parent task object.
 */
const renderInlineSubtasks = (container, task) => {
    container.innerHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask, index) => {
            const li = document.createElement('li');
            li.className = `inline-subtask-item ${subtask.isCompleted ? 'completed' : ''}`;
            li.innerHTML = `
                <input type="checkbox" ${subtask.isCompleted ? 'checked' : ''}>
                <span>${subtask.text}</span>
                <button class="delete-inline-subtask">&times;</button>
            `;
            li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                taskController.toggleSubtask(task.id, index, e.target.checked);
            });
            li.querySelector('.delete-inline-subtask').addEventListener('click', () => {
                taskController.deleteSubtask(task.id, index);
            });
            container.appendChild(li);
        });
    }
};

export const createTaskElement = (task, state) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.status === 'done' ? 'done' : ''} ${task.isNew ? 'new-item' : ''}`;
    item.dataset.id = task.id;
    // We make the main content draggable, not the whole card, to avoid issues
    item.innerHTML = `
        <div class="task-item-main" draggable="true">
            <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-name">Loading...</div>
                <div class="task-description"></div>
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
        <div class="inline-subtask-section">
            <ul class="inline-subtask-list"></ul>
            <div class="inline-add-subtask">
                <input type="text" placeholder="Add subtask and press Enter...">
            </div>
        </div>
        <div class="task-item-footer">
            <div class="assignee-avatars"></div>
        </div>
    `;

    // --- Populate content and add event listeners ---

    // Task Name and Description
    const taskNameEl = item.querySelector('.task-name');
    const taskDescriptionEl = item.querySelector('.task-description');
    renderTranslatedText(taskNameEl, task.name, task.language);
    if (task.description) {
        taskDescriptionEl.textContent = task.description;
    }

    // Render Assignees
    const assigneesContainer = item.querySelector('.assignee-avatars');
    const assignees = (task.assignedTo && state.team)
        ? task.assignedTo.map(id => state.team.find(m => m.id === id)).filter(Boolean)
        : [];
    assigneesContainer.innerHTML = assignees.slice(0, 3).map(user => {
        const avatarSrc = user.avatarURL || `https://placehold.co/28x28/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;
        return `<div class="avatar" title="${user.nickname}"><img src="${avatarSrc}" alt="${user.nickname}"></div>`;
    }).join('');

    // Render Subtasks
    const subtaskListContainer = item.querySelector('.inline-subtask-list');
    renderInlineSubtasks(subtaskListContainer, task);
    
    // Event Listeners for main task actions
    item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
    item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(DOM.taskModal, task));
    
    // Event listener for adding a new subtask inline
    const addSubtaskInput = item.querySelector('.inline-add-subtask input');
    addSubtaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && addSubtaskInput.value.trim() !== '') {
            e.preventDefault();
            taskController.addSubtask(task.id, addSubtaskInput.value.trim());
            addSubtaskInput.value = '';
        }
    });
    
    // Make the task name clickable to open the modal as well
    taskNameEl.addEventListener('click', () => openModal(DOM.taskModal, task));

    // Set up drag-and-drop on the main part of the task item
    const draggablePart = item.querySelector('.task-item-main');
    draggablePart.addEventListener('dragstart', (e) => {
        e.stopPropagation(); // Prevent text selection issues
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
    });
    draggablePart.addEventListener('dragend', () => {
        item.classList.remove('dragging');
    });

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
