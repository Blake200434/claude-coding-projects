// "Nutrition" tab: calorie/macro targets, live food search (Open Food Facts), daily log.
import { state, save } from './store.js';
import { computeTargets, getLogForDate, addLogEntry, removeLogEntry, dayTotals, saveCustomFood, macrosFor } from './nutrition.js';
import { searchFoods, lookupBarcode, getCatalogue } from './foodApi.js';
import { ring, barMeter } from './charts.js';
import { uid, todayStr, addDays, fmtDateLong, debounce, escapeHtml, round } from './utils.js';

let viewDate = todayStr();
let searchResults = [];
let searchQuery = '';
let pendingFood = null; // food selected from search, awaiting grams/meal confirmation
let searching = false;
let searchToken = 0; // guards against a slow, stale search overwriting a newer one

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export function render(container) {
  const targets = computeTargets();
  const totals = dayTotals(viewDate);
  const log = getLogForDate(viewDate);

  container.innerHTML = `
    <section class="card">
      <div class="card-head-row">
        <h2>Nutrition — ${escapeHtml(fmtDateLong(viewDate))}</h2>
        <div class="date-nav">
          <button class="icon-btn" id="prevDay">←</button>
          <button class="text-btn" id="todayBtn">Today</button>
          <button class="icon-btn" id="nextDay">→</button>
        </div>
      </div>
      <div class="nutrition-summary">
        ${ring({ pct: totals.cal / targets.calories, label: `${Math.round(totals.cal)}`, sub: `/ ${targets.calories} kcal` })}
        <div class="macro-meters">
          ${barMeter({ label: 'Protein', value: totals.protein, max: targets.proteinG, unit: 'g', color: 'var(--accent)' })}
          ${barMeter({ label: 'Carbs', value: totals.carbs, max: targets.carbsG, unit: 'g', color: 'var(--accent-2)' })}
          ${barMeter({ label: 'Fat', value: totals.fat, max: targets.fatG, unit: 'g', color: 'var(--warn)' })}
        </div>
      </div>
      ${targets.computed ? `<p class="hint-text">Targets auto-calculated from your profile, current phase, and latest bodyweight (BMR ${targets.bmr} · TDEE ${targets.tdee} kcal). Override in Profile if you'd rather set your own.</p>` : `<p class="hint-text">Using your manually set targets (Profile → Nutrition targets).</p>`}
    </section>

    <section class="card">
      <h2>Add food</h2>
      <div class="food-search">
        <input type="text" id="foodSearchInput" placeholder="Search any food or product (e.g. 'greek yogurt', 'oreo')" value="${escapeHtml(searchQuery)}" autocomplete="off">
        <span id="searchStatus" class="search-status">${searching ? 'Searching…' : ''}</span>
      </div>
      <div id="searchResults" class="search-results">${renderSearchResults()}</div>
      <details class="catalogue-details">
        <summary>Browse food catalogue</summary>
        <div class="catalogue-list">${catalogueHtml()}</div>
      </details>
      <details class="barcode-details">
        <summary>Look up by barcode</summary>
        <div class="barcode-row">
          <input type="text" id="barcodeInput" placeholder="e.g. 737628064502" inputmode="numeric">
          <button class="secondary-btn small" id="barcodeBtn">Look up</button>
        </div>
        <div id="barcodeResult"></div>
      </details>
      <details class="manual-details">
        <summary>Add a custom food manually</summary>
        ${manualFoodForm()}
      </details>
      ${pendingFood ? confirmAddForm() : ''}
    </section>

    <section class="card">
      <h2>Today's log</h2>
      ${MEAL_SLOTS.map((slot) => mealSlotHtml(slot, log)).join('')}
    </section>
  `;

  wireEvents(container);
}

// Updates only the results list and status text, leaving the search <input>
// untouched — replacing it (as a full render would) drops focus and closes
// the on-screen keyboard on mobile mid-search.
function updateSearchArea(container) {
  const resultsEl = container.querySelector('#searchResults');
  const statusEl = container.querySelector('#searchStatus');
  if (resultsEl) resultsEl.innerHTML = renderSearchResults();
  if (statusEl) statusEl.textContent = searching ? 'Searching…' : '';
  bindSearchResultClicks(container);
}

function bindSearchResultClicks(container) {
  container.querySelectorAll('#searchResults .search-result').forEach((btn) => {
    btn.addEventListener('click', () => { pendingFood = searchResults[Number(btn.dataset.index)]; render(container); });
  });
}

function renderSearchResults() {
  if (!searchResults.length) return '';
  return searchResults.map((f, i) => `
    <button class="search-result" data-index="${i}">
      <span class="sr-name">${escapeHtml(f.name)}${f.brand ? ` <span class="sr-brand">· ${escapeHtml(f.brand)}</span>` : ''}</span>
      <span class="sr-macros">${Math.round(f.per100g.cal)} kcal · P${Math.round(f.per100g.protein)} C${Math.round(f.per100g.carbs)} F${Math.round(f.per100g.fat)} /100g</span>
    </button>`).join('');
}

function catalogueHtml() {
  return getCatalogue().map((g) => `
    <div class="catalogue-group">
      <h4 class="catalogue-group-title">${escapeHtml(g.category)}</h4>
      <div class="catalogue-items">
        ${g.items.map((f, i) => `
          <button class="search-result catalogue-item" data-category="${escapeHtml(g.category)}" data-index="${i}">
            <span class="sr-name">${escapeHtml(f.name)}</span>
            <span class="sr-macros">${Math.round(f.per100g.cal)} kcal · P${Math.round(f.per100g.protein)} C${Math.round(f.per100g.carbs)} F${Math.round(f.per100g.fat)} /100g</span>
          </button>`).join('')}
      </div>
    </div>`).join('');
}

function confirmAddForm() {
  const f = pendingFood;
  return `
    <div class="confirm-add">
      <strong>${escapeHtml(f.name)}</strong>
      <form id="confirmAddForm">
        <input type="number" id="confirmGrams" min="1" value="100" step="1"> g
        <select id="confirmMealSlot">${MEAL_SLOTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
        <button type="submit" class="primary-btn small">Log it</button>
        <button type="button" class="text-btn" id="cancelAdd">Cancel</button>
      </form>
      <span class="live-macros" id="liveMacros"></span>
    </div>`;
}

function manualFoodForm() {
  return `
    <form id="manualFoodForm" class="manual-food-form">
      <input type="text" id="mfName" placeholder="Food name" required>
      <input type="text" id="mfBrand" placeholder="Brand (optional)">
      <div class="mf-grid">
        <input type="number" id="mfCal" placeholder="kcal/100g" min="0" required>
        <input type="number" id="mfProtein" placeholder="protein g/100g" min="0" step="0.1" required>
        <input type="number" id="mfCarbs" placeholder="carbs g/100g" min="0" step="0.1" required>
        <input type="number" id="mfFat" placeholder="fat g/100g" min="0" step="0.1" required>
      </div>
      <button type="submit" class="secondary-btn small">Save & select</button>
    </form>`;
}

function mealSlotHtml(slot, log) {
  const items = log.filter((i) => i.mealSlot === slot.id);
  const totals = items.reduce((acc, i) => {
    const m = macrosFor(i);
    acc.cal += m.cal; return acc;
  }, { cal: 0 });
  const rows = items.map((i) => {
    const m = macrosFor(i);
    return `
      <div class="log-row">
        <span class="log-name">${escapeHtml(i.name)} <span class="log-grams">${i.grams}g</span></span>
        <span class="log-macros">${Math.round(m.cal)} kcal</span>
        <button class="icon-btn danger remove-log" data-id="${i.id}">✕</button>
      </div>`;
  }).join('');
  return `
    <div class="meal-slot">
      <div class="meal-slot-head"><span>${slot.label}</span><span>${Math.round(totals.cal)} kcal</span></div>
      ${rows || '<p class="empty-msg small">Nothing logged</p>'}
    </div>`;
}

function wireEvents(container) {
  container.querySelector('#prevDay').addEventListener('click', () => { viewDate = addDays(viewDate, -1); render(container); });
  container.querySelector('#nextDay').addEventListener('click', () => { viewDate = addDays(viewDate, 1); render(container); });
  container.querySelector('#todayBtn').addEventListener('click', () => { viewDate = todayStr(); render(container); });

  const searchInput = container.querySelector('#foodSearchInput');
  searchInput.addEventListener('input', debounce(async () => {
    const myToken = ++searchToken;
    const query = searchInput.value;
    searchQuery = query;
    if (query.trim().length < 2) {
      searchResults = [];
      updateSearchArea(container);
      return;
    }
    searching = true;
    updateSearchArea(container);
    const results = await searchFoods(query);
    if (myToken !== searchToken) return; // a newer search already superseded this one
    searchResults = results;
    searching = false;
    updateSearchArea(container);
  }, 450));

  bindSearchResultClicks(container);

  container.querySelectorAll('.catalogue-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = getCatalogue().find((g) => g.category === btn.dataset.category);
      const item = group.items[Number(btn.dataset.index)];
      pendingFood = item;
      render(container);
    });
  });

  const barcodeBtn = container.querySelector('#barcodeBtn');
  if (barcodeBtn) barcodeBtn.addEventListener('click', async () => {
    const code = container.querySelector('#barcodeInput').value.trim();
    if (!code) return;
    const resultEl = container.querySelector('#barcodeResult');
    resultEl.textContent = 'Looking up…';
    const food = await lookupBarcode(code);
    if (!food) { resultEl.textContent = 'No product found for that barcode.'; return; }
    pendingFood = food;
    render(container);
  });

  const manualForm = container.querySelector('#manualFoodForm');
  if (manualForm) manualForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#mfName').value.trim();
    const brand = container.querySelector('#mfBrand').value.trim();
    const per100g = {
      cal: parseFloat(container.querySelector('#mfCal').value) || 0,
      protein: parseFloat(container.querySelector('#mfProtein').value) || 0,
      carbs: parseFloat(container.querySelector('#mfCarbs').value) || 0,
      fat: parseFloat(container.querySelector('#mfFat').value) || 0,
    };
    if (!name) return;
    const food = saveCustomFood(name, brand, per100g);
    pendingFood = { ...food, source: 'custom' };
    render(container);
  });

  const confirmForm = container.querySelector('#confirmAddForm');
  if (confirmForm) {
    const gramsInput = container.querySelector('#confirmGrams');
    const updateLive = () => {
      const grams = parseFloat(gramsInput.value) || 0;
      const m = macrosFor({ per100g: pendingFood.per100g, grams });
      container.querySelector('#liveMacros').textContent = `${Math.round(m.cal)} kcal · P${round(m.protein, 1)} C${round(m.carbs, 1)} F${round(m.fat, 1)}`;
    };
    gramsInput.addEventListener('input', updateLive);
    updateLive();
    confirmForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const grams = parseFloat(gramsInput.value) || 100;
      const mealSlot = container.querySelector('#confirmMealSlot').value;
      addLogEntry(viewDate, pendingFood, grams, mealSlot);
      pendingFood = null;
      searchResults = [];
      searchQuery = '';
      render(container);
    });
    container.querySelector('#cancelAdd').addEventListener('click', () => { pendingFood = null; render(container); });
  }

  container.querySelectorAll('.remove-log').forEach((btn) => {
    btn.addEventListener('click', () => { removeLogEntry(viewDate, btn.dataset.id); render(container); });
  });
}
