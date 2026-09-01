# Iron Curve

A complete, dependency-free gym tracker that goes further than a logbook: it
models **what your lifts and bodyweight *should* look like** while you bulk,
cut, or maintain — and plots that plan against what you actually did, so you
can see at a glance what's improving, what's plateaued, and what's regressing.

## Why it's different

Most trackers only show you a line going up (or not). Iron Curve builds a
second line: an **expected trajectory**, derived from your training experience
level (novice/intermediate/advanced) and the bulk/cut/maintain phases you log
over time, with realistic strength-gain-rate assumptions for each. Your
actual estimated 1RM per lift is plotted against it, phase periods are shaded
directly on the chart, and each lift gets a status — *ahead of plan*, *on
track*, *slowing*, *plateaued*, or *regressing* — from a rolling trend
comparison. The same expected-vs-actual model is applied to bodyweight, so
your cut or bulk has a visible target line, not just a scale reading.

On top of that:

- **Workout tracking** with built-in Push/Pull/Legs, Upper/Lower, Full Body,
  and Bro Split templates, plus a custom split builder, live session timer,
  configurable rest timer, and per-exercise "last time" recall for
  progressive overload.
- **Weekly volume by muscle group**, stacked so you can spot a lagging or
  neglected group before it becomes a weak point.
- **Calorie & macro tracking** with targets auto-calculated from your stats,
  activity level, and current phase (Mifflin-St Jeor BMR + phase-adjusted
  surplus/deficit and protein targets) — or set your own.
- **Live food lookup** against the free [Open Food Facts](https://world.openfoodfacts.org)
  database (hundreds of thousands of real products, no API key required),
  with barcode lookup, a built-in offline fallback for common whole foods,
  and local caching so repeat searches work without a network.
- **Meal planner**: save reusable meals from searched or custom foods, assign
  them across a 7-day planner grid, and log a whole meal to today in one tap.
- Everything is stored locally in your browser — nothing is uploaded anywhere
  except the food-name searches you type, which go straight to Open Food
  Facts. Export/import a full JSON backup any time from the Profile tab.

## How the expected-curve model works

For each exercise, Iron Curve estimates 1RM per session using the Epley
formula, then projects a plan line starting from your first logged session:
a weekly compounding rate (about 1.2%/week for novices, 0.5% intermediate,
0.2% advanced — realistic ballparks for a trained major lift, not a
guarantee) scaled by how supportive your current phase is (bulk ≈ full rate,
maintain ≈ ~55%, cut ≈ ~15%, reflecting that a deficit makes new strength
much harder to build). The same piecewise logic drives the bodyweight plan
line, using the rate you set when you log a phase change. Status badges
compare your actual recent trend slope against the plan's slope for the same
window. Treat it as a coaching heuristic to flag stalls early, not a medical
or scientific prediction.

## Running locally

Static site, no build step or dependencies. From this folder, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then open `http://localhost:8083/` in your browser. You can also open
`index.html` directly (the food search still works over `file://` since it
calls Open Food Facts directly), or serve the folder with any static file
server.

## Files

- `index.html` — page shell and tab navigation container
- `style.css` — all styling (dark theme, CSS variables, responsive)
- `serve.ps1` — minimal PowerShell static file server for local development
- `js/store.js` — single source of truth: state shape, localStorage
  persistence, phase log, bodyweight log, import/export
- `js/utils.js` — dates, math (incl. linear regression), unit conversion,
  formatting helpers
- `js/exercises.js` — built-in exercise database and split templates
- `js/workout.js` — Train tab: session logging, rest timer, custom split
  builder, workout history
- `js/progress.js` — the expected-vs-actual model: 1RM history, expected
  curve construction, trend/status classification, bodyweight plan
- `js/progressTab.js` — Progress tab: strength curve chart, all-lifts
  overview, bodyweight vs. plan chart, weekly volume by muscle group
- `js/charts.js` — dependency-free inline-SVG line/bar/ring/meter chart
  builders
- `js/nutrition.js` — TDEE/macro target calculation, daily food log helpers
- `js/nutritionTab.js` — Nutrition tab: targets, live food search, manual
  food entry, barcode lookup, daily log by meal
- `js/foodApi.js` — Open Food Facts search/barcode client, local caching,
  offline fallback dataset
- `js/mealsTab.js` — Meals tab: meal builder, saved meals, weekly planner
- `js/dashboardTab.js` — Dashboard tab: cross-cutting daily summary
- `js/profileTab.js` — Profile tab: personal stats, phase log, bodyweight
  log, custom exercises, nutrition target overrides, data export/import
- `js/app.js` — tab router and app entry point
