import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

export const WsCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { id: string; email: string } => {
    const client = ctx.switchToWs().getClient<Socket>();
    const userData = client.data as {
      user?: { id: string; email: string };
    };

    // L'utilisateur doit toujours être présent car l'authentification est faite dans io.use()
    // Si user n'existe pas, c'est une erreur de configuration
    if (!userData.user) {
      throw new Error(
        'User not found in socket data - authentication middleware failed',
      );
    }

    return userData.user;
  },
);
