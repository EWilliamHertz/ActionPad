export const getElement = (id) => document.getElementById(id);

export const DOM = {
    taskModal: getElement('task-modal'),
    inviteModal: getElement('invite-modal'),
    commandPaletteModal: getElement('command-palette-modal'),
    listView: getElement('list-view'),
    kanbanView: getElement('kanban-view'),
    calendarView: getElement('calendar-view'),
    // Add other frequently accessed elements here
};
