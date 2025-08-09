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
    console.log("%cDEBUG: setupModals() function called.", "color: orange; font-weight: bold;");

    // General modal close logic
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                closeModal(modal);
            }
        });
    });

    // Specific logic for the task edit form
    const editTaskForm = document.getElementById('edit-task-form');
    if (editTaskForm) {
        // NEW DEBUGGING STEP: Listen for a CLICK on the button instead of SUBMIT on the form.
        const saveButton = editTaskForm.querySelector('button[type="submit"]');
        
        if (saveButton) {
            console.log("DEBUG: Found save button. Attaching CLICK listener.", saveButton);
            
            saveButton.addEventListener('click', async (e) => {
                // This is the new most important log.
                console.log("%cDEBUG: Save Changes button CLICK event detected!", "background: #222; color: #bada55; font-size: 14px;");
                
                e.preventDefault(); // Prevent any default button behavior

                saveButton.disabled = true;
                saveButton.textContent = 'Saving...';

                try {
                    // Now we call the function with the other logs
                    await taskController.handleEditTask();
                    closeModal(document.getElementById('task-modal'));
                } catch (err) {
                    // This will catch errors from handleEditTask if it runs
                    console.error("UI layer caught task update error:", err);
                } finally {
                    // This will run whether the update succeeds or fails
                    saveButton.disabled = false;
                    saveButton.textContent = 'Save Changes';
                }
            });
        } else {
            console.error("DEBUG: CRITICAL - Could not find the 'Save Changes' button inside the form.");
        }

    } else {
        console.error("DEBUG: CRITICAL - Could not find #edit-task-form to attach listener.");
    }
};


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
