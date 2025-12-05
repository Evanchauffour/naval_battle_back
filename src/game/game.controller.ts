import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
}
