import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { User } from 'generated/prisma';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UsersService,
  ) {}

  private getCookieOptions() {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: 86400000,
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
    };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(
    @Request() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token } = this.authService.login(req.user);

    res.cookie('accessToken', access_token, this.getCookieOptions());
    return this.userService.findById(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
    });
    return { message: 'Déconnecté avec succès' };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const { user: newUser } = await this.authService.register(dto);

    return this.userService.findById(newUser.id);
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, user } = await this.authService.verifyEmail(
      dto.token,
    );
    res.cookie('accessToken', access_token, this.getCookieOptions());
    return this.userService.findById(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.userService.findById(user.id);
  }
}
