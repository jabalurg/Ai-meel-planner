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
