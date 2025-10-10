import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { User } from 'generated/prisma';
import { Resend } from 'resend';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
  private readonly resend: Resend;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async register(dto: RegisterDto) {
    const isExisting = await this.usersService.findByEmail(dto.email);
    if (isExisting) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }
    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      password: hash,
    });

    try {
      await this.sendVerificationEmail(dto.email);
    } catch {
      throw new BadRequestException(
        'Erreur lors de l’envoi de l’email de vérification',
      );
    }

    return { user };
  }

  async sendVerificationEmail(email: string) {
    const token = Math.random().toString(36).substring(2, 15);
    await this.prisma.verificationToken.create({
      data: {
        email,
        token,
      },
    });
    const data = await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Vérification de votre email',
      html: `
        <p>Veuillez cliquer sur le lien suivant pour vérifier votre email:</p>
        <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">Vérifier mon email</a>
      `,
    });
    console.log(data);
    console.log('token', token);
  }

  async verifyEmail(token: string) {
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!verificationToken) throw new BadRequestException('Token invalide');

    const user = await this.usersService.findByEmail(verificationToken.email);
    if (!user) throw new BadRequestException('Email invalide');

    await this.prisma.user.update({
      where: { email: verificationToken.email },
      data: { isVerified: true },
    });
    await this.prisma.verificationToken.delete({
      where: { token },
    });

    return { access_token: this.login(user).access_token, user };
  }

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(pass, user.password);
    if (!match) return null;
    const { ...result } = user;
    return result;
  }

  login(user: User) {
    const payload = {
      email: user.email,
      id: user.id,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
