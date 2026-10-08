# Sirtet gameplay acceptance report

Date: 2026-10-08 (Asia/Seoul). Outcome: **Implemented and verified within available
capabilities; native document hiding and physical-device QA remain blocked.**

This continuation builds on draft [PR #1](https://github.com/qb20nh/sirtet/pull/1).
It makes no claim that browser automation establishes physical-device behavior.

## Baseline and isolation

- Original main: `dbb0f9942fa374a04d1ad746de5a87ac8513d8db`.
- PR head at start and final remote check:
  `8e6d8840278de73422485ced3ea4b4e72c4f4b32`.
- Original cloud checkout `/workspace/sirtet`, branch `work`, was clean and stays
  at original main. A separate worktree `/workspace/sirtet-pr1`, branch
  `codex/sirtet-continuity`, continues PR #1. Existing branches were retained.
- No applicable AGENTS.md or local memory files were found in the accessible
  workspace. The prior PR report and targeted Git history supplied background.
  The anti-slop engineering and cloud-environment skills were applied.
- The prior report mentions unfinished legality edits on another machine at
  `/home/cash/git/sirtet`. That checkout and CBBG are unavailable here; neither
  was accessed or modified. No unrelated files were changed.
- Existing PR improvements were retained: visible-change-only state publication,
  pause/resume with clock rebasing, native interruption listeners, keyboard
  routing, narrow/coarse-pointer controls, and extracted session logic.
- Initial PR baseline: 41 tests and production build passed. Normal/easy modes,
  keyboard controls, seven-piece bags, upward escape paths, carving, board rise,
  hold/queue behavior and scoring were established from source and gameplay.

Before code changes, acceptance was set to retain the measured idle-work
reduction, fix reproduced session/replay defects, preserve game rules, pass all
existing gates, and exercise desktop/narrow gameplay, restart, interruption and
actual downloads. Physical and native-visibility checks were kept separate.

## Changes and reproduced failures

1. Replay timing: waiting ten seconds before the first carve produced a live
   PLAYING state but reconstructed GAMEOVER (path index 1 versus 22). Omitted
   idle ticks lost the clock boundary before input. Exports now capture the last
   processed tick without advancing the live engine.
2. Fractional timing: combining active timer updates at 60 Hz changed a step
   boundary. With seed 1 and clock origin 1000.1, frame 96 left the live piece at
   path index 4 / timer 399.9999999999999, while reconstruction reached index 5 /
   timer 0. Version 3 retains original clock values and every active tick;
   relative time remains display metadata. Tests assert exact snapshot equality.
3. Seed portability: the same seed 2147483648 started with L in Node and J in
   Chromium because the random sort comparator consumed RNG values differently.
   Bag creation now uses the engine's existing Fisher–Yates helper. Seven-piece
   membership, delayed opening S/Z pieces and preview repeat prevention remain.
4. Download flow: after clicking Download replay, ArrowRight was ignored while
   the run continued, because focus stayed on the button. Export now restores
   board focus during play. The actual browser check moves the cursor from 4 to 5.
5. An explicit end of a stuck easy run is recorded as `end-stuck`, allowing its
   exported terminal snapshot to reconstruct. Restart resets the run and log.
6. `pnpm benchmark:idle` runs a checked-in comparison using actual Git source,
   replacing dependence on unavailable benchmark files from the earlier report.
   README documents the replay contract, controls, architecture and verification.

No dependencies, quality thresholds, coverage exclusions or machine settings
were changed. Core escape, collision, scoring and queue rules were not rewritten.
The new shuffle changes seed-specific ordering; older replay versions do not
inherit version 3 reconstruction guarantees.

## Acceptance status

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Verify repository, prior work and isolate changes | Passed | Clean original checkout; explicit PR baseline; separate worktree; remote refs unchanged |
| Establish baseline, priorities and acceptance before edits | Passed | 41-test/build baseline, source/history inspection, reproducible failures and stated criteria |
| Preserve core mechanics and supported modes | Passed | Existing mechanics tests plus normal/easy browser play; bag invariants retained |
| Improve measured responsiveness bottleneck | Passed | Original-main versus final-engine idle comparison below; inherited optimization retained |
| Fix reproducible player flow | Passed | Download restores focus; native ArrowRight works immediately afterward |
| Repeated play, restart, pause/resume and focus loss | Passed | Two normal loss/restart cycles; easy terminal/restart; frozen partial step; trusted native blur during held input; explicit resume |
| Replay fidelity and actual file delivery | Passed | Downloaded active, paused, easy-idle and terminal snapshots reconstruct exactly in Node from Chromium files |
| Supporting architecture and developer workflow | Passed | Session-owned event boundaries, read-only engine clock access, focused regressions and reusable benchmark |
| Lint, types, tests, coverage, unused code, duplication, production build | Passed | 46 tests; unchanged gates; results below |
| Desktop and narrow/coarse-pointer browser QA | Passed | Chromium at 1280x1000 and 390x844; actual keyboard/button/touch-emulation interactions |
| Native document-hidden interruption | Blocked | Headless Chromium never exposed hidden=true under attempted native transitions; needs a headed browser check |
| Physical touch/mobile browser QA | Blocked | No phone/tablet or Safari available; emulation is not physical-device evidence |
| Local commits and reviewable diff | Passed | Semantic commits below; user explicitly authorized unsigned commits in this environment |
| Preserve unrelated work and release boundaries | Passed | Original tracked checkout unchanged; no push, merge, deployment or release |
| Reproducible evidence and explicit limitations | Passed | Source-backed benchmark, raw logs, browser/download artifacts and blocked paths retained |

Final browser acceptance: **17 passed, 0 failed, 2 blocked**. No JavaScript page
errors occurred. One initial browser route exhausted its 15-iteration search
limit while legal play remained possible. A focused seed-1 run then naturally
became stuck after six carves, clicked End game, reconstructed the downloaded
189-event terminal replay exactly, and restarted easy mode with a fresh log.
The initial bounded-route result is retained as inconclusive harness evidence.

## Verification

Environment: Linux 6.18.44 x64, Node v24.19.0, pnpm 10.30.3, TypeScript 6.0.3,
Vitest 4.1.6, Chromium 151.0.7922.173 and preinstalled Playwright 1.57.0. The host
exposes five logical CPUs (Intel Xeon Platinum 8573C). No software was installed.

From the repository root with the pinned pnpm available:

```sh
pnpm test:session
pnpm test
pnpm quality
pnpm typecheck
pnpm lint
pnpm coverage
pnpm knip
pnpm jscpd
pnpm build
```

The environment's default pnpm was 11.19.0, so direct invocations used
`node /workspace/.cache/corepack/v1/pnpm/10.30.3/bin/pnpm.cjs` for the pinned runner.
The quality aggregate and individual gates passed. Coverage: statements 96.80%,
branches 91.83%, functions 96.98%, lines 97.99%, all above the existing 90% gates.
Duplication was 0.62%, below the existing 1% threshold. Build: JS 47.86 kB / 16.67 kB
gzip; CSS 12.08 kB / 3.73 kB gzip. The browser-tested JS SHA-256 is
`c2907b7767ca80e85d269e7b5bd2bd75626f967202abc22cad53ed52c1bbbfd6`.

The pre-existing 50 ms board-validation assertion was retained and passed on the
final run; it remains sensitive to shared-host load. New tests demonstrated
failures before the corresponding fixes. No timing threshold was relaxed.

## Comparable performance

Actual engine and animation-loop declarations were loaded from original main
and `a2c0cab6439cc2bc314403f3d6d2ebe7b6e94e23`. Both run the same 600 callbacks at
60 Hz, RNG 0.5, no active piece. Engine setup and assertions are outside timing.
Five warmups precede nine alternating rounds of twenty samples per revision.
Each sample asserts the complete snapshot is unchanged. The same Node process,
host and counter instrumentation are used for both revisions.

| Per 600 idle callbacks | Original main | Final engine |
| --- | ---: | ---: |
| Snapshots | 1,200 | 0 |
| State publications | 600 | 0 |
| Replay ticks | 0 | 0 |
| Frame requests including initial request | 601 | 601 |
| Median round mean callback time | 1.333 ms | 0.099 ms |
| Range of round means | 1.279–1.656 ms | 0.093–0.134 ms |

These are measured instrumented Node callback durations, not browser frame rate,
input latency, battery savings or CPU-utilization measurements. The optimization
removes idle snapshot/publication work; it does not remove RAF scheduling.
Active replay fidelity now costs one event per animation frame (about 60/sec at
60 Hz), so active replay files are larger. Silent active ticks still do not
snapshot or redraw. Sessions remain in memory; reload persistence and replay
import are outside this change.

Reproduce the exact comparison using the tracked script:

```sh
node scripts/benchmark-idle.mjs dbb0f9942fa374a04d1ad746de5a87ac8513d8db a2c0cab6439cc2bc314403f3d6d2ebe7b6e94e23 > /tmp/sirtet-idle.json
```

The JSON includes source hashes, environment, all raw samples and operation
counts. Measurements with earlier harnesses or intermediate code are retained
separately and are not used for this final comparison.

## Browser evidence, blockers and required input

The production bundle was served locally on port 4173 and exercised with
preinstalled Chromium/Playwright. The harness uses legal placements to plan
moves, then performs real keyboard, button and touch-emulation interactions.
Downloads are observed before clicking and the delivered JSON files are saved.
Exact snapshot comparisons do not use tolerances or normalize fields.

For native focus loss, disabling browser focus emulation and bringing another
page to the front emitted a trusted window blur. The run paused with the held
key interrupted and stayed paused on return. Native document visibility was
attempted separately using page activation and CDP lifecycle frozen/active;
`document.hidden` stayed false and no visibility event occurred. The unit-tested
visibility listener does not count as a passed browser check.

Remaining input needed: a headed browser capable of a real hidden-document
transition, plus physical phone/tablet QA on a mobile browser. No machine setting
changes or software installation were used to work around those gaps. GitHub
CLI API access was unavailable; supported Git fetch and the GitHub connector
provided PR metadata and source without changing the PR.

Local evidence is retained at `/workspace/sirtet-evidence` (not committed to the
PR). `browser-acceptance.json` indexes every browser check and source/bundle
hashes; `final-browser/` and `final-terminal-browser/` contain downloads,
screenshots and raw reports. `browser-qa.mjs` and `browser-terminal-qa.mjs` rerun
the checks in this provisioned environment with a local server on port 4173.
The first script retains the bounded terminal search; the focused script covers
that terminal action with seed 1. General manual browser checks are in README.

Other evidence: `final-*.log` for gates, `idle-comparison.json` for measurement,
`pre-fix-regression-coverage.log`, `fractional-replay-before.log` and
`seeded-bag-before.log` for failing-before regressions, plus `baseline-browser/`
and `clock-fix-browser/` for initial/intermediate browser failures. The early
baseline browser harness also had an incorrect expected score (40 instead of the
engine's 100); it was corrected in the harness, not in game rules or repository
assertions. Raw historical attempts remain available.

## Local commits and review

New unsigned commits, explicitly authorized by the user because no signing key
or SSH agent is configured in this cloud environment:

- `e02ffbde806601f6cc7f4f87b1b9d11283efc456` — exact replay timing, explicit ending,
  download focus and behavior regressions.
- `a2c0cab6439cc2bc314403f3d6d2ebe7b6e94e23` — portable seeded bag shuffle and
  four-bag regression.
- `0569f8648654d9809db3bea0845647f37c151e8b` — reusable benchmark command and updated
  replay/development documentation.

The report is committed separately after these changes. Existing PR commits,
including their signatures, are unchanged. Review the continuation with
`git diff pr-1-baseline..HEAD`, or the complete improvement set with
`git diff dbb0f9942fa374a04d1ad746de5a87ac8513d8db..HEAD`.
