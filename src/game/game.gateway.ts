import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { ShipPosition } from './types';
import { WsAuthMiddleware } from '../auth/ws-auth.middleware';
import { WsCurrentUser } from '../auth/ws-current-user.decorator';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;
  constructor(
    private gameService: GameService,
    private wsAuthMiddleware: WsAuthMiddleware,
  ) {}

  afterInit() {
    this.server.use(this.wsAuthMiddleware.createAuthMiddleware());
  }

  @SubscribeMessage('create-game')
  async createGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const game = await this.gameService.createGame(data.roomId);
    console.log(game.players[0].ships);
    await client.join(data.roomId);
    this.server.to(data.roomId).emit('game-created', game.gameId);
  }

  @SubscribeMessage('join-game')
  async joinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    await client.join(data.gameId);
    client.emit('game-joined', data.gameId);
  }

  @SubscribeMessage('get-game')
  getGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const game = this.gameService.getGameStateById(data.gameId);
    client.emit('game-data', game);
  }

  @SubscribeMessage('set-player-ready')
  setPlayerReady(
    @MessageBody()
    data: {
      gameId: string;
      boats: ShipPosition[];
    },
    @WsCurrentUser() user: { id: string },
  ) {
    this.gameService.setPlayerReady(data.gameId, user.id, data.boats);
    this.server
      .to(data.gameId)
      .emit('game-data', this.gameService.getGameStateById(data.gameId));
  }

  @SubscribeMessage('set-player-selected-cells')
  setPlayerSelectedCells(
    @MessageBody()
    data: {
      gameId: string;
      cells: { left: number; top: number };
      isPlayAgain: boolean;
    },
    @WsCurrentUser() user: { id: string },
  ) {
    this.gameService.setPlayerSelectedCells(
      data.gameId,
      user.id,
      data.cells,
      data.isPlayAgain,
    );
    this.server
      .to(data.gameId)
      .emit('game-data', this.gameService.getGameStateById(data.gameId));
  }

  @SubscribeMessage('end-game')
  async endGame(
    @MessageBody()
    data: {
      gameId: string;
      winnerId: string;
    },
  ) {
    await this.gameService.endGame(data.gameId, data.winnerId);
    const gameState = this.gameService.getGameStateById(data.gameId);
    this.server.to(data.gameId).emit('game-data', gameState);
  }
}
