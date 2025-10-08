export interface Player {
  id: string;
  name?: string;
  isReady: boolean;
}

export interface Room {
  id: string;
  creatorId: string;
  players: Player[];
  createdAt: Date;
  status: 'lobby' | 'in-game' | 'ended';
}
