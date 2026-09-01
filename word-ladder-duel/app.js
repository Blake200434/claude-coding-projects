const DIFFICULTY = {
  easy: { length: 3, minSteps: 2, maxSteps: 3, time: 60, file: 'words3.json' },
  medium: { length: 4, minSteps: 3, maxSteps: 5, time: 75, file: 'words4.json' },
  hard: { length: 5, minSteps: 4, maxSteps: 7, time: 100, file: 'words5.json' },
};

const el = {
  streakValue: document.getElementById('streakValue'),
  bestValue: document.getElementById('bestValue'),
  difficultyRow: document.getElementById('difficultyRow'),
  timerFill: document.getElementById('timerFill'),
  timerLabel: document.getElementById('timerLabel'),
  board: document.getElementById('board'),
  guessForm: document.getElementById('guessForm'),
  guessInput: document.getElementById('guessInput'),
  feedback: document.getElementById('feedback'),
  hintBtn: document.getElementById('hintBtn'),
  giveUpBtn: document.getElementById('giveUpBtn'),
  newBtn: document.getElementById('newBtn'),
  resultModal: document.getElementById('resultModal'),
  resultTitle: document.getElementById('resultTitle'),
  resultBody: document.getElementById('resultBody'),
  resultPath: document.getElementById('resultPath'),
  playAgainBtn: document.getElementById('playAgainBtn'),
};

const wordSets = {};
const wordLists = {};

const STORAGE_KEY = 'wordLadderDuel';

function loadMeta() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const defaults = { streak: 0, best: { easy: 0, medium: 0, hard: 0 } };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed, best: { ...defaults.best, ...parsed.best } };
  } catch {
    return defaults;
  }
}

function saveMeta() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

let meta = loadMeta();

const game = {
  difficulty: 'easy',
  start: '',
  target: '',
  ladder: [],
  solved: false,
  active: false,
  timeRemaining: 0,
  totalTime: 0,
  timerId: null,
};

function neighbors(word, wordSet) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const result = [];
  for (let i = 0; i < word.length; i++) {
    for (const c of letters) {
      if (c === word[i]) continue;
      const cand = word.slice(0, i) + c + word.slice(i + 1);
      if (wordSet.has(cand)) result.push(cand);
    }
  }
  return result;
}

function bfsDistances(start, wordSet) {
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const n of neighbors(cur, wordSet)) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur) + 1);
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  return { dist, prev };
}

function reconstructPath(prev, start, end) {
  const path = [end];
  let cur = end;
  while (cur !== start) {
    cur = prev.get(cur);
    if (cur === undefined) return null;
    path.push(cur);
  }
  path.reverse();
  return path;
}

function bfsPath(start, end, wordSet) {
  if (start === end) return [start];
  const { dist, prev } = bfsDistances(start, wordSet);
  if (!dist.has(end)) return null;
  return reconstructPath(prev, start, end);
}

function oneLetterDiff(a, b) {
  if (a.length !== b.length) return false;
  let diffCount = 0;
  let diffIndex = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffCount++;
      diffIndex = i;
      if (diffCount > 1) return -1;
    }
  }
  return diffCount === 1 ? diffIndex : -1;
}

function generatePuzzle(diff) {
  const cfg = DIFFICULTY[diff];
  const list = wordLists[cfg.length];
  const set = wordSets[cfg.length];
  let fallback = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const start = list[Math.floor(Math.random() * list.length)];
    const { dist } = bfsDistances(start, set);
    const candidates = [];
    let maxEntry = null;
    for (const [word, d] of dist.entries()) {
      if (word === start) continue;
      if (d >= cfg.minSteps && d <= cfg.maxSteps) candidates.push(word);
      if (!maxEntry || d > maxEntry[1]) maxEntry = [word, d];
    }
    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      return { start, target };
    }
    if (maxEntry && (!fallback || maxEntry[1] > fallback.dist)) {
      fallback = { start, target: maxEntry[0], dist: maxEntry[1] };
    }
  }
  if (fallback) return { start: fallback.start, target: fallback.target };
  const start = list[0];
  return { start, target: list[1] };
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `${r}s`;
}

function updateTimerDisplay() {
  el.timerLabel.textContent = formatTime(game.timeRemaining);
  const ratio = Math.max(0, game.timeRemaining / game.totalTime);
  el.timerFill.style.width = `${ratio * 100}%`;
  el.timerFill.classList.toggle('urgent', ratio < 0.25);
}

function startTimer() {
  clearInterval(game.timerId);
  game.timerId = setInterval(() => {
    game.timeRemaining -= 1;
    if (game.timeRemaining <= 0) {
      game.timeRemaining = 0;
      updateTimerDisplay();
      endGame('timeout');
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(game.timerId);
  game.timerId = null;
}

function setFeedback(message, kind) {
  el.feedback.textContent = message || ' ';
  el.feedback.className = 'feedback' + (kind ? ` ${kind}` : '');
}

function renderTile(letter, changed) {
  const span = document.createElement('span');
  span.className = 'tile' + (changed ? ' changed' : '');
  span.textContent = letter;
  return span;
}

function renderBoard() {
  el.board.innerHTML = '';
  game.ladder.forEach((word, i) => {
    const rung = document.createElement('div');
    rung.className = 'rung';
    if (i === 0) rung.classList.add('endpoint');
    const prevWord = i > 0 ? game.ladder[i - 1] : null;
    for (let c = 0; c < word.length; c++) {
      const changed = prevWord ? prevWord[c] !== word[c] : false;
      rung.appendChild(renderTile(word[c], changed));
    }
    el.board.appendChild(rung);
  });

  if (!game.solved) {
    const targetRung = document.createElement('div');
    targetRung.className = 'rung target';
    for (const c of game.target) {
      targetRung.appendChild(renderTile(c, false));
    }
    el.board.appendChild(targetRung);
  }
}

function renderMeta() {
  el.streakValue.textContent = meta.streak;
  el.bestValue.textContent = meta.best[game.difficulty];
}

function startNewPuzzle(diff) {
  game.difficulty = diff;
  const cfg = DIFFICULTY[diff];
  const { start, target } = generatePuzzle(diff);
  game.start = start;
  game.target = target;
  game.ladder = [start];
  game.solved = false;
  game.active = true;
  game.timeRemaining = cfg.time;
  game.totalTime = cfg.time;

  el.difficultyRow.querySelectorAll('.diff-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === diff);
  });
  el.resultModal.classList.remove('visible');
  el.guessInput.value = '';
  el.guessInput.disabled = false;
  el.hintBtn.disabled = false;
  el.giveUpBtn.disabled = false;
  setFeedback('');
  renderBoard();
  renderMeta();
  updateTimerDisplay();
  startTimer();
  el.guessInput.focus();
}

function computeScore() {
  const cfg = DIFFICULTY[game.difficulty];
  const optimalPath = bfsPath(game.start, game.target, wordSets[cfg.length]);
  const optimalSteps = optimalPath ? optimalPath.length - 1 : game.ladder.length - 1;
  const actualSteps = game.ladder.length - 1;
  const overshoot = Math.max(0, actualSteps - optimalSteps);
  const score = Math.max(10, Math.round(100 + game.timeRemaining * 5 - overshoot * 20));
  return { score, optimalSteps, actualSteps };
}

function showResultPath(words) {
  el.resultPath.innerHTML = '';
  words.forEach((w) => {
    const span = document.createElement('span');
    span.textContent = w;
    el.resultPath.appendChild(span);
  });
}

function endGame(reason) {
  stopTimer();
  game.active = false;
  el.guessInput.disabled = true;
  el.hintBtn.disabled = true;
  el.giveUpBtn.disabled = true;

  const cfg = DIFFICULTY[game.difficulty];

  if (reason === 'solved') {
    const { score, optimalSteps, actualSteps } = computeScore();
    meta.streak += 1;
    if (score > meta.best[game.difficulty]) meta.best[game.difficulty] = score;
    saveMeta();
    renderMeta();
    el.resultTitle.textContent = 'Solved! 🎉';
    el.resultBody.textContent = `Score ${score} — ${actualSteps} steps (optimal was ${optimalSteps}), ${formatTime(game.timeRemaining)} left.`;
    showResultPath(game.ladder);
  } else {
    meta.streak = 0;
    saveMeta();
    renderMeta();
    const solutionPath = bfsPath(game.start, game.target, wordSets[cfg.length]) || [game.start, game.target];
    el.resultTitle.textContent = reason === 'timeout' ? "Time's Up" : 'Gave Up';
    el.resultBody.textContent = 'Here’s one solution:';
    showResultPath(solutionPath);
  }

  el.resultModal.classList.add('visible');
}

function submitGuess(raw) {
  if (!game.active) return;
  const word = raw.trim().toLowerCase();
  const last = game.ladder[game.ladder.length - 1];

  if (!word) return;
  if (word.length !== last.length) {
    setFeedback(`Must be ${last.length} letters`, 'error');
    shakeInput();
    return;
  }
  const set = wordSets[last.length];
  if (!set.has(word)) {
    setFeedback('Not a recognized word', 'error');
    shakeInput();
    return;
  }
  if (game.ladder.includes(word)) {
    setFeedback('Already used that word', 'error');
    shakeInput();
    return;
  }
  const diffIndex = oneLetterDiff(last, word);
  if (diffIndex === -1) {
    setFeedback('Change exactly one letter', 'error');
    shakeInput();
    return;
  }

  game.ladder.push(word);
  el.guessInput.value = '';
  setFeedback('');
  renderBoard();

  if (word === game.target) {
    game.solved = true;
    renderBoard();
    endGame('solved');
  }
}

function shakeInput() {
  el.guessInput.classList.remove('shake');
  void el.guessInput.offsetWidth;
  el.guessInput.classList.add('shake');
}

function useHint() {
  if (!game.active) return;
  const cfg = DIFFICULTY[game.difficulty];
  const last = game.ladder[game.ladder.length - 1];
  const path = bfsPath(last, game.target, wordSets[cfg.length]);
  if (!path || path.length < 2) return;
  const next = path[1];
  game.ladder.push(next);
  game.timeRemaining = Math.max(1, game.timeRemaining - 15);
  updateTimerDisplay();
  setFeedback(`Hint: ${next}`, 'success');
  renderBoard();
  if (next === game.target) {
    game.solved = true;
    renderBoard();
    endGame('solved');
  }
}

el.guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitGuess(el.guessInput.value);
});

el.guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitGuess(el.guessInput.value);
  }
});

el.difficultyRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.diff-btn');
  if (!btn) return;
  startNewPuzzle(btn.dataset.diff);
});

el.hintBtn.addEventListener('click', useHint);
el.giveUpBtn.addEventListener('click', () => endGame('giveup'));
el.newBtn.addEventListener('click', () => startNewPuzzle(game.difficulty));
el.playAgainBtn.addEventListener('click', () => startNewPuzzle(game.difficulty));

async function loadWordLists() {
  const lengths = [3, 4, 5];
  const files = { 3: 'words3.json', 4: 'words4.json', 5: 'words5.json' };
  await Promise.all(
    lengths.map(async (len) => {
      const res = await fetch(files[len]);
      const list = await res.json();
      wordLists[len] = list;
      wordSets[len] = new Set(list);
    })
  );
}

loadWordLists().then(() => {
  startNewPuzzle('easy');
});
