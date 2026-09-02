// Central state: single JSON blob in localStorage. No backend.
import { todayStr, uid } from './utils.js';

const STORAGE_KEY = 'ironCurveState_v1';

function defaultState() {
  return {
    version: 1,
    profile: {
      name: '',
      sex: 'male',
      age: 28,
      heightCm: 178,
      unit: 'kg',
      experience: 'intermediate', // novice | intermediate | advanced
      activityLevel: 'moderate', // sedentary | light | moderate | active | veryActive
      goal: 'maintain', // current default phase if phaseLog is empty
      manualNutritionOverride: false,
      manualTargets: { calories: 2400, proteinG: 160, carbsG: 260, fatG: 70 },
      restTimerSec: 90,
    },
    phaseLog: [], // { id, date, phase: bulk|cut|maintain, ratePerWeekKg, note }
    bodyweightLog: [], // { id, date, weightKg }
    customExercises: [], // { id, name, muscle }
    customSplits: [], // { id, name, days:[{name, exerciseIds}] }
    activeSplitId: 'ppl',
    activeSession: null, // { startedAt, splitId, splitDayName, sets:[] }
    workouts: [], // { id, date, splitDayName, startedAt, endedAt, durationSec, sets:[] }
    customFoods: [], // { id, name, brand, per100g:{cal,protein,carbs,fat} }
    nutritionLog: {}, // { 'YYYY-MM-DD': [ {id, name, brand, per100g, grams, mealSlot, source} ] }
    meals: [], // { id, name, items:[{name, brand, per100g, grams}] }
    weeklyPlan: {}, // { 'mon': {breakfast: mealId, ...}, ... }
    foodCache: {}, // { query: { results, ts } }
  };
}

function deepMerge(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (defaults && typeof defaults === 'object') {
    const out = { ...defaults };
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(saved)) {
        out[k] = k in defaults ? deepMerge(defaults[k], saved[k]) : saved[k];
      }
    }
    return out;
  }
  return saved === undefined ? defaults : saved;
}

// Sets logged before RIR replaced RPE only have an `rpe` field (6-10 scale).
// Convert them so old workouts still show a sensible effort value instead of
// silently losing it. RIR = "reps in reserve" is roughly 10 - RPE.
function migrateRpeToRir(set) {
  if (set.rir === undefined && typeof set.rpe === 'number') {
    set.rir = Math.max(0, Math.min(5, Math.round(10 - set.rpe)));
  }
  return set;
}

function migrate(state) {
  for (const w of state.workouts) w.sets = w.sets.map(migrateRpeToRir);
  if (state.activeSession) state.activeSession.sets = state.activeSession.sets.map(migrateRpeToRir);
  return state;
}

function loadState() {
  const defaults = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return migrate(deepMerge(defaults, JSON.parse(raw)));
  } catch {
    return defaults;
  }
}

export const state = loadState();

export function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json) {
  const parsed = JSON.parse(json);
  const merged = deepMerge(defaultState(), parsed);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, merged);
  save();
}

// --- Phase helpers ---

// Returns the active phase entry as of a given date (most recent entry with date <= target).
export function phaseAt(dateStr) {
  const sorted = [...state.phaseLog].sort((a, b) => a.date.localeCompare(b.date));
  let active = null;
  for (const p of sorted) {
    if (p.date <= dateStr) active = p;
    else break;
  }
  if (active) return active;
  return { id: 'default', date: sorted[0]?.date || dateStr, phase: state.profile.goal, ratePerWeekKg: state.profile.goal === 'bulk' ? 0.25 : state.profile.goal === 'cut' ? -0.5 : 0 };
}

export function currentPhase() {
  return phaseAt(todayStr());
}

export function addPhaseEntry(phase, ratePerWeekKg, date = todayStr(), note = '') {
  state.phaseLog.push({ id: uid(), date, phase, ratePerWeekKg, note });
  state.profile.goal = phase;
  save();
}

export function removePhaseEntry(id) {
  state.phaseLog = state.phaseLog.filter((p) => p.id !== id);
  save();
}

// --- Bodyweight helpers ---

export function logBodyweight(weightKg, date = todayStr()) {
  const existing = state.bodyweightLog.find((b) => b.date === date);
  if (existing) existing.weightKg = weightKg;
  else state.bodyweightLog.push({ id: uid(), date, weightKg });
  state.bodyweightLog.sort((a, b) => a.date.localeCompare(b.date));
  save();
}

export function latestBodyweightKg() {
  const log = state.bodyweightLog;
  return log.length ? log[log.length - 1].weightKg : 80;
}
