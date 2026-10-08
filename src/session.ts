import {
  type GameSnapshot,
  type GameStartOptions,
  type ReverseTetrisEngine,
  shouldPreventKey,
} from './game';

type ReplayEvent = ReplayEventInput & { t: number; clock: number };

export type ReplayEventInput =
  | { type: 'start'; seed: number; options: GameStartOptions }
  | { type: 'key'; key: string; code: string; accepted: boolean }
  | { type: 'tick' | 'pause' | 'resume' | 'end-stuck' };

type ReplayRecorder = (event: ReplayEventInput, timestamp?: number) => void;

export interface ReplayLog {
  version: 3;
  createdAt: string;
  seed: number | null;
  options: GameStartOptions;
  events: ReplayEvent[];
}

export interface KeyboardEventLike {
  code: string;
  key: string;
  preventDefault: () => void;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}

const INTERACTIVE_TARGETS =
  'button,input,select,textarea,a[href],[contenteditable]:not([contenteditable="false"]),[role="button"]';
const MOVEMENT_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];

export function bindSessionInterruptions(
  windowTarget: Window,
  documentTarget: Document,
  pause: () => void,
): () => void {
  const onWindowBlur = (event: FocusEvent) => {
    if (event.target === windowTarget) pause();
  };
  const onVisibilityChange = () => {
    if (documentTarget.hidden) pause();
  };
  windowTarget.addEventListener('blur', onWindowBlur);
  documentTarget.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    windowTarget.removeEventListener('blur', onWindowBlur);
    documentTarget.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

export function startEngine(
  engine: ReverseTetrisEngine,
  syncState: () => void,
  now = () => performance.now(),
  options: GameStartOptions = {},
): void {
  engine.start(now(), options);
  syncState();
}

export function createCommandHandler(
  engine: ReverseTetrisEngine,
  syncState: () => void,
  recordReplayEvent?: ReplayRecorder,
  now = () => performance.now(),
) {
  return (key: string, code = '') => {
    if (!engine.isPlaying() || !shouldPreventKey(key, code)) return false;
    // Idle sessions have no animation callbacks. Start the next escape from
    // this command's clock, so time spent choosing a carve never catches up.
    if (!engine.isEscaping()) engine.tick(now());
    if (recordReplayEvent) recordReplayBoundary(engine, recordReplayEvent);
    const accepted = engine.handleKey(key, code);
    recordReplayEvent?.({ type: 'key', key, code, accepted });
    if (accepted) syncState();
    return accepted;
  };
}

export function createKeyDownHandler(
  engine: ReverseTetrisEngine,
  syncState: () => void,
  recordReplayEvent?: ReplayRecorder,
  togglePause?: () => void,
  now = () => performance.now(),
) {
  const command = createCommandHandler(engine, syncState, recordReplayEvent, now);
  return (event: KeyboardEventLike) => {
    const target = event.target as Element | null | undefined;
    if (
      event.defaultPrevented ||
      event.isComposing ||
      target?.closest?.(INTERACTIVE_TARGETS) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (event.shiftKey && event.key !== 'Shift')
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'escape' || key === 'p') {
      if (
        !event.repeat &&
        togglePause &&
        (engine.isPlaying() || engine.snapshot().gameState === 'PAUSED')
      ) {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (!engine.isPlaying() || !shouldPreventKey(event.key, event.code)) return;
    event.preventDefault();
    if (event.repeat && !MOVEMENT_KEYS.includes(key)) return;
    command(event.key, event.code);
  };
}

export function setSessionPaused(
  engine: ReverseTetrisEngine,
  paused: boolean,
  syncState: () => void,
  now = () => performance.now(),
  recordReplayEvent?: (event: ReplayEventInput, timestamp: number) => void,
): boolean {
  const timestamp = now();
  // Include the partial animation beat in the replay before freezing the clock.
  const ticked = paused && engine.isPlaying();
  const visibleChange = ticked ? engine.tick(timestamp) : false;
  if (ticked) recordReplayEvent?.({ type: 'tick' }, timestamp);
  const changed = paused ? engine.pause() : engine.resume(timestamp);
  if (changed) {
    recordReplayEvent?.({ type: paused ? 'pause' : 'resume' }, timestamp);
    syncState();
  } else if (visibleChange) {
    syncState();
  }
  return changed;
}

export function startAnimationLoop(
  engine: ReverseTetrisEngine,
  setState: (state: GameSnapshot) => void,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
  recordTick?: (timestamp: number) => void,
): () => void {
  let frame = 0;
  let stopped = false;
  const loop = (timestamp: number) => {
    if (stopped) return;
    const wasEscaping = engine.isEscaping();
    if (engine.tick(timestamp)) {
      setState(engine.snapshot());
    }
    // Keep the same floating-point accumulation order as live animation.
    // Timer-only active frames matter to exact replay, even without a redraw.
    if (wasEscaping) recordTick?.(timestamp);
    if (!stopped && engine.isEscaping()) frame = requestFrame(loop);
  };
  if (engine.isEscaping()) frame = requestFrame(loop);
  return () => {
    stopped = true;
    cancelFrame(frame);
  };
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

export function createReplayLog(
  seed: number | null = null,
  options: GameStartOptions = {},
  createdAt = new Date().toISOString(),
  startedAt = 0,
): ReplayLog {
  return {
    version: 3,
    createdAt,
    seed,
    options,
    events: seed === null ? [] : [{ type: 'start', t: 0, clock: startedAt, seed, options }],
  };
}

export function buildReplayDownload(replay: ReplayLog, snapshot: GameSnapshot): string {
  return JSON.stringify({ ...replay, snapshot }, null, 2);
}

function recordReplayBoundary(
  engine: ReverseTetrisEngine,
  recordReplayEvent: ReplayRecorder,
): void {
  // Silent frames still advance the engine clock. Preserve that boundary before
  // a command can create or replace a piece, without advancing the live game.
  recordReplayEvent({ type: 'tick' }, engine.getTickTimestamp());
}

export function captureReplayDownload(
  engine: ReverseTetrisEngine,
  replay: ReplayLog,
  recordReplayEvent: ReplayRecorder,
): string {
  if (replay.seed !== null) recordReplayBoundary(engine, recordReplayEvent);
  return buildReplayDownload(replay, engine.snapshot());
}

export function endStuckSession(
  engine: ReverseTetrisEngine,
  syncState: () => void,
  recordReplayEvent?: ReplayRecorder,
): boolean {
  if (!engine.endStuckEasyModeGame()) return false;
  if (recordReplayEvent) {
    recordReplayBoundary(engine, recordReplayEvent);
    recordReplayEvent({ type: 'end-stuck' });
  }
  syncState();
  return true;
}

export function getReplayTime(timestamp: number, startedAt: number): number {
  return Math.max(0, timestamp - startedAt);
}
