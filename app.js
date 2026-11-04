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
const accountIdInput = authForm?.elements.accountId;
const ACCOUNTS_KEY = 'mealmate.localAccounts.v1';
const SESSION_KEY = 'mealmate.localSession.v1';
const HASH_ITERATIONS = 600000;
const HASH_LENGTH = 256;
let lastAuthTrigger = null;

function readAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password, salt, iterations = HASH_ITERATIONS) {
  const passwordKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    passwordKey,
    HASH_LENGTH,
  );
  return new Uint8Array(hash);
}

function hashesMatch(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

function setAuthNotice(message, type = 'info') {
  authMessage.textContent = message;
  authMessage.classList.toggle('is-error', type === 'error');
  authMessage.classList.toggle('is-success', type === 'success');
}

function updateAuthNavigation(accountId) {
  const loginButton = document.querySelector('.nav-actions [data-auth-mode="login"], .nav-actions [data-auth-mode="logout"]');
  const registerButton = document.querySelector('.nav-actions [data-auth-mode="register"]');
  if (!loginButton || !registerButton) return;
  loginButton.textContent = accountId ? 'Log out' : 'Log in';
  loginButton.dataset.authMode = accountId ? 'logout' : 'login';
  registerButton.hidden = Boolean(accountId);
}

function normalizeAccountId(value) {
  return value.trim().toLowerCase();
}

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  authPanel?.classList.toggle('login-mode', isLogin);
  authTitle.innerHTML = isLogin ? 'Welcome<br><span>back.</span>' : 'Create your<br><span>good food era.</span>';
  document.querySelector('.auth-intro').textContent = isLogin
    ? 'Enter your account ID and password.'
    : 'Choose an account ID and password to get started.';
  document.querySelector('.submit-label').textContent = isLogin ? 'Log in' : 'Create my account';
  document.querySelector('.auth-tabs [data-auth-tab="register"]').classList.toggle('is-active', !isLogin);
  document.querySelector('.auth-tabs [data-auth-tab="login"]').classList.toggle('is-active', isLogin);
  document.querySelector('.auth-tabs [data-auth-tab="register"]').setAttribute('aria-selected', String(!isLogin));
  document.querySelector('.auth-tabs [data-auth-tab="login"]').setAttribute('aria-selected', String(isLogin));
  accountIdInput.placeholder = isLogin ? 'Your account ID' : 'Choose an ID';
  passwordInput.minLength = isLogin ? 1 : 8;
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  passwordInput.placeholder = isLogin ? 'Your password' : 'Create a password';
  document.querySelector('.field-hint').hidden = isLogin;
  authMessage.classList.remove('is-error', 'is-success');
  setAuthNotice('Accounts are stored only in this browser. No email code is used.');
}

function openAuth(mode, trigger) {
  if (!authModal) return;
  lastAuthTrigger = trigger;
  authModal.hidden = false;
  document.body.classList.add('auth-opened');
  setAuthMode(mode);
  accountIdInput.focus();
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
  button.addEventListener('click', () => {
    if (button.dataset.authMode === 'logout') {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = 'index.html';
      return;
    }
    openAuth(button.dataset.authMode || 'register', button);
  });
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
  if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
    setAuthNotice('Password security is unavailable here. Open the page through HTTPS or localhost and try again.', 'error');
    return;
  }

  const submitButton = authForm.querySelector('.auth-submit');
  const submitLabel = authForm.querySelector('.submit-label');
  const previousLabel = submitLabel.textContent;
  const isLogin = authPanel.classList.contains('login-mode');
  submitButton.disabled = true;
  submitLabel.textContent = isLogin ? 'Logging in…' : 'Creating account…';

  (async () => {
    try {
      const accountId = normalizeAccountId(accountIdInput.value);
      const password = passwordInput.value;
      const accounts = readAccounts();

      if (isLogin) {
        const account = accounts.find((entry) => entry.id === accountId);
        if (!account) throw new Error('Account ID or password is incorrect.');
        const passwordHash = await derivePasswordHash(password, base64ToBytes(account.salt), account.iterations);
        if (!hashesMatch(passwordHash, base64ToBytes(account.hash))) {
          throw new Error('Account ID or password is incorrect.');
        }
        localStorage.setItem(SESSION_KEY, account.id);
        updateAuthNavigation(account.id);
        passwordInput.value = '';
        window.location.href = 'planner.html';
        return;
      }

      if (accounts.some((entry) => entry.id === accountId)) {
        throw new Error('That account ID is already in use. Try logging in instead.');
      }
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const passwordHash = await derivePasswordHash(password, salt);
      const account = {
        id: accountId,
        salt: bytesToBase64(salt),
        hash: bytesToBase64(passwordHash),
        iterations: HASH_ITERATIONS,
      };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
      localStorage.setItem(SESSION_KEY, accountId);
      updateAuthNavigation(accountId);
      authForm.reset();
      window.location.href = 'planner.html';
    } catch (error) {
      setAuthNotice(error.message || 'Could not access browser storage. Check your browser settings and try again.', 'error');
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = previousLabel;
    }
  })();
});

try {
  const savedAccountId = localStorage.getItem(SESSION_KEY);
  if (savedAccountId && readAccounts().some((account) => account.id === savedAccountId)) {
    updateAuthNavigation(savedAccountId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
} catch {
  // If browser storage is blocked, the form will report the issue on submit.
}

