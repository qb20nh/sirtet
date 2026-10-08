import { describe, expect, it, vi } from 'vitest';

import { ReverseTetrisEngine } from '../src/game';
import {
  bindSessionInterruptions,
  captureReplayDownload,
  createCommandHandler,
  createKeyDownHandler,
  createReplayLog,
  createSeededRng,
  endStuckSession,
  getReplayTime,
  type KeyboardEventLike,
  type ReplayEventInput,
  type ReplayLog,
  setSessionPaused,
  startAnimationLoop,
} from '../src/session';
import { moveToValidPlacement } from './game-helpers';

describe('session loop', () => {
  it('pauses on window blur or hidden documents and removes interruption listeners', () => {
    const engine = createCarvedEngine();
    const windowTarget = new EventTarget() as unknown as Window;
    const documentTarget = new EventTarget() as unknown as Document;
    const sync = vi.fn();
    let timestamp = 10;
    const pause = vi.fn(() => setSessionPaused(engine, true, sync, () => timestamp));
    const cleanup = bindSessionInterruptions(windowTarget, documentTarget, pause);
    Object.defineProperty(documentTarget, 'hidden', { value: false, configurable: true });
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(pause).not.toHaveBeenCalled();
    windowTarget.dispatchEvent(new Event('blur'));
    expect(engine.snapshot().gameState).toBe('PAUSED');
    timestamp = 60_000;
    Object.defineProperty(documentTarget, 'hidden', { value: true });
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(sync).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledTimes(2);
    cleanup();
    engine.resume(timestamp);
    windowTarget.dispatchEvent(new Event('blur'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(engine.isPlaying()).toBe(true);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it('does no snapshot or render work during 600 idle frames', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start(0);
    const snapshot = vi.spyOn(engine, 'snapshot');
    const publish = vi.fn();
    const recordTick = vi.fn();
    let frame: (timestamp: number) => void = () => {};
    const stop = startAnimationLoop(
      engine,
      publish,
      (callback) => {
        frame = callback;
        return 1;
      },
      vi.fn(),
      recordTick,
    );
    const started = performance.now();
    for (let i = 1; i <= 600; i++) frame((i * 1000) / 60);
    const elapsed = performance.now() - started;
    stop();
    console.info(
      `600 idle frames: snapshots=${snapshot.mock.calls.length}, publishes=${publish.mock.calls.length}, replay ticks=${recordTick.mock.calls.length}, loop=${elapsed.toFixed(2)}ms`,
    );
    expect(snapshot).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(recordTick).not.toHaveBeenCalled();
  });

  it('publishes only animation steps and ignores callbacks after cleanup', () => {
    const engine = createCarvedEngine();
    const delay = firstStepDelay(engine);
    const callbacks: Array<(timestamp: number) => void> = [];
    const publish = vi.fn();
    const recordTick = vi.fn();
    const snapshot = vi.spyOn(engine, 'snapshot');
    const cancel = vi.fn();
    const stop = startAnimationLoop(
      engine,
      publish,
      (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancel,
      recordTick,
    );
    callbacks[0](delay / 2);
    expect(snapshot).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(recordTick).toHaveBeenCalledWith(delay / 2);
    callbacks[1](delay);
    expect(snapshot).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();
    expect(recordTick).toHaveBeenCalledWith(delay);
    stop();
    expect(cancel).toHaveBeenCalledWith(3);
    callbacks[2](1_000_000);
    expect(publish).toHaveBeenCalledOnce();
    expect(engine.isPlaying()).toBe(true);
  });

  it('freezes a partially elapsed escape, rebases resume, and resets on restart', () => {
    const engine = createCarvedEngine();
    const delay = firstStepDelay(engine);
    expect(engine.tick(delay / 2)).toBe(false);
    const beforePause = engine.snapshot();
    expect(engine.pause()).toBe(true);
    expect(engine.pause()).toBe(false);
    expect(engine.handleKey('c')).toBe(false);
    expect(engine.tick(60_000)).toBe(false);
    expect(engine.snapshot()).toEqual({ ...beforePause, gameState: 'PAUSED' });
    expect(engine.resume(60_000)).toBe(true);
    expect(engine.resume(61_000)).toBe(false);
    expect(engine.tick(60_000 + delay / 2 - 1)).toBe(false);
    expect(engine.snapshot().activePiece?.pathIndex).toBe(0);
    expect(engine.tick(60_000 + delay / 2)).toBe(true);
    expect(engine.snapshot().activePiece?.pathIndex).toBe(1);
    engine.pause();
    const restarted = engine.start(100_000, { easyMode: true });
    expect(restarted).toMatchObject({
      gameState: 'PLAYING',
      score: 0,
      piecesCarved: 0,
      activePiece: null,
      queuedPiece: null,
      easyMode: true,
    });
    expect(engine.tick(100_016)).toBe(false);
    const ready = new ReverseTetrisEngine();
    expect(ready.pause()).toBe(false);
    expect(ready.resume(0)).toBe(false);
  });

  it('records one pause for overlapping interruptions and stops the loop', () => {
    const engine = createCarvedEngine();
    const sync = vi.fn();
    const record = vi.fn();
    const callbacks: Array<(timestamp: number) => void> = [];
    startAnimationLoop(
      engine,
      sync,
      (callback) => {
        callbacks.push(callback);
        return 1;
      },
      vi.fn(),
    );
    expect(setSessionPaused(engine, true, sync, () => 20, record)).toBe(true);
    expect(setSessionPaused(engine, true, sync, () => 30, record)).toBe(false);
    callbacks[0](60_000);
    expect(callbacks).toHaveLength(1);
    expect(sync).toHaveBeenCalledOnce();
    expect(record.mock.calls).toEqual([
      [{ type: 'tick' }, 20],
      [{ type: 'pause' }, 20],
    ]);
    expect(setSessionPaused(engine, false, sync, () => 60_000, record)).toBe(true);
    expect(record).toHaveBeenLastCalledWith({ type: 'resume' }, 60_000);
    expect(engine.tick(60_016)).toBe(false);
    const terminal = createCarvedEngine();
    expect(setSessionPaused(terminal, true, sync, () => 1_000_000, record)).toBe(false);
    expect(terminal.snapshot().gameState).toBe('GAMEOVER');
    expect(sync).toHaveBeenCalledTimes(3);
  });

  it('keeps browser and form shortcuts out of gameplay', () => {
    const engine = createCarvedEngine();
    const handleKey = vi.spyOn(engine, 'handleKey');
    const sync = vi.fn();
    const record = vi.fn();
    const handler = createKeyDownHandler(engine, sync, record);
    const ignored: Partial<KeyboardEventLike>[] = [
      { defaultPrevented: true },
      { isComposing: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
      { target: { closest: () => ({}) } as unknown as EventTarget },
    ];
    for (const extra of ignored) {
      const preventDefault = vi.fn();
      handler({ key: 'Enter', code: 'Enter', preventDefault, ...extra });
      expect(preventDefault).not.toHaveBeenCalled();
    }
    expect(handleKey).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    handler({ key: 'q', code: 'KeyQ', preventDefault: vi.fn() });
    for (const key of ['z', 'x', 'r', 'c', 'Shift', ' ', 'Enter']) {
      handler({ key, code: key, repeat: true, preventDefault: vi.fn() });
    }
    expect(handleKey).not.toHaveBeenCalled();
    const preventDefault = vi.fn();
    handler({ key: 'W', code: 'KeyW', repeat: true, preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(handleKey).toHaveBeenCalledWith('W', 'KeyW');
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[0]).toEqual([{ type: 'tick' }, engine.getTickTimestamp()]);
    engine.pause();
    const pausedDefault = vi.fn();
    handler({ key: 'ArrowUp', code: 'ArrowUp', preventDefault: pausedDefault });
    expect(pausedDefault).not.toHaveBeenCalled();
  });

  it('allows a single pause shortcut in a run and passes it through on the start screen', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const toggle = vi.fn(() => setSessionPaused(engine, engine.isPlaying(), vi.fn(), () => 100));
    const preventDefault = vi.fn();
    const handler = createKeyDownHandler(engine, vi.fn(), undefined, toggle);
    handler({ key: 'p', code: 'KeyP', preventDefault });
    expect(toggle).not.toHaveBeenCalled();
    engine.start(0);
    handler({ key: 'Escape', code: 'Escape', preventDefault });
    expect(engine.isPlaying()).toBe(false);
    handler({ key: 'p', code: 'KeyP', repeat: true, preventDefault });
    expect(toggle).toHaveBeenCalledOnce();
    handler({ key: 'p', code: 'KeyP', preventDefault });
    expect(engine.isPlaying()).toBe(true);
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it('reconstructs the same run from replay events across a long pause', () => {
    const seed = 123;
    const engine = new ReverseTetrisEngine(createSeededRng(seed));
    engine.start(1000);
    const replay = createReplayLog(seed, {}, undefined, 1000);
    let timestamp = 1000;
    const record = (event: ReplayEventInput, time = timestamp) => {
      replay.events.push({ ...event, t: getReplayTime(time, 1000), clock: time });
    };
    const command = createCommandHandler(engine, vi.fn(), record);
    moveToValidPlacement(engine, command);
    expect(command('Enter')).toBe(true);
    timestamp = 1111;
    setSessionPaused(engine, true, vi.fn(), () => timestamp, record);
    timestamp = 61_111;
    setSessionPaused(engine, false, vi.fn(), () => timestamp, record);
    timestamp = 61_400;
    engine.tick(timestamp);
    record({ type: 'tick' });

    expect(reconstructReplay(replay).snapshot()).toEqual(engine.snapshot());
    expect(getReplayTime(999, 1000)).toBe(0);
    expect(getReplayTime(1001.7, 1000)).toBe(1001.7 - 1000);
  });

  it('reconstructs a delayed first carve after idle animation frames', () => {
    const seed = 123;
    const engine = new ReverseTetrisEngine(createSeededRng(seed));
    engine.start(0);
    const replay = createReplayLog(seed);
    let timestamp = 0;
    const record = (event: ReplayEventInput, time = timestamp) => {
      replay.events.push({ ...event, t: getReplayTime(time, 0), clock: time });
    };
    const command = createCommandHandler(engine, vi.fn(), record);
    let frame: (timestamp: number) => void = () => {};
    startAnimationLoop(
      engine,
      vi.fn(),
      (callback) => {
        frame = callback;
        return 1;
      },
      vi.fn(),
      (time) => record({ type: 'tick' }, time),
    );
    for (timestamp = 16; timestamp <= 10_000; timestamp += 16) frame(timestamp);
    timestamp = 10_000;
    moveToValidPlacement(engine, command);
    expect(command('Enter')).toBe(true);
    frame(10_400);

    expect(reconstructReplay(replay).snapshot()).toEqual(engine.snapshot());
  });

  it('preserves each fractional frame at an escape-step boundary', () => {
    const startedAt = 1000.1;
    const seed = 1;
    const engine = new ReverseTetrisEngine(createSeededRng(seed));
    engine.start(startedAt, { easyMode: true });
    const replay = createReplayLog(seed, { easyMode: true }, undefined, startedAt);
    let timestamp = startedAt;
    const record = (event: ReplayEventInput, time = timestamp) => {
      replay.events.push({ ...event, t: getReplayTime(time, startedAt), clock: time });
    };
    const command = createCommandHandler(engine, vi.fn(), record);
    let frame: (timestamp: number) => void = () => {};
    startAnimationLoop(
      engine,
      vi.fn(),
      (callback) => {
        frame = callback;
        return 1;
      },
      vi.fn(),
      (time) => record({ type: 'tick' }, time),
    );
    moveToValidPlacement(engine, command);
    expect(command('Enter')).toBe(true);
    for (let index = 1; index <= 96; index++) {
      timestamp = startedAt + (index * 1000) / 60;
      frame(timestamp);
    }
    const exported = JSON.parse(captureReplayDownload(engine, replay, record));
    expect(engine.snapshot().activePiece?.pathIndex).toBe(4);
    expect(reconstructReplay(exported).snapshot()).toEqual(engine.snapshot());
    command('ArrowRight');
    expect(reconstructReplay(replay).snapshot()).toEqual(engine.snapshot());
    timestamp = startedAt + (97 * 1000) / 60;
    frame(timestamp);
    expect(engine.snapshot().activePiece?.pathIndex).toBe(5);
    expect(reconstructReplay(replay).snapshot()).toEqual(engine.snapshot());
  });

  it('exports the exact partial step across fractional clocks, rapid commands and a long pause', () => {
    const startedAt = 1000.137;
    const seed = 123;
    const engine = new ReverseTetrisEngine(createSeededRng(seed));
    engine.start(startedAt, { easyMode: true });
    const replay = createReplayLog(seed, { easyMode: true }, undefined, startedAt);
    let timestamp = startedAt;
    const record = (event: ReplayEventInput, time = timestamp) => {
      replay.events.push({ ...event, t: getReplayTime(time, startedAt), clock: time });
    };
    const command = createCommandHandler(engine, vi.fn(), record);
    for (let carve = 0; carve < 3; carve++) {
      timestamp += 60.371;
      engine.tick(timestamp);
      moveToValidPlacement(engine, command);
      expect(command('Enter')).toBe(true);
      const immediateExport = JSON.parse(captureReplayDownload(engine, replay, record));
      expect(reconstructReplay(immediateExport).snapshot()).toEqual(engine.snapshot());
    }
    timestamp += 37.627;
    expect(setSessionPaused(engine, true, vi.fn(), () => timestamp, record)).toBe(true);
    timestamp += 60_000.251;
    expect(setSessionPaused(engine, false, vi.fn(), () => timestamp, record)).toBe(true);
    timestamp += 15.873;
    expect(engine.tick(timestamp)).toBe(false);
    const beforeExport = engine.snapshot();
    const exported = JSON.parse(captureReplayDownload(engine, replay, record));
    expect(engine.snapshot()).toEqual(beforeExport);
    expect(exported.snapshot).toEqual(beforeExport);
    expect(reconstructReplay(exported).snapshot()).toEqual(beforeExport);
    expect(exported.events.at(-1)).toEqual({
      type: 'tick',
      t: timestamp - startedAt,
      clock: timestamp,
    });

    const ready = new ReverseTetrisEngine();
    const emptyReplay = createReplayLog();
    const recordReady = vi.fn();
    const emptyExport = JSON.parse(captureReplayDownload(ready, emptyReplay, recordReady));
    expect(recordReady).not.toHaveBeenCalled();
    expect(emptyExport.events).toEqual([]);
  });

  it('records an explicit end for a naturally stuck easy run', () => {
    const seed = 1;
    const engine = new ReverseTetrisEngine(createSeededRng(seed));
    engine.start(0, { easyMode: true });
    const replay = createReplayLog(seed, { easyMode: true });
    let timestamp = 0;
    const record = (event: ReplayEventInput, time = timestamp) => {
      replay.events.push({ ...event, t: time, clock: time });
    };
    const command = createCommandHandler(engine, vi.fn(), record);
    const sync = vi.fn();
    expect(endStuckSession(engine, sync, record)).toBe(false);
    expect(replay.events).toHaveLength(1);
    for (let carve = 0; carve < 10 && !engine.snapshot().noLegalCarveAfterHoldSwap; carve++) {
      timestamp += 100.5;
      engine.tick(timestamp);
      if (!engine.snapshot().currentShapeHasLegalCarve) command('c');
      moveToValidPlacement(engine, command);
      expect(command('Enter')).toBe(true);
    }
    expect(engine.snapshot().noLegalCarveAfterHoldSwap).toBe(true);
    expect(endStuckSession(engine, sync, record)).toBe(true);
    expect(sync).toHaveBeenCalledOnce();
    expect(replay.events.at(-1)?.type).toBe('end-stuck');
    expect(reconstructReplay(replay).snapshot()).toEqual(engine.snapshot());
    expect(endStuckSession(engine, sync, record)).toBe(false);
    const unrecorded = reconstructReplay({ ...replay, events: replay.events.slice(0, -1) });
    expect(endStuckSession(unrecorded, sync)).toBe(true);
  });
});

function reconstructReplay(replay: ReplayLog) {
  const engine = new ReverseTetrisEngine(createSeededRng(replay.seed ?? 0));
  for (const event of replay.events) {
    if (event.type === 'start') engine.start(event.clock, event.options);
    if (event.type === 'key') expect(engine.handleKey(event.key, event.code)).toBe(event.accepted);
    if (event.type === 'tick') engine.tick(event.clock);
    if (event.type === 'pause') engine.pause();
    if (event.type === 'resume') engine.resume(event.clock);
    if (event.type === 'end-stuck') engine.endStuckEasyModeGame();
  }
  return engine;
}

function createCarvedEngine() {
  const engine = new ReverseTetrisEngine(() => 0.5);
  engine.start(0);
  moveToValidPlacement(engine);
  expect(engine.handleKey('Enter')).toBe(true);
  return engine;
}

function firstStepDelay(engine: ReverseTetrisEngine) {
  const state = engine.snapshot();
  const times = state.activePiece?.pathTimes;
  return Math.max(1, ((times?.[1] ?? 1) - (times?.[0] ?? 0)) * state.escapeStepDelay);
}
