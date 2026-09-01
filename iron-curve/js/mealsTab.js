// "Meals" tab: reusable meal templates + a weekly meal planner.
import { state, save } from './store.js';
import { addLogEntry, macrosFor, computeTargets } from './nutrition.js';
import { searchFoods } from './foodApi.js';
import { uid, todayStr, debounce, escapeHtml, round } from './utils.js';

const DAYS = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' }, { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' }, { id: 'sun', label: 'Sun' },
];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

let draftItems = [];
let draftSearchResults = [];
let draftPending = null;

function mealTotals(meal) {
  return meal.items.reduce((acc, item) => {
    const m = macrosFor(item);
    acc.cal += m.cal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    return acc;
  }, { cal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function render(container) {
  container.innerHTML = `
    ${builderSection()}
    ${savedMealsSection()}
    ${plannerSection()}
  `;
  wireEvents(container);
}

function builderSection() {
  const totals = draftItems.reduce((acc, item) => {
    const m = macrosFor(item);
    acc.cal += m.cal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    return acc;
  }, { cal: 0, protein: 0, carbs: 0, fat: 0 });

  return `
    <section class="card">
      <h2>Build a meal</h2>
      <input type="text" id="mealFoodSearch" placeholder="Search a food to add to this meal…" autocomplete="off">
      <div id="mealSearchResults" class="search-results">
        ${draftSearchResults.map((f, i) => `
          <button class="search-result" data-index="${i}">
            <span class="sr-name">${escapeHtml(f.name)}${f.brand ? ` <span class="sr-brand">· ${escapeHtml(f.brand)}</span>` : ''}</span>
            <span class="sr-macros">${Math.round(f.per100g.cal)} kcal /100g</span>
          </button>`).join('')}
      </div>
      ${draftPending ? `
        <div class="confirm-add">
          <strong>${escapeHtml(draftPending.name)}</strong>
          <form id="draftAddForm">
            <input type="number" id="draftGrams" min="1" value="100" step="1"> g
            <button type="submit" class="primary-btn small">Add to meal</button>
            <button type="button" class="text-btn" id="draftCancel">Cancel</button>
          </form>
        </div>` : ''}

      <div class="draft-items">
        ${draftItems.map((item, i) => `
          <div class="log-row">
            <span class="log-name">${escapeHtml(item.name)} <span class="log-grams">${item.grams}g</span></span>
            <span class="log-macros">${Math.round(macrosFor(item).cal)} kcal</span>
            <button class="icon-btn danger draft-remove" data-index="${i}">✕</button>
          </div>`).join('') || '<p class="empty-msg small">No items yet — search above to add some.</p>'}
      </div>
      ${draftItems.length ? `<p class="hint-text">Total: ${Math.round(totals.cal)} kcal · P${round(totals.protein, 0)} C${round(totals.carbs, 0)} F${round(totals.fat, 0)}</p>` : ''}
      <form id="saveMealForm" class="save-meal-form">
        <input type="text" id="newMealName" placeholder="Meal name (e.g. High-Protein Breakfast)" ${draftItems.length ? '' : 'disabled'} required>
        <button type="submit" class="secondary-btn" ${draftItems.length ? '' : 'disabled'}>Save meal</button>
      </form>
    </section>`;
}

function savedMealsSection() {
  if (!state.meals.length) {
    return `<section class="card"><h2>Saved meals</h2><p class="empty-msg">Build a meal above to save it for reuse and planning.</p></section>`;
  }
  const rows = state.meals.map((meal) => {
    const t = mealTotals(meal);
    return `
      <div class="meal-card">
        <div class="meal-card-head">
          <strong>${escapeHtml(meal.name)}</strong>
          <button class="icon-btn danger delete-meal" data-id="${meal.id}">✕</button>
        </div>
        <p class="hint-text">${Math.round(t.cal)} kcal · P${round(t.protein, 0)} C${round(t.carbs, 0)} F${round(t.fat, 0)} · ${meal.items.length} items</p>
        <div class="meal-log-row">
          <select class="log-meal-slot" data-id="${meal.id}">${SLOTS.map((s) => `<option value="${s}">${SLOT_LABELS[s]}</option>`).join('')}</select>
          <button class="secondary-btn small log-meal-btn" data-id="${meal.id}">Log to today</button>
        </div>
      </div>`;
  }).join('');
  return `<section class="card"><h2>Saved meals</h2><div class="meal-cards">${rows}</div></section>`;
}

function plannerSection() {
  const targets = computeTargets();
  const mealOptions = (current) => `<option value="">—</option>` + state.meals.map((m) => `<option value="${m.id}" ${current === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('');

  const grid = DAYS.map((day) => {
    const plan = state.weeklyPlan[day.id] || {};
    const dayTotal = SLOTS.reduce((sum, slot) => {
      const meal = state.meals.find((m) => m.id === plan[slot]);
      return sum + (meal ? mealTotals(meal).cal : 0);
    }, 0);
    return `
      <div class="plan-day">
        <div class="plan-day-head">${day.label}<span class="plan-day-total">${Math.round(dayTotal)} kcal</span></div>
        ${SLOTS.map((slot) => `
          <label class="plan-slot">
            <span>${SLOT_LABELS[slot][0]}</span>
            <select class="plan-select" data-day="${day.id}" data-slot="${slot}">${mealOptions(plan[slot])}</select>
          </label>`).join('')}
      </div>`;
  }).join('');

  return `
    <section class="card">
      <h2>Weekly planner</h2>
      <p class="hint-text">Assign saved meals to each day/slot. Your daily calorie target is ${targets.calories} kcal.</p>
      <div class="planner-grid">${grid}</div>
    </section>`;
}

function wireEvents(container) {
  const searchInput = container.querySelector('#mealFoodSearch');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async () => {
      const q = searchInput.value;
      if (q.trim().length < 2) { draftSearchResults = []; render(container); return; }
      draftSearchResults = await searchFoods(q);
      render(container);
      const el = container.querySelector('#mealFoodSearch');
      if (el) { el.value = q; el.focus(); }
    }, 450));
  }

  container.querySelectorAll('#mealSearchResults .search-result').forEach((btn) => {
    btn.addEventListener('click', () => { draftPending = draftSearchResults[Number(btn.dataset.index)]; render(container); });
  });

  const draftAddForm = container.querySelector('#draftAddForm');
  if (draftAddForm) {
    draftAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const grams = parseFloat(container.querySelector('#draftGrams').value) || 100;
      draftItems.push({ name: draftPending.name, brand: draftPending.brand || '', per100g: draftPending.per100g, grams });
      draftPending = null;
      draftSearchResults = [];
      render(container);
    });
    container.querySelector('#draftCancel').addEventListener('click', () => { draftPending = null; render(container); });
  }

  container.querySelectorAll('.draft-remove').forEach((btn) => {
    btn.addEventListener('click', () => { draftItems.splice(Number(btn.dataset.index), 1); render(container); });
  });

  const saveMealForm = container.querySelector('#saveMealForm');
  if (saveMealForm) saveMealForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#newMealName').value.trim();
    if (!name || !draftItems.length) return;
    state.meals.push({ id: uid(), name, items: draftItems });
    draftItems = [];
    save();
    render(container);
  });

  container.querySelectorAll('.delete-meal').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this saved meal?')) return;
      state.meals = state.meals.filter((m) => m.id !== btn.dataset.id);
      save();
      render(container);
    });
  });

  container.querySelectorAll('.log-meal-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const meal = state.meals.find((m) => m.id === btn.dataset.id);
      const slot = container.querySelector(`.log-meal-slot[data-id="${btn.dataset.id}"]`).value;
      meal.items.forEach((item) => addLogEntry(todayStr(), item, item.grams, slot));
      alert(`Logged "${meal.name}" to today's ${SLOT_LABELS[slot]}.`);
    });
  });

  container.querySelectorAll('.plan-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const day = sel.dataset.day, slot = sel.dataset.slot;
      if (!state.weeklyPlan[day]) state.weeklyPlan[day] = {};
      if (sel.value) state.weeklyPlan[day][slot] = sel.value;
      else delete state.weeklyPlan[day][slot];
      save();
      render(container);
    });
  });
}
