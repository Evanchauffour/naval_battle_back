import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { RoomModule } from 'src/room/room.module';
import { PrismaModule } from 'src/prisma.module';

@Module({
  providers: [GameService, GameGateway],
  imports: [RoomModule, PrismaModule],
})
export class GameModule {}
