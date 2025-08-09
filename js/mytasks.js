import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getTasksAssignedToUser, signOut } from './services/task.js';
import { getTranslatedString } from './i18n.js';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        renderAssignedTasks(user.uid);
    } else {
        window.location.replace('login.html');
    }
});

async function renderAssignedTasks(userId) {
    const container = document.getElementById('my-tasks-container');
    container.innerHTML = '<div class="skeleton-task"></div><div class="skeleton-task"></div><div class="skeleton-task"></div>';

    try {
        const tasks = await getTasksAssignedToUser(userId);

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <img src="img/no-tasks.svg" alt="No tasks" class="empty-state-img">
                    <h3>${getTranslatedString('noTasks')}</h3>
                    <p>${getTranslatedString('noTasksCallToAction')}</p>
                    <a href="index.html" class="btn-primary">Create Task</a>
                </div>
            `;
            return;
        }

        container.innerHTML = ''; 

        const tasksByCompany = tasks.reduce((acc, task) => {
            const companyName = task.companyName || 'Unknown Company';
            if (!acc[companyName]) {
                acc[companyName] = [];
            }
            acc[companyName].push(task);
            return acc;
        }, {});


        for (const companyName in tasksByCompany) {
            const companySection = document.createElement('div');
            companySection.className = 'company-task-group';
            companySection.innerHTML = `<h3>${companyName}</h3>`;
            
            const taskList = document.createElement('ul');
            taskList.className = 'task-list-simple';

            tasksByCompany[companyName].forEach(task => {
                const item = document.createElement('li');
                item.className = `task-item-simple ${task.status}`;
                item.innerHTML = `
                    <span class="task-name">${task.name}</span>
                    <span class="task-project">Project: ${task.projectName || 'N/A'}</span>
                    <span class="task-due-date">${task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : ''}</span>
                `;
                taskList.appendChild(item);
            });
            companySection.appendChild(taskList);
            container.appendChild(companySection);
        }

    } catch (error) {
        console.error("Error fetching assigned tasks:", error);
        container.innerHTML = `<p class="error">Could not load your tasks. Please try again later.</p>`;
    }
}

document.getElementById('logout-button').addEventListener('click', signOut);
