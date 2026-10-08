import { describe, expect, it } from 'vitest';
import {
  type Board,
  COLS,
  createInitialBoard,
  findEscapePath,
  getCells,
  getSrsRotationCandidates,
  hasLegalCarvePlacement,
  type PathStep,
  ROWS,
  type Rotation,
  SHAPES,
  type ShapeType,
  SPAWN_X,
  VISIBLE_TOP,
} from '../src/game';

// Deliberately simple reference search: explicit cells, string keys, and full paths.
// It checks the ordering contract independently of the optimized row-bit search.
function referencePath(board: Board, type: ShapeType, start: PathStep): PathStep[] | null {
  const carvedCells = getCells(type, start.x, start.y, start.r);
  const queue = [[start]];
  const key = (step: PathStep) => `${step.x},${step.y},${step.r}`;
  const seen = new Set([key(start)]);
  const fits = (step: PathStep) => {
    if (step.y <= VISIBLE_TOP && (step.x !== SPAWN_X || step.r !== 0)) return false;
    return getCells(type, step.x, step.y, step.r).every(
      (cell) =>
        cell.x >= 0 &&
        cell.x < COLS &&
        cell.y < ROWS &&
        (cell.y < 0 ||
          board[cell.y][cell.x] === 0 ||
          carvedCells.some((carved) => carved.x === cell.x && carved.y === cell.y)),
    );
  };

  for (let index = 0; index < queue.length && index < 2000; index++) {
    const path = queue[index];
    const current = path[path.length - 1];
    if (
      current.x === SPAWN_X &&
      current.r === 0 &&
      getCells(type, current.x, current.y, current.r).every((cell) => cell.y < 0)
    ) {
      return path;
    }

    const towardSpawn = current.x < SPAWN_X ? 1 : -1;
    const moves: PathStep[] = [
      { ...current, y: current.y - 1 },
      { ...current, x: current.x + towardSpawn },
      { ...current, x: current.x - towardSpawn },
    ].filter(fits);
    const rotations = [(current.r + 3) % 4, current.r, (current.r + 1) % 4] as Rotation[];
    rotations.sort((left, right) => Math.min(left, 4 - left) - Math.min(right, 4 - right));
    for (const rotation of rotations) {
      const candidate = getSrsRotationCandidates(
        type,
        current.x,
        current.y,
        current.r,
        rotation,
      ).find(fits);
      if (candidate) moves.push(candidate);
    }
    for (const next of moves) {
      if (seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push([...path, next]);
    }
  }
  return null;
}

function createBoards(): Board[] {
  const empty = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const blocked = empty.map((row) => row.map(() => 1));
  const boards = [empty, blocked, createInitialBoard()];
  let random = 619;
  for (let sample = 0; sample < 8; sample++) {
    boards.push(
      empty.map((row, y) =>
        row.map(() => {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          return y > 3 && random / 0x100000000 < 0.1 + sample * 0.1 ? 1 : 0;
        }),
      ),
    );
  }
  return boards;
}

describe('escape search equivalence', () => {
  it('preserves exact ordered paths across shapes, rotations, obstacles, and board edges', () => {
    const positions = [
      { x: 0, y: 18 },
      { x: SPAWN_X, y: 18 },
      { x: COLS - 1, y: 18 },
      { x: -1, y: 5 },
      { x: COLS, y: 5 },
      { x: SPAWN_X - 1, y: VISIBLE_TOP },
      { x: SPAWN_X, y: -3 },
      { x: SPAWN_X, y: ROWS },
    ];
    for (const board of createBoards()) {
      for (const type of Object.keys(SHAPES) as ShapeType[]) {
        for (const r of [0, 1, 2, 3] as Rotation[]) {
          for (const position of positions) {
            const start = { ...position, r };
            expect(findEscapePath(board, type, start.x, start.y, r)).toEqual(
              referencePath(board, type, start),
            );
          }
        }
      }
    }
  });

  it('preserves nonzero obstacles and searches from far above the board', () => {
    const blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(2));
    expect(findEscapePath(blocked, 'O', SPAWN_X, 18, 0)).toBeNull();
    for (const type of Object.keys(SHAPES) as ShapeType[]) {
      for (const r of [0, 1, 2, 3] as Rotation[]) {
        const start = { x: SPAWN_X, y: -100, r };
        expect(findEscapePath(blocked, type, start.x, start.y, start.r)).toEqual(
          referencePath(blocked, type, start),
        );
      }
    }
  });

  it('isolates scratch state between legality probes and unrelated full paths', () => {
    const board = createInitialBoard();
    const savedPath = findEscapePath(board, 'O', 0, 18, 0);
    const expectedPath = referencePath(board, 'O', { x: 0, y: 18, r: 0 });
    const empty = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    for (const type of Object.keys(SHAPES) as ShapeType[]) {
      expect(hasLegalCarvePlacement(empty, type)).toBe(false);
      expect(hasLegalCarvePlacement(board, type)).toBe(true);
      const start = { x: -1, y: 5, r: 1 } as const;
      expect(findEscapePath(empty, type, start.x, start.y, start.r)).toEqual(
        referencePath(empty, type, start),
      );
      const farAbove = { x: SPAWN_X, y: -1e12, r: 0 } as const;
      expect(findEscapePath(empty, type, farAbove.x, farAbove.y, farAbove.r)).toEqual([farAbove]);
      // Initial states remain unchecked even when they start beside the spawn
      // gate; legality probes must not change the public path's first move.
      const besideGate = { x: SPAWN_X - 1, y: VISIBLE_TOP, r: 0 } as const;
      expect(findEscapePath(empty, type, besideGate.x, besideGate.y, besideGate.r)).toEqual(
        referencePath(empty, type, besideGate),
      );
      expect(findEscapePath(board, 'O', 0, 18, 0)).toEqual(expectedPath);
      expect(savedPath).toEqual(expectedPath);
    }
  });

  it('leaves the board untouched and returns independent path objects', () => {
    const board = createInitialBoard();
    const before = board.map((row) => [...row]);
    const path = findEscapePath(board, 'O', 0, 18, 0);
    expect(path).not.toBeNull();
    const firstPath = path?.map((step) => ({ ...step }));
    if (path) path[0].x = COLS;
    expect(findEscapePath(board, 'O', 0, 18, 0)).toEqual(firstPath);
    expect(board).toEqual(before);
  });
});
