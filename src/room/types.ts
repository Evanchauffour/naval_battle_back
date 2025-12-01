export interface Player {
  id: string;
  name?: string;
  isReady: boolean;
}

export interface Room {
  id: string;
  creatorId: string;
  code: number;
  players: Player[];
  createdAt: Date;
  elo?: number;
  isPrivate: boolean;
  status: 'lobby' | 'in-game' | 'ended';
}
