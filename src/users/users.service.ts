import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from 'generated/prisma';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput) {
    return await this.prisma.user.create({ data });
  }

  async findById(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string) {
    return await this.prisma.user.findUnique({
      where: { username },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    // Préparer les données à mettre à jour
    const updateData: Prisma.UserUpdateInput = {};
    
    // Vérifier et mettre à jour le username si nécessaire
    if (dto.username && dto.username.trim() !== '' && dto.username !== user.username) {
      const existingUser = await this.findByUsername(dto.username);
      if (existingUser) {
        throw new BadRequestException("Ce nom d'utilisateur est déjà utilisé");
      }
      updateData.username = dto.username;
    }

    if (dto.newPassword && dto.newPassword.trim() !== '') {
      const hash = await bcrypt.hash(dto.newPassword, 10);
      updateData.password = hash;
    }

    // Si aucune donnée à mettre à jour, retourner l'utilisateur actuel
    if (Object.keys(updateData).length === 0) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}
