// FILE: js/ui/viewManager.js
import { renderListView, renderKanbanView } from './taskRenderer.js';
// import { renderCalendarView } from './calendarRenderer.js'; // Assuming you'll create this later

export const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.view-btn[data-view="${viewId}"]`)?.classList.add('active');
};

export const renderView = (viewId, tasks) => {
    switch(viewId) {
        case 'list-view':
            renderListView(tasks);
            break;
        case 'kanban-view':
            renderKanbanView(tasks);
            break;
        case 'calendar-view':
            // renderCalendarView(tasks); // This can be enabled when the function is ready
            console.log("Calendar view not yet implemented.");
            break;
    }
};
