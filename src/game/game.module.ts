import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { RoomModule } from 'src/room/room.module';
import { PrismaModule } from 'src/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway],
  imports: [RoomModule, PrismaModule, AuthModule],
})
export class GameModule {}
