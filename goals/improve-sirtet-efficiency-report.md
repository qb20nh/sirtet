# Sirtet efficiency continuation

Date: 2026-10-08 (Asia/Seoul). Baseline:
`64b4c82fe38d9d3ce9f0ef353fe587e00b634b45`, the previous verified performance pass.
Work continues on the clean local `codex/sirtet-performance` branch in
`/workspace/sirtet-perf`. Prior worktrees and unrelated work remain untouched;
CBBG is unavailable here and was not accessed. No applicable AGENTS.md or new
local memory was found. No dependencies, machine settings or software installs
were added. Nothing was pushed, merged or deployed.

## Findings and chosen changes

Profiles covered engine searches/validation, input-to-canvas timing, repeated
preview drawing, replay serialization, startup metadata and production assets.

- Passive canvas effects missed the first post-input animation frame. Drawing
  now uses layout effects, and each preview depends on its actual shape. This
  removes a scheduling delay and redundant preview drawing without a raster cache.
- Previously queued search states repeated collision work on an unchanged board.
  They now reuse the validated result. The unchecked initial state still follows
  collision checks, as do spawn/bounds gates and first-valid SRS kick selection.
  Flood-fill visitation uses a 260-byte bitmap instead of string keys.
- Replay downloads use compact JSON. Every version 3 field, event and full numeric
  timestamp remains unchanged; only formatting whitespace is removed.
- Tailwind scans `src` rather than the whole checkout. Documentation and test
  tokens no longer change production asset names/content. Biome's Tailwind parser
  is enabled for the installed framework syntax; rules and thresholds are unchanged.

Before implementation, acceptance required drawing before the next RAF for every
sampled input, zero unchanged-preview draws, at least 15% less fixed-session
engine time (10% minimum for retention), identical mechanics and replay values,
smaller exports without a schema change, unchanged visuals and all existing gates.

## Comparable measurements

Environment: Node 24.19.0, TypeScript 6.0.3, pnpm 10.30.3, Linux 6.18.44 x64,
Intel Xeon Platinum 8573C with five exposed logical CPUs; Chromium 151.0.7922.173
and preinstalled Playwright 1.57.0. Final timing windows excluded concurrent heavy
build/test/profile work. Raw samples, commands, source and bundle hashes live in
`/workspace/sirtet-efficiency-evidence`.

Native engine timings use five warmups and nine alternating rounds on the same
process and fixed traces. Compilation, equivalence checking and movement setup
are untimed. Starts and sessions include engine construction.

| Native workload | Previous pass | Candidate | Change |
| --- | ---: | ---: | --- |
| Six seeded starts | 32.459 ms | 26.009 ms | 19.9% less time |
| Three sessions, 20 carves | 144.554 ms | 113.962 ms | 21.2% less time |
| 360 movement/rotation inputs | 0.610634 ms | 0.612111 ms | Unchanged within noise |

The fixed search workload still makes 2,765,119 enqueue calls. Collision-row
checks fall 5,823,940→1,479,820 (74.6% fewer). These are instrumented operation
counts, separate from elapsed-time measurements. Sources:
`engine-final-comparison.json`, `search-operation-counts.json`.

The rendering-only production comparison uses five alternating 40-key rounds,
200 trusted inputs per build in one browser process with matching viewport and
instrumentation. It measured event-to-canvas-draw completion p95 15.3→0.8 ms,
median 1.4→0.4 ms; canvas ready by first subsequent RAF 0/200→200/200; unchanged
preview draws 600→0 while board draws stay 200→200. Median task duration per 40
inputs was 60.606→54.596 ms, but raw task samples were noisy. The robust result is
eliminating the extra frame and unnecessary draws. This measures canvas
submission/paint eligibility, not GPU presentation, FPS or input-to-photon latency.
Source: `input-render-isolated-render.json`.

Two final integrated comparisons each verify 200/200 first-RAF readiness checks
and zero unchanged-preview redraws (400/400 combined). Event-to-draw medians were
2.8→0.5 ms and 3.1→0.4 ms; p95 was 15.0→2.6 ms and 15.5→2.4 ms.
Sources: `input-render-final-integrated.json` and
`input-render-final-matched-server.json`.

Total browser task work is inconclusive. Elapsed TaskDuration increased
81.637→116.591 ms in the initial integrated run, then decreased 86.689→79.643 ms
with matched servers. A final uninstrumented matched-server diagnostic used the
supported CDP `threadTicks` domain: median renderer-thread task CPU fell
45.402→40.914 ms and script CPU 8.421→3.432 ms. Task CPU improved in four of five
pairs, but one retained high sample made summed task CPU 2.6% higher. All raw
samples are retained in `render-thread-work.json`; these checks did not reproduce
a consistent CPU regression, but they do not establish the general no-regression
criterion or total-CPU savings. That acceptance check remains blocked by measurement
variability. Longer profiling on a stable target-device setup is needed to resolve
it. The demonstrated result is earlier drawing and less script work.

Replay export uses actual baseline/candidate serializers, five warmups and 11
alternating rounds, asserting exact parsed JSON equality before timing:

| Export workload | Pretty bytes → compact bytes | Median serialization time |
| --- | --- | --- |
| Actual downloaded replay, 2,073 events | 188,746→114,707 (39.2% smaller) | 0.588→0.387 ms |
| 36,000 synthetic ticks | 3,328,117→2,101,217 (36.9% smaller) | 9.324→7.588 ms |
| 216,000 synthetic ticks | 20,200,159→12,853,259 (36.4% smaller) | 64.991→42.979 ms |

Synthetic counts scale serialization to 10/60 minutes of 60 Hz tick data; they are
not claims about complete playable sessions. Recording heap usage is unchanged.
Source: `replay-export-comparison.json`, with the real fixture and serializer
source hashes preserved. Existing exact replay regressions still apply.

Source-scoped CSS is 12,195→11,853 bytes (gzip 3,756→3,664 using Node
`zlib.gzipSync` for both). The main value is reproducibility: a documentation-only
fixture previously added 1,929 CSS bytes and changed both asset filenames;
scoped scanning leaves filenames, bytes and hashes identical. Six full-page
screenshots and DOM styles/bounds match exactly across desktop/touch menu,
playing and paused states. No page-load latency improvement is claimed.
Sources: `asset-provenance.json`, `css-visual-report.json`.

## Verification and reproduction

```sh
pnpm quality
pnpm test
pnpm build
node scripts/benchmark-engine.mjs 64b4c82 HEAD > /tmp/sirtet-engine.json
node scripts/benchmark-idle.mjs 64b4c82 HEAD > /tmp/sirtet-idle.json
```

The managed environment uses the equivalent pinned runner
`node /workspace/.cache/corepack/v1/pnpm/10.30.3/bin/pnpm.cjs`; the quality
subprocess PATH includes `/tmp/sirtet-tools`, a shim for that same pinned version.
No package installation was necessary.

All 50 tests and the production build pass. `pnpm quality` passes types, Biome,
coverage, Knip and duplication. Coverage: 96.62% statements, 91.56% branches,
96.60% functions, 97.84% lines; existing 90% thresholds are unchanged.

Equivalence checks compare 1,308 intermediate snapshots and 4,032 exact paths
against the previous pass. An additional 95-board corpus compares 2,090 validity
and 161 shape-availability results, including source-board purity. The independent
path oracle now covers off-spawn and unchecked edge starts. A severed-wall
regression protects flood traversal at both board edges. Four canvas bitmaps
match across 11 states including movement, holds, both viewport sizes, carve,
pause, natural loss and restart. Independent source review found no outstanding
material issues.

Final combined production gameplay has 17 passing checks and two blocked checks.
The dedicated naturally stuck easy-mode/end/restart suite passes two more checks;
one JavaScript-error check overlaps the suites. All 40 seeded downloads reconstruct
accepted-key results and complete snapshots exactly with compact JSON. Tests use
actual keyboard/touch-emulation events for movement, rotation, hold, carves,
repeated input, two normal losses/restarts, pause/resume, real trusted window blur
while a key is held, long idle before first carve, repeated easy idle cycles,
replay download/focus and reload. Zero idle callbacks remain verified.

Browser scripts and immutable comparison builds are in the local evidence
folder. `final-browser/report.json`, `final-terminal-browser/report.json` and
`final-download-reconstruction.json` record individual outcomes and hashes.
Reproduction uses the preinstalled browser/runtime and recorded local servers:

```sh
node /workspace/sirtet-efficiency-evidence/browser-qa.mjs final
node /workspace/sirtet-efficiency-evidence/browser-terminal-qa.mjs final
node /workspace/sirtet-efficiency-evidence/check-final-downloads.mjs
node /workspace/sirtet-efficiency-evidence/replay-export-profile.mjs
```

The rendering comparison records URLs and source/bundle hashes. Its final
matched-server invocation is:

```sh
SIRTET_BASELINE_URL=http://127.0.0.1:4176 \
SIRTET_CANDIDATE_URL=http://127.0.0.1:4178 \
SIRTET_BASELINE_SOURCE=/workspace/sirtet-efficiency-evidence/assets-baseline \
SIRTET_CANDIDATE_SOURCE=/workspace/sirtet-perf \
node /workspace/sirtet-efficiency-evidence/render-comparison.mjs final-matched-server
node /workspace/sirtet-efficiency-evidence/render-thread-work.mjs
```

`render-thread-work.mjs` performs the final uninstrumented diagnostic against
those same local ports. Browser sockets use supported tool permissions.

Native document-hidden transitions remain unavailable in headless Chromium: bringing another page forward produces
trusted blur while document.hidden stays false; lifecycle freezing also did not
produce the needed visibility transition. Listener unit tests do not establish
native tab behavior. A headed browser is needed to finish this check. Physical
mobile input requires an attached phone/tablet; touch emulation is not that check.

## Deliberately deferred

Bounding startup metadata generation removed invalid candidates but produced no
reliable module-startup latency improvement. Removing animation ghost validation
also failed to improve the fixed session workload. Neither experiment was kept.
No extra caches, snapshot sharing or replay tick compression were introduced.
The remaining active replay log still grows with play duration to preserve exact
floating-point timing. Exporting very large logs is still synchronous. The new
layout effects move small canvas work before paint; measured drawing work is
bounded. Final combined input checks preserve the drawing-timing improvement,
while total task work remains inconclusive as described above.
Performance evidence is finite and machine-specific, with no system CPU, battery,
physical-device or GPU-presentation claim.

## Acceptance status

| Check | Status | Evidence |
| --- | --- | --- |
| Isolated baseline and preservation of unrelated work | Passed | Existing clean branch, prior worktrees untouched |
| At least 15% less fixed-session engine time | Passed | 21.2% reduction against `64b4c82` |
| Exact mechanics, search order and board validation | Passed | 1,308 snapshots; 4,032 paths; 2,090 validity and 161 availability checks |
| Drawing before first post-input RAF | Passed | 400/400 integrated inputs |
| Zero unchanged-preview redraws | Passed | Both integrated comparisons |
| Visual equivalence across state changes and viewports | Passed | 44 canvas comparisons plus six complete CSS screenshot/style comparisons |
| Smaller exports with identical version 3 values | Passed | 39.2% smaller real fixture; 40 exact downloaded replays |
| Documentation-independent asset generation | Passed | Same asset names, contents and hashes after docs fixture |
| All existing quality/test/build gates | Passed | 50 tests; unchanged thresholds; production build |
| Repeated play, restart, pause, focus loss, held/repeated input and easy idle | Passed | Combined production-browser suites; no functional failures |
| No overall browser main-thread-work regression | Blocked | Mixed elapsed/thread CPU samples; no consistent regression, general criterion inconclusive |
| Native document-hidden behavior | Blocked | Headless document.hidden stays false; needs headed browser |
| Physical mobile input/browser behavior | Blocked | Emulation available; no attached phone/tablet |

There are no failed functional checks. Verification remains partial for the three
blocked criteria. No FPS, GPU-presentation, battery or general total-CPU improvement
is claimed. The source and results report are locally committed without pushing; the
user's existing authorization permits unsigned local commits in this environment.


## Local review

Runtime/build commits, unsigned as authorized:

- `13300770e8fd9175d4a5c1fc8a485159152f9ceb` — validated search reuse and flood indexing.
- `cba16ad48cb544b10dc4dad20a4bc449fec1681e` — canvas scheduling and stable previews.
- `2573088c2f56b9f28d5dd67785da6224a186b1d2` — compact replay serialization.
- `9968fbcdb189d58c104e2f71b04d8ec57c84379b` — deterministic Tailwind source scanning.

Documentation is a separate commit. The current-pass patch is
`/workspace/sirtet-efficiency.patch`; the complete local branch diff from merged
main is `/workspace/sirtet-performance-full.patch`. Raw evidence, reproduction
scripts and a commit/source/bundle manifest are archived at
`/workspace/sirtet-efficiency-verification.tar.gz`. The working tree is clean;
no push or deployment was performed. PR #1 remains merged.
