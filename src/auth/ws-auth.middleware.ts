import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthMiddleware {
  private readonly logger = new Logger(WsAuthMiddleware.name);

  constructor(private jwtService: JwtService) {}

  /**
   * Middleware d'authentification JWT pour WebSocket
   * À utiliser dans afterInit() avec server.use()
   * Optimisé : utilise uniquement les données du JWT, pas de requête DB
   */
  createAuthMiddleware() {
    return (socket: Socket, next: (err?: Error) => void) => {
      void (async () => {
        try {
          const token = socket.handshake.auth.token as string;

          if (!token) {
            this.logger.warn(
              `Connection rejected: No token provided for socket ${socket.id}`,
            );
            return next(new Error('Authentication token is required'));
          }

          // Vérifier et décoder le token JWT
          const decoded: unknown = await this.jwtService.verifyAsync(token, {
            secret: process.env.JWT_SECRET,
          });

          if (
            !decoded ||
            typeof decoded !== 'object' ||
            !('id' in decoded) ||
            typeof (decoded as { id: unknown }).id !== 'string'
          ) {
            throw new Error('Invalid token payload');
          }

          const payload = decoded as { id: string; email: string };

          // Stocker l'utilisateur dans socket.data pour y accéder dans les handlers
          // Utilise uniquement les données du JWT (pas de requête DB)
          (
            socket.data as {
              user: { id: string; email: string };
            }
          ).user = {
            id: payload.id,
            email: payload.email || '',
          };

          this.logger.log(
            `User authenticated: ${payload.email || payload.id} (socket ${socket.id})`,
          );
          next();
        } catch (error) {
          this.logger.error(
            `Authentication failed for socket ${socket.id}:`,
            error,
          );
          return next(new Error('Invalid or expired token'));
        }
      })();
    };
  }
}
