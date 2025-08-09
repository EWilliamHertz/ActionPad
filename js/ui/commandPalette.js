// FILE: js/ui/commandPalette.js

let state = null;
let actions = {};
let currentResults = [];
let selectedIndex = -1;

const paletteModal = document.getElementById('command-palette-modal');
const paletteInput = document.getElementById('command-palette-input');
const paletteResults = document.getElementById('command-palette-results');

export function initCommandPalette(appState, appActions) {
    state = appState;
    actions = appActions;

    // Open palette with Ctrl+K or Cmd+K
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openPalette();
        }
    });

    // Also open on search bar click
    document.getElementById('search-bar').addEventListener('click', openPalette);

    // Close on Escape key
    paletteModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePalette();
        if (e.key === 'ArrowDown') navigateResults(1);
        if (e.key === 'ArrowUp') navigateResults(-1);
        if (e.key === 'Enter' && selectedIndex > -1) {
            executeResult(currentResults[selectedIndex]);
        }
    });

    // Handle input changes
    paletteInput.addEventListener('input', () => {
        const searchTerm = paletteInput.value;
        search(searchTerm);
    });

    // Handle clicks on results
    paletteResults.addEventListener('click', (e) => {
        const item = e.target.closest('.command-palette-item');
        if (item) {
            const result = JSON.parse(item.dataset.result);
            executeResult(result);
        }
    });
}

function openPalette() {
    paletteModal.classList.remove('hidden');
    paletteInput.focus();
    search(''); // Show initial results
}

function closePalette() {
    paletteModal.classList.add('hidden');
    paletteInput.value = '';
}

function search(term) {
    const lowerCaseTerm = term.toLowerCase();
    if (!term) {
        paletteResults.innerHTML = '<div class="command-palette-placeholder">Start typing to search for tasks, projects, or people...</div>';
        return;
    }

    const taskResults = state.tasks
        .filter(t => t.name.toLowerCase().includes(lowerCaseTerm))
        .map(t => ({ type: 'task', id: t.id, title: t.name, subtitle: `Project: ${state.projects.find(p => p.id === t.projectId)?.name || 'N/A'}` }));

    const projectResults = state.projects
        .filter(p => p.name.toLowerCase().includes(lowerCaseTerm))
        .map(p => ({ type: 'project', id: p.id, title: p.name, subtitle: 'Switch to this project' }));

    const teamResults = state.team
        .filter(u => u.nickname.toLowerCase().includes(lowerCaseTerm))
        .map(u => ({ type: 'user', id: u.id, title: u.nickname, subtitle: u.companyRole || 'Member' }));

    currentResults = [...taskResults, ...projectResults, ...teamResults];
    renderResults(taskResults, projectResults, teamResults);
    selectedIndex = -1; // Reset selection
}

function renderResults(tasks, projects, users) {
    paletteResults.innerHTML = '';
    if (tasks.length === 0 && projects.length === 0 && users.length === 0) {
        paletteResults.innerHTML = '<div class="command-palette-placeholder">No results found.</div>';
        return;
    }

    if (tasks.length > 0) {
        paletteResults.innerHTML += '<div class="command-palette-category">Tasks</div>';
        tasks.forEach(r => paletteResults.appendChild(createResultElement(r, '📝')));
    }
    if (projects.length > 0) {
        paletteResults.innerHTML += '<div class="command-palette-category">Projects</div>';
        projects.forEach(r => paletteResults.appendChild(createResultElement(r, '📁')));
    }
    if (users.length > 0) {
        paletteResults.innerHTML += '<div class="command-palette-category">People</div>';
        users.forEach(r => paletteResults.appendChild(createResultElement(r, '👤')));
    }
}

function createResultElement(result, icon) {
    const item = document.createElement('div');
    item.className = 'command-palette-item';
    item.dataset.result = JSON.stringify(result);
    item.innerHTML = `
        <span class="command-palette-item-icon">${icon}</span>
        <div class="command-palette-item-text">
            <span class="command-palette-item-title">${result.title}</span>
            <span class="command-palette-item-subtitle">${result.subtitle}</span>
        </div>
    `;
    return item;
}

function executeResult(result) {
    if (!result) return;
    
    switch (result.type) {
        case 'task':
            const task = state.tasks.find(t => t.id === result.id);
            if (task) actions.openModal(document.getElementById('task-modal'), task);
            break;
        case 'project':
            actions.switchProject(result.id);
            break;
        case 'user':
            // Future action: open user profile modal or start a direct chat
            console.log("Selected user:", result.title);
            break;
    }
    closePalette();
}

function navigateResults(direction) {
    const items = paletteResults.querySelectorAll('.command-palette-item');
    if (items.length === 0) return;

    selectedIndex += direction;

    if (selectedIndex >= items.length) selectedIndex = 0;
    if (selectedIndex < 0) selectedIndex = items.length - 1;

    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
    });
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
}
