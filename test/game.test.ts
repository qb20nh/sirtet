import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';

import {
  BASELINE,
  COLS,
  createInitialBoard,
  findEscapePath,
  findLegalCarvePath,
  getCells,
  getSrsRotationCandidates,
  hasLegalCarvePlacement,
  hasNormalTetrisLandingCollision,
  isBoardValid,
  isFullyInsideFilled,
  isOutOfBounds,
  type PathStep,
  ReverseTetrisEngine,
  ROWS,
  type Rotation,
  rotateLeft,
  rotateRight,
  type ShapeType,
  SPAWN_X,
  shouldPreventKey,
  VISIBLE_TOP,
} from '../src/game';
import { moveToValidPlacement } from './game-helpers';

type TestEscapePiece = NonNullable<ReturnType<ReverseTetrisEngine['snapshot']>['activePiece']>;
type TestCarveState = {
  activePiece: TestEscapePiece | null;
  board: number[][];
  currentRotation: Rotation;
  currentShapeHasLegalCarve: boolean;
  currentShapeType: ShapeType | null;
  gameState: string;
  ghostPath: PathStep[] | null;
  ghostValid: boolean;
  holdShapeType: ShapeType | null;
  holdSwapShapeHasLegalCarve: boolean;
  mouseX: number;
  mouseY: number;
  noLegalCarveAfterHoldSwap: boolean;
  previewQueue: ShapeType[];
  queuedPiece: TestEscapePiece | null;
};

const ALL_SHAPE_TYPES: ShapeType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

describe('ReverseTetrisEngine', () => {
  it('initializes the buried board with the original baseline mass', () => {
    const board = createInitialBoard();

    expect(board).toHaveLength(ROWS);
    expect(board[0].every((cell) => cell === 0)).toBe(true);
    expect(board[BASELINE - 4].every((cell) => cell === 0)).toBe(true);
    expect(board[BASELINE - 3].every((cell) => cell === 1)).toBe(true);
    expect(board[ROWS - 1].every((cell) => cell === 1)).toBe(true);
  });

  it('starts with S and Z delayed in the first bag', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const state = engine.start(100);

    expect(state.easyMode).toBe(false);
    expect([state.currentShapeType, ...state.previewQueue]).not.toContain('S');
    expect([state.currentShapeType, ...state.previewQueue]).not.toContain('Z');
    expect(state.gameState).toBe('PLAYING');
    expect(state.mouseX).toBe(4);
    expect(state.mouseY).toBe(BASELINE);
  });

  it('does not queue matching shapes across bag refills', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    const internals = engine as unknown as {
      state: {
        currentShapeType: ShapeType | null;
        isFirstBag: boolean;
        previewQueue: ShapeType[];
        shapeBag: ShapeType[];
      };
      takePreviewShape: () => ShapeType;
    };

    internals.state.currentShapeType = 'L';
    internals.state.previewQueue = ['I', 'Z'];
    internals.state.shapeBag = [];
    internals.state.isFirstBag = false;

    expect(internals.takePreviewShape()).toBe('I');
    expect(internals.state.previewQueue[0]).toBe('Z');
    expect(internals.state.previewQueue[1]).not.toBe('Z');
  });

  it('moves, rotates, swaps, and prevents only game keys', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const start = engine.start();

    expect(new ReverseTetrisEngine().handleKey('q')).toBe(false);
    expect(engine.handleKey('q')).toBe(false);
    expect(engine.handleKey('ArrowLeft')).toBe(true);
    expect(engine.snapshot().mouseX).toBe(start.mouseX - 1);
    expect(engine.handleKey('w')).toBe(true);
    expect(engine.handleKey('s')).toBe(true);
    expect(engine.handleKey('z')).toBe(true);
    expect(engine.snapshot().currentRotation).toBe(rotateLeft(start.currentRotation));
    expect(engine.handleKey('x')).toBe(true);
    expect(engine.snapshot().currentRotation).toBe(start.currentRotation);
    expect(engine.handleKey('c')).toBe(true);
    expect(engine.snapshot().holdShapeType).toBe(start.currentShapeType);
    expect(engine.handleKey('c')).toBe(true);
    const swapped = engine.snapshot();
    expect(swapped.currentShapeType).toBe(start.currentShapeType);
    expect(swapped.currentShapeHasLegalCarve).toBe(
      hasLegalCarvePlacement(swapped.board, swapped.currentShapeType),
    );
    expect(swapped.holdSwapShapeHasLegalCarve).toBe(
      hasLegalCarvePlacement(
        swapped.board,
        swapped.holdShapeType ?? swapped.previewQueue[0] ?? null,
      ),
    );
    const shiftEngine = new ReverseTetrisEngine(() => 0.5);
    shiftEngine.start();
    expect(shiftEngine.handleKey('Shift')).toBe(true);
    expect(shouldPreventKey('ArrowUp')).toBe(true);
    expect(shouldPreventKey('q')).toBe(false);
    expect(shouldPreventKey('Ignored', 'Space')).toBe(true);
    expect(engine.handleKey('Ignored', 'Space')).toBe(false);
  });

  it('uses guideline SRS rotation states and kick tables', () => {
    expectCells(getCells('S', 0, 0, 0), [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ]);
    expectCells(getCells('Z', 0, 0, 0), [
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expectCells(getCells('S', 0, 0, 1), [
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expectCells(getCells('S', 0, 0, 2), [
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]);
    expectCells(getCells('S', 0, 0, 3), [
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    expectCells(getCells('Z', 0, 0, 1), [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
    ]);
    expectCells(getCells('Z', 0, 0, 2), [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expectCells(getCells('Z', 0, 0, 3), [
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
    ]);
    expectCells(getCells('I', 0, 0, 2), [
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expectCells(getCells('I', 0, 0, 3), [
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);

    expect(getSrsRotationCandidates('T', 5, 10, 0, 1)).toEqual([
      { x: 5, y: 10, r: 1 },
      { x: 4, y: 10, r: 1 },
      { x: 4, y: 9, r: 1 },
      { x: 5, y: 12, r: 1 },
      { x: 4, y: 12, r: 1 },
    ]);
    expect(getSrsRotationCandidates('I', 5, 10, 0, 1)).toEqual([
      { x: 5, y: 10, r: 1 },
      { x: 3, y: 10, r: 1 },
      { x: 6, y: 10, r: 1 },
      { x: 3, y: 11, r: 1 },
      { x: 6, y: 8, r: 1 },
    ]);
    expect(getSrsRotationCandidates('O', 5, 10, 0, 1)).toEqual([{ x: 5, y: 10, r: 1 }]);
    expect(getSrsRotationCandidates('T', 5, 10, 0, 2)).toEqual([]);
  });

  it('carves a valid placement, scores, then fails if no next piece is queued', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    moveToValidPlacement(engine);
    expect(engine.snapshot().ghostValid).toBe(true);

    expect(engine.handleKey('Enter')).toBe(true);
    const carved = engine.snapshot();
    expect(carved.score).toBe(100);
    expect(carved.piecesCarved).toBe(1);
    expect(carved.firstCarveDone).toBe(true);
    expect(carved.currentShapeHasLegalCarve).toBe(
      hasLegalCarvePlacement(carved.board, carved.currentShapeType),
    );
    expect(carved.holdSwapShapeHasLegalCarve).toBe(
      hasLegalCarvePlacement(carved.board, carved.holdShapeType ?? carved.previewQueue[0] ?? null),
    );
    const activePiece = carved.activePiece;
    expect(activePiece).not.toBeNull();
    if (!activePiece) throw new Error('Expected an active escape piece.');
    expectPathReachesSpawnAndExits(activePiece.type, activePiece.path);

    let time = 0;
    for (let guard = 0; guard < 80 && engine.snapshot().gameState === 'PLAYING'; guard++) {
      time += carved.escapeStepDelay;
      engine.tick(time);
    }

    expect(engine.snapshot().gameState).toBe('GAMEOVER');
    expect(engine.snapshot().statusReason).toContain('Too slow');
  });

  it('randomizes horizontal and rotation playback timing while upward movement stays constant', () => {
    const first = carveRotatedEscapePiece(createTestRng(123));
    const second = carveRotatedEscapePiece(createTestRng(123));
    const different = carveRotatedEscapePiece(createTestRng(456));
    const lateSpin = carveRotatedEscapePiece(createTestRng(2));

    expect(first.path).toEqual(second.path);
    expect(first.pathTimes).toEqual(second.pathTimes);
    expect({ path: first.path, pathTimes: first.pathTimes }).not.toEqual({
      path: different.path,
      pathTimes: different.pathTimes,
    });
    expect(first.pathTimes).toHaveLength(first.path.length);
    expectPathReachesSpawnAndExits(first.type, first.path);
    expectPathUsesSingleActionSteps(first.type, first.path);
    expectNonUpwardStepBeforeSpawnGate(first.path, (step, previous) => step.x !== previous.x);
    expectNonUpwardStepBeforeSpawnGate(first.path, (step, previous) => step.r !== previous.r);
    expectUpwardStepsUseConstantBeats(first.path, first.pathTimes);
    expectNonUpwardStepUsesFractionalBeat(first.path, first.pathTimes, (step, previous) => {
      return step.x !== previous.x || step.r !== previous.r;
    });
    expectNonUpwardStepUsesFractionalBeat(first.path, first.pathTimes, (step, previous) => {
      return step.r !== previous.r;
    });
    expectPlaybackStepsHaveReadableSpacing(lateSpin.pathTimes);
  });

  it('keeps playing in easy mode when a piece reaches the top without a queue', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start(0, { easyMode: true });
    moveToValidPlacement(engine);
    expect(engine.handleKey('Enter')).toBe(true);
    const carved = engine.snapshot();
    const activePiece = carved.activePiece;
    expect(carved.easyMode).toBe(true);
    expect(activePiece).not.toBeNull();
    if (!activePiece) throw new Error('Expected an active escape piece.');

    engine.tick(activePiece.path.length * carved.escapeStepDelay + 1);
    const afterEscape = engine.snapshot();
    expect(afterEscape.gameState).toBe('PLAYING');
    expect(afterEscape.activePiece).toBeNull();
    expect(afterEscape.currentShapeType).not.toBeNull();

    moveToValidPlacement(engine);
    expect(engine.handleKey('Enter')).toBe(true);
    expect(engine.snapshot().piecesCarved).toBe(2);
  });

  it('allows easy mode to end only when no current or hold-swap carve is legal', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start(0, { easyMode: true });
    const internals = engine as unknown as {
      state: TestCarveState & { easyMode: boolean; statusReason: string };
    };

    expect(engine.endStuckEasyModeGame()).toBe(false);
    internals.state.noLegalCarveAfterHoldSwap = true;
    expect(engine.endStuckEasyModeGame()).toBe(true);
    expect(internals.state.gameState).toBe('GAMEOVER');
    expect(internals.state.statusReason).toBe('No legal carve available in easy mode.');
    expect(internals.state.noLegalCarveAfterHoldSwap).toBe(false);
    expect(engine.endStuckEasyModeGame()).toBe(false);

    const normalEngine = new ReverseTetrisEngine(() => 0.5);
    normalEngine.start(0, { easyMode: false });
    const normalInternals = normalEngine as unknown as {
      state: TestCarveState;
    };
    normalInternals.state.noLegalCarveAfterHoldSwap = true;
    expect(normalEngine.endStuckEasyModeGame()).toBe(false);
    expect(normalEngine.snapshot().gameState).toBe('PLAYING');
  });

  it('handles idle ticks, invalid carves, and bounded movement', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);

    expect(engine.tick(100)).toBe(false);
    engine.start();
    expect(engine.tick(100)).toBe(false);
    expect(engine.handleKey('Enter')).toBe(false);

    for (let guard = 0; guard < 20; guard++) {
      engine.handleKey('ArrowLeft');
    }

    const leftEdge = engine.snapshot().mouseX;
    expect(engine.handleKey('ArrowLeft')).toBe(false);
    expect(engine.snapshot().mouseX).toBe(leftEdge);

    for (let guard = 0; guard < 40; guard++) {
      engine.handleKey('ArrowUp');
    }

    const topState = engine.snapshot();
    const topCells = getCells(
      topState.currentShapeType,
      topState.mouseX,
      topState.mouseY,
      topState.currentRotation,
    );
    expect(topCells).toEqual(
      expect.arrayContaining([expect.objectContaining({ y: expect.any(Number) })]),
    );
    expect(topCells.every((cell) => cell.y >= VISIBLE_TOP)).toBe(true);
    expect(engine.handleKey('ArrowUp')).toBe(false);

    for (let guard = 0; guard < 4; guard++) {
      engine.handleKey('x');
      const rotated = engine.snapshot();
      expect(
        getCells(
          rotated.currentShapeType,
          rotated.mouseX,
          rotated.mouseY,
          rotated.currentRotation,
        ).every((cell) => cell.y >= VISIBLE_TOP),
      ).toBe(true);
    }
  });

  it('rejects carves that could still fall in normal tetris', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    const internals = engine as unknown as {
      state: TestCarveState;
      carve: () => boolean;
      validateGhost: () => boolean;
    };

    primeCarveState(internals.state, createSideSupportedOnlyBoard(), BASELINE - 3);

    expect(internals.validateGhost()).toBe(false);
    expect(internals.state.ghostValid).toBe(false);
    expect(internals.carve()).toBe(false);
  });

  it('reports unsolvable carve states after checking hold-swap candidates', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    const internals = engine as unknown as {
      state: TestCarveState;
      refreshCarveAvailability: () => void;
    };

    internals.state.board = createSideSupportedOnlyBoard();
    internals.state.currentShapeType = 'O';
    internals.state.holdShapeType = 'I';
    internals.state.previewQueue = ['T', 'L'];
    internals.refreshCarveAvailability();
    expect(internals.state.currentShapeHasLegalCarve).toBe(false);
    expect(internals.state.holdSwapShapeHasLegalCarve).toBe(false);
    expect(internals.state.noLegalCarveAfterHoldSwap).toBe(true);

    internals.state.board = createInitialBoard();
    internals.state.currentShapeType = null;
    internals.state.holdShapeType = null;
    internals.state.previewQueue = ['O', 'I'];
    internals.refreshCarveAvailability();
    expect(internals.state.currentShapeHasLegalCarve).toBe(false);
    expect(internals.state.holdSwapShapeHasLegalCarve).toBe(true);
    expect(internals.state.noLegalCarveAfterHoldSwap).toBe(false);

    internals.state.currentShapeType = 'O';
    internals.refreshCarveAvailability();
    expect(internals.state.currentShapeHasLegalCarve).toBe(true);
  });

  it('preserves shifted escape pieces and win state internals', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    const started = engine.start();
    const activePiece = createEscapePiece('I');
    const queuedPiece = createEscapePiece('O');
    const internals = engine as unknown as {
      state: {
        activePiece: typeof activePiece | null;
        board: number[][];
        gameState: string;
        mouseY: number;
        queuedPiece: typeof queuedPiece | null;
        statusReason: string;
      };
      applyBoardShift: (shift: number, newPiece: typeof activePiece) => void;
      carve: () => boolean;
      performSwap: () => boolean;
      winGame: () => void;
    };

    internals.state.gameState = 'READY';
    expect(internals.performSwap()).toBe(false);

    internals.state.activePiece = null;
    internals.state.queuedPiece = null;
    internals.applyBoardShift(1, activePiece);
    expect(internals.state.mouseY).toBe(started.mouseY - 1);

    internals.state.activePiece = activePiece;
    internals.state.queuedPiece = queuedPiece;
    internals.applyBoardShift(2, queuedPiece);
    expect(activePiece.path[0].y).toBe(-2);
    expect(activePiece.startCells[0].y).toBe(-2);
    expect(queuedPiece.path[0].y).toBe(0);

    internals.winGame();
    expect(internals.state.gameState).toBe('WIN');
    expect(internals.state.statusReason).toContain('cleared');
  });

  it('covers queue replacement, shifted carve, and direct clear outcomes', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    const internals = engine as unknown as {
      state: TestCarveState;
      carve: () => boolean;
    };

    primeCarveState(internals.state, createInitialBoard(), BASELINE - 3);
    internals.state.activePiece = createEscapePiece('I');
    internals.state.queuedPiece = createEscapePiece('O');
    expect(internals.carve()).toBe(true);
    expect(internals.state.queuedPiece?.type).toBe('O');

    primeCarveState(internals.state, createShiftedCarveBoard(), BASELINE);
    expect(internals.carve()).toBe(true);
    expect(internals.state.mouseY).toBe(BASELINE - 1);
    const activePiece = internals.state.activePiece;
    expect(activePiece).not.toBeNull();
    if (!activePiece) throw new Error('Expected shifted carve to create an active piece.');
    expectPathReachesSpawnAndExits(activePiece.type, activePiece.path);

    const clearBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (const cell of getCells('O', 0, BASELINE - 3, 0)) {
      clearBoard[cell.y][cell.x] = 1;
    }
    primeCarveState(internals.state, clearBoard, BASELINE - 3);
    expect(internals.carve()).toBe(true);
    expect(internals.state.gameState).toBe('WIN');
  });

  it('keeps a queued carve flowing when the active piece escapes', () => {
    const engine = new ReverseTetrisEngine(() => 0.5);
    engine.start();
    moveToValidPlacement(engine);
    expect(engine.handleKey('Enter')).toBe(true);
    moveToValidPlacement(engine);
    expect(engine.handleKey('Enter')).toBe(true);

    const queued = engine.snapshot();
    expect(queued.activePiece).not.toBeNull();
    expect(queued.queuedPiece).not.toBeNull();

    const pathLength = queued.activePiece?.path.length ?? 1;
    engine.tick(pathLength * queued.escapeStepDelay + 1);

    const afterEscape = engine.snapshot();
    expect(afterEscape.gameState).toBe('PLAYING');
    expect(afterEscape.activePiece).not.toBeNull();
    expect(afterEscape.queuedPiece).toBeNull();
  });
});

describe('pure game rules', () => {
  it('maps cells and detects bounds/fill checks', () => {
    const board = createInitialBoard();
    const cells = getCells('O', 4, BASELINE, 0);

    expect(cells).toEqual([
      { x: 4, y: BASELINE },
      { x: 5, y: BASELINE },
      { x: 4, y: BASELINE + 1 },
      { x: 5, y: BASELINE + 1 },
    ]);
    expect(isFullyInsideFilled(board, cells)).toBe(true);
    expect(hasNormalTetrisLandingCollision(board, cells)).toBe(true);
    expect(
      hasNormalTetrisLandingCollision(
        createBoardFromCells(getCells('O', 0, BASELINE - 3, 0)),
        getCells('O', 0, BASELINE - 3, 0),
      ),
    ).toBe(false);
    expect(
      hasNormalTetrisLandingCollision(
        createBoardFromCells(getCells('I', 4, ROWS - 1, 0)),
        getCells('I', 4, ROWS - 1, 0),
      ),
    ).toBe(true);
    expect(isOutOfBounds('I', -2, BASELINE, 0)).toBe(true);
    expect(isOutOfBounds('I', 4, BASELINE, 0)).toBe(false);
    expect(hasLegalCarvePlacement(board, 'O')).toBe(true);
    expect(hasLegalCarvePlacement(createSideSupportedOnlyBoard(), 'O')).toBe(false);
    const started = performance.now();
    expect(hasLegalCarvePlacement(createReplayImpossibleBoard(), 'O')).toBe(false);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('validates board stability and escape paths', () => {
    const board = createInitialBoard();
    const validCells = getCells('O', 0, BASELINE - 3, 0);
    const floatingBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    floatingBoard[4][4] = 1;
    const emptyBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const impossibleBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    impossibleBoard[BASELINE][0] = 1;
    const belowBaselineOnlyBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    belowBaselineOnlyBoard[BASELINE + 1][4] = 1;
    const supportedBoundaryRunBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let y = BASELINE - 1; y <= BASELINE + 3; y++) {
      supportedBoundaryRunBoard[y][4] = 1;
    }
    const diagonalOnlyBoard = createDiagonalOnlyEscapeBoard();

    expect(isBoardValid(board, validCells)).toBe(true);
    expect(isBoardValid(board, [{ x: 0, y: -1 }])).toBe(true);
    expect(isBoardValid(floatingBoard, [{ x: 0, y: BASELINE }])).toBe(false);
    expect(isBoardValid(emptyBoard, [])).toBe(true);
    expect(isBoardValid(belowBaselineOnlyBoard, [])).toBe(true);
    expect(isBoardValid(supportedBoundaryRunBoard, [])).toBe(true);
    expect(isBoardValid(createInitialBoard(), [])).toBe(true);
    expect(isBoardValid(impossibleBoard, [])).toBe(false);
    expect(isBoardValid(createReplayImpossibleBoard(), [])).toBe(false);
    expect(isBoardValid(createReplayLeftPillarBoard(), [])).toBe(false);
    const blobLeftPillarBoard = createBlobLeftPillarBoard();
    const blobStarted = performance.now();
    expect(isBoardValid(blobLeftPillarBoard, [])).toBe(false);
    for (const type of ALL_SHAPE_TYPES) {
      expect(hasLegalCarvePlacement(blobLeftPillarBoard, type)).toBe(false);
    }
    expect(performance.now() - blobStarted).toBeLessThan(50);
    expect(isBoardValid(createBlobRightPileBoard(), [])).toBe(false);
    expect(isBoardValid(createReplayRightPillarBoard(), [])).toBe(true);
    expect(findLegalCarvePath(createReplayRightPillarSetupBoard(), 'O', 3, 18, 3)).not.toBeNull();
    expectPathReachesSpawnAndExits(
      'I',
      findLegalCarvePath(createReplayRightPillarBoard(), 'I', 9, 20, 1),
    );
    expect(findLegalCarvePath(board, 'O', -1, BASELINE, 0)).toBeNull();
    const path = findEscapePath(board, 'O', 0, BASELINE - 3, 0);
    expectPathReachesSpawnAndExits('O', path);
    expectPathUsesSingleActionSteps('O', path);
    expect(path?.some((step) => step.x > 0 && step.y > VISIBLE_TOP)).toBe(true);
    expect(path?.find((step) => step.y === VISIBLE_TOP)).toEqual({
      x: SPAWN_X,
      y: VISIBLE_TOP,
      r: 0,
    });
    const srsSpinBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const srsSpinPath = findEscapePath(srsSpinBoard, 'T', 0, VISIBLE_TOP + 1, 1);
    expectPathReachesSpawnAndExits('T', srsSpinPath);
    expectPathUsesSingleActionSteps('T', srsSpinPath);
    expect(srsSpinPath?.[1]).toEqual({ x: 1, y: VISIBLE_TOP + 1, r: 0 });
    const srsSpinSteps = srsSpinPath ?? [];
    expect(
      srsSpinSteps.some((step, index) => {
        if (index === 0) return false;
        const previous = srsSpinSteps[index - 1];
        return step.r !== previous.r && (step.x !== previous.x || step.y !== previous.y);
      }),
    ).toBe(true);
    const topPath = findEscapePath(board, 'O', SPAWN_X - 1, VISIBLE_TOP, 0);
    expect(topPath?.[1]).toEqual({ x: SPAWN_X, y: VISIBLE_TOP, r: 0 });
    expectPathUsesSingleActionSteps('O', topPath);
    const topFinalStep = topPath?.at(-1);
    expect(topFinalStep ? isFullyAboveBoard('O', topFinalStep) : false).toBe(true);
    expect(findEscapePath(diagonalOnlyBoard, 'O', 0, BASELINE - 1, 0)).toBeNull();
    expect(findEscapePath(createBlockedBoard(), 'O', 0, BASELINE - 3, 0)).toBeNull();
    expectSZPiecesCannotEscapeThroughSingleCellGap();
    const readyEngine = new ReverseTetrisEngine();
    expect(readyEngine.validateGhost()).toBe(false);
    expect(rotateRight(3)).toBe(0);
    expect(rotateLeft(0)).toBe(3);
  });

  it('keeps wall-pillar availability refresh inside a two-frame budget', () => {
    const impossible = refreshAvailabilityForBoard(createBlobLeftPillarBoard(), 'L', 'Z');
    expect(impossible.currentShapeHasLegalCarve).toBe(false);
    expect(impossible.holdSwapShapeHasLegalCarve).toBe(false);
    expect(impossible.noLegalCarveAfterHoldSwap).toBe(true);
    expect(impossible.elapsedMs).toBeLessThan(120);

    const impossibleRight = refreshAvailabilityForBoard(createBlobRightPileBoard(), 'J', 'Z');
    expect(impossibleRight.currentShapeHasLegalCarve).toBe(false);
    expect(impossibleRight.holdSwapShapeHasLegalCarve).toBe(false);
    expect(impossibleRight.noLegalCarveAfterHoldSwap).toBe(true);
    expect(impossibleRight.elapsedMs).toBeLessThan(120);

    const valid = refreshAvailabilityForBoard(createReplayRightPillarBoard(), 'I', 'O');
    expect(valid.currentShapeHasLegalCarve).toBe(true);
    expect(valid.holdSwapShapeHasLegalCarve).toBe(true);
    expect(valid.noLegalCarveAfterHoldSwap).toBe(false);
    expect(valid.elapsedMs).toBeLessThan(120);
  });
});

function createBlockedBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(1));
}

function expectSZPiecesCannotEscapeThroughSingleCellGap(): void {
  const barrierY = VISIBLE_TOP + 8;
  const gapX = SPAWN_X;
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  let checkedStarts = 0;

  for (let x = 0; x < COLS; x++) {
    if (x !== gapX) {
      board[barrierY][x] = 1;
    }
  }

  for (const shape of ['S', 'Z'] as ShapeType[]) {
    for (let rotationIndex = 0; rotationIndex < 4; rotationIndex++) {
      const rotation = rotationIndex as Rotation;

      for (let y = barrierY + 1; y < barrierY + 8; y++) {
        for (let x = 0; x < COLS; x++) {
          const cells = getCells(shape, x, y, rotation);
          if (
            cells.some((cell) => cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS) ||
            cells.some((cell) => cell.y <= barrierY)
          ) {
            continue;
          }

          checkedStarts++;
          expect(findEscapePath(board, shape, x, y, rotation)).toBeNull();
        }
      }
    }
  }

  expect(checkedStarts).toBeGreaterThan(0);
}

function createDiagonalOnlyEscapeBoard() {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  board[BASELINE - 2][0] = 1;
  board[BASELINE][2] = 1;
  return board;
}

function createSideSupportedOnlyBoard() {
  const board = createBoardFromCells(getCells('O', 0, BASELINE - 3, 0));
  for (let y = BASELINE - 3; y <= BASELINE; y++) {
    board[y][2] = 1;
  }
  return board;
}

function createBoardFromCells(cells: Array<{ x: number; y: number }>) {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const cell of cells) {
    if (cell.y >= 0 && cell.y < ROWS) {
      board[cell.y][cell.x] = 1;
    }
  }
  return board;
}

function createShiftedCarveBoard() {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const cell of getCells('O', 0, BASELINE, 0)) {
    board[cell.y][cell.x] = 1;
  }
  board[BASELINE][COLS - 1] = 1;
  return board;
}

function createReplayImpossibleBoard() {
  return [
    '..........',
    '..........',
    '....#.....',
    '...###....',
    '...##.....',
    '...#......',
    '...##.....',
    '...#......',
    '...#......',
    '...#......',
    '...#.....#',
    '.#.#.....#',
    '####.....#',
    '####.....#',
    '###......#',
    '##.......#',
    '##.......#',
    '##.....#.#',
    '###....#.#',
    '###...####',
    '###..#####',
    '###.######',
    '##########',
    '##########',
    '##########',
    '##########',
  ].map((row) => row.split('').map((cell) => (cell === '#' ? 1 : 0)));
}

function createReplayLeftPillarBoard() {
  return [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '.#........',
    '##........',
    '##........',
    '##........',
    '###.......',
    '#.#.......',
    '#.........',
    '#.........',
    '#.......##',
    '##..##...#',
    '##.###...#',
    '##########',
    '##########',
    '##########',
    '##########',
  ].map((row) => row.split('').map((cell) => (cell === '#' ? 1 : 0)));
}

function createBlobLeftPillarBoard() {
  return [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '#.........',
    '#.........',
    '##........',
    '##........',
    '#.........',
    '##........',
    '#.........',
    '#.........',
    '###....#..',
    '###....###',
    '###.######',
    '##########',
    '##########',
    '##########',
    '##########',
  ].map((row) => row.split('').map((cell) => (cell === '#' ? 1 : 0)));
}

function createBlobRightPileBoard() {
  return [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '#........#',
    '#........#',
    '#.......##',
    '##.......#',
    '##.......#',
    '#........#',
    '#.......##',
    '#........#',
    '#........#',
    '#.....#..#',
    '####..##.#',
    '####..####',
    '##########',
    '##########',
    '##########',
    '##########',
  ].map((row) => row.split('').map((cell) => (cell === '#' ? 1 : 0)));
}

function createReplayRightPillarBoard() {
  return [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '###..##...',
    '###..##..#',
    '#######..#',
    '########.#',
    '##########',
    '##########',
    '##########',
    '##########',
  ].map((row) => row.split('').map((cell) => (cell === '#' ? 1 : 0)));
}

function createReplayRightPillarSetupBoard() {
  return [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '#######...',
    '#######..#',
    '#######..#',
    '########.#',
    '##########',
    '##########',
    '##########',
    '##########',
  ].map((row) => row.split('').map((cell) => (cell === '#' ? 1 : 0)));
}

function expectPathReachesSpawnAndExits(
  type: ShapeType,
  path: PathStep[] | null | undefined,
): void {
  expect(path).toBeDefined();
  expect(path).toContainEqual({ x: SPAWN_X, y: VISIBLE_TOP, r: 0 });

  const finalStep = path?.at(-1);
  expect(finalStep ? isFullyAboveBoard(type, finalStep) : false).toBe(true);
}

function expectCells(
  actual: Array<{ x: number; y: number }>,
  expected: Array<{ x: number; y: number }>,
) {
  expect(sortCells(actual)).toEqual(sortCells(expected));
}

function sortCells(cells: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  return [...cells].sort((left, right) => left.y - right.y || left.x - right.x);
}

function expectPathUsesSingleActionSteps(
  type: ShapeType,
  path: PathStep[] | null | undefined,
): void {
  expect(path).toBeDefined();

  const steps = path ?? [];
  for (let index = 1; index < steps.length; index++) {
    const previous = steps[index - 1];
    const current = steps[index];

    if (current.r !== previous.r) {
      expect(
        getSrsRotationCandidates(type, previous.x, previous.y, previous.r, current.r),
      ).toContainEqual(current);
    } else if (current.x !== previous.x) {
      expect(current.y).toBe(previous.y);
      expect(Math.abs(current.x - previous.x)).toBe(1);
    } else {
      expect(current.x).toBe(previous.x);
      expect(current.y).toBe(previous.y - 1);
    }
  }
}

function expectNonUpwardStepBeforeSpawnGate(
  path: PathStep[] | null | undefined,
  predicate: (step: PathStep, previous: PathStep) => boolean,
): void {
  expect(path).toBeDefined();

  const steps = path ?? [];
  const earlyNonUpwardStep = steps.find((step, index) => {
    if (index === 0) return false;
    const previous = steps[index - 1];
    return (
      !isPlainUpwardPathStep(previous, step) &&
      step.y > VISIBLE_TOP + 4 &&
      predicate(step, previous)
    );
  });

  expect(earlyNonUpwardStep).toBeDefined();
}

function expectUpwardStepsUseConstantBeats(
  path: PathStep[],
  pathTimes: number[] | undefined,
): void {
  expect(pathTimes).toBeDefined();

  let previousUpwardTime = 0;
  for (let index = 1; index < path.length; index++) {
    if (isPlainUpwardPathStep(path[index - 1], path[index])) {
      const upwardTime = pathTimes?.[index] ?? 0;
      expect(Number.isInteger(upwardTime)).toBe(true);
      expect(upwardTime - previousUpwardTime).toBeGreaterThanOrEqual(1);
      previousUpwardTime = upwardTime;
    }
  }
}

function expectPlaybackStepsHaveReadableSpacing(pathTimes: number[] | undefined): void {
  expect(pathTimes).toBeDefined();

  for (let index = 1; index < (pathTimes?.length ?? 0); index++) {
    expect((pathTimes?.[index] ?? 0) - (pathTimes?.[index - 1] ?? 0)).toBeGreaterThanOrEqual(0.35);
  }
}

function expectNonUpwardStepUsesFractionalBeat(
  path: PathStep[],
  pathTimes: number[] | undefined,
  predicate: (step: PathStep, previous: PathStep) => boolean,
): void {
  expect(pathTimes).toBeDefined();

  const timingStep = path.findIndex((step, index) => {
    if (index === 0) return false;
    return !isPlainUpwardPathStep(path[index - 1], step) && predicate(step, path[index - 1]);
  });

  expect(timingStep).toBeGreaterThan(0);
  expect(Number.isInteger(pathTimes?.[timingStep] ?? 0)).toBe(false);
}

function isPlainUpwardPathStep(previous: PathStep, current: PathStep): boolean {
  return previous.x === current.x && previous.r === current.r && current.y === previous.y - 1;
}

function isFullyAboveBoard(type: ShapeType, step: PathStep): boolean {
  return getCells(type, step.x, step.y, step.r).every((cell) => cell.y < 0);
}

function carveRotatedEscapePiece(rng: () => number) {
  const engine = new ReverseTetrisEngine(rng);
  engine.start();
  const internals = engine as unknown as {
    state: TestCarveState;
    carve: () => boolean;
    validateGhost: () => boolean;
  };

  primeCarveState(internals.state, createInitialBoard(), BASELINE - 3);
  internals.state.currentRotation = 2;
  internals.state.ghostPath = findEscapePath(internals.state.board, 'O', 0, BASELINE - 3, 2);
  internals.state.ghostValid = Boolean(internals.state.ghostPath);

  expect(internals.validateGhost()).toBe(true);
  expect(internals.carve()).toBe(true);
  const activePiece = internals.state.activePiece;
  expect(activePiece).not.toBeNull();
  if (!activePiece) throw new Error('Expected a randomized active escape piece.');

  return activePiece;
}

function createTestRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function refreshAvailabilityForBoard(
  board: number[][],
  currentShapeType: ShapeType,
  holdShapeType: ShapeType,
) {
  const engine = new ReverseTetrisEngine(() => 0.5);
  engine.start();
  const internals = engine as unknown as {
    state: TestCarveState;
    refreshCarveAvailability: () => void;
  };
  internals.state.activePiece = null;
  internals.state.board = board;
  internals.state.currentShapeType = currentShapeType;
  internals.state.gameState = 'PLAYING';
  internals.state.holdShapeType = holdShapeType;
  internals.state.previewQueue = ['S', 'J'];
  internals.state.queuedPiece = null;

  const started = performance.now();
  internals.refreshCarveAvailability();

  return {
    currentShapeHasLegalCarve: internals.state.currentShapeHasLegalCarve,
    elapsedMs: performance.now() - started,
    holdSwapShapeHasLegalCarve: internals.state.holdSwapShapeHasLegalCarve,
    noLegalCarveAfterHoldSwap: internals.state.noLegalCarveAfterHoldSwap,
  };
}

function createEscapePiece(type: 'I' | 'O') {
  return {
    color: '#fff',
    path: [{ x: 0, y: 0, r: 0 as Rotation }],
    pathIndex: 0,
    startCells: [{ x: 0, y: 0 }],
    timer: 0,
    type,
  };
}

function primeCarveState(state: TestCarveState, board: number[][], mouseY: number) {
  state.activePiece = null;
  state.board = board;
  state.currentRotation = 0;
  state.currentShapeHasLegalCarve = false;
  state.currentShapeType = 'O';
  state.gameState = 'PLAYING';
  state.ghostPath = findEscapePath(board, 'O', 0, mouseY, 0);
  state.ghostValid = Boolean(state.ghostPath);
  state.holdShapeType = null;
  state.holdSwapShapeHasLegalCarve = false;
  state.mouseX = 0;
  state.mouseY = mouseY;
  state.noLegalCarveAfterHoldSwap = false;
  state.previewQueue = ['I', 'J'];
  state.queuedPiece = null;
}
