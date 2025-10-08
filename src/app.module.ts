import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomModule } from './room/room.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [AuthModule, UsersModule, RoomModule, GameModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
