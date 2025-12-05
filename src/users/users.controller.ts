import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/current-user.decorator';
import type { User } from 'generated/prisma';
import { GameService } from 'src/game/game.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly gameService: GameService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.userService.findById(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('games-history')
  getGamesHistory(
    @CurrentUser() user: { id: string },
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.gameService.getUserHistory(user.id, page || 1, limit || 10);
  }
}
