import { Injectable } from '@nestjs/common';
import { Room } from './types';
import { UsersService } from 'src/users/users.service';
import { randomInt } from 'crypto';
import { Server, Socket } from 'socket.io';

@Injectable()
export class RoomService {
  private server: Server;
  private rooms: Map<string, Room> = new Map();
  private userSocket: Map<string, Socket> = new Map();

  constructor(private usersService: UsersService) {}

  setServer(server: Server) {
    this.server = server;
  }

  setUserSocket(socket: Socket) {
    this.userSocket.get(socket.id);
    this.userSocket.set(socket.id, socket);
  }

  removeUserSocket(socket: Socket) {
    this.userSocket.delete(socket.id);
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
          name: user.name,
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
    setTimeout(() => {
      void (async () => {
        const room = this.getRoomById(roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        if (room.players.length < 2) {
          this.rooms.delete(roomId);

          const compatibleRoom = this.findCompatibleRoom(room.elo || 0);
          if (compatibleRoom) {
            // Get all sockets in the current room and make them join the compatible room
            const sockets = await this.server.in(room.id).fetchSockets();
            for (const socket of sockets) {
               socket.join(compatibleRoom.id);
            }

            await this.joinRoomMatchmaking(
              compatibleRoom.id,
              room.players[0].id,
              null, // No single client socket to pass here, strictly logic update
            );
          } else {
            this.createRoom(room.players[0].id, false, room.elo, true);
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
      name: user.name,
      isReady: false,
    });
    return room;
  }

  async joinRoomMatchmaking(roomId: string, userId: string, client: any) {
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
      name: user.name,
      isReady: false,
    });

    // Only call join if client has a join method (it's a socket)
    if (client && typeof client.join === 'function') {
      client.join(room.id);
    }
    // If it's a BroadcastOperator (server.to(...)), we don't need to join, 
    // just emitting to the room is enough context for match-found if needed, 
    // but here we seem to want to subscribe the user to the room updates.
    // However, when called from matchmakingScheduleTimeout with server.to(), 
    // we can't "join" the room in the same way.
    // Since the logic in matchmakingScheduleTimeout implies moving a group or re-notifying,
    // let's see.
    
    // Actually, looking at line 81: this.server.to(room.id) passed as client.
    // Broadcaster doesn't have join.
    // When re-matching a waiting room, we might need all sockets in that room to join the new room?
    // Or if we are just merging rooms...

    if (room.players.length === 2) {
      console.log('match found', room);
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

  async startMatchmaking(userId: string, client: Socket) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const compatibleRoom = this.findCompatibleRoom(user.elo);
    if (compatibleRoom) {
      this.joinRoomMatchmaking(compatibleRoom.id, userId, client);
    } else {
      const room = await this.createRoom(userId, false, user.elo);
      client.join(room.id);
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
