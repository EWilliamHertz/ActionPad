// FILE: js/ui/dragDrop.js
import * as taskController from '../taskController.js';

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

export function setupDragDrop() {
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
        const column = target.closest('.kanban-column');
        if (column) column.classList.add('drag-over');

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

        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
            const newStatus = column.dataset.status;
            const taskId = draggedItem.dataset.id;
            taskController.updateTaskStatus(taskId, newStatus);
        }
    });
}
