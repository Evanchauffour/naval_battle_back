import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
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
    @Inject(forwardRef(() => WsAuthMiddleware))
    private wsAuthMiddleware: WsAuthMiddleware,
  ) {}

  afterInit() {
    this.roomService.setServer(this.server);
    this.server.use(this.wsAuthMiddleware.createAuthMiddleware());
  }

  handleConnection(client: Socket) {
    const userId = (client.data as { user?: { id: string } })?.user?.id;
    if (userId) {
      this.roomService.setUserSocket(userId, client.id);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { user?: { id: string } })?.user?.id;
    if (userId) {
      this.roomService.removeUserSocket(userId);
    }
  }

  @SubscribeMessage('create-room')
  async createRoom(
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.createRoom(user.id, false);
    // Join manually for custom rooms
    await client.join(room.id);
    client.emit('room-created', room);
    // Envoyer aussi les données de la room au créateur
    client.emit('room-data', room);
    this.server.emit('room-list', this.roomService.getAllRooms());
  }

  @SubscribeMessage('get-room')
  getRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoomById(data.roomId);
    if (room) {
      client.emit('room-data', room);
    } else {
      // Envoyer null si la room n'existe pas
      client.emit('room-data', null);
    }
  }

  @SubscribeMessage('join-room-by-code')
  async joinRoomByCode(
    @MessageBody() data: { code: number },
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('join-room-by-code', data.code);
    const room = await this.roomService.joinRoomByCode(data.code, user.id);

    if (!room) {
      return;
    }

    await client.join(room.id);
    client.emit('room-joined', room.id);
    // Envoyer à tous les clients dans la room, y compris le créateur
    this.server.to(room.id).emit('room-data', room);
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() data: { roomId: string },
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.joinRoom(data.roomId, user.id);

    await client.join(data.roomId);
    // Envoyer à tous les clients dans la room, y compris le créateur
    this.server.to(room.id).emit('room-data', room);
  }

  @SubscribeMessage('leave-room')
  async leaveRoom(
    @MessageBody() data: { roomId: string },
    @WsCurrentUser() user: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const result = this.roomService.leaveRoom(data.roomId, user.id);

    // Envoyer un message uniquement aux autres clients dans la room (pas à celui qui part)
    if (result.leavingPlayerName) {
      client.to(data.roomId).emit('player-left-room', {
        roomId: data.roomId,
        leavingPlayerName: result.leavingPlayerName,
        message: `${result.leavingPlayerName} a quitté la partie`,
      });
    }

    // La room est toujours supprimée, donc informer tous les autres clients qu'elle est fermée
    client.to(data.roomId).emit('room-closed', { roomId: data.roomId });

    // Faire quitter tous les clients de la room (y compris celui qui part)
    const sockets = await this.server.in(data.roomId).fetchSockets();
    sockets.forEach((socket) => {
      socket.leave(data.roomId);
    });

    // Mettre à jour la liste des rooms (la room a été supprimée)
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
  async startMatchmaking(@WsCurrentUser() user: { id: string }) {
    await this.roomService.startMatchmaking(user.id);
  }

  @SubscribeMessage('cancel-matchmaking')
  cancelMatchmaking(@WsCurrentUser() user: { id: string }) {
    this.roomService.leaveQueue(user.id);
  }
}
