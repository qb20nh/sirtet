import type { ComponentChildren, RefObject } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { drawGame, drawShapePreview } from './canvas';
import { type GameSnapshot, ReverseTetrisEngine, type ShapeType } from './game';
import {
  bindSessionInterruptions,
  captureReplayDownload,
  createCommandHandler,
  createKeyDownHandler,
  createReplayLog,
  createSeededRng,
  endStuckSession,
  getReplayTime,
  type ReplayEventInput,
  type ReplayLog,
  setSessionPaused,
  startAnimationLoop,
  startEngine,
} from './session';
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

/* v8 ignore start -- Browser hook wiring is covered by the smoke test; pure helpers are unit-tested. */
export function App() {
  const rngRef = useRef<() => number>(() => Math.random());
  const replayRef = useRef<ReplayLog>(createReplayLog());
  const replayStartedAtRef = useRef(0);
  const engineRef = useRef<ReverseTetrisEngine | null>(null);
  if (!engineRef.current) engineRef.current = new ReverseTetrisEngine(() => rngRef.current());
  const engine = engineRef.current;
  const [state, setState] = useState<GameSnapshot>(() => engine.snapshot());
  const [easyMode, setEasyMode] = useState(false);
  const gameCanvas = useRef<HTMLCanvasElement>(null);
  const holdCanvas = useRef<HTMLCanvasElement>(null);
  const nextOneCanvas = useRef<HTMLCanvasElement>(null);
  const nextTwoCanvas = useRef<HTMLCanvasElement>(null);
  const canvasRefs = useMemo<CanvasRefs>(
    () => ({ game: gameCanvas, hold: holdCanvas, nextOne: nextOneCanvas, nextTwo: nextTwoCanvas }),
    [gameCanvas, holdCanvas, nextOneCanvas, nextTwoCanvas],
  );

  const syncState = useCallback(() => {
    setState(engine.snapshot());
  }, [engine]);

  const recordReplayEvent = useCallback(
    (event: ReplayEventInput, timestamp = performance.now()) => {
      replayRef.current.events.push({
        ...event,
        t: getReplayTime(timestamp, replayStartedAtRef.current),
        clock: timestamp,
      });
    },
    [],
  );

  const startMatch = useCallback(() => {
    const seed = createReplaySeed();
    const options = { easyMode };
    const timestamp = performance.now();
    rngRef.current = createSeededRng(seed);
    replayRef.current = createReplayLog(seed, options, undefined, timestamp);
    replayStartedAtRef.current = timestamp;
    startEngine(engine, syncState, () => timestamp, options);
    gameCanvas.current?.focus({ preventScroll: true });
  }, [easyMode, engine, syncState, gameCanvas]);

  const togglePause = useCallback(() => {
    setSessionPaused(engine, engine.isPlaying(), syncState, undefined, recordReplayEvent);
    gameCanvas.current?.focus({ preventScroll: true });
  }, [engine, syncState, recordReplayEvent, gameCanvas]);

  const command = useMemo(
    () => createCommandHandler(engine, syncState, recordReplayEvent),
    [engine, syncState, recordReplayEvent],
  );
  const touchCommand = useCallback(
    (key: string) => {
      command(key);
      gameCanvas.current?.focus({ preventScroll: true });
    },
    [command, gameCanvas],
  );

  const downloadCurrentReplay = useCallback(() => {
    downloadReplay(captureReplayDownload(engine, replayRef.current, recordReplayEvent));
    if (engine.isPlaying()) gameCanvas.current?.focus({ preventScroll: true });
  }, [engine, recordReplayEvent, gameCanvas]);

  const endStuckEasyModeGame = useCallback(() => {
    endStuckSession(engine, syncState, recordReplayEvent);
  }, [engine, syncState, recordReplayEvent]);

  useEffect(() => {
    drawCanvases(state, canvasRefs);
  }, [state, canvasRefs]);

  useEffect(() => {
    const onKeyDown = createKeyDownHandler(engine, syncState, recordReplayEvent, togglePause);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine, recordReplayEvent, syncState, togglePause]);

  useEffect(() => {
    const pause = () => setSessionPaused(engine, true, syncState, undefined, recordReplayEvent);
    return bindSessionInterruptions(window, document, pause);
  }, [engine, syncState, recordReplayEvent]);

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
      onStart={state.gameState === 'PAUSED' ? togglePause : startMatch}
      onTogglePause={togglePause}
      onCommand={touchCommand}
    />
  );
}
/* v8 ignore stop */

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
  onTogglePause?: () => void;
  onCommand?: (key: string) => void;
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
  onTogglePause = () => {},
  onCommand = () => {},
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

        <section class="board-column" aria-label="Game board and actions">
          <div class="game-toolbar">
            <span>
              Score {state.score} · Lvl {state.level}
            </span>
            <button
              type="button"
              class="pause-button"
              disabled={state.gameState !== 'PLAYING' && state.gameState !== 'PAUSED'}
              onClick={onTogglePause}
            >
              {state.gameState === 'PAUSED' ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div class="board-shapes">
            Hold {state.holdShapeType ?? '—'} · Next {state.previewQueue.join(' / ')}
          </div>
          <div class="board-status">
            <StatusBlock status={status} />
          </div>
          <div class="board-stage">
            <canvas
              ref={canvasRefs.game}
              width="300"
              height="720"
              class="game-canvas"
              aria-label="Reverse Tetris board"
              tabIndex={0}
            />
            <Overlay
              content={overlay}
              easyMode={easyMode}
              onEasyModeChange={onEasyModeChange}
              onStart={onStart}
              paused={state.gameState === 'PAUSED'}
            />
          </div>
          <TouchControls disabled={state.gameState !== 'PLAYING'} onCommand={onCommand} />
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
  paused?: boolean;
}

export function Overlay({
  content,
  easyMode,
  onEasyModeChange,
  onStart,
  paused = false,
}: OverlayProps) {
  return (
    <div class={content.visible ? 'overlay visible' : 'overlay'} aria-hidden={!content.visible}>
      <h1 class={`overlay-title overlay-${content.titleTone}`}>{content.title}</h1>
      <p class="overlay-description">{content.description}</p>
      {paused ? null : (
        <label class="easy-mode-toggle">
          <input
            type="checkbox"
            checked={easyMode}
            onInput={(event) => onEasyModeChange(event.currentTarget.checked)}
          />
          <span>Easy mode</span>
        </label>
      )}
      <button type="button" class="start-button" onClick={onStart}>
        {content.buttonLabel}
      </button>
    </div>
  );
}

const TOUCH_COMMANDS = [
  { key: 'ArrowUp', label: 'Move up', text: '↑', className: 'touch-up' },
  { key: 'ArrowLeft', label: 'Move left', text: '←', className: 'touch-left' },
  { key: 'ArrowDown', label: 'Move down', text: '↓', className: 'touch-down' },
  { key: 'ArrowRight', label: 'Move right', text: '→', className: 'touch-right' },
  { key: 'z', label: 'Rotate left', text: '↶', className: 'touch-rotate-left' },
  { key: 'x', label: 'Rotate right', text: '↷', className: 'touch-rotate-right' },
  { key: 'c', label: 'Swap or hold', text: 'Hold', className: 'touch-hold' },
  { key: 'Enter', label: 'Carve block', text: 'Carve', className: 'touch-carve' },
];

export function TouchControls({
  disabled,
  onCommand,
}: {
  disabled: boolean;
  onCommand: (key: string) => void;
}) {
  return (
    <fieldset class="touch-controls" aria-label="Touch controls">
      {TOUCH_COMMANDS.map(({ key, label, text, className }) => (
        <button
          key={key}
          type="button"
          class={className}
          aria-label={label}
          disabled={disabled}
          onClick={() => {
            if (!disabled) onCommand(key);
          }}
        >
          {text}
        </button>
      ))}
    </fieldset>
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

function downloadReplay(serializedReplay: string): void {
  const blob = new Blob([serializedReplay], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sirtet-replay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
