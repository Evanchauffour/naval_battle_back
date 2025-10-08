import { Module } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [RoomGateway, RoomService],
  imports: [UsersModule],
  exports: [RoomService],
})
export class RoomModule {}
