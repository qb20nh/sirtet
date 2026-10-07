export const COLS = 10;
export const ROWS = 26;
export const VISIBLE_TOP = 2;
export const BASELINE = 21;
export const BLOCK_SIZE = 30;
export const SPAWN_X = Math.floor(COLS / 2) - 1;
const SPAWN_Y = VISIBLE_TOP;
const PATH_AWARE_PACK_TOP = BASELINE - 6;

export type ShapeType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Rotation = 0 | 1 | 2 | 3;
type GameState = 'READY' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'WIN';
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
  pathTimes?: number[];
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
        [-1, 1],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [1, -1],
        [1, 0],
        [1, 1],
        [1, 2],
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
        [1, 0],
        [0, 1],
        [-1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [-1, 0],
        [-1, -1],
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
        [-1, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [0, -1],
        [-1, 0],
        [-1, 1],
      ],
    ],
  },
};

const JLSTZ_SRS_KICKS: Record<string, readonly (readonly [number, number])[]> = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
};

const I_SRS_KICKS: Record<string, readonly (readonly [number, number])[]> = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
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
  cellKey: string;
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

export function getSrsRotationCandidates(
  type: ShapeType,
  x: number,
  y: number,
  from: Rotation,
  to: Rotation,
): PathStep[] {
  if (!isQuarterRotation(from, to)) return [];

  return getSrsKickOffsets(type, from, to).map(([dx, dy]) => ({
    x: x + dx,
    y: y + dy,
    r: to,
  }));
}

function getSrsKickOffsets(
  type: ShapeType,
  from: Rotation,
  to: Rotation,
): readonly (readonly [number, number])[] {
  if (type === 'O') return [[0, 0]];

  const key = `${from}>${to}`;
  const kicks = type === 'I' ? I_SRS_KICKS[key] : JLSTZ_SRS_KICKS[key];

  return kicks ?? [];
}

function isQuarterRotation(from: Rotation, to: Rotation): boolean {
  return to === rotateLeft(from) || to === rotateRight(from);
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

    const moves = createEscapeMoves(board, type, startCells, current);

    for (const move of moves) {
      const key = `${move.x},${move.y},${move.r}`;
      if (visited.has(key)) continue;

      visited.add(key);
      queue.push({
        ...move,
        path: [...current.path, move],
      });
    }
  }

  return null;
}

function hasEscapePath(
  board: Board,
  type: ShapeType,
  startX: number,
  startY: number,
  startR: Rotation,
): boolean {
  const rowBits = createRowBits(board);
  const startRowBits = new Uint16Array(ROWS);
  for (const cell of getCells(type, startX, startY, startR)) {
    if (cell.y >= 0 && cell.y < ROWS) {
      startRowBits[cell.y] |= 1 << cell.x;
    }
  }

  const queue: PathStep[] = [{ x: startX, y: startY, r: startR }];
  const visited = new Set([packEscapeState(startX, startY, startR)]);
  let cursor = 0;
  let iterations = 0;

  while (cursor < queue.length && iterations < 2000) {
    iterations++;
    const current = queue[cursor++];
    if (isExitPositionFast(type, current)) return true;

    const upward = { x: current.x, y: current.y - 1, r: current.r };
    if (canOccupyEscapePathStepFast(rowBits, startRowBits, type, upward)) {
      const key = packEscapeState(upward.x, upward.y, upward.r);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(upward);
      }
    }

    for (const dx of getHorizontalDeltas(current.x)) {
      if (dx === 0) continue;
      const horizontal = { x: current.x + dx, y: current.y, r: current.r };
      if (!canOccupyEscapePathStepFast(rowBits, startRowBits, type, horizontal)) continue;
      const key = packEscapeState(horizontal.x, horizontal.y, horizontal.r);
      if (visited.has(key)) continue;

      visited.add(key);
      queue.push(horizontal);
    }

    for (const rotation of getRotationOptions(current.r)) {
      for (const [dx, dy] of getSrsKickOffsets(type, current.r, rotation)) {
        const candidate = { x: current.x + dx, y: current.y + dy, r: rotation };
        if (!canOccupyEscapePathStepFast(rowBits, startRowBits, type, candidate)) continue;
        const key = packEscapeState(candidate.x, candidate.y, candidate.r);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(candidate);
        }
        break;
      }
    }
  }

  return false;
}

function packEscapeState(x: number, y: number, rotation: Rotation): number {
  return (((y + 8) * (COLS + 8) + x + 4) << 2) | rotation;
}

function isExitPositionFast(type: ShapeType, step: PathStep): boolean {
  return isInSpawnColumn(step) && SHAPES[type].coords[step.r].every(([, dy]) => step.y + dy < 0);
}

function canOccupyEscapePathStepFast(
  rowBits: number[],
  startRowBits: Uint16Array,
  type: ShapeType,
  step: PathStep,
): boolean {
  if (step.y <= SPAWN_Y && !isInSpawnColumn(step)) return false;

  for (const [dx, dy] of SHAPES[type].coords[step.r]) {
    const x = step.x + dx;
    const y = step.y + dy;
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y < 0) continue;

    const bit = 1 << x;
    if ((rowBits[y] & bit) !== 0 && (startRowBits[y] & bit) === 0) return false;
  }

  return true;
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
          const cellKey = [...cellIndexes].sort((left, right) => left - right).join('_');
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
            cellKey,
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
  if (!isPreparedBoardValidInIndex(board, legalityIndex)) {
    legalityIndex.shapeHasLegalCarve.set(type, false);
    return false;
  }

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
    isPreparedBoardValidInIndex(board, legalityIndex) &&
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
  return isPreparedBoardValidInIndex(simBoard, legalityIndex);
}

function isPreparedBoardValidInIndex(board: Board, legalityIndex: CarveLegalityIndex): boolean {
  const boardMask = boardToMask(board);
  const cached = legalityIndex.packValidityByResultMask.get(boardMask);
  if (cached !== undefined) return cached;

  const valid = isPreparedBoardValid(board);
  legalityIndex.packValidityByResultMask.set(boardMask, valid);
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

interface EscapePlayback {
  path: PathStep[];
  pathTimes: number[];
}

const MIN_PLAYBACK_ACTION_BEATS = 0.35;

function getEscapeStepDelay(piece: EscapePiece, baseDelay: number): number {
  const pathTimes = piece.pathTimes;
  if (!pathTimes || piece.pathIndex >= piece.path.length - 1) return baseDelay;

  const currentTime = pathTimes[piece.pathIndex] ?? piece.pathIndex;
  const nextTime = pathTimes[piece.pathIndex + 1] ?? currentTime + 1;

  return Math.max(1, (nextTime - currentTime) * baseDelay);
}

function createRandomizedPathTimes(path: PathStep[], rng: () => number): number[] {
  if (path.length === 0) return [];

  const pathTimes = [0];
  let upwardBeat = 0;
  let index = 1;

  while (index < path.length) {
    const actionStart = index;

    while (index < path.length && !isUpwardPathStep(path[index - 1], path[index])) {
      index++;
    }

    if (index > actionStart) {
      const actionCount = index - actionStart;
      const nextUpwardBeat =
        upwardBeat + Math.max(1, Math.ceil((actionCount + 1) * MIN_PLAYBACK_ACTION_BEATS));
      let previousActionTime = upwardBeat;

      for (let offset = 0; offset < actionCount; offset++) {
        const remainingActions = actionCount - offset - 1;
        const earliest = previousActionTime + MIN_PLAYBACK_ACTION_BEATS;
        const latest = nextUpwardBeat - MIN_PLAYBACK_ACTION_BEATS * (remainingActions + 1);
        const actionTime = earliest + (latest - earliest) * rng();
        pathTimes[actionStart + offset] = actionTime;
        previousActionTime = actionTime;
      }

      upwardBeat = nextUpwardBeat - 1;
    }

    if (index < path.length) {
      upwardBeat++;
      pathTimes[index] = upwardBeat;
      index++;
    }
  }

  return pathTimes;
}

function createRandomizedEscapePlayback(
  board: Board,
  type: ShapeType,
  start: PathStep,
  fallbackPath: PathStep[],
  rng: () => number,
): EscapePlayback {
  const path = createInterleavedEscapePlaybackPath(board, type, start, rng) ?? fallbackPath;

  return {
    path,
    pathTimes: createRandomizedPathTimes(path, rng),
  };
}

function createInterleavedEscapePlaybackPath(
  board: Board,
  type: ShapeType,
  start: PathStep,
  rng: () => number,
): PathStep[] | null {
  if (!canOccupyEscapePlaybackStep(board, type, start)) return null;

  const path: PathStep[] = [start];
  let current = start;

  for (let stepCount = 0; stepCount < 200 && !isExitPosition(type, current); stepCount++) {
    if (shouldTryPlaybackCorrection(current, rng)) {
      const correction = choosePlaybackCorrectionStep(board, type, current, rng);
      if (correction) {
        path.push(correction);
        current = correction;
      }
    }

    let upward = { x: current.x, y: current.y - 1, r: current.r };
    if (!canOccupyEscapePlaybackStep(board, type, upward)) {
      const corrected = forcePlaybackCorrectionBeforeUpward(board, type, current, rng, path);
      if (!corrected) return null;
      current = corrected;
      upward = { x: current.x, y: current.y - 1, r: current.r };
    }

    if (!canOccupyEscapePlaybackStep(board, type, upward)) return null;

    path.push(upward);
    current = upward;
  }

  return isExitPosition(type, current) ? path : null;
}

function shouldTryPlaybackCorrection(current: PathStep, rng: () => number): boolean {
  const correctionCount = getPlaybackCorrectionCount(current);
  if (correctionCount === 0) return false;

  const rowsBeforeSpawnGate = Math.max(1, current.y - SPAWN_Y);
  if (rowsBeforeSpawnGate <= correctionCount + 2) return true;

  return rng() < Math.min(0.8, 0.2 + correctionCount / rowsBeforeSpawnGate);
}

function forcePlaybackCorrectionBeforeUpward(
  board: Board,
  type: ShapeType,
  start: PathStep,
  rng: () => number,
  path: PathStep[],
): PathStep | null {
  let current = start;

  for (let attempt = 0; attempt < 8; attempt++) {
    if (
      canOccupyEscapePlaybackStep(board, type, { x: current.x, y: current.y - 1, r: current.r })
    ) {
      return current;
    }

    const correction = choosePlaybackCorrectionStep(board, type, current, rng);
    if (!correction) return null;

    path.push(correction);
    current = correction;
  }

  return canOccupyEscapePlaybackStep(board, type, { x: current.x, y: current.y - 1, r: current.r })
    ? current
    : null;
}

function getPlaybackCorrectionCount(step: PathStep): number {
  return Math.abs(step.x - SPAWN_X) + getRotationDistance(step.r);
}

function choosePlaybackCorrectionStep(
  board: Board,
  type: ShapeType,
  current: PathStep,
  rng: () => number,
): PathStep | null {
  const moveGroups = createPlaybackCorrectionStepGroups(type, current, rng);

  for (const moves of moveGroups) {
    for (const move of moves) {
      if (canOccupyEscapePlaybackStep(board, type, move)) return move;
    }
  }

  return null;
}

function createPlaybackCorrectionStepGroups(
  type: ShapeType,
  current: PathStep,
  rng: () => number,
): PathStep[][] {
  const moveGroups: PathStep[][] = [];

  if (current.x !== SPAWN_X) {
    moveGroups.push([
      {
        x: current.x + Math.sign(SPAWN_X - current.x),
        y: current.y,
        r: current.r,
      },
    ]);
  }

  for (const rotation of getStandardRotationSteps(current.r, rng)) {
    moveGroups.push(getSrsRotationCandidates(type, current.x, current.y, current.r, rotation));
  }

  shuffleInPlace(moveGroups, rng);

  return moveGroups;
}

function getStandardRotationSteps(rotation: Rotation, rng: () => number): Rotation[] {
  if (rotation === 0) return [];
  if (rotation === 2) {
    const rotations: Rotation[] = [rotateLeft(rotation), rotateRight(rotation)];
    if (rng() < 0.5) rotations.reverse();
    return rotations;
  }

  const left = rotateLeft(rotation);
  const right = rotateRight(rotation);

  return getRotationDistance(left) < getRotationDistance(right) ? [left] : [right];
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function canOccupyEscapePlaybackStep(board: Board, type: ShapeType, step: PathStep): boolean {
  if (step.y <= SPAWN_Y && !isInSpawnColumn(step)) return false;

  return getCells(type, step.x, step.y, step.r).every((cell) => {
    if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) return false;
    return cell.y < 0 || board[cell.y]?.[cell.x] === 0;
  });
}

function isUpwardPathStep(previous: PathStep, current: PathStep): boolean {
  return previous.x === current.x && previous.r === current.r && current.y === previous.y - 1;
}

function createEscapeMoves(
  board: Board,
  type: ShapeType,
  startCells: Cell[],
  current: PathStep,
): PathStep[] {
  const moves: PathStep[] = [];
  const upward = { x: current.x, y: current.y - 1, r: current.r };
  if (canOccupyEscapePathStep(board, type, startCells, upward)) {
    moves.push(upward);
  }

  for (const dx of getHorizontalDeltas(current.x)) {
    if (dx !== 0) {
      const horizontal = { x: current.x + dx, y: current.y, r: current.r };
      if (canOccupyEscapePathStep(board, type, startCells, horizontal)) {
        moves.push(horizontal);
      }
    }
  }

  for (const rotation of getRotationOptions(current.r)) {
    for (const candidate of getSrsRotationCandidates(
      type,
      current.x,
      current.y,
      current.r,
      rotation,
    )) {
      if (canOccupyEscapePathStep(board, type, startCells, candidate)) {
        moves.push(candidate);
        break;
      }
    }
  }

  return moves;
}

function canOccupyEscapePathStep(
  board: Board,
  type: ShapeType,
  startCells: Cell[],
  step: PathStep,
): boolean {
  if (step.y <= SPAWN_Y && !isInSpawnColumn(step)) return false;

  return getCells(type, step.x, step.y, step.r).every((cell) => {
    if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) return false;
    const isSelf = startCells.some((startCell) => startCell.x === cell.x && startCell.y === cell.y);

    return cell.y < 0 || board[cell.y][cell.x] === 0 || isSelf;
  });
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
  return (
    GAME_KEYS.some((gameKey) => gameKey.toLowerCase() === key.toLowerCase()) || code === 'Space'
  );
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

  isPlaying(): boolean {
    return this.state.gameState === 'PLAYING';
  }

  pause(): boolean {
    if (!this.isPlaying()) return false;
    this.state.gameState = 'PAUSED';
    return true;
  }

  resume(timestamp: number): boolean {
    if (this.state.gameState !== 'PAUSED') return false;
    this.state.lastTime = timestamp;
    this.state.gameState = 'PLAYING';
    return true;
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

  endStuckEasyModeGame(): boolean {
    if (
      this.state.gameState !== 'PLAYING' ||
      !this.state.easyMode ||
      !this.state.noLegalCarveAfterHoldSwap
    ) {
      return false;
    }

    this.endGame('No legal carve available in easy mode.');
    return true;
  }

  // Timer accumulation is private; callers only need a new snapshot for visible transitions.
  tick(timestamp: number): boolean {
    if (this.state.gameState !== 'PLAYING') {
      return false;
    }

    const elapsed = Math.max(0, timestamp - this.state.lastTime);
    this.state.lastTime = timestamp;

    if (!this.state.activePiece) {
      return false;
    }

    this.state.activePiece.timer += elapsed;
    let visibleStateChanged = false;

    while (
      this.state.activePiece.timer >=
        getEscapeStepDelay(this.state.activePiece, this.state.escapeStepDelay) &&
      this.state.activePiece.pathIndex < this.state.activePiece.path.length - 1
    ) {
      this.state.activePiece.timer -= getEscapeStepDelay(
        this.state.activePiece,
        this.state.escapeStepDelay,
      );
      this.state.activePiece.pathIndex++;
      visibleStateChanged = true;
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
      visibleStateChanged = true;
      this.validateGhost();
    }

    return visibleStateChanged;
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
    if (!this.state.currentShapeType) return false;

    for (const candidate of getSrsRotationCandidates(
      this.state.currentShapeType,
      this.state.mouseX,
      this.state.mouseY,
      this.state.currentRotation,
      nextRotation,
    )) {
      if (
        !isCursorOutOfVisibleBounds(
          this.state.currentShapeType,
          candidate.x,
          candidate.y,
          nextRotation,
        )
      ) {
        this.state.mouseX = candidate.x;
        this.state.mouseY = candidate.y;
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

    const fallbackPath = this.buildCarvedPiecePath(shapeType, rotation, shift);
    const playback = createRandomizedEscapePlayback(
      this.state.board,
      shapeType,
      { x: this.state.mouseX, y: this.state.mouseY, r: rotation },
      fallbackPath,
      this.rng,
    );
    const newPiece: EscapePiece = {
      type: shapeType,
      path: playback.path,
      pathTimes: playback.pathTimes,
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
  let totalTargetSolid = 0;
  const queue: Cell[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === 1) {
        if (isTargetBlockRow(y)) {
          totalTargetSolid++;
        }
        if (y >= BASELINE) {
          queue.push({ x, y });
        }
      }
    }
  }

  if (totalTargetSolid === 0) {
    return false;
  }

  const visited = new Set<string>();
  let connectedTargetCount = 0;

  for (const startCell of queue) {
    const key = `${startCell.x},${startCell.y}`;
    if (!visited.has(key)) {
      visited.add(key);
      if (isTargetBlockRow(startCell.y)) {
        connectedTargetCount++;
      }
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
        if (isTargetBlockRow(y)) {
          connectedTargetCount++;
        }
      }
    }
  }

  return connectedTargetCount < totalTargetSolid;
}

function isTargetBlockRow(y: number): boolean {
  return y <= BASELINE;
}

function canPackRemainingBlocks(board: Board): boolean {
  const topSolidRow = getTopSolidRow(board);
  if (topSolidRow <= PATH_AWARE_PACK_TOP && !hasPathableFrontierPlacement(board)) {
    return false;
  }
  if (!hasStablePathableCoverageForWallBlocks(board)) {
    return false;
  }

  return canPackRemainingBlocksBySupport(board);
}

function canPackRemainingBlocksBySupport(board: Board): boolean {
  const boardCopy = board.map((row) => [...row]);
  return removeForcedPlacements(boardCopy);
}

function isSupportPackableBoard(board: Board): boolean {
  return !hasFloatingBlocks(board) && canPackRemainingBlocksBySupport(board);
}

function hasPathableFrontierPlacement(board: Board): boolean {
  const target = findMostConstrainedFrontierCell(board, new Set());
  return !target || target.placements.length > 0;
}

function hasStablePathableCoverageForWallBlocks(board: Board): boolean {
  const rowBits = createRowBits(board);
  const escapePathByPlacement = new Map<number, boolean>();
  const pathablePlacementIds = new Set<number>();
  const stableResultByPlacement = new Map<number, boolean>();

  for (let y = 0; y < BASELINE; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== 1) continue;
      if (!isWallAdjacentColumn(x)) continue;
      if (
        findUniquePlacementsForCell(
          board,
          rowBits,
          x,
          y,
          true,
          1,
          escapePathByPlacement,
          pathablePlacementIds,
          false,
          stableResultByPlacement,
        ).length === 0
      ) {
        return false;
      }
    }
  }

  return true;
}

function isWallAdjacentColumn(x: number): boolean {
  return x <= 1 || x >= COLS - 2;
}

function findMostConstrainedFrontierCell(
  board: Board,
  pathablePlacementIds: Set<number>,
): { placements: Cell[][] } | null {
  const rowBits = createRowBits(board);
  const escapePathByPlacement = new Map<number, boolean>();
  let fallbackCell: Cell | null = null;

  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y <= BASELINE; y++) {
      if (board[y][x] !== 1) continue;

      const placements = findUniquePlacementsForCell(
        board,
        rowBits,
        x,
        y,
        true,
        2,
        escapePathByPlacement,
        pathablePlacementIds,
        true,
      );
      if (placements.length <= 1) return { placements };
      fallbackCell ??= { x, y };
      break;
    }
  }

  return fallbackCell
    ? {
        placements: findUniquePlacementsForCell(
          board,
          rowBits,
          fallbackCell.x,
          fallbackCell.y,
          true,
          Number.POSITIVE_INFINITY,
          escapePathByPlacement,
          pathablePlacementIds,
          true,
        ),
      }
    : null;
}

function removeForcedPlacements(board: Board): boolean {
  let changed = true;

  while (changed) {
    changed = false;
    const rowBits = createRowBits(board);

    for (let y = 0; y <= BASELINE; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] !== 1) continue;

        const placements = findUniquePlacementsForCell(board, rowBits, x, y);
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
  for (let y = 0; y <= BASELINE; y++) {
    if (board[y].some((cell) => cell === 1)) return y;
  }

  return ROWS;
}

function findUniquePlacementsForCell(
  board: Board,
  rowBits: number[],
  x: number,
  y: number,
  requireEscapePath = false,
  maxPlacements = Number.POSITIVE_INFINITY,
  escapePathByPlacement?: Map<number, boolean>,
  pathablePlacementIds?: Set<number>,
  requireSupportPackableResult = false,
  stableResultByPlacement?: Map<number, boolean>,
): Cell[][] {
  const placements: Cell[][] = [];
  const seen = new Set<string>();
  const index = cellIndex({ x, y });

  for (const placementId of PLACEMENT_METADATA.filledPlacementIdsByCell[index]) {
    const placement = PLACEMENT_METADATA.placements[placementId];
    if (seen.has(placement.cellKey)) continue;
    if (countFilledIndexes(rowBits, placement.cellIndexes) !== placement.cellIndexes.length)
      continue;
    if (
      countFilledIndexes(rowBits, placement.supportIndexes) +
        (placement.hasFloorSupport ? 1 : 0) ===
      0
    ) {
      continue;
    }
    if (requireEscapePath) {
      let hasPath = pathablePlacementIds?.has(placementId)
        ? true
        : escapePathByPlacement?.get(placementId);
      if (hasPath === undefined) {
        hasPath = hasEscapePath(
          board,
          placement.type,
          placement.x,
          placement.y,
          placement.rotation,
        );
        escapePathByPlacement?.set(placementId, hasPath);
        if (hasPath) {
          pathablePlacementIds?.add(placementId);
        }
      }
      if (!hasPath) continue;
      if (
        requireSupportPackableResult &&
        !isSupportPackableBoard(createBoardAfterCarve(board, placement.cells))
      ) {
        continue;
      }
      const cachedStableResult = stableResultByPlacement?.get(placementId);
      if (cachedStableResult === false) continue;
      if (cachedStableResult === undefined && stableResultByPlacement) {
        const stableResult = !hasFloatingBlocks(createBoardAfterCarve(board, placement.cells));
        stableResultByPlacement.set(placementId, stableResult);
        if (!stableResult) continue;
      }
    }

    seen.add(placement.cellKey);
    placements.push(placement.cells);
    if (placements.length >= maxPlacements) return placements;
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
    pathTimes: piece.pathTimes ? [...piece.pathTimes] : undefined,
    pathIndex: piece.pathIndex,
    timer: piece.timer,
    color: piece.color,
    startCells: piece.startCells.map((cell) => ({ ...cell })),
  };
}
