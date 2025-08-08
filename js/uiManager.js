import * as taskController from './taskController.js';
import * as firebaseService from './firebase-service.js';

let appState = null;
let activeCommentsListener = null;

export const initUIManager = (state) => {
    appState = state;
};

const listView = document.getElementById('list-view');
const kanbanView = document.getElementById('kanban-view');
const taskModal = document.getElementById('task-modal');
const inviteModal = document.getElementById('invite-modal');
let currentDate = new Date();

/**
 * **NEW**: Updates the user's info in the header.
 */
export const updateUserInfo = (profile, company) => {
    if (profile) {
        document.getElementById('user-nickname').textContent = profile.nickname;
        const avatar = document.getElementById('user-avatar-header');
        if (profile.avatarURL) {
            avatar.src = profile.avatarURL;
        } else {
            avatar.src = `https://placehold.co/40x40/E9ECEF/495057?text=${profile.nickname.charAt(0).toUpperCase()}`;
        }
    }
    if (company) {
        document.getElementById('user-company').textContent = company.name;
    }
};

/**
 * **NEW**: Renders the list of projects in the sidebar.
 */
export const renderProjectList = (projects, currentProjectId) => {
    const projectListEl = document.getElementById('project-list');
    // Keep the "All Tasks" item
    projectListEl.innerHTML = `<li class="project-item ${currentProjectId === 'all' ? 'active' : ''}" data-project-id="all">All Tasks</li>`;
    projects.forEach(project => {
        const item = document.createElement('li');
        item.className = `project-item ${currentProjectId === project.id ? 'active' : ''}`;
        item.dataset.projectId = project.id;
        item.textContent = project.name;
        projectListEl.appendChild(item);
    });
};

/**
 * **NEW**: Opens the invite modal with the company's referral link.
 */
export const openInviteModal = (inviteLink) => {
    document.getElementById('invite-link-input').value = inviteLink;
    inviteModal.classList.remove('hidden');
};


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

const createTaskElement = (task) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.status === 'done' ? 'done' : ''}`;
    item.dataset.id = task.id;
    item.draggable = true;

    const priorityClass = `priority-${task.priority || 'low'}`;

    const mainContent = document.createElement('div');
    mainContent.className = 'task-item-main';
    mainContent.innerHTML = `
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
    item.appendChild(mainContent);

    const footer = document.createElement('div');
    footer.className = 'task-item-footer';
    const assigneesContainer = document.createElement('div');
    assigneesContainer.className = 'assignee-avatars';
    
    if (task.assignedTo && task.assignedTo.length > 0) {
        task.assignedTo.forEach(uid => {
            const user = appState.team.find(u => u.id === uid);
            if (user) {
                const avatar = document.createElement('div');
                avatar.className = 'avatar';
                avatar.textContent = user.nickname.charAt(0).toUpperCase();
                avatar.title = user.nickname;
                assigneesContainer.appendChild(avatar);
            }
        });
    }
    
    footer.appendChild(assigneesContainer);
    item.appendChild(footer);

    item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
    item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(taskModal, task));
    
    return item;
};

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

export const renderTeamList = (team) => {
    const teamListEl = document.getElementById('team-list');
    teamListEl.innerHTML = '';
    team.forEach(user => {
        const userEl = document.createElement('li');
        userEl.className = 'team-member';
        userEl.innerHTML = `
            <span class="presence-dot ${user.online ? 'online' : 'offline'}"></span>
            <span>${user.nickname}</span>
        `;
        teamListEl.appendChild(userEl);
    });
};

export const setupModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                closeModal(modal);
            }
        });
    });

    document.getElementById('edit-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        taskController.handleEditTask();
        closeModal(taskModal);
    });
    
    document.getElementById('copy-invite-link-button').addEventListener('click', () => {
        const linkInput = document.getElementById('invite-link-input');
        linkInput.select();
        document.execCommand('copy');
        const successMsg = document.getElementById('copy-success-msg');
        successMsg.classList.remove('hidden');
        setTimeout(() => successMsg.classList.add('hidden'), 2000);
    });

    document.getElementById('add-subtask-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = document.getElementById('edit-task-id').value;
        const input = document.getElementById('new-subtask-input');
        if (input.value.trim()) {
            taskController.addSubtask(taskId, input.value.trim());
            input.value = '';
        }
    });

    document.getElementById('add-comment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = document.getElementById('edit-task-id').value;
        const input = document.getElementById('new-comment-input');
        if (input.value.trim()) {
            taskController.addComment(taskId, input.value.trim());
            input.value = '';
        }
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

        const assigneesSelect = document.getElementById('edit-task-assignees');
        assigneesSelect.innerHTML = '';
        appState.team.forEach(user => {
            const option = new Option(user.nickname, user.id);
            if (task.assignedTo && task.assignedTo.includes(user.id)) {
                option.selected = true;
            }
            assigneesSelect.appendChild(option);
        });

        renderSubtasks(task);
        
        if (activeCommentsListener) activeCommentsListener(); // Unsubscribe from previous listener
        activeCommentsListener = firebaseService.listenToTaskComments(task.id, (comments) => {
            renderComments(comments);
        });
    }
    modalElement.classList.remove('hidden');
};

export const closeModal = (modalElement) => {
    if (modalElement.id === 'task-modal' && activeCommentsListener) {
        activeCommentsListener(); // Unsubscribe from comments listener
        activeCommentsListener = null;
    }
    modalElement.classList.add('hidden');
};

const renderSubtasks = (task) => {
    const subtasksList = document.getElementById('subtasks-list');
    subtasksList.innerHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask, index) => {
            const item = document.createElement('div');
            item.className = `subtask-item ${subtask.isCompleted ? 'completed' : ''}`;
            item.innerHTML = `
                <input type="checkbox" ${subtask.isCompleted ? 'checked' : ''}>
                <span class="subtask-text">${subtask.text}</span>
                <button class="delete-subtask-btn">&times;</button>
            `;
            item.querySelector('input').addEventListener('change', (e) => {
                taskController.toggleSubtask(task.id, index, e.target.checked);
            });
            item.querySelector('button').addEventListener('click', () => {
                taskController.deleteSubtask(task.id, index);
});
            subtasksList.appendChild(item);
        });
    }
};

const renderComments = (comments) => {
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '';
    comments.forEach(comment => {
        const item = document.createElement('div');
        const author = comment.author.nickname;
        const timestamp = comment.createdAt?.toDate().toLocaleString() || '...';
        
        if (comment.type === 'comment') {
            item.className = 'comment-item';
            item.innerHTML = `
                <div class="avatar comment-avatar">${author.charAt(0).toUpperCase()}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${author}</span>
                        <span class="comment-timestamp">${timestamp}</span>
                    </div>
                    <div class="comment-body">${comment.text}</div>
                </div>
            `;
        } else {
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="comment-content">
                    <div class="comment-body">${comment.text}</div>
                    <div class="comment-timestamp">${timestamp}</div>
                </div>
            `;
        }
        commentsList.appendChild(item);
    });
};

export const setupEventListeners = () => {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendarView(appState.tasks);
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendarView(appState.tasks);
    });

    let draggedItem = null;
    kanbanView.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-item')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });
    kanbanView.addEventListener('dragend', () => {
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
        if (column && draggedItem) {
            column.classList.remove('drag-over');
            const newStatus = column.dataset.status;
            const taskId = draggedItem.dataset.id;
            taskController.updateTaskStatus(taskId, newStatus);
        }
    });
};
