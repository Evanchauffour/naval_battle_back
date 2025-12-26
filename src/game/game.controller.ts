import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { GameService } from './game.service';
import { CurrentUser } from 'src/auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get(':id/result')
  getGameResultById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.gameService.getGameResultById(id, user.id);
  }

  @Get('user-history')
  getUserHistory(
    @CurrentUser() user: { id: string },
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.gameService.getUserHistory(user.id, page || 1, limit || 10);
  }

  @Get('get-inprogress-game')
  getInProgressGame(@CurrentUser() user: { id: string }) {
    return this.gameService.getInProgressGame(user.id);
  }
}
