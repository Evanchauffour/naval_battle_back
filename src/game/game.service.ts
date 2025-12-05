import { Injectable, NotFoundException } from '@nestjs/common';
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

  async endGame(gameId: string, winnerId: string) {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Vérifier que le winnerId est bien un joueur de la partie
    const winner = game.players.find((player) => player.userId === winnerId);
    if (!winner) {
      throw new Error('Winner is not a player in this game');
    }

    // Mettre à jour le status du jeu en mémoire
    game.status = GameStatus.ENDED;

    // Mettre à jour la base de données
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.ENDED,
      },
    });

    // Mettre à jour les GamePlayer pour marquer le gagnant et le perdant
    const loserId = game.players.find(
      (player) => player.userId !== winnerId,
    )?.userId;

    if (!loserId) {
      throw new Error('Loser not found');
    }

    // Récupérer l'elo actuel des joueurs
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

    // Constantes pour les changements d'elo
    const WIN_ELO_CHANGE = 20;
    const LOSE_ELO_CHANGE = -15;

    // Calculer les nouveaux elo
    const winnerEloBefore = winnerUser.elo;
    const winnerEloAfter = winnerEloBefore + WIN_ELO_CHANGE;

    const loserEloBefore = loserUser.elo;
    const loserEloAfter = Math.max(0, loserEloBefore + LOSE_ELO_CHANGE); // Elo ne peut pas être négatif

    // Mettre à jour les elo des utilisateurs et créer les RatingHistory
    await Promise.all([
      // Mettre à jour l'elo du gagnant
      this.prisma.user.update({
        where: { id: winnerId },
        data: { elo: winnerEloAfter },
      }),
      // Mettre à jour l'elo du perdant
      this.prisma.user.update({
        where: { id: loserId },
        data: { elo: loserEloAfter },
      }),
      // Créer RatingHistory pour le gagnant
      this.prisma.ratingHistory.create({
        data: {
          userId: winnerId,
          gameId,
          eloBefore: winnerEloBefore,
          eloAfter: winnerEloAfter,
        },
      }),
      // Créer RatingHistory pour le perdant
      this.prisma.ratingHistory.create({
        data: {
          userId: loserId,
          gameId,
          eloBefore: loserEloBefore,
          eloAfter: loserEloAfter,
        },
      }),
      // Mettre à jour GamePlayer pour le gagnant
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
      // Mettre à jour GamePlayer pour le perdant
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
      streak: 0, // Pas de système de streak pour l'instant
    };
  }
}
