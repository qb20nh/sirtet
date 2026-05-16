import { describe, expect, it } from 'vitest';

import { drawGame, drawShapePreview } from '../src/canvas';
import { ReverseTetrisEngine } from '../src/game';
import { moveToValidPlacement } from './game-helpers';

describe('canvas drawing helpers', () => {
  it('draws the board, baseline, and ghost preview', () => {
    const context = createRecordingContext();
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    moveToValidPlacement(engine);

    drawGame(context, { width: 300, height: 720 }, engine.snapshot());

    expect(context.calls).toContain('clearRect');
    expect(context.calls).toContain('save');
    expect(context.calls).toContain('translate');
    expect(context.calls.filter((call) => call === 'fillRect').length).toBeGreaterThan(40);
    expect(context.calls).toContain('restore');
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
    fillStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
    strokeStyle: '',
    beginPath() {
      this.calls.push('beginPath');
    },
    clearRect() {
      this.calls.push('clearRect');
    },
    fillRect() {
      this.calls.push('fillRect');
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
    },
    strokeRect() {
      this.calls.push('strokeRect');
    },
    translate() {
      this.calls.push('translate');
    },
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
}
