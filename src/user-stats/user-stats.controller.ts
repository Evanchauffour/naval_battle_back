import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserStatsService } from './user-stats.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/current-user.decorator';
import type { User } from 'generated/prisma';

@Controller('user-stats')
export class UserStatsController {
  constructor(private readonly userStatsService: UserStatsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getStats(@CurrentUser() user: User) {
    return await this.userStatsService.getStatsByUserId(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('leaderboard')
  async getLeaderboard(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return await this.userStatsService.getLeaderboard(
      page || 1,
      limit || 10,
    );
  }
}
