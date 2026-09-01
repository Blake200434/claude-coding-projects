const STORAGE_KEY = 'focusSprintState';
const RING_CIRCUMFERENCE = 2 * Math.PI * 90;

const modeMeta = {
  focus: { label: 'Focus sprint', color: '--accent', settingsKey: 'focusMin' },
  short: { label: 'Short break', color: '--break', settingsKey: 'shortMin' },
  long: { label: 'Long break', color: '--break', settingsKey: 'longMin' },
};

const el = {
  streakValue: document.getElementById('streakValue'),
  todayValue: document.getElementById('todayValue'),
  modeBtns: document.querySelectorAll('.mode-btn'),
  ringProgress: document.getElementById('ringProgress'),
  timeLabel: document.getElementById('timeLabel'),
  modeLabel: document.getElementById('modeLabel'),
  startPauseBtn: document.getElementById('startPauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  focusMin: document.getElementById('focusMin'),
  shortMin: document.getElementById('shortMin'),
  longMin: document.getElementById('longMin'),
  cycleCount: document.getElementById('cycleCount'),
  logList: document.getElementById('logList'),
  emptyLog: document.getElementById('emptyLog'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  noteModal: document.getElementById('noteModal'),
  noteInput: document.getElementById('noteInput'),
  saveNoteBtn: document.getElementById('saveNoteBtn'),
  skipNoteBtn: document.getElementById('skipNoteBtn'),
};

el.ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const defaults = {
    streak: 0,
    lastActiveDate: null,
    todayDate: todayStr(),
    todayCount: 0,
    completedInCycle: 0,
    log: [],
    settings: { focusMin: 25, shortMin: 5, longMin: 15, cycleCount: 4 },
  };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed, settings: { ...defaults.settings, ...parsed.settings } };
  } catch {
    return defaults;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// Roll over today's count if the date has changed since last load.
if (state.todayDate !== todayStr()) {
  state.todayDate = todayStr();
  state.todayCount = 0;
  saveState();
}

let currentMode = 'focus';
let remainingSeconds = state.settings.focusMin * 60;
let totalSeconds = remainingSeconds;
let timerId = null;
let isRunning = false;

function applySettingsToInputs() {
  el.focusMin.value = state.settings.focusMin;
  el.shortMin.value = state.settings.shortMin;
  el.longMin.value = state.settings.longMin;
  el.cycleCount.value = state.settings.cycleCount;
}

function durationForMode(mode) {
  const key = modeMeta[mode].settingsKey;
  return state.settings[key] * 60;
}

function setMode(mode, resetTime = true) {
  currentMode = mode;
  el.modeBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
  el.modeLabel.textContent = modeMeta[mode].label;
  const color = getComputedStyle(document.documentElement).getPropertyValue(modeMeta[mode].color);
  el.ringProgress.style.stroke = color.trim();
  if (resetTime) {
    stopTimer();
    remainingSeconds = durationForMode(mode);
    totalSeconds = remainingSeconds;
    updateDisplay();
  }
}

function updateDisplay() {
  const mins = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');
  el.timeLabel.textContent = `${mins}:${secs}`;
  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  el.ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
  document.title = isRunning ? `${mins}:${secs} — Focus Sprint` : 'Focus Sprint';
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not available; ignore.
  }
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  el.startPauseBtn.textContent = 'Pause';
  const tickStart = Date.now();
  const startingRemaining = remainingSeconds;
  timerId = setInterval(() => {
    const elapsed = Math.round((Date.now() - tickStart) / 1000);
    remainingSeconds = Math.max(0, startingRemaining - elapsed);
    updateDisplay();
    if (remainingSeconds <= 0) {
      completeSprint();
    }
  }, 250);
}

function stopTimer() {
  isRunning = false;
  el.startPauseBtn.textContent = 'Start';
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function resetTimer() {
  stopTimer();
  remainingSeconds = durationForMode(currentMode);
  totalSeconds = remainingSeconds;
  updateDisplay();
}

function completeSprint() {
  stopTimer();
  beep();
  remainingSeconds = 0;
  updateDisplay();

  if (currentMode === 'focus') {
    registerCompletedFocusSprint();
    openNoteModal();
  } else {
    // Break finished; head back to focus automatically.
    setMode('focus');
  }
}

function registerCompletedFocusSprint() {
  const today = todayStr();
  if (state.todayDate !== today) {
    state.todayDate = today;
    state.todayCount = 0;
  }
  state.todayCount += 1;

  if (state.lastActiveDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    state.streak = state.lastActiveDate === yStr ? state.streak + 1 : 1;
    state.lastActiveDate = today;
  }

  state.completedInCycle += 1;
  saveState();
  renderStats();
}

function openNoteModal() {
  el.noteInput.value = '';
  el.noteModal.classList.add('visible');
  setTimeout(() => el.noteInput.focus(), 50);
}

function closeNoteModal() {
  el.noteModal.classList.remove('visible');
  advanceAfterFocus();
}

function advanceAfterFocus() {
  const cycleLen = state.settings.cycleCount;
  if (state.completedInCycle >= cycleLen) {
    state.completedInCycle = 0;
    saveState();
    setMode('long');
  } else {
    setMode('short');
  }
}

function addLogEntry(note) {
  const now = new Date();
  state.log.unshift({
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    mode: 'focus',
    note: note || '',
  });
  state.log = state.log.slice(0, 200);
  saveState();
  renderLog();
}

function renderLog() {
  el.logList.innerHTML = '';
  el.emptyLog.style.display = state.log.length ? 'none' : 'block';
  state.log.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'log-item';
    const meta = document.createElement('div');
    meta.className = 'log-item-meta';
    meta.textContent = `${entry.date} · ${entry.time}`;
    li.appendChild(meta);
    if (entry.note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'log-item-note';
      noteEl.textContent = entry.note;
      li.appendChild(noteEl);
    }
    el.logList.appendChild(li);
  });
}

function renderStats() {
  el.streakValue.textContent = state.streak;
  el.todayValue.textContent = state.todayCount;
}

// --- Event wiring ---

el.modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

el.startPauseBtn.addEventListener('click', () => {
  if (isRunning) {
    stopTimer();
  } else {
    if (remainingSeconds <= 0) remainingSeconds = durationForMode(currentMode);
    startTimer();
  }
});

el.resetBtn.addEventListener('click', resetTimer);

[el.focusMin, el.shortMin, el.longMin, el.cycleCount].forEach((input) => {
  input.addEventListener('change', () => {
    state.settings.focusMin = Math.max(1, parseInt(el.focusMin.value, 10) || 25);
    state.settings.shortMin = Math.max(1, parseInt(el.shortMin.value, 10) || 5);
    state.settings.longMin = Math.max(1, parseInt(el.longMin.value, 10) || 15);
    state.settings.cycleCount = Math.max(1, parseInt(el.cycleCount.value, 10) || 4);
    saveState();
    if (!isRunning) {
      remainingSeconds = durationForMode(currentMode);
      totalSeconds = remainingSeconds;
      updateDisplay();
    }
  });
});

el.saveNoteBtn.addEventListener('click', () => {
  addLogEntry(el.noteInput.value.trim());
  closeNoteModal();
});

el.skipNoteBtn.addEventListener('click', () => {
  addLogEntry('');
  closeNoteModal();
});

el.noteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.saveNoteBtn.click();
});

el.clearLogBtn.addEventListener('click', () => {
  if (confirm('Clear all sprint log entries?')) {
    state.log = [];
    saveState();
    renderLog();
  }
});

// --- Init ---
applySettingsToInputs();
setMode('focus');
renderStats();
renderLog();
