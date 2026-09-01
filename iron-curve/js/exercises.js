// Built-in exercise database and workout split templates.

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms', 'traps',
];

export const MUSCLE_LABELS = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', forearms: 'Forearms', traps: 'Traps',
};

export const MUSCLE_COLORS = {
  chest: '#ff8a5c', back: '#6fb8ff', shoulders: '#f2c14e', biceps: '#c792ea',
  triceps: '#ff6b9d', quads: '#6fd0a8', hamstrings: '#4fb0a5', glutes: '#e57373',
  calves: '#9ac96b', abs: '#ffd166', forearms: '#8d9dc4', traps: '#b0855c',
};

export const BUILTIN_EXERCISES = [
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', muscle: 'chest' },
  { id: 'incline-bench-press', name: 'Incline Barbell Bench Press', muscle: 'chest' },
  { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', muscle: 'chest' },
  { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', muscle: 'chest' },
  { id: 'dumbbell-fly', name: 'Dumbbell Fly', muscle: 'chest' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscle: 'chest' },
  { id: 'dip', name: 'Dip', muscle: 'chest' },
  { id: 'push-up', name: 'Push-Up', muscle: 'chest' },

  { id: 'deadlift', name: 'Deadlift', muscle: 'back' },
  { id: 'pull-up', name: 'Pull-Up', muscle: 'back' },
  { id: 'chin-up', name: 'Chin-Up', muscle: 'back' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'back' },
  { id: 'barbell-row', name: 'Barbell Row', muscle: 'back' },
  { id: 'dumbbell-row', name: 'Dumbbell Row', muscle: 'back' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscle: 'back' },
  { id: 't-bar-row', name: 'T-Bar Row', muscle: 'back' },
  { id: 'face-pull', name: 'Face Pull', muscle: 'back' },

  { id: 'overhead-press', name: 'Overhead Press', muscle: 'shoulders' },
  { id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', muscle: 'shoulders' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulders' },
  { id: 'front-raise', name: 'Front Raise', muscle: 'shoulders' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscle: 'shoulders' },
  { id: 'arnold-press', name: 'Arnold Press', muscle: 'shoulders' },
  { id: 'shrug', name: 'Barbell Shrug', muscle: 'traps' },

  { id: 'barbell-curl', name: 'Barbell Curl', muscle: 'biceps' },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', muscle: 'biceps' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle: 'biceps' },
  { id: 'preacher-curl', name: 'Preacher Curl', muscle: 'biceps' },
  { id: 'cable-curl', name: 'Cable Curl', muscle: 'biceps' },

  { id: 'triceps-pushdown', name: 'Triceps Pushdown', muscle: 'triceps' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscle: 'triceps' },
  { id: 'close-grip-bench', name: 'Close-Grip Bench Press', muscle: 'triceps' },
  { id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', muscle: 'triceps' },

  { id: 'back-squat', name: 'Back Squat', muscle: 'quads' },
  { id: 'front-squat', name: 'Front Squat', muscle: 'quads' },
  { id: 'leg-press', name: 'Leg Press', muscle: 'quads' },
  { id: 'leg-extension', name: 'Leg Extension', muscle: 'quads' },
  { id: 'walking-lunge', name: 'Walking Lunge', muscle: 'quads' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscle: 'quads' },

  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscle: 'hamstrings' },
  { id: 'leg-curl', name: 'Leg Curl', muscle: 'hamstrings' },
  { id: 'good-morning', name: 'Good Morning', muscle: 'hamstrings' },

  { id: 'hip-thrust', name: 'Hip Thrust', muscle: 'glutes' },
  { id: 'cable-kickback', name: 'Cable Kickback', muscle: 'glutes' },

  { id: 'standing-calf-raise', name: 'Standing Calf Raise', muscle: 'calves' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', muscle: 'calves' },

  { id: 'plank', name: 'Plank', muscle: 'abs' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscle: 'abs' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscle: 'abs' },
  { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', muscle: 'abs' },

  { id: 'farmers-carry', name: "Farmer's Carry", muscle: 'forearms' },
  { id: 'wrist-curl', name: 'Wrist Curl', muscle: 'forearms' },
];

function ids(...names) { return names; }

export const BUILTIN_SPLITS = [
  {
    id: 'ppl', name: 'Push / Pull / Legs', builtin: true,
    days: [
      { name: 'Push', exerciseIds: ids('barbell-bench-press', 'incline-dumbbell-press', 'overhead-press', 'lateral-raise', 'triceps-pushdown', 'dip') },
      { name: 'Pull', exerciseIds: ids('deadlift', 'pull-up', 'barbell-row', 'seated-cable-row', 'face-pull', 'barbell-curl') },
      { name: 'Legs', exerciseIds: ids('back-squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'standing-calf-raise', 'hanging-leg-raise') },
    ],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower', builtin: true,
    days: [
      { name: 'Upper', exerciseIds: ids('barbell-bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'barbell-curl', 'triceps-pushdown') },
      { name: 'Lower', exerciseIds: ids('back-squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'standing-calf-raise', 'plank') },
    ],
  },
  {
    id: 'full-body', name: 'Full Body (A/B/C)', builtin: true,
    days: [
      { name: 'Full Body A', exerciseIds: ids('back-squat', 'barbell-bench-press', 'barbell-row', 'lateral-raise', 'plank') },
      { name: 'Full Body B', exerciseIds: ids('deadlift', 'overhead-press', 'lat-pulldown', 'leg-press', 'hanging-leg-raise') },
      { name: 'Full Body C', exerciseIds: ids('front-squat', 'incline-dumbbell-press', 'seated-cable-row', 'romanian-deadlift', 'barbell-curl') },
    ],
  },
  {
    id: 'bro-split', name: 'Bro Split', builtin: true,
    days: [
      { name: 'Chest', exerciseIds: ids('barbell-bench-press', 'incline-dumbbell-press', 'dumbbell-fly', 'cable-crossover', 'dip') },
      { name: 'Back', exerciseIds: ids('deadlift', 'pull-up', 'barbell-row', 't-bar-row', 'face-pull') },
      { name: 'Shoulders', exerciseIds: ids('overhead-press', 'lateral-raise', 'rear-delt-fly', 'front-raise', 'shrug') },
      { name: 'Legs', exerciseIds: ids('back-squat', 'romanian-deadlift', 'leg-press', 'leg-extension', 'standing-calf-raise') },
      { name: 'Arms', exerciseIds: ids('barbell-curl', 'hammer-curl', 'skull-crusher', 'triceps-pushdown', 'preacher-curl') },
    ],
  },
];

export function getAllExercises(state) {
  return [...BUILTIN_EXERCISES, ...(state.customExercises || [])];
}

export function getExerciseById(state, id) {
  return getAllExercises(state).find((e) => e.id === id) || null;
}

export function getAllSplits(state) {
  return [...BUILTIN_SPLITS, ...(state.customSplits || [])];
}

export function getSplitById(state, id) {
  return getAllSplits(state).find((s) => s.id === id) || null;
}
