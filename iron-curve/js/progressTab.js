// "Progress" tab: strength curves (actual vs expected), bodyweight plan, volume balance.
import { state } from './store.js';
import { getExerciseById, MUSCLE_LABELS, MUSCLE_COLORS } from './exercises.js';
import {
  getExerciseHistory, buildExpectedCurve, classifyStatus, trackedExerciseIds,
  buildBodyweightPlan, phaseBandsForRange,
} from './progress.js';
import { lineChart, stackedBarChart } from './charts.js';
import { displayWeight, unitLabel, fmtDate, escapeHtml, round, startOfWeek, daysBetween, addDays } from './utils.js';

let selectedExerciseId = null;

export function render(container) {
  const ids = trackedExerciseIds();
  if (!selectedExerciseId || !ids.includes(selectedExerciseId)) selectedExerciseId = ids[0] || null;

  container.innerHTML = `
    ${exerciseSection(ids)}
    ${overviewSection(ids)}
    ${bodyweightSection()}
    ${volumeSection()}
  `;
  wireEvents(container);
}

function exerciseSection(ids) {
  if (!ids.length) {
    return `<section class="card"><h2>Strength curve</h2><p class="empty-msg">Log a few workouts to see your strength curve here.</p></section>`;
  }
  const options = ids.map((id) => {
    const ex = getExerciseById(state, id);
    return `<option value="${id}" ${id === selectedExerciseId ? 'selected' : ''}>${escapeHtml(ex ? ex.name : id)}</option>`;
  }).join('');

  const history = getExerciseHistory(selectedExerciseId);
  const expected = buildExpectedCurve(history);
  const statusInfo = classifyStatus(history, expected);
  const bands = phaseBandsForRange(expected.epoch, expected.points.at(-1)?.x || 1);
  const unit = state.profile.unit;

  const actualSeries = {
    name: 'Actual est. 1RM', color: 'var(--accent)',
    points: history.map((h) => ({ x: expected.points.length ? daysFromEpoch(expected.epoch, h.date) : 0, y: displayWeight(h.e1rm, unit) })),
  };
  const expectedSeries = {
    name: 'Expected (plan)', color: 'var(--accent-2)', dashed: true,
    points: expected.points.map((p) => ({ x: p.x, y: displayWeight(p.y, unit) })),
  };

  const chart = lineChart({
    series: [expectedSeries, actualSeries],
    bands,
    yTickFormat: (v) => `${Math.round(v)}`,
    xTickFormat: (x) => fmtDate(dateFromEpoch(expected.epoch, x)),
  });

  return `
    <section class="card">
      <div class="card-head-row">
        <h2>Strength curve</h2>
        <select id="exercisePicker">${options}</select>
      </div>
      <div class="status-badge" style="color:${statusInfo.color};border-color:${statusInfo.color}">${escapeHtml(statusInfo.label)}</div>
      <p class="hint-text">Estimated 1RM (Epley) per session vs. what your ${escapeHtml(state.profile.experience)}-level plan expects given your logged bulk/cut phases. Background shading marks bulk (green), cut (red), maintain (blue) periods.</p>
      ${chart}
    </section>`;
}

function daysFromEpoch(epoch, dateStr) {
  if (!epoch) return 0;
  return daysBetween(epoch, dateStr);
}
function dateFromEpoch(epoch, x) {
  return addDays(epoch, Math.round(x));
}

function overviewSection(ids) {
  if (!ids.length) return '';
  const rows = ids.map((id) => {
    const ex = getExerciseById(state, id);
    const history = getExerciseHistory(id);
    const expected = buildExpectedCurve(history);
    const info = classifyStatus(history, expected);
    const last = history.at(-1);
    return `
      <div class="overview-row ${id === selectedExerciseId ? 'active' : ''}" data-id="${id}">
        <span class="ov-name">${escapeHtml(ex ? ex.name : id)}</span>
        <span class="ov-last">${last ? `${displayWeight(last.e1rm, state.profile.unit)} ${unitLabel(state.profile.unit)} e1RM` : ''}</span>
        <span class="ov-status" style="color:${info.color}">${escapeHtml(info.label)}</span>
      </div>`;
  }).join('');
  return `<section class="card"><h2>All tracked lifts</h2><div class="overview-list">${rows}</div></section>`;
}

function bodyweightSection() {
  const plan = buildBodyweightPlan();
  if (!plan.epoch) {
    return `<section class="card"><h2>Bodyweight vs. plan</h2><p class="empty-msg">Log your bodyweight (Profile tab) to see your trajectory here.</p></section>`;
  }
  const unit = state.profile.unit;
  const actualPoints = state.bodyweightLog.map((b) => ({ x: daysFromEpoch(plan.epoch, b.date), y: displayWeight(b.weightKg, unit) }));
  const plannedPoints = plan.points.map((p) => ({ x: p.x, y: displayWeight(p.y, unit) }));
  const bands = phaseBandsForRange(plan.epoch, plan.points.at(-1)?.x || 1);

  const chart = lineChart({
    series: [
      { name: 'Planned', color: 'var(--accent-2)', dashed: true, points: plannedPoints },
      { name: 'Actual', color: 'var(--accent)', points: actualPoints },
    ],
    bands,
    yTickFormat: (v) => `${Math.round(v)}`,
    xTickFormat: (x) => fmtDate(dateFromEpoch(plan.epoch, x)),
  });

  return `<section class="card"><h2>Bodyweight vs. plan</h2>
    <p class="hint-text">Dashed line is where your logged phases (Profile → Phase log) say you should be. Solid line is what you actually logged.</p>
    ${chart}</section>`;
}

function volumeSection() {
  const weeks = {};
  for (const w of state.workouts) {
    const wk = startOfWeek(w.date);
    if (!weeks[wk]) weeks[wk] = {};
    for (const s of w.sets) {
      const ex = getExerciseById(state, s.exerciseId);
      const muscle = ex ? ex.muscle : 'other';
      weeks[wk][muscle] = (weeks[wk][muscle] || 0) + s.weightKg * s.reps;
    }
  }
  const weekKeys = Object.keys(weeks).sort().slice(-8);
  if (!weekKeys.length) {
    return `<section class="card"><h2>Weekly volume by muscle group</h2><p class="empty-msg">Log workouts to see your training balance.</p></section>`;
  }
  const unit = state.profile.unit;
  const groups = weekKeys.map((wk) => ({
    label: fmtDate(wk),
    segments: Object.entries(weeks[wk]).map(([muscle, vol]) => ({
      name: MUSCLE_LABELS[muscle] || muscle,
      value: round(displayWeight(vol, unit), 0),
      color: MUSCLE_COLORS[muscle] || '#888',
    })),
  }));
  const chart = stackedBarChart({ groups, yTickFormat: (v) => `${Math.round(v)}` });
  return `<section class="card"><h2>Weekly volume by muscle group</h2>
    <p class="hint-text">Total weight × reps per muscle group, per week (${unitLabel(unit)}). Use this to spot lagging or neglected muscle groups.</p>
    ${chart}</section>`;
}

function wireEvents(container) {
  const picker = container.querySelector('#exercisePicker');
  if (picker) picker.addEventListener('change', () => { selectedExerciseId = picker.value; render(container); });

  container.querySelectorAll('.overview-row').forEach((row) => {
    row.addEventListener('click', () => { selectedExerciseId = row.dataset.id; render(container); });
  });
}
