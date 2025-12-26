import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { GameStatus } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { RoomService } from 'src/room/room.service';
import { UserStatsService } from 'src/user-stats/user-stats.service';
import { GameState, ShipPosition, Message } from './types';

@Injectable()
export class GameService {
  constructor(
    @Inject(forwardRef(() => RoomService))
    private roomService: RoomService,
    private prisma: PrismaService,
    private userStatsService: UserStatsService,
  ) {}
  private games: GameState[] = [];
  private playerGames: Map<string, Set<string>> = new Map(); // userId -> Set<gameId>
  private gameMessages: Map<string, Message[]> = new Map(); // gameId -> Message[]

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
      messages: [],
    };

    this.games.push(gameState);
    this.gameMessages.set(game.id, []);

    // Enregistrer les joueurs dans le jeu
    room.players.forEach((player) => {
      if (!this.playerGames.has(player.id)) {
        this.playerGames.set(player.id, new Set());
      }
      this.playerGames.get(player.id)!.add(game.id);
    });

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

    // Récupérer les stats actuelles
    const winnerStats = await this.userStatsService.getOrCreateStats(winnerId);
    const loserStats = await this.userStatsService.getOrCreateStats(loserId);

    const WIN_ELO_CHANGE = 20;
    const LOSE_ELO_CHANGE = -15;

    const winnerEloBefore = winnerStats.elo;
    const winnerEloAfter = winnerEloBefore + WIN_ELO_CHANGE;

    const loserEloBefore = loserStats.elo;
    const loserEloAfter = Math.max(0, loserEloBefore + LOSE_ELO_CHANGE); // Elo ne peut pas être négatif

    // Mettre à jour les stats des joueurs
    await Promise.all([
      this.userStatsService.updateStatsAfterGame(
        winnerId,
        true,
        WIN_ELO_CHANGE,
      ),
      this.userStatsService.updateStatsAfterGame(
        loserId,
        false,
        LOSE_ELO_CHANGE,
      ),
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
    });

    if (!gamePlayer) {
      throw new NotFoundException('Game player not found');
    }

    // Récupérer les stats de l'utilisateur
    const userStats = await this.userStatsService.getStatsByUserId(userId);

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

    const highestElo = highestRatingHistory?.eloAfter || userStats.elo;

    return {
      isWinner: gamePlayer.isWinner,
      eloChange: gamePlayer.eloChange || 0,
      currentElo: userStats.elo,
      highestElo,
      streak: userStats.streak,
    };
  }

  async leaveGame(leavingUserId: string): Promise<GameState | null> {
    const gameId = Array.from(this.playerGames.get(leavingUserId) || []).at(0);
    if (!gameId) {
      return null;
    }

    let game: GameState | null = null;
    try {
      game = this.getGameStateById(gameId);
    } catch (error) {
      // Le jeu n'existe plus
      return null;
    }
    
    if (!game) {
      return null;
    }

    // Si le jeu est déjà terminé, ne rien faire
    if (game.status === GameStatus.ENDED) {
      return game;
    }

    // Retirer le joueur du jeu
    this.removePlayerFromGame(gameId, leavingUserId);

    // Si le jeu est en ORGANIZING_BOATS, on peut simplement le supprimer
    if (game.status === GameStatus.ORGANIZING_BOATS) {
      this.games = this.games.filter((g) => g.gameId !== gameId);
      this.gameMessages.delete(gameId);
      return null;
    }

    // Si le jeu est en cours (IN_GAME), c'est un forfait
    if (game.status === GameStatus.IN_GAME) {
      const winnerId = game.players.find(
        (player) => player.userId !== leavingUserId,
      )?.userId;

      if (!winnerId) {
        throw new Error('Winner not found');
      }

      // Marquer le joueur qui part
      game.leavingUserId = leavingUserId;
      game.status = GameStatus.ENDED;

      // Mettre à jour la base de données
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: GameStatus.ENDED,
        },
      });

      // Mettre à jour les stats (forfait = perte pour celui qui part)
      const winnerStats = await this.userStatsService.getOrCreateStats(winnerId);
      const loserStats = await this.userStatsService.getOrCreateStats(leavingUserId);

      const WIN_ELO_CHANGE = 20;
      const LOSE_ELO_CHANGE = -15;

      const winnerEloBefore = winnerStats.elo;
      const winnerEloAfter = winnerEloBefore + WIN_ELO_CHANGE;
      const loserEloBefore = loserStats.elo;
      const loserEloAfter = Math.max(0, loserEloBefore + LOSE_ELO_CHANGE);

      await Promise.all([
        this.userStatsService.updateStatsAfterGame(
          winnerId,
          true,
          WIN_ELO_CHANGE,
        ),
        this.userStatsService.updateStatsAfterGame(
          leavingUserId,
          false,
          LOSE_ELO_CHANGE,
        ),
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
            userId: leavingUserId,
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
            userId: leavingUserId,
          },
          data: {
            isWinner: false,
            eloChange: LOSE_ELO_CHANGE,
          },
        }),
      ]);
    }

    return game;
  }

  removePlayerFromGame(gameId: string, userId: string) {
    const games = this.playerGames.get(userId);
    if (games) {
      games.delete(gameId);
      if (games.size === 0) {
        this.playerGames.delete(userId);
      }
    }
  }

  getPlayerGames(userId: string): Set<string> {
    return this.playerGames.get(userId) || new Set();
  }

  async getInProgressGame(userId: string) {
    const gameIds = Array.from(this.playerGames.get(userId) || []);
    for (const gameId of gameIds) {
      const game = this.games.find((g) => g.gameId === gameId);
      // Retourner seulement si la game est en cours (IN_GAME) et pas terminée (ENDED)
      if (game && game.status === GameStatus.IN_GAME) {
        return { gameId: game.gameId, status: game.status };
      }
    }
    return { gameId: null, status: null };
  }

  async addMessage(
    gameId: string,
    message: string,
    userId: string,
    username: string,
  ): Promise<Message> {
    const game = this.getGameStateById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const messageData: Message = {
      userId,
      username,
      message,
      timestamp: new Date(),
    };

    if (!game.messages) {
      game.messages = [];
    }
    game.messages.push(messageData);

    // Garder seulement les 100 derniers messages
    if (game.messages.length > 100) {
      game.messages = game.messages.slice(-100);
    }

    return messageData;
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
