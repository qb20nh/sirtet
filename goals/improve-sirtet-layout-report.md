# Ordered search and placement layout follow-up

2026-10-08, UTC. Continuation baseline:
`f0085646e39b2e13d6b99c75bb552658d5274019`. This pass builds on the
[deep optimization report](improve-sirtet-deep-optimization-report.md), retaining
its historical measurements and failed 15% session target. The final comparison
below reassesses that target with the same workload.

Work remains isolated on `codex/sirtet-performance` in `/workspace/sirtet-perf`.
The original and PR worktrees are unchanged. CBBG was not accessed. No memories,
dependencies, machine settings or security settings were changed. PR #1 is already
merged; these unsigned continuation commits remain local, as authorized. Nothing
was pushed, merged or deployed.

## Changes and bounds

Escape search now indexes its existing rotation and kick arrays directly. Neighbor
order, first-valid-kick selection, visited-state handling, full path ownership and
the search limit are unchanged. The measured speedup does not establish a specific
JIT mechanism or an eliminated-allocation count.

Placement metadata stores occupied-cell and support addresses in two flat
`Uint16Array` buffers instead of thousands of small arrays. Each address packs
ten column-mask bits and a row index from 0 to 25; the maximum is 26,112. Each
tetromino has four slots. Unused support slots have mask zero, which cannot alias
a real cell, including row zero/column zero. Changing board dimensions or piece
size requires revisiting these bounds. Placement order, IDs, cells and reverse
indexes remain intact.

Cell-set deduplication uses small integer keys. The minimum absolute cell index
and the sorted offsets relative to it uniquely reconstruct a set of four cells.
Only the 28 rotation geometries need pattern lookup during initialization; each
placement key is `patternId * CELL_COUNT + minimumCellIndex`. All 5,884 records
map bijectively to the original 3,965 cell sets, with maximum key 4,919. No
36-bit number, long per-placement string or persistent canonicalization map is
needed.

The engine benchmark additionally reports main-thread CPU where Node supports
it, preserving elapsed-time results. CPU excludes scheduling waits and other
threads; zero/quantized short samples indicate counter resolution, not zero work.
Git source hashes now include the exact file bytes, including the final newline.
Earlier follow-up JSON used the pre-existing trimmed Git-source hash; those
unfavorable and intermediate samples remain available and are not rewritten.

## Technique selection

The retained changes apply data-oriented storage, bitpacking, precomputation and
direct iteration to measured costs. Earlier passes already provide private BFS
buffer reuse, cached legality, incremental reverse-index updates, bounded replay
serialization, and change-driven rendering. Returned snapshots and paths still
own their data; pooling them would violate the existing isolation contract.

No hardware cache-miss, alignment or SIMD speedup was measured. JavaScript typed
arrays control element layout, not physical cache alignment. A board row already
fits a scalar mask; ordered, branch-heavy BFS offers no established worker/SIMD
benefit here. Parallelizing input-dependent searches would require dispatch,
metadata duplication and deterministic result-order costs. The existing synthetic
long-replay export remains a possible async experiment, but its small real replay
exports in about 1.8 ms and this pass does not claim an async improvement.

## Rejected and intermediate candidates

- O-only boolean rotation pruning passed 38,868 boolean comparisons and 5,208
  full paths. Visited states fell 11,899 to 3,056, but two stable comparisons
  improved sessions only 0.4–0.85%. The special case was rejected.
- Direct 36-bit cell keys and a precomputed variant saved retained memory but
  did not justify runtime tradeoffs. The precomputed variant slowed sessions
  about 3.1%. Dense canonical IDs required a larger temporary map; normalized
  geometry gives small keys with only a tiny initialization lookup.
- Cell row/mask lookup tables and packed ordinary arrays offered less memory
  reduction than flat buffers. Flat buffers alone reduced retained Node heap
  plus array backing by 855,608 bytes (20.5%) and six-start time by 9.6%, but
  cold module import rose about 0.98 ms. The combined variant is measured
  separately; isolated percentages must not be added.
- The combined exploratory variant reduced native retained heap plus backing
  from 4,186,760 to 3,144,296 bytes (24.9%). Its fresh-process cold import was
  neutral at 20.665 versus 20.601 ms, while repeated metadata construction was
  slower, 7.00 versus 7.63 ms. That one-time-work tradeoff is retained in the
  evidence. No lower peak allocation claim is made.

## Final engine and memory measurements

Environment: Node 24.19.0, TypeScript 6.0.3, pinned pnpm 10.30.3, Linux 6.18.44
x64, Intel Xeon Platinum 8573C, five exposed logical CPUs. Browser measurements
use installed Chromium 151.0.7922.173 and Playwright 1.57.0. No software was
installed. Heavy measurements ran in coordinated quiet windows. Raw samples,
including unfavorable results, are retained.

Final engine source SHA-256:
`cef01d6fd6d49b6cb8e0efdbb840678354c18208438611d5845f9d1a4b995714`.
Native comparisons use five warmups and nine alternating rounds in the same
process, with identical seeded traces and untimed equivalence checks.

| Workload | f008 baseline | Final | Observation |
| --- | ---: | ---: | --- |
| Six starts, construction included | 21.376 ms | 14.950 ms | 30.1% less |
| 360 movement/rotation inputs | 0.657 ms | 0.646 ms | 1.5% less; small |
| Three sessions, 20 successful carves | 107.682 ms | 74.406 ms | 30.9% less |
| 2,716 all-shape boundary inputs | 14.555 ms | 11.636 ms | 20.1% less |
| 20 animations, 96 fractional ticks each | 0.039 ms | 0.050 ms | About 11 microseconds more in total |

Session main-thread CPU independently falls 107.876 to 75.996 ms (29.6% less).
Short control/animation CPU samples quantize to zero and establish no CPU saving.
The isolated animation workload is slower by roughly six nanoseconds per tick in
this run. Its tick implementation did not change; no specific cause is established.
This small absolute cost is a recorded tradeoff, not a claim that every operation
became faster. Compared with the earlier `36f753d` baseline, animation still falls
0.340 to 0.055 ms.

A separate alternating comparison against `36f753d` measures fixed sessions at
129.957 versus 75.170 ms, **42.2% less time**, passing the previously missed 15%
target. Baseline/candidate pairs must be read within their own runs; startup
medians differ across runs. Sources: `engine-final-vs-previous.json` and
`engine-final-vs-deep-baseline.json` in the follow-up evidence directory.

Eleven alternating fresh Chromium contexts compare the final production bundle
with the immutable f008 bundle. After forced GC, READY-state retained JavaScript
heap plus external backing storage falls **3,933,535 to 3,334,242 bytes (15.2%)**.
Heap alone falls 3,876,108 to 3,181,796 bytes; backing storage increases 57,427 to
152,446 bytes and is included in the total. This excludes canvas/GPU memory and
does not measure peak allocation or battery consumption.

Synchronous bundle execution increases **47.8 to 49.8 ms**; there is no bundle
execution speedup claim. Localhost DOMContentLoaded measures 81.3 versus 77.6 ms.
The trusted Start click dispatch measures 30.7 versus 22.7 ms. All 22 loads
reach PLAYING, and READY screenshots are byte-identical. Module execution excludes
download/parse, and handler duration is not paint latency. Source:
`metadata/combined-browser-load.json` in the layout evidence directory.

A separate response comparison serves both production bundles unchanged, wraps
their actual registered input handlers, and uses the same seed-1 first-carve
route. Eleven alternating fresh-context rounds measure Start handler medians
**30.0 to 25.5 ms (15% less)** and dispatch-to-board-draw submission **31.1 to
29.2 ms (6.1% less)**. First-carve handler time is essentially unchanged, 10.2
versus 10.1 ms; first-carve dispatch-to-draw rises 11.3 to 11.8 ms. No first-carve
latency improvement is established. Both builds have large wall-time outliers
(baseline Start up to 134.2 ms, candidate up to 104.7 ms), whose cause was not
established; no tail-latency improvement is claimed.

All 44 measured Start/carve events are trusted and submit their board draw before
the first subsequent RAF callback. All 22 first-carve downloads reconstruct
exactly with the immutable f008 engine. These are handler/draw-submission results,
not GPU presentation, frame-rate or physical input-latency measurements. Source:
`render/final-start-carve-response.json` in the follow-up evidence directory.

## Behavior and final gates

Before final timing, both revisions produce 1,308 identical session snapshots,
97 animation snapshots, 2,723 boundary snapshots, 2,716 matching input outcomes
and 4,032 exactly ordered paths. The 95-board corpus matches 2,090 validity and
161 availability decisions without mutating boards.

The layout proof independently compares all 47,072 address slots, including
9,916 empty support slots. It checks 3,083,216 occupied/support counts over every
one-hot board, a full board and an empty board, and preserves every reverse index.
All 56 single-tetromino floor-support cases pass on both implementations. The
checked-in regression repeats these public behaviors for seven shapes, all four
rotations and both walls.

Forced typecheck, the complete unchanged `pnpm quality` gate, 68 tests and the
production build pass. Coverage is 97.14% statements, 92.17% branches, 96.90%
functions and 98.39% lines against the existing 90% thresholds. Final duplication
is 0.30% against the unchanged 1% threshold. One initial aggregate quality run reported a coverage
process exit 1 without diagnostics. Standalone coverage and the exact aggregate
rerun passed without any code, threshold or configuration changes. The initial
failure remains unexplained and its log is retained; it is not silently discarded.

Production JavaScript grows 49,648 to 50,003 bytes (+355, 0.7%); consistent Node
gzip grows 17,292 to 17,454 bytes (+162). CSS is byte-identical at 11,853 bytes.
Final JavaScript SHA-256:
`fbebbddf3c8532c208a0f7549ffc4f50a91b26c0973f6ac3fe12b132c509e2a9`.

The exact final production bundle passes 17 main browser checks and two terminal
checks, with no failures. Both suites include the no-JavaScript-errors check, so
their totals are not 19 unique behaviors. Coverage includes two normal losses and
restarts; easy-mode repeated carving, pause/resume and two idle/resume cycles;
trusted held-key/focus interruptions; input repetition; download focus; narrow
touch emulation; reload; and a naturally stuck easy run followed by End game and
restart. Idle animation callbacks remain zero. Desktop paused, mobile idle and
mobile restarted screenshots were inspected.

All 40 seeded QA downloads reconstruct accepted inputs and complete snapshots
with both the final and immutable f008 engines, including recordings above 2,000
events. Together with the response run, **all 62 downloaded replays match f008**.
Sources: `render/final-browser/report.json`,
`render/final-terminal-browser/report.json`,
`render/final-download-reconstruction.json` and
`render/final-download-baseline-reconstruction.json`.

## Acceptance ledger

| Acceptance check | Status | Evidence or remaining requirement |
| --- | --- | --- |
| Preserve unrelated work and verified baseline | Passed | Isolated branch; original and PR worktrees unchanged |
| Preserve exact mechanics, path order and snapshot ownership | Passed | 4,128 exact snapshots, 4,032 paths, 2,716 input outcomes; regression suite |
| Preserve placement IDs, support relationships and unique cell sets | Passed | Every metadata record/address; 3,083,216 count checks; 56 floor cases |
| Preserve replay values and session continuity | Passed | All 62 browser downloads match immutable f008; existing interruption/chunk regressions |
| Measured benefit for retained changes | Passed | Search/session timing and CPU, browser retained memory and Start response |
| At least 15% less session time versus 36f753d | Passed | 42.2% less in the final alternating comparison |
| No material starts/control slowdown | Passed | Starts and control workloads improve; small animation/carve and startup costs disclosed above |
| Maintainable representation and verification workflow | Passed | Bounded private buffers, documented encoding, public regression, exact source hashes and CPU diagnostics |
| Unchanged quality gates and production build | Passed | 68 tests, coverage above 90%, full aggregate rerun passed; initial unexplained failure retained |
| Preserve visual identity | Passed | READY pixels identical, final screenshots inspected, render/UI/CSS sources unchanged |
| Actual lifecycle and supported emulated modes | Passed | Main and terminal browser suites, trusted blur and repeated-input interruptions |
| Native document-hidden transition | Blocked | Headless activation produces trusted blur but document.hidden stays false; no headed display/Xvfb |
| Physical mobile/touch browser check | Blocked | No attached device, physical touch hardware or Safari; emulation is not a substitute |
| Semantic local commits and reviewable evidence | Passed | Separate search/layout/docs commits, patches, source hashes and evidence archive |

The visibility listener remains unit-tested, and trusted native window blur was
exercised. Earlier supported attempts using real page activation, disabled focus
emulation and lifecycle frozen/active did not produce document.hidden. Available
remote browser tools do not expose this workspace's localhost or a physical device;
no deployment or settings changes were made to bypass the limitation. Completing
the two blocked checks requires a supported headed browser and an actual mobile
touch device. See `capability-check.md` in the follow-up evidence directory.

All software acceptance criteria pass. Full acceptance remains partial because
the two native/device checks are unavailable. This pass stops at the verified
changes; it makes no claim that every possible optimization has been exhausted.

## Reproduction and local commits

Use the same Node/browser versions and comparable machine conditions; compare
alternating samples within one run. The repository benchmark commands are:

```sh
pnpm exec tsc -b --force
pnpm quality
pnpm test
pnpm build
node scripts/benchmark-engine.mjs f008564 HEAD > /tmp/sirtet-followup.json
node scripts/benchmark-engine.mjs 36f753d HEAD > /tmp/sirtet-deep-target.json
```

The remaining scripts and exact commands are retained in
`/workspace/sirtet-followup-evidence` and `/workspace/sirtet-layout-evidence`.
Their raw source copies and production assets preserve measured revisions.
Browser scripts use preinstalled Playwright/Chromium and local HTTP servers;
adjust absolute workspace paths if reproducing on another machine. Key commands:

```sh
node /workspace/sirtet-layout-evidence/index/verify-addresses.mjs /workspace/sirtet-perf/src/game.ts
node /workspace/sirtet-layout-evidence/metadata/combined-browser-load.mjs
node /workspace/sirtet-followup-evidence/render/start-carve-response.mjs final
node /workspace/sirtet-followup-evidence/render/browser-qa.mjs final
node /workspace/sirtet-followup-evidence/render/browser-terminal-qa.mjs final
node /workspace/sirtet-followup-evidence/render/check-final-downloads.mjs
node /workspace/sirtet-followup-evidence/render/check-final-downloads-baseline.mjs
```

The gameplay scripts expect the final build served at `http://127.0.0.1:4175`;
the response/startup scripts create their own matching local servers. The metadata
README records cold-process memory commands and the exploratory source hashes.

- `aed158861025ee0a8a7113d85b7760a63ab19cc1`: ordered escape-search iteration and
  benchmark CPU/source-hash reporting.
- `f47a2a348debcb4aa0afeaadc9b419885e49cabe`: flat placement addresses, small
  cell-set keys and public floor-support regressions.

The final documentation commit records results. Review this continuation with
`git diff f008564 HEAD`; review the full local optimization series with
`git diff 3d2d541 HEAD`.

Local deliverables: `/workspace/sirtet-layout-optimization.patch`,
`/workspace/sirtet-optimization-through-layout.patch`, and
`/workspace/sirtet-layout-verification.tar.gz`. The evidence archive contains
the scripts, raw samples, source copies, profiles, build/gate logs, downloaded
replays, screenshots and final commit/source manifest.
