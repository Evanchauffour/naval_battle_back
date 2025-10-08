import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './room.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomGateway {
  @WebSocketServer()
  server: Server;
  constructor(private roomService: RoomService) {}

  @SubscribeMessage('create-room')
  async createRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.createRoom(data.userId);

    await client.join(room.id);
    client.emit('room-created', room);
    this.server.emit('room-list', this.roomService.getAllRooms());
  }

  @SubscribeMessage('get-room')
  getRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoomById(data.roomId);
    client.emit('room-data', room);
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.joinRoom(data.roomId, data.userId);

    client.join(data.roomId);
    client.to(room?.id || '').emit('room-data', room);
  }

  @SubscribeMessage('leave-room')
  leaveRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomService.leaveRoom(data.roomId, data.userId);
    client
      .to(data.roomId)
      .emit('room-data', this.roomService.getRoomById(data.roomId));
    this.server.emit('room-list', this.roomService.getAllRooms());
  }

  @SubscribeMessage('get-room-list')
  getRoomList(@ConnectedSocket() client: Socket) {
    console.log(this.roomService.getAllRooms());
    client.emit('room-list', this.roomService.getAllRooms());
  }

  @SubscribeMessage('set-ready')
  setReady(
    @MessageBody() data: { roomId: string; userId: string; isReady: boolean },
  ) {
    const room = this.roomService.setReady(data.roomId, data.userId);

    this.server.to(room?.id || '').emit('room-data', room);
  }

  @SubscribeMessage('clear-room-list')
  clearRoomList() {
    this.roomService.clearRoomList();
    this.server.emit('room-list', this.roomService.getAllRooms());
  }
}
