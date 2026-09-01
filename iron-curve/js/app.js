import * as dashboardTab from './dashboardTab.js';
import * as workoutTab from './workout.js';
import * as progressTab from './progressTab.js';
import * as nutritionTab from './nutritionTab.js';
import * as mealsTab from './mealsTab.js';
import * as profileTab from './profileTab.js';

const TABS = {
  dashboard: { label: 'Dashboard', render: (c) => dashboardTab.render(c, goToTab) },
  train: { label: 'Train', render: (c) => workoutTab.render(c) },
  progress: { label: 'Progress', render: (c) => progressTab.render(c) },
  nutrition: { label: 'Nutrition', render: (c) => nutritionTab.render(c) },
  meals: { label: 'Meals', render: (c) => mealsTab.render(c) },
  profile: { label: 'Profile', render: (c) => profileTab.render(c) },
};

const main = document.getElementById('main');
const navEl = document.getElementById('tabNav');
let current = 'dashboard';

function goToTab(id) {
  current = id;
  renderNav();
  renderTab();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderNav() {
  navEl.innerHTML = Object.entries(TABS).map(([id, t]) =>
    `<button class="tab-btn ${id === current ? 'active' : ''}" data-tab="${id}">${t.label}</button>`
  ).join('');
  navEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => goToTab(btn.dataset.tab));
  });
}

function renderTab() {
  TABS[current].render(main);
}

renderNav();
renderTab();
