import {
  BASELINE,
  BLOCK_SIZE,
  COLS,
  type GameSnapshot,
  getCells,
  ROWS,
  SHAPES,
  type ShapeType,
  VISIBLE_TOP,
} from './game';

export function drawShapePreview(
  type: ShapeType | null,
  context: CanvasRenderingContext2D,
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  dimmed = false,
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!type) return;

  const cells = SHAPES[type].coords[0];
  const minX = Math.min(...cells.map((cell) => cell[0]));
  const maxX = Math.max(...cells.map((cell) => cell[0]));
  const minY = Math.min(...cells.map((cell) => cell[1]));
  const maxY = Math.max(...cells.map((cell) => cell[1]));
  const offsetX = (canvas.width - (maxX - minX + 1) * 20) / 2 - minX * 20;
  const offsetY = (canvas.height - (maxY - minY + 1) * 20) / 2 - minY * 20;

  context.fillStyle = SHAPES[type].color;
  context.globalAlpha = dimmed ? 0.3 : 1;

  for (const cell of cells) {
    context.fillRect(offsetX + cell[0] * 20, offsetY + cell[1] * 20, 19, 19);
  }

  context.globalAlpha = 1;
}

export function drawGame(
  context: CanvasRenderingContext2D,
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  state: GameSnapshot,
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(0, -VISIBLE_TOP * BLOCK_SIZE);

  drawGrid(context, canvas.width);
  drawBoard(context, state);
  drawBaseline(context, canvas.width);
  drawQueuedPiece(context, state);
  drawActivePiece(context, state);
  drawGhost(context, state);

  context.restore();
}

function drawGrid(context: CanvasRenderingContext2D, width: number): void {
  context.strokeStyle = '#334155';
  context.lineWidth = 1;

  for (let col = 0; col <= COLS; col++) {
    context.beginPath();
    context.moveTo(col * BLOCK_SIZE, VISIBLE_TOP * BLOCK_SIZE);
    context.lineTo(col * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    context.stroke();
  }

  for (let row = VISIBLE_TOP; row <= ROWS; row++) {
    context.beginPath();
    context.moveTo(0, row * BLOCK_SIZE);
    context.lineTo(width, row * BLOCK_SIZE);
    context.stroke();
  }
}

function drawBoard(context: CanvasRenderingContext2D, state: GameSnapshot): void {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (state.board[row][col] !== 1) continue;

      context.fillStyle = '#475569';
      context.fillRect(col * BLOCK_SIZE + 1, row * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      context.fillStyle = 'rgba(255,255,255,0.05)';
      context.fillRect(col * BLOCK_SIZE + 1, row * BLOCK_SIZE + 1, BLOCK_SIZE - 2, 4);
    }
  }
}

function drawBaseline(context: CanvasRenderingContext2D, width: number): void {
  context.fillStyle = 'rgba(245, 158, 11, 0.2)';
  context.fillRect(0, BASELINE * BLOCK_SIZE, width, BLOCK_SIZE);
  context.strokeStyle = '#f59e0b';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, (BASELINE + 1) * BLOCK_SIZE);
  context.lineTo(width, (BASELINE + 1) * BLOCK_SIZE);
  context.stroke();
}

function drawQueuedPiece(context: CanvasRenderingContext2D, state: GameSnapshot): void {
  if (!state.queuedPiece) return;

  context.fillStyle = state.queuedPiece.color;
  context.globalAlpha = 0.3;
  fillCells(context, state.queuedPiece.startCells);

  context.globalAlpha = 1;
  context.strokeStyle = state.queuedPiece.color;
  context.lineWidth = 2;

  for (const cell of state.queuedPiece.startCells) {
    context.strokeRect(
      cell.x * BLOCK_SIZE + 2,
      cell.y * BLOCK_SIZE + 2,
      BLOCK_SIZE - 4,
      BLOCK_SIZE - 4,
    );
  }
}

function drawActivePiece(context: CanvasRenderingContext2D, state: GameSnapshot): void {
  if (!state.activePiece) return;

  const activeStep = state.activePiece.path[state.activePiece.pathIndex];
  const cells = getCells(state.activePiece.type, activeStep.x, activeStep.y, activeStep.r);
  context.fillStyle = state.activePiece.color;
  context.shadowColor = state.activePiece.color;
  context.shadowBlur = 10;
  fillCells(context, cells);

  context.shadowBlur = 0;
}

function fillCells(
  context: CanvasRenderingContext2D,
  cells: Array<{ x: number; y: number }>,
): void {
  for (const cell of cells) {
    context.fillRect(
      cell.x * BLOCK_SIZE + 2,
      cell.y * BLOCK_SIZE + 2,
      BLOCK_SIZE - 4,
      BLOCK_SIZE - 4,
    );
  }
}

function drawGhost(context: CanvasRenderingContext2D, state: GameSnapshot): void {
  if (state.gameState !== 'PLAYING') return;

  if (state.ghostValid && state.ghostPath) {
    context.strokeStyle = 'rgba(34, 197, 94, 0.3)';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(
      state.ghostPath[0].x * BLOCK_SIZE + BLOCK_SIZE / 2,
      state.ghostPath[0].y * BLOCK_SIZE + BLOCK_SIZE / 2,
    );

    for (let index = 1; index < state.ghostPath.length; index++) {
      context.lineTo(
        state.ghostPath[index].x * BLOCK_SIZE + BLOCK_SIZE / 2,
        state.ghostPath[index].y * BLOCK_SIZE + BLOCK_SIZE / 2,
      );
    }

    context.stroke();
  }

  const cells = getCells(state.currentShapeType, state.mouseX, state.mouseY, state.currentRotation);
  context.fillStyle = state.ghostValid ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';

  for (const cell of cells) {
    context.fillRect(
      cell.x * BLOCK_SIZE + 1,
      cell.y * BLOCK_SIZE + 1,
      BLOCK_SIZE - 2,
      BLOCK_SIZE - 2,
    );
  }
}
