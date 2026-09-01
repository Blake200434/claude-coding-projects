// TDEE / macro target calculation and daily food log helpers.
import { state, save, currentPhase, latestBodyweightKg } from './store.js';
import { uid, todayStr } from './utils.js';

const ACTIVITY_MULTIPLIER = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9,
};

export function computeBMR(profile, weightKg) {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === 'female' ? base - 161 : base + 5;
}

export function computeTargets() {
  const p = state.profile;
  if (p.manualNutritionOverride) {
    return { ...p.manualTargets, bmr: null, tdee: null, computed: false };
  }
  const weightKg = latestBodyweightKg();
  const bmr = computeBMR(p, weightKg);
  const tdee = bmr * (ACTIVITY_MULTIPLIER[p.activityLevel] || 1.55);
  const phase = currentPhase();
  const rate = phase.ratePerWeekKg || 0;
  const overhead = rate > 0 ? 1.15 : 1; // bulk surplus is less than 100% efficient
  const calorieAdjust = (rate * 7700 * overhead) / 7;
  const calories = Math.max(1200, Math.round(tdee + calorieAdjust));

  const proteinPerKg = phase.phase === 'cut' ? 2.2 : phase.phase === 'bulk' ? 1.8 : 2.0;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatG = Math.round((calories * 0.28) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { calories, proteinG, carbsG, fatG, bmr: Math.round(bmr), tdee: Math.round(tdee), computed: true };
}

export function macrosFor(item) {
  const factor = item.grams / 100;
  return {
    cal: item.per100g.cal * factor,
    protein: item.per100g.protein * factor,
    carbs: item.per100g.carbs * factor,
    fat: item.per100g.fat * factor,
  };
}

export function getLogForDate(date = todayStr()) {
  return state.nutritionLog[date] || [];
}

export function addLogEntry(date, food, grams, mealSlot) {
  if (!state.nutritionLog[date]) state.nutritionLog[date] = [];
  state.nutritionLog[date].push({
    id: uid(),
    name: food.name,
    brand: food.brand || '',
    per100g: food.per100g,
    grams,
    mealSlot,
    source: food.source || 'custom',
  });
  save();
}

export function removeLogEntry(date, id) {
  if (!state.nutritionLog[date]) return;
  state.nutritionLog[date] = state.nutritionLog[date].filter((e) => e.id !== id);
  save();
}

export function dayTotals(date = todayStr()) {
  const items = getLogForDate(date);
  return items.reduce((acc, item) => {
    const m = macrosFor(item);
    acc.cal += m.cal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    return acc;
  }, { cal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function saveCustomFood(name, brand, per100g) {
  const food = { id: uid(), name, brand, per100g, source: 'custom' };
  state.customFoods.push(food);
  save();
  return food;
}
