// FILE: js/ui/uiManager.js
export * from './domElements.js';
export * from './taskRenderer.js';
export * from './modalManager.js';
export * from './detailsRenderer.js';
export * from './i18n.js';

// You can also add any other UI functions that don't fit into the other modules here
// For example, functions that manage the overall layout or user info in the header

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
