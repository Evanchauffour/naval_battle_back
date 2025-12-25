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
          this.rooms.delete(roomId);

          const compatibleRoom = this.findCompatibleRoom(room.elo || 0);
          if (compatibleRoom) {
            await this.joinRoomMatchmaking(
              compatibleRoom.id,
              room.players[0].id,
            );
          } else {
            await this.createRoom(room.players[0].id, false, room.elo, true);
          }
        } else {
          return;
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
    room.players = room.players.filter((player) => player.id !== userId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
    return room;
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
    const userStats = await this.userStatsService.getStatsByUserId(userId);
    if (!userStats) {
      throw new Error('User stats not found');
    }

    const elo = userStats.elo || 1000;
    const compatibleRoom = this.findCompatibleRoom(elo);
    if (compatibleRoom) {
      await this.joinRoomMatchmaking(compatibleRoom.id, userId);
    } else {
      await this.createRoom(userId, false, elo, true);
    }
  }

  findCompatibleRoom(elo: number) {
    const room = Array.from(this.rooms.values()).find(
      (room) =>
        !room.isPrivate &&
        room.players.length < 2 &&
        room.elo &&
        Math.abs(room.elo - elo) <= 100,
    );
    if (!room) {
      return undefined;
    }
    return room;
  }
}
