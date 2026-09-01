// "Train" tab: session logging, split/day selection, custom split builder, history.
import { state, save } from './store.js';
import { getAllExercises, getAllSplits, getExerciseById, MUSCLE_LABELS } from './exercises.js';
import { getExerciseHistory } from './progress.js';
import { uid, todayStr, fmtDate, fmtDateLong, fmtDuration, displayWeight, toKg, unitLabel, escapeHtml, round } from './utils.js';

let tickInterval = null;
let restInterval = null;
let restRemaining = 0;

function unit() { return state.profile.unit; }

function startSession(splitId, dayName, exerciseIds) {
  state.activeSession = {
    startedAt: Date.now(),
    splitId: splitId || null,
    splitDayName: dayName,
    exerciseIds: [...exerciseIds],
    sets: [],
  };
  save();
}

function addSet(exerciseId, weightKg, reps, rpe) {
  state.activeSession.sets.push({ id: uid(), exerciseId, weightKg, reps, rpe: rpe || null, t: Date.now() });
  if (!state.activeSession.exerciseIds.includes(exerciseId)) state.activeSession.exerciseIds.push(exerciseId);
  save();
}

function removeSet(setId) {
  state.activeSession.sets = state.activeSession.sets.filter((s) => s.id !== setId);
  save();
}

function finishSession() {
  const s = state.activeSession;
  const durationSec = Math.round((Date.now() - s.startedAt) / 1000);
  state.workouts.push({
    id: uid(),
    date: todayStr(),
    splitDayName: s.splitDayName,
    startedAt: s.startedAt,
    endedAt: Date.now(),
    durationSec,
    sets: s.sets.map(({ id, exerciseId, weightKg, reps, rpe }) => ({ id, exerciseId, weightKg, reps, rpe })),
  });
  state.activeSession = null;
  save();
}

function discardSession() {
  state.activeSession = null;
  save();
}

function lastPerformance(exerciseId) {
  const history = getExerciseHistory(exerciseId);
  if (!history.length) return null;
  const last = history[history.length - 1];
  return last;
}

export function render(container) {
  clearInterval(tickInterval);
  container.innerHTML = state.activeSession ? sessionView() : pickerView();
  wireEvents(container);
  if (state.activeSession) {
    tickInterval = setInterval(() => {
      const el = container.querySelector('#sessionElapsed');
      if (!el) { clearInterval(tickInterval); return; }
      el.textContent = fmtDuration((Date.now() - state.activeSession.startedAt) / 1000);
    }, 1000);
  }
}

function pickerView() {
  const splits = getAllSplits(state);
  const active = splits.find((s) => s.id === state.activeSplitId) || splits[0];

  const splitOptions = splits.map((s) => `<option value="${s.id}" ${s.id === active.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
  const dayButtons = active.days.map((d, i) => `
    <button class="day-btn" data-split="${active.id}" data-day="${i}">
      <span class="day-name">${escapeHtml(d.name)}</span>
      <span class="day-exercises">${d.exerciseIds.length} exercises</span>
    </button>`).join('');

  const history = [...state.workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  const historyHtml = history.length ? history.map((w) => {
    const volume = w.sets.reduce((s, x) => s + x.weightKg * x.reps, 0);
    return `
    <details class="history-item">
      <summary>
        <span class="hist-date">${fmtDate(w.date)}</span>
        <span class="hist-name">${escapeHtml(w.splitDayName)}</span>
        <span class="hist-meta">${fmtDuration(w.durationSec)} · ${w.sets.length} sets · ${Math.round(displayWeight(volume, unit()))} ${unitLabel(unit())} vol</span>
        <button class="icon-btn danger delete-workout" data-id="${w.id}" title="Delete">✕</button>
      </summary>
      <div class="hist-sets">
        ${w.sets.map((s) => {
          const ex = getExerciseById(state, s.exerciseId);
          return `<div class="hist-set-row"><span>${escapeHtml(ex ? ex.name : s.exerciseId)}</span><span>${displayWeight(s.weightKg, unit())}${unitLabel(unit())} × ${s.reps}${s.rpe ? ` @${s.rpe}` : ''}</span></div>`;
        }).join('')}
      </div>
    </details>`;
  }).join('') : `<p class="empty-msg">No workouts logged yet. Start one above.</p>`;

  return `
    <section class="card">
      <h2>Start a workout</h2>
      <label class="field">
        <span>Split</span>
        <select id="splitSelect">${splitOptions}</select>
      </label>
      <div class="day-grid">${dayButtons}</div>
      <div class="picker-actions">
        <button class="secondary-btn" id="freeformBtn">Start Freeform Workout</button>
        <button class="text-btn" id="buildSplitBtn">+ Build custom split</button>
      </div>
      <div id="splitBuilder" class="split-builder hidden"></div>
    </section>

    <section class="card">
      <h2>Recent workouts</h2>
      <div class="history-list">${historyHtml}</div>
    </section>`;
}

function exercisePickerOptions(excludeIds = []) {
  return getAllExercises(state)
    .filter((e) => !excludeIds.includes(e.id))
    .map((e) => `<option value="${e.id}">${escapeHtml(e.name)} — ${MUSCLE_LABELS[e.muscle] || e.muscle}</option>`)
    .join('');
}

function sessionView() {
  const s = state.activeSession;
  const exIds = s.exerciseIds.length ? s.exerciseIds : [];
  const blocks = exIds.map((exId) => {
    const ex = getExerciseById(state, exId);
    const name = ex ? ex.name : exId;
    const sets = s.sets.filter((x) => x.exerciseId === exId);
    const last = lastPerformance(exId);
    const lastLine = last ? `Last time: ${displayWeight(last.bestSet.weightKg, unit())}${unitLabel(unit())} × ${last.bestSet.reps} on ${fmtDate(last.date)}` : 'No previous data';
    const setRows = sets.map((set, i) => `
      <div class="set-row">
        <span class="set-index">${i + 1}</span>
        <span>${displayWeight(set.weightKg, unit())} ${unitLabel(unit())}</span>
        <span>× ${set.reps}</span>
        <span>${set.rpe ? `RPE ${set.rpe}` : ''}</span>
        <button class="icon-btn danger remove-set" data-id="${set.id}">✕</button>
      </div>`).join('');

    return `
      <div class="exercise-block" data-exercise="${exId}">
        <div class="exercise-block-head">
          <h3>${escapeHtml(name)}</h3>
          <span class="last-perf">${escapeHtml(lastLine)}</span>
        </div>
        ${setRows || '<p class="empty-msg small">No sets yet</p>'}
        <form class="add-set-form" data-exercise="${exId}">
          <input type="number" step="0.5" min="0" placeholder="${unitLabel(unit())}" class="input-weight" required>
          <input type="number" min="1" placeholder="reps" class="input-reps" required>
          <select class="input-rpe">
            <option value="">RPE</option>
            ${[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
          <button type="submit" class="primary-btn small">Add Set</button>
        </form>
      </div>`;
  }).join('');

  return `
    <section class="card session-card">
      <div class="session-head">
        <div>
          <h2>${escapeHtml(s.splitDayName)}</h2>
          <span id="sessionElapsed" class="session-elapsed">${fmtDuration((Date.now() - s.startedAt) / 1000)}</span>
        </div>
        <div class="session-actions">
          <button class="secondary-btn" id="discardBtn">Discard</button>
          <button class="primary-btn" id="finishBtn">Finish Workout</button>
        </div>
      </div>

      <div class="rest-timer">
        <span>Rest timer</span>
        <input type="number" id="restSeconds" value="${state.profile.restTimerSec}" min="10" step="5">
        <button class="secondary-btn small" id="restStart">Start</button>
        <span id="restDisplay" class="rest-display"></span>
      </div>

      <label class="field">
        <span>Add exercise</span>
        <select id="addExerciseSelect">
          <option value="">Select an exercise…</option>
          ${exercisePickerOptions(exIds)}
        </select>
      </label>

      <div class="exercise-blocks">${blocks || '<p class="empty-msg">Add an exercise above to start logging sets.</p>'}</div>
    </section>`;
}

function wireEvents(container) {
  const splitSelect = container.querySelector('#splitSelect');
  if (splitSelect) {
    splitSelect.addEventListener('change', () => {
      state.activeSplitId = splitSelect.value;
      save();
      render(container);
    });
  }

  container.querySelectorAll('.day-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const split = getAllSplits(state).find((s) => s.id === btn.dataset.split);
      const day = split.days[Number(btn.dataset.day)];
      startSession(split.id, day.name, day.exerciseIds);
      render(container);
    });
  });

  const freeformBtn = container.querySelector('#freeformBtn');
  if (freeformBtn) freeformBtn.addEventListener('click', () => {
    startSession(null, `Freeform — ${fmtDateLong(todayStr())}`, []);
    render(container);
  });

  const buildSplitBtn = container.querySelector('#buildSplitBtn');
  if (buildSplitBtn) buildSplitBtn.addEventListener('click', () => {
    const builder = container.querySelector('#splitBuilder');
    builder.classList.toggle('hidden');
    if (!builder.classList.contains('hidden')) builder.innerHTML = splitBuilderHtml();
    wireSplitBuilder(container);
  });

  container.querySelectorAll('.delete-workout').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!confirm('Delete this workout?')) return;
      state.workouts = state.workouts.filter((w) => w.id !== btn.dataset.id);
      save();
      render(container);
    });
  });

  // Session view events
  const discardBtn = container.querySelector('#discardBtn');
  if (discardBtn) discardBtn.addEventListener('click', () => {
    if (confirm('Discard this workout? Nothing will be saved.')) { discardSession(); render(container); }
  });

  const finishBtn = container.querySelector('#finishBtn');
  if (finishBtn) finishBtn.addEventListener('click', () => {
    if (!state.activeSession.sets.length && !confirm('No sets logged. Finish anyway?')) return;
    finishSession();
    render(container);
  });

  const addExerciseSelect = container.querySelector('#addExerciseSelect');
  if (addExerciseSelect) addExerciseSelect.addEventListener('change', () => {
    const id = addExerciseSelect.value;
    if (!id) return;
    if (!state.activeSession.exerciseIds.includes(id)) state.activeSession.exerciseIds.push(id);
    save();
    render(container);
  });

  container.querySelectorAll('.add-set-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const exId = form.dataset.exercise;
      const weightInput = form.querySelector('.input-weight').value;
      const reps = parseInt(form.querySelector('.input-reps').value, 10);
      const rpe = form.querySelector('.input-rpe').value ? Number(form.querySelector('.input-rpe').value) : null;
      const weightKg = round(toKg(parseFloat(weightInput), unit()), 2);
      if (!weightKg || !reps) return;
      addSet(exId, weightKg, reps, rpe);
      render(container);
    });
  });

  container.querySelectorAll('.remove-set').forEach((btn) => {
    btn.addEventListener('click', () => { removeSet(btn.dataset.id); render(container); });
  });

  const restStart = container.querySelector('#restStart');
  if (restStart) {
    restStart.addEventListener('click', () => {
      clearInterval(restInterval);
      restRemaining = parseInt(container.querySelector('#restSeconds').value, 10) || 90;
      state.profile.restTimerSec = restRemaining;
      save();
      const display = container.querySelector('#restDisplay');
      updateRestDisplay(display);
      restInterval = setInterval(() => {
        restRemaining -= 1;
        updateRestDisplay(display);
        if (restRemaining <= 0) {
          clearInterval(restInterval);
          beep();
          display.textContent = "Time's up!";
        }
      }, 1000);
    });
  }
}

function updateRestDisplay(display) {
  const m = Math.floor(restRemaining / 60).toString().padStart(2, '0');
  const s = Math.max(0, restRemaining % 60).toString().padStart(2, '0');
  display.textContent = `${m}:${s}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  } catch { /* audio unavailable */ }
}

// --- Custom split builder ---

let builderDays = [];

function splitBuilderHtml() {
  builderDays = builderDays.length ? builderDays : [{ name: 'Day 1', exerciseIds: [] }];
  return `
    <div class="builder-box">
      <label class="field"><span>Split name</span><input type="text" id="newSplitName" placeholder="e.g. My 4-Day Split"></label>
      <div id="builderDays">${builderDays.map((d, i) => builderDayHtml(d, i)).join('')}</div>
      <button class="text-btn" id="addBuilderDay">+ Add day</button>
      <button class="primary-btn small" id="saveSplitBtn">Save split</button>
    </div>`;
}

function builderDayHtml(day, i) {
  const exList = getAllExercises(state);
  return `
    <div class="builder-day" data-day="${i}">
      <input type="text" class="builder-day-name" value="${escapeHtml(day.name)}" placeholder="Day name">
      <select multiple class="builder-day-exercises" size="6">
        ${exList.map((e) => `<option value="${e.id}" ${day.exerciseIds.includes(e.id) ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('')}
      </select>
    </div>`;
}

function wireSplitBuilder(container) {
  const builder = container.querySelector('#splitBuilder');
  if (!builder || builder.classList.contains('hidden')) return;

  builder.querySelector('#addBuilderDay').addEventListener('click', () => {
    syncBuilderState(builder);
    builderDays.push({ name: `Day ${builderDays.length + 1}`, exerciseIds: [] });
    builder.innerHTML = splitBuilderHtml();
    wireSplitBuilder(container);
  });

  builder.querySelector('#saveSplitBtn').addEventListener('click', () => {
    syncBuilderState(builder);
    const name = builder.querySelector('#newSplitName').value.trim() || 'Custom Split';
    const days = builderDays.filter((d) => d.exerciseIds.length);
    if (!days.length) { alert('Add at least one day with exercises.'); return; }
    state.customSplits.push({ id: uid(), name, days });
    builderDays = [];
    save();
    render(container);
  });
}

function syncBuilderState(builder) {
  builder.querySelectorAll('.builder-day').forEach((dayEl, i) => {
    const name = dayEl.querySelector('.builder-day-name').value.trim() || `Day ${i + 1}`;
    const exerciseIds = [...dayEl.querySelector('.builder-day-exercises').selectedOptions].map((o) => o.value);
    builderDays[i] = { name, exerciseIds };
  });
}
