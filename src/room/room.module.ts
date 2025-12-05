import { Module, forwardRef } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [RoomGateway, RoomService],
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  exports: [RoomService],
})
export class RoomModule {}
