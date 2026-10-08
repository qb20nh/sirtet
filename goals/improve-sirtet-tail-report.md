# Worst-case responsiveness continuation

2026-10-08. Baseline: `487fe689a2217b3536e4943cb461e7a01977842c`.
This pass addresses reproducible expensive carves and large replay downloads.
It builds on the [search and layout work](improve-sirtet-layout-report.md).

Work stays isolated in `/workspace/sirtet-perf`, branch
`codex/sirtet-performance`. The original and PR worktrees are preserved; CBBG
was not accessed. PR #1 is already merged. New commits remain local and unsigned,
as authorized. No dependencies, memories, machine/security settings, pushes,
merges or deployments were added.

## Baseline and acceptance

The supported easy-mode seed-7 route reaches a seventh carve that repeatedly
takes 98–134 ms in native Node. A normal seed-1 sixth carve takes about 20 ms.
These are reachable sessions constructed through public inputs, rather than
arbitrary stress boards. Sampled animation ticks stayed below 0.2 ms. A profile
of the difficult carve attributes about 66% of sampled non-profiler CPU to search
and enqueue work and 15% to floating-block connectivity.

Exploratory production Chromium reproduced a 266.9 ms carve handler at normal
CPU and 751.5 ms at 6× throttling. Each produced a browser Long Task. These
single-round diagnostic samples motivated the changes; the final comparison
below uses repeated alternating runs.

The exploratory ordinary-input run also retained a 129 ms dispatch-to-draw
outlier at 6×: about 79 ms preceded the handler and 50 ms followed it, while the
handler itself took 4.7 ms. Its cause is unproven. It is not attributed solely
to canvas work or discarded from the raw evidence.

Before integration, `acceptance-plan.md` in the evidence directory specified:
exact mechanics/replay preservation; at least 30% lower difficult-carve p95 in
native and 6× browser comparisons; investigation of ordinary-input p95 increases
exceeding both 10% and 1 ms; no export-induced tasks over 50 ms for the fixed
large 6× replay workload; interruption-safe downloads; unchanged quality gates;
and actual production lifecycle checks. Physical-device and native document-hidden
checks must remain explicitly blocked when their capabilities are unavailable.

## Changes and correctness bounds

Private boolean reachability probes now search depth-first, favoring upward
movement toward spawn. Their shared collision and SRS-kick rules are unchanged:
the first valid kick ends selection even if its destination was already visited.
The unchecked initial state retains its special treatment. Only metadata-origin
probes use this traversal. Their maximum 1,018 distinct states fit below the old
2,000-state BFS limit, so changing traversal cannot expose an escape previously
cut off by that limit. Exported, displayed paths keep the ordered BFS and owned
path arrays.

The private search also stops when wholly empty headroom proves an escape:
the piece can move horizontally to spawn, use zero-offset rotations, then rise
through the gate. Starts already at gate height must satisfy the gate before
taking the shortcut. This avoids exploring empty rows without changing an edge
or a returned path. `engine/search-proof.md` retains the full argument.

Connectivity now packs the ten columns into row masks and propagates reached
bits horizontally and vertically. Every solid baseline cell is already a root;
any target path to a deeper root must cross that row. Rows below the baseline
therefore cannot alter target connectivity. Downward propagation from upper
bridges is retained, and only cells strictly equal to 1 count as solid. The two
22-row typed arrays replace the per-cell object queue. Board dimensions and
rotation rules are explicit bounds, not general-purpose graph assumptions.

Replay export preserves version 3 JSON and full clock precision. At most 4,096
events use the measured synchronous fast path. Larger exports serialize batches
of 256 events into native Blobs and group 32 Blobs at a time. A roughly 6 ms soft
budget yields through timer tasks, allowing input and rendering opportunities.
The final Blob contains grouped parts rather than one large string conversion.
A final task yield separates that assembly from native download and UI work.
Neither batch size nor budget guarantees a task duration on every device.

Before the first yield, export captures the old recording instance, fixed count,
metadata, mutable start options, and snapshot. Later appends remain in the live
recording. The download controller admits one job, aborts on restart/unmount,
ignores stale completions, and exposes retryable failures. Focus returns to the
canvas at the initiating click; asynchronous completion never moves focus.
The UI displays “Preparing replay…” and disables duplicate requests. Object URLs
are revoked even if initiating the native download throws.

No clock clamp, dropped tick, input coalescing, RNG change or game-rule change was
introduced. Catch-up was already bounded by the remaining escape path and did
not justify changing session timing. Timer yields were selected over a tested
scheduler-yield variant because they gave better frame/input tails here, at the
cost of longer total export preparation.

## Final native measurements

Environment: Node 24.19.0, TypeScript 6.0.3, pnpm 10.30.3, Linux 6.18.44 x64,
Intel Xeon Platinum 8573C, five exposed logical CPUs. Browser tests use installed
Chromium 151.0.7922.173 and Playwright 1.57.0. Heavy measurements use coordinated
quiet windows. CPU throttling is laboratory stress, not a physical low-end device.

Final engine SHA-256:
`31c35bec5bb8627fc6ad624c0bcd7e9af117bc61d567d3a4a0d38d8555abf26e`.
The checked-in benchmark verifies the full setup before timing selected carves
in fresh seeded engines. Setup and snapshots are untimed. Thirty paired rounds
alternate preparation and timed-command order, following five warmup pairs.
Quantiles use nearest rank; raw samples and CPU counters are retained.

| Selected command | Baseline p50 / p95 / max | Final p50 / p95 / max |
| --- | ---: | ---: |
| Normal seed 1, sixth carve | 19.290 / 20.215 / 20.498 ms | 4.230 / 4.991 / 5.021 ms |
| Easy seed 7, seventh carve | 98.291 / 101.390 / 104.133 ms | 18.088 / 20.069 / 20.392 ms |

The worst fixture improves **80.2% at p95**, exceeding the 30% target. Its p95
main-thread CPU falls 103.868 to 20.006 ms. The second fixture improves 75.3%
at p95. Source: `engine/final-benchmark.json`.

Existing workloads retain their five warmups and nine alternating rounds:

| Whole workload | Baseline median | Final median |
| --- | ---: | ---: |
| Six starts | 14.700 ms | 4.253 ms |
| 360 movement/rotation inputs | 0.598 ms | 0.613 ms |
| Three sessions, 20 carves | 73.019 ms | 20.866 ms |
| 2,716 all-shape boundary inputs | 10.466 ms | 5.857 ms |
| 20 animations of 96 fractional ticks | 0.042 ms | 0.054 ms |

The small movement and animation increases are retained, not claimed as gains.
These whole-workload medians rise by under 0.02 ms; the separate ordinary-input
p95 check uses browser evidence below. Animation code did not change, and no
particular cause is established for the roughly 11 µs total
increase. Short CPU samples quantize to zero; that is counter resolution.

The filled-placement portion of the boolean corpus visits 7,856,949 versus
264,103 states, 96.6% fewer.
This is an operation count, separately reported from measured latency. Exploratory
DFS, empty-headroom and flood timings are retained but their percentages are not
added together. The final integrated comparison is authoritative.

## Production-browser and export measurements

Final production JavaScript is 52,339 bytes versus 50,003 (+2,336, 4.7%).
Consistent zlib gzip is 18,244 versus 17,454 bytes (+790). CSS grows 21 bytes from
an unused Tailwind `hidden` utility detected in a source comment; styles and
rendering behavior are otherwise unchanged. Final JavaScript SHA-256:
`3f79965429b80bfd294e46fb092821507f7c91fefa00f08c9ecbe8242fdf115c`.

The gameplay production comparison uses unchanged, hashed assets and trusted inputs
in fresh browser contexts. Baseline/candidate order and throttle-rate order
alternate. The worst fixture has nine paired trials per throttle rate; at this
sample size nearest-rank p95 equals the maximum, not a population tail bound.
Its candidate bundle is SHA `aff71e6a…`, before the final large-export task yield.
Game, App, canvas and session sources remain byte-identical in the final build;
the changed export path runs after all timed gameplay phases. These measurements
are retained for that unchanged gameplay code. Final shipping export measurements
and full production lifecycle QA are rerun on SHA `3f799654…`; the two bundle
identities are recorded separately rather than relabeling old measurements.

| Worst carve metric | Baseline 1× | Final 1× | Baseline 6× | Final 6× |
| --- | ---: | ---: | ---: | ---: |
| Handler median | 114.3 ms | 41.8 ms | 704.8 ms | 246.0 ms |
| Handler p95/max | 158.9 ms | 75.1 ms | 865.0 ms | 371.0 ms |
| Dispatch-to-draw p95/max | 159.7 ms | 75.8 ms | 901.4 ms | 375.9 ms |
| Carve-phase RAF gap maximum | 171.1 ms | 85.5 ms | 1,005.0 ms | 387.3 ms |
| Instrumented renderer-thread CPU p95 | 154.2 ms | 81.6 ms | 971.2 ms | 413.6 ms |

Handler p95 improves **52.7% at 1× and 57.1% at 6×**, passing the 30% target.
At 1×, carve-phase Long Tasks fall from nine to two. At 6×, all nine candidate
carves still produce Long Tasks (nine tasks versus ten baseline tasks across
nine affected baseline carves). This reduces the worst synchronous stall; it
does not eliminate it. All 36 downloaded replays reconstruct exactly with the
immutable baseline engine. Source: `browser/final-worst-tail-latency.json`.

Dispatch-to-draw ends at canvas command submission, not GPU presentation. RAF
gaps are callback gaps, not a measured display frame rate. Renderer-thread CPU
includes instrumentation and other phase tasks and is not browser-wide CPU or
energy consumption. Different native and browser results are separately measured,
not interchangeable speedup claims.

The ordinary comparison uses three paired sessions per fixture/rate. Its first
screen flags ten handler/draw metric comparisons above both regression thresholds.
They include seed-2 Start at 1× (29.7 to 58.7 ms maximum handler) and seed-317
first carve at 6× (51.6 to 245.1 ms maximum dispatch-to-draw). Increased renderer
CPU in some flagged samples means they cannot be dismissed as wall-time scheduling
noise. Ordinary-tail non-regression is **failed/unresolved** against the initial
sample guard. All 84 timing-session replays match the baseline,
and all 1,596 accepted event draws complete before the first subsequent RAF.

A bounded investigation captured three alternating diagnostic pairs for seed 2
at 1× and seed 317 at 6×, including main-thread timelines, GC/compilation events,
CPU profiles and input/draw marks. The outliers did not recur: seed-2 candidate
Start measured 10.9–13.9 ms versus 30.5–35.5 ms, and seed-317 candidate carve
27.5–31.2 ms versus 47.1–72.1 ms. All 12 diagnostic replays match the baseline.
No candidate-specific long compilation or GC span explained the original events;
the 124 ms post-handler delay remains unattributed. Profiling perturbs execution,
so these runs neither replace the original samples nor establish that they were
noise. No speculative source change was made to hide an unlocated cause. A
repeatable trace on a controlled target device is still needed to attribute the
ordinary-tail regressions and choose a defensible fix.

The final replay comparison imports the unmodified shipping recording module
and exact Git baseline. Three alternating rounds per workload use 6× Chromium,
the same Blob instrumentation, and trusted input every 35 ms. A 216,001-tick
recording is a synthetic capacity fixture, not a claim of a played one-hour run.

| Large export metric | Baseline | Final |
| --- | ---: | ---: |
| Median preparation time | 605.0 ms | 2,473.1 ms |
| Worst observed Long Task | 752 ms | No tasks ≥50 ms |
| Worst trusted-key roundtrip | 759.1 ms | 19.1 ms |
| Largest RAF callback gap | 750.0 ms | 16.8 ms |
| Maximum final native Blob construction | 323.3 ms | 3.8 ms |

Every paired export is byte-identical. Eight inputs append to the live recording
during each candidate export without entering the captured file. The final
4,096-event fast path has no observed Long Task in either build, but median
preparation worsens from 15.2 to 17.4 ms and maximum from 19.9 to 23.5 ms. Its
maximum input roundtrip is 11.8 versus 11.4 ms and RAF gap 16.8 ms in both builds.
The earlier paired run went the opposite direction (21.4 to 14.6 ms); the final
unfavorable sample is retained, and there is no small-export speedup claim.
A real 2,073-event replay measures 10.7 versus 10.4 ms median preparation.

The deliberate large-export tradeoff is roughly 4.1× longer preparation for much
smaller main-thread interruptions. Final measurements include all native Blob
construction. Batch size is 256 events; the exploratory prototype also measured
serialization/Blob slice duration, explicitly separate from final shipping
latency. Key roundtrips include Playwright/protocol overhead. Sources:
`replay/implemented-profile.json` and `replay/README.md`. The earlier profile,
including its unfavorable 92.3 ms small-baseline input roundtrip, is retained
under `replay/pre-final-yield-*`.

Actual production QA then exposed a 63 ms finalization task for a larger mixed
216,003-event, 17,565,885-byte recording. Roughly 37 ms of final serialization/Blob
work and 26 ms of native download/UI work shared one task. A bounded scratch
experiment traced two exports per variant: native URL creation took 0.7–2.6 ms
and anchor click 1.3–5.5 ms; the native download call alone was not near 50 ms.
The 63 ms outlier did not recur in that experiment, but the trace confirms that
one final yield separates assembly from download/UI, preventing their costs
from accumulating in the same task. This justified the final three-line change
and a cancellation-after-assembly regression. The original observation and all
scratch samples remain in `replay/finalization-*` and `browser/pre-final-yield/`.

The final module measurement above includes the additional yield and source
SHA-256 `f5a4a6102321080883073a7b97ac89990a756e4728e2ce166a0967f35545194a`.
The complete production suite was then repeated on the final bundle. Its mixed
216,003-event export produced 17,619,064 bytes with zero observed tasks ≥50 ms
and a 2.8 ms final Blob constructor. Trusted movement, pause and resume occurred
while preparation continued. This single QA observation confirms the selected
workload check; it is not a paired speedup estimate or a universal duration bound.

## Regression checks and gates

The integrated private-search proof matches 121,263 probes over 135 boards,
5,651 exact session snapshots, 3,780 ordered public paths and 405 board decisions.
Independent row-flood validation matches 139,464 kernel decisions, 2,090 public validity
decisions and 260 purity checks. The checked-in benchmark additionally verifies
4,864 snapshots, 4,032 paths and 2,716 input outcomes against the baseline.
These corpora overlap; counts must not be added as distinct scenarios.

New regressions exercise the two slow supported sessions, upper-bridge overhangs,
strict binary connectivity, spawn-gate starts, export/storage/Blob boundaries,
capture-time mutation isolation, raw clocks, cancellation, duplicate requests,
late completions, unmount, failure/retry and busy/error presentation.

Forced typecheck, the unchanged aggregate quality command, 86 tests and the
production build pass. The GitHub Pages `--base=/sirtet/` build also passes and
produces identical JavaScript/CSS with the expected asset prefix. Local checks
use Node 24.19.0; the uninvoked deployment workflow specifies Node 25.9.0.
Coverage is 97.63% statements, 92.62% branches, 97.47%
functions and 98.80% lines against the existing 90% thresholds. No threshold,
configuration or dependency changed.

Final production browser QA passes 43 functional checks: 17 lifecycle checks at
each CPU rate, two terminal recovery/restart checks at each rate, and five large
export checks. Both normal and easy modes were exercised, with desktop keyboard
and narrow touch emulation, held/repeated input, trusted window blur, idle frame
suppression, pause/resume and repeated restart. Export checks cover continued play,
capture isolation, duplicate suppression, later focus, reload/restart cancellation,
and recovery after URL creation or anchor-click failure. No page errors occurred.
All 80 final lifecycle and seven seeded export downloads reconstruct exactly with
the baseline. Including the 84 timing and 12 diagnostic downloads gives 183
seeded files; three ready-state files are checked separately. These counts exclude
superseded and pre-final-yield runs. Final Preparing, mobile idle and restarted
screenshots were inspected. This pass did not repeat prior full pixel equivalence.

Two corrected harness assumptions are preserved with their original failures.
An initial 6× check sampled after a wall-clock sleep that crossed an animation
beat; the replacement checks recorded boundary clocks and the first active tick
against the exact baseline. Another check assumed a second click on the newly
disabled export button retained canvas focus; focus and duplicate suppression
are now checked separately. No game rule or timing tolerance was changed to pass
these checks. `browser/README.md` explains both cases and retains the evidence.

Review caught and fixed object-URL cleanup on failed native downloads and a
non-numeric mutation in a test fixture. An initial browser run on the bundle
before the cleanup fix was stopped and retained under
`browser/superseded-e652f62f`; final acceptance uses only the rebuilt bundle.

## Acceptance and remaining limits

The result is **partial/blocked**: the targeted carve and export improvements
pass, while the ordinary-input guard remains unresolved and two device checks
cannot be performed here.

| Criterion | Status | Evidence and limit |
| --- | --- | --- |
| 1. Exact mechanics, paths, RNG and replay clocks | Passed | Finite-state proof, engine/flood equivalence, behavior regressions and 183 baseline-exact seeded browser files |
| 2. Difficult-carve p95 at least 30% lower | Passed | Native 80.2% lower; 6× production gameplay 57.1% lower; all samples retained |
| 3. Ordinary-input p95 guard | Failed / unresolved | Ten original flags; bounded traces did not reproduce or attribute them |
| 4. Fixed large 6× export responsiveness | Passed for measured workload | Three paired final-module trials with no task ≥50 ms; input, RAF, all native Blob calls and total preparation measured; serializer-slice timing is from the explicitly labeled prototype |
| 5. Export capture and interruption behavior | Passed | Unit regressions and final production capacity/cancel/retry checks |
| 6. Unchanged repository gates and builds | Passed | 86 tests, types, lint, coverage, unused-code and duplication checks; normal and Pages builds |
| 7. Actual production gameplay lifecycle | Passed | 43 final functional checks at 1×/6×; keyboard and touch emulation; exact replay reconstruction |
| 8a. Native document-hidden transition | Blocked | Trusted blur works, but available activation/lifecycle attempts leave `document.hidden=false` |
| 8b. Physical low-end/mobile device | Blocked | No attached physical device, headed display or Safari; CPU throttle and touch emulation are not substitutes |
| 9. Focused architecture/workflow and local delivery | Passed | No dependencies or settings changes; semantic local commits, reproducible harnesses, hashed evidence and patches; other worktrees unchanged |

The ten ordinary-tail flags require a reproducible trace on a controlled target
device before choosing another source change. The observed 371 ms worst carve
at 6× also remains a substantial synchronous stall. This pass does not claim
stutter-free play or improved performance on every input or device.

The installed browser has no headed display, Xvfb, physical mobile device or
Safari. Supported prior activation/focus/lifecycle attempts produce trusted blur
but leave `document.hidden` false. Available remote browser tools do not expose
this workspace's localhost or an attached device. No deployment or machine-setting
change was used to bypass the limitation. Completing those checks requires a
supported headed browser and a physical mobile/touch device.

Long recordings still consume memory proportional to event count. Cooperative
export adds Blob objects and preparation time. Neither the sampled carve maximum
nor the 6 ms export budget is a universal upper bound; CPU throttling does not
emulate low-memory pressure, GPU performance, thermal throttling or device input.

## Reproduction and local delivery

Repository commands:

```sh
pnpm exec tsc -b --force
pnpm quality
pnpm test
pnpm build
pnpm build --base=/sirtet/ --outDir=/tmp/sirtet-pages-build
node scripts/benchmark-engine.mjs 487fe689 HEAD > /tmp/sirtet-tail.json
```

Raw evidence lives in `/workspace/sirtet-tail-evidence`. It includes frozen
baseline/final production files, source hashes, fixtures, scripts, profiles, every
timing sample, exact replay downloads and gate logs. The browser scripts use
preinstalled Chromium/Playwright and local HTTP servers. Absolute workspace paths
may need adjustment when reproducing elsewhere.

For this environment, `pnpm` resolves to the existing pinned executable through
`node /workspace/.cache/corepack/v1/pnpm/10.30.3/bin/pnpm.cjs`. The aggregate gate
uses `PATH=/tmp/sirtet-tools:$PATH` so its child commands resolve that same version.
No software was installed. Final logs are `quality-final-yield.log`,
`test-final-yield.log`, `build-final-yield.log` and `pages-build-final-yield.log`.

Start a local production server with `pnpm preview --host 127.0.0.1 --port 4175`.
Run browser measurements sequentially, without builds or other profiling jobs:

```sh
SIRTET_CANDIDATE_SOURCE=/workspace/sirtet-tail-evidence/browser/final-candidate \
  node /workspace/sirtet-tail-evidence/browser/run-final-tail.mjs
node /workspace/sirtet-tail-evidence/browser/summarize-final.mjs
node /workspace/sirtet-tail-evidence/replay/implemented-profile.mjs
python3 /workspace/sirtet-tail-evidence/browser/run-final-qa.py
```

The timing command reproduces the explicitly identified gameplay bundle; the QA
driver selects `final-yield-candidate` for the shipping bundle. Commands, fixture
selection, reconstruction steps and prerequisites are detailed in
`browser/README.md` and `replay/README.md`. These are the executed commands, not
safe overwrite commands: before rerunning, copy the complete evidence tree and
retarget its hardcoded evidence-root constants, fixture paths and output paths
to the new copy. Copying one script or changing its label alone is insufficient.
QA/timing drivers create logs exclusively; module profiling overwrites its fixed
output path. Localhost socket access is required.

Verified code commits:

- `e7f4a5a0723998eda03a33d0f957cba91c8ef978` — reduce worst-case legality search work.
- `9a0731cd8b8c3bca6a9735114d2e852fd052195a` — yield during large download preparation.

The delivery manifest records the final documentation commit, source/build hashes
and artifact checksums. `/workspace/sirtet-tail-optimization.patch` reviews this
pass from `487fe689`; `/workspace/sirtet-optimization-through-tail.patch` includes
the optimization series from `3d2d541`. Raw evidence and the report are packaged
in `/workspace/sirtet-tail-verification.tar.gz`. Nothing is pushed or deployed.
