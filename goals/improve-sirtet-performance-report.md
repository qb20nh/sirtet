# Sirtet performance continuation

Date: 2026-10-08 (Asia/Seoul).

## Baseline and scope

PR #1 was already merged when this pass began. The verified baseline is
`3d2d54184333bd75c91e1a6dc1fbcf7b73197574` on `origin/main`. Work is isolated in
`/workspace/sirtet-perf`, branch `codex/sirtet-performance`. The original
`/workspace/sirtet` and previous `/workspace/sirtet-pr1` worktrees remain unchanged.
No CBBG checkout is available in this environment; no CBBG files were accessed or
changed. No applicable AGENTS.md or relevant local memory was found in the
accessible workspace. The anti-slop and cloud runtime skills guided this pass.

The merged game already avoids idle snapshots/redraws, pauses on interruptions,
routes keyboard and touch controls, and exports exact version 3 replays. Those
improvements are retained. Normal mode requires queuing the next carve before
the current escape ends; easy mode waits for the next carve. Rotation, SRS kicks,
board generation, score, queue, seeded shuffle and terminal behavior are preserved.
The baseline passed 46 tests and its production build.

Profiling found escape-search work dominating engine CPU, approximately 60 idle
animation callbacks per second, and redundant preview redraws. Full board drawing
measured about 0.05 ms per redraw. A static raster-cache prototype was faster in
isolation but did not justify its invalidation complexity at that absolute cost.
This pass targets engine search and idle scheduling.

Before implementation, acceptance required at least 2× faster execution of a
fixed seeded-session workload, zero idle callbacks, identical search paths and
session snapshots, a full first animation beat after a long idle wait, and all
existing gates plus production-browser lifecycle checks. No dependencies or gate
thresholds changed. No machine settings or system software changed. No deployment,
push or release was performed for this new branch.

## Changes

- A shared ordered breadth-first search serves path construction and boolean
  legality probes. It stores coordinates and predecessors once and constructs
  only the winning path, preserving search order, first valid SRS kick and the
  2,000-iteration limit. Rotation/kick ordering and shape row masks/bounds are
  prepared once. A per-search visited bitmap replaces hash lookups, with an
  out-of-range fallback for exported-helper inputs. The public full-path helper
  still treats every nonzero cell as occupied.
- Cheap filled/support checks precede board-wide legality work.
- Animation scheduling runs only while a piece escapes. Idle input rebases the
  engine clock before the next carve; active replay ticks remain unchanged.
  The App restarts scheduling on idle-to-active transitions.
- Independent path-reference tests and reproducible native engine/idle benchmarks
  verify behavior and quantify the same fixed workloads across Git revisions.

## Reproduction and evidence

Use the pinned pnpm 10.30.3 with Node 24.19.0. In this environment the equivalent
runner is `node /workspace/.cache/corepack/v1/pnpm/10.30.3/bin/pnpm.cjs`.

```sh
pnpm quality
pnpm test
pnpm build
node scripts/benchmark-engine.mjs 3d2d541 HEAD > /tmp/sirtet-engine.json
node scripts/benchmark-idle.mjs 3d2d541 HEAD > /tmp/sirtet-idle.json
```

Full local evidence is in `/workspace/sirtet-performance-evidence`, including
baseline profiles, commands, raw samples, browser automation, downloads and
screenshots. The browser harness uses the preinstalled Playwright 1.57.0 with
Chromium 151.0.7922.173 and a local production server. No browser was installed.
Timing comparisons alternate baseline and candidate on the same machine after
warmup. Compilation, behavior comparisons and workload setup are outside timing
unless the workload explicitly measures startup.

## Measurements

Machine: Linux 6.18.44, x64, Intel Xeon Platinum 8573C, five exposed logical CPUs;
Node 24.19.0, TypeScript 6.0.3. Native engine benchmark: five warmups and nine
alternating rounds, no concurrent profiling/build workloads during final timing.
Values below are medians of the same workload per revision.

| Native engine workload | Main baseline | Candidate | Result |
| --- | ---: | ---: | --- |
| Six seeded starts | 101.642 ms | 35.472 ms | 2.87× faster |
| Three seeded sessions, 20 successful carves | 528.819 ms | 158.886 ms | 3.33× faster; 70.0% less time |
| 360 movement/rotation inputs, startup excluded | 0.6926 ms | 0.6916 ms | Unchanged within noise |

These measure synchronous engine execution, not browser input-to-paint latency
or frame rate. Raw samples and source hashes are in `engine-final-comparison.json`.
The checked-in benchmark independently compares 1,308 intermediate snapshots
(including three initial states) and 4,032 exact paths across 24 boards before
measurement. Unit tests add 1,848 independent reference-path cases, nonbinary
obstacles, far-above starts, and board/path immutability.

The visited bitmap and row-mask refinements were retained only after two
interleaved nine-round experiments: they reduced session time a further 11–16%
and 12–13%, respectively, against the preceding candidate. See
`search-variants-comparison.json`. Intermediate overlapping/noisy profiling runs
are exploratory, not the final performance claim.

The idle Node benchmark counts 600 callbacks and 601 requests on main versus
zero callbacks and requests on the candidate across 600 frame opportunities.
Its candidate elapsed time measures harness overhead. The meaningful result is
eliminated callbacks, not a claimed game-callback latency speedup.

The production-browser comparison rebuilt exact main from Git and alternated
five three-second idle runs per revision in the same Chromium process at
1280×1000. Startup and settling are outside each sample. CDP measurements are
main-thread task/script duration over that interval, not system CPU utilization.

| Idle browser measurement per three seconds | Main baseline | Candidate |
| --- | ---: | ---: |
| Animation callbacks | 180 | 0 |
| Main-thread task duration | 23.478 ms | 0.709 ms |
| Script duration | 4.705 ms | 0 ms |

The task-duration reduction is about 97%, but the baseline absolute cost was
only about 0.8% of the measured wall interval. See
`idle-browser-comparison-final.json` for raw samples, environment and both exact
source/bundle hashes. These observations do not establish battery savings.

Final production gameplay: 17 checks passed, none failed, two blocked. The
separate naturally stuck easy-mode/end/restart route passed two more checks.
Reports are `final-browser/report.json` and `final-terminal-browser/report.json`.
Actual browser input exercised two normal losses/restarts; keyboard repeat and
shortcut handling; real trusted window blur with a held key; explicit resume;
long idle before first carve; two easy idle/carve/escape cycles; narrow-screen
coarse-pointer touch input; replay download/focus; and reload. Downloaded active,
paused, idle and terminal snapshots reconstructed exactly in Node. An independent
second pass verified all 40 seeded downloads, including accepted-key outcomes;
see `final-download-reconstruction.json`. The two suites share one JavaScript
error check, so their 19 passing checks include that overlap.

Browser commands (production ports 4174 baseline and 4175 candidate):

```sh
node /workspace/sirtet-performance-evidence/browser-qa.mjs final
node /workspace/sirtet-performance-evidence/idle-browser-comparison.mjs final
node /workspace/sirtet-performance-evidence/browser-terminal-qa.mjs final
```

The harness paths and browser executable are specific to the recorded environment;
retain the evidence directory with its scripts and baseline bundle. Shell/browser
socket access was granted through the supported tool permission mechanism.

## Acceptance status

| Acceptance check | Status | Evidence |
| --- | --- | --- |
| Verified baseline, isolated work, preserved existing work | Passed | Main `3d2d541`; original and previous worktrees unchanged |
| At least 2× faster fixed seeded-session workload | Passed | 3.33×; five warmups, nine alternating native rounds |
| No startup or movement/rotation regression | Passed | Starts 2.87× faster; movement unchanged within noise |
| Zero callbacks while waiting for a carve | Passed | Unit/Node counts and every final Chromium idle round |
| Full first animation beat after long waits and repeated easy idle | Passed | Two-cycle regression and actual keyboard/touch gameplay |
| Identical rules, path ordering and replay snapshots | Passed | 4,032 baseline paths, 1,308 snapshots, independent path regressions and downloaded replay reconstruction |
| Maintainable shared search and reproducible developer checks | Passed | One search implementation, checked-in trace/benchmark, no new dependencies |
| Lint, types, tests, coverage, unused code, duplication, production build | Passed | All gates unchanged; 49 tests; coverage above 90% |
| Repeated normal/easy play, restart, pause/resume, held input and real focus loss | Passed | Final production-browser reports, 19 passed checks total |
| Desktop, narrow screen and emulated coarse-pointer/touch input | Passed | Chromium 1280×1000 and 390×844; no horizontal overflow |
| Native document-hidden/tab lifecycle | Blocked | Headless hidden-state attempts unavailable; needs headed browser |
| Physical mobile touch/browser validation | Blocked | No attached device; needs phone/tablet access |

There are no failed acceptance checks. Verification is partial because the last
two browser/device checks cannot be established in this environment.

## Verification

`pnpm quality`, `pnpm test`, and `pnpm build` passed. The quality command runs the
unchanged type, Biome lint, coverage, Knip and duplication gates. All 49 tests
pass. Coverage is 96.64% statements, 91.64% branches, 96.58% functions and 97.84%
lines, each above the existing 90% gate. No exclusions, thresholds or timing
assertions were weakened. Duplication is 0.41% against the existing 1% limit.
`git diff --check` and an additional forced TypeScript build pass.

Source review independently checked BFS ordering, SRS selection, predecessor
reconstruction, bounds/row-mask shifts, board-cache behavior, idle clock rebasing,
and replay fidelity. It found one exported-helper compatibility issue (nonbinary
obstacles), which was fixed and regression-tested before final verification.

## Tradeoffs and remaining limits

The shared search removes duplicated search implementations, path copies and
per-node sorting/string lookups. It adds small immutable geometry tables and a
2,448-byte visited array per search. Snapshot isolation and all active replay
ticks remain intact. Version 3 replay size still grows with active play; changing
tick compression would risk the exact floating-point timing guarantees and was
not part of this pass.

Idle waiting now starts the next escape clock at command time, preventing long
waits from consuming its first beat. This intentionally replaces the previous
last-idle-frame clock (up to approximately one foreground frame earlier).
Pause/resume and every active animation tick retain their previous semantics.

No physical device, headed display or Xvfb is attached. Chromium headless can
produce trusted window blur but keeps `document.hidden` false when another page
is brought forward. CDP frozen/active lifecycle attempts likewise did not produce
native visibility transitions. Unit visibility events verify listener logic;
they do not establish native hidden-tab behavior. Completing that check requires
a headed browser able to background the actual tab. Physical touch verification
requires an attached phone/tablet; Chromium coarse-pointer/touch emulation cannot
establish Safari or hardware behavior.

The seeded corpus is broad but finite, and performance depends on hardware and
board layout. These results establish neither battery savings nor system CPU
utilization, FPS or end-to-end input latency. Further raster caching, preview
memoization and speculative rewrites were deferred because measured costs did not
justify adding them to this focused change.


## Local changes for review

The user authorized unsigned local commits for this cloud continuation. Runtime
changes are split by purpose:

- `ce78fe42f277b88cc27736e6d99f8752155fbb7c` — reduce escape-search work and
  allocations, with the benchmark and independent path regressions.
- `4a5006c692b9439a5e02597f54ede78f00b77eba` — stop idle scheduling, preserve
  command-time animation/replay behavior, and update the idle benchmark.

Documentation is a separate local commit. Review the complete change using
`git diff 3d2d54184333bd75c91e1a6dc1fbcf7b73197574..codex/sirtet-performance`.
A standalone patch and evidence archive are saved as
`/workspace/sirtet-performance.patch` and
`/workspace/sirtet-performance-verification.tar.gz`. PR #1 remains merged;
this new branch was not pushed.
