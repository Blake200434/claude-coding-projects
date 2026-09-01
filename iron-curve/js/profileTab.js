// "Profile" tab: personal stats, training phase log, bodyweight log, custom exercises, data tools.
import { state, save, addPhaseEntry, removePhaseEntry, logBodyweight } from './store.js';
import { MUSCLE_GROUPS, MUSCLE_LABELS } from './exercises.js';
import { uid, todayStr, fmtDateLong, displayWeight, toKg, unitLabel, escapeHtml, round } from './utils.js';
import { exportJSON, importJSON, resetAll } from './store.js';

export function render(container) {
  const p = state.profile;
  const unit = p.unit;

  container.innerHTML = `
    <section class="card">
      <h2>Personal details</h2>
      <div class="form-grid">
        <label class="field"><span>Name</span><input type="text" id="pfName" value="${escapeHtml(p.name)}"></label>
        <label class="field"><span>Sex</span>
          <select id="pfSex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select>
        </label>
        <label class="field"><span>Age</span><input type="number" id="pfAge" value="${p.age}" min="13" max="90"></label>
        <label class="field"><span>Height (cm)</span><input type="number" id="pfHeight" value="${p.heightCm}" min="120" max="230"></label>
        <label class="field"><span>Units</span>
          <select id="pfUnit"><option value="kg" ${unit === 'kg' ? 'selected' : ''}>Kilograms</option><option value="lb" ${unit === 'lb' ? 'selected' : ''}>Pounds</option></select>
        </label>
        <label class="field"><span>Training experience</span>
          <select id="pfExperience">
            <option value="novice" ${p.experience === 'novice' ? 'selected' : ''}>Novice (&lt;1 yr)</option>
            <option value="intermediate" ${p.experience === 'intermediate' ? 'selected' : ''}>Intermediate (1–3 yr)</option>
            <option value="advanced" ${p.experience === 'advanced' ? 'selected' : ''}>Advanced (3+ yr)</option>
          </select>
        </label>
        <label class="field"><span>Activity level (outside training)</span>
          <select id="pfActivity">
            <option value="sedentary" ${p.activityLevel === 'sedentary' ? 'selected' : ''}>Sedentary</option>
            <option value="light" ${p.activityLevel === 'light' ? 'selected' : ''}>Lightly active</option>
            <option value="moderate" ${p.activityLevel === 'moderate' ? 'selected' : ''}>Moderately active</option>
            <option value="active" ${p.activityLevel === 'active' ? 'selected' : ''}>Active</option>
            <option value="veryActive" ${p.activityLevel === 'veryActive' ? 'selected' : ''}>Very active</option>
          </select>
        </label>
        <label class="field"><span>Rest timer default (sec)</span><input type="number" id="pfRest" value="${p.restTimerSec}" min="10" step="5"></label>
      </div>
      <button class="primary-btn" id="saveProfileBtn">Save details</button>
    </section>

    <section class="card">
      <h2>Bodyweight log</h2>
      <form id="bwForm" class="inline-form">
        <input type="number" id="bwValue" step="0.1" min="0" placeholder="Weight (${unitLabel(unit)})" required>
        <input type="date" id="bwDate" value="${todayStr()}">
        <button type="submit" class="secondary-btn">Log weight</button>
      </form>
      <div class="mini-list">
        ${[...state.bodyweightLog].reverse().slice(0, 10).map((b) => `
          <div class="mini-row"><span>${fmtDateLong(b.date)}</span><span>${displayWeight(b.weightKg, unit)} ${unitLabel(unit)}</span></div>
        `).join('') || '<p class="empty-msg small">No entries yet</p>'}
      </div>
    </section>

    <section class="card">
      <h2>Training phase log</h2>
      <p class="hint-text">Log when you start bulking, cutting, or maintaining, with a target weekly rate. This drives the expected strength &amp; bodyweight curves in the Progress tab.</p>
      <form id="phaseForm" class="inline-form">
        <select id="phaseType">
          <option value="bulk">Bulk</option>
          <option value="cut">Cut</option>
          <option value="maintain">Maintain</option>
        </select>
        <input type="number" id="phaseRate" step="0.05" placeholder="Rate (${unitLabel(unit)}/week)" value="${unit === 'kg' ? 0.25 : 0.5}">
        <input type="date" id="phaseDate" value="${todayStr()}">
        <button type="submit" class="secondary-btn">Start phase</button>
      </form>
      <div class="mini-list">
        ${[...state.phaseLog].sort((a, b) => b.date.localeCompare(a.date)).map((ph) => `
          <div class="mini-row">
            <span>${fmtDateLong(ph.date)} — <strong>${escapeHtml(ph.phase)}</strong></span>
            <span>${ph.ratePerWeekKg >= 0 ? '+' : ''}${displayWeight(ph.ratePerWeekKg, unit)} ${unitLabel(unit)}/wk</span>
            <button class="icon-btn danger remove-phase" data-id="${ph.id}">✕</button>
          </div>
        `).join('') || '<p class="empty-msg small">No phases logged — defaulting to "maintain".</p>'}
      </div>
    </section>

    <section class="card">
      <h2>Nutrition targets</h2>
      <label class="checkbox-field">
        <input type="checkbox" id="pfManualNutrition" ${p.manualNutritionOverride ? 'checked' : ''}>
        <span>Set my own calorie &amp; macro targets instead of auto-calculating</span>
      </label>
      <div class="form-grid" id="manualTargetsGrid" style="${p.manualNutritionOverride ? '' : 'display:none'}">
        <label class="field"><span>Calories</span><input type="number" id="mtCal" value="${p.manualTargets.calories}"></label>
        <label class="field"><span>Protein (g)</span><input type="number" id="mtProtein" value="${p.manualTargets.proteinG}"></label>
        <label class="field"><span>Carbs (g)</span><input type="number" id="mtCarbs" value="${p.manualTargets.carbsG}"></label>
        <label class="field"><span>Fat (g)</span><input type="number" id="mtFat" value="${p.manualTargets.fatG}"></label>
      </div>
      <button class="primary-btn" id="saveNutritionBtn">Save nutrition settings</button>
    </section>

    <section class="card">
      <h2>Custom exercises</h2>
      <form id="customExForm" class="inline-form">
        <input type="text" id="cexName" placeholder="Exercise name" required>
        <select id="cexMuscle">${MUSCLE_GROUPS.map((m) => `<option value="${m}">${MUSCLE_LABELS[m]}</option>`).join('')}</select>
        <button type="submit" class="secondary-btn">Add exercise</button>
      </form>
      <div class="mini-list">
        ${state.customExercises.map((e) => `
          <div class="mini-row"><span>${escapeHtml(e.name)}</span><span>${MUSCLE_LABELS[e.muscle]}</span>
            <button class="icon-btn danger remove-cex" data-id="${e.id}">✕</button></div>
        `).join('') || '<p class="empty-msg small">No custom exercises yet</p>'}
      </div>
    </section>

    <section class="card">
      <h2>Your data</h2>
      <p class="hint-text">Everything is stored locally in this browser only — nothing is uploaded anywhere. Export a backup or move it to another browser/device.</p>
      <div class="picker-actions">
        <button class="secondary-btn" id="exportBtn">Export backup (.json)</button>
        <button class="secondary-btn" id="importBtn">Import backup</button>
        <input type="file" id="importFile" accept="application/json" class="hidden">
        <button class="text-btn danger-text" id="resetBtn">Erase all data</button>
      </div>
    </section>
  `;

  wireEvents(container);
}

function wireEvents(container) {
  container.querySelector('#saveProfileBtn').addEventListener('click', () => {
    const p = state.profile;
    p.name = container.querySelector('#pfName').value.trim();
    p.sex = container.querySelector('#pfSex').value;
    p.age = parseInt(container.querySelector('#pfAge').value, 10) || p.age;
    p.heightCm = parseFloat(container.querySelector('#pfHeight').value) || p.heightCm;
    p.unit = container.querySelector('#pfUnit').value;
    p.experience = container.querySelector('#pfExperience').value;
    p.activityLevel = container.querySelector('#pfActivity').value;
    p.restTimerSec = parseInt(container.querySelector('#pfRest').value, 10) || p.restTimerSec;
    save();
    render(container);
  });

  container.querySelector('#bwForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseFloat(container.querySelector('#bwValue').value);
    const date = container.querySelector('#bwDate').value || todayStr();
    if (!val) return;
    logBodyweight(round(toKg(val, state.profile.unit), 2), date);
    render(container);
  });

  container.querySelector('#phaseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const phase = container.querySelector('#phaseType').value;
    const rateInput = parseFloat(container.querySelector('#phaseRate').value) || 0;
    const date = container.querySelector('#phaseDate').value || todayStr();
    const sign = phase === 'cut' ? -1 : phase === 'bulk' ? 1 : 0;
    const rateKg = phase === 'maintain' ? 0 : sign * Math.abs(toKg(rateInput, state.profile.unit));
    addPhaseEntry(phase, round(rateKg, 3), date);
    render(container);
  });

  container.querySelectorAll('.remove-phase').forEach((btn) => {
    btn.addEventListener('click', () => { removePhaseEntry(btn.dataset.id); render(container); });
  });

  const manualCheckbox = container.querySelector('#pfManualNutrition');
  manualCheckbox.addEventListener('change', () => {
    container.querySelector('#manualTargetsGrid').style.display = manualCheckbox.checked ? '' : 'none';
  });

  container.querySelector('#saveNutritionBtn').addEventListener('click', () => {
    state.profile.manualNutritionOverride = manualCheckbox.checked;
    state.profile.manualTargets = {
      calories: parseInt(container.querySelector('#mtCal').value, 10) || 2000,
      proteinG: parseInt(container.querySelector('#mtProtein').value, 10) || 150,
      carbsG: parseInt(container.querySelector('#mtCarbs').value, 10) || 200,
      fatG: parseInt(container.querySelector('#mtFat').value, 10) || 60,
    };
    save();
    render(container);
  });

  container.querySelector('#customExForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#cexName').value.trim();
    const muscle = container.querySelector('#cexMuscle').value;
    if (!name) return;
    state.customExercises.push({ id: uid(), name, muscle });
    save();
    render(container);
  });

  container.querySelectorAll('.remove-cex').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.customExercises = state.customExercises.filter((e) => e.id !== btn.dataset.id);
      save();
      render(container);
    });
  });

  container.querySelector('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iron-curve-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = container.querySelector('#importFile');
  container.querySelector('#importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { importJSON(reader.result); window.location.reload(); }
      catch { alert('That file could not be read as an Iron Curve backup.'); }
    };
    reader.readAsText(file);
  });

  container.querySelector('#resetBtn').addEventListener('click', () => {
    if (confirm('This permanently erases all Iron Curve data in this browser. Continue?')) resetAll();
  });
}
