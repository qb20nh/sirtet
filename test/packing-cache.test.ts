import { describe, expect, it } from 'vitest';
import {
  BASELINE,
  COLS,
  createInitialBoard,
  findLegalCarvePath,
  type GameSnapshot,
  isBoardValid,
  ReverseTetrisEngine,
  ROWS,
  type Rotation,
  type ShapeType,
} from '../src/game';

function stateOf(engine: ReverseTetrisEngine): GameSnapshot {
  return (engine as unknown as { state: GameSnapshot }).state;
}

function placeCursor(
  engine: ReverseTetrisEngine,
  type: ShapeType,
  x: number,
  y: number,
  rotation: Rotation = 0,
): boolean {
  Object.assign(stateOf(engine), {
    currentShapeType: type,
    currentRotation: rotation,
    mouseX: x,
    mouseY: y,
  });
  return engine.validateGhost();
}

function startEngine(): ReverseTetrisEngine {
  const engine = new ReverseTetrisEngine(() => 0.5);
  engine.start();
  return engine;
}

describe('packing validity across board changes', () => {
  it('reconsiders a cached rejection after a disjoint legal carve', () => {
    const engine = startEngine();
    // This J can escape, but its carve would initially leave an invalid remainder.
    expect(placeCursor(engine, 'J', 2, 19, 3)).toBe(false);
    expect(placeCursor(engine, 'O', 0, 18)).toBe(true);
    expect(engine.handleKey(' ')).toBe(true);
    // The O removes no J cells or support cells, yet changes global packing validity.
    expect(placeCursor(engine, 'J', 2, 19, 3)).toBe(true);
    expect(engine.snapshot().piecesCarved).toBe(1);
  });

  it('detects disconnected blocks and changed fill after a cached valid placement', () => {
    const engine = startEngine();
    expect(placeCursor(engine, 'O', 0, 18)).toBe(true);
    stateOf(engine).board[5][5] = 1;
    expect(engine.validateGhost()).toBe(false);
    stateOf(engine).board[5][5] = 0;
    expect(engine.validateGhost()).toBe(true);
    stateOf(engine).board[18][0] = 0;
    expect(engine.validateGhost()).toBe(false);
  });

  it('rechecks placements after shifting the board and restarting', () => {
    const engine = startEngine();
    const board = createInitialBoard();
    for (let y = 18; y < BASELINE; y++) {
      board[y][0] = 0;
      board[y][1] = 0;
    }
    stateOf(engine).board = board;
    expect(placeCursor(engine, 'O', 2, 18)).toBe(true);
    expect(placeCursor(engine, 'O', 0, BASELINE)).toBe(true);
    expect(engine.handleKey(' ')).toBe(true);
    const shifted = engine.snapshot();
    expect(shifted.board[17][2]).toBe(1);
    expect(placeCursor(engine, 'O', 2, 18)).toBe(
      Boolean(findLegalCarvePath(shifted.board, 'O', 2, 18, 0)),
    );
    engine.start();
    expect(placeCursor(engine, 'O', 0, 18)).toBe(true);
    expect(engine.snapshot().board).toEqual(createInitialBoard());
    expect(engine.snapshot().piecesCarved).toBe(0);
  });

  it('retains legal packing of tall central masses without changing the board', () => {
    for (const top of [6, 10, 14, 15]) {
      const board = Array.from({ length: ROWS }, (_, y) =>
        Array.from({ length: COLS }, (_, x) => (y >= 18 || (y >= top && x >= 2 && x <= 7) ? 1 : 0)),
      );
      const before = board.map((row) => [...row]);
      expect(isBoardValid(board, [])).toBe(true);
      expect(board).toEqual(before);
    }
  });
});
