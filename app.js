const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.desktop-nav');

menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('nav-open', !open);
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('nav-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

const meals = [
  { title: 'Green goddess<br>power bowl', tag: 'LUNCH · HIGH PROTEIN', time: '20 min', calories: '520 kcal', protein: '32g protein', image: 'photo-1512621776951-a57141f2eefd' },
  { title: 'Roasted veggie<br>harvest bowl', tag: 'DINNER · PLANT POWER', time: '25 min', calories: '460 kcal', protein: '18g protein', image: 'photo-1547592180-85f173990554' },
  { title: 'Bright start<br>breakfast bowl', tag: 'BREAKFAST · BALANCED', time: '15 min', calories: '390 kcal', protein: '24g protein', image: 'photo-1490645935967-10de6ba17061' },
];
let mealIndex = 0;
const mealImage = document.querySelector('.dish-card.active img');
const mealTitle = document.querySelector('.dish-overlay h3');
const mealTag = document.querySelector('.dish-tag');
const mealMeta = document.querySelector('.dish-meta');
const slideCount = document.querySelector('.slide-count');

function showMeal(index) {
  mealIndex = (index + meals.length) % meals.length;
  const meal = meals[mealIndex];
  mealImage.src = `https://images.unsplash.com/${meal.image}?auto=format&fit=crop&w=900&q=85`;
  mealImage.alt = meal.title.replace('<br>', ' ');
  mealTitle.innerHTML = meal.title;
  mealTag.textContent = meal.tag;
  mealMeta.innerHTML = `<span>⏱ ${meal.time}</span><span>⚡ ${meal.calories}</span><span>↗ ${meal.protein}</span>`;
  slideCount.innerHTML = `0${mealIndex + 1} <i>/</i> 03`;
}

document.querySelector('.slide-button.prev')?.addEventListener('click', () => showMeal(mealIndex - 1));
document.querySelector('.slide-button.next')?.addEventListener('click', () => showMeal(mealIndex + 1));

const authModal = document.querySelector('#auth-modal');
const authPanel = document.querySelector('.auth-panel');
const authForm = document.querySelector('#register-form');
const authTitle = document.querySelector('#auth-title');
const authMessage = document.querySelector('#auth-message');
const passwordInput = authForm?.elements.password;
const nameInput = authForm?.elements.name;
const termsInput = authForm?.elements.terms;
let lastAuthTrigger = null;

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  authPanel?.classList.toggle('login-mode', isLogin);
  authTitle.innerHTML = isLogin ? 'Welcome<br><span>back.</span>' : 'Create your<br><span>good food era.</span>';
  document.querySelector('.auth-intro').textContent = isLogin
    ? 'Your meal plan is waiting for you.'
    : 'Your personal meal plan starts with a few details.';
  document.querySelector('.submit-label').textContent = isLogin ? 'Log in' : 'Create my account';
  document.querySelector('.auth-tabs [data-auth-tab="register"]').classList.toggle('is-active', !isLogin);
  document.querySelector('.auth-tabs [data-auth-tab="login"]').classList.toggle('is-active', isLogin);
  document.querySelector('.auth-tabs [data-auth-tab="register"]').setAttribute('aria-selected', String(!isLogin));
  document.querySelector('.auth-tabs [data-auth-tab="login"]').setAttribute('aria-selected', String(isLogin));
  nameInput.required = !isLogin;
  nameInput.disabled = isLogin;
  termsInput.required = !isLogin;
  termsInput.disabled = isLogin;
  passwordInput.minLength = isLogin ? 1 : 8;
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  passwordInput.placeholder = isLogin ? 'Your password' : 'Create a password';
  authMessage.classList.remove('is-error');
  authMessage.textContent = isLogin
    ? 'Sign-in is a form preview. No account is checked or password saved.'
    : 'This is a form preview. No account will be created or password saved.';
}

function openAuth(mode, trigger) {
  if (!authModal) return;
  lastAuthTrigger = trigger;
  authModal.hidden = false;
  document.body.classList.add('auth-opened');
  setAuthMode(mode);
  authForm.elements[mode === 'login' ? 'email' : 'name'].focus();
}

function closeAuth() {
  if (!authModal) return;
  authModal.hidden = true;
  document.body.classList.remove('auth-opened');
  authForm.reset();
  setAuthMode('register');
  lastAuthTrigger?.focus();
}

document.querySelectorAll('.auth-open, [data-auth-mode]').forEach((button) => {
  button.addEventListener('click', () => openAuth(button.dataset.authMode || 'register', button));
});
document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authTab));
});
document.querySelector('.auth-close')?.addEventListener('click', closeAuth);
authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuth();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && authModal && !authModal.hidden) closeAuth();
});
document.querySelector('.password-toggle')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  const visible = passwordInput.type === 'text';
  passwordInput.type = visible ? 'password' : 'text';
  button.textContent = visible ? 'Show' : 'Hide';
  button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
});
authForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!authForm.reportValidity()) return;
  authMessage.classList.remove('is-error');
  authMessage.textContent = authPanel.classList.contains('login-mode')
    ? 'Sign-in is not connected yet. No account was checked.'
    : 'Registration is not connected yet. No account was created and no details were saved.';
});
