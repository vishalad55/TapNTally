import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Guards operator-only endpoints (analytics exports, terminal enrolment).
 * Header: `X-Internal-Key`. Compared in constant time.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const provided = req.header('x-internal-key') ?? '';
    const expected = this.config.get('INTERNAL_API_KEY');
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal key');
    }
    return true;
  }
}
