import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Room } from './types';
import { UsersService } from 'src/users/users.service';
import { randomInt } from 'crypto';
import { Server } from 'socket.io';
import { UserStatsService } from 'src/user-stats/user-stats.service';

@Injectable()
export class RoomService {
  private server: Server;
  private rooms: Map<string, Room> = new Map();
  private userSocket: Map<string, string> = new Map();

  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private userStatsService: UserStatsService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  setUserSocket(userId: string, socketId: string) {
    this.userSocket.set(userId, socketId);
  }

  removeUserSocket(userId: string) {
    this.userSocket.delete(userId);
  }

  async createRoom(
    creatorId: string,
    isPrivate: boolean,
    elo?: number,
    isMatchmaking?: boolean,
  ): Promise<Room> {
    const user = await this.usersService.findById(creatorId);

    if (!user) {
      throw new Error('User not found');
    }

    const room: Room = {
      id: crypto.randomUUID(),
      creatorId: creatorId,
      code: randomInt(1000, 10000),
      isPrivate: isPrivate,
      elo: elo,
      players: [
        {
          id: creatorId,
          name: user.username,
          isReady: false,
        },
      ],
      createdAt: new Date(),
      status: 'lobby',
    };

    this.rooms.set(room.id, room);

    if (isMatchmaking) {
      this.matchmakingScheduleTimeout(room.id);
    }
    return room;
  }

  matchmakingScheduleTimeout(roomId: string) {
    console.log('matchmakingScheduleTimeout', roomId);

    setTimeout(() => {
      void (async () => {
        const room = this.getRoomById(roomId);
        if (!room) {
          return;
        }

        if (room.players.length < 2) {
          // Si la room a encore un joueur, essayer de le matcher avec une autre room
          if (room.players.length === 1) {
            const playerId = room.players[0].id;
            this.rooms.delete(roomId);

            const compatibleRoom = this.findCompatibleRoom(
              room.elo || 0,
              playerId,
            );
            if (compatibleRoom) {
              await this.joinRoomMatchmaking(compatibleRoom.id, playerId);
            } else {
              // Recréer une room pour ce joueur
              await this.createRoom(playerId, false, room.elo, true);
            }
          } else {
            // Room vide, la supprimer
            this.rooms.delete(roomId);
          }
        }
      })();
    }, 10000);
  }

  async joinRoomByCode(
    code: number,
    userId: string,
  ): Promise<Room | undefined> {
    console.log('joinRoomByCode', code);
    console.log('rooms', this.rooms.values());

    const room = Array.from(this.rooms.values()).find(
      (room) => room.code === Number(code),
    );

    if (!room) {
      throw new Error('Room not found');
    }

    const joinedRoom = await this.joinRoom(room.id, userId);

    return joinedRoom;
  }

  async joinRoom(roomId: string, userId: string): Promise<Room> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    room.players.push({
      id: userId,
      name: user.username,
      isReady: false,
    });
    return room;
  }

  async joinRoomMatchmaking(roomId: string, userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Vérifier que le joueur n'est pas déjà dans la room
    if (room.players.some((player) => player.id === userId)) {
      throw new Error('User is already in this room');
    }

    // Vérifier que la room n'est pas pleine
    if (room.players.length >= 2) {
      throw new Error('Room is full');
    }

    room.players.push({
      id: userId,
      name: user.username,
      isReady: false,
    });

    if (room.players.length === 2) {
      // Add both players to the room
      room.players.forEach((player) => {
        const socketId = this.userSocket.get(player.id);
        if (socketId) {
          this.server.in(socketId).socketsJoin(room.id);
        }
      });
      this.server.to(room.id).emit('match-found', room);
    }
  }

  leaveRoom(roomId: string, userId: string) {
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const leavingPlayer = room.players.find((player) => player.id === userId);

    // Supprimer complètement la room dès qu'un joueur quitte
    // Ne pas essayer de matcher le joueur restant
    this.rooms.delete(roomId);

    return { room: null, leavingPlayerName: leavingPlayer?.name };
  }

  setReady(roomId: string, userId: string) {
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    const player = room.players.find((player) => player.id === userId);

    if (!player) {
      throw new Error('Player not found');
    }
    player.isReady = !player.isReady;
    return room;
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  leaveQueue(userId: string) {
    const room = Array.from(this.rooms.values()).find((room) =>
      room.players.some((player) => player.id === userId),
    );

    if (!room) {
      return; // Or throw error if strict validation is needed
    }

    room.players = room.players.filter((player) => player.id !== userId);

    if (room.players.length === 0) {
      this.rooms.delete(room.id);
    }
  }

  async startMatchmaking(userId: string) {
    // Nettoyer les rooms vides avant de chercher
    this.cleanupEmptyRooms();

    const userStats = await this.userStatsService.getStatsByUserId(userId);
    if (!userStats) {
      throw new Error('User stats not found');
    }

    const elo = userStats.elo || 1000;
    // Exclure les rooms où le joueur est déjà présent
    const compatibleRoom = this.findCompatibleRoom(elo, userId);
    if (compatibleRoom) {
      await this.joinRoomMatchmaking(compatibleRoom.id, userId);
    } else {
      await this.createRoom(userId, false, elo, true);
    }
  }

  cleanupEmptyRooms() {
    // Supprimer toutes les rooms vides
    const emptyRooms: string[] = [];
    this.rooms.forEach((room, roomId) => {
      if (room.players.length === 0) {
        emptyRooms.push(roomId);
      }
    });
    emptyRooms.forEach((roomId) => {
      this.rooms.delete(roomId);
    });
  }

  findCompatibleRoom(elo: number, excludeUserId?: string) {
    const room = Array.from(this.rooms.values()).find(
      (room) =>
        !room.isPrivate &&
        room.players.length > 0 && // La room doit avoir au moins un joueur
        room.players.length < 2 && // Et moins de 2 joueurs
        room.elo &&
        Math.abs(room.elo - elo) <= 100 &&
        // Ne pas retourner une room où le joueur est déjà présent
        (!excludeUserId || !room.players.some((p) => p.id === excludeUserId)),
    );
    if (!room) {
      return undefined;
    }
    return room;
  }
}
