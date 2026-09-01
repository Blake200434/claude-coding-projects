# Word Ladder Duel

A browser-based word ladder puzzle game against the clock. Change one letter at a
time to turn the start word into the target word before time runs out.

## How to play

1. You're given a **start word** and a **target word** of the same length.
2. Type a new word that changes exactly one letter from the last word in your ladder.
3. Every word you enter must be a real word from the puzzle's word list.
4. Reach the target word before the timer runs out to solve the puzzle.

Difficulty affects word length, how many steps the puzzle expects, and how much
time you get:

| Difficulty | Word length | Steps  | Time  |
| ---------- | ----------- | ------ | ----- |
| Easy       | 3 letters   | 2–3    | 60s   |
| Medium     | 4 letters   | 3–5    | 75s   |
| Hard       | 5 letters   | 4–7    | 100s  |

Use **Hint** to reveal the next word on an optimal path (costs 15 seconds), or
**Give Up** to see a solution and start over. Scores reward finishing quickly
and in as few steps as possible; your best score per difficulty and current
streak are saved locally in your browser.

## Running locally

This is a static site with no build step or dependencies. From this folder, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then open `http://localhost:8082/` in your browser.

Alternatively, open `index.html` directly, or serve the folder with any static
file server of your choice (the app just needs `index.html`, `app.js`,
`style.css`, and the `words3.json` / `words4.json` / `words5.json` word lists
to be fetchable).

## Files

- `index.html` — page structure
- `style.css` — styling
- `app.js` — game logic (puzzle generation via BFS over the word graph, guess
  validation, scoring, timer)
- `words3.json`, `words4.json`, `words5.json` — word lists for each difficulty
- `serve.ps1` — minimal PowerShell static file server for local development
