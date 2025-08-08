// This module is responsible for all direct DOM manipulation in the main application (index.html).
// It renders views, tasks, and modals, keeping the logic separate from other modules.

import * as taskController from './taskController.js';

// --- DOM Element References ---
const listView = document.getElementById('list-view');
const kanbanView = document.getElementById('kanban-view');
const calendarView = document.getElementById('calendar-view');
const taskModal = document.getElementById('task-modal');
const inviteModal = document.getElementById('invite-modal');

let currentDate = new Date(); // State for the calendar view

// --- Main View Rendering ---
export const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.view-btn[data-view="${viewId}"]`).classList.add('active');
};

export const renderView = (viewId, tasks) => {
    switch(viewId) {
        case 'list-view':
            renderListView(tasks);
            break;
        case 'kanban-view':
            renderKanbanView(tasks);
            break;
        case 'calendar-view':
            renderCalendarView(tasks);
            break;
    }
};

// --- Task Element Creation ---
const createTaskElement = (task) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.status === 'done' ? 'done' : ''}`;
    item.dataset.id = task.id;
    item.draggable = true;

    const priorityClass = `priority-${task.priority || 'low'}`;

    item.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''}>
        <div class="task-content">
            <div class="task-name">${task.name}</div>
            <div class="task-details">
                ${task.dueDate ? `<span>📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                <span class="priority-label"><span class="priority-dot ${priorityClass}"></span> ${task.priority}</span>
            </div>
        </div>
        <div class="task-actions">
            <button class="edit-task-btn">✏️</button>
            <button class="delete-task-btn">🗑️</button>
        </div>
    `;

    // --- Event Listeners for Task Actions ---
    item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
    item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(taskModal, task));
    
    return item;
};

// --- Specific View Renderers ---
const renderListView = (tasks) => {
    listView.innerHTML = '';
    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    if (tasks.length === 0) {
        taskList.innerHTML = `<p class="empty-state">No tasks yet. Add one to get started!</p>`;
    } else {
        tasks.forEach(task => taskList.appendChild(createTaskElement(task)));
    }
    listView.appendChild(taskList);
};

const renderKanbanView = (tasks) => {
    const columns = {
        todo: document.getElementById('kanban-todo'),
        'in-progress': document.getElementById('kanban-in-progress'),
        done: document.getElementById('kanban-done'),
    };
    Object.values(columns).forEach(col => col.innerHTML = '');
    tasks.forEach(task => {
        const status = task.status || 'todo';
        if(columns[status]) {
            columns[status].appendChild(createTaskElement(task));
        }
    });
};

const renderCalendarView = (tasks) => {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    document.getElementById('calendar-month-year').textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayOfMonth; i++) {
        grid.insertAdjacentHTML('beforeend', `<div class="calendar-day other-month"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<div class="day-number">${day}</div><div class="calendar-tasks"></div>`;
        const tasksContainer = dayEl.querySelector('.calendar-tasks');
        
        const today = new Date(year, month, day);
        const tasksForDay = tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
        
        tasksForDay.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'calendar-task';
            taskEl.textContent = task.name;
            taskEl.addEventListener('click', () => openModal(taskModal, task));
            tasksContainer.appendChild(taskEl);
        });
        grid.appendChild(dayEl);
    }
};

// --- Modal Handling ---
export const setupModals = () => {
    // Generic close logic for all modals
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                closeModal(modal);
            }
        });
    });

    // Specific logic for the task edit form
    document.getElementById('edit-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        taskController.handleEditTask();
        closeModal(taskModal);
    });
    
    // Specific logic for the invite modal
    document.getElementById('copy-invite-link-button').addEventListener('click', (e) => {
        const linkInput = document.getElementById('invite-link-input');
        linkInput.select();
        document.execCommand('copy');
        const successMsg = document.getElementById('copy-success-msg');
        successMsg.classList.remove('hidden');
        setTimeout(() => successMsg.classList.add('hidden'), 2000);
    });
};

export const openModal = (modalElement, task = null) => {
    if (modalElement.id === 'task-modal' && task) {
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-name').value = task.name;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-due-date').value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
        document.getElementById('edit-task-priority').value = task.priority || 'low';
        document.getElementById('edit-task-status').value = task.status || 'todo';
    }
    modalElement.classList.remove('hidden');
};

export const closeModal = (modalElement) => {
    modalElement.classList.add('hidden');
};

// --- Event Listener Setups ---
export const setupEventListeners = (appState) => {
    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendarView(appState.tasks);
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendarView(appState.tasks);
    });

    // Drag and Drop for Kanban
    let draggedItem = null;
    kanbanView.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-item')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });
    kanbanView.addEventListener('dragend', (e) => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
    kanbanView.addEventListener('dragover', (e) => {
        e.preventDefault();
        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.add('drag-over');
        }
    });
    kanbanView.addEventListener('dragleave', (e) => {
        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
        }
    });
    kanbanView.addEventListener('drop', (e) => {
        e.preventDefault();
        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
            if (draggedItem) {
                const newStatus = column.dataset.status;
                const taskId = draggedItem.dataset.id;
                taskController.updateTaskStatus(taskId, newStatus);
            }
        }
    });
};
