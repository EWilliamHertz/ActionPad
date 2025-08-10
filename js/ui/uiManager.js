// FILE: js/ui/uiManager.js

// Import functions from other UI modules
import { DOM, getElement } from './domElements.js';
import { createTaskElement, renderListView, renderKanbanView } from './taskRenderer.js';
import { initModalManager, setupModals, openModal, closeModal } from './modalManager.js';
import { renderSubtasks, renderAttachments, renderComments } from './detailsRenderer.js';
import { renderTranslatedText } from './i18n.js';
import { renderTeamList, renderChatMessages } from './sidebarRenderer.js';
import { switchView, renderView } from './viewManager.js';
import { setupDragDrop } from './dragDrop.js';

// Re-export them for other files to use in a stable way
export {
    DOM, getElement,
    createTaskElement, renderListView, renderKanbanView,
    initModalManager, setupModals, openModal, closeModal,
    renderSubtasks, renderAttachments, renderComments,
    renderTranslatedText,
    renderTeamList, renderChatMessages,
    switchView, renderView,
    setupDragDrop
};


// --- UI utility functions that live in this file ---

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

export const initUIManager = (state) => {
    console.log("UI Manager Initialized");
};
