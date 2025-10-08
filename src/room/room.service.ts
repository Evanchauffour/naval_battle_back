import { Injectable } from '@nestjs/common';
import { Room } from './types';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class RoomService {
  private rooms: Room[] = [];

  constructor(private usersService: UsersService) {}

  async createRoom(creatorId: string): Promise<Room> {
    const user = await this.usersService.findById(creatorId);

    if (!user) {
      throw new Error('User not found');
    }

    const room: Room = {
      id: crypto.randomUUID(),
      creatorId: creatorId,
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

    this.rooms.push(room);
    return room;
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

  leaveRoom(roomId: string, userId: string) {
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    room.players = room.players.filter((player) => player.id !== userId);

    if (room.players.length === 0) {
      this.rooms = this.rooms.filter((room) => room.id !== roomId);
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
    return this.rooms;
  }

  getRoomById(id: string): Room | undefined {
    return this.rooms.find((room) => room.id === id);
  }

  clearRoomList() {
    this.rooms = [];
  }
}
