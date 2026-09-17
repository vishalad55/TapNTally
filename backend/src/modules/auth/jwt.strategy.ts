import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { AppConfigService } from '../../config/app-config.service';
import { UserEntity } from '../../database/entities';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  /**
   * One lightweight lookup per request so `householdId` is always current
   * (joining/leaving a household must take effect without re-login).
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, email: true, householdId: true },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return { id: user.id, email: user.email, householdId: user.householdId };
  }
}
