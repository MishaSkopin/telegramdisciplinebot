
const tg = window.Telegram.WebApp;
tg.expand();

// Безпечно перевіряємо, чи існує такий метод взагалі
if (typeof tg.disableVerticalSwipes === 'function') {
    tg.disableVerticalSwipes();
}

tg.ready();

// ЗАМІНИ НА СВІЙ URL
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw5EIAiQZcFTDtKEvzX7LMwdv-x4F4NshkGKiIIexDUN-r_FCwvfq3zkqvD_HmuQJJq/exec";

const user = tg.initDataUnsafe?.user;
const userId = user?.id;
const username = user?.username || user?.first_name || ("user_" + userId);

if (!userId) {
  document.body.innerHTML = `
    <div style="text-align:center;margin-top:50px;font-family:sans-serif;">
      <h3>⚠️ Доступ заборонено</h3>
      <p>Відкривайте застосунок через Telegram-бота!</p>
    </div>`;
  throw new Error("Access denied");
}

function getCurrentWeek() {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

const weekNow = getCurrentWeek();   // справжній поточний тиждень (не міняється)
let selectedWeek = weekNow;         // який тиждень зараз дивимось
let currentData = [];
let currentBonuses = 0;
let currentMandatory = null;
let availableWeeks = [];

document.addEventListener("DOMContentLoaded", () => {
  loadAppData();

  document.getElementById("btn-edit")?.addEventListener("click", openEditModal);
  document.getElementById("btn-cabin")?.addEventListener("click", openCabinModal);

  document.getElementById("close-modal")?.addEventListener("click", () => {
    document.getElementById("edit-modal").style.display = "none";
    loadAppData();
  });

  document.getElementById("close-cabin")?.addEventListener("click", () => {
    document.getElementById("cabin-modal").style.display = "none";
  });

  document.getElementById("btn-add-task")?.addEventListener("click", addNewTask);

  // Навігація по тижнях
  document.getElementById("btn-prev-week")?.addEventListener("click", goPrevWeek);
  document.getElementById("btn-next-week")?.addEventListener("click", goNextWeek);
});

// ====================== ЗАВАНТАЖЕННЯ ======================
function loadAppData() {
  const container = document.getElementById("table-container");
  if (!container) return;
  container.innerHTML = "<div class='loading'>Завантаження завдань...</div>";

  // Редагувати / додавати можна тільки на поточному тижні
  const isCurrent = selectedWeek === weekNow;
  const btnEdit = document.getElementById("btn-edit");
  if (btnEdit) btnEdit.style.display = isCurrent ? "inline-flex" : "none";

  fetch(`${WEB_APP_URL}?action=getData&userId=${userId}&week=${selectedWeek}&username=${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        currentData = data.tasks || [];
        currentBonuses = data.bonuses || 0;
        currentMandatory = data.mandatory || null;
        availableWeeks = data.availableWeeks || [];
        selectedWeek = data.week || selectedWeek;

        // Заголовок з датами
        const range = data.dateRange;
        const titleEl = document.getElementById("week-title");
        if (titleEl && range) {
          titleEl.textContent = range.start + " – " + range.end;
        }

        updateNavButtons();
        renderTable(currentData);
      } else {
        container.innerHTML = `<p style="text-align:center;color:#ff4d6d;">Помилка: ${data.message || "невідома"}</p>`;
      }
    })
    .catch(err => {
      console.error(err);
      container.innerHTML = "<p style='text-align:center;color:#ff4d6d;'>Помилка зв'язку з сервером.</p>";
    });
}

// ====================== РЕНДЕР ТАБЛИЦІ ======================
function renderTable(tasks) {
  const container = document.getElementById("table-container");
  if (!container) return;

  if (!tasks || tasks.length === 0) {
    container.innerHTML = "<p style='text-align:center;'>Немає завдань. Натисніть ✏️, щоб додати.</p>";
    return;
  }

  let html = `<div class="table-scroll"><table class="tracker-table">
    <tr>
      <th style="width:35px;">№</th>
      <th style="text-align:left;min-width:140px;">Завдання</th>
      <th>Пн</th><th>Вт</th><th>Ср</th><th>Чт</th><th>Пт</th><th>Сб</th><th>Нд</th>
      <th>%</th>
    </tr>`;

  tasks.forEach((task, index) => {
    html += `<tr>
      <td style="text-align:center;color:var(--tg-theme-hint-color,#707579);">${index + 1}</td>
      <td class="task-name-cell">${task.task_name}${task.is_mandatory_today ? ' <span class="mandatory-badge">★</span>' : ''}</td>
      ${renderSelectCell(task, 'mon')}
      ${renderSelectCell(task, 'tue')}
      ${renderSelectCell(task, 'wed')}
      ${renderSelectCell(task, 'thu')}
      ${renderSelectCell(task, 'fri')}
      ${renderSelectCell(task, 'sat')}
      ${renderSelectCell(task, 'sun')}
      <td class="progress-cell" id="progress-${task.task_id}"><b>${task.progress}</b></td>
    </tr>`;
  });

  html += `</table></div>`;
  container.innerHTML = html;

  // Обробники зміни
  document.querySelectorAll(".status-select").forEach(select => {
    select.addEventListener("change", onStatusChange);
  });
}

function renderSelectCell(task, day) {
  const currentValue = task.days[day] || "незаплановано";
  const isWeekday = ["mon", "tue", "wed", "thu", "fri"].includes(day);
  const canUseStar = currentBonuses >= 5 && isWeekday;

  // Класи
  let valClass = "val-none";
  if (currentValue === "так") valClass = "val-yes";
  if (currentValue === "ні") valClass = "val-no";
  if (currentValue === "*") valClass = "val-star";

  // Голуба обводка якщо це обов'язкове і виконане
  let mandatoryClass = "";
  if (task.is_mandatory_today && task.mandatory_day === day && task.mandatory_completed) {
    mandatoryClass = " mandatory-done";
  }

  const options = [
    { val: "незаплановано", label: "-" },
    { val: "так", label: "так" },
    { val: "ні", label: "ні" }
  ];

  if (canUseStar || currentValue === "*") {
    options.push({ val: "*", label: "*" });
  }

  const optionsHtml = options.map(opt =>
    `<option value="${opt.val}" ${opt.val === currentValue ? "selected" : ""}>${opt.label}</option>`
  ).join("");

  return `<td>
    <select class="status-select ${valClass}${mandatoryClass}"
            data-task-id="${task.task_id}"
            data-day="${day}">
      ${optionsHtml}
    </select>
  </td>`;
}

// ====================== ЗМІНА СТАТУСУ (з миттєвим кольором) ======================
function onStatusChange(e) {
  // Блокуємо зміни не на поточному тижні
  if (selectedWeek !== weekNow) {
    alert("Редагувати можна лише поточний тиждень");
    loadAppData(); // повертаємо старе значення
    return;
  }

  const select = e.target;
  const taskId = select.dataset.taskId;
  const day = select.dataset.day;
  const value = select.value;

  // Миттєво оновлюємо колір
  select.classList.remove("val-none", "val-yes", "val-no", "val-star");
  if (value === "так") select.classList.add("val-yes");
  else if (value === "ні") select.classList.add("val-no");
  else if (value === "*") select.classList.add("val-star");
  else select.classList.add("val-none");

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateTaskStatus",
      userId: userId,
      week: selectedWeek,          // ← було week
      taskId: taskId,
      day: day,
      value: value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      if (data.progress) {
        const cell = document.getElementById(`progress-${taskId}`);
        if (cell) cell.innerHTML = `<b>${data.progress}</b>`;
      }
      if (typeof data.bonuses === "number") {
        currentBonuses = data.bonuses;
      }
      if (data.mandatoryCompleted) {
        select.classList.add("mandatory-done");
      }
    } else {
      alert(data.message || "Помилка");
      loadAppData();
    }
  })
  .catch(err => {
    console.error(err);
    alert("Помилка зв'язку");
  });
}

// ====================== РЕДАГУВАННЯ ======================
function openEditModal() {
  const listContainer = document.getElementById("edit-list-container");
  if (!listContainer) return;

  let html = "";
  currentData.forEach((task, index) => {
    const isFirst = index === 0;
    const isLast = index === currentData.length - 1;

    html += `<div class="edit-task-item">
      <div class="move-btns">
        <button class="btn-move" onclick="moveTaskItem('${task.task_id}', 'up')" ${isFirst ? "disabled" : ""} title="Вгору">↑</button>
        <button class="btn-move" onclick="moveTaskItem('${task.task_id}', 'down')" ${isLast ? "disabled" : ""} title="Вниз">↓</button>
      </div>
      <input type="text" value="${task.task_name}" id="input-${task.task_id}">
      <button class="btn-save-edit" onclick="saveTaskEdit('${task.task_id}')">Зберегти</button>
      <button class="btn-del-edit" onclick="deleteTaskItem('${task.task_id}')">Видалити</button>
    </div>`;
  });
  listContainer.innerHTML = html || "<p>Немає завдань.</p>";
  document.getElementById("edit-modal").style.display = "flex";
}

window.saveTaskEdit = function(taskId) {
  if (selectedWeek !== weekNow) {
    alert("Редагувати можна лише поточний тиждень");
    return;
  }

  const newName = document.getElementById(`input-${taskId}`)?.value?.trim();
  if (!newName) return;

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "editTask",
      userId: userId,
      week: selectedWeek,          // ← було week
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
      alert(data.message || "Помилка");
    }
  });
};

window.deleteTaskItem = function(taskId) {
  if (selectedWeek !== weekNow) {
    alert("Редагувати можна лише поточний тиждень");
    return;
  }

  if (!confirm("Видалити це завдання?")) return;

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteTask",
      userId: userId,
      week: selectedWeek,          // ← було week
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
window.moveTaskItem = function(taskId, direction) {
  if (selectedWeek !== weekNow) {
    alert("Редагувати можна лише поточний тиждень");
    return;
  }

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "moveTask",
      userId: userId,
      week: selectedWeek,
      taskId: taskId,
      direction: direction   // "up" або "down"
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      loadAppData();          // оновлюємо таблицю
      // трохи зачекаємо, щоб currentData оновився, і знову відкриємо модалку
      setTimeout(() => openEditModal(), 300);
    } else {
      alert(data.message || "Помилка");
    }
  })
  .catch(() => alert("Помилка зв'язку"));
};
function addNewTask() {
  if (selectedWeek !== weekNow) {
    alert("Редагувати можна лише поточний тиждень");
    return;
  }

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
      week: selectedWeek,          // ← було week
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
      alert(data.message || "Помилка");
    }
  })
  .catch(() => alert("Помилка зв'язку"));
  }

// ====================== КАБІНЕТ ======================
function openCabinModal() {
  const info = document.getElementById("user-info-text");
  if (!info) return;

  let mandatoryText = "Сьогодні ще не призначено";
  if (currentMandatory) {
    mandatoryText = currentMandatory.completed
      ? `✅ ${currentMandatory.taskName} <span style="color:#8e8e93;">(виконано)</span>`
      : `📌 ${currentMandatory.taskName}`;
  }

  info.innerHTML = `
    <div class="cabin-row"><b>Telegram ID:</b> ${userId}</div>
    <div class="cabin-row"><b>Username:</b> @${username}</div>
    <div class="cabin-row"><b>Бонуси:</b> <span class="bonus-count">${currentBonuses}</span> ⭐</div>
    <hr style="margin:14px 0;border:none;border-top:1px solid #333;">
    <div class="cabin-row"><b>Обов'язкове завдання на сьогодні:</b></div>
    <div class="mandatory-box">${mandatoryText}</div>
    <p style="margin-top:12px;font-size:13px;color:var(--tg-theme-hint-color,#8e8e93);">
      За виконання обов'язкового завдання — +1 бонус.<br>
      5 бонусів = можливість взяти «*» (відпочинок) у будні.
    </p>
  `;

  document.getElementById("cabin-modal").style.display = "flex";
}
function updateNavButtons() {
  const btnPrev = document.getElementById("btn-prev-week");
  const btnNext = document.getElementById("btn-next-week");
  if (!btnPrev || !btnNext) return;

  const idx = availableWeeks.indexOf(selectedWeek);

  // Назад — тільки якщо є старіший тиждень з даними
  btnPrev.disabled = (idx <= 0);

  // Вперед — тільки якщо не на поточному тижні і є новіший
  const isCurrent = selectedWeek === weekNow;
  btnNext.disabled = isCurrent || idx === -1 || idx >= availableWeeks.length - 1;
}

function goPrevWeek() {
  const idx = availableWeeks.indexOf(selectedWeek);
  if (idx > 0) {
    selectedWeek = availableWeeks[idx - 1];
    loadAppData();
  }
}

function goNextWeek() {
  const idx = availableWeeks.indexOf(selectedWeek);
  if (idx >= 0 && idx < availableWeeks.length - 1) {
    const next = availableWeeks[idx + 1];
    // Не даємо йти далі поточного
    if (next <= weekNow || availableWeeks.indexOf(weekNow) >= 0) {
      selectedWeek = next;
      // додаткова перевірка
      if (compareWeeks(selectedWeek, weekNow) > 0) {
        selectedWeek = weekNow;
      }
      loadAppData();
    }
  } else if (selectedWeek !== weekNow) {
    // якщо поточного ще немає в списку — переходимо на нього
    selectedWeek = weekNow;
    loadAppData();
  }
}
// Порівняння тижнів "2026-W35"
function compareWeeks(a, b) {
  const pa = a.split("-W");
  const pb = b.split("-W");
  const ya = parseInt(pa[0], 10), wa = parseInt(pa[1], 10);
  const yb = parseInt(pb[0], 10), wb = parseInt(pb[1], 10);
  if (ya !== yb) return ya - yb;
  return wa - wb;
}
