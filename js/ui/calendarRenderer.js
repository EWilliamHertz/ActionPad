// FILE: js/ui/calendarRenderer.js
import { openModal } from './modalManager.js';

let currentDate = new Date();
let appStateRef = null;

function renderCalendar() {
    if (!appStateRef) return;

    currentDate.setDate(1);
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    if (!calendarGrid || !monthYearEl) return;

    monthYearEl.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;
    
    const firstDayIndex = currentDate.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
    const lastDayIndex = new Date(year, month + 1, 0).getDay();
    const nextDays = 7 - lastDayIndex - 1;

    calendarGrid.innerHTML = '';
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.classList.add('calendar-day-header');
        dayEl.textContent = day;
        calendarGrid.appendChild(dayEl);
    });

    for (let x = firstDayIndex; x > 0; x--) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('calendar-day', 'prev-month');
        dayEl.innerHTML = `<span>${prevLastDay - x + 1}</span>`;
        calendarGrid.appendChild(dayEl);
    }

    for (let i = 1; i <= lastDay; i++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('calendar-day');
        const dayDate = new Date(year, month, i);
        
        if (i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()) {
            dayEl.classList.add('today');
        }
        
        dayEl.innerHTML = `<span>${i}</span>`;
        
        const tasksForDay = appStateRef.tasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            return taskDate.getFullYear() === year && taskDate.getMonth() === month && taskDate.getDate() + 1 === i;
        });

        if (tasksForDay.length > 0) {
            const tasksContainer = document.createElement('div');
            tasksContainer.classList.add('calendar-tasks');
            tasksForDay.forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.classList.add('calendar-task-item', `priority-${task.priority || 'low'}`);
                taskEl.textContent = task.name;
                taskEl.addEventListener('click', () => openModal(document.getElementById('task-modal'), task));
                tasksContainer.appendChild(taskEl);
            });
            dayEl.appendChild(tasksContainer);
        }
        calendarGrid.appendChild(dayEl);
    }

    for (let j = 1; j <= nextDays; j++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('calendar-day', 'next-month');
        dayEl.innerHTML = `<span>${j}</span>`;
        calendarGrid.appendChild(dayEl);
    }
}

export const renderCalendarView = (tasks, state) => {
    appStateRef = state; // Keep a reference to the main app state
    renderCalendar();
};

// Initial setup of calendar controls
document.addEventListener('DOMContentLoaded', () => {
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }
});
