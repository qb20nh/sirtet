import type { GameSnapshot } from './game';

export interface OverlayContent {
  visible: boolean;
  title: string;
  titleTone: 'neutral' | 'danger' | 'success';
  description: string;
  buttonLabel: string;
}

export interface StatusPresentation {
  text: string;
  tone: 'ready' | 'stable' | 'warning' | 'danger';
  pulsing: boolean;
}

export interface ControlHint {
  keys: string;
  label: string;
}

export const CONTROL_HINTS: ControlHint[] = [
  { keys: 'WASD / Arrows', label: 'Move cursor' },
  { keys: 'Z / X', label: 'Rotate' },
  { keys: 'C / Shift', label: 'Swap/Hold' },
  { keys: 'Space / Enter', label: 'Carve block' },
];

export function getOverlayContent(state: GameSnapshot): OverlayContent {
  if (state.gameState === 'GAMEOVER') {
    return {
      visible: true,
      title: 'SYSTEM FAILURE',
      titleTone: 'danger',
      description: state.statusReason,
      buttonLabel: 'RESTART SEQUENCE',
    };
  }

  if (state.gameState === 'WIN') {
    return {
      visible: true,
      title: 'CLEARED!',
      titleTone: 'success',
      description: 'You have completely cleared the solid mass!',
      buttonLabel: 'PLAY AGAIN',
    };
  }

  return {
    visible: state.gameState !== 'PLAYING',
    title: 'REVERSE TETRIS',
    titleTone: 'neutral',
    description: "Carve blocks out. Keep up the pace, and don't get crushed!",
    buttonLabel: 'Start Carving',
  };
}

export function getStatusPresentation(state: GameSnapshot): StatusPresentation {
  if (state.gameState !== 'PLAYING') {
    return {
      text: 'Waiting to start...',
      tone: 'stable',
      pulsing: false,
    };
  }

  if (!state.firstCarveDone) {
    return {
      text: 'Waiting for first carve...',
      tone: 'ready',
      pulsing: false,
    };
  }

  if (state.noLegalCarveAfterHoldSwap) {
    return {
      text: 'No legal carve, even after hold.',
      tone: 'danger',
      pulsing: true,
    };
  }

  if (state.queuedPiece) {
    return {
      text: 'Queue Full! Next carve skips!',
      tone: 'warning',
      pulsing: true,
    };
  }

  if (state.easyMode && !state.activePiece) {
    return {
      text: 'Easy Mode: carve when ready.',
      tone: 'stable',
      pulsing: false,
    };
  }

  return {
    text: 'Flow Active! Queue a piece!',
    tone: 'danger',
    pulsing: true,
  };
}
