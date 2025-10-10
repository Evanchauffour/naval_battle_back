import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { ShipPosition } from './types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway {
  @WebSocketServer()
  server: Server;
  constructor(private gameService: GameService) {}

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
      playerId: string;
      boats: ShipPosition[];
    },
  ) {
    this.gameService.setPlayerReady(data.gameId, data.playerId, data.boats);
    this.server
      .to(data.gameId)
      .emit('game-data', this.gameService.getGameStateById(data.gameId));
  }

  @SubscribeMessage('start-game')
  startGame(@MessageBody() data: { gameId: string }) {
    this.gameService.startGame(data.gameId);
    this.server
      .to(data.gameId)
      .emit('game-data', this.gameService.getGameStateById(data.gameId));
  }

  @SubscribeMessage('set-player-selected-cells')
  setPlayerSelectedCells(
    @MessageBody()
    data: {
      gameId: string;
      playerId: string;
      cells: { left: number; top: number };
    },
  ) {
    this.gameService.setPlayerSelectedCells(
      data.gameId,
      data.playerId,
      data.cells,
    );
    this.server
      .to(data.gameId)
      .emit('game-data', this.gameService.getGameStateById(data.gameId));
  }
}
