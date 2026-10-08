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
using a touch control, or downloading a replay during play. Buttons and form
fields retain their native keyboard behavior; held keys repeat movement but do
not repeatedly carve, rotate or hold.

Switching away from the window or hiding the document pauses the run. Resume is
explicit and preserves the board, queue, score and partially elapsed animation
step. Reloading the page starts a fresh session; runs are not saved to storage.
Restart after a loss or win resets the run and starts a new replay.

Download replay exports JSON for the current run. Version 3 records the random
seed, mode, accepted and rejected inputs, animation ticks, pause/resume, an
explicit end of a stuck easy run, and the final snapshot. `t` is fractional
milliseconds relative to start for display; `clock` retains the original engine
timestamp. To reconstruct a run, initialize
`ReverseTetrisEngine` with `createSeededRng(seed)` and apply events in array order:
`start(clock, options)`, `handleKey(key, code)`, `tick(clock)`, `pause()`, `resume(clock)`, or
`endStuckEasyModeGame()` for `end-stuck`.

Before input and export, the log captures the last processed engine tick without
advancing the live game. This preserves time spent waiting before the first
carve. While a piece escapes, every tick is recorded to reproduce the exact
floating-point timer updates at step boundaries. This can add about 60 events
per second on a 60 Hz display; idle frames still add none. Boundary ticks may
repeat or precede a key's timestamp; do not sort events by time, rebase `clock`,
or advance the engine for key events. Version 2 files lack these timings and
cannot always reconstruct a run. Version 3 also uses an explicit seeded bag
shuffle; reconstruction requires the engine's version 3 rules, not the earlier
runtime-dependent random sort. There is no replay import UI. See
`test/session.test.ts` for reconstruction and interruption regressions.

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
pnpm benchmark:idle # compare original main with the current working tree
```

The idle-frame test runs 600 callbacks and asserts zero snapshots, publications
and replay ticks. Its printed elapsed time is a diagnostic, not a stable timing
threshold. Use the same Node version and machine for timing comparisons.

The benchmark loads the actual engine and loop from Git, runs the same 600 idle
callbacks for both revisions, and emits JSON with source hashes, environment,
operation counts and raw timing samples. It uses five warmups and nine alternating
rounds of twenty samples. To compare committed revisions and retain evidence:

```sh
pnpm benchmark:idle dbb0f9942fa374a04d1ad746de5a87ac8513d8db HEAD > /tmp/sirtet-idle.log
```

For JSON without pnpm's command banner, run `node scripts/benchmark-idle.mjs`
with the same arguments. Timings cover instrumented Node callback work; they do
not establish browser frame rate, input latency or battery savings. Both loops
still request animation frames while playing.

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
