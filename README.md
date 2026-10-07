# Sirtet

Reverse Tetris: carve tetrominoes from a solid board and give them a valid path
upwards. In normal mode, queue another carve before the escaping piece reaches
the top. Easy mode lets you carve at your own pace. Carving below the orange line
pulls the board up.

## Run locally

Use Node.js compatible with Vite 8 (20.19+ or 22.12+) and the pinned pnpm version
in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm build` creates the production bundle in `dist`; `pnpm preview` serves it
locally.

## Controls and sessions

| Action | Keyboard |
| --- | --- |
| Move cursor | Arrow keys or WASD |
| Rotate | Z / X (R also rotates right) |
| Swap or hold | C / Shift |
| Carve | Space / Enter |
| Pause or resume | P / Escape, or the Pause / Resume button |

Touch controls appear on narrow screens and devices with a coarse pointer. Each
tap performs one action. The board gets keyboard focus after starting, resuming,
or using a touch control. Buttons and form fields retain their native keyboard
behavior; held keys repeat movement but do not repeatedly carve, rotate or hold.

Switching away from the window or hiding the document pauses the run. Resume is
explicit and preserves the board, queue, score and partially elapsed animation
step. Reloading the page starts a fresh session; runs are not saved to storage.
Restart after a loss or win resets the run and starts a new replay.

Download replay exports JSON for the current run. Version 2 records the random
seed, mode, inputs (including whether they were accepted), visible animation
ticks, pause/resume events, and final snapshot. Times are milliseconds relative
to start. To reconstruct a run, initialize `ReverseTetrisEngine` with
`createSeededRng(seed)` and apply events in order: `start(t, options)`,
`handleKey(key, code)`, `tick(t)`, `pause()`, and `resume(t)`. Pause includes a
preceding tick to preserve the partial animation step. There is no replay import
UI. See the deterministic reconstruction test in `test/session.test.ts`.

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/game.ts` | Board rules, legal escape paths, scoring, queue and game state |
| `src/session.ts` | Input routing, interruption listeners, animation scheduling and replay data |
| `src/canvas.ts` | Board, cursor, escape piece and preview drawing |
| `src/ui.ts` | Status messages, overlays and control hints |
| `src/App.tsx` | Preact lifecycle wiring and accessible player controls |

The engine owns the clock. `tick(timestamp)` returns true only when the visible
state changes, so the session loop snapshots and publishes only those changes.
Idle frames and intermediate timer increments do not redraw the canvases.
Pause freezes the clock; resume rebases it to the supplied timestamp. The App
keeps the engine in a stable ref so hot updates retain its session.

## Checks

```sh
pnpm test:session # idle-frame budget, timing, interruption/input and replay regressions
pnpm test         # mechanics, UI and session tests
pnpm quality      # types, lint, coverage, unused code and duplication gates
pnpm build
```

The idle-frame test runs 600 callbacks and asserts zero snapshots, publications
and replay ticks. Its printed elapsed time is a diagnostic, not a stable timing
threshold. Use the same Node version and machine for timing comparisons.

Before shipping, check these behaviors in a real browser:

- Start normal and easy modes using both pointer and keyboard activation.
- Move, rotate, hold and carve; verify score, previews and queue transitions.
- Pause midway through an escape, wait, resume and confirm the preserved position.
- Switch tabs/windows and return; the run should remain paused until resumed.
- Lose a normal run by letting a piece escape without a queue, then restart.
- Repeat carving in easy mode and restart after an ended run.
- Check a desktop viewport, a narrow portrait viewport and a coarse pointer device.
- Download a replay and inspect its seed, ordered events and final snapshot.

Unit tests cover terminal states, no-carve recovery, repeated plays and replay
reconstruction. Browser checks still matter for focus, canvas rendering and
physical touch behavior.
