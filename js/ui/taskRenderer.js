// FILE: js/ui/taskRenderer.js
import { openModal } from './modalManager.js';
import * as taskController from '../taskController.js';
import { renderTranslatedText } from './i18n.js';
import { DOM } from './domElements.js';

const renderInlineSubtasks = (container, task, userRole) => {
    container.innerHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask, index) => {
            const li = document.createElement('li');
            const isViewer = userRole === 'Viewer';
            li.className = `inline-subtask-item ${subtask.isCompleted ? 'completed' : ''}`;
            li.innerHTML = `
                <input type="checkbox" ${subtask.isCompleted ? 'checked' : ''} ${isViewer ? 'disabled' : ''}>
                <span>${subtask.text}</span>
                <button class="delete-inline-subtask" ${isViewer ? 'style="display:none;"' : ''}>&times;</button>
            `;
            if (!isViewer) {
                li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                    taskController.toggleSubtask(task.id, index, e.target.checked);
                });
                li.querySelector('.delete-inline-subtask').addEventListener('click', () => {
                    taskController.deleteSubtask(task.id, index);
                });
            }
            container.appendChild(li);
        });
    }
};

export const createTaskElement = (task, state) => {
    const item = document.createElement('div');
    const userRole = state.profile.companyRole;
    const isViewer = userRole === 'Viewer';

    item.className = `task-item ${task.status === 'done' ? 'done' : ''} ${task.isNew ? 'new-item' : ''}`;
    item.dataset.id = task.id;

    const dependencies = task.dependencies?.map(depId => state.tasks.find(t => t.id === depId)?.name).filter(Boolean) || [];

    item.innerHTML = `
        <div class="task-item-main" ${!isViewer ? 'draggable="true"' : ''}>
            <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''} ${isViewer ? 'disabled' : ''}>
            <div class="task-content">
                <div class="task-name">Loading...</div>
                <div class="task-description"></div>
                <div class="task-details">
                    ${task.dueDate ? `<span>📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                    <span class="priority-dot priority-${task.priority || 'low'}"></span>
                    ${task.recurrence && task.recurrence !== 'none' ? `<span>🔁 ${task.recurrence.charAt(0).toUpperCase() + task.recurrence.slice(1)}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="edit-task-btn">✏️</button>
                <button class="delete-task-btn" ${isViewer ? 'style="display:none;"' : ''}>🗑️</button>
            </div>
        </div>
        <div class="inline-subtask-section">
            <ul class="inline-subtask-list"></ul>
            <div class="inline-add-subtask" ${isViewer ? 'style="display:none;"' : ''}>
                <input type="text" placeholder="Add subtask and press Enter...">
            </div>
        </div>
        <div class="task-item-footer">
            ${dependencies.length > 0 ? `<div class="task-dependencies">Blocked by: ${dependencies.join(', ')}</div>` : ''}
            <div class="assignee-avatars"></div>
        </div>
    `;

    // Populate content
    const taskNameEl = item.querySelector('.task-name');
    const taskDescriptionEl = item.querySelector('.task-description');
    renderTranslatedText(taskNameEl, task.name, task.language);
    if (task.description) taskDescriptionEl.textContent = task.description;

    const assigneesContainer = item.querySelector('.assignee-avatars');
    const assignees = (task.assignedTo && state.team) ? task.assignedTo.map(id => state.team.find(m => m.id === id)).filter(Boolean) : [];
    assigneesContainer.innerHTML = assignees.slice(0, 3).map(user => {
        const avatarSrc = user.avatarURL || `https://placehold.co/28x28/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;
        return `<div class="avatar" title="${user.nickname}"><img src="${avatarSrc}" alt="${user.nickname}"></div>`;
    }).join('');

    const subtaskListContainer = item.querySelector('.inline-subtask-list');
    renderInlineSubtasks(subtaskListContainer, task, userRole);
    
    // Add event listeners only if user is not a viewer
    if (!isViewer) {
        item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
        item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
        
        const addSubtaskInput = item.querySelector('.inline-add-subtask input');
        addSubtaskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && addSubtaskInput.value.trim() !== '') {
                e.preventDefault();
                taskController.addSubtask(task.id, addSubtaskInput.value.trim());
                addSubtaskInput.value = '';
            }
        });

        const draggablePart = item.querySelector('.task-item-main');
        draggablePart.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
        });
        draggablePart.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
    }
    
    // Everyone can open the modal to view details
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(DOM.taskModal, task));
    taskNameEl.addEventListener('click', () => openModal(DOM.taskModal, task));

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
