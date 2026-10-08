import {
  COLS,
  findLegalCarvePath,
  type GameSnapshot,
  type PathStep,
  type ReverseTetrisEngine,
  ROWS,
  type Rotation,
} from '../src/game';

export function moveToValidPlacement(
  engine: ReverseTetrisEngine,
  command = (key: string) => engine.handleKey(key),
): PathStep {
  const placement = findValidPlacement(engine.snapshot());
  if (!placement) {
    throw new Error('No valid placement found for test shape.');
  }

  moveCursor(engine, placement, command);

  return placement;
}

function findValidPlacement(state: GameSnapshot): PathStep | null {
  if (!state.currentShapeType) return null;

  for (let rotationIndex = 0; rotationIndex < 4; rotationIndex++) {
    const rotation = rotationIndex as Rotation;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const path = findLegalCarvePath(state.board, state.currentShapeType, x, y, rotation);

        if (path) return { x, y, r: rotation };
      }
    }
  }

  return null;
}

function moveCursor(
  engine: ReverseTetrisEngine,
  target: PathStep,
  command: (key: string) => boolean,
): void {
  for (let guard = 0; engine.snapshot().currentRotation !== target.r && guard < 4; guard++) {
    command('x');
  }

  while (engine.snapshot().mouseX > target.x) command('ArrowLeft');
  while (engine.snapshot().mouseX < target.x) command('ArrowRight');
  while (engine.snapshot().mouseY > target.y) command('ArrowUp');
  while (engine.snapshot().mouseY < target.y) command('ArrowDown');
}
