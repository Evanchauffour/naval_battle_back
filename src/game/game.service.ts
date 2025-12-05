import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { GameStatus } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { RoomService } from 'src/room/room.service';
import { GameState, ShipPosition } from './types';

@Injectable()
export class GameService {
  constructor(
    @Inject(forwardRef(() => RoomService))
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

  async endGame(gameId: string, winnerId: string) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const winner = game.players.find((player) => player.userId === winnerId);
    if (!winner) {
      throw new Error('Winner is not a player in this game');
    }

    game.status = GameStatus.ENDED;

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.ENDED,
      },
    });

    const loserId = game.players.find(
      (player) => player.userId !== winnerId,
    )?.userId;

    if (!loserId) {
      throw new Error('Loser not found');
    }

    const winnerUser = await this.prisma.user.findUnique({
      where: { id: winnerId },
      select: { elo: true },
    });

    const loserUser = await this.prisma.user.findUnique({
      where: { id: loserId },
      select: { elo: true },
    });

    if (!winnerUser || !loserUser) {
      throw new Error('User not found');
    }

    const WIN_ELO_CHANGE = 20;
    const LOSE_ELO_CHANGE = -15;

    const winnerEloBefore = winnerUser.elo;
    const winnerEloAfter = winnerEloBefore + WIN_ELO_CHANGE;

    const loserEloBefore = loserUser.elo;
    const loserEloAfter = Math.max(0, loserEloBefore + LOSE_ELO_CHANGE); // Elo ne peut pas être négatif

    await Promise.all([
      this.prisma.user.update({
        where: { id: winnerId },
        data: { elo: winnerEloAfter },
      }),
      this.prisma.user.update({
        where: { id: loserId },
        data: { elo: loserEloAfter },
      }),
      this.prisma.ratingHistory.create({
        data: {
          userId: winnerId,
          gameId,
          eloBefore: winnerEloBefore,
          eloAfter: winnerEloAfter,
        },
      }),
      this.prisma.ratingHistory.create({
        data: {
          userId: loserId,
          gameId,
          eloBefore: loserEloBefore,
          eloAfter: loserEloAfter,
        },
      }),
      this.prisma.gamePlayer.updateMany({
        where: {
          gameId,
          userId: winnerId,
        },
        data: {
          isWinner: true,
          eloChange: WIN_ELO_CHANGE,
        },
      }),
      this.prisma.gamePlayer.updateMany({
        where: {
          gameId,
          userId: loserId,
        },
        data: {
          isWinner: false,
          eloChange: LOSE_ELO_CHANGE,
        },
      }),
    ]);

    return game;
  }

  async getGameResultById(gameId: string, userId: string) {
    const gamePlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        gameId,
        userId,
      },
      include: {
        user: {
          select: {
            elo: true,
          },
        },
      },
    });

    if (!gamePlayer) {
      throw new NotFoundException('Game player not found');
    }

    // Récupérer le highestElo depuis toutes les RatingHistory de l'utilisateur
    const highestRatingHistory = await this.prisma.ratingHistory.findFirst({
      where: {
        userId,
      },
      orderBy: {
        eloAfter: 'desc',
      },
      select: {
        eloAfter: true,
      },
    });

    const highestElo = highestRatingHistory?.eloAfter || gamePlayer.user.elo;

    return {
      isWinner: gamePlayer.isWinner,
      eloChange: gamePlayer.eloChange || 0,
      currentElo: gamePlayer.user.elo,
      highestElo,
      streak: 0,
    };
  }

  async getUserHistory(userId: string, page: number, limit: number) {
    const gamePlayers = await this.prisma.gamePlayer.findMany({
      where: {
        userId,
        game: {
          status: GameStatus.ENDED,
        },
      },
      select: {
        isWinner: true,
        eloChange: true,
        game: {
          select: {
            id: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { game: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.gamePlayer.count({
      where: {
        userId,
        game: {
          status: GameStatus.ENDED,
        },
      },
    });

    return {
      games: gamePlayers.map((gamePlayer) => ({
        id: gamePlayer.game.id,
        createdAt: gamePlayer.game.createdAt,
        isWinner: gamePlayer.isWinner,
        eloChange: gamePlayer.eloChange,
        status: gamePlayer.game.status,
        // Pour naval battle, on n'a pas de score, donc on met des valeurs par défaut
        currentPlayerScore: gamePlayer.isWinner ? 1 : 0,
        opponentScore: gamePlayer.isWinner ? 0 : 1,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
