import { describe, expect, it, vi } from 'vitest';

import {
  buildReplayDownload,
  type CanvasRefs,
  ControlList,
  createKeyDownHandler,
  createReplayLog,
  createSeededRng,
  drawCanvases,
  GameLayout,
  Metric,
  Overlay,
  PanelCanvas,
  StatusBlock,
  startAnimationLoop,
  startEngine,
} from '../src/App';
import { ReverseTetrisEngine } from '../src/game';
import { CONTROL_HINTS, getOverlayContent, getStatusPresentation } from '../src/ui';

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
        queuedPiece: {
          type: 'I',
          path: [{ x: 0, y: 0, r: 0 }],
          pathIndex: 0,
          timer: 0,
          color: '#fff',
          startCells: [],
        },
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
        queuedPiece: {
          type: 'I',
          path: [{ x: 0, y: 0, r: 0 }],
          pathIndex: 0,
          timer: 0,
          color: '#fff',
          startCells: [],
        },
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
      onEasyModeChange: vi.fn(),
      onStart: vi.fn(),
    });

    expect(vnode.type).toBe('main');
    expect(CONTROL_HINTS.map((hint) => hint.keys)).toEqual([
      'WASD / Arrows',
      'Z / X',
      'C / Shift',
      'Space / Enter',
    ]);
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

    drawCanvases(state, refs);
    expect(refs.game.current?.getContext('2d')).toBeTruthy();
    drawCanvases(state, createCanvasRefs(null));
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
      version: 1,
      seed: 123,
      options: { easyMode: true },
      snapshot: { easyMode: true, gameState: 'PLAYING' },
    });
    expect(replay.events[0]).toEqual({
      type: 'start',
      t: 0,
      seed: 123,
      options: { easyMode: true },
    });
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
    expect(cancelFrame).toHaveBeenCalledWith(2);
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
