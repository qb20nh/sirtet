import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Usage: node scripts/benchmark-idle.mjs [baseline-ref] [candidate-ref | WORKTREE]
// Redirect stdout to retain the complete JSON result. Setup and assertions are untimed.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineRef = process.argv[2] ?? '3d2d54184333bd75c91e1a6dc1fbcf7b73197574';
const candidateRef = process.argv[3] ?? 'WORKTREE';
const frames = 600;
const warmups = 5;
const rounds = 9;
const batchesPerRound = 20;
const execute = promisify(execFile);

async function git(...args) {
  return (await execute('git', args, { cwd: root, encoding: 'utf8' })).stdout;
}

async function loadRevision(ref) {
  const revision =
    ref === 'WORKTREE' ? ref : (await git('rev-parse', '--verify', `${ref}^{commit}`)).trim();
  const files =
    revision === 'WORKTREE'
      ? ['src/session.ts', 'src/App.tsx'].filter((file) => existsSync(resolve(root, file)))
      : (await git('ls-tree', '-r', '--name-only', revision)).split('\n');
  const loopFile = files.includes('src/session.ts') ? 'src/session.ts' : 'src/App.tsx';
  const readSource = (file) =>
    revision === 'WORKTREE'
      ? readFileSync(resolve(root, file), 'utf8')
      : git('show', `${revision}:${file}`);
  const engineSource = await readSource('src/game.ts');
  const loopSource = await readSource(loopFile);
  const parsed = ts.createSourceFile(loopFile, loopSource, ts.ScriptTarget.Latest, true);
  // The original loop used two local replay helpers. Keep their actual declarations,
  // while excluding unrelated Preact/DOM code from this Node callback-work diagnostic.
  const names = new Set(['startAnimationLoop', 'hasReplayStateChanged', 'getReplayStateKey']);
  const declarations = parsed.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text),
  );
  assert.ok(declarations.some((node) => node.name.text === 'startAnimationLoop'));
  const loop = declarations.map((node) => node.getText(parsed)).join('\n');
  return {
    metadata: {
      ref,
      revision,
      sourceSha256: Object.fromEntries(
        [
          ['src/game.ts', engineSource],
          [loopFile, loopSource],
        ].map(([file, source]) => [file, createHash('sha256').update(source).digest('hex')]),
      ),
      loopFunctions: declarations.map((node) => node.name.text),
    },
    Engine: compile(engineSource, 'src/game.ts').ReverseTetrisEngine,
    startLoop: compile(loop, loopFile).startAnimationLoop,
  };
}

function compile(source, fileName) {
  const { outputText } = ts.transpileModule(source, {
    fileName,
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  runInNewContext(outputText, { exports }, { filename: fileName });
  return exports;
}

function createMeasurement({ Engine, startLoop }) {
  const engine = new Engine(() => 0.5);
  const before = engine.start(0);
  assert.equal(before.gameState, 'PLAYING');
  assert.equal(before.activePiece, null);
  const snapshot = engine.snapshot.bind(engine);
  return () => {
    // No active piece exists; rebasing this private clock leaves the snapshot unchanged.
    engine.tick(0);
    const counts = {
      snapshots: 0,
      publications: 0,
      replayTicks: 0,
      frameRequests: 0,
      frameCallbacks: 0,
    };
    engine.snapshot = () => {
      counts.snapshots++;
      return snapshot();
    };
    let callback;
    const stop = startLoop(
      engine,
      () => counts.publications++,
      (next) => {
        callback = next;
        return ++counts.frameRequests;
      },
      () => {},
      () => counts.replayTicks++,
    );
    const started = performance.now();
    // Each opportunity invokes only a pending callback. A sleeping loop must not
    // be charged for synthetic callbacks the browser would never deliver.
    for (let frame = 1; frame <= frames; frame++) {
      const pending = callback;
      callback = undefined;
      if (pending) {
        counts.frameCallbacks++;
        pending((frame * 1000) / 60);
      }
    }
    const elapsedMs = performance.now() - started;
    stop();
    assert.deepEqual(snapshot(), before, 'Idle callbacks must preserve the full snapshot');
    assert.equal(counts.frameRequests, counts.frameCallbacks + Number(Boolean(callback)));
    assert.ok(counts.frameCallbacks <= frames);
    assert.equal(counts.replayTicks, 0);
    return { elapsedMs, counts };
  };
}

function measureRound(measure) {
  const samples = Array.from({ length: batchesPerRound }, measure);
  for (const sample of samples) assert.deepEqual(sample.counts, samples[0].counts);
  return {
    meanMsPer600FrameOpportunities:
      samples.reduce((total, sample) => total + sample.elapsedMs, 0) / batchesPerRound,
    samples,
  };
}

const revisions = await Promise.all([loadRevision(baselineRef), loadRevision(candidateRef)]);
const measurements = revisions.map(createMeasurement);
for (let i = 0; i < warmups; i++) for (const measure of measurements) measure();
const results = revisions.map((revision) => ({ ...revision.metadata, rounds: [] }));
// Alternate order to reduce systematic first/second-run effects on the same process.
for (let round = 0; round < rounds; round++) {
  for (const index of round % 2 === 0 ? [0, 1] : [1, 0]) {
    results[index].rounds.push(measureRound(measurements[index]));
  }
}
for (const result of results) {
  const sorted = result.rounds
    .map((round) => round.meanMsPer600FrameOpportunities)
    .sort((a, b) => a - b);
  result.medianMsPer600FrameOpportunities = sorted[Math.floor(sorted.length / 2)];
  result.countsPer600FrameOpportunities = result.rounds[0].samples[0].counts;
}
console.log(
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        typescript: ts.version,
        platform: platform(),
        release: release(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
      },
      checkout: {
        head: (await git('rev-parse', 'HEAD')).trim(),
        status: (await git('status', '--short')).trimEnd(),
      },
      workload: { frameOpportunities: frames, hz: 60, rng: 0.5, warmups, rounds, batchesPerRound },
      interpretation:
        'Actual engine and loop callback work with counted snapshots/publications; no browser rendering. ' +
        'Only requested callbacks run across 600 simulated frame opportunities (10 seconds at 60 Hz). ' +
        'Elapsed milliseconds include counter instrumentation and the simulated scheduler, not startup. ' +
        'A result with zero callbacks measures harness overhead, not game callback latency. ' +
        'This does not measure input latency, browser FPS, CPU utilization or battery use.',
      results,
    },
    null,
    2,
  ),
);
