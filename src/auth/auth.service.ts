import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { User } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const isExisting = await this.usersService.findByEmail(dto.email);
    if (isExisting) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }

    const isUsernameTaken = await this.usersService.findByUsername(
      dto.username,
    );
    if (isUsernameTaken) {
      throw new BadRequestException("Ce nom d'utilisateur est déjà utilisé");
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
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

    // Envoi de l'email avec le template MJML
    await this.mailService.sendVerificationEmail(email, token);

    return token;
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Le token est requis');
    }

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

    // Envoi de l'email de bienvenue
    try {
      await this.mailService.sendWelcomeEmail(user.email, user.username);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email de bienvenue:", error);
      // On ne bloque pas le processus si l'email de bienvenue échoue
    }

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
