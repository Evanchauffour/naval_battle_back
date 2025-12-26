import { GameStatus } from 'generated/prisma';

export interface GameState {
  gameId: string;
  roomId: string;
  players: PlayerGameState[];
  currentTurn: string;
  status: GameStatus;
  leavingUserId?: string; // ID du joueur qui a quitté (forfait)
  messages?: Message[]; // Messages du chat
}

export interface Message {
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
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
