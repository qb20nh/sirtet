import { describe, expect, it, vi } from 'vitest';

import { ReverseTetrisEngine } from '../src/game';
import { captureRecordedReplayDownload, ReplayRecording } from '../src/replay';
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
