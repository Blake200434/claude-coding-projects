// The core differentiator: expected-vs-actual strength & bodyweight trajectories,
// modeled from training phase (bulk/cut/maintain) and experience level.
import { state, phaseAt } from './store.js';
import { epley1RM, linearRegression, daysBetween, addDays, todayStr } from './utils.js';

// Weekly fractional strength-gain rate at full (bulk) support, by experience.
// These are heuristic, widely-cited ballpark rates for a trained major lift, not a guarantee.
const BASE_WEEKLY_RATE = { novice: 0.012, intermediate: 0.005, advanced: 0.002 };

// How much of the base rate is realistically achievable in each phase.
const PHASE_MULTIPLIER = { bulk: 1.0, maintain: 0.55, cut: 0.15 };

export function getExerciseHistory(exerciseId) {
  const rows = [];
  for (const w of state.workouts) {
    const sets = w.sets.filter((s) => s.exerciseId === exerciseId);
    if (!sets.length) continue;
    let best = 0, bestSet = null, volume = 0;
    for (const s of sets) {
      const e1 = epley1RM(s.weightKg, s.reps);
      volume += s.weightKg * s.reps;
      if (e1 > best) { best = e1; bestSet = s; }
    }
    rows.push({ date: w.date, e1rm: best, bestSet, volume, setCount: sets.length });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function dayIndex(epochStr, dateStr) {
  return daysBetween(epochStr, dateStr);
}

// Builds the "what this lift should look like" curve, piecewise by logged phase segments,
// from the first logged session through today (plus a short forward projection).
export function buildExpectedCurve(history, projectDays = 21) {
  if (!history.length) return [];
  const epoch = history[0].date;
  const startVal = history[0].e1rm;
  const endDate = addDays(todayStr(), projectDays);
  const totalDays = Math.max(1, daysBetween(epoch, endDate));

  const points = [];
  let value = startVal;
  for (let d = 0; d <= totalDays; d++) {
    const dateStr = addDays(epoch, d);
    if (d > 0) {
      const phase = phaseAt(dateStr);
      const rate = BASE_WEEKLY_RATE[state.profile.experience] ?? BASE_WEEKLY_RATE.intermediate;
      const mult = PHASE_MULTIPLIER[phase.phase] ?? PHASE_MULTIPLIER.maintain;
      const dailyRate = (rate * mult) / 7;
      value *= 1 + dailyRate;
    }
    // Sample weekly to keep the chart light, always include first/last day.
    if (d % 7 === 0 || d === totalDays) {
      points.push({ x: dayIndex(epoch, dateStr), y: value, dateStr, projected: dateStr > todayStr() });
    }
  }
  return { epoch, points };
}

const STATUS_META = {
  ahead: { label: 'Ahead of plan', color: 'var(--accent-2)' },
  'on-track': { label: 'On track', color: 'var(--accent)' },
  slowing: { label: 'Slowing down', color: 'var(--warn)' },
  plateaued: { label: 'Plateaued', color: 'var(--text-dim)' },
  regressing: { label: 'Regressing', color: 'var(--danger)' },
  'not-enough-data': { label: 'Needs more sessions', color: 'var(--text-dim)' },
};

export function classifyStatus(history, expected) {
  if (history.length < 3) return { status: 'not-enough-data', ...STATUS_META['not-enough-data'] };

  const epoch = history[0].date;
  const window = history.slice(-6);
  const actualPts = window.map((h) => ({ x: dayIndex(epoch, h.date), y: h.e1rm }));
  const { slope: actualSlope } = linearRegression(actualPts);
  const meanY = actualPts.reduce((s, p) => s + p.y, 0) / actualPts.length;
  const actualPctPerWeek = meanY > 0 ? (actualSlope * 7 * 100) / meanY : 0;

  // Expected slope over the same date window, from the expected curve.
  const expPts = expected.points.filter((p) => p.x >= actualPts[0].x && p.x <= actualPts[actualPts.length - 1].x && !p.projected);
  let expectedPctPerWeek = 0;
  if (expPts.length >= 2) {
    const { slope } = linearRegression(expPts);
    const meanExp = expPts.reduce((s, p) => s + p.y, 0) / expPts.length;
    expectedPctPerWeek = meanExp > 0 ? (slope * 7 * 100) / meanExp : 0;
  }

  let status;
  if (actualSlope < 0 && actualPctPerWeek < -0.15) {
    status = 'regressing';
  } else if (expectedPctPerWeek <= 0.02) {
    status = actualPctPerWeek >= -0.05 ? 'on-track' : 'slowing';
  } else {
    const ratio = actualPctPerWeek / expectedPctPerWeek;
    if (ratio >= 1.15) status = 'ahead';
    else if (ratio >= 0.7) status = 'on-track';
    else if (ratio >= 0.15) status = 'slowing';
    else status = 'plateaued';
  }

  return { status, actualPctPerWeek, expectedPctPerWeek, ...STATUS_META[status] };
}

export function trackedExerciseIds() {
  const ids = new Set();
  for (const w of state.workouts) for (const s of w.sets) ids.add(s.exerciseId);
  return [...ids];
}

// Bodyweight expected trajectory, piecewise by phase log (mirrors the lift model).
export function buildBodyweightPlan(projectDays = 21) {
  const log = state.bodyweightLog;
  if (!log.length) return { epoch: null, points: [] };
  const epoch = log[0].date;
  const endDate = addDays(todayStr(), projectDays);
  const totalDays = Math.max(1, daysBetween(epoch, endDate));
  let value = log[0].weightKg;
  const points = [];
  for (let d = 0; d <= totalDays; d++) {
    const dateStr = addDays(epoch, d);
    if (d > 0) {
      const phase = phaseAt(dateStr);
      value += phase.ratePerWeekKg / 7;
    }
    if (d % 3 === 0 || d === totalDays) {
      points.push({ x: dayIndex(epoch, dateStr), y: value, dateStr, projected: dateStr > todayStr() });
    }
  }
  return { epoch, points };
}

export function phaseBandsForRange(epoch, endX) {
  const sorted = [...state.phaseLog].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];
  const colors = { bulk: '#6fd0a8', cut: '#ff6b6b', maintain: '#6fb8ff' };
  const bands = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const x0 = Math.max(0, dayIndex(epoch, cur.date));
    const x1 = next ? dayIndex(epoch, next.date) : endX;
    bands.push({ x0, x1, color: colors[cur.phase] || '#888', label: cur.phase });
  }
  return bands;
}
