const tg = window.Telegram.WebApp;
tg.expand();

// ЗАМІНИ НА СВОЄ ПОСИЛАННЯ З GOOGLE APPS SCRIPT
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw5EIAiQZcFTDtKEvzX7LMwdv-x4F4NshkGKiIIexDUN-r_FCwvfq3zkqvD_HmuQJJq/exec";

// Отримуємо реальні дані гравця з Telegram
const user = tg.initDataUnsafe?.user;
const userId = user?.id;
const username = user?.username || user?.first_name || "user_" + userId;

// Суворий захист: якщо зайти не через бота, далі не пускаємо
if (!userId) {
    document.body.innerHTML = `
        <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
            <h3>⚠️ Доступ заборонено</h3>
            <p>Будь ласка, відкривайте цей застосунок через Telegram-бота за допомогою кнопки меню!</p>
        </div>
    `;
    throw new Error("Access denied: Not opened via Telegram bot");
}

// Поточний тиждень (ISO-подібний формат)
function getCurrentWeek() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
}

const week = getCurrentWeek();
let currentData = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAppData();

    // Кнопки
    const btnEdit = document.getElementById("btn-edit");
    const btnCabin = document.getElementById("btn-cabin");
    if (btnEdit) btnEdit.addEventListener("click", openEditModal);
    if (btnCabin) btnCabin.addEventListener("click", openCabinModal);

    // Закриття модалок
    document.getElementById("close-modal")?.addEventListener("click", () => {
        document.getElementById("edit-modal").style.display = "none";
        loadAppData();
    });
    document.getElementById("close-cabin")?.addEventListener("click", () => {
        document.getElementById("cabin-modal").style.display = "none";
    });

    // Додавання завдання
    document.getElementById("btn-add-task")?.addEventListener("click", addNewTask);
});

// Завантаження даних
function loadAppData() {
    const container = document.getElementById("table-container");
    if (!container) return;
    container.innerHTML = "<div class='loading'>Завантаження завдань...</div>";

    fetch(`${WEB_APP_URL}?action=getData&userId=${userId}&week=${week}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                currentData = data.tasks || [];
                renderTable(currentData);
            } else {
                container.innerHTML = `<p style="text-align:center; color:#ff4d6d;">Помилка: ${data.message || "невідома"}</p>`;
            }
        })
        .catch(err => {
            console.error("Load error:", err);
            container.innerHTML = "<p style='text-align:center; color:#ff4d6d;'>Помилка зв'язку з сервером.</p>";
        });
}

// Рендер таблиці
function renderTable(tasks) {
    const container = document.getElementById("table-container");
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = "<p style='text-align:center;'>Немає активних завдань. Натисніть ✏️, щоб додати перші.</p>";
        return;
    }

    let html = `<div class="table-scroll"><table class="tracker-table">
        <tr>
            <th style="width: 35px;">№</th>
            <th style="text-align: left; min-width: 140px;">Завдання на день</th>
            <th>Пн</th><th>Вт</th><th>Ср</th><th>Чт</th><th>Пт</th><th>Сб</th><th>Нд</th>
            <th>%</th>
        </tr>`;

    tasks.forEach((task, index) => {
        html += `<tr>
            <td style="text-align: center; color: var(--tg-theme-hint-color, #707579);">${index + 1}</td>
            <td class="task-name-cell">${task.task_name}</td>
            ${renderSelectCell(task.task_id, 'mon', task.days.mon)}
            ${renderSelectCell(task.task_id, 'tue', task.days.tue)}
            ${renderSelectCell(task.task_id, 'wed', task.days.wed)}
            ${renderSelectCell(task.task_id, 'thu', task.days.thu)}
            ${renderSelectCell(task.task_id, 'fri', task.days.fri)}
            ${renderSelectCell(task.task_id, 'sat', task.days.sat)}
            ${renderSelectCell(task.task_id, 'sun', task.days.sun)}
            <td class="progress-cell" id="progress-${task.task_id}"><b>${task.progress}</b></td>
        </tr>`;
    });

    html += `</table></div>`;
    container.innerHTML = html;

    document.querySelectorAll(".status-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const taskId = e.target.dataset.taskId;
            const day = e.target.dataset.day;
            const value = e.target.value;
            updateStatus(taskId, day, value);
        });
    });
}

function renderSelectCell(taskId, day, currentValue) {
    let valClass = "val-none";
    if (currentValue === "так") valClass = "val-yes";
    if (currentValue === "ні") valClass = "val-no";

    const options = [
        { val: "незаплановано", label: "-" },
        { val: "так", label: "так" },
        { val: "ні", label: "ні" }
    ];

    const optionsHtml = options.map(opt =>
        `<option value="${opt.val}" ${opt.val === currentValue ? "selected" : ""}>${opt.label}</option>`
    ).join("");

    return `<td><select class="status-select ${valClass}" data-task-id="${taskId}" data-day="${day}">${optionsHtml}</select></td>`;
}

function updateStatus(taskId, day, value) {
    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "updateTaskStatus",
            userId: userId,
            week: week,
            taskId: taskId,
            day: day,
            value: value
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success" && data.progress) {
            const cell = document.getElementById(`progress-${taskId}`);
            if (cell) cell.innerHTML = `<b>${data.progress}</b>`;
        }
    })
    .catch(err => console.error("Update error:", err));
}

// Меню «Олівчик»
function openEditModal() {
    const listContainer = document.getElementById("edit-list-container");
    if (!listContainer) return;

    let html = "";
    currentData.forEach(task => {
        html += `<div class="edit-task-item" data-task-id="${task.task_id}">
            <input type="text" value="${task.task_name}" id="input-${task.task_id}">
            <button class="btn-save-edit" onclick="saveTaskEdit('${task.task_id}')">Зберегти</button>
            <button class="btn-del-edit" onclick="deleteTaskItem('${task.task_id}')">Видалити</button>
        </div>`;
    });
    listContainer.innerHTML = html || "<p>Немає завдань для редагування.</p>";
    document.getElementById("edit-modal").style.display = "flex";
}

window.saveTaskEdit = function(taskId) {
    const newName = document.getElementById(`input-${taskId}`)?.value;
    if (!newName) return;

    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "editTask",
            userId: userId,
            week: week,
            taskId: taskId,
            newTaskName: newName
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            alert("Збережено!");
            loadAppData();
        } else {
            alert("Помилка: " + (data.message || ""));
        }
    });
};

window.deleteTaskItem = function(taskId) {
    if (!confirm("Видалити це завдання?")) return;

    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "deleteTask",
            userId: userId,
            week: week,
            taskId: taskId
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            openEditModal();
            loadAppData();
        }
    });
};

function addNewTask() {
    const input = document.getElementById("new-task-input");
    if (!input) return;

    const taskName = input.value.trim();
    if (!taskName) {
        alert("Введіть назву завдання!");
        return;
    }

    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "addTask",
            userId: userId,
            week: week,
            taskName: taskName
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            input.value = "";
            loadAppData();
            openEditModal();
        } else {
            alert("Помилка при додаванні: " + (data.message || ""));
        }
    })
    .catch(err => {
        console.error("Add task error:", err);
        alert("Помилка зв'язку з сервером.");
    });
}

// Меню «Домік»
function openCabinModal() {
    const info = document.getElementById("user-info-text");
    if (info) {
        info.innerHTML = `
            <b>Telegram ID:</b> ${userId}<br>
            <b>Username:</b> @${username}<br><br>
            <i>Тут згодом з'явиться додаткова статистика та налаштування кабінету.</i>
        `;
    }
    document.getElementById("cabin-modal").style.display = "flex";
}
