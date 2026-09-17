import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Shape placed on `req.user` by JwtStrategy. Kept minimal; load the entity when needed. */
export interface AuthUser {
  id: string;
  email: string;
  householdId: string | null;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});
