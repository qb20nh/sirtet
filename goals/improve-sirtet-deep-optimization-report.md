# Sirtet deep optimization pass

2026-10-08, UTC. Baseline: `36f753d6d4d777ba5006930ed081ccd1af8945b9`.
This pass builds on the completed gameplay and two performance passes in the
clean `codex/sirtet-performance` worktree at `/workspace/sirtet-perf`.
Other worktrees and unrelated work remain untouched. CBBG was unavailable here
and was not accessed. No applicable AGENTS.md or additional relevant local
memory was found; no memories, dependencies, machine settings or security
settings were changed. The anti-slop and cloud runtime skills informed the work.
PR #1 was independently rechecked through the GitHub connector: it was merged
on 2026-10-08 at 09:38:30 UTC. These continuation commits stay local; nothing
was pushed, merged or deployed. Unsigned local commits were explicitly authorized.

## Selected changes

- Escape searches reuse bounded coordinate/parent queues and a visitation bitmap.
  Returned paths still own their objects; full-path and boolean searches retain
  their ordering, SRS kick rules, initial-state handling and iteration limit.
- Forced packing stops after two distinct placements, because its decision only
  distinguishes zero, one or multiple choices. Frontier validation reuses its
  already computed fallback. Per-placement board validity is cached for the
  current board and invalidated globally whenever a cell changes.
- Cursor bounds and rotation checks avoid temporary cell/candidate objects.
  Animation no longer revalidates an unchanged carving ghost. Snapshot ownership,
  fractional clock accumulation, queue promotion and normal/easy behavior remain
  unchanged.
- Placement metadata prepares support geometry and sorted offsets once per
  rotation. READY engines defer the unused legality index until gameplay needs it.
- The Preact layout receives a flat set of displayed values, references and
  callbacks, and skips rebuilding unchanged controls and panels. Canvas layout
  effects still draw every visible state change before the next paint opportunity.
- `src/replay.ts` records raw tick clocks in 1,024-entry Float64 chunks and keeps
  sparse non-tick events. Export expands one chunk at a time directly into Blob
  parts. The downloaded version 3 JSON is byte-for-byte compatible, including
  every timestamp, event, seed, option and snapshot. Existing replay helper APIs
  remain available.
- The checked-in engine benchmark now verifies and times all-shape boundary
  controls and stationary-ghost animation in addition to starts and seeded runs.
  New behavior regressions cover scratch ownership, every shape's bounds/kicks,
  animation continuity, nonlocal cache invalidation, READY/restart isolation,
  displayed-value/callback updates, and replay chunk boundaries.

These are focused extensions of the existing engine and UI. The game rules,
inputs, layouts and visual identity are unchanged. No raster cache, worker,
new framework or dependency was added.

## Conditions and acceptance

The pre-implementation plan is preserved in
`/workspace/sirtet-deep-evidence/acceptance-plan.md`. Acceptance required exact
mechanics/replays/pixels, measurable target-workload improvements, at least 15%
less integrated fixed-session engine time, unchanged quality gates, production
browser lifecycle checks, and reviewable local commits/evidence. Each retained
candidate needed a measured target benefit; not every investigation needed a change.

Environment: Node 24.19.0, TypeScript 6.0.3, pinned pnpm 10.30.3, Linux 6.18.44
x64, Intel Xeon Platinum 8573C with five exposed logical CPUs. Browser work uses
Chromium 151.0.7922.173 and preinstalled Playwright 1.57.0. No software was installed.
Native final timings used five warmups and nine alternating rounds, with other
agents' heavy work paused. Both revisions run in one process on identical traces.
Browser comparisons use alternating baseline/candidate rounds and matching local
servers. All raw samples, including unfavorable outliers and rejected candidates,
are retained. Results describe this environment, not every device.

## Engine results

Integrated source SHA-256:
`55c3884a75348cb8146eb1a7bf78b6916f7ecb3fe5fd4fcbac57b8203ae7a9d3`.

| Native workload | Baseline median | Final median | Time reduction |
| --- | ---: | ---: | ---: |
| Six seeded starts, construction included | 31.503 ms | 22.596 ms | 28.3% |
| 360 movement/rotation inputs | 0.743 ms | 0.659 ms | 11.4% |
| Three seeded sessions, 20 carves | 133.537 ms | 119.025 ms | 10.9% |
| 2,716 all-shape boundary inputs | 22.374 ms | 15.408 ms | 31.1% |
| 20 prepared animations, 96 ticks each | 0.346 ms | 0.039 ms | 88.9% |

Control/animation setup and equivalence checks are outside timing. Animation uses
fractional timestamps and a stationary valid carving ghost while a piece escapes.
The 15% mixed-session target **failed**: the observed improvement is 10.9%.
The other gains do not substitute for that target. There is no unexplained
reproducible slowdown in the retained integrated workloads. Source:
`engine-final-comparison.json`.

Before timing, 1,308 seeded session snapshots, 97 animation snapshots, 2,723
boundary snapshots, 2,716 accepted/rejected input outcomes and 4,032 exact paths
matched. The final implementation also matches 2,090 board-validity and 161
availability decisions across 95 boards, without changing input boards.
Sources: `engine-final-comparison.json`, `engine-corpus-equivalence.json`.

Instrumented operation/allocation counts are separate from timing:

- Isolated workspace reuse: visited buffers constructed per fixed trace fall
  9,331,776 to 2,448 bytes; queue arrays constructed fall 12,650 to four. The
  retained workload workspace has four arrays of 596 numeric slots plus the
  bitmap. This is not a measured peak-heap or GC claim.
- Forced-packing candidate probes fall 127,530 to 21,184 (83.4%).
- On valid tall central masses, frontier escape checks fall 42 to 28 and board
  simulations 38 to 27.

Sources: `search/scratch-allocation-counts.json`,
`packing/counts-and-input.json`, `packing/tall-center-boards.json`.

## Browser, startup and recording results

Isolated layout comparison: renderer-thread task CPU median 39.402 to 32.513 ms
per 40 inputs (17.5% less); script CPU 3.333 to 3.141 ms. CPU uses uninstrumented
CDP `threadTicks`. Sampled mapped JavaScript allocations per 200 inputs fall
5,947,548 to 1,690,920 bytes (71.6%). These are sampled estimates, not exact heap
allocation accounting. Both uninterrupted pairs independently improved; the last
allocation-only pair had a documented driver pause. All 11 compared states have
identical DOM and four canvas bitmaps. Sources live under `render/`.

Isolated startup changes: 11 alternating fresh Chromium page loads measure
synchronous bundle execution 71.0 to 52.4 ms and localhost DOMContentLoaded
107 to 92 ms. Retained JS heap is 3,867,284 to 3,873,248 bytes, a 5,964-byte
increase. All 5,884 placement metadata records match exactly and menu screenshots
match byte-for-byte. Source: `startup/browser-load.json`. These numbers isolate
startup code; the final integrated bundle is checked separately.

Actual shipping replay recorder, Chromium managed heap plus array backing storage
after forced GC:

| Recording workload | Baseline retained | Final retained | Reduction |
| --- | ---: | ---: | ---: |
| Actual downloaded replay, 2,073 events | 124,991 B | 37,696 B | 69.8% |
| Synthetic 216,001 tick events | 12,264,104 B | 1,758,872 B | 85.7% |
| Synthetic repeated mixed trace, 207,201 events | 11,857,324 B | 1,950,716 B | 83.5% |

Nine alternating rounds measure serialization plus native Blob creation:
2.5 to 1.8 ms for the actual replay, and 263.4 to 138.3 ms for the long tick
workload (47.5% less). Shared-host timing variability is retained in the samples.
Synthetic event counts are capacity tests, not proof of a game surviving that
length. The repeated mixed trace is not a valid single game replay. The actual
recorder's source hashes are embedded in the evidence.

The long tick workload's sampled pre-GC export allocation increased about 3.5%.
Lower peak memory is therefore **not established**; CDP also omits some browser
native Blob allocations. Steady retained recording memory and post-GC recording
plus output memory decrease substantially. Recording still grows with session
length; restart releases the old recording. Sources:
`replay/implemented-browser-profile.json`,
`replay/implemented-browser-memory.json`.

## Rejected experiments

- Reusing an existing row-bit array reduced packing conversions 4,338 to 1,740,
  but session time worsened 136.504 to 219.385 ms. Diagnostic main-thread CPU
  also worsened 535.659 to 741.839 ms over five workloads, with no cgroup
  throttling. Exact behavior passed, but this performance regression was rejected.
  Type/tier feedback did not reveal a sufficiently specific fix. Sources and
  profiles are preserved under `search2/`; the production engine is unchanged.
- Typed BFS coordinate buffers, blocked-state caching and earlier validity
  shortcuts did not justify their extra complexity or performed worse. Ordinary
  numeric coordinates preserve exported extreme starts without truncation.
- A row-bit flood-fill rewrite was omitted after the smaller packing changes.
- An initial metadata prototype retained about 338 KB extra array capacity.
  Exact-sized arrays removed that regression before integration.
- Naively expanding all packed replay events at once increased export cost.
  The retained implementation expands bounded chunks. Fixed-shape event objects
  alone gave insufficient gains.
- A compatibility-layer memo component added about 6.4 KB and changed input-prop
  handling. The retained native Preact component avoids that dependency path.

## Verification and reproduction

The unchanged repository gates passed: forced typecheck; `pnpm quality` (types,
lint, coverage, unused code, duplication); `pnpm test` (67 tests); and production
build. Coverage is 97.08% statements, 92.12% branches, 96.88% functions and 98.35%
lines against the existing 90% thresholds. Duplication is 0.33% against 1%.
Existing board-validation timing assertions are unchanged.

```sh
pnpm quality
pnpm test
pnpm build
node scripts/benchmark-engine.mjs 36f753d HEAD > /tmp/sirtet-engine.json
node /workspace/sirtet-deep-evidence/verify-engine-corpus.mjs
node /workspace/sirtet-deep-evidence/replay/implemented-browser-profile.mjs
node /workspace/sirtet-deep-evidence/replay/implemented-browser-memory.mjs
```

This environment runs pinned pnpm with
`node /workspace/.cache/corepack/v1/pnpm/10.30.3/bin/pnpm.cjs`; the quality command
uses `/tmp/sirtet-tools` on PATH for the same runner in child processes.
Browser scripts use the existing Playwright installation and `/usr/bin/chromium`.
The evidence bundle retains scripts, fixtures, sources, commands, raw samples,
profiles, source/bundle hashes, screenshots and gate logs. Browser scripts contain
these environment paths; adjust them when reproducing elsewhere. Timing phases
must be run without concurrent heavy jobs. No FPS, battery, system-wide CPU or
input-to-photon improvement is claimed.

The integrated production bundle also passed a separate uninstrumented browser
comparison. Renderer-thread task CPU median falls 60.871 to 35.753 ms per 40
inputs (41.3%); all five paired rounds improve, with total task CPU 290.155 to
174.275 ms. A separate instrumented 200-input phase measures event-to-draw
completion median 0.3 to 0.2 ms, p95 0.6 to 0.3 ms. Both revisions achieve
200/200 first-RAF readiness checks and zero unchanged-preview redraws. These
metrics cover canvas command submission, not GPU presentation. Source:
`render/final-thread-input.json`.

The final integrated startup comparison uses 11 alternating fresh Chromium
contexts: synchronous bundle execution 63.5 to 43.5 ms (31.5% less), localhost
DOMContentLoaded 90.5 to 69.7 ms, trusted Start handler 35.2 to 31.1 ms.
All 22 loads reach READY; menu screenshots are byte-identical. Retained JS heap
is 3,867,348 to 3,876,096 bytes (+0.23%), excluding canvas/GPU memory.
Synchronous execution excludes download and parse; Start-handler duration is
not paint latency. Source: `startup/final-integrated-browser-load.json`.

The final JavaScript asset is 49,648 bytes versus 47,685 bytes (+1,963, or 4.1%).
Consistent Node `zlib.gzipSync` measurement gives 17,292 versus 16,576 bytes
(+716 bytes). This is the cost of the bounded replay recorder and display-value
projection; it accompanies the measured runtime gains. CSS remains byte-identical
at 11,853 bytes. Final production JS SHA-256:
`882a7acf50bf7a73c650e1db5fae79d31e744eff3506035bc84efc5aa18875c0`.

## Local commits

- `612666857fec1b0521717e2218420d4bb7cca2df`: engine work, ownership/cache/lifecycle
  regressions and expanded benchmark.
- `8bca9cf19fb86cb9685a83d4be6def0d645585a2`: compact recording, chunked export and
  exact replay regressions.
- `ba1d8ccef33b8be55a4cca90ab346052ae3b0c6e`: displayed-value layout updates and
  UI transition/callback regressions.

The final documentation commit records verification. The continuation diff is
available with `git diff 36f753d HEAD`; all performance work after merged main is
available with `git diff 3d2d541 HEAD`.

## Gameplay and acceptance ledger

The exact final production bundle passes 17 main browser checks and two terminal
checks, with no failures. The terminal suite repeats the JavaScript-error check;
the two suite totals are reported separately to avoid implying 19 unique behaviors.
Checks cover two natural normal losses/restarts, easy repeated carving and two
idle/resume cycles, keyboard and touch-emulated inputs, held movement/rotation/hold,
mid-animation pause/resume, trusted focus loss with held input, download focus
restoration, narrow layout, reload, and no console errors. A naturally stuck easy
run reaches six carves/600 points, ends and restarts correctly. Desktop/mobile
screenshots were inspected. All 40 seeded downloaded replays reproduce accepted
inputs and complete snapshots exactly, including multi-chunk recordings above
2,000 events. Sources: `render/final-browser/report.json`,
`render/final-terminal-browser/report.json`,
`render/final-download-reconstruction.json`.

| Acceptance check | Status | Evidence or remaining requirement |
| --- | --- | --- |
| Preserve unrelated work and build on verified baseline | Passed | Isolated existing branch; other worktrees unchanged; PR state rechecked |
| Preserve exact mechanics, ordered paths and snapshot ownership | Passed | 4,128 exact snapshots; 4,032 paths; 2,716 input results; 95-board corpus and new regressions |
| Preserve exact version 3 replay values and continuity | Passed | Byte-identical serializer tests; 40 browser downloads reconstruct exactly |
| Retained candidates improve their measured target | Passed | Engine controls/animation, search allocation, startup, layout CPU/allocation and recording/export evidence above |
| At least 15% less mixed-session engine time | Failed | 10.9% measured; the next scan-reuse candidate regressed and was rejected |
| No unexplained reproducible starts/control slowdown | Passed | Integrated starts, ordinary controls and all-shape controls all improve |
| Quality gates remain unchanged and pass | Passed | Types, lint, 67 tests, coverage, knip, duplication and production build |
| Exact visual presentation | Passed | 11 pixel/DOM states; startup screenshot equality; final screenshot inspection |
| Production lifecycle and supported emulated modes | Passed | Main/terminal browser suites, repeated play, restart, pause/resume, trusted blur and input interruptions |
| Native hidden-document transition | Blocked | Headless tab activation produces trusted blur but `document.hidden` stays false; no headed display/Xvfb is available |
| Physical touch/mobile browser check | Blocked | No attached phone/tablet, physical touch hardware or Safari; Chromium emulation cannot establish this check |
| Semantic local commits and reviewable evidence | Passed | Engine, replay, UI and documentation commits; continuation/full patches and evidence archive |

The visibility listener is unit-tested, and real window blur was exercised.
Those alternatives do not count as a native hidden-document pass. Completing
the blocked checks needs a supported headed browser for genuine tab/background
visibility changes and a real mobile/touch device for repeated play, interruptions
and restart. No machine/display/security changes or software installation were
attempted to bypass those environment limits.

The performance target failure and these two unavailable device checks mean the
full acceptance set remains partial. The selected improvements and all software
gates are verified. Further optimization should start with a fresh measured
hypothesis; the failed row-bit experiment demonstrates why operation reductions
alone do not justify another change.
