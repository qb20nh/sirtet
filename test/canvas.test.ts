import { describe, expect, it } from 'vitest';

import { drawGame, drawShapePreview } from '../src/canvas';
import { BLOCK_SIZE, ReverseTetrisEngine, SHAPES, VISIBLE_TOP } from '../src/game';
import { moveToValidPlacement } from './game-helpers';

type RecordedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RecordingContext = CanvasRenderingContext2D & {
  calls: string[];
  fillRects: RecordedRect[];
  strokeRects: string[];
  strokes: string[];
};

describe('canvas drawing helpers', () => {
  it('draws the board, baseline, and carve cursor outline', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    moveToValidPlacement(engine);
    const state = engine.snapshot();

    drawGame(context, { width: 300, height: 720 }, state);

    expect(context.calls).toContain('clearRect');
    expect(context.calls).toContain('save');
    expect(context.calls).toContain('translate');
    expect(context.calls.filter((call) => call === 'fillRect').length).toBeGreaterThan(40);
    expect(context.strokes).not.toContain('rgba(34, 197, 94, 0.3)');
    expect(context.strokeRects).toContain(
      state.currentShapeType ? SHAPES[state.currentShapeType].color : '',
    );
    expect(context.calls).toContain('restore');
  });

  it('draws invalid carve cursors as gray outlines', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    moveToValidPlacement(engine);
    const state = { ...engine.snapshot(), ghostValid: false };

    drawGame(context, { width: 300, height: 720 }, state);

    expect(context.strokeRects).toContain('#94a3b8');
  });

  it('does not render blocks from hidden rows', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    const state = engine.snapshot();
    const board = state.board.map((row, rowIndex) =>
      row.map(() => (rowIndex === VISIBLE_TOP - 1 ? 1 : 0)),
    );

    drawGame(context, { width: 300, height: 720 }, { ...state, board });

    expect(context.fillRects.some((rect) => rect.y < VISIBLE_TOP * BLOCK_SIZE)).toBe(false);
  });

  it('does not render hidden queued, active, or cursor cells', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);
    const state = {
      ...engine.start(),
      activePiece: {
        type: 'O' as const,
        path: [{ x: 0, y: VISIBLE_TOP - 2, r: 0 as const }],
        pathIndex: 0,
        timer: 0,
        color: '#fff',
        startCells: [],
      },
      currentShapeType: 'O' as const,
      ghostValid: true,
      mouseX: 4,
      mouseY: VISIBLE_TOP - 2,
      queuedPiece: {
        type: 'I' as const,
        path: [{ x: 0, y: 0, r: 0 as const }],
        pathIndex: 0,
        timer: 0,
        color: '#fff',
        startCells: [
          { x: 0, y: VISIBLE_TOP - 1 },
          { x: 0, y: VISIBLE_TOP },
        ],
      },
    };

    drawGame(context, { width: 300, height: 720 }, state);

    expect(context.fillRects.some((rect) => rect.y < VISIBLE_TOP * BLOCK_SIZE)).toBe(false);
    expect(context.calls).toContain('strokeRect');
  });

  it('draws and clears mini shape previews', () => {
    const context = createRecordingContext();

    drawShapePreview('T', context, { width: 80, height: 80 });
    expect(context.calls.filter((call) => call === 'fillRect')).toHaveLength(4);
    expect(context.globalAlpha).toBe(1);

    context.calls = [];
    drawShapePreview('I', context, { width: 80, height: 80 }, true);
    expect(context.calls.filter((call) => call === 'fillRect')).toHaveLength(4);
    expect(context.globalAlpha).toBe(1);

    context.calls = [];
    drawShapePreview(null, context, { width: 80, height: 80 }, true);
    expect(context.calls).toEqual(['clearRect']);
  });

  it('draws queued and active escaping pieces', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    moveToValidPlacement(engine);
    engine.handleKey('Enter');
    moveToValidPlacement(engine);
    engine.handleKey('Enter');

    drawGame(context, { width: 300, height: 720 }, engine.snapshot());

    expect(context.calls).toContain('strokeRect');
    expect(context.shadowBlur).toBe(0);
  });

  it('skips ghost drawing outside active play', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);

    drawGame(context, { width: 300, height: 720 }, engine.snapshot());

    expect(context.calls).toContain('restore');
  });
});

function createRecordingContext() {
  return {
    calls: [] as string[],
    fillRects: [] as RecordedRect[],
    fillStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
    strokeRects: [] as string[],
    strokes: [] as string[],
    strokeStyle: '',
    beginPath() {
      this.calls.push('beginPath');
    },
    clearRect() {
      this.calls.push('clearRect');
    },
    fillRect(x = 0, y = 0, width = 0, height = 0) {
      this.calls.push('fillRect');
      this.fillRects.push({ x, y, width, height });
    },
    lineTo() {
      this.calls.push('lineTo');
    },
    moveTo() {
      this.calls.push('moveTo');
    },
    restore() {
      this.calls.push('restore');
    },
    save() {
      this.calls.push('save');
    },
    stroke() {
      this.calls.push('stroke');
      this.strokes.push(this.strokeStyle);
    },
    strokeRect() {
      this.calls.push('strokeRect');
      this.strokeRects.push(this.strokeStyle);
    },
    translate() {
      this.calls.push('translate');
    },
  } as unknown as RecordingContext;
}
