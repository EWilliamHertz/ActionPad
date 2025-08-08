import * as taskController from './taskController.js';
import * as firebaseService from './firebaseService.js';

const appContainer = document.getElementById('app-container');
const authContainer = document.getElementById('auth-container');
const userEmailSpan = document.getElementById('user-email');
const listView = document.getElementById('list-view');
const kanbanView = document.getElementById('kanban-view');
const calendarView = document.getElementById('calendar-view');
const modal = document.getElementById('task-modal');

// --- Auth UI ---
export const showApp = (email) => {
    appContainer.classList.remove('hidden');
    authContainer.classList.add('hidden');
    userEmailSpan.textContent = email;
};

export const showAuth = () => {
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    userEmailSpan.textContent = '';
};

export const toggleAuthForms = () => {
    document.getElementById('login-form').style.display = document.getElementById('login-form').style.display === 'none' ? 'flex' : 'none';
    document.getElementById('register-form').style.display = document.getElementById('register-form').style.display === 'none' ? 'flex' : 'none';
    document.querySelector('#show-register').parentElement.style.display = document.querySelector('#show-register').parentElement.style.display === 'none' ? 'block' : 'none';
    document.querySelector('#show-login').parentElement.style.display = document.querySelector('#show-login').parentElement.style.display === 'none' ? 'block' : 'none';
};

export const showAuthError = (elementId, message) => {
    document.getElementById(elementId).textContent = message;
};


// --- View Rendering ---
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
}

const createTaskElement = (task) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.status === 'done' ? 'done' : ''}`;
    item.dataset.id = task.id;
    item.draggable = true;

    const priorityClass = `priority-${task.priority || 'low'}`;

    item.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''}>
        <div class="task-content">
            <div class="task-name" contenteditable="false">${task.name}</div>
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

    item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
    item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(task));
    
    // Inline editing for task name
    const taskNameDiv = item.querySelector('.task-name');
    item.addEventListener('dblclick', () => {
        taskNameDiv.contentEditable = true;
        taskNameDiv.focus();
    });
    taskNameDiv.addEventListener('blur', () => {
        taskNameDiv.contentEditable = false;
        if(taskNameDiv.textContent !== task.name) {
             firebaseService.updateTask(task.id, { name: taskNameDiv.textContent });
        }
    });
     taskNameDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            taskNameDiv.blur();
        }
    });

    return item;
};

const renderListView = (tasks) => {
    listView.innerHTML = '';
    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    tasks.forEach(task => taskList.appendChild(createTaskElement(task)));
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

// --- Calendar ---
let currentDate = new Date();

const renderCalendarView = (tasks) => {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    document.getElementById('calendar-month-year').textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="calendar-day other-month"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<div class="day-number">${day}</div><div class="calendar-tasks"></div>`;

        const today = new Date(year, month, day);
        const tasksForDay = tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
        
        const tasksContainer = dayEl.querySelector('.calendar-tasks');
        tasksForDay.forEach(task => {
            tasksContainer.innerHTML += `<div class="calendar-task">${task.name}</div>`;
        });
        grid.appendChild(dayEl);
    }
};

export const setupCalendarControls = () => {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendarView([]); // Re-render with current tasks later
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendarView([]); // Re-render with current tasks later
    });
};

// --- Modal Logic ---
export const setupModal = () => {
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
            closeModal();
        }
    });

    document.getElementById('edit-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        taskController.handleEditTask();
        closeModal();
    });
};

const openModal = (task) => {
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-name').value = task.name;
    document.getElementById('edit-task-description').value = task.description || '';
    document.getElementById('edit-task-due-date').value = task.dueDate ? task.dueDate.split('T')[0] : '';
    document.getElementById('edit-task-priority').value = task.priority || 'low';
    document.getElementById('edit-task-status').value = task.status || 'todo';
    modal.classList.remove('hidden');
};

const closeModal = () => {
    modal.classList.add('hidden');
};

// --- Drag & Drop ---
export const setupDragAndDrop = () => {
    let draggedItem = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-item')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('task-item')) {
            e.target.classList.remove('dragging');
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
        if (column && draggedItem) {
            column.classList.remove('drag-over');
            const newStatus = column.dataset.status;
            const taskId = draggedItem.dataset.id;
            firebaseService.updateTask(taskId, { status: newStatus });
        }
    });
};
