import { describe, expect, it } from 'vitest';

import {
  COLS,
  getCells,
  getSrsRotationCandidates,
  type PathStep,
  ReverseTetrisEngine,
  ROWS,
  type Rotation,
  rotateLeft,
  rotateRight,
  SHAPES,
  type ShapeType,
  VISIBLE_TOP,
} from '../src/game';
import { moveToValidPlacement } from './game-helpers';

describe('cursor and animation invariants', () => {
  it('preserves movement bounds and first legal SRS kick for every shape and rotation', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    const { state } = engine as unknown as {
      state: {
        board: number[][];
        currentShapeType: ShapeType;
        currentRotation: Rotation;
        mouseX: number;
        mouseY: number;
      };
    };
    state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const isVisible = (type: ShapeType, step: PathStep) =>
      getCells(type, step.x, step.y, step.r).every(
        (cell) => cell.x >= 0 && cell.x < COLS && cell.y >= VISIBLE_TOP && cell.y < ROWS,
      );

    for (const type of Object.keys(SHAPES) as ShapeType[]) {
      for (const r of [0, 1, 2, 3] as const) {
        const cells = getCells(type, 0, 0, r);
        const left = 0 - Math.min(...cells.map((cell) => cell.x));
        const right = COLS - 1 - Math.max(...cells.map((cell) => cell.x));
        const top = VISIBLE_TOP - Math.min(...cells.map((cell) => cell.y));
        const bottom = ROWS - 1 - Math.max(...cells.map((cell) => cell.y));
        for (const x of [left, 4, right]) {
          for (const y of [top, 15, bottom]) {
            const movements = [
              ['ArrowLeft', x - 1, y],
              ['ArrowRight', x + 1, y],
              ['ArrowUp', x, y - 1],
              ['ArrowDown', x, y + 1],
            ] as const;
            const candidates: { key: string; steps: PathStep[] }[] = movements.map(
              ([key, nextX, nextY]) => ({
                key,
                steps: [{ x: nextX, y: nextY, r }],
              }),
            );
            for (const [key, nextRotation] of [
              ['z', rotateLeft(r)],
              ['x', rotateRight(r)],
            ] as const) {
              candidates.push({
                key,
                steps: getSrsRotationCandidates(type, x, y, r, nextRotation),
              });
            }
            for (const { key, steps } of candidates) {
              state.currentShapeType = type;
              state.currentRotation = r;
              state.mouseX = x;
              state.mouseY = y;
              const expected = steps.find((step) => isVisible(type, step));
              expect(engine.handleKey(key), `${type} (${x}, ${y}, ${r}) ${key}`).toBe(
                Boolean(expected),
              );
              expect([state.mouseX, state.mouseY, state.currentRotation]).toEqual(
                expected ? [expected.x, expected.y, expected.r] : [x, y, r],
              );
            }
          }
        }
      }
    }
  });

  it('keeps the carving target unchanged through fractional ticks, queue promotion and completion', () => {
    for (const easyMode of [false, true]) {
      const engine = new ReverseTetrisEngine(() => 0.5);
      engine.start(1000.1, { easyMode });
      for (let carve = 0; carve < 2; carve++) {
        moveToValidPlacement(engine);
        expect(engine.handleKey('Enter')).toBe(true);
      }
      moveToValidPlacement(engine);
      const before = engine.snapshot();
      expect(before.ghostValid).toBe(true);
      for (const timestamp of [1400.1, 1800.1, 100000.1, 200000.1]) {
        engine.tick(timestamp);
        const after = engine.snapshot();
        expect(after.board).toEqual(before.board);
        expect(after.ghostValid).toBe(before.ghostValid);
        expect(after.ghostPath).toEqual(before.ghostPath);
        expect([after.mouseX, after.mouseY, after.currentRotation, after.currentShapeType]).toEqual(
          [before.mouseX, before.mouseY, before.currentRotation, before.currentShapeType],
        );
      }
      expect(engine.snapshot().gameState).toBe(easyMode ? 'PLAYING' : 'GAMEOVER');
      if (easyMode) expect(engine.snapshot().activePiece).toBeNull();
    }
  });
});
