const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const palettes = {
  sunset: ['#ff7a5c', '#ff9d5c', '#ffc65c', '#ff5c8a', '#ffe08a'],
  ocean: ['#2ee6d6', '#3a6df0', '#5ce1ff', '#1e9bd6', '#a2f4ff'],
  neon: ['#ff2ec4', '#7dff4f', '#4ff0ff', '#f7ff4f', '#c04fff'],
  pastel: ['#ffb3d9', '#b3d9ff', '#c9ffb3', '#ffe3b3', '#d9b3ff'],
  mono: ['#e8eaf2', '#c3c8db', '#9aa0b4', '#7a8099', '#f5f6fa'],
};

const bgColor = '#0a0b12';

const state = {
  mode: 'flow',
  palette: 'sunset',
  brushSize: 6,
  density: 5,
  fade: 6,
  symmetry: 6,
};

let particles = [];
const MAX_PARTICLES = 5000;

let dpr = Math.max(1, window.devicePixelRatio || 1);

function resizeCanvas() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function randomColor() {
  const list = palettes[state.palette];
  return list[Math.floor(Math.random() * list.length)];
}

function flowAngle(x, y, t) {
  const s = 0.0022;
  const n =
    Math.sin(x * s + t * 0.6) +
    Math.cos(y * s - t * 0.5) +
    Math.sin((x + y) * s * 0.6 + t * 0.35) +
    Math.cos((x - y) * s * 0.8 - t * 0.25);
  return n * Math.PI * 0.5;
}

function makeParticle(x, y, opts) {
  return {
    x, y,
    px: x, py: y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    life: opts.life,
    maxLife: opts.life,
    size: opts.size,
    color: opts.color || randomColor(),
    gravity: opts.gravity || 0,
    friction: opts.friction != null ? opts.friction : 0.95,
    force: opts.force != null ? opts.force : 0.14,
    kind: opts.kind || 'flow',
  };
}

function spawnFlowCluster(x, y, count, extra) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 0.6;
    particles.push(makeParticle(
      x + (Math.random() - 0.5) * 4,
      y + (Math.random() - 0.5) * 4,
      {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 120 + Math.random() * 160,
        size: state.brushSize * (0.5 + Math.random() * 0.9),
        kind: 'flow',
        ...extra,
      }
    ));
  }
}

function spawnFireworkShell(x, y) {
  const count = 14 + Math.floor(state.density * 2.5);
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3.5;
    particles.push(makeParticle(x, y, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 50 + Math.random() * 50,
      size: state.brushSize * (0.4 + Math.random() * 0.7),
      gravity: 0.05,
      friction: 0.97,
      kind: 'firework',
    }));
  }
}

function mirroredPoints(x, y) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const baseAngle = Math.atan2(dy, dx);
  const n = state.symmetry;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = baseAngle + (k * Math.PI * 2) / n;
    pts.push({ x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist });
  }
  return pts;
}

let lastSpawnPoint = null;

function handleStrokePoint(x, y) {
  if (state.mode === 'fireworks') {
    if (!lastSpawnPoint || Math.hypot(x - lastSpawnPoint.x, y - lastSpawnPoint.y) > 26 - state.density) {
      spawnFireworkShell(x, y);
      lastSpawnPoint = { x, y };
    }
    return;
  }

  if (!lastSpawnPoint) {
    lastSpawnPoint = { x, y };
  }
  const spacing = Math.max(2, 12 - state.density);
  const dist = Math.hypot(x - lastSpawnPoint.x, y - lastSpawnPoint.y);
  const steps = Math.max(1, Math.floor(dist / spacing));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = lastSpawnPoint.x + (x - lastSpawnPoint.x) * t;
    const py = lastSpawnPoint.y + (y - lastSpawnPoint.y) * t;

    if (state.mode === 'kaleidoscope') {
      const color = randomColor();
      mirroredPoints(px, py).forEach((pt) => {
        spawnFlowCluster(pt.x, pt.y, 1, { color, life: 140 + Math.random() * 120 });
      });
    } else {
      spawnFlowCluster(px, py, Math.max(1, Math.round(state.density / 2)));
    }
  }
  lastSpawnPoint = { x, y };
}

let isDrawing = false;

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (e) => {
  isDrawing = true;
  lastSpawnPoint = null;
  const { x, y } = pointerPos(e);
  handleStrokePoint(x, y);
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  const { x, y } = pointerPos(e);
  handleStrokePoint(x, y);
});

function endStroke() {
  isDrawing = false;
  lastSpawnPoint = null;
}

canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', endStroke);

let frame = 0;

function step() {
  frame++;
  const t = frame * 0.016;

  const fadeAlpha = 0.004 + (state.fade / 30) * 0.07;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = fadeAlpha;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.px = p.x;
    p.py = p.y;

    if (p.kind === 'firework') {
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
    } else {
      const angle = flowAngle(p.x, p.y, t);
      p.vx += Math.cos(angle) * p.force;
      p.vy += Math.sin(angle) * p.force;
      p.vx *= p.friction;
      p.vy *= p.friction;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;

    const lifeRatio = Math.max(0, p.life / p.maxLife);
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.15 + lifeRatio * 0.55;
    ctx.lineWidth = Math.max(0.5, p.size * Math.sqrt(lifeRatio));
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    if (
      p.life <= 0 ||
      p.x < -50 || p.x > window.innerWidth + 50 ||
      p.y < -50 || p.y > window.innerHeight + 50
    ) {
      particles.splice(i, 1);
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  requestAnimationFrame(step);
}

requestAnimationFrame(step);

// --- UI wiring ---

const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panelToggle');
panelToggle.addEventListener('click', () => panel.classList.toggle('hidden'));

const modeRow = document.getElementById('modeRow');
const symmetryField = document.getElementById('symmetryField');

modeRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.opt-btn');
  if (!btn) return;
  state.mode = btn.dataset.mode;
  modeRow.querySelectorAll('.opt-btn').forEach((b) => b.classList.toggle('active', b === btn));
  symmetryField.classList.toggle('visible', state.mode === 'kaleidoscope');
});

const paletteRow = document.getElementById('paletteRow');
paletteRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  state.palette = btn.dataset.palette;
  paletteRow.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b === btn));
});

function bindSlider(id, key, labelId, transform) {
  const input = document.getElementById(id);
  const label = document.getElementById(labelId);
  input.addEventListener('input', () => {
    const val = Number(input.value);
    state[key] = val;
    label.textContent = transform ? transform(val) : val;
  });
}

bindSlider('brushSize', 'brushSize', 'brushSizeVal');
bindSlider('density', 'density', 'densityVal');
bindSlider('fade', 'fade', 'fadeVal');
bindSlider('symmetry', 'symmetry', 'symmetryVal');

document.getElementById('clearBtn').addEventListener('click', () => {
  particles = [];
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
});

document.getElementById('saveBtn').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doodle-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});
