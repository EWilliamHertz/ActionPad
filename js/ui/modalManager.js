// FILE: js/ui/modalManager.js
import { listenToTaskComments } from '../services/comment.js';
import * as taskController from '../taskController.js';
import { renderSubtasks, renderAttachments, renderComments } from './detailsRenderer.js';

let appState = null;
let activeCommentsListener = null;

export const initModalManager = (state) => {
    appState = state;
}

// This function now only handles general modal closing behavior.
export const setupModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                closeModal(modal);
            }
        });
    });
};

// The logic for handling the save button is now inside openModal.
export const openModal = (modalElement, task = null) => {
    if (!modalElement) return;

    if (modalElement.id === 'task-modal' && task) {
        // Populate the modal with task data
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-name').value = task.name;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-due-date').value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
        document.getElementById('edit-task-priority').value = task.priority || 'low';
        document.getElementById('edit-task-status').value = task.status || 'todo';

        // Populate assignees dropdown
        const assigneesSelect = document.getElementById('edit-task-assignees');
        assigneesSelect.innerHTML = '';
        appState.team.forEach(user => {
            const option = new Option(`${user.nickname} (${user.companyRole || 'Member'})`, user.id);
            if (task.assignedTo && task.assignedTo.includes(user.id)) {
                option.selected = true;
            }
            assigneesSelect.appendChild(option);
        });

        // Populate project dropdown
        const projectSelect = document.getElementById('edit-task-project');
        projectSelect.innerHTML = '';
        appState.projects.forEach(project => {
            const option = new Option(project.name, project.id);
            if (task.projectId === project.id) {
                option.selected = true;
            }
            projectSelect.appendChild(option);
        });

        // Render details like subtasks, attachments, and comments
        renderSubtasks(task);
        renderAttachments(task);

        // Set up a real-time listener for comments for this specific task
        if (activeCommentsListener) activeCommentsListener(); // Unsubscribe from previous listener
        activeCommentsListener = listenToTaskComments(task.id, (comments) => {
            renderComments(comments);
        });

        // --- FIX: Attach event listener here, when the modal is guaranteed to be ready ---
        const editTaskForm = document.getElementById('edit-task-form');
        const saveButton = editTaskForm.querySelector('button[type="submit"]');

        // To prevent multiple listeners from being added, we replace the button with a clone of itself.
        // This is a clean way to remove all old event listeners before adding a new one.
        const newSaveButton = saveButton.cloneNode(true);
        saveButton.parentNode.replaceChild(newSaveButton, saveButton);

        newSaveButton.addEventListener('click', async (e) => {
            e.preventDefault();
            newSaveButton.disabled = true;
            newSaveButton.textContent = 'Saving...';
            try {
                await taskController.handleEditTask();
                closeModal(document.getElementById('task-modal'));
            } catch (err) {
                console.error("UI layer caught task update error:", err);
            } finally {
                newSaveButton.disabled = false;
                newSaveButton.textContent = 'Save Changes';
            }
        });
    }
    modalElement.classList.remove('hidden');
};

export const closeModal = (modalElement) => {
    if (!modalElement) return;
    // When closing the task modal, unsubscribe from the comment listener to prevent memory leaks
    if (modalElement.id === 'task-modal' && activeCommentsListener) {
        activeCommentsListener();
        activeCommentsListener = null;
    }
    modalElement.classList.add('hidden');
};
