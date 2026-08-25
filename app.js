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

let currentData = [];

document.addEventListener("DOMContentLoaded", () => {
    // Завантажуємо таблицю для цього реального юзера
    loadAppData();

    // Кнопки управління
    document.getElementById("btn-edit").addEventListener("click", openEditModal);
    document.getElementById("btn-cabin").addEventListener("click", openCabinModal);

    // Закриття модалок
    document.getElementById("close-modal").addEventListener("click", () => {
        document.getElementById("edit-modal").style.display = "none";
        loadAppData(); 
    });
    document.getElementById("close-cabin").addEventListener("click", () => {
        document.getElementById("cabin-modal").style.display = "none";
    });

    // Додавання завдання
    document.getElementById("btn-add-task").addEventListener("click", addNewTask);
});

// Завантаження даних із таблиці
function loadAppData() {
    document.getElementById("loading").style.display = "block";
    document.getElementById("table-container").style.display = "none";

    fetch(`${WEB_APP_URL}?action=getData&userId=${userId}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                currentData = data.tasks;
                renderTable(currentData);
            } else {
                alert("Помилка завантаження: " + data.message);
            }
            document.getElementById("loading").style.display = "none";
            document.getElementById("table-container").style.display = "block";
        })
        .catch(err => {
            console.error("Fetch error:", err);
            document.getElementById("loading").innerText = "Помилка зв'язку з сервером таблиці.";
        });
}

// Рендер таблиці тижня
function renderTable(tasks) {
    const container = document.getElementById("table-container");
    if (tasks.length === 0) {
        container.innerHTML = "<p style='text-align:center;'>Немає активних завдань. Натисніть ✏️ праворуч зверху, щоб додати перші.</p>";
        return;
    }

    let html = `<div class="table-scroll"><table class="tracker-table">
        <tr>
            <th>Завдання</th>
            <th>Пн</th><th>Вт</th><th>Ср</th><th>Чт</th><th>Пт</th><th>Сб</th><th>Нд</th>
            <th>%</th>
        </tr>`;

    tasks.forEach(task => {
        html += `<tr>
            <td class="task-name-cell">${task.task_name}</td>
            ${renderSelectCell(task.task_id, 'mon', task.days.mon)}
            ${renderSelectCell(task.task_id, 'tue', task.days.tue)}
            ${renderSelectCell(task.task_id, 'wed', task.days.wed)}
            ${renderSelectCell(task.task_id, 'thu', task.days.thu)}
            ${renderSelectCell(task.task_id, 'fri', task.days.fri)}
            ${renderSelectCell(task.task_id, 'sat', task.days.sat)}
            ${renderSelectCell(task.task_id, 'sun', task.days.sun)}
            <td id="progress-${task.task_id}"><b>${task.progress}</b></td>
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
    const options = ["незаплановано", "так", "ні"];
    let optionsHtml = options.map(opt => 
        `<option value="${opt}" ${opt === currentValue ? "selected" : ""}>${opt}</option>`
    ).join("");

    return `<td><select class="status-select" data-task-id="${taskId}" data-day="${day}">${optionsHtml}</select></td>`;
}

function updateStatus(taskId, day, value) {
    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "updateTaskStatus",
            userId: userId,
            taskId: taskId,
            day: day,
            value: value
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success" && data.progress) {
            // Чітко знаходимо комірку за її унікальним ID і оновлюємо відсоток на льоту!
            const cell = document.getElementById(`progress-${taskId}`);
            if (cell) {
                cell.innerHTML = `<b>${data.progress}</b>`;
            }
        }
    })
    .catch(err => console.error("Update error:", err));
}

// Меню «Олівчик» (Редагування та додавання)
function openEditModal() {
    const listContainer = document.getElementById("editable-tasks-list");
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
    const newName = document.getElementById(`input-${taskId}`).value;
    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "editTask",
            userId: userId,
            taskId: taskId,
            newTaskName: newName
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") alert("Збережено!");
    });
};

window.deleteTaskItem = function(taskId) {
    if (!confirm("Видалити це завдання?")) return;
    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "deleteTask",
            userId: userId,
            taskId: taskId
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") openEditModal();
    });
};

function addNewTask() {
    const input = document.getElementById("new-task-input");
    if (!input) {
        console.error("Поле вводу #new-task-input не знайдено!");
        return;
    }
    
    const taskName = input.value.trim();
    if (!taskName) {
        alert("Введіть назву завдання!");
        return;
    }

    console.log("Додавання завдання:", taskName);

    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "addTask",
            userId: userId,
            taskName: taskName
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Відповідь сервера:", data);
        if (data.status === "success") {
            input.value = ""; // Очищаємо поле
            
            // Зберігаємо поточні дані в пам'яті (щоб не робити зайвий запит) 
            // або одразу завантажуємо оновлені дані з сервера перед оновленням модалки
            fetch(`${WEB_APP_URL}?action=getData&userId=${userId}`)
                .then(r => r.json())
                .then(d => {
                    if (d.status === "success") {
                        currentData = d.tasks;
                        renderTable(currentData); // Оновлюємо фонову таблицю
                        openEditModal();          // Перевідкриваємо модалку, щоб нове завдання з'явилося в списку
                    }
                });
        } else {
            alert("Помилка при додаванні: " + data.message);
        }
    })
    .catch(err => {
        console.error("Add task fetch error:", err);
        alert("Помилка зв'язку з сервером.");
    });
}

// Меню «Домік» (Кабінет)
function openCabinModal() {
    document.getElementById("user-info-text").innerHTML = `
        <b>Telegram ID:</b> ${userId}<br>
        <b>Username:</b> @${username}<br><br>
        <i>Тут згодом з'явиться додаткова статистика та налаштування кабінету.</i>
    `;
    document.getElementById("cabin-modal").style.display = "flex";
}
