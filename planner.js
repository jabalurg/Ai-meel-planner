const ACCOUNTS_KEY = 'mealmate.localAccounts.v1';
const SESSION_KEY = 'mealmate.localSession.v1';
const PROFILE_PREFIX = 'mealmate.profile.v1.';
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
  document.querySelector('#generate-label').textContent = 'Готовим меню…';
  message.textContent = 'Отправляем параметры в OpenAI и составляем меню. Обычно это занимает несколько секунд.';
  message.classList.remove('is-error');
  try {
    const response = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, calories }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось составить меню.');
    planContent.textContent = result.plan;
    planResult.hidden = false;
    document.querySelector('.planner-steps span:nth-of-type(2)').classList.add('step-active');
    planResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    message.textContent = '';
  } catch (error) {
    message.textContent = error.message || 'Не удалось связаться с сервером.';
    message.classList.add('is-error');
  } finally {
    submitButton.disabled = false;
    document.querySelector('#generate-label').textContent = 'Составить меню с ИИ';
  }
});
