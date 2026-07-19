import type { FormationPlacement, GameCommand, PlayerId } from '@chessforge/engine';

export type ClientMessage =
  | { type: 'create'; placements: FormationPlacement[] }
  | { type: 'join'; roomId: string; placements: FormationPlacement[] }
  | { type: 'command'; command: GameCommand };

export type ServerMessage =
  | { type: 'created'; roomId: string; color: PlayerId }
  | { type: 'joined'; roomId: string; color: PlayerId }
  | { type: 'waiting'; roomId: string }
  | {
      type: 'matchStart';
      roomId: string;
      seed: number;
      yourColor: PlayerId;
      white: FormationPlacement[];
      black: FormationPlacement[];
    }
  | { type: 'command'; command: GameCommand; by: PlayerId }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };
