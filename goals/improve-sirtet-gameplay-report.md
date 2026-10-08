# Sirtet Goal acceptance report

Outcome: **Partially verified; remaining runtime QA blocked.**

This report evaluates the approved `improve-sirtet-gameplay` Goal against the
existing implementation and fresh checks. It does not claim that unavailable
browser or physical-device checks passed. No additional gameplay changes were
needed to reproduce the selected improvement or pass the automated gates.

## Changes and scope

The isolated branch `codex/gameplay-performance-experience` contains:

- `35144866820fab8b6de9a693be5757ac3f41caaa`: visible-change-only animation
  publication; engine pause/resume with clock rebasing; interruption listeners;
  safer keyboard routing; touch controls; clearer status/hold recovery messages;
  extracted session logic and behavior regressions.
- `ab60079ac711c2cf6f6837499c2a16f7f45f103e`: gameplay, architecture and development
  documentation, plus the focused session-test command.

Both implementation commits have verified SSH signatures. The original checkout
at `/home/cash/git/sirtet` remains at
`dbb0f9942fa374a04d1ad746de5a87ac8513d8db`, with staged and unstaged changes in
`src/game.ts` and `test/game.test.ts`. Those unfinished legality changes are not
included in this branch. CBBG and unrelated active work were not changed. There
was no push, merge, deployment, public release, dependency addition or change to
machine security/settings.

## Acceptance status

| Criterion | Status | Evidence |
| --- | --- | --- |
| Repository, starting revision and isolation | Passed | Verified Git identity, branch, original checkout status and unchanged starting revision |
| Mechanics and baseline | Passed | Reverse Tetris normal/easy modes, initial 31 passing tests, source inspection and prior gameplay QA recorded in `../evidence/verification.md` from the repository root |
| Priorities and acceptance criteria | Passed | Idle-frame work, interruption safety and input/player friction drove the existing coherent change set; confirmed Goal specifies the checks |
| Measured responsiveness improvement | Passed | Same-workload comparison of committed baseline and current engine/loop functions, with five measured runs per revision |
| Playability/player-flow improvement | Passed | Partial-step pause/resume, long interruptions, restart and input tests; prior browser carving, loss/restart and repeated easy-mode play |
| Supporting architecture and developer workflow | Passed | Session logic separated from App lifecycle wiring; stable engine ref; focused test command and documented checks |
| Automated quality/build gates | Passed on retry | Fresh serial typecheck, lint, coverage, knip, jscpd and production build; initial timing failure retained below |
| Browser/gameplay QA | Partial / blocked | Earlier desktop/narrow gameplay checks passed; native focus loss, delivered replay download and physical touch remain unverified |
| Preservation and release boundaries | Passed | Original checkout retains its staged/unstaged changes; no unrelated edits or external release actions |
| Signed local commits and reviewable diff | Passed | Existing signatures verified; complete implementation diff retained in `../evidence/review.patch` |
| Final evidence and limitations | Passed | Exact implementation commits, commands, comparison data, logs, screenshots and blockers are retained |

## Comparable performance evidence

Workload: 600 idle animation callbacks at 60 Hz, fixed RNG 0.5, with engine setup
outside the measurement. The harness extracts the actual loop/helper function
declarations and engine source, rather than reimplementing either loop. Node
v26.10.0, Linux x64; one warm-up and five measured runs for each revision.

| Work per 600 callbacks | Baseline | Current |
| --- | ---: | ---: |
| Engine snapshots | 1,200 | 0 |
| State publications | 600 | 0 |
| Replay ticks | 0 | 0 |
| Frame requests, including initial request | 601 | 601 |
| Median callback work | 1.530 ms | 0.061 ms |

Every measured run matched the operation counts. The timing is a small Node
diagnostic, subject to system noise. It does not establish browser FPS, battery
savings or input latency. Both loops still request frames while playing; the
improvement removes snapshot/publication work on idle frames.

Reproduce from the repository root with the retained evidence artifacts:

```sh
python3 ../evidence/prepare-idle-baseline.py "$PWD"
node ../evidence/compare-idle-loop.mjs "$PWD"
```

The raw result is `../evidence/idle-comparison.json`. Baseline source exported by
the preparation script is committed source from `dbb0f9942fa374a04d1ad746de5a87ac8513d8db`;
the original user's modified source was not used for the comparison.

## Fresh checks and timing risk

Resource Guard reported mild memory pressure, so the gates ran sequentially:

```sh
pnpm typecheck
pnpm lint
pnpm exec vitest run --coverage --maxWorkers=1
pnpm knip
pnpm jscpd
pnpm build
```

All gates passed on the final run: 41 tests in four files; coverage 96.75%
statements, 91.83% branches, 97.43% functions and 97.85% lines; zero duplication.
The fresh build produced CSS 12.08 kB / 3.73 kB gzip and JS 47.47 kB / 16.57 kB
gzip. The existing toolchain emits a Node module.register deprecation warning.

The first coverage attempt failed the pre-existing 50 ms board-validation timing
assertion at 50.001972 ms. That assertion also exists in the committed baseline.
The full coverage retry passed without source, test, threshold or configuration
changes. This remains a risk for that timing assertion under resource pressure,
not evidence of a stable browser performance result. Both attempts are retained
in `../evidence/recheck-coverage.log` and `../evidence/recheck-coverage-retry.log`.
Other gate logs are retained as `../evidence/recheck-<gate>.log`.

## Remaining blockers and next input

- Native focus/visibility loss: earlier in-app tab/view hiding did not emit normal
  page interruption events. EventTarget tests passed, but this is not a passed
  native browser interruption check. A browser-control connection capable of
  switching focus or document visibility is needed.
- Replay delivery: the earlier browser download-event wait timed out. JSON
  serialization and seeded reconstruction passed; an actual delivered file has
  not been verified. A browser with working download observation is needed.
- Physical touch: narrow-screen control clicks passed, but no touch hardware was
  available. Device QA is needed to verify physical touch behavior.
- This continuation exposes no browser/computer-control tools, so it cannot
  independently retry those runtime checks. No software was installed or
  settings changed to work around that limitation.
- The requested `stop_goal` lifecycle tool is also absent from the exposed tool
  catalog. This report records the blocked outcome; it does not claim that the
  host's active Goal was stopped through a tool.

Prior browser evidence, desktop/mobile screenshots and initial build/test
results remain in `../evidence/verification.md`, `desktop.jpg` and
`mobile-paused.jpg`. Reload persistence is intentionally not implemented; runs
are held in memory. Future work should verify the blocked checks before claiming
the entire Goal complete, and should preserve the original unfinished legality
work when integrating this isolated branch.
