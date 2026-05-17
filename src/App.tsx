import type { ComponentChildren, RefObject } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { drawGame, drawShapePreview } from './canvas';
import {
  type GameSnapshot,
  type GameStartOptions,
  ReverseTetrisEngine,
  type ShapeType,
  shouldPreventKey,
} from './game';
import {
  CONTROL_HINTS,
  getOverlayContent,
  getStatusPresentation,
  type OverlayContent,
  type StatusPresentation,
} from './ui';

export interface CanvasRefs {
  game: RefObject<HTMLCanvasElement>;
  hold: RefObject<HTMLCanvasElement>;
  nextOne: RefObject<HTMLCanvasElement>;
  nextTwo: RefObject<HTMLCanvasElement>;
}

type ReplayEvent =
  | { type: 'start'; t: number; seed: number; options: GameStartOptions }
  | { type: 'key'; t: number; key: string; code: string; accepted: boolean }
  | { type: 'tick'; t: number };

export type ReplayEventInput =
  | { type: 'start'; seed: number; options: GameStartOptions }
  | { type: 'key'; key: string; code: string; accepted: boolean }
  | { type: 'tick' };

export interface ReplayLog {
  version: 1;
  createdAt: string;
  seed: number | null;
  options: GameStartOptions;
  events: ReplayEvent[];
}

/* v8 ignore start -- Browser hook wiring is covered by the smoke test; pure helpers are unit-tested. */
export function App() {
  const rngRef = useRef<() => number>(() => Math.random());
  const replayRef = useRef<ReplayLog>(createReplayLog());
  const replayStartedAtRef = useRef(0);
  const engine = useMemo(() => new ReverseTetrisEngine(() => rngRef.current()), []);
  const [state, setState] = useState<GameSnapshot>(() => engine.snapshot());
  const [easyMode, setEasyMode] = useState(false);
  const canvasRefs: CanvasRefs = {
    game: useRef<HTMLCanvasElement>(null),
    hold: useRef<HTMLCanvasElement>(null),
    nextOne: useRef<HTMLCanvasElement>(null),
    nextTwo: useRef<HTMLCanvasElement>(null),
  };

  const syncState = useCallback(() => {
    setState(engine.snapshot());
  }, [engine]);

  const recordReplayEvent = useCallback((event: ReplayEventInput, timestamp: number) => {
    replayRef.current.events.push({
      ...event,
      t: getReplayTime(timestamp, replayStartedAtRef.current),
    } as ReplayEvent);
  }, []);

  const startMatch = useCallback(() => {
    const seed = createReplaySeed();
    const options = { easyMode };
    const timestamp = performance.now();
    rngRef.current = createSeededRng(seed);
    replayRef.current = createReplayLog(seed, options);
    replayStartedAtRef.current = timestamp;
    startEngine(engine, syncState, () => timestamp, options);
  }, [easyMode, engine, syncState]);

  const downloadCurrentReplay = useCallback(() => {
    downloadReplay(replayRef.current, engine.snapshot());
  }, [engine]);

  const endStuckEasyModeGame = useCallback(() => {
    if (engine.endStuckEasyModeGame()) {
      syncState();
    }
  }, [engine, syncState]);

  useEffect(() => {
    drawCanvases(state, canvasRefs);
  }, [state, canvasRefs]);

  useEffect(() => {
    const onKeyDown = createKeyDownHandler(engine, syncState, (event) =>
      recordReplayEvent(event, performance.now()),
    );
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine, recordReplayEvent, syncState]);

  useEffect(() => {
    if (state.gameState !== 'PLAYING') return;

    return startAnimationLoop(
      engine,
      setState,
      requestAnimationFrame,
      cancelAnimationFrame,
      (timestamp) => recordReplayEvent({ type: 'tick' }, timestamp),
    );
  }, [engine, recordReplayEvent, state.gameState]);

  return (
    <GameLayout
      canvasRefs={canvasRefs}
      overlay={getOverlayContent(state)}
      easyMode={easyMode}
      state={state}
      status={getStatusPresentation(state)}
      onDownloadReplay={downloadCurrentReplay}
      onEndStuckEasyModeGame={endStuckEasyModeGame}
      onEasyModeChange={setEasyMode}
      onStart={startMatch}
    />
  );
}
/* v8 ignore stop */

export interface KeyboardEventLike {
  code: string;
  key: string;
  preventDefault: () => void;
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

export function createKeyDownHandler(
  engine: ReverseTetrisEngine,
  syncState: () => void,
  recordReplayEvent?: (event: ReplayEventInput) => void,
) {
  return (event: KeyboardEventLike) => {
    const shouldHandleKey = shouldPreventKey(event.key, event.code);
    if (shouldHandleKey) {
      event.preventDefault();
    }

    const accepted = engine.handleKey(event.key, event.code);
    if (shouldHandleKey) {
      recordReplayEvent?.({ type: 'key', key: event.key, code: event.code, accepted });
    }

    if (accepted) {
      syncState();
    }
  };
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
    const previousState = engine.snapshot();
    engine.tick(timestamp);
    const nextState = engine.snapshot();
    setState(nextState);

    if (hasReplayStateChanged(previousState, nextState)) {
      recordTick?.(timestamp);
    }

    if (!stopped && nextState.gameState === 'PLAYING') {
      frame = requestFrame(loop);
    }
  };

  frame = requestFrame(loop);

  return () => {
    stopped = true;
    cancelFrame(frame);
  };
}

export interface GameLayoutProps {
  canvasRefs: CanvasRefs;
  overlay: OverlayContent;
  easyMode: boolean;
  state: GameSnapshot;
  status: StatusPresentation;
  onDownloadReplay: () => void;
  onEndStuckEasyModeGame: () => void;
  onEasyModeChange: (easyMode: boolean) => void;
  onStart: () => void;
}

export function GameLayout({
  canvasRefs,
  overlay,
  easyMode,
  state,
  status,
  onDownloadReplay,
  onEndStuckEasyModeGame,
  onEasyModeChange,
  onStart,
}: GameLayoutProps) {
  return (
    <main class="game-shell" data-state={state.gameState.toLowerCase()}>
      <section class="game-frame" aria-label="Reverse Tetris game">
        <aside class="panel panel-left" aria-label="Stats and hold">
          <div class="metric-row">
            <Metric label="Score" value={state.score} tone="cyan" />
            <Metric label="Lvl" value={state.level} tone="purple" alignRight />
          </div>

          <PanelCanvas label="Hold (C/Shift)" type={state.holdShapeType}>
            <canvas ref={canvasRefs.hold} width="80" height="80" aria-label="Held shape" />
          </PanelCanvas>

          <StatusBlock status={status} />

          <div class="rule-copy">
            <p>
              <strong>Rules:</strong> Carve out pieces from the solid mass.
            </p>
            <p>Pieces must have a valid path to escape upwards.</p>
            <p class="accent-warning">Carving below the orange line pulls the board up.</p>
          </div>
        </aside>

        <section class="board-stage" aria-label="Game board">
          <canvas
            ref={canvasRefs.game}
            width="300"
            height="720"
            class="game-canvas"
            aria-label="Reverse Tetris board"
          />
          <Overlay
            content={overlay}
            easyMode={easyMode}
            onEasyModeChange={onEasyModeChange}
            onStart={onStart}
          />
        </section>

        <aside class="panel panel-right" aria-label="Next shapes and controls">
          <div>
            <h2 class="panel-heading">Next Shapes</h2>
            <div class="preview-stack">
              <canvas ref={canvasRefs.nextOne} width="80" height="80" aria-label="Next shape" />
              <div class="preview-divider" />
              <canvas
                ref={canvasRefs.nextTwo}
                width="80"
                height="80"
                aria-label="Second next shape"
              />
            </div>
          </div>

          <ControlList
            canEndStuckEasyModeGame={
              state.gameState === 'PLAYING' && state.easyMode && state.noLegalCarveAfterHoldSwap
            }
            onDownloadReplay={onDownloadReplay}
            onEndStuckEasyModeGame={onEndStuckEasyModeGame}
          />
        </aside>
      </section>
    </main>
  );
}

interface MetricProps {
  label: string;
  value: number;
  tone: 'cyan' | 'purple';
  alignRight?: boolean;
}

export function Metric({ label, value, tone, alignRight = false }: MetricProps) {
  return (
    <div class={alignRight ? 'metric metric-right' : 'metric'}>
      <h2 class="panel-heading">{label}</h2>
      <div class={`metric-value metric-${tone}`}>{value}</div>
    </div>
  );
}

interface PanelCanvasProps {
  children: ComponentChildren;
  label: string;
  type: ShapeType | null;
}

export function PanelCanvas({ children, label, type }: PanelCanvasProps) {
  return (
    <div>
      <h2 class="panel-heading">{label}</h2>
      <div class={type ? 'mini-canvas filled' : 'mini-canvas empty'}>{children}</div>
    </div>
  );
}

export function StatusBlock({ status }: { status: StatusPresentation }) {
  const classes = ['status-text', `status-${status.tone}`];
  if (status.pulsing) classes.push('status-pulse');

  return (
    <div>
      <h2 class="panel-heading">Status</h2>
      <div class={classes.join(' ')}>{status.text}</div>
    </div>
  );
}

export interface OverlayProps {
  content: OverlayContent;
  easyMode: boolean;
  onEasyModeChange: (easyMode: boolean) => void;
  onStart: () => void;
}

export function Overlay({ content, easyMode, onEasyModeChange, onStart }: OverlayProps) {
  return (
    <div class={content.visible ? 'overlay visible' : 'overlay'} aria-hidden={!content.visible}>
      <h1 class={`overlay-title overlay-${content.titleTone}`}>{content.title}</h1>
      <p class="overlay-description">{content.description}</p>
      <label class="easy-mode-toggle">
        <input
          type="checkbox"
          checked={easyMode}
          onInput={(event) => onEasyModeChange(event.currentTarget.checked)}
        />
        <span>Easy mode</span>
      </label>
      <button type="button" class="start-button" onClick={onStart}>
        {content.buttonLabel}
      </button>
    </div>
  );
}

export function ControlList({
  canEndStuckEasyModeGame = false,
  onDownloadReplay = () => {},
  onEndStuckEasyModeGame = () => {},
}: {
  canEndStuckEasyModeGame?: boolean;
  onDownloadReplay?: () => void;
  onEndStuckEasyModeGame?: () => void;
} = {}) {
  return (
    <div class="controls">
      <h2 class="panel-heading">Controls</h2>
      <ul>
        {CONTROL_HINTS.map((hint) => (
          <li key={hint.keys}>
            <span>{hint.keys}</span>
            {hint.label}
          </li>
        ))}
      </ul>
      <button type="button" class="replay-button" onClick={onDownloadReplay}>
        Download replay
      </button>
      {canEndStuckEasyModeGame ? (
        <button
          type="button"
          class="replay-button end-game-button"
          onClick={onEndStuckEasyModeGame}
        >
          End game
        </button>
      ) : null}
    </div>
  );
}

function createReplaySeed(): number {
  return Math.floor(Math.random() * 0x100000000);
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
): ReplayLog {
  return {
    version: 1,
    createdAt,
    seed,
    options,
    events: seed === null ? [] : [{ type: 'start', t: 0, seed, options }],
  };
}

export function buildReplayDownload(replay: ReplayLog, snapshot: GameSnapshot): string {
  return JSON.stringify(
    {
      ...replay,
      snapshot,
    },
    null,
    2,
  );
}

function downloadReplay(replay: ReplayLog, snapshot: GameSnapshot): void {
  const blob = new Blob([buildReplayDownload(replay, snapshot)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sirtet-replay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function getReplayTime(timestamp: number, startedAt: number): number {
  return Math.max(0, Math.round(timestamp - startedAt));
}

function hasReplayStateChanged(before: GameSnapshot, after: GameSnapshot): boolean {
  return getReplayStateKey(before) !== getReplayStateKey(after);
}

function getReplayStateKey(state: GameSnapshot): string {
  return [
    state.gameState,
    state.score,
    state.level,
    state.piecesCarved,
    state.currentShapeType,
    state.currentRotation,
    state.mouseX,
    state.mouseY,
    state.ghostValid,
    state.activePiece?.type ?? '',
    state.activePiece?.pathIndex ?? '',
    state.queuedPiece?.type ?? '',
    state.queuedPiece?.pathIndex ?? '',
    state.statusReason,
  ].join('|');
}

export function drawCanvases(state: GameSnapshot, refs: CanvasRefs): void {
  const game = refs.game.current;
  const hold = refs.hold.current;
  const nextOne = refs.nextOne.current;
  const nextTwo = refs.nextTwo.current;
  const gameContext = game?.getContext('2d');
  const holdContext = hold?.getContext('2d');
  const nextOneContext = nextOne?.getContext('2d');
  const nextTwoContext = nextTwo?.getContext('2d');

  if (game && gameContext) drawGame(gameContext, game, state);
  if (hold && holdContext) drawShapePreview(state.holdShapeType, holdContext, hold);
  if (nextOne && nextOneContext)
    drawShapePreview(state.previewQueue[0] ?? null, nextOneContext, nextOne);
  if (nextTwo && nextTwoContext)
    drawShapePreview(state.previewQueue[1] ?? null, nextTwoContext, nextTwo);
}
