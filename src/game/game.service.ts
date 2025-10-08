import { Injectable } from '@nestjs/common';
import { GameStatus } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { RoomService } from 'src/room/room.service';
import { GameState, ShipPosition } from './types';

@Injectable()
export class GameService {
  constructor(
    private roomService: RoomService,
    private prisma: PrismaService,
  ) {}
  private games: GameState[] = [];

  async createGame(roomId: string) {
    const room = this.roomService.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    room.status = 'in-game';

    const game = await this.prisma.game.create({
      data: {
        roomId: roomId,
        status: GameStatus.ORGANIZING_BOATS,
        duration: 0,
        GamePlayer: {
          create: room.players.map((player) => ({
            userId: player.id,
          })),
        },
      },
    });

    const gameState: GameState = {
      gameId: game.id,
      roomId: roomId,
      players: room.players.map((player) => ({
        userId: player.id,
        ships: [
          {
            id: 0,
            width: 5,
            height: 1,
            img: '/boats/boat5.png',
            isKilled: false,
            coordinates: [
              { left: 1, top: 1 },
              { left: 2, top: 1 },
              { left: 3, top: 1 },
              { left: 4, top: 1 },
              { left: 5, top: 1 },
            ],
          },
          {
            id: 1,
            width: 1,
            height: 4,
            img: '/boats/boat4.png',
            isKilled: false,
            coordinates: [
              { left: 1, top: 1 },
              { left: 1, top: 2 },
              { left: 1, top: 3 },
              { left: 1, top: 4 },
            ],
          },
          {
            id: 2,
            width: 3,
            height: 1,
            img: '/boats/boat3.png',
            isKilled: false,
            coordinates: [
              { left: 1, top: 1 },
              { left: 2, top: 1 },
              { left: 3, top: 1 },
            ],
          },
          {
            id: 3,
            width: 3,
            height: 1,
            img: '/boats/boat3.png',
            isKilled: false,
            coordinates: [
              { left: 1, top: 1 },
              { left: 2, top: 1 },
              { left: 3, top: 1 },
            ],
          },
          {
            id: 4,
            width: 2,
            height: 1,
            img: '/boats/boat2.png',
            isKilled: false,
            coordinates: [
              { left: 1, top: 1 },
              { left: 2, top: 1 },
            ],
          },
        ],
        selectedCells: [],
        isReady: false,
      })),
      currentTurn: room.players[0].id,
      status: game.status,
    };

    this.games.push(gameState);

    return gameState;
  }

  getGameStateById(id: string) {
    const game = this.games.find((game) => game.gameId === id);
    if (!game) {
      throw new Error('Game not found');
    }
    return game;
  }

  setPlayerBoats(gameId: string, playerId: string, boats: ShipPosition[]) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    const player = game.players.find((player) => player.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    player.ships = boats;
    return game;
  }

  setPlayerReady(gameId: string, playerId: string) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    const player = game.players.find((player) => player.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    player.isReady = !player.isReady;
    return game;
  }

  startGame(gameId: string) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    game.status = GameStatus.IN_GAME;
    return game;
  }

  setPlayerSelectedCells(
    gameId: string,
    playerId: string,
    cells: { left: number; top: number },
  ) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    const player = game.players.find((player) => player.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    player.selectedCells.push(cells);
    return game;
  }
}
