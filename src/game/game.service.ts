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
        ships: [],
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

  setPlayerBoats(game: GameState, playerId: string, boats: ShipPosition[]) {
    const player = game.players.find((player) => player.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    player.ships = boats;
    return game;
  }

  setPlayerReady(gameId: string, playerId: string, boats: ShipPosition[]) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    const player = game.players.find((player) => player.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    player.isReady = !player.isReady;

    this.setPlayerBoats(game, playerId, boats);

    if (game.players.every((player) => player.isReady)) {
      this.startGame(game.gameId);
    }

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

  setCurrentTurn(
    game: GameState,
    currentPlayerId: string,
    isPlayAgain: boolean,
  ) {
    const otherPlayer = game.players.find(
      (player) => player.userId !== currentPlayerId,
    );
    if (!otherPlayer) {
      throw new Error('Other player not found');
    }
    if (!isPlayAgain) {
      game.currentTurn = otherPlayer.userId;
    } else {
      game.currentTurn = currentPlayerId;
    }
    return game;
  }

  setPlayerSelectedCells(
    gameId: string,
    playerId: string,
    cells: { left: number; top: number },
    isPlayAgain: boolean,
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
    this.setCurrentTurn(game, playerId, isPlayAgain);
    return game;
  }
}
