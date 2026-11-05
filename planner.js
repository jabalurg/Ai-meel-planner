const ACCOUNTS_KEY = 'mealmate.localAccounts.v1';
const SESSION_KEY = 'mealmate.localSession.v1';
const PROFILE_PREFIX = 'mealmate.profile.v1.';
const CALENDAR_PREFIX = 'mealmate.mealCalendar.v1.';
const form = document.querySelector('#profile-form');
const calorieValue = document.querySelector('#calorie-value');
const message = document.querySelector('#planner-message');
const submitButton = document.querySelector('.planner-submit');
const planResult = document.querySelector('#plan-result');
const planContent = document.querySelector('#plan-content');

let accountId = null;
try {
  accountId = localStorage.getItem(SESSION_KEY);
  const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  if (!accountId || !accounts.some((account) => account.id === accountId)) throw new Error('no session');
} catch {
  window.location.replace('index.html');
}

if (accountId) {
  document.querySelector('#welcome-name').textContent = accountId;
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_PREFIX + encodeURIComponent(accountId)) || 'null');
    if (saved) {
      for (const [name, value] of Object.entries(saved)) {
        const field = form.elements.namedItem(name);
        if (!field) continue;
        if (field instanceof RadioNodeList) {
          const choice = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
          if (choice) choice.checked = true;
        } else if (typeof value === 'string' || typeof value === 'number') field.value = value;
      }
    }
  } catch { /* Ignore malformed saved profile. */ }
}

const calendarKey = CALENDAR_PREFIX + encodeURIComponent(accountId || 'guest');
let selectedDate = new Date();
let displayedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readCalendar() {
  try {
    const entries = JSON.parse(localStorage.getItem(calendarKey) || '{}');
    return entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
  } catch { return {}; }
}

function saveCalendar(entries) {
  try { localStorage.setItem(calendarKey, JSON.stringify(entries)); return true; }
  catch { return false; }
}

function renderSelectedDay() {
  const key = dateKey(selectedDate);
  const entry = readCalendar()[key] || {};
  document.querySelector('#calendar-selected-date').textContent = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.querySelector('#calendar-plan').textContent = entry.plan ? `Меню MealMate:\n${entry.plan}` : 'Для этого дня пока нет меню MealMate. Составьте меню выше или добавьте свои блюда в записи.';
  document.querySelector('#meal-notes').value = entry.notes || '';
  document.querySelector('#calendar-message').textContent = '';
}

function renderCalendar() {
  const monthLabel = displayedMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  document.querySelector('#calendar-month').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const daysContainer = document.querySelector('#calendar-days');
  daysContainer.replaceChildren();
  const firstWeekday = (displayedMonth.getDay() + 6) % 7;
  for (let index = 0; index < firstWeekday; index += 1) {
    const blank = document.createElement('span');
    blank.className = 'calendar-blank';
    blank.setAttribute('aria-hidden', 'true');
    daysContainer.append(blank);
  }
  const count = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const today = dateKey(new Date());
  const entries = readCalendar();
  for (let day = 1; day <= count; day += 1) {
    const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
    const key = dateKey(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = String(day);
    button.dataset.date = key;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }));
    button.setAttribute('aria-pressed', String(key === dateKey(selectedDate)));
    if (key === today) button.classList.add('is-today');
    if (key === dateKey(selectedDate)) button.classList.add('is-selected');
    if (entries[key]?.plan || entries[key]?.notes) button.classList.add('has-entry');
    button.addEventListener('click', () => {
      selectedDate = date;
      renderCalendar();
      renderSelectedDay();
    });
    daysContainer.append(button);
  }
}

function moveCalendarMonth(direction) {
  const wantedDay = selectedDate.getDate();
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + direction, 1);
  const lastDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  selectedDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), Math.min(wantedDay, lastDay));
  renderCalendar();
  renderSelectedDay();
}

document.querySelector('#calendar-prev').addEventListener('click', () => moveCalendarMonth(-1));
document.querySelector('#calendar-next').addEventListener('click', () => moveCalendarMonth(1));
document.querySelector('#save-meal-notes').addEventListener('click', () => {
  const entries = readCalendar();
  const key = dateKey(selectedDate);
  entries[key] = { ...(entries[key] || {}), notes: document.querySelector('#meal-notes').value.trim() };
  if (saveCalendar(entries)) {
    document.querySelector('#calendar-message').textContent = 'Записи сохранены для выбранной даты.';
    renderCalendar();
  } else document.querySelector('#calendar-message').textContent = 'Не удалось сохранить записи. Проверьте настройки хранилища браузера.';
});

renderCalendar();
renderSelectedDay();

function estimateCalories() {
  const data = new FormData(form);
  const age = Number(data.get('age'));
  const height = Number(data.get('height'));
  const weight = Number(data.get('weight'));
  if (!age || !height || !weight) { calorieValue.textContent = '—'; return null; }
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + (data.get('sex') === 'male' ? 5 : -161);
  const activity = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[data.get('activity')];
  const goal = { lose: -300, maintain: 0, gain: 200 }[data.get('goal')];
  const calories = Math.max(1200, Math.round((bmr * activity + goal) / 50) * 50);
  calorieValue.textContent = calories.toLocaleString('ru-RU');
  return calories;
}

function saveProfile() {
  const data = Object.fromEntries(new FormData(form).entries());
  try { localStorage.setItem(PROFILE_PREFIX + encodeURIComponent(accountId), JSON.stringify(data)); } catch { /* Profile still works for this visit. */ }
}

form.addEventListener('input', estimateCalories);
form.addEventListener('change', estimateCalories);
estimateCalories();

document.querySelector('#logout-button').addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.replace('index.html');
});

document.querySelector('#edit-profile').addEventListener('click', () => {
  planResult.hidden = true;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const calories = estimateCalories();
  if (!calories) return;
  const data = Object.fromEntries(new FormData(form).entries());
  saveProfile();
  submitButton.disabled = true;
  document.querySelector('#generate-label').textContent = 'Собираем меню…';
  message.textContent = 'Подбираем блюда по вашим параметрам…';
  message.classList.remove('is-error');
  try {
    const response = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, calories }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Сервер меню не найден: открыта статическая страница или запущена старая версия. Откройте сайт по ссылке вашего туннеля и запустите start-with-ai.ps1.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось составить меню.');
    planContent.textContent = result.plan;
    const calendarEntries = readCalendar();
    const planDateKey = dateKey(selectedDate);
    calendarEntries[planDateKey] = { ...(calendarEntries[planDateKey] || {}), plan: result.plan };
    const calendarSaved = saveCalendar(calendarEntries);
    renderCalendar();
    renderSelectedDay();
    document.querySelector('#plan-result .eyebrow').textContent = result.mode === 'local'
      ? 'ЛОКАЛЬНОЕ МЕНЮ · БЕЗ ИИ'
      : `МЕНЮ СОСТАВЛЕНО · ${(result.provider || 'AI').toUpperCase()}`;
    planResult.hidden = false;
    document.querySelector('.planner-steps span:nth-of-type(2)').classList.add('step-active');
    planResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    message.textContent = [result.notice, calendarSaved ? 'Меню сохранено в календаре.' : 'Не удалось сохранить меню в календаре браузера.'].filter(Boolean).join(' ');
    message.classList.toggle('is-error', false);
  } catch (error) {
    message.textContent = error.message || 'Не удалось связаться с сервером.';
    message.classList.add('is-error');
  } finally {
    submitButton.disabled = false;
    document.querySelector('#generate-label').textContent = 'Составить меню';
  }
});
