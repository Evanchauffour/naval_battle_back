import { Module, forwardRef } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { RoomModule } from 'src/room/room.module';
import { PrismaModule } from 'src/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { UserStatsModule } from 'src/user-stats/user-stats.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway],
  imports: [
    forwardRef(() => RoomModule),
    PrismaModule,
    forwardRef(() => AuthModule),
    UserStatsModule,
    forwardRef(() => UsersModule),
  ],
  exports: [GameService],
})
export class GameModule {}
