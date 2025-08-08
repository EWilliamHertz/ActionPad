// FILE: js/uiManager.js
import * as taskController from './taskController.js';
import * as firebaseService from './firebase-service.js';

let appState = null;
let activeCommentsListener = null;

export const initUIManager = (state) => {
    appState = state;
};

// --- Helper function to format timestamps ---
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(timestamp) {
    if (!timestamp) return 'Offline';
    const now = new Date();
    const lastSeen = timestamp.toDate();
    const diffSeconds = Math.floor((now - lastSeen) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return lastSeen.toLocaleDateString();
}

export const renderTeamList = (team) => {
    const teamListEl = document.getElementById('team-list');
    if (!teamListEl) return;
    teamListEl.innerHTML = '';
    
    team.sort((a, b) => (b.online === true ? 1 : -1) - (a.online === true ? 1 : -1) || a.nickname.localeCompare(b.nickname));

    team.forEach(user => {
        const userEl = document.createElement('li');
        userEl.className = 'team-member';
        const statusClass = user.online ? 'online' : 'offline';
        const statusText = user.online ? 'Online' : formatLastSeen(user.last_changed);
        const avatarSrc = user.avatarURL || `https://placehold.co/36x36/E9ECEF/495057?text=${user.nickname.charAt(0).toUpperCase()}`;

        userEl.innerHTML = `
            <div class="team-member-avatar">
                <img src="${avatarSrc}" alt="${user.nickname}" class="avatar-img">
                <span class="presence-dot ${statusClass}"></span>
            </div>
            <div class="team-member-info">
                <span class="team-member-name">${user.nickname}</span>
                <span class="team-member-status ${statusClass}">${statusText}</span>
            </div>
        `;
        teamListEl.appendChild(userEl);
    });
};

const listView = document.getElementById('list-view');
const kanbanView = document.getElementById('kanban-view');
const taskModal = document.getElementById('task-modal');
const inviteModal = document.getElementById('invite-modal');
let currentDate = new Date();

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

export const hideProjectHeader = () => {
    const projectHeader = document.getElementById('project-header');
    if (projectHeader) projectHeader.classList.add('hidden');
};

export const updateProjectHeader = (project) => {
    const projectHeader = document.getElementById('project-header');
    if (!projectHeader || !project) return;
    document.getElementById('project-name-header').textContent = project.name;
    const logoImg = document.getElementById('project-logo');
    logoImg.src = project.logoURL || `https://placehold.co/48x48/E9ECEF/495057?text=${project.name.charAt(0).toUpperCase()}`;
    projectHeader.classList.remove('hidden');
};

export const renderProjectList = (projects, currentProjectId) => {
    const projectListEl = document.getElementById('project-list');
    if (!projectListEl) return;
    projectListEl.innerHTML = `<li class="project-item ${currentProjectId === 'all' ? 'active' : ''}" data-project-id="all">All Tasks</li>`;
    (projects || []).forEach(project => {
        const item = document.createElement('li');
        item.className = `project-item ${currentProjectId === project.id ? 'active' : ''}`;
        item.dataset.projectId = project.id;
        item.textContent = project.name;
        projectListEl.appendChild(item);
    });
};

export const openInviteModal = (inviteLink) => {
    if (inviteModal) {
        document.getElementById('invite-link-input').value = inviteLink;
        inviteModal.classList.remove('hidden');
    }
};

export const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.view-btn[data-view="${viewId}"]`)?.classList.add('active');
};

export const renderView = (viewId, tasks) => {
    switch(viewId) {
        case 'list-view': renderListView(tasks); break;
        case 'kanban-view': renderKanbanView(tasks); break;
        case 'calendar-view': renderCalendarView(tasks); break;
    }
};

const createTaskElement = (task) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.status === 'done' ? 'done' : ''}`;
    item.dataset.id = task.id;
    
    // The task name will be populated asynchronously
    item.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''}>
        <div class="task-content">
            <div class="task-name">Loading...</div>
            <div class="task-details">
                ${task.dueDate ? `<span>📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
            </div>
        </div>
        <div class="task-actions">
            <button class="edit-task-btn">✏️</button>
            <button class="delete-task-btn">🗑️</button>
        </div>
    `;

    // Asynchronously translate and update the task name
    const taskNameEl = item.querySelector('.task-name');
    renderTranslatedText(taskNameEl, task.name, task.language);

    item.querySelector('.task-checkbox').addEventListener('change', (e) => taskController.toggleTaskStatus(task.id, e.target.checked));
    item.querySelector('.delete-task-btn').addEventListener('click', () => taskController.deleteTask(task.id));
    item.querySelector('.edit-task-btn').addEventListener('click', () => openModal(taskModal, task));
    return item;
};


const renderListView = (tasks) => {
    if (!listView) return;
    listView.innerHTML = '';
    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    if (!tasks || tasks.length === 0) {
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
    Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });
    (tasks || []).forEach(task => {
        const status = task.status || 'todo';
        if(columns[status]) columns[status].appendChild(createTaskElement(task));
    });
};

const renderCalendarView = (tasks) => {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
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
        const tasksForDay = (tasks || []).filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
        tasksForDay.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'calendar-task';
            taskEl.textContent = task.name; // Translation could be added here too if needed
            taskEl.addEventListener('click', () => openModal(taskModal, task));
            tasksContainer.appendChild(taskEl);
        });
        grid.appendChild(dayEl);
    }
};

export const setupModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                    closeModal(modal);
                }
            });
        }
    });
    const editTaskForm = document.getElementById('edit-task-form');
    if (editTaskForm) {
        editTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            taskController.handleEditTask();
            closeModal(taskModal);
        });
    }
    const copyInviteBtn = document.getElementById('copy-invite-link-button');
    if (copyInviteBtn) {
        copyInviteBtn.addEventListener('click', () => {
            const linkInput = document.getElementById('invite-link-input');
            linkInput.select();
            document.execCommand('copy');
            const successMsg = document.getElementById('copy-success-msg');
            successMsg.classList.remove('hidden');
            setTimeout(() => successMsg.classList.add('hidden'), 2000);
        });
    }
    const addSubtaskForm = document.getElementById('add-subtask-form');
    if (addSubtaskForm) {
        addSubtaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const taskId = document.getElementById('edit-task-id').value;
            const input = document.getElementById('new-subtask-input');
            if (input && input.value.trim()) {
                taskController.addSubtask(taskId, input.value.trim());
                input.value = '';
            }
        });
    }
    const addCommentForm = document.getElementById('add-comment-form');
    if (addCommentForm) {
        addCommentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const taskId = document.getElementById('edit-task-id').value;
            const input = document.getElementById('new-comment-input');
            if (input && input.value.trim()) {
                taskController.addComment(taskId, input.value.trim());
                input.value = '';
            }
        });
    }
};

export const openModal = (modalElement, task = null) => {
    if (!modalElement) return;
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

        // FIXED: Populate the project dropdown
        const projectSelect = document.getElementById('edit-task-project');
        projectSelect.innerHTML = '';
        appState.projects.forEach(project => {
            const option = new Option(project.name, project.id);
            if (task.projectId === project.id) {
                option.selected = true;
            }
            projectSelect.appendChild(option);
        });
        
        renderSubtasks(task);
        if (activeCommentsListener) activeCommentsListener();
        activeCommentsListener = firebaseService.listenToTaskComments(task.id, (comments) => {
            renderComments(comments);
        });
    }
    modalElement.classList.remove('hidden');
};

export const closeModal = (modalElement) => {
    if (!modalElement) return;
    if (modalElement.id === 'task-modal' && activeCommentsListener) {
        activeCommentsListener();
        activeCommentsListener = null;
    }
    modalElement.classList.add('hidden');
};

const renderSubtasks = (task) => {
    const subtasksList = document.getElementById('subtasks-list');
    if (!subtasksList) return;
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
    if (!commentsList) return;
    commentsList.innerHTML = '';
    (comments || []).forEach(comment => {
        const item = document.createElement('div');
        const author = comment.author?.nickname || 'User';
        const timestamp = comment.createdAt ? formatTimestamp(comment.createdAt) : '';

        if (comment.type === 'comment') {
            const avatarSrc = comment.author?.avatarURL || `https://placehold.co/32x32/E9ECEF/495057?text=${author.charAt(0).toUpperCase()}`;
            item.className = 'comment-item';
            item.innerHTML = `
                <img src="${avatarSrc}" alt="${author}" class="avatar comment-avatar">
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${author}</span>
                        <span class="comment-timestamp">${timestamp}</span>
                    </div>
                    <div class="comment-body">Loading...</div>
                </div>
            `;
            const commentBodyEl = item.querySelector('.comment-body');
            renderTranslatedText(commentBodyEl, comment.text, comment.language);
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

// NEW: Render Chat Messages
export const renderChatMessages = (messages, currentUserId) => {
    const chatMessagesEl = document.getElementById('team-chat-messages');
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = '';
    messages.forEach(msg => {
        const item = document.createElement('div');
        const isSelf = msg.author.uid === currentUserId;
        item.className = `chat-message ${isSelf ? 'is-self' : ''}`;

        const author = msg.author?.nickname || 'User';
        const timestamp = msg.createdAt ? formatTimestamp(msg.createdAt) : '';
        const avatarSrc = msg.author?.avatarURL || `https://placehold.co/32x32/E9ECEF/495057?text=${author.charAt(0).toUpperCase()}`;

        item.innerHTML = `
            <img src="${avatarSrc}" alt="${author}" class="avatar chat-avatar">
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-author">${author}</span>
                    <span class="chat-timestamp">${timestamp}</span>
                </div>
                <div class="chat-text">${msg.text}</div>
            </div>
        `;
        chatMessagesEl.appendChild(item);
    });
    // Scroll to the bottom
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
};


// NEW: Asynchronously translate and render text
async function renderTranslatedText(element, text, originalLanguage) {
    const userLanguage = localStorage.getItem('actionPadLanguage') || 'en';
    if (originalLanguage && originalLanguage !== userLanguage) {
        try {
            const translatedText = await firebaseService.translateText(text, userLanguage);
            element.textContent = translatedText;
            element.title = `Original: ${text}`; // Show original on hover
        } catch (e) {
            element.textContent = text; // Show original on error
        }
    } else {
        element.textContent = text;
    }
}


export const setupEventListeners = () => {
    const prevMonthBtn = document.getElementById('prev-month');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendarView(appState.tasks);
        });
    }
    const nextMonthBtn = document.getElementById('next-month');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendarView(appState.tasks);
        });
    }
    if (!kanbanView) return;
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
