// FILE: js/uiManager.js
import * as taskController from './taskController.js';
import * as firebaseService from './firebase-service.js';
import { showToast } from './toast.js';

let appState = null;
let activeCommentsListener = null;

export const initUIManager = (state) => {
    appState = state;
};

// --- Helper functions ---
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    return timestamp.toDate().toLocaleString();
}
function formatTime(timestamp) {
    if (!timestamp) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    item.setAttribute('draggable', true); // For drag-and-drop
    
    item.innerHTML = `
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
    `;

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
            taskEl.textContent = task.name;
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
        editTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveButton = editTaskForm.querySelector('button[type="submit"]');
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            try {
                await taskController.handleEditTask();
                closeModal(taskModal);
            } catch (err) {
                console.error("UI layer caught task update error:", err);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Changes';
            }
        });
    }

    // NEW: AI Subtask button
    document.getElementById('ai-subtask-btn').addEventListener('click', taskController.generateSubtasksWithAI);
    
    // NEW: Attachment button
    document.getElementById('add-attachment-btn').addEventListener('click', () => {
        document.getElementById('add-attachment-input').click();
    });
    document.getElementById('add-attachment-input').addEventListener('change', taskController.handleAttachmentUpload);


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
        renderAttachments(task);
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

// NEW: Render file attachments
const renderAttachments = (task) => {
    const attachmentsList = document.getElementById('attachments-list');
    if (!attachmentsList) return;
    attachmentsList.innerHTML = '';
    if(task.attachments && task.attachments.length > 0) {
        task.attachments.forEach(attachment => {
            const item = document.createElement('div');
            item.className = 'attachment-item';
            item.innerHTML = `
                <a href="${attachment.url}" target="_blank">${attachment.name}</a>
                <span class="attachment-size">(${(attachment.size / 1024).toFixed(1)} KB)</span>
                <button class="delete-attachment-btn">&times;</button>
            `;
            item.querySelector('.delete-attachment-btn').addEventListener('click', () => {
                if(confirm(`Are you sure you want to delete the attachment: ${attachment.name}?`)) {
                    firebaseService.deleteAttachment(task.id, attachment);
                }
            });
            attachmentsList.appendChild(item);
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
        const timestamp = comment.createdAt ? formatDateTime(comment.createdAt) : '';

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

export const renderChatMessages = (messages, currentUserId) => {
    const chatMessagesEl = document.getElementById('team-chat-messages');
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = '';
    messages.forEach(msg => {
        const item = document.createElement('div');
        const isSelf = msg.author.uid === currentUserId;
        item.className = `chat-message ${isSelf ? 'is-self' : ''}`;

        const author = msg.author?.nickname || 'User';
        const timestamp = msg.createdAt ? formatTime(msg.createdAt) : '';
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
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
};

async function renderTranslatedText(element, text, originalLanguage) {
    const userLanguage = localStorage.getItem('actionPadLanguage') || 'en';
    if (originalLanguage && originalLanguage !== userLanguage) {
        element.textContent = 'Translating...';
        try {
            const translatedText = await firebaseService.translateText(text, userLanguage);
            element.textContent = translatedText;
            element.title = `Original: ${text}`;
        } catch (e) {
            element.textContent = text; 
        }
    } else {
        element.textContent = text;
    }
}


export const setupEventListeners = () => {
    // Calendar buttons
    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendarView(appState.tasks);
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendarView(appState.tasks);
    });

    // Main drag-and-drop handler
    const mainContent = document.querySelector('main');
    if (!mainContent) return;

    let draggedItem = null;
    mainContent.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-item')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    mainContent.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
    
    mainContent.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target;
        // For Kanban view
        const column = target.closest('.kanban-column');
        if (column) column.classList.add('drag-over');

        // For List view
        const taskList = target.closest('.task-list');
        if(taskList) {
            const afterElement = getDragAfterElement(taskList, e.clientY);
            const currentlyDragged = document.querySelector('.dragging');
            if (afterElement == null) {
                taskList.appendChild(currentlyDragged);
            } else {
                taskList.insertBefore(currentlyDragged, afterElement);
            }
        }
    });

    mainContent.addEventListener('dragleave', (e) => {
        const column = e.target.closest('.kanban-column');
        if (column) column.classList.remove('drag-over');
    });

    mainContent.addEventListener('drop', (e) => {
        e.preventDefault();
        if(!draggedItem) return;

        // Kanban Drop Logic
        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
            const newStatus = column.dataset.status;
            const taskId = draggedItem.dataset.id;
            taskController.updateTaskStatus(taskId, newStatus);
        }

        // List View Drop Logic
        const taskList = e.target.closest('.task-list');
        if(taskList) {
            const taskElements = [...taskList.querySelectorAll('.task-item:not(.dragging)')];
            const newIndex = taskElements.indexOf(draggedItem);
            // Here you would implement the logic to update the `order` field in Firestore
            // This requires getting the `order` of the tasks before and after the drop position
            console.log("Dropped task", draggedItem.dataset.id, "at new visual index", newIndex);
            // This is a complex operation and for now we will just log the intended action
        }
    });
};

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// NEW: Command Palette
export const openCommandPalette = () => {
    const modal = document.getElementById('command-palette-modal');
    modal.classList.remove('hidden');
    const input = document.getElementById('command-palette-input');
    input.value = '';
    input.focus();
    renderCommandPaletteResults('', appState);
};

export const renderCommandPaletteResults = (searchTerm, state) => {
    const resultsContainer = document.getElementById('command-palette-results');
    resultsContainer.innerHTML = '';

    if(!searchTerm) {
        resultsContainer.innerHTML = '<div class="command-palette-placeholder">Start typing to search...</div>';
        return;
    }

    // Search Tasks
    const taskResults = state.tasks.filter(t => t.name.toLowerCase().includes(searchTerm));
    if(taskResults.length > 0) {
        resultsContainer.innerHTML += `<div class="command-palette-category">Tasks</div>`;
        taskResults.forEach(task => {
            const item = document.createElement('div');
            item.className = 'command-palette-item';
            item.innerHTML = `<span>${task.name}</span>`;
            item.addEventListener('click', () => {
                openModal(document.getElementById('task-modal'), task);
                closeModal(document.getElementById('command-palette-modal'));
            });
            resultsContainer.appendChild(item);
        });
    }
    // Search Projects
    const projectResults = state.projects.filter(p => p.name.toLowerCase().includes(searchTerm));
     if(projectResults.length > 0) {
        resultsContainer.innerHTML += `<div class="command-palette-category">Projects</div>`;
        projectResults.forEach(project => {
            const item = document.createElement('div');
            item.className = 'command-palette-item';
            item.innerHTML = `<span>${project.name}</span>`;
            item.addEventListener('click', () => {
                // This would need a function in app.js to switch project view
                console.log(`Maps to project: ${project.id}`);
                closeModal(document.getElementById('command-palette-modal'));
            });
            resultsContainer.appendChild(item);
        });
    }
};

// NEW: Notifications
export const updateNotificationBell = (notifications) => {
    const countEl = document.getElementById('notification-count');
    const dropdownEl = document.getElementById('notification-dropdown');
    dropdownEl.innerHTML = '';

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (unreadCount > 0) {
        countEl.textContent = unreadCount;
        countEl.classList.remove('hidden');
    } else {
        countEl.classList.add('hidden');
    }
    
    if(notifications.length === 0) {
        dropdownEl.innerHTML = '<div class="notification-item">No new notifications</div>';
    } else {
        notifications.slice(0, 10).forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.isRead ? 'read' : ''}`;
            item.innerHTML = `<p>${notif.text}</p><span class="timestamp">${formatLastSeen(notif.createdAt)}</span>`;
            item.addEventListener('click', () => {
                // Could navigate to the task here in the future
                console.log('Clicked notification for task:', notif.taskId);
            });
            dropdownEl.appendChild(item);
        });
    }
};
