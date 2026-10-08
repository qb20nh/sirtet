import { describe, expect, it, vi } from 'vitest';

import {
  type CanvasRefs,
  ControlList,
  drawGameCanvas,
  drawPreviewCanvas,
  GameLayout,
  getLayoutPresentation,
  MemoizedGameLayout,
  Metric,
  Overlay,
  PanelCanvas,
  StatusBlock,
  TouchControls,
} from '../src/App';
import { ReverseTetrisEngine } from '../src/game';
import {
  buildReplayDownload,
  createKeyDownHandler,
  createReplayLog,
  createSeededRng,
  startAnimationLoop,
  startEngine,
} from '../src/session';
import { CONTROL_HINTS, getOverlayContent, getStatusPresentation } from '../src/ui';
import { moveToValidPlacement } from './game-helpers';

describe('UI helpers and layout', () => {
  it('derives overlay content for ready, failure, and win states', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const ready = engine.snapshot();

    expect(getOverlayContent(ready)).toMatchObject({
      visible: true,
      title: 'REVERSE TETRIS',
      buttonLabel: 'Start Carving',
    });

    engine.start();
    const playing = engine.snapshot();
    expect(getOverlayContent(playing).visible).toBe(false);

    const failure = { ...playing, gameState: 'GAMEOVER' as const, statusReason: 'Too slow!' };
    expect(getOverlayContent(failure)).toMatchObject({
      visible: true,
      titleTone: 'danger',
      buttonLabel: 'RESTART SEQUENCE',
    });

    const win = { ...playing, gameState: 'WIN' as const };
    expect(getOverlayContent(win)).toMatchObject({
      visible: true,
      title: 'CLEARED!',
      titleTone: 'success',
    });
  });

  it('derives status text for pre-carve, queue-full, and active flow states', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const ready = engine.snapshot();
    const playing = engine.start();

    expect(getStatusPresentation(ready)).toMatchObject({ text: 'Waiting to start...' });
    expect(getStatusPresentation(playing)).toMatchObject({
      text: 'Waiting for first carve...',
      pulsing: false,
    });

    expect(
      getStatusPresentation({
        ...playing,
        firstCarveDone: true,
        noLegalCarveAfterHoldSwap: true,
        queuedPiece: createEscapePiece(),
      }),
    ).toMatchObject({
      text: 'No legal carve, even after hold.',
      tone: 'danger',
      pulsing: true,
    });

    expect(
      getStatusPresentation({
        ...playing,
        activePiece: null,
        easyMode: true,
        firstCarveDone: true,
        queuedPiece: null,
      }),
    ).toMatchObject({ text: 'Easy Mode: carve when ready.', tone: 'stable', pulsing: false });

    expect(
      getStatusPresentation({
        ...playing,
        firstCarveDone: true,
        queuedPiece: null,
      }),
    ).toMatchObject({ tone: 'danger', pulsing: true });

    expect(
      getStatusPresentation({
        ...playing,
        firstCarveDone: true,
        queuedPiece: createEscapePiece(),
      }),
    ).toMatchObject({ tone: 'warning', pulsing: true });
  });

  it('creates the full Preact layout vnode with controls and canvases', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const state = engine.start();
    const vnode = GameLayout({
      canvasRefs: createCanvasRefs(),
      easyMode: false,
      overlay: getOverlayContent(state),
      state,
      status: getStatusPresentation(state),
      onDownloadReplay: vi.fn(),
      onEndStuckEasyModeGame: vi.fn(),
      onEasyModeChange: vi.fn(),
      onStart: vi.fn(),
    });

    expect(vnode.type).toBe('main');
    expect(CONTROL_HINTS.map((hint) => hint.keys)).toEqual([
      'WASD / Arrows',
      'Z / X',
      'C / Shift',
      'Space / Enter',
      'P / Esc',
    ]);

    const stuckState = { ...state, easyMode: true, noLegalCarveAfterHoldSwap: true };
    expect(
      GameLayout({
        canvasRefs: createCanvasRefs(),
        easyMode: true,
        overlay: getOverlayContent(stuckState),
        state: stuckState,
        status: getStatusPresentation(stuckState),
        onDownloadReplay: vi.fn(),
        onEndStuckEasyModeGame: vi.fn(),
        onEasyModeChange: vi.fn(),
        onStart: vi.fn(),
      }).type,
    ).toBe('main');
  });

  it('covers component helpers and canvas ref drawing', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const state = engine.start();
    const refs = createCanvasRefs(createCanvas());

    expect(Metric({ label: 'Score', value: 10, tone: 'cyan' }).type).toBe('div');
    expect(Metric({ label: 'Lvl', value: 2, tone: 'purple', alignRight: true }).type).toBe('div');
    expect(
      PanelCanvas({
        label: 'Hold',
        type: 'T',
        children: <canvas />,
      }).type,
    ).toBe('div');
    expect(PanelCanvas({ label: 'Empty', type: null, children: <canvas /> }).type).toBe('div');
    expect(
      StatusBlock({
        status: {
          text: 'Queue Full! Next carve skips!',
          tone: 'warning',
          pulsing: true,
        },
      }).type,
    ).toBe('div');
    expect(
      StatusBlock({
        status: {
          text: 'Stable',
          tone: 'stable',
          pulsing: false,
        },
      }).type,
    ).toBe('div');
    const onEasyModeChange = vi.fn();
    const overlay = Overlay({
      content: getOverlayContent(state),
      easyMode: true,
      onEasyModeChange,
      onStart: vi.fn(),
    });
    expect(overlay.type).toBe('div');
    overlay.props.children[2].props.children[0].props.onInput({
      currentTarget: { checked: false },
    });
    expect(onEasyModeChange).toHaveBeenCalledWith(false);
    expect(
      Overlay({
        content: getOverlayContent(new ReverseTetrisEngine(() => 0.5).snapshot()),
        easyMode: false,
        onEasyModeChange: vi.fn(),
        onStart: vi.fn(),
      }).type,
    ).toBe('div');
    const onDownloadReplay = vi.fn();
    const controls = ControlList({ onDownloadReplay });
    expect(controls.type).toBe('div');
    controls.props.children[2].props.onClick();
    expect(onDownloadReplay).toHaveBeenCalledOnce();
    const defaultControls = ControlList();
    expect(defaultControls.type).toBe('div');
    defaultControls.props.children[2].props.onClick();
    const onEndStuckEasyModeGame = vi.fn();
    const stuckControls = ControlList({
      canEndStuckEasyModeGame: true,
      onEndStuckEasyModeGame,
    });
    expect(stuckControls.props.children[3].props.children).toBe('End game');
    stuckControls.props.children[3].props.onClick();
    expect(onEndStuckEasyModeGame).toHaveBeenCalledOnce();
    ControlList({ canEndStuckEasyModeGame: true }).props.children[3].props.onClick();

    drawGameCanvas(state, refs.game);
    drawPreviewCanvas(state.holdShapeType, refs.hold);
    drawPreviewCanvas(state.previewQueue[0] ?? null, refs.nextOne);
    expect(refs.game.current?.getContext('2d')).toBeTruthy();
    drawPreviewCanvas(null, refs.nextTwo);
    drawGameCanvas(state, { current: null });
    drawPreviewCanvas('T', { current: null });
  });

  it('skips canvas-only layout updates while preserving visible state and control changes', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const state = engine.start();
    const controls = {
      canvasRefs: createCanvasRefs(createCanvas()),
      easyMode: false,
      onDownloadReplay: vi.fn(),
      onEndStuckEasyModeGame: vi.fn(),
      onEasyModeChange: vi.fn(),
      onStart: vi.fn(),
      onCommand: vi.fn(),
    };
    const presentation = (snapshot = engine.snapshot()) =>
      getLayoutPresentation({
        ...controls,
        state: snapshot,
        overlay: getOverlayContent(snapshot),
        status: getStatusPresentation(snapshot),
      });
    const original = presentation(state);
    const layout = new MemoizedGameLayout(original);
    engine.handleKey('ArrowRight');
    expect(engine.snapshot().mouseX).not.toBe(state.mouseX);
    expect(layout.shouldComponentUpdate(presentation())).toBe(false);
    expect(layout.render().props['data-state']).toBe('playing');

    for (const changed of [
      { ...state, score: 100 },
      { ...state, level: 2 },
      { ...state, holdShapeType: 'T' as const },
      { ...state, previewQueue: ['J', 'L'] as const },
      { ...state, gameState: 'PAUSED' as const },
      { ...state, gameState: 'GAMEOVER' as const, statusReason: 'Test loss' },
      { ...state, firstCarveDone: true, noLegalCarveAfterHoldSwap: true },
    ]) {
      expect(
        layout.shouldComponentUpdate(
          presentation({ ...changed, previewQueue: [...changed.previewQueue] }),
        ),
      ).toBe(true);
    }
    const escaping = {
      ...state,
      firstCarveDone: true,
      easyMode: true,
      activePiece: createEscapePiece(),
    };
    const activeLayout = new MemoizedGameLayout(presentation(escaping));
    expect(
      activeLayout.shouldComponentUpdate(
        presentation({ ...escaping, activePiece: { ...escaping.activePiece, timer: 100 } }),
      ),
    ).toBe(false);
    expect(
      activeLayout.shouldComponentUpdate(presentation({ ...escaping, activePiece: null })),
    ).toBe(true);
    const queuedLayout = new MemoizedGameLayout(
      presentation({ ...escaping, queuedPiece: createEscapePiece() }),
    );
    expect(queuedLayout.shouldComponentUpdate(presentation(escaping))).toBe(true);
    expect(layout.shouldComponentUpdate({ ...original, easyMode: true })).toBe(true);
    expect(layout.shouldComponentUpdate({ ...original, downloadStatus: 'preparing' })).toBe(true);
    expect(layout.shouldComponentUpdate({ ...original, downloadStatus: 'failed' })).toBe(true);
    expect(layout.shouldComponentUpdate({ ...original, onCommand: vi.fn() })).toBe(true);
    const withoutTouchHandler = { ...original };
    delete withoutTouchHandler.onCommand;
    expect(layout.shouldComponentUpdate(withoutTouchHandler)).toBe(true);
  });

  it('disables replay downloads while preparing and exposes a retryable failure', () => {
    const busy = ControlList({ downloadStatus: 'preparing' });
    expect(busy.props.children[2].props.disabled).toBe(true);
    expect(busy.props.children[2].props.children).toBe('Preparing replay…');
    expect(busy.props.children[4]).toBeNull();
    const failed = ControlList({ downloadStatus: 'failed' });
    expect(failed.props.children[2].props.disabled).toBe(false);
    expect(failed.props.children[2].props.children).toBe('Download replay');
    expect(failed.props.children[4].props.role).toBe('alert');
    expect(failed.props.children[4].props.children).toBe('Could not prepare replay. Try again.');
    expect(ControlList().props.children[2].props.disabled).toBe(false);
  });

  it('builds deterministic replay downloads', () => {
    const firstRng = createSeededRng(123);
    const secondRng = createSeededRng(123);
    expect(firstRng()).toBe(secondRng());

    const engine = new ReverseTetrisEngine(() => 0.5);
    const state = engine.start(0, { easyMode: true });
    const replay = JSON.parse(
      buildReplayDownload(
        createReplayLog(123, { easyMode: true }, '2026-05-16T00:00:00.000Z'),
        state,
      ),
    );

    expect(replay).toMatchObject({
      version: 3,
      seed: 123,
      options: { easyMode: true },
      snapshot: { easyMode: true, gameState: 'PLAYING' },
    });
    expect(replay.events[0]).toEqual({
      type: 'start',
      t: 0,
      clock: 0,
      seed: 123,
      options: { easyMode: true },
    });
    expect(createReplayLog().events).toEqual([]);
  });

  it('covers start, keyboard, and animation wiring helpers', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const syncState = vi.fn();
    startEngine(engine, syncState);
    startEngine(engine, syncState, () => 200, { easyMode: true });
    expect(syncState).toHaveBeenCalledTimes(2);
    expect(engine.snapshot().easyMode).toBe(true);

    const preventDefault = vi.fn();
    const recordReplayEvent = vi.fn();
    const keyHandler = createKeyDownHandler(engine, syncState, recordReplayEvent);
    keyHandler({ key: 'ArrowLeft', code: 'ArrowLeft', preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(syncState).toHaveBeenCalledTimes(3);
    expect(recordReplayEvent).toHaveBeenCalledWith({
      type: 'key',
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      accepted: true,
    });
    keyHandler({ key: 'q', code: 'KeyQ', preventDefault });
    expect(syncState).toHaveBeenCalledTimes(3);

    const callbacks: Array<(timestamp: number) => void> = [];
    const cancelFrame = vi.fn();
    const stop = startAnimationLoop(
      engine,
      syncState,
      (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancelFrame,
      recordReplayEvent,
    );
    callbacks[0]?.(220);
    stop();
    expect(callbacks).toHaveLength(0);
    expect(cancelFrame).toHaveBeenCalledWith(0);

    const movingEngine = new ReverseTetrisEngine(() => 0.5);
    movingEngine.start();
    moveToValidPlacement(movingEngine);
    movingEngine.handleKey('Enter');
    const movingCallbacks: Array<(timestamp: number) => void> = [];
    const recordTick = vi.fn();
    startAnimationLoop(
      movingEngine,
      vi.fn(),
      (callback) => {
        movingCallbacks.push(callback);
        return movingCallbacks.length;
      },
      vi.fn(),
      recordTick,
    );
    movingCallbacks[0]?.(1000);
    expect(recordTick).toHaveBeenCalledWith(1000);

    const readyCallbacks: Array<(timestamp: number) => void> = [];
    startAnimationLoop(
      new ReverseTetrisEngine(() => 0.5),
      vi.fn(),
      (callback) => {
        readyCallbacks.push(callback);
        return readyCallbacks.length;
      },
      vi.fn(),
    );
    readyCallbacks[0]?.(1000);
    expect(readyCallbacks).toHaveLength(0);
  });

  it('offers resume without changing mode and dispatches touch commands once', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    engine.pause();
    const state = engine.snapshot();
    const content = getOverlayContent(state);
    expect(content).toMatchObject({ visible: true, title: 'PAUSED', buttonLabel: 'RESUME' });
    expect(getStatusPresentation(state)).toEqual({
      text: 'Paused. Resume when ready.',
      tone: 'stable',
      pulsing: false,
    });
    const onStart = vi.fn();
    const overlay = Overlay({
      content,
      paused: true,
      easyMode: false,
      onStart,
      onEasyModeChange: vi.fn(),
    });
    expect(overlay.props.children[2]).toBeNull();
    overlay.props.children[3].props.onClick();
    expect(onStart).toHaveBeenCalledOnce();

    const onCommand = vi.fn();
    const controls = TouchControls({ disabled: false, onCommand });
    const buttons = controls.props.children;
    expect(
      buttons.map((button: { props: { 'aria-label': string } }) => button.props['aria-label']),
    ).toEqual([
      'Move up',
      'Move left',
      'Move down',
      'Move right',
      'Rotate left',
      'Rotate right',
      'Swap or hold',
      'Carve block',
    ]);
    for (const button of buttons) {
      expect(button.props.type).toBe('button');
      button.props.onClick();
    }
    expect(onCommand.mock.calls.map(([key]) => key)).toEqual([
      'ArrowUp',
      'ArrowLeft',
      'ArrowDown',
      'ArrowRight',
      'z',
      'x',
      'c',
      'Enter',
    ]);
    for (const button of TouchControls({ disabled: true, onCommand }).props.children)
      button.props.onClick();
    expect(onCommand).toHaveBeenCalledTimes(8);
  });

  it('gives actionable hold advice before queue advice', () => {
    const state = new ReverseTetrisEngine(() => 0.5).start();
    expect(
      getStatusPresentation({
        ...state,
        firstCarveDone: true,
        currentShapeHasLegalCarve: false,
        holdSwapShapeHasLegalCarve: true,
        queuedPiece: createEscapePiece(),
      }),
    ).toEqual({
      text: 'No carve for this shape. Swap/Hold to continue.',
      tone: 'warning',
      pulsing: true,
    });
    expect(
      getStatusPresentation({
        ...state,
        firstCarveDone: true,
        queuedPiece: createEscapePiece(),
      }).text,
    ).toBe('Queue full! Next carve advances the escape.');
  });
});

function createCanvasRefs(canvas: HTMLCanvasElement | null = null): CanvasRefs {
  return {
    game: { current: canvas },
    hold: { current: canvas },
    nextOne: { current: canvas },
    nextTwo: { current: canvas },
  };
}

function createEscapePiece() {
  return {
    type: 'I' as const,
    path: [{ x: 0, y: 0, r: 0 as const }],
    pathIndex: 0,
    timer: 0,
    color: '#fff',
    startCells: [],
  };
}

function createCanvas() {
  return {
    height: 720,
    width: 300,
    getContext: () => ({
      beginPath() {},
      clearRect() {},
      fillRect() {},
      lineTo() {},
      moveTo() {},
      restore() {},
      save() {},
      stroke() {},
      strokeRect() {},
      translate() {},
    }),
  } as unknown as HTMLCanvasElement;
}
