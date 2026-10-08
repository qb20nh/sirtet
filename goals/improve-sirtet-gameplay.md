# Goal: Improve Sirtet gameplay and development experience

Slug: `improve-sirtet-gameplay`
Status: Confirmed and approved; ready for activation
Activation: `/goal @goals/improve-sirtet-gameplay.md`

This file is a reviewable Goal specification, not an active Goal. It becomes
active in the current thread only after the user runs the activation command
from the Sirtet project context.

## Goal Text

Improve qb20nh/sirtet through one coherent, evidence-backed set of changes covering gameplay responsiveness, continued playability, player experience, maintainable architecture, and developer workflow. Preserve the game's core mechanics and identity.

Establish the baseline first:

- Locate and verify the repository, checkout, existing branches, and unfinished work. Inspect applicable AGENTS.md and relevant skills.
- Preserve all user changes and unrelated work, especially CBBG. Use an isolated branch/worktree when necessary. Identify completed improvements and build on them.
- Establish the mechanics, supported modes and inputs, build/test commands, reproducible bugs, player friction, and measured performance bottlenecks.
- Report baseline findings and a short prioritized implementation plan promptly. Choose concrete acceptance criteria before changing code.

Implement the highest-impact justified changes:

- Improve a measured responsiveness bottleneck and a reproducible playability or player-flow problem.
- Cover repeated play, restart, and session/input interruptions as appropriate to the game. Choose replay or continuity changes from observed needs.
- Make architecture and developer-workflow changes that support these improvements and their verification.
- Prefer focused fixes. Avoid speculative rewrites, unnecessary dependencies, cosmetic refactors, and features introduced solely to satisfy a category.
- Ask only for material decisions that cannot be inferred. Continue independent authorized work while awaiting answers.

Verify the result:

- Run the repository's applicable lint, type, test, coverage, and production-build gates without weakening them.
- Add meaningful behavior regressions for changed mechanics and lifecycle behavior.
- Exercise actual gameplay using supported browser/app tools: repeated play, restart, pause/resume where supported, focus loss, interrupted or repeated input, and relevant screen/input modes.
- Compare performance before and after using the same reproducible workload and comparable conditions. Record commands, environment, metrics, and tradeoffs. Distinguish operation-count improvements from measured latency or frame-rate improvements.
- Label every acceptance check passed, failed, or blocked. Automated substitutes do not establish that an unavailable browser or physical-device check passed.

Iterate toward the accepted criteria:

Choose the next smallest defensible change from the latest evidence, verify it, and reassess. Fix regressions before adding scope. Stop expanding the change set once the agreed improvements and required checks are verified.

Use supported filesystem, Git, and application access. Read relevant local memory and targeted history only as background; do not update memories. Do not modify machine security/settings or install unapproved system software.

Create coherent semantic local commits by purpose, following existing signing conventions. Do not push, merge, deploy, or publicly release without further authorization.

If a required capability, decision, measurement, or check remains unavailable, try supported alternatives within scope, complete unaffected work, and report the attempted paths, exact blocker, evidence, affected acceptance criteria, and input needed. Report partial or blocked status rather than claiming completion.

Finish with concrete changes, exact commit hashes, a reviewable diff, reproducible verification and performance evidence, remaining risks, and the status of every acceptance criterion. Keep progress updates focused on findings, decisions, and results.

## Interview Summary

- Desired outcome: A coherent, implemented and verified improvement set spanning the five requested areas, with gameplay needs driving supporting architecture and workflow changes.
- Evidence: Reproducible baseline and final measurements, meaningful behavior regressions, repository quality/build gates, and actual gameplay QA.
- Constraints: Preserve core mechanics, user changes, unrelated active work and existing quality gates. Honor signing conventions and explicit release boundaries.
- Scope: The verified qb20nh/sirtet repository and relevant local instructions, supported tools and read-only background history. Use isolated work when active checkout changes require it.
- Autonomy: Own implementation and verification end to end. Ask only for material unresolved decisions; continue unaffected work independently.
- Budget: No fixed numeric time, token, iteration or cost limit was specified. Work is bounded by one coherent improvement set and its accepted criteria.
- Blocked condition: Required evidence, access, capabilities or decisions remain unavailable after supported alternatives have been tried. Partial progress is not completion.
- Reporting: Concise progress findings and a final evidence report with exact commits, reviewable diff, check statuses and remaining risks.
- Confirmation: The user confirmed and approved the proposed contract on 2026-10-08.

## Assumptions

- This is a reusable Goal specification. Saving it does not restart implementation or activate a Goal.
- The requested repository spelling `sertet` refers to the verified repository `qb20nh/sirtet`.
- Performance targets will be chosen from a reproducible baseline before implementation; no unsupported numerical speedup or frame-rate target is assumed.
- Existing completed changes and their evidence should be inspected and reused where applicable. Do not redo completed work merely to produce a new diff.
- No fixed numeric budget is imposed. Stop adding scope once the accepted improvement set is verified; report an honest blocker if a required criterion cannot be verified.

## Non-goals and Boundaries

- Do not change the game's identity or pursue a broad speculative rewrite.
- Do not add dependencies, cosmetic refactors or features without a demonstrated need tied to the accepted criteria.
- Do not alter unrelated repositories or active work, especially CBBG.
- Do not update local memories, change machine security/settings, install unapproved system software, or weaken verification gates.
- Do not push, merge, deploy or publicly release without further authorization.
- Do not treat recommendations, budget exhaustion, unavailable evidence or proxy tests as verified completion.

## Verification Checklist

The executor must turn baseline findings into concrete acceptance criteria before
editing code and report each criterion as passed, failed or blocked.

- [ ] Repository identity, starting revision, active user changes and isolation strategy are recorded.
- [ ] Mechanics, relevant modes/inputs, baseline checks, reproducible friction and measured bottlenecks are established.
- [ ] Prioritized changes and concrete acceptance criteria are recorded before implementation.
- [ ] A measured responsiveness improvement is demonstrated using comparable, reproducible before/after evidence.
- [ ] A reproducible playability or player-flow problem is improved and covered by meaningful behavior evidence.
- [ ] Supporting architecture and developer-workflow changes have a clear purpose and verified benefit.
- [ ] Applicable lint, type, test, coverage and production-build gates pass without being weakened.
- [ ] Actual gameplay QA covers repeated play, restart, supported pause/resume and interruptions, and relevant screen/input modes; unavailable checks are explicitly marked blocked.
- [ ] Existing user changes, unrelated work, core mechanics and release boundaries remain preserved.
- [ ] Coherent local commits follow existing signing conventions, and the final diff is reviewable.
- [ ] Final reporting includes exact commits, commands, environment, measurements, tradeoffs, check statuses, remaining risks and any blockers.

## Iteration Policy

After each meaningful attempt, record the finding or hypothesis, the focused
change, the verification result, and the next smallest defensible action. Choose
the next action from evidence. Resolve regressions before expanding scope and
stop adding changes once the accepted criteria are verified.

## Blocked Stop Condition

Try supported alternatives within the authorized scope and finish unaffected
work. If a required criterion remains blocked, stop dependent work and report
the exact failure or missing capability, attempted paths, evidence, affected
criteria and input needed to continue. Mark the outcome partial or blocked.

## Expected Final Report

Report the implemented changes and their purpose; exact commit hashes and a
reviewable diff; verification commands and results; reproducible before/after
performance evidence with environment and limits; acceptance statuses; and
remaining risks or blockers. Claim completion only when the accepted criteria
are verified.
