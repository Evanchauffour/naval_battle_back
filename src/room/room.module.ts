import { Module, forwardRef } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { UserStatsModule } from 'src/user-stats/user-stats.module';

@Module({
  providers: [RoomGateway, RoomService],
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    forwardRef(() => UserStatsModule),
  ],
  exports: [RoomService],
})
export class RoomModule {}
