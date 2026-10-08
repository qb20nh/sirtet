import { Component, type ComponentChildren, type RefObject } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';

import { drawGame, drawShapePreview } from './canvas';
import { type GameSnapshot, ReverseTetrisEngine, type ShapeType } from './game';
import { captureRecordedReplayDownload, ReplayRecording } from './replay';
import {
  bindSessionInterruptions,
  createCommandHandler,
  createKeyDownHandler,
  createSeededRng,
  endStuckSession,
  type ReplayEventInput,
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
  const [replayRef] = useState(() => ({ current: new ReplayRecording() }));
  const engineRef = useRef<ReverseTetrisEngine | null>(null);
  if (!engineRef.current) engineRef.current = new ReverseTetrisEngine(() => rngRef.current());
  const engine = engineRef.current;
  const [state, setState] = useState<GameSnapshot>(() => engine.snapshot());
  const isEscaping = state.activePiece !== null;
  const holdShape = state.holdShapeType;
  const nextOneShape = state.previewQueue[0] ?? null;
  const nextTwoShape = state.previewQueue[1] ?? null;
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
      replayRef.current.record(event, timestamp);
    },
    [],
  );

  const startMatch = useCallback(() => {
    const seed = createReplaySeed();
    const options = { easyMode };
    const timestamp = performance.now();
    rngRef.current = createSeededRng(seed);
    replayRef.current = new ReplayRecording(seed, options, undefined, timestamp);
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
    downloadReplay(captureRecordedReplayDownload(engine, replayRef.current, recordReplayEvent));
    if (engine.isPlaying()) gameCanvas.current?.focus({ preventScroll: true });
  }, [engine, recordReplayEvent, gameCanvas]);

  const endStuckEasyModeGame = useCallback(() => {
    endStuckSession(engine, syncState, recordReplayEvent);
  }, [engine, syncState, recordReplayEvent]);

  // Draw with the DOM commit instead of waiting for passive effects after paint.
  useLayoutEffect(() => {
    drawGameCanvas(state, gameCanvas);
  }, [state, gameCanvas]);

  useLayoutEffect(() => {
    drawPreviewCanvas(holdShape, holdCanvas);
  }, [holdShape, holdCanvas]);

  useLayoutEffect(() => {
    drawPreviewCanvas(nextOneShape, nextOneCanvas);
  }, [nextOneShape, nextOneCanvas]);

  useLayoutEffect(() => {
    drawPreviewCanvas(nextTwoShape, nextTwoCanvas);
  }, [nextTwoShape, nextTwoCanvas]);

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
    if (state.gameState !== 'PLAYING' || !isEscaping) return;

    return startAnimationLoop(
      engine,
      setState,
      requestAnimationFrame,
      cancelAnimationFrame,
      (timestamp) => recordReplayEvent({ type: 'tick' }, timestamp),
    );
  }, [engine, recordReplayEvent, state.gameState, isEscaping]);

  return (
    <MemoizedGameLayout
      {...getLayoutPresentation({
        canvasRefs,
        overlay: getOverlayContent(state),
        easyMode,
        state,
        status: getStatusPresentation(state),
        onDownloadReplay: downloadCurrentReplay,
        onEndStuckEasyModeGame: endStuckEasyModeGame,
        onEasyModeChange: setEasyMode,
        onStart: state.gameState === 'PAUSED' ? togglePause : startMatch,
        onTogglePause: togglePause,
        onCommand: touchCommand,
      })}
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

// Display values and stable callbacks let canvas-only changes skip the DOM tree.
export function getLayoutPresentation({ state, overlay, status, ...controls }: GameLayoutProps) {
  return {
    ...controls,
    gameState: state.gameState,
    score: state.score,
    level: state.level,
    holdShapeType: state.holdShapeType,
    nextShapes: state.previewQueue.join(' / '),
    canEndStuckEasyModeGame:
      state.gameState === 'PLAYING' && state.easyMode && state.noLegalCarveAfterHoldSwap,
    overlayVisible: overlay.visible,
    overlayTitle: overlay.title,
    overlayTitleTone: overlay.titleTone,
    overlayDescription: overlay.description,
    overlayButtonLabel: overlay.buttonLabel,
    statusText: status.text,
    statusTone: status.tone,
    statusPulsing: status.pulsing,
  };
}

export function GameLayout(props: GameLayoutProps) {
  return GameLayoutView(getLayoutPresentation(props));
}

export class MemoizedGameLayout extends Component<ReturnType<typeof getLayoutPresentation>> {
  shouldComponentUpdate(next: ReturnType<typeof getLayoutPresentation>): boolean {
    const keys = Object.keys(next) as Array<keyof typeof next>;
    return (
      keys.length !== Object.keys(this.props).length ||
      keys.some((key) => next[key] !== this.props[key])
    );
  }

  render() {
    return GameLayoutView(this.props);
  }
}

function GameLayoutView({
  canvasRefs,
  easyMode,
  gameState,
  score,
  level,
  holdShapeType,
  nextShapes,
  canEndStuckEasyModeGame,
  overlayVisible,
  overlayTitle,
  overlayTitleTone,
  overlayDescription,
  overlayButtonLabel,
  statusText,
  statusTone,
  statusPulsing,
  onDownloadReplay,
  onEndStuckEasyModeGame,
  onEasyModeChange,
  onStart,
  onTogglePause = () => {},
  onCommand = () => {},
}: ReturnType<typeof getLayoutPresentation>) {
  const overlay: OverlayContent = {
    visible: overlayVisible,
    title: overlayTitle,
    titleTone: overlayTitleTone,
    description: overlayDescription,
    buttonLabel: overlayButtonLabel,
  };
  const status: StatusPresentation = {
    text: statusText,
    tone: statusTone,
    pulsing: statusPulsing,
  };
  return (
    <main class="game-shell" data-state={gameState.toLowerCase()}>
      <section class="game-frame" aria-label="Reverse Tetris game">
        <aside class="panel panel-left" aria-label="Stats and hold">
          <div class="metric-row">
            <Metric label="Score" value={score} tone="cyan" />
            <Metric label="Lvl" value={level} tone="purple" alignRight />
          </div>

          <PanelCanvas label="Hold (C/Shift)" type={holdShapeType}>
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
              Score {score} · Lvl {level}
            </span>
            <button
              type="button"
              class="pause-button"
              disabled={gameState !== 'PLAYING' && gameState !== 'PAUSED'}
              onClick={onTogglePause}
            >
              {gameState === 'PAUSED' ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div class="board-shapes">
            Hold {holdShapeType ?? '—'} · Next {nextShapes}
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
              paused={gameState === 'PAUSED'}
            />
          </div>
          <TouchControls disabled={gameState !== 'PLAYING'} onCommand={onCommand} />
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
            canEndStuckEasyModeGame={canEndStuckEasyModeGame}
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

function downloadReplay(serializedReplay: string[]): void {
  const blob = new Blob(serializedReplay, {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sirtet-replay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function drawGameCanvas(state: GameSnapshot, ref: RefObject<HTMLCanvasElement>): void {
  const canvas = ref.current;
  const context = canvas?.getContext('2d');
  if (canvas && context) drawGame(context, canvas, state);
}

export function drawPreviewCanvas(type: ShapeType | null, ref: RefObject<HTMLCanvasElement>): void {
  const canvas = ref.current;
  const context = canvas?.getContext('2d');
  if (canvas && context) drawShapePreview(type, context, canvas);
}
