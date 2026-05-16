export const COLS = 10;
export const ROWS = 26;
export const VISIBLE_TOP = 2;
export const BASELINE = 21;
export const BLOCK_SIZE = 30;
export const SPAWN_X = Math.floor(COLS / 2) - 1;
const SPAWN_Y = VISIBLE_TOP;

export type ShapeType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Rotation = 0 | 1 | 2 | 3;
type GameState = 'READY' | 'PLAYING' | 'GAMEOVER' | 'WIN';
export type Board = number[][];

export interface Cell {
  x: number;
  y: number;
}

export interface PathStep extends Cell {
  r: Rotation;
}

export interface EscapePiece {
  type: ShapeType;
  path: PathStep[];
  pathIndex: number;
  timer: number;
  color: string;
  startCells: Cell[];
}

interface ShapeDefinition {
  color: string;
  coords: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
}

export interface GameStartOptions {
  easyMode?: boolean;
}

export const SHAPES: Record<ShapeType, ShapeDefinition> = {
  I: {
    color: '#06b6d4',
    coords: [
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [0, 2],
      ],
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [0, 2],
      ],
    ],
  },
  J: {
    color: '#3b82f6',
    coords: [
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [-1, -1],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [1, -1],
      ],
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [-1, 1],
      ],
    ],
  },
  L: {
    color: '#f59e0b',
    coords: [
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [1, -1],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [-1, 1],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
      ],
    ],
  },
  O: {
    color: '#eab308',
    coords: [
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
    ],
  },
  S: {
    color: '#22c55e',
    coords: [
      [
        [0, 0],
        [1, 0],
        [0, -1],
        [-1, -1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, -1],
      ],
      [
        [0, 0],
        [1, 0],
        [0, -1],
        [-1, -1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, -1],
      ],
    ],
  },
  T: {
    color: '#a855f7',
    coords: [
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [1, 0],
      ],
      [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [0, -1],
        [0, 1],
        [-1, 0],
      ],
    ],
  },
  Z: {
    color: '#ef4444',
    coords: [
      [
        [0, 0],
        [-1, 0],
        [0, -1],
        [1, -1],
      ],
      [
        [0, 0],
        [0, -1],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [-1, 0],
        [0, -1],
        [1, -1],
      ],
      [
        [0, 0],
        [0, -1],
        [1, 0],
        [1, 1],
      ],
    ],
  },
};

const SHAPE_KEYS: ShapeType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const CELL_COUNT = ROWS * COLS;
const PLACEMENT_METADATA = createPlacementMetadata();
const GAME_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
  'z',
  'x',
  'r',
  'c',
  'Shift',
  ' ',
  'Enter',
];

export interface GameSnapshot {
  board: Board;
  score: number;
  level: number;
  piecesCarved: number;
  gameState: GameState;
  easyMode: boolean;
  firstCarveDone: boolean;
  currentShapeType: ShapeType | null;
  currentRotation: Rotation;
  holdShapeType: ShapeType | null;
  previewQueue: ShapeType[];
  mouseX: number;
  mouseY: number;
  ghostValid: boolean;
  ghostPath: PathStep[] | null;
  currentShapeHasLegalCarve: boolean;
  holdSwapShapeHasLegalCarve: boolean;
  noLegalCarveAfterHoldSwap: boolean;
  activePiece: EscapePiece | null;
  queuedPiece: EscapePiece | null;
  escapeStepDelay: number;
  statusReason: string;
}

interface EngineState extends GameSnapshot {
  shapeBag: ShapeType[];
  isFirstBag: boolean;
  lastTime: number;
  legalityIndex: CarveLegalityIndex;
}

interface CarvePlacement {
  id: number;
  type: ShapeType;
  x: number;
  y: number;
  rotation: Rotation;
  cells: Cell[];
  cellIndexes: number[];
  supportIndexes: number[];
  hasFloorSupport: boolean;
}

interface PlacementMetadata {
  placements: CarvePlacement[];
  idsByKey: Map<string, number>;
  idsByShape: Map<ShapeType, number[]>;
  filledPlacementIdsByCell: number[][];
  supportPlacementIdsByCell: number[][];
}

interface CarveLegalityIndex {
  boardMask: string;
  rowBits: number[];
  filledCountByPlacement: Uint8Array;
  supportCountByPlacement: Uint8Array;
  dirtyPlacementIds: Set<number>;
  legalPathByPlacement: Map<number, PathStep[] | null>;
  shapeHasLegalCarve: Map<ShapeType, boolean>;
  packValidityByResultMask: Map<string, boolean>;
}

export function createInitialBoard(): Board {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  for (let r = BASELINE - 3; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      board[r][c] = 1;
    }
  }

  return board;
}

export function getCells(
  type: ShapeType | null | undefined,
  x: number,
  y: number,
  rotation: Rotation,
): Cell[] {
  if (!type) return [];

  return SHAPES[type].coords[rotation].map(([cx, cy]) => ({
    x: x + cx,
    y: y + cy,
  }));
}

export function isFullyInsideFilled(board: Board, cells: Cell[]): boolean {
  return cells.every(
    (cell) =>
      cell.x >= 0 && cell.x < COLS && cell.y >= 0 && cell.y < ROWS && board[cell.y][cell.x] === 1,
  );
}

export function hasNormalTetrisLandingCollision(board: Board, cells: Cell[]): boolean {
  return cells.some((cell) => {
    const belowY = cell.y + 1;

    if (belowY >= ROWS) {
      return true;
    }

    const isSelf = cells.some((other) => other.x === cell.x && other.y === belowY);
    return !isSelf && board[belowY]?.[cell.x] === 1;
  });
}

export function isOutOfBounds(
  type: ShapeType | null,
  x: number,
  y: number,
  rotation: Rotation,
): boolean {
  return getCells(type, x, y, rotation).some(
    (cell) => cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS,
  );
}

function isCursorOutOfVisibleBounds(
  type: ShapeType | null,
  x: number,
  y: number,
  rotation: Rotation,
): boolean {
  return getCells(type, x, y, rotation).some(
    (cell) => cell.x < 0 || cell.x >= COLS || cell.y < VISIBLE_TOP || cell.y >= ROWS,
  );
}

export function isBoardValid(board: Board, cells: Cell[]): boolean {
  return isPreparedBoardValid(createBoardAfterCarve(board, cells));
}

function createBoardAfterCarve(board: Board, cells: Cell[]): Board {
  const simBoard = board.map((row) => [...row]);

  for (const cell of cells) {
    if (cell.y >= 0 && cell.y < ROWS) {
      simBoard[cell.y][cell.x] = 0;
    }
  }

  const maxCellY = Math.max(...cells.map((cell) => cell.y));
  const shift = Math.max(0, maxCellY - BASELINE);

  if (shift > 0) {
    simBoard.splice(0, shift);
    for (let i = 0; i < shift; i++) {
      simBoard.push(Array(COLS).fill(1));
    }
  }

  return simBoard;
}

function isPreparedBoardValid(board: Board): boolean {
  return !hasFloatingBlocks(board) && canPackRemainingBlocks(board);
}

export function findEscapePath(
  board: Board,
  type: ShapeType,
  startX: number,
  startY: number,
  startR: Rotation,
): PathStep[] | null {
  const startCells = getCells(type, startX, startY, startR);
  const queue: PathStepWithHistory[] = [
    {
      x: startX,
      y: startY,
      r: startR,
      path: [{ x: startX, y: startY, r: startR }],
    },
  ];
  const visited = new Set([`${startX},${startY},${startR}`]);
  let iterations = 0;

  while (queue.length > 0 && iterations < 2000) {
    iterations++;
    const current = queue.shift();
    if (!current) break;

    if (isExitPosition(type, current)) {
      return current.path;
    }

    const moves = createEscapeMoves(current);

    for (const move of moves) {
      if (move.y <= SPAWN_Y && !isInSpawnColumn(move)) continue;

      const key = `${move.x},${move.y},${move.r}`;
      if (visited.has(key)) continue;

      const moveCells = getCells(type, move.x, move.y, move.r);
      const blockedByBounds = moveCells.some(
        (cell) => cell.x < 0 || cell.x >= COLS || cell.y >= ROWS,
      );
      if (blockedByBounds) continue;

      const blockedByBoard = moveCells.some((cell) => {
        const isInside = cell.y >= 0;
        const isSelf = startCells.some(
          (startCell) => startCell.x === cell.x && startCell.y === cell.y,
        );
        return isInside && board[cell.y][cell.x] === 1 && !isSelf;
      });
      if (blockedByBoard) continue;

      visited.add(key);
      queue.push({
        ...move,
        path: [...current.path, move],
      });
    }
  }

  return null;
}

export function findLegalCarvePath(
  board: Board,
  type: ShapeType,
  x: number,
  y: number,
  rotation: Rotation,
): PathStep[] | null {
  const cells = getCells(type, x, y, rotation);

  if (
    isOutOfBounds(type, x, y, rotation) ||
    !isFullyInsideFilled(board, cells) ||
    !hasNormalTetrisLandingCollision(board, cells)
  ) {
    return null;
  }

  const path = findEscapePath(board, type, x, y, rotation);
  if (!path || !isBoardValid(board, cells)) return null;

  return path;
}

export function hasLegalCarvePlacement(board: Board, type: ShapeType | null | undefined): boolean {
  const legalityIndex = createCarveLegalityIndex(board);
  return hasLegalCarvePlacementInIndex(board, legalityIndex, type);
}

function createPlacementMetadata(): PlacementMetadata {
  const placements: CarvePlacement[] = [];
  const idsByKey = new Map<string, number>();
  const idsByShape = new Map<ShapeType, number[]>();
  const filledPlacementIdsByCell = Array.from({ length: CELL_COUNT }, () => [] as number[]);
  const supportPlacementIdsByCell = Array.from({ length: CELL_COUNT }, () => [] as number[]);

  for (const type of SHAPE_KEYS) {
    idsByShape.set(type, []);
  }

  for (const type of SHAPE_KEYS) {
    for (let rotationIndex = 0; rotationIndex < 4; rotationIndex++) {
      const rotation = rotationIndex as Rotation;

      for (let y = -4; y < ROWS + 4; y++) {
        for (let x = -4; x < COLS + 4; x++) {
          const cells = getCells(type, x, y, rotation);
          if (cells.some((cell) => cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS)) {
            continue;
          }

          const cellIndexes = cells.map(cellIndex);
          const supportIndexes = new Set<number>();
          let hasFloorSupport = false;

          for (const cell of cells) {
            const belowY = cell.y + 1;
            if (belowY >= ROWS) {
              hasFloorSupport = true;
              continue;
            }

            const isSelf = cells.some((other) => other.x === cell.x && other.y === belowY);
            if (!isSelf) {
              supportIndexes.add(cellIndex({ x: cell.x, y: belowY }));
            }
          }

          const id = placements.length;
          const placement: CarvePlacement = {
            id,
            type,
            x,
            y,
            rotation,
            cells,
            cellIndexes,
            supportIndexes: [...supportIndexes],
            hasFloorSupport,
          };

          placements.push(placement);
          idsByKey.set(placementKey(type, x, y, rotation), id);
          idsByShape.get(type)?.push(id);

          for (const index of cellIndexes) {
            filledPlacementIdsByCell[index].push(id);
          }
          for (const index of supportIndexes) {
            supportPlacementIdsByCell[index].push(id);
          }
        }
      }
    }
  }

  return {
    placements,
    idsByKey,
    idsByShape,
    filledPlacementIdsByCell,
    supportPlacementIdsByCell,
  };
}

function createCarveLegalityIndex(board: Board): CarveLegalityIndex {
  const rowBits = createRowBits(board);
  const filledCountByPlacement = new Uint8Array(PLACEMENT_METADATA.placements.length);
  const supportCountByPlacement = new Uint8Array(PLACEMENT_METADATA.placements.length);

  for (const placement of PLACEMENT_METADATA.placements) {
    filledCountByPlacement[placement.id] = countFilledIndexes(rowBits, placement.cellIndexes);
    supportCountByPlacement[placement.id] =
      countFilledIndexes(rowBits, placement.supportIndexes) + (placement.hasFloorSupport ? 1 : 0);
  }

  return {
    boardMask: rowBitsToBoardMask(rowBits),
    rowBits,
    filledCountByPlacement,
    supportCountByPlacement,
    dirtyPlacementIds: new Set(),
    legalPathByPlacement: new Map(),
    shapeHasLegalCarve: new Map(),
    packValidityByResultMask: new Map(),
  };
}

function findLegalCarvePathInIndex(
  board: Board,
  legalityIndex: CarveLegalityIndex,
  type: ShapeType,
  x: number,
  y: number,
  rotation: Rotation,
): PathStep[] | null {
  const placementId = PLACEMENT_METADATA.idsByKey.get(placementKey(type, x, y, rotation));
  if (placementId === undefined) return null;

  return getLegalPathForPlacement(board, legalityIndex, placementId);
}

function hasLegalCarvePlacementInIndex(
  board: Board,
  legalityIndex: CarveLegalityIndex,
  type: ShapeType | null | undefined,
): boolean {
  if (!type) return false;

  const cached = legalityIndex.shapeHasLegalCarve.get(type);
  if (cached !== undefined) return cached;

  for (const placementId of PLACEMENT_METADATA.idsByShape.get(type) ?? []) {
    if (getLegalPathForPlacement(board, legalityIndex, placementId)) {
      legalityIndex.shapeHasLegalCarve.set(type, true);
      return true;
    }
  }

  legalityIndex.shapeHasLegalCarve.set(type, false);
  return false;
}

function getLegalPathForPlacement(
  board: Board,
  legalityIndex: CarveLegalityIndex,
  placementId: number,
): PathStep[] | null {
  if (
    legalityIndex.legalPathByPlacement.has(placementId) &&
    !legalityIndex.dirtyPlacementIds.has(placementId)
  ) {
    const cachedPath = legalityIndex.legalPathByPlacement.get(placementId) ?? null;
    const placement = PLACEMENT_METADATA.placements[placementId];
    if (!cachedPath || !isPlacementBoardValid(board, legalityIndex, placement)) return null;

    return cachedPath;
  }

  legalityIndex.dirtyPlacementIds.delete(placementId);
  const placement = PLACEMENT_METADATA.placements[placementId];
  let escapePath: PathStep[] | null = null;

  if (
    legalityIndex.filledCountByPlacement[placementId] === placement.cellIndexes.length &&
    legalityIndex.supportCountByPlacement[placementId] > 0
  ) {
    escapePath = findEscapePath(
      board,
      placement.type,
      placement.x,
      placement.y,
      placement.rotation,
    );
  }

  legalityIndex.legalPathByPlacement.set(placementId, escapePath);
  if (!escapePath || !isPlacementBoardValid(board, legalityIndex, placement)) return null;

  return escapePath;
}

function isPlacementBoardValid(
  board: Board,
  legalityIndex: CarveLegalityIndex,
  placement: CarvePlacement,
): boolean {
  const simBoard = createBoardAfterCarve(board, placement.cells);
  const resultMask = boardToMask(simBoard);
  const cached = legalityIndex.packValidityByResultMask.get(resultMask);
  if (cached !== undefined) return cached;

  const valid = isPreparedBoardValid(simBoard);
  legalityIndex.packValidityByResultMask.set(resultMask, valid);
  return valid;
}

function applyLegalityCellValue(legalityIndex: CarveLegalityIndex, cell: Cell, value: 0 | 1): void {
  const index = cellIndex(cell);
  const bit = 1 << cell.x;
  const previous = (legalityIndex.rowBits[cell.y] & bit) === 0 ? 0 : 1;
  if (previous === value) return;

  const delta = value === 1 ? 1 : -1;
  if (value === 1) {
    legalityIndex.rowBits[cell.y] |= bit;
  } else {
    legalityIndex.rowBits[cell.y] &= ~bit;
  }
  legalityIndex.boardMask = rowBitsToBoardMask(legalityIndex.rowBits);
  legalityIndex.shapeHasLegalCarve.clear();

  if (value === 1) {
    legalityIndex.legalPathByPlacement.clear();
  } else {
    clearFailedEscapePathCaches(legalityIndex);
  }

  for (const placementId of PLACEMENT_METADATA.filledPlacementIdsByCell[index]) {
    legalityIndex.filledCountByPlacement[placementId] += delta;
    markPlacementDirty(legalityIndex, placementId);
  }
  for (const placementId of PLACEMENT_METADATA.supportPlacementIdsByCell[index]) {
    legalityIndex.supportCountByPlacement[placementId] += delta;
    markPlacementDirty(legalityIndex, placementId);
  }
}

function clearFailedEscapePathCaches(legalityIndex: CarveLegalityIndex): void {
  for (const [placementId, path] of legalityIndex.legalPathByPlacement) {
    if (!path) {
      legalityIndex.legalPathByPlacement.delete(placementId);
    }
  }
}

function markPlacementDirty(legalityIndex: CarveLegalityIndex, placementId: number): void {
  const placement = PLACEMENT_METADATA.placements[placementId];
  legalityIndex.dirtyPlacementIds.add(placementId);
  legalityIndex.legalPathByPlacement.delete(placementId);
  legalityIndex.shapeHasLegalCarve.delete(placement.type);
}

function createRowBits(board: Board): number[] {
  return board.map((row) =>
    row.reduce((bits, value, x) => (value === 1 ? bits | (1 << x) : bits), 0),
  );
}

function countFilledIndexes(rowBits: number[], indexes: number[]): number {
  let count = 0;
  for (const index of indexes) {
    const y = Math.floor(index / COLS);
    const x = index % COLS;
    if ((rowBits[y] & (1 << x)) !== 0) count++;
  }
  return count;
}

function boardToMask(board: Board): string {
  return rowBitsToBoardMask(createRowBits(board));
}

function rowBitsToBoardMask(rowBits: number[]): string {
  return rowBits.map((row) => row.toString(36).padStart(2, '0')).join('');
}

function cellIndex(cell: Cell): number {
  return cell.y * COLS + cell.x;
}

function placementKey(type: ShapeType, x: number, y: number, rotation: Rotation): string {
  return `${type},${x},${y},${rotation}`;
}

interface PathStepWithHistory extends PathStep {
  path: PathStep[];
}

function createEscapeMoves(current: PathStep): PathStep[] {
  const moves: PathStep[] = [{ x: current.x, y: current.y - 1, r: current.r }];

  for (const dx of getHorizontalDeltas(current.x)) {
    if (dx !== 0) {
      moves.push({ x: current.x + dx, y: current.y, r: current.r });
    }
  }

  for (const rotation of getRotationOptions(current.r)) {
    if (rotation !== current.r) {
      moves.push({ x: current.x, y: current.y, r: rotation });
    }
  }

  return moves;
}

function getHorizontalDeltas(x: number): number[] {
  if (x < SPAWN_X) return [1, 0, -1];
  if (x > SPAWN_X) return [-1, 0, 1];
  return [0, -1, 1];
}

function getRotationOptions(rotation: Rotation): Rotation[] {
  const options = [rotateLeft(rotation), rotation, rotateRight(rotation)];

  return options.sort((left, right) => getRotationDistance(left) - getRotationDistance(right));
}

function getRotationDistance(rotation: Rotation): number {
  return Math.min(rotation, 4 - rotation);
}

export function shouldPreventKey(key: string, code = ''): boolean {
  return GAME_KEYS.includes(key) || code === 'Space';
}

export function rotateLeft(rotation: Rotation): Rotation {
  return ((rotation + 3) % 4) as Rotation;
}

export function rotateRight(rotation: Rotation): Rotation {
  return ((rotation + 1) % 4) as Rotation;
}

export class ReverseTetrisEngine {
  private state: EngineState;
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.state = createReadyState();
  }

  snapshot(): GameSnapshot {
    return cloneSnapshot(this.state);
  }

  start(timestamp = 0, options: GameStartOptions = {}): GameSnapshot {
    this.state = createReadyState();
    this.state.score = 0;
    this.state.level = 1;
    this.state.piecesCarved = 0;
    this.state.escapeStepDelay = 400;
    this.state.easyMode = Boolean(options.easyMode);
    this.state.firstCarveDone = false;
    this.state.activePiece = null;
    this.state.queuedPiece = null;
    this.state.holdShapeType = null;
    this.state.shapeBag = [];
    this.state.isFirstBag = true;
    const firstPreviewShape = this.getNextShape(null);
    const secondPreviewShape = this.getNextShape(firstPreviewShape);
    this.state.previewQueue = [firstPreviewShape, secondPreviewShape];
    this.state.currentShapeType = this.getNextShape(secondPreviewShape);
    this.state.currentRotation = 0;
    this.state.mouseX = Math.floor(COLS / 2) - 1;
    this.state.mouseY = BASELINE;
    this.clampToBounds();
    this.state.gameState = 'PLAYING';
    this.state.lastTime = timestamp;
    this.validateGhost();
    this.refreshCarveAvailability();

    return this.snapshot();
  }

  handleKey(key: string, code = ''): boolean {
    if (this.state.gameState !== 'PLAYING') {
      return false;
    }

    const normalizedKey = code === 'Space' ? ' ' : key.toLowerCase();
    let moved = false;

    switch (normalizedKey) {
      case 'arrowleft':
      case 'a':
        moved = this.move(-1, 0);
        break;
      case 'arrowright':
      case 'd':
        moved = this.move(1, 0);
        break;
      case 'arrowup':
      case 'w':
        moved = this.move(0, -1);
        break;
      case 'arrowdown':
      case 's':
        moved = this.move(0, 1);
        break;
      case 'z':
        moved = this.tryRotation(rotateLeft(this.state.currentRotation));
        break;
      case 'x':
      case 'r':
        moved = this.tryRotation(rotateRight(this.state.currentRotation));
        break;
      case 'c':
      case 'shift':
        return this.performSwap();
      case ' ':
      case 'enter':
        return this.carve();
      default:
        return false;
    }

    if (moved) {
      this.validateGhost();
    }

    return moved;
  }

  tick(timestamp: number): boolean {
    if (this.state.gameState !== 'PLAYING') {
      return false;
    }

    const elapsed = Math.max(0, timestamp - this.state.lastTime);
    this.state.lastTime = timestamp;

    if (!this.state.activePiece) {
      return true;
    }

    this.state.activePiece.timer += elapsed;

    while (
      this.state.activePiece.timer >= this.state.escapeStepDelay &&
      this.state.activePiece.pathIndex < this.state.activePiece.path.length - 1
    ) {
      this.state.activePiece.timer -= this.state.escapeStepDelay;
      this.state.activePiece.pathIndex++;
      this.validateGhost();
    }

    if (this.state.activePiece.pathIndex >= this.state.activePiece.path.length - 1) {
      if (!this.state.queuedPiece) {
        if (this.state.easyMode) {
          this.state.activePiece = null;
          this.validateGhost();
          return true;
        }

        this.endGame('Too slow! The piece reached the spawn before you queued the next.');
        return true;
      }

      this.state.activePiece = this.state.queuedPiece;
      this.state.queuedPiece = null;
      this.validateGhost();
    }

    return true;
  }

  validateGhost(): boolean {
    if (this.state.gameState !== 'PLAYING' || !this.state.currentShapeType) {
      this.state.ghostValid = false;
      this.state.ghostPath = null;
      return false;
    }

    const path = findLegalCarvePathInIndex(
      this.state.board,
      this.syncLegalityIndex(),
      this.state.currentShapeType,
      this.state.mouseX,
      this.state.mouseY,
      this.state.currentRotation,
    );

    this.state.ghostValid = Boolean(path);
    this.state.ghostPath = path;

    return Boolean(path);
  }

  private move(dx: number, dy: number): boolean {
    if (
      isCursorOutOfVisibleBounds(
        this.state.currentShapeType,
        this.state.mouseX + dx,
        this.state.mouseY + dy,
        this.state.currentRotation,
      )
    ) {
      return false;
    }

    this.state.mouseX += dx;
    this.state.mouseY += dy;
    return true;
  }

  private tryRotation(nextRotation: Rotation): boolean {
    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ];

    for (const [x, y] of kicks) {
      if (
        !isCursorOutOfVisibleBounds(
          this.state.currentShapeType,
          this.state.mouseX + x,
          this.state.mouseY + y,
          nextRotation,
        )
      ) {
        this.state.mouseX += x;
        this.state.mouseY += y;
        this.state.currentRotation = nextRotation;
        return true;
      }
    }

    return false;
  }

  private performSwap(): boolean {
    if (this.state.gameState !== 'PLAYING' || !this.state.currentShapeType) {
      return false;
    }

    if (this.state.holdShapeType === null) {
      this.state.holdShapeType = this.state.currentShapeType;
      this.state.currentShapeType = this.takePreviewShape();
    } else {
      const nextShape = this.state.currentShapeType;
      this.state.currentShapeType = this.state.holdShapeType;
      this.state.holdShapeType = nextShape;
    }

    this.state.currentRotation = 0;
    this.clampToBounds();
    this.validateGhost();
    this.refreshCarveAvailability();

    return true;
  }

  private carve(): boolean {
    if (
      this.state.gameState !== 'PLAYING' ||
      !this.state.currentShapeType ||
      !this.state.ghostValid ||
      !this.state.ghostPath
    ) {
      return false;
    }

    const shapeType = this.state.currentShapeType;
    const rotation = this.state.currentRotation;
    const cells = getCells(shapeType, this.state.mouseX, this.state.mouseY, rotation);
    const legalityIndex = this.syncLegalityIndex();
    const shift = Math.max(0, Math.max(...cells.map((cell) => cell.y)) - BASELINE);

    for (const cell of cells) {
      this.state.board[cell.y][cell.x] = 0;
      if (shift === 0) {
        applyLegalityCellValue(legalityIndex, cell, 0);
      }
    }

    if (shift > 0) {
      this.applyBoardShift(shift, null);
    }

    const path = this.buildCarvedPiecePath(shapeType, rotation, shift);
    const newPiece: EscapePiece = {
      type: shapeType,
      path,
      pathIndex: 0,
      timer: 0,
      color: SHAPES[shapeType].color,
      startCells: cells.map((cell) => ({ ...cell, y: cell.y - shift })),
    };

    if (!this.state.activePiece) {
      this.state.activePiece = newPiece;
    } else if (!this.state.queuedPiece) {
      this.state.queuedPiece = newPiece;
    } else {
      this.state.activePiece = this.state.queuedPiece;
      this.state.queuedPiece = newPiece;
    }

    this.state.firstCarveDone = true;
    this.state.piecesCarved++;
    this.state.level = Math.floor(this.state.piecesCarved / 10) + 1;
    this.state.score += 100 * this.state.level;
    this.state.escapeStepDelay = Math.max(80, 400 - (this.state.level - 1) * 35);

    if (this.countBlocksAtOrAboveBaseline() === 0) {
      this.winGame();
      return true;
    }

    this.state.currentShapeType = this.takePreviewShape();
    this.state.currentRotation = 0;
    this.clampToBounds();
    this.validateGhost();
    this.refreshCarveAvailability();

    return true;
  }

  private refreshCarveAvailability(): void {
    const holdSwapCandidate = this.state.holdShapeType ?? this.state.previewQueue[0] ?? null;
    const legalityIndex = this.syncLegalityIndex();
    this.state.currentShapeHasLegalCarve = hasLegalCarvePlacementInIndex(
      this.state.board,
      legalityIndex,
      this.state.currentShapeType,
    );
    this.state.holdSwapShapeHasLegalCarve = hasLegalCarvePlacementInIndex(
      this.state.board,
      legalityIndex,
      holdSwapCandidate,
    );
    this.state.noLegalCarveAfterHoldSwap =
      this.state.gameState === 'PLAYING' &&
      !this.state.currentShapeHasLegalCarve &&
      !this.state.holdSwapShapeHasLegalCarve;
  }

  private syncLegalityIndex(): CarveLegalityIndex {
    const boardMask = boardToMask(this.state.board);
    if (this.state.legalityIndex.boardMask !== boardMask) {
      this.state.legalityIndex = createCarveLegalityIndex(this.state.board);
    }

    return this.state.legalityIndex;
  }

  private getNextShape(previousShape: ShapeType | null): ShapeType {
    if (this.state.shapeBag.length === 0) {
      this.state.shapeBag = [...SHAPE_KEYS].sort(() => this.rng() - 0.5);

      if (this.state.isFirstBag) {
        moveShapeToBagFront(this.state.shapeBag, 'S');
        moveShapeToBagFront(this.state.shapeBag, 'Z');
        this.state.isFirstBag = false;
      }
    }

    if (previousShape) {
      moveShapeAwayFromBagBack(this.state.shapeBag, previousShape);
    }

    return this.state.shapeBag.pop() ?? 'I';
  }

  private takePreviewShape(): ShapeType {
    const nextShape =
      this.state.previewQueue.shift() ?? this.getNextShape(this.state.currentShapeType);
    const previousQueuedShape = this.state.previewQueue.at(-1) ?? nextShape;
    this.state.previewQueue.push(this.getNextShape(previousQueuedShape));

    return nextShape;
  }

  private clampToBounds(): void {
    if (!this.state.currentShapeType) return;

    const cells = getCells(this.state.currentShapeType, 0, 0, this.state.currentRotation);
    const minX = Math.min(...cells.map((cell) => cell.x));
    const maxX = Math.max(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    const maxY = Math.max(...cells.map((cell) => cell.y));

    if (this.state.mouseX + minX < 0) this.state.mouseX = -minX;
    if (this.state.mouseX + maxX >= COLS) this.state.mouseX = COLS - 1 - maxX;
    if (this.state.mouseY + minY < VISIBLE_TOP) this.state.mouseY = VISIBLE_TOP - minY;
    if (this.state.mouseY + maxY >= ROWS) this.state.mouseY = ROWS - 1 - maxY;
  }

  private applyBoardShift(shift: number, excludedPiece: EscapePiece | null): void {
    this.state.board.splice(0, shift);
    for (let i = 0; i < shift; i++) {
      this.state.board.push(Array(COLS).fill(1));
    }

    this.state.mouseY -= shift;
    shiftPiece(this.state.activePiece, shift, excludedPiece);
    shiftPiece(this.state.queuedPiece, shift, excludedPiece);
    this.state.legalityIndex = createCarveLegalityIndex(this.state.board);
  }

  private countBlocksAtOrAboveBaseline(): number {
    let blocksRemaining = 0;

    for (let row = 0; row <= BASELINE; row++) {
      blocksRemaining += this.state.board[row].filter((value) => value === 1).length;
    }

    return blocksRemaining;
  }

  private endGame(reason: string): void {
    this.state.gameState = 'GAMEOVER';
    this.state.statusReason = reason;
    this.state.noLegalCarveAfterHoldSwap = false;
  }

  private winGame(): void {
    this.state.gameState = 'WIN';
    this.state.statusReason = 'You have completely cleared the solid mass!';
    this.state.noLegalCarveAfterHoldSwap = false;
  }

  private buildCarvedPiecePath(
    shapeType: ShapeType,
    rotation: Rotation,
    shift: number,
  ): PathStep[] {
    const ghostPath = this.state.ghostPath?.map((step) => ({ ...step, y: step.y - shift })) ?? null;

    if (shift === 0) {
      return ghostPath ?? [{ x: this.state.mouseX, y: this.state.mouseY, r: rotation }];
    }

    const recalculatedPath = findEscapePath(
      this.state.board,
      shapeType,
      this.state.mouseX,
      this.state.mouseY,
      rotation,
    );

    return (
      recalculatedPath ?? ghostPath ?? [{ x: this.state.mouseX, y: this.state.mouseY, r: rotation }]
    );
  }
}

function createReadyState(): EngineState {
  const board = createInitialBoard();

  return {
    board,
    score: 0,
    level: 1,
    piecesCarved: 0,
    gameState: 'READY',
    easyMode: false,
    firstCarveDone: false,
    currentShapeType: null,
    currentRotation: 0,
    holdShapeType: null,
    previewQueue: [],
    shapeBag: [],
    isFirstBag: true,
    mouseX: Math.floor(COLS / 2) - 1,
    mouseY: BASELINE,
    ghostValid: false,
    ghostPath: null,
    currentShapeHasLegalCarve: false,
    holdSwapShapeHasLegalCarve: false,
    noLegalCarveAfterHoldSwap: false,
    activePiece: null,
    queuedPiece: null,
    escapeStepDelay: 400,
    statusReason: '',
    lastTime: 0,
    legalityIndex: createCarveLegalityIndex(board),
  };
}

function hasFloatingBlocks(board: Board): boolean {
  let totalSolid = 0;
  const queue: Cell[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === 1) {
        totalSolid++;
        if (y >= BASELINE) {
          queue.push({ x, y });
        }
      }
    }
  }

  if (totalSolid === 0) {
    return false;
  }

  const visited = new Set<string>();
  let connectedCount = 0;

  for (const startCell of queue) {
    const key = `${startCell.x},${startCell.y}`;
    if (!visited.has(key)) {
      visited.add(key);
      connectedCount++;
    }
  }

  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor++];

    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;

      if (x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y][x] === 1 && !visited.has(key)) {
        visited.add(key);
        queue.push({ x, y });
        connectedCount++;
      }
    }
  }

  return connectedCount < totalSolid;
}

function canPackRemainingBlocks(board: Board): boolean {
  if (getTopSolidRow(board) <= VISIBLE_TOP) {
    return canExactlyPackBoard(
      board.map((row) => [...row]),
      new Set(),
      { visited: 0 },
    );
  }

  const boardCopy = board.map((row) => [...row]);
  return removeForcedPlacements(boardCopy);
}

function removeForcedPlacements(board: Board): boolean {
  let changed = true;

  while (changed) {
    changed = false;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] !== 1) continue;

        const placements = findUniquePlacementsForCell(board, x, y);
        if (placements.length === 0) return false;

        if (placements.length === 1) {
          for (const cell of placements[0]) {
            board[cell.y][cell.x] = 0;
          }
          changed = true;
          break;
        }
      }

      if (changed) break;
    }
  }

  return true;
}

function getTopSolidRow(board: Board): number {
  for (let y = 0; y < ROWS; y++) {
    if (board[y].some((cell) => cell === 1)) return y;
  }

  return ROWS;
}

function canExactlyPackBoard(
  board: Board,
  memo: Set<string>,
  search: { visited: number },
): boolean {
  search.visited++;
  if (search.visited > 200) return false;

  const key = board.map((row) => row.join('')).join('/');
  if (memo.has(key)) return false;
  memo.add(key);

  const target = findMostConstrainedSolidCell(board);
  if (!target) return true;
  if (target.placements.length === 0) return false;

  for (const placement of target.placements) {
    const nextBoard = board.map((row) => [...row]);
    for (const cell of placement) {
      nextBoard[cell.y][cell.x] = 0;
    }
    if (canExactlyPackBoard(nextBoard, memo, search)) return true;
  }

  return false;
}

function findMostConstrainedSolidCell(board: Board): { placements: Cell[][] } | null {
  let best: { placements: Cell[][] } | null = null;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== 1) continue;

      const placements = findUniquePlacementsForCell(board, x, y);
      if (!best || placements.length < best.placements.length) {
        best = { placements };
      }
    }
  }

  return best;
}

function findUniquePlacementsForCell(board: Board, x: number, y: number): Cell[][] {
  const placements: Cell[][] = [];
  const seen = new Set<string>();

  for (const type of SHAPE_KEYS) {
    for (let rotationIndex = 0; rotationIndex < 4; rotationIndex++) {
      const rotation = rotationIndex as Rotation;
      const shapeCoords = SHAPES[type].coords[rotation];

      for (let originIndex = 0; originIndex < 4; originIndex++) {
        const originX = x - shapeCoords[originIndex][0];
        const originY = y - shapeCoords[originIndex][1];
        const cells: Cell[] = [];
        let fits = true;

        for (const [cx, cy] of shapeCoords) {
          const cellX = originX + cx;
          const cellY = originY + cy;

          if (cellX < 0 || cellX >= COLS || cellY < 0 || cellY >= ROWS) {
            fits = false;
            break;
          }

          if (board[cellY][cellX] !== 1) {
            fits = false;
            break;
          }

          cells.push({ x: cellX, y: cellY });
        }

        if (!fits || !hasNormalTetrisLandingCollision(board, cells)) continue;

        const key = cells
          .map((cell) => cell.x + cell.y * COLS)
          .sort((left, right) => left - right)
          .join('_');

        if (!seen.has(key)) {
          seen.add(key);
          placements.push(cells);
        }
      }
    }
  }

  return placements;
}

function moveShapeToBagFront(bag: ShapeType[], shape: ShapeType): void {
  const index = bag.indexOf(shape);
  if (index >= 0) {
    bag.splice(index, 1);
    bag.unshift(shape);
  }
}

function moveShapeAwayFromBagBack(bag: ShapeType[], shape: ShapeType): void {
  const backIndex = bag.length - 1;
  if (bag[backIndex] !== shape) return;

  const swapIndex = bag.findIndex((candidate) => candidate !== shape);
  if (swapIndex < 0) return;

  [bag[backIndex], bag[swapIndex]] = [bag[swapIndex], bag[backIndex]];
}

function isInSpawnColumn(step: PathStep): boolean {
  return step.x === SPAWN_X && step.r === 0;
}

function isExitPosition(type: ShapeType, step: PathStep): boolean {
  return (
    isInSpawnColumn(step) && getCells(type, step.x, step.y, step.r).every((cell) => cell.y < 0)
  );
}

function shiftPiece(
  piece: EscapePiece | null,
  shift: number,
  excludedPiece: EscapePiece | null,
): void {
  if (!piece || piece === excludedPiece) return;

  for (const pathStep of piece.path) {
    pathStep.y -= shift;
  }

  for (const cell of piece.startCells) {
    cell.y -= shift;
  }
}

function cloneSnapshot(state: EngineState): GameSnapshot {
  return {
    board: state.board.map((row) => [...row]),
    score: state.score,
    level: state.level,
    piecesCarved: state.piecesCarved,
    gameState: state.gameState,
    easyMode: state.easyMode,
    firstCarveDone: state.firstCarveDone,
    currentShapeType: state.currentShapeType,
    currentRotation: state.currentRotation,
    holdShapeType: state.holdShapeType,
    previewQueue: [...state.previewQueue],
    mouseX: state.mouseX,
    mouseY: state.mouseY,
    ghostValid: state.ghostValid,
    ghostPath: state.ghostPath ? state.ghostPath.map((step) => ({ ...step })) : null,
    currentShapeHasLegalCarve: state.currentShapeHasLegalCarve,
    holdSwapShapeHasLegalCarve: state.holdSwapShapeHasLegalCarve,
    noLegalCarveAfterHoldSwap: state.noLegalCarveAfterHoldSwap,
    activePiece: clonePiece(state.activePiece),
    queuedPiece: clonePiece(state.queuedPiece),
    escapeStepDelay: state.escapeStepDelay,
    statusReason: state.statusReason,
  };
}

function clonePiece(piece: EscapePiece | null): EscapePiece | null {
  if (!piece) return null;

  return {
    type: piece.type,
    path: piece.path.map((step) => ({ ...step })),
    pathIndex: piece.pathIndex,
    timer: piece.timer,
    color: piece.color,
    startCells: piece.startCells.map((cell) => ({ ...cell })),
  };
}
