import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './room.service';
import { WsAuthMiddleware } from '../auth/ws-auth.middleware';
import { WsCurrentUser } from '../auth/ws-current-user.decorator';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomGateway {
  @WebSocketServer()
  server: Server;
  constructor(
    private roomService: RoomService,
    private wsAuthMiddleware: WsAuthMiddleware,
  ) {}

  afterInit() {
    this.roomService.setServer(this.server);
    this.server.use(this.wsAuthMiddleware.createAuthMiddleware());
  }

  handleConnection(client: Socket) {
    this.roomService.setUserSocket(client);
  }

  handleDisconnect(client: Socket) {
    this.roomService.removeUserSocket(client);
  }

  @SubscribeMessage('create-room')
  async createRoom(
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.createRoom(user.id, false);
    client.join(room.id);
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

  @SubscribeMessage('join-room-by-code')
  async joinRoomByCode(
    @MessageBody() data: { code: number },
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('join-room-by-code', data.code);
    const room = await this.roomService.joinRoomByCode(data.code, user.id);

    client.join(room?.id || '');
    client.emit('room-joined', room?.id);
    this.server.to(room?.id || '').emit('room-data', room);
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() data: { roomId: string },
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.joinRoom(data.roomId, user.id);

    client.join(data.roomId);
    client.to(room?.id || '').emit('room-data', room);
  }

  @SubscribeMessage('leave-room')
  leaveRoom(
    @MessageBody() data: { roomId: string },
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomService.leaveRoom(data.roomId, user.id);
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
    @MessageBody() data: { roomId: string; isReady: boolean },
    @WsCurrentUser() user: { id: string },
  ) {
    const room = this.roomService.setReady(data.roomId, user.id);

    this.server.to(room?.id || '').emit('room-data', room);
  }

  @SubscribeMessage('start-matchmaking')
  startMatchmaking(
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomService.startMatchmaking(user.id, client);
  }
}
