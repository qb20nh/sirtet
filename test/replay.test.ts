import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReverseTetrisEngine } from '../src/game';
import {
  captureRecordedReplayDownload,
  prepareRecordedReplayDownload,
  ReplayDownloadController,
  ReplayRecording,
} from '../src/replay';
import {
  buildReplayDownload,
  createCommandHandler,
  createReplayLog,
  createSeededRng,
  getReplayTime,
  type ReplayEventInput,
  setSessionPaused,
} from '../src/session';
import { moveToValidPlacement } from './game-helpers';

describe('compact replay recording', () => {
  it.each([
    0, 1022, 1023, 1024, 3072,
  ])('preserves the v3 JSON stream with %i mixed events across chunk boundaries', async (count) => {
    const { recording, replay, record, startedAt } = createRecordings();
    const clocks = [startedAt - 1.25, startedAt, startedAt + 1 / 3, startedAt + 10.1];
    const controls: ReplayEventInput[] = [
      { type: 'key', key: '"\\\n', code: 'KeyX', accepted: false },
      { type: 'pause' },
      { type: 'resume' },
      { type: 'end-stuck' },
    ];
    for (let index = 0; index < count; index++) {
      record(
        index % 17 === 0 ? controls[index % controls.length] : { type: 'tick' },
        clocks[index % clocks.length],
      );
    }
    const snapshot = new ReverseTetrisEngine().snapshot();
    const parts = recording.buildParts(snapshot);
    expect(await new Blob(parts).text()).toBe(buildReplayDownload(replay, snapshot));
    expect(JSON.parse(parts.join('')).events).toEqual(replay.events);
  });

  it('uses normal JSON serialization for repeated, decreasing and nonfinite clocks', () => {
    const { recording, replay, record } = createRecordings();
    for (const clock of [1000.1, 1000.1, 999.7, 0, -0, Number.NaN, Infinity, -Infinity]) {
      record({ type: 'tick' }, clock);
    }
    const snapshot = new ReverseTetrisEngine().snapshot();
    expect(recording.buildParts(snapshot).join('')).toBe(buildReplayDownload(replay, snapshot));
  });

  it('captures repeated active and paused downloads without advancing the game', () => {
    const { recording, replay, record, startedAt } = createRecordings();
    const engine = new ReverseTetrisEngine(createSeededRng(1));
    engine.start(startedAt, { easyMode: true });
    let now = startedAt;
    const recorder = (event: ReplayEventInput, timestamp = now) => record(event, timestamp);
    const command = createCommandHandler(engine, vi.fn(), recorder, () => now);
    moveToValidPlacement(engine, command);
    expect(command('Enter')).toBe(true);
    for (let frame = 1; frame <= 96; frame++) {
      now = startedAt + (frame * 1000) / 60;
      engine.tick(now);
      recorder({ type: 'tick' });
    }
    const tick = vi.spyOn(engine, 'tick');
    const before = engine.snapshot();
    const first = captureRecordedReplayDownload(engine, recording, recorder);
    const firstText = first.join('');
    expect(firstText).toBe(buildReplayDownload(replay, before));
    const second = captureRecordedReplayDownload(engine, recording, recorder);
    expect(second.join('')).toBe(buildReplayDownload(replay, before));
    expect(JSON.parse(second.join('')).events.length).toBe(JSON.parse(firstText).events.length + 1);
    expect(first.join('')).toBe(firstText);
    expect(tick).not.toHaveBeenCalled();
    expect(engine.snapshot()).toEqual(before);

    setSessionPaused(engine, true, vi.fn(), () => now + 0.25, recorder);
    tick.mockClear();
    const paused = engine.snapshot();
    expect(captureRecordedReplayDownload(engine, recording, recorder).join('')).toBe(
      buildReplayDownload(replay, paused),
    );
    expect(tick).not.toHaveBeenCalled();
    expect(engine.snapshot()).toEqual(paused);
    now += 60_000;
    setSessionPaused(engine, false, vi.fn(), () => now, recorder);
    command('ArrowRight');
    expect(recording.buildParts(engine.snapshot()).join('')).toBe(
      buildReplayDownload(replay, engine.snapshot()),
    );
  });

  it('exports a ready run without adding a clock boundary and starts a fresh recording', () => {
    const engine = new ReverseTetrisEngine();
    let recording = new ReplayRecording();
    const record = vi.fn();
    const ready = captureRecordedReplayDownload(engine, recording, record);
    expect(record).not.toHaveBeenCalled();
    expect(JSON.parse(ready.join(''))).toMatchObject({ seed: null, events: [] });
    recording = new ReplayRecording(42, { easyMode: true }, 'restart', 50_000.5);
    const restarted = JSON.parse(recording.buildParts(engine.snapshot()).join(''));
    expect(restarted).toMatchObject({
      seed: 42,
      options: { easyMode: true },
      createdAt: 'restart',
    });
    expect(restarted.events).toEqual([
      { type: 'start', seed: 42, options: { easyMode: true }, clock: 50_000.5, t: 0 },
    ]);
    expect(JSON.parse(ready.join('')).events).toEqual([]);
  });
});

describe('cooperative replay exports', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 7));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    4094, 4095, 4096, 7679, 8191, 8192,
  ])('preserves exact JSON for %i appended events across task, storage and Blob boundaries', async (count) => {
    const { recording, replay, record, startedAt } = createRecordings();
    const clocks = [startedAt - 1.25, startedAt, startedAt + 1 / 3, NaN, Infinity, -Infinity];
    const events: ReplayEventInput[] = [
      { type: 'tick' },
      { type: 'key', key: '"\\\n', code: 'KeyX', accepted: false },
      { type: 'pause' },
      { type: 'resume' },
      { type: 'end-stuck' },
      { type: 'start', seed: 9, options: { easyMode: false } },
    ];
    for (let index = 0; index < count; index++) {
      record(events[index % events.length], clocks[index % clocks.length]);
    }
    const snapshot = new ReverseTetrisEngine().snapshot();
    const pending = recording.buildBlob(snapshot);
    expect(vi.getTimerCount()).toBe(count < 4096 ? 0 : 1);
    await vi.runAllTimersAsync();
    const blob = await pending;
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(buildReplayDownload(replay, snapshot));
  });

  it('freezes capture-time metadata, mutable start options, snapshot and count while recording continues', async () => {
    const { recording, replay, record } = createRecordings();
    const laterOptions = { easyMode: false };
    for (let index = 0; index < 8192; index++) record({ type: 'tick' }, index / 3);
    record({ type: 'start', seed: 7, options: laterOptions }, 1.25);
    // Preserve the legacy borrowing semantics up to the instant of capture.
    replay.options.easyMode = false;
    laterOptions.easyMode = true;
    const snapshot = new ReverseTetrisEngine().snapshot();
    const captured = buildReplayDownload(replay, snapshot);
    const first = recording.buildBlob(snapshot);
    expect(vi.getTimerCount()).toBe(1);
    replay.options.easyMode = true;
    laterOptions.easyMode = false;
    snapshot.score = 999;
    snapshot.board[0][0] = 1;
    record({ type: 'key', key: 'ArrowRight', code: 'ArrowRight', accepted: true }, 10_000.125);
    await vi.runAllTimersAsync();
    expect(await (await first).text()).toBe(captured);
    const second = recording.buildBlob(snapshot);
    await vi.runAllTimersAsync();
    expect(await (await second).text()).toBe(buildReplayDownload(replay, snapshot));
    expect(await (await first).text()).toBe(captured);
  });

  it('captures seeded and ready runs without advancing the engine', async () => {
    const engine = new ReverseTetrisEngine(createSeededRng(1));
    const { recording, record, startedAt, replay } = createRecordings();
    engine.start(startedAt, { easyMode: true });
    moveToValidPlacement(engine);
    engine.handleKey('Enter');
    const before = engine.snapshot();
    const tick = vi.spyOn(engine, 'tick');
    const controller = new AbortController();
    const blob = await prepareRecordedReplayDownload(engine, recording, record, controller.signal);
    expect(await blob.text()).toBe(buildReplayDownload(replay, before));
    expect(tick).not.toHaveBeenCalled();
    expect(engine.snapshot()).toEqual(before);
    const ready = new ReverseTetrisEngine();
    const readyRecord = vi.fn();
    const unseeded = await prepareRecordedReplayDownload(
      ready,
      new ReplayRecording(),
      readyRecord,
      controller.signal,
    );
    expect(readyRecord).not.toHaveBeenCalled();
    expect(JSON.parse(await unseeded.text())).toMatchObject({ seed: null, events: [] });
  });

  it('cancels before work or during a yield, clearing the queued timer without waiting for it', async () => {
    const { recording, record } = createRecordings();
    const snapshot = new ReverseTetrisEngine().snapshot();
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(recording.buildBlob(snapshot, alreadyAborted.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    for (let index = 0; index < 8192; index++) record({ type: 'tick' }, index);
    const controller = new AbortController();
    const pending = recording.buildBlob(snapshot, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    // A canceled export does not consume or detach the live recording.
    record({ type: 'resume' }, 9000.5);
    const retry = recording.buildBlob(snapshot, new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await (await retry).text()).toBe(recording.buildParts(snapshot).join(''));
  });

  it('keeps the completed large Blob cancelable before handing it to the download', async () => {
    const { recording, record } = createRecordings();
    for (let index = 0; index < 4096; index++) record({ type: 'tick' }, index / 3);
    // Keep serialization inside its budget so only the post-assembly yield is pending.
    vi.mocked(performance.now).mockReturnValue(0);
    const controller = new AbortController();
    const pending = recording.buildBlob(new ReverseTetrisEngine().snapshot(), controller.signal);
    const result = pending.catch((error: Error) => error);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('replay download lifecycle', () => {
  it('ignores synchronous duplicate requests and permits another download after completion', async () => {
    const prepared = deferredBlob();
    const prepare = vi.fn(() => prepared.promise);
    const save = vi.fn();
    const status = vi.fn();
    const download = new ReplayDownloadController(prepare, save, status);
    const first = download.start();
    await download.start();
    expect(prepare).toHaveBeenCalledOnce();
    expect(status.mock.calls).toEqual([['preparing']]);
    const blob = new Blob(['replay']);
    prepared.resolve(blob);
    await first;
    expect(save).toHaveBeenCalledExactlyOnceWith(blob);
    expect(status.mock.calls).toEqual([['preparing'], ['idle']]);
    await download.start();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('aborts on restart without saving a late result or clearing a newer export', async () => {
    const old = deferredBlob();
    const fresh = deferredBlob();
    const prepare = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const save = vi.fn();
    const status = vi.fn();
    const download = new ReplayDownloadController(prepare, save, status);
    const first = download.start();
    download.cancel();
    expect(prepare.mock.calls[0][0].aborted).toBe(true);
    const second = download.start();
    old.resolve(new Blob(['old']));
    await first;
    expect(save).not.toHaveBeenCalled();
    expect(status.mock.calls).toEqual([['preparing'], ['idle'], ['preparing']]);
    const blob = new Blob(['new']);
    fresh.resolve(blob);
    await second;
    expect(save).toHaveBeenCalledExactlyOnceWith(blob);
    expect(status).toHaveBeenLastCalledWith('idle');
  });

  it('suppresses late failure and further downloads after unmount', async () => {
    const pending = deferredBlob();
    const prepare = vi.fn(() => pending.promise);
    const save = vi.fn();
    const status = vi.fn();
    const download = new ReplayDownloadController(prepare, save, status);
    const first = download.start();
    download.dispose();
    pending.reject(new Error('Interrupted'));
    await first;
    await download.start();
    expect(prepare).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    expect(status.mock.calls).toEqual([['preparing']]);
    download.dispose();
  });

  it('reports preparation or save failures and allows retry', async () => {
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Cannot prepare');
      })
      .mockResolvedValue(new Blob(['replay']));
    const save = vi.fn().mockImplementationOnce(() => {
      throw new Error('Cannot save');
    });
    const status = vi.fn();
    const download = new ReplayDownloadController(prepare, save, status);
    await download.start();
    expect(status).toHaveBeenLastCalledWith('failed');
    await download.start();
    expect(status).toHaveBeenLastCalledWith('failed');
    await download.start();
    expect(status).toHaveBeenLastCalledWith('idle');
    expect(save).toHaveBeenCalledTimes(2);
    download.cancel();
  });
});

function deferredBlob() {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Blob>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function createRecordings() {
  const startedAt = 1000.137;
  const options = { easyMode: true };
  const replay = createReplayLog(1, options, 'test', startedAt);
  const recording = new ReplayRecording(1, options, 'test', startedAt);
  const record = (event: ReplayEventInput, clock: number) => {
    replay.events.push({ ...event, t: getReplayTime(clock, startedAt), clock });
    recording.record(event, clock);
  };
  return { recording, replay, record, startedAt };
}
