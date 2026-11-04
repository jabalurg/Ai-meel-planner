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
const authConfig = window.MEALMATE_AUTH || {};
let authClient = null;
let authConfigError = '';
if (window.supabase && authConfig.supabaseUrl && authConfig.publishableKey) {
  try {
    authClient = window.supabase.createClient(authConfig.supabaseUrl, authConfig.publishableKey);
  } catch {
    authConfigError = 'The Supabase settings in auth-config.js are invalid. Check the Project URL and Publishable key.';
  }
} else if (!window.supabase) {
  authConfigError = 'The Supabase client did not load. Check your internet connection and reload the page.';
}
const authNavLogin = document.querySelector('#auth-nav-login');
const authNavRegister = document.querySelector('#auth-nav-register');
let authSession = null;
let lastAuthTrigger = null;

function setAuthNotice(message, type = 'info') {
  authMessage.textContent = message;
  authMessage.classList.toggle('is-error', type === 'error');
  authMessage.classList.toggle('is-success', type === 'success');
}

function updateAuthNavigation(session) {
  authSession = session;
  const signedIn = Boolean(session?.user);
  authNavLogin.textContent = signedIn ? 'Log out' : 'Log in';
  authNavLogin.dataset.authMode = signedIn ? 'logout' : 'login';
  authNavRegister.hidden = signedIn;
}

function getAuthErrorMessage(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Try logging in.';
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return 'Email confirmation is still enabled in Supabase. Turn it off to allow password-only registration.';
  return message;
}

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
  passwordInput.minLength = isLogin ? 1 : 8;
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  passwordInput.placeholder = isLogin ? 'Your password' : 'Create a password';
  authMessage.classList.remove('is-error', 'is-success');
  setAuthNotice(authClient
    ? (isLogin ? 'Log in with the email and password you registered with.' : 'Register with email and password. No email code is required when Confirm Email is disabled in Supabase.')
    : authConfigError || 'Add your Supabase Project URL and Publishable key to auth-config.js to enable accounts.');
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
  button.addEventListener('click', async () => {
    if (button.dataset.authMode === 'logout' && authClient) {
      try {
        const { error } = await authClient.auth.signOut();
        if (error) setAuthNotice(getAuthErrorMessage(error), 'error');
        else updateAuthNavigation(null);
      } catch (error) {
        setAuthNotice(getAuthErrorMessage(error), 'error');
      }
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
  if (!authClient) {
    setAuthNotice('Account service is not configured yet. Add the Supabase Project URL and Publishable key first.', 'error');
    return;
  }

  const submitButton = authForm.querySelector('.auth-submit');
  const submitLabel = authForm.querySelector('.submit-label');
  const previousLabel = submitLabel.textContent;
  submitButton.disabled = true;
  submitLabel.textContent = authPanel.classList.contains('login-mode') ? 'Logging in…' : 'Creating account…';

  (async () => {
    try {
      const email = authForm.elements.email.value.trim();
      const password = passwordInput.value;
      const isLogin = authPanel.classList.contains('login-mode');
      const response = isLogin
        ? await authClient.auth.signInWithPassword({ email, password })
        : await authClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: nameInput.value.trim() } },
        });

      if (response.error) throw response.error;
      if (!response.data.session) {
        throw new Error('Supabase still requires email confirmation. In Authentication settings, turn off Confirm Email to enable password-only registration.');
      }

      updateAuthNavigation(response.data.session);
      passwordInput.value = '';
      if (!isLogin) nameInput.value = '';
      setAuthNotice(isLogin
        ? `You're logged in as ${response.data.user.email}.`
        : `Account created. You're logged in as ${response.data.user.email}.`, 'success');
    } catch (error) {
      setAuthNotice(getAuthErrorMessage(error), 'error');
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = previousLabel;
    }
  })();
});

if (authClient) {
  authClient.auth.getSession().then(({ data, error }) => {
    if (!error) updateAuthNavigation(data.session);
  });
  authClient.auth.onAuthStateChange((_event, session) => updateAuthNavigation(session));
}
