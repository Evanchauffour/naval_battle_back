import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserStatsService {
  constructor(private prisma: PrismaService) {}

  async getStatsByUsername(username: string) {
    // First find the user by username
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return null;
    }

    // Then get stats by userId
    return await this.getStatsByUserId(user.id);
  }

  async getStatsByUserId(userId: string) {
    const userStat = await this.prisma.userStat.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!userStat) {
      // Si les stats n'existent pas, les créer avec les valeurs par défaut
      const newUserStat = await this.prisma.userStat.create({
        data: {
          userId,
          elo: 1000,
          streak: 0,
          highestStreak: 0,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      // Récupérer le meilleur ELO depuis l'historique
      const highestRatingHistory = await this.prisma.ratingHistory.findFirst({
        where: { userId },
        orderBy: { eloAfter: 'desc' },
        select: { eloAfter: true },
      });

      return {
        ...newUserStat,
        highestElo: highestRatingHistory?.eloAfter || newUserStat.elo,
      };
    }

    // Récupérer le meilleur ELO depuis l'historique
    const highestRatingHistory = await this.prisma.ratingHistory.findFirst({
      where: { userId },
      orderBy: { eloAfter: 'desc' },
      select: { eloAfter: true },
    });

    return {
      ...userStat,
      highestElo: highestRatingHistory?.eloAfter || userStat.elo,
    };
  }

  async updateStatsAfterGame(
    userId: string,
    isWinner: boolean,
    eloChange: number,
  ) {
    const currentStats = await this.getStatsByUserId(userId);

    const newElo = Math.max(0, currentStats.elo + eloChange);
    const newStreak = isWinner
      ? currentStats.streak + 1
      : Math.max(0, currentStats.streak - 1);
    const newHighestStreak = Math.max(currentStats.highestStreak, newStreak);
    const newGamesPlayed = currentStats.gamesPlayed + 1;
    const newWins = isWinner ? currentStats.wins + 1 : currentStats.wins;
    const newLosses = isWinner ? currentStats.losses : currentStats.losses + 1;

    return await this.prisma.userStat.update({
      where: { userId },
      data: {
        elo: newElo,
        streak: newStreak,
        highestStreak: newHighestStreak,
        gamesPlayed: newGamesPlayed,
        wins: newWins,
        losses: newLosses,
      },
    });
  }

  async getOrCreateStats(userId: string) {
    let userStat = await this.prisma.userStat.findUnique({
      where: { userId },
    });

    if (!userStat) {
      userStat = await this.prisma.userStat.create({
        data: {
          userId,
          elo: 1000,
          streak: 0,
          highestStreak: 0,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
        },
      });
    }

    return userStat;
  }

  async getLeaderboard(page: number, limit: number) {
    const userStats = await this.prisma.userStat.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        elo: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.userStat.count();

    return {
      users: userStats
        .filter(
          (
            userStat,
          ): userStat is typeof userStat & {
            user: NonNullable<typeof userStat.user>;
          } => userStat.user !== null,
        )
        .map((userStat, idx) => ({
          id: userStat.userId,
          username: userStat.user.username,
          email: userStat.user.email,
          elo: userStat.elo,
          index: (page - 1) * limit + idx + 1,
          gamesPlayed: userStat.gamesPlayed,
          wins: userStat.wins,
          losses: userStat.losses,
          streak: userStat.streak,
          highestStreak: userStat.highestStreak,
        })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createUserStats(userId: string) {
    return await this.prisma.userStat.create({
      data: {
        userId,
        elo: 1000,
        streak: 0,
        highestStreak: 0,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
      },
    });
  }
}
