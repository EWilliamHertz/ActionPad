// FILE: js/ui/modalManager.js
import { listenToTaskComments } from '../services/comment.js';
import * as taskController from '../taskController.js';
import { renderSubtasks, renderAttachments, renderComments } from './detailsRenderer.js';

let appState = null;
let activeCommentsListener = null;

export const initModalManager = (state) => {
    appState = state;
}

export const setupModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                closeModal(modal);
            }
        });
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
                closeModal(document.getElementById('task-modal'));
            } catch (err) {
                console.error("UI layer caught task update error:", err);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Changes';
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
        
        activeCommentsListener = listenToTaskComments(task.id, (comments) => {
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
