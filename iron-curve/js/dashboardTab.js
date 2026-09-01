// "Dashboard" tab: at-a-glance summary tying every other tab together.
import { state, currentPhase } from './store.js';
import { computeTargets, dayTotals } from './nutrition.js';
import { trackedExerciseIds, getExerciseHistory, buildExpectedCurve, classifyStatus } from './progress.js';
import { getExerciseById } from './exercises.js';
import { ring } from './charts.js';
import { todayStr, daysBetween, fmtDateLong, displayWeight, unitLabel, escapeHtml } from './utils.js';

export function render(container, goToTab) {
  const phase = currentPhase();
  const targets = computeTargets();
  const totals = dayTotals(todayStr());
  const unit = state.profile.unit;

  const weekWorkouts = state.workouts.filter((w) => daysBetween(w.date, todayStr()) < 7).length;
  const lastWorkout = [...state.workouts].sort((a, b) => b.startedAt - a.startedAt)[0];
  const daysSince = lastWorkout ? daysBetween(lastWorkout.date, todayStr()) : null;

  const ids = trackedExerciseIds();
  const statuses = ids.map((id) => {
    const history = getExerciseHistory(id);
    const expected = buildExpectedCurve(history);
    return { id, info: classifyStatus(history, expected) };
  });
  const counts = statuses.reduce((acc, s) => { acc[s.info.status] = (acc[s.info.status] || 0) + 1; return acc; }, {});
  const needsAttention = statuses.filter((s) => s.info.status === 'plateaued' || s.info.status === 'regressing');

  const bw = state.bodyweightLog.at(-1);
  const bwPrev = state.bodyweightLog.at(-2);
  let bwTrend = '';
  if (bw && bwPrev) {
    const diff = bw.weightKg - bwPrev.weightKg;
    bwTrend = `${diff >= 0 ? '+' : ''}${displayWeight(diff, unit)} ${unitLabel(unit)} since last log`;
  }

  const phaseColor = { bulk: 'var(--accent-2)', cut: 'var(--danger)', maintain: 'var(--accent)' }[phase.phase] || 'var(--text-dim)';

  container.innerHTML = `
    <section class="card phase-banner" style="border-color:${phaseColor}">
      <div>
        <span class="phase-tag" style="background:${phaseColor}">${escapeHtml(phase.phase.toUpperCase())}</span>
        <span class="hint-text">${phase.ratePerWeekKg ? `Target ${phase.ratePerWeekKg >= 0 ? '+' : ''}${displayWeight(phase.ratePerWeekKg, unit)} ${unitLabel(unit)}/week` : 'Holding steady'} since ${fmtDateLong(phase.date)}</span>
      </div>
      <button class="text-btn" id="goProfile">Change phase →</button>
    </section>

    <div class="dash-grid">
      <section class="card dash-tile">
        <h3>Today's nutrition</h3>
        <div class="nutrition-summary compact">
          ${ring({ size: 96, stroke: 8, pct: targets.calories ? totals.cal / targets.calories : 0, label: `${Math.round(totals.cal)}`, sub: `/ ${targets.calories}` })}
          <div class="mini-macro-list">
            <span>P ${Math.round(totals.protein)} / ${targets.proteinG}g</span>
            <span>C ${Math.round(totals.carbs)} / ${targets.carbsG}g</span>
            <span>F ${Math.round(totals.fat)} / ${targets.fatG}g</span>
          </div>
        </div>
        <button class="text-btn" id="goNutrition">Log food →</button>
      </section>

      <section class="card dash-tile">
        <h3>Training</h3>
        <p class="big-stat">${weekWorkouts}<span class="big-stat-label">workouts this week</span></p>
        <p class="hint-text">${daysSince === null ? 'No workouts logged yet.' : daysSince === 0 ? 'Trained today.' : `${daysSince} day${daysSince === 1 ? '' : 's'} since last session.`}</p>
        <button class="text-btn" id="goTrain">Start a workout →</button>
      </section>

      <section class="card dash-tile">
        <h3>Bodyweight</h3>
        <p class="big-stat">${bw ? `${displayWeight(bw.weightKg, unit)}${unitLabel(unit)}` : '—'}<span class="big-stat-label">${bw ? fmtDateLong(bw.date) : 'not logged yet'}</span></p>
        <p class="hint-text">${bwTrend}</p>
        <button class="text-btn" id="goProfile2">Log weight →</button>
      </section>

      <section class="card dash-tile">
        <h3>Lift status</h3>
        ${ids.length ? `
          <div class="status-pills">
            ${counts.ahead ? `<span class="pill" style="color:var(--accent-2)">${counts.ahead} ahead</span>` : ''}
            ${counts['on-track'] ? `<span class="pill" style="color:var(--accent)">${counts['on-track']} on track</span>` : ''}
            ${counts.slowing ? `<span class="pill" style="color:var(--warn)">${counts.slowing} slowing</span>` : ''}
            ${counts.plateaued ? `<span class="pill" style="color:var(--text-dim)">${counts.plateaued} plateaued</span>` : ''}
            ${counts.regressing ? `<span class="pill" style="color:var(--danger)">${counts.regressing} regressing</span>` : ''}
          </div>
          ${needsAttention.length ? `<p class="hint-text">Needs attention: ${needsAttention.map((s) => escapeHtml(getExerciseById(state, s.id)?.name || s.id)).join(', ')}</p>` : '<p class="hint-text">Everything is on track or ahead of plan.</p>'}
        ` : '<p class="empty-msg small">Log a few workouts to see lift trends.</p>'}
        <button class="text-btn" id="goProgress">View progress →</button>
      </section>
    </div>
  `;

  container.querySelector('#goProfile').addEventListener('click', () => goToTab('profile'));
  container.querySelector('#goProfile2').addEventListener('click', () => goToTab('profile'));
  container.querySelector('#goNutrition').addEventListener('click', () => goToTab('nutrition'));
  container.querySelector('#goTrain').addEventListener('click', () => goToTab('train'));
  container.querySelector('#goProgress').addEventListener('click', () => goToTab('progress'));
}
