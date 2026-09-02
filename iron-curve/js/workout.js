// "Train" tab: session logging, split/day selection, custom split builder, history.
// Sets can be tagged as part of a drop set (same exercise, progressively lighter,
// no rest) or a superset (back-to-back different exercises, no rest) so they're
// tracked and displayed as a group rather than looking like ordinary flat sets.
import { state, save } from './store.js';
import { getAllExercises, getAllSplits, getExerciseById, MUSCLE_LABELS } from './exercises.js';
import { getExerciseHistory } from './progress.js';
import { uid, todayStr, fmtDate, fmtDateLong, fmtDuration, displayWeight, toKg, unitLabel, escapeHtml, round } from './utils.js';

let tickInterval = null;
let restInterval = null;
let restRemaining = 0;

const RIR_OPTIONS = [0, 1, 2, 3, 4, 5];

function unit() { return state.profile.unit; }

function startSession(splitId, dayName, exerciseIds) {
  state.activeSession = {
    startedAt: Date.now(),
    splitId: splitId || null,
    splitDayName: dayName,
    exerciseIds: [...exerciseIds],
    sets: [],
    dropGroupByExercise: {},
    supersetGroupId: null,
  };
  save();
}

function addSet(exerciseId, weightKg, reps, rir) {
  const s = state.activeSession;
  let setType = 'normal';
  let groupId = null;
  if (s.supersetGroupId) {
    setType = 'superset';
    groupId = s.supersetGroupId;
  } else if (s.dropGroupByExercise[exerciseId]) {
    setType = 'drop';
    groupId = s.dropGroupByExercise[exerciseId];
  }
  s.sets.push({ id: uid(), exerciseId, weightKg, reps, rir: rir ?? null, t: Date.now(), setType, groupId });
  if (!s.exerciseIds.includes(exerciseId)) s.exerciseIds.push(exerciseId);
  save();
}

function removeSet(setId) {
  state.activeSession.sets = state.activeSession.sets.filter((s) => s.id !== setId);
  save();
}

function toggleDropSet(exerciseId) {
  const s = state.activeSession;
  s.dropGroupByExercise[exerciseId] = s.dropGroupByExercise[exerciseId] ? null : uid();
  save();
}

function toggleSuperset() {
  const s = state.activeSession;
  s.supersetGroupId = s.supersetGroupId ? null : uid();
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
    sets: s.sets.map(({ id, exerciseId, weightKg, reps, rir, setType, groupId }) => ({ id, exerciseId, weightKg, reps, rir, setType, groupId })),
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
  return history[history.length - 1];
}

// For a grouped set, figure out its position within its drop/superset cluster
// (drop groups are scoped to one exercise; superset groups span exercises, so
// this always looks at the whole session's sets, not just one exercise's).
function groupLabelFor(set, allSets) {
  if (!set.groupId) return null;
  const groupSets = allSets.filter((x) => x.groupId === set.groupId).sort((a, b) => a.t - b.t);
  const idx = groupSets.findIndex((x) => x.id === set.id);
  if (set.setType === 'drop') return idx === 0 ? 'Top set' : `Drop ${idx}`;
  if (set.setType === 'superset') return `Superset #${idx + 1}`;
  return null;
}

export function render(container) {
  clearInterval(tickInterval);
  if (state.activeSession) {
    if (!state.activeSession.dropGroupByExercise) state.activeSession.dropGroupByExercise = {};
    if (state.activeSession.supersetGroupId === undefined) state.activeSession.supersetGroupId = null;
  }
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
          const label = groupLabelFor(s, w.sets);
          const tag = label ? ` <span class="hist-set-tag ${s.setType}">${escapeHtml(label)}</span>` : '';
          return `<div class="hist-set-row"><span>${escapeHtml(ex ? ex.name : s.exerciseId)}${tag}</span><span>${displayWeight(s.weightKg, unit())}${unitLabel(unit())} × ${s.reps}${s.rir !== null && s.rir !== undefined ? ` · RIR ${s.rir}` : ''}</span></div>`;
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

function rirPickerHtml() {
  return `
    <div class="rir-picker">
      <span class="rir-picker-label">RIR</span>
      ${RIR_OPTIONS.map((r, i) => `<button type="button" class="rir-btn" data-value="${r}">${i === RIR_OPTIONS.length - 1 ? '5+' : r}</button>`).join('')}
    </div>`;
}

function sessionView() {
  const s = state.activeSession;
  const exIds = s.exerciseIds.length ? s.exerciseIds : [];
  const supersetActive = !!s.supersetGroupId;
  const supersetCount = supersetActive ? s.sets.filter((x) => x.groupId === s.supersetGroupId).length : 0;

  const blocks = exIds.map((exId) => {
    const ex = getExerciseById(state, exId);
    const name = ex ? ex.name : exId;
    const sets = s.sets.filter((x) => x.exerciseId === exId);
    const last = lastPerformance(exId);
    const lastLine = last ? `Last time: ${displayWeight(last.bestSet.weightKg, unit())}${unitLabel(unit())} × ${last.bestSet.reps} on ${fmtDate(last.date)}` : 'No previous data';
    const dropActive = !!s.dropGroupByExercise[exId];

    const setRows = sets.map((set) => {
      const label = groupLabelFor(set, s.sets);
      const indexLabel = label || String(sets.indexOf(set) + 1);
      return `
      <div class="set-row ${set.groupId ? `grouped grouped-${set.setType}` : ''}">
        <span class="set-index ${label ? 'set-index-label' : ''}">${escapeHtml(indexLabel)}</span>
        <span>${displayWeight(set.weightKg, unit())} ${unitLabel(unit())}</span>
        <span>× ${set.reps}</span>
        <span>${set.rir !== null && set.rir !== undefined ? `RIR ${set.rir}` : ''}</span>
        <button class="icon-btn danger remove-set" data-id="${set.id}">✕</button>
      </div>`;
    }).join('');

    return `
      <div class="exercise-block" data-exercise="${exId}">
        <div class="exercise-block-head">
          <h3>${escapeHtml(name)}</h3>
          <span class="last-perf">${escapeHtml(lastLine)}</span>
        </div>
        ${setRows || '<p class="empty-msg small">No sets yet</p>'}
        <div class="set-mode-row">
          <button type="button" class="mode-toggle-btn drop-toggle ${dropActive ? 'active' : ''}" data-exercise="${exId}">
            ${dropActive ? '● Drop set in progress — tap to end' : '+ Start drop set'}
          </button>
        </div>
        <form class="add-set-form" data-exercise="${exId}">
          <div class="add-set-inputs">
            <input type="number" step="0.5" min="0" placeholder="${unitLabel(unit())}" class="input-weight" required>
            <input type="number" min="1" placeholder="reps" class="input-reps" required>
          </div>
          ${rirPickerHtml()}
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

      <div class="superset-row">
        <button type="button" id="supersetToggle" class="mode-toggle-btn superset-toggle ${supersetActive ? 'active' : ''}">
          ${supersetActive ? `● Superset in progress (${supersetCount} sets) — tap to end` : '+ Start superset'}
        </button>
        <span class="hint-text superset-hint">${supersetActive ? 'Every set you log now, across any exercise, joins this superset.' : 'Turn on before alternating between exercises with no rest between them.'}</span>
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

  const supersetToggle = container.querySelector('#supersetToggle');
  if (supersetToggle) supersetToggle.addEventListener('click', () => { toggleSuperset(); render(container); });

  container.querySelectorAll('.drop-toggle').forEach((btn) => {
    btn.addEventListener('click', () => { toggleDropSet(btn.dataset.exercise); render(container); });
  });

  container.querySelectorAll('.rir-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const picker = btn.closest('.rir-picker');
      const wasActive = btn.classList.contains('active');
      picker.querySelectorAll('.rir-btn').forEach((b) => b.classList.remove('active'));
      if (!wasActive) btn.classList.add('active');
    });
  });

  container.querySelectorAll('.add-set-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const exId = form.dataset.exercise;
      const weightInput = form.querySelector('.input-weight').value;
      const reps = parseInt(form.querySelector('.input-reps').value, 10);
      const rirBtn = form.querySelector('.rir-btn.active');
      const rir = rirBtn ? Number(rirBtn.dataset.value) : null;
      const weightKg = round(toKg(parseFloat(weightInput), unit()), 2);
      if (!weightKg || !reps) return;
      addSet(exId, weightKg, reps, rir);
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
