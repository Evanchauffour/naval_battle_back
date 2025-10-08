import { GameStatus } from 'generated/prisma';

export interface GameState {
  gameId: string;
  roomId: string;
  players: PlayerGameState[];
  currentTurn: string;
  status: GameStatus;
}

export interface PlayerGameState {
  userId: string;
  ships: ShipPosition[];
  selectedCells: {
    left: number;
    top: number;
  }[];
  isReady: boolean;
}

export interface ShipPosition {
  id: number;
  width: number;
  height: number;
  img: string;
  isKilled: boolean;
  coordinates: {
    left: number;
    top: number;
  }[];
}
