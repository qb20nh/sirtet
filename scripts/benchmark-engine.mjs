import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';

// Usage: node scripts/benchmark-engine.mjs [baseline-ref] [candidate-ref | WORKTREE]
// Uses native Node modules, fixed seeded input traces, and untimed equivalence assertions.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(os.tmpdir(), 'sirtet-engine-benchmark-'));
const execute = promisify(execFile);
const git = async (...args) =>
  (await execute('git', args, { cwd: root, encoding: 'utf8' })).stdout.trimEnd();
const baseline = process.argv[2] ?? '3d2d54184333bd75c91e1a6dc1fbcf7b73197574';
const candidate = process.argv[3] ?? 'WORKTREE';
const traces = JSON.parse(readFileSync(join(root, 'scripts/fixtures/engine-traces.json'), 'utf8'));
const warmupRounds = 5;
const rounds = 9;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

async function loadEngine(ref, index) {
  const revision = ref === 'WORKTREE' ? ref : await git('rev-parse', '--verify', `${ref}^{commit}`);
  const source =
    ref === 'WORKTREE'
      ? readFileSync(join(root, 'src/game.ts'), 'utf8')
      : await git('show', `${revision}:src/game.ts`);
  const filename = join(scratch, `engine-${index}.cjs`);
  writeFileSync(
    filename,
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
    }).outputText,
  );
  return {
    metadata: { ref, revision, sourceSha256: createHash('sha256').update(source).digest('hex') },
    api: require(filename),
  };
}

function runSession(api, trace, inspect = () => {}) {
  const engine = new api.ReverseTetrisEngine(seededRandom(trace.seed));
  engine.start(0, { easyMode: trace.easyMode });
  inspect(engine);
  let timestamp = 0;
  for (const action of trace.actions) {
    if (typeof action === 'string') {
      engine.handleKey(action);
      inspect(engine);
    } else {
      for (let frame = 0; frame < action; frame++) {
        timestamp += 1000 / 60;
        engine.tick(timestamp);
        inspect(engine);
      }
    }
  }
  return engine;
}

function verifyEquivalence(apis) {
  let snapshots = 0;
  const boards = [apis[0].createInitialBoard()];
  for (const trace of traces) {
    const expected = [];
    runSession(apis[0], trace, (engine) => {
      const state = engine.snapshot();
      expected.push(state);
      if (expected.length === 1 || state.piecesCarved !== expected.at(-2).piecesCarved) {
        boards.push(state.board);
      }
    });
    let index = 0;
    runSession(apis[1], trace, (engine) => {
      assert.deepEqual(engine.snapshot(), expected[index++], `seed ${trace.seed}, action ${index}`);
      snapshots++;
    });
    assert.equal(index, expected.length);
  }

  let paths = 0;
  for (const board of boards) {
    for (const shape of Object.keys(apis[0].SHAPES)) {
      for (let rotation = 0; rotation < 4; rotation++) {
        for (const [x, y] of [
          [-1, 5],
          [0, 18],
          [4, 18],
          [9, 18],
          [4, -3],
          [4, 26],
        ]) {
          assert.deepEqual(
            apis[1].findEscapePath(board, shape, x, y, rotation),
            apis[0].findEscapePath(board, shape, x, y, rotation),
            `board ${boards.indexOf(board)}, shape ${shape}, (${x}, ${y}, ${rotation})`,
          );
          paths++;
        }
      }
    }
  }
  return { snapshots, paths, boards: boards.length };
}

function workloads(api) {
  return {
    sixStarts: () => () => {
      for (let seed = 1; seed <= 6; seed++) {
        new api.ReverseTetrisEngine(seededRandom(seed)).start(0, { easyMode: seed % 2 === 0 });
      }
    },
    movementAndRotation: () => {
      const engine = new api.ReverseTetrisEngine(seededRandom(1));
      engine.start();
      return () => {
        for (let iteration = 0; iteration < 60; iteration++) {
          for (const key of ['ArrowLeft', 'ArrowUp', 'x', 'ArrowRight', 'ArrowDown', 'z']) {
            engine.handleKey(key);
          }
        }
      };
    },
    seededSessions: () => () => {
      for (const trace of traces) runSession(api, trace);
    },
  };
}

function measure(prepare) {
  const run = prepare();
  const start = performance.now();
  run();
  return performance.now() - start;
}

try {
  const revisions = await Promise.all([baseline, candidate].map(loadEngine));
  const apis = revisions.map(({ api }) => api);
  const equivalence = verifyEquivalence(apis);
  const suites = apis.map(workloads);
  const results = {};
  for (const name of Object.keys(suites[0])) {
    for (let round = 0; round < warmupRounds; round++) {
      for (const suite of suites) measure(suite[name]);
    }
    const samples = [[], []];
    for (let round = 0; round < rounds; round++) {
      for (const index of round % 2 ? [1, 0] : [0, 1]) {
        samples[index].push(measure(suites[index][name]));
      }
    }
    const medians = samples.map(
      (values) => [...values].sort((a, b) => a - b)[Math.floor(rounds / 2)],
    );
    results[name] = {
      baselineSamplesMs: samples[0],
      candidateSamplesMs: samples[1],
      baselineMedianMs: medians[0],
      candidateMedianMs: medians[1],
      speedup: medians[0] / medians[1],
    };
  }
  console.log(
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        environment: {
          node: process.version,
          typescript: ts.version,
          cpu: os.cpus()[0]?.model,
          logicalCpus: os.cpus().length,
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
        },
        checkout: { head: await git('rev-parse', 'HEAD'), status: await git('status', '--short') },
        revisions: revisions.map(({ metadata }) => metadata),
        workload: { warmupRounds, rounds, hz: 60, traces, movementAndRotationInputs: 360 },
        equivalence,
        results,
        interpretation:
          'Engine elapsed time in native Node modules; no browser rendering or input latency. ' +
          'Module compilation, trace validation, and movement setup are untimed; startup and session workloads include engine construction. ' +
          'Both revisions run alternating rounds in the same process. Fixed traces cover normal/easy mode and 20 successful carves.',
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
