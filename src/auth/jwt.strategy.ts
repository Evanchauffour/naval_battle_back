import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.accessToken,
      ]),
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: { id: string; email: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      console.error('Error fetching user data in JWT strategy:', error);
      // Fallback to basic payload if database query fails
      return {
        id: payload.id,
        email: payload.email,
      };
    }
  }
}
