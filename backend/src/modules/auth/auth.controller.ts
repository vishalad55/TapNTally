import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { DevSignInDto, GoogleSignInDto, RefreshDto } from './dto';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async google(@Body() dto: GoogleSignInDto) {
    const { user, tokens } = await this.auth.signInWithGoogle(dto.idToken);
    return { user: this.users.toDto(user), tokens };
  }

  @Post('dev')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async dev(@Body() dto: DevSignInDto) {
    const { user, tokens } = await this.auth.signInDev(dto.email);
    return { user: this.users.toDto(user), tokens };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }
}
