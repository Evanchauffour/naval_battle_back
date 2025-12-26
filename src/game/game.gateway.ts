import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { ShipPosition } from './types';
import { WsAuthMiddleware } from '../auth/ws-auth.middleware';
import { WsCurrentUser } from '../auth/ws-current-user.decorator';
import { UsersService } from '../users/users.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(GameGateway.name);
  private readonly disconnectTimeout = 30000; // 30 secondes
  private readonly usersTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private gameService: GameService,
    private wsAuthMiddleware: WsAuthMiddleware,
    private usersService: UsersService,
  ) {}

  afterInit() {
    this.server.use(this.wsAuthMiddleware.createAuthMiddleware());
  }

  handleConnection(client: Socket) {
    const userId = (client.data as { user?: { id: string } })?.user?.id;
    if (!userId) {
      return;
    }
    // Annuler le timeout si l'utilisateur se reconnecte
    const existingTimeout = this.usersTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.usersTimeouts.delete(userId);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { user?: { id: string } })?.user?.id;
    if (!userId) {
      return;
    }

    this.logger.log(`User disconnected: ${userId}`);

    // Annuler un timeout existant
    const existingTimeout = this.usersTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Créer un nouveau timeout pour quitter le jeu après 30 secondes
    this.usersTimeouts.set(
      userId,
      setTimeout(() => {
        void (async () => {
          try {
            this.logger.log(`Leaving game for user: ${userId}`);
            await this.gameService.leaveGame(userId);
            const gameId = Array.from(
              this.gameService.getPlayerGames(userId),
            ).at(0);
            if (gameId) {
              try {
                const game = await this.gameService.leaveGame(userId);
                if (game) {
                  this.server.to(gameId).emit('game-data', game);
                }
              } catch (error) {
                // Le jeu n'existe plus ou a déjà été quitté
              }
            }
          } catch (error) {
            this.logger.error(
              `Error handling disconnect for user ${userId}:`,
              error,
            );
          } finally {
            this.usersTimeouts.delete(userId);
          }
        })();
      }, this.disconnectTimeout),
    );
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
  async getGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
    @WsCurrentUser() user: { id: string },
  ) {
    const game = this.gameService.getGameStateById(data.gameId);
    await client.join(data.gameId);
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

  @SubscribeMessage('leave-game')
  async leaveGame(@WsCurrentUser() user: { id: string }) {
    const game = await this.gameService.leaveGame(user.id);
    if (game) {
      this.server.to(game.gameId).emit('game-data', game);
    }
  }

  @SubscribeMessage('send-message')
  async sendMessage(
    @MessageBody()
    data: {
      gameId: string;
      message: string;
    },
    @WsCurrentUser() user: { id: string },
  ) {
    try {
      const userData = await this.usersService.findById(user.id);
      if (!userData) {
        throw new Error('User not found');
      }

      const messageData = await this.gameService.addMessage(
        data.gameId,
        data.message,
        user.id,
        userData.username || userData.email,
      );

      const game = this.gameService.getGameStateById(data.gameId);
      this.server.to(data.gameId).emit('game-data', game);
    } catch (error) {
      this.logger.error(`Error sending message:`, error);
    }
  }
}
