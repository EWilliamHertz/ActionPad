import { db } from './firebase-config.js';
import {
    addDoc,
    collection,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast } from './toast.js';
import { createNotification } from './services/notification.js';
import { addComment, logActivity } from './services/comment.js';
import { generateSubtasksAI } from './services/ai.js';
import { uploadTaskAttachment, deleteAttachment as serviceDeleteAttachment } from './services/attachment.js';

let appState = null;

export const initTaskController = (state) => {
    appState = state;
};

export const setupProjectForm = (state) => {
    const form = document.getElementById('add-project-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-project-input');
        const projectName = input.value.trim();
        if (projectName && state.profile) {
            const projectData = {
                name: projectName,
                companyId: state.company.id,
                createdAt: serverTimestamp()
            };
            addDoc(collection(db, 'projects'), projectData)
                .then(() => {
                    input.value = '';
                    showToast('Project created!', 'success');
                })
                .catch(err => {
                    console.error("Error adding project:", err);
                    showToast(`Error: ${err.message}`, 'error');
                });
        }
    });
};

export const setupTaskForm = () => {
    document.getElementById('add-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-task-input');
        if (input.value.trim() && appState.profile) {
            handleAddTask(input.value.trim());
            input.value = '';
        }
    });
};

const handleAddTask = (text) => {
    const taskData = parseTaskInput(text);
    taskData.projectId = appState.currentProjectId === 'all' ? null : appState.currentProjectId;
    const author = { uid: appState.user.uid, nickname: appState.profile.nickname };

    const fullTaskData = {
        ...taskData,
        companyId: appState.company.id,
        author,
        assignedTo: [],
        subtasks: [],
        attachments: [],
        dependencies: [],
        recurrence: 'none',
        language: localStorage.getItem('actionPadLanguage') || 'en',
        order: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    addDoc(collection(db, 'tasks'), fullTaskData)
        .then((docRef) => {
            const activityText = `${author.nickname} created this task.`;
            logActivity(docRef.id, { text: activityText, author });
            showToast('Task added!', 'success');
        })
        .catch(err => {
            console.error("Error adding task:", err)
            showToast(`Error: ${err.message}`, 'error');
        });
};

export const handleEditTask = async () => {
    const taskId = document.getElementById('edit-task-id').value;
    if (!taskId) return showToast("Error: No task ID found.", "error");

    try {
        const taskRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskRef);
        if (!taskSnap.exists()) {
            return showToast("Task not found. It may have been deleted.", "error");
        }

        const oldAssignees = taskSnap.data().assignedTo || [];
        const newAssignees = Array.from(document.getElementById('edit-task-assignees').selectedOptions).map(option => option.value);
        const dependencies = Array.from(document.getElementById('task-dependencies').selectedOptions).map(option => option.value);

        const updatedData = {
            name: document.getElementById('edit-task-name').value,
            description: document.getElementById('edit-task-description').value,
            dueDate: document.getElementById('edit-task-due-date').value,
            priority: document.getElementById('edit-task-priority').value,
            status: document.getElementById('edit-task-status').value,
            projectId: document.getElementById('edit-task-project').value,
            assignedTo: newAssignees,
            dependencies: dependencies,
            recurrence: document.getElementById('edit-task-recurrence').value,
            updatedAt: serverTimestamp()
        };

        newAssignees.forEach(userId => {
            if (!oldAssignees.includes(userId)) {
                createNotification(userId, {
                    text: `${appState.profile.nickname} assigned you a new task: "${updatedData.name}"`,
                    taskId: taskId
                });
            }
        });

        await updateDoc(taskRef, updatedData);
        showToast('Task updated successfully!', 'success');

    } catch (err) {
        console.error("An error occurred in handleEditTask:", err);
        showToast(`Update failed: ${err.message}`, 'error');
        throw err;
    }
};

export const toggleTaskStatus = (taskId, isDone) => {
    const task = appState.tasks.find(t => t.id === taskId);
    if (isDone && task && task.recurrence && task.recurrence !== 'none') {
        const newDueDate = new Date(task.dueDate);
        switch (task.recurrence) {
            case 'daily':
                newDueDate.setDate(newDueDate.getDate() + 1);
                break;
            case 'weekly':
                newDueDate.setDate(newDueDate.getDate() + 7);
                break;
            case 'monthly':
                newDueDate.setMonth(newDueDate.getMonth() + 1);
                break;
        }
        updateDoc(doc(db, 'tasks', taskId), {
            status: 'todo',
            dueDate: newDueDate.toISOString().split('T')[0],
            updatedAt: serverTimestamp()
        });
    } else {
        updateTaskStatus(taskId, isDone ? 'done' : 'todo');
    }
};

export const updateTaskStatus = (taskId, newStatus) => {
    updateDoc(doc(db, 'tasks', taskId), { status: newStatus, updatedAt: serverTimestamp() })
        .catch(err => {
            console.error("Error updating task status:", err);
            showToast(`Error: ${err.message}`, 'error');
        });
};

export const deleteTask = (taskId) => {
    const task = appState.tasks.find(t => t.id === taskId);
    const taskName = task ? task.name : 'this task';
    if (confirm(`Are you sure you want to delete the task: "${taskName}"?`)) {
        deleteDoc(doc(db, 'tasks', taskId))
            .then(() => showToast('Task deleted.', 'success'))
            .catch(err => {
                showToast(`Deletion failed: ${err.message}`, 'error');
            });
    }
};

export const addSubtask = (taskId, text) => {
    const newSubtask = { text, isCompleted: false };
    updateDoc(doc(db, 'tasks', taskId), { subtasks: arrayUnion(newSubtask) });
};

export const toggleSubtask = async (taskId, subtaskIndex, isCompleted) => {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const updatedSubtasks = [...taskSnap.data().subtasks];
    updatedSubtasks[subtaskIndex].isCompleted = isCompleted;
    updateDoc(taskRef, { subtasks: updatedSubtasks });
};

export const deleteSubtask = async (taskId, subtaskIndex) => {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const updatedSubtasks = taskSnap.data().subtasks.filter((_, index) => index !== subtaskIndex);
    updateDoc(taskRef, { subtasks: updatedSubtasks });
};

export const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    const taskId = document.getElementById('edit-task-id').value;
    if (!file || !taskId) return;
    showToast('Uploading attachment...', 'success');
    try {
        await uploadTaskAttachment(taskId, file);
        showToast('Attachment added!', 'success');
    } catch (error) {
        showToast('Attachment upload failed.', 'error');
    }
    e.target.value = '';
};

export const deleteAttachment = (taskId, attachment) => {
    return serviceDeleteAttachment(taskId, attachment);
};

export const generateSubtasksWithAI = async () => {
    const taskId = document.getElementById('edit-task-id').value;
    const taskName = document.getElementById('edit-task-name').value;
    const taskDescription = document.getElementById('edit-task-description').value;
    const btn = document.getElementById('ai-subtask-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const subtasks = await generateSubtasksAI(taskName, taskDescription);
        if (subtasks && subtasks.length > 0) {
            const taskRef = doc(db, 'tasks', taskId);
            await updateDoc(taskRef, { subtasks: arrayUnion(...subtasks) });
            showToast('AI subtasks added!', 'success');
        } else {
            showToast('AI could not generate subtasks.', 'error');
        }
    } catch (error) {
        showToast('Failed to generate AI subtasks.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Subtasks with AI ✨';
    }
};

const parseTaskInput = (text) => {
    let taskName = text;
    let priority = 'medium';
    let dueDate = null;
    let recurrence = 'none';

    const priorityRegex = /\b(high|medium|low)\s?priority\b/i;
    const priorityMatch = text.match(priorityRegex);
    if (priorityMatch) {
        priority = priorityMatch[1].toLowerCase();
        taskName = taskName.replace(priorityRegex, '').trim();
    }

    const today = new Date();
    if (/\btomorrow\b/i.test(taskName)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + 1);
        taskName = taskName.replace(/\btomorrow\b/i, '').trim();
    } else if (/\bnext monday\b/i.test(taskName)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7);
        taskName = taskName.replace(/\bnext monday\b/i, '').trim();
    } else if (/\bnext friday\b/i.test(taskName)) {
        dueDate = new Date();
        dueDate.setDate(today.getDate() + (5 + 7 - today.getDay()) % 7);
        taskName = taskName.replace(/\bnext friday\b/i, '').trim();
    }

    if (/\bevery day\b/i.test(taskName)) {
        recurrence = 'daily';
        taskName = taskName.replace(/\bevery day\b/i, '').trim();
    } else if (/\bevery week\b/i.test(taskName)) {
        recurrence = 'weekly';
        taskName = taskName.replace(/\bevery week\b/i, '').trim();
    } else if (/\bevery month\b/i.test(taskName)) {
        recurrence = 'monthly';
        taskName = taskName.replace(/\bevery month\b/i, '').trim();
    }


    return {
        name: taskName,
        priority: priority,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
        status: 'todo',
        description: '',
        recurrence: recurrence
    };
};
