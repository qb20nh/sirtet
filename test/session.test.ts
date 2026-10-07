import { describe, expect, it, vi } from 'vitest';

import { ReverseTetrisEngine } from '../src/game';
import {
  bindSessionInterruptions,
  createCommandHandler,
  createKeyDownHandler,
  createReplayLog,
  createSeededRng,
  getReplayTime,
  type KeyboardEventLike,
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
    expect(record).toHaveBeenCalledOnce();
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

  it('reconstructs the same run from v2 replay events across a long pause', () => {
    const seed = 123;
    const probe = new ReverseTetrisEngine(createSeededRng(seed));
    probe.start();
    const placement = moveToValidPlacement(probe);
    const engine = new ReverseTetrisEngine(createSeededRng(seed));
    engine.start(1000);
    const replay = createReplayLog(seed);
    let timestamp = 1000;
    const record = (
      event: Parameters<NonNullable<Parameters<typeof setSessionPaused>[4]>>[0],
      time = timestamp,
    ) => {
      replay.events.push({ ...event, t: getReplayTime(time, 1000) });
    };
    const command = createCommandHandler(engine, vi.fn(), record);
    while (engine.snapshot().currentRotation !== placement.r) command('x');
    while (engine.snapshot().mouseX > placement.x) command('ArrowLeft');
    while (engine.snapshot().mouseX < placement.x) command('ArrowRight');
    while (engine.snapshot().mouseY > placement.y) command('ArrowUp');
    while (engine.snapshot().mouseY < placement.y) command('ArrowDown');
    expect(command('Enter')).toBe(true);
    timestamp = 1111;
    setSessionPaused(engine, true, vi.fn(), () => timestamp, record);
    timestamp = 61_111;
    setSessionPaused(engine, false, vi.fn(), () => timestamp, record);
    timestamp = 61_400;
    engine.tick(timestamp);
    record({ type: 'tick' });

    const reconstructed = new ReverseTetrisEngine(createSeededRng(seed));
    for (const event of replay.events) {
      if (event.type === 'start') reconstructed.start(event.t, event.options);
      if (event.type === 'key') reconstructed.handleKey(event.key, event.code);
      if (event.type === 'tick') reconstructed.tick(event.t);
      if (event.type === 'pause') reconstructed.pause();
      if (event.type === 'resume') reconstructed.resume(event.t);
    }
    expect(reconstructed.snapshot()).toEqual(engine.snapshot());
    expect(getReplayTime(999, 1000)).toBe(0);
    expect(getReplayTime(1001.7, 1000)).toBe(2);
  });
});

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
