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

Download replay exports compact JSON for the current run, retaining every event
and timestamp. Format it in a JSON editor when inspecting it manually. Version 3
records the random seed, mode, accepted and rejected inputs, animation ticks,
pause/resume, an explicit end of a stuck easy run, and the final snapshot. `t` is fractional
milliseconds relative to start for display; `clock` retains the original engine
timestamp. To reconstruct a run, initialize
`ReverseTetrisEngine` with `createSeededRng(seed)` and apply events in array order:
`start(clock, options)`, `handleKey(key, code)`, `tick(clock)`, `pause()`, `resume(clock)`, or
`endStuckEasyModeGame()` for `end-stuck`.

While idle, input rebases the engine clock to the command time before a carve
can start. Input and export then capture the last processed engine tick in the
log; exporting does not advance the game. While a piece escapes, every tick is
recorded to reproduce the exact floating-point timer updates at step boundaries. This can add about 60 events
per second on a 60 Hz display; idle frames still add none. Boundary ticks may
repeat or precede a key's timestamp; do not sort events by time, rebase `clock`,
or advance the engine for key events. Version 2 files lack these timings and
cannot always reconstruct a run. Version 3 also uses an explicit seeded bag
shuffle; reconstruction requires the engine's version 3 rules, not the earlier
runtime-dependent random sort. There is no replay import UI. See
`test/session.test.ts` and `test/replay.test.ts` for reconstruction, interruption,
and chunk-boundary regressions.

During play, tick clocks use chunked numeric storage. Export expands one chunk
at a time into the same version 3 JSON, preserving full precision and event order.
Large exports show “Preparing replay…” and yield between batches so play can
continue. The file captures the moment Download was clicked; later input belongs
to the continuing recording. Restart cancels a pending download. Long recordings
still grow with session length; restarting releases the old log.

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/game.ts` | Board rules, legal escape paths, scoring, queue and game state |
| `src/session.ts` | Input routing, interruption listeners, animation scheduling and replay data |
| `src/replay.ts` | Compact in-memory recording and chunked version 3 export |
| `src/canvas.ts` | Board, cursor, escape piece and preview drawing |
| `src/ui.ts` | Status messages, overlays and control hints |
| `src/App.tsx` | Preact lifecycle wiring and accessible player controls |

The engine owns the clock. `tick(timestamp)` returns true only when the visible
state changes, so the session loop snapshots and publishes only those changes.
The loop requests frames only while a piece is escaping. Idle input rebases the
clock, and the App starts scheduling when a carve creates an active piece.
Intermediate timer increments do not redraw the canvases. Pause freezes the
clock; resume rebases it to the supplied timestamp. The App keeps the engine
in a stable ref so hot updates retain its session. Canvas drawing runs before the
next paint opportunity; hold/next previews update only when their shape changes.
The layout updates when displayed values or handlers change; cursor movement and
escape steps update the canvas without rebuilding unchanged controls and panels.

Private placement metadata uses flat typed buffers for cell/support addresses and
small integer keys for identical cell sets. The packed addresses rely on the fixed
10-column, 26-row board and four-cell tetrominoes. Returned paths and snapshots
remain independently owned.

Private reachability probes use depth-first search and stop when empty headroom
proves an escape. Their bounded metadata origins admit at most 1,018 states;
displayed paths retain the ordered breadth-first search. Board connectivity uses
10-bit row masks, rooted at the baseline. Changing board dimensions or rotation
rules requires revisiting these bounds and the tail fixtures.

## Checks

```sh
pnpm test:session # idle scheduling, timing, interruption/input and replay regressions
pnpm test         # mechanics, UI and session tests
pnpm quality      # types, lint, coverage, unused code and duplication gates
pnpm build
pnpm benchmark:idle   # compare merged main with the current working tree
pnpm benchmark:engine # sessions, controls, animation and difficult-carve tails
```

The session tests assert zero requested callbacks while idle, full animation beats
after long waits, and exact replay snapshots across active frames and interruptions.
Performance measurements are diagnostics, not machine-dependent timing gates.

The benchmarks load the actual sources from Git and emit JSON with revision and
source hashes, environment, raw samples and workload definitions. Both alternate
baseline/candidate order after warmup. The idle benchmark supplies 600 frame
opportunities, invoking only requested callbacks. The engine benchmark verifies
exact escape paths and intermediate session snapshots before timing native Node
modules. It also checks every shape at the cursor boundaries and fractional-clock
animation with a stationary valid ghost. Two later-session fixtures additionally
measure a single difficult carve across 30 alternating pairs, reporting p50,
p95 and maximum elapsed time and CPU. Setup stays outside control, animation and
single-carve timing. To compare revisions and retain JSON without pnpm's command banner:

```sh
node scripts/benchmark-idle.mjs 3d2d541 HEAD > /tmp/sirtet-idle.json
node scripts/benchmark-engine.mjs 3d2d541 HEAD > /tmp/sirtet-engine.json
```

Use the same Node version and machine for comparisons. Idle timing includes the
simulated scheduler; zero callbacks measures harness overhead. Engine timings
measure synchronous workload execution. Main-thread CPU is also reported when
Node supports it; it excludes other threads and scheduling waits, and short samples
may fall below counter resolution. Neither establishes browser frame rate,
input-to-paint latency or battery savings. See
[the performance report](goals/improve-sirtet-performance-report.md) for measured
results, browser checks and remaining limitations. The subsequent
[efficiency continuation](goals/improve-sirtet-efficiency-report.md) compares against
`64b4c82` and covers drawing latency, search, replay export and asset generation.
The [deep optimization report](goals/improve-sirtet-deep-optimization-report.md)
compares against `36f753d`, including retained replay memory, layout work, startup,
expanded engine workloads, rejected experiments and the unmet session-time target.
The [search and layout follow-up](goals/improve-sirtet-layout-report.md) compares
against `f008564`, records flat placement storage and smaller deduplication keys,
and reassesses the earlier session target with final measurements and tradeoffs.
The [worst-case responsiveness report](goals/improve-sirtet-tail-report.md)
compares against `487fe689`, covering difficult-carve tails, cooperative replay
downloads, throttled-browser checks and their remaining device limits.

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
