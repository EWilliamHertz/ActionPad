import * as taskController from '../taskController.js';

export const renderSubtasks = (task) => {
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

export const renderAttachments = (task) => {
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
                    taskController.deleteAttachment(task.id, attachment);
                }
            });
            attachmentsList.appendChild(item);
        });
    }
};

export const renderComments = (comments) => {
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
