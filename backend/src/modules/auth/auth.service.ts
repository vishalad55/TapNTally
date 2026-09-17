import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthTokens } from '@tapntally/shared';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AppError } from '../../common/filters/http-exception.filter';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AppConfigService } from '../../config/app-config.service';
import { RefreshTokenEntity, UserEntity } from '../../database/entities';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly google: OAuth2Client;

  constructor(
    private readonly config: AppConfigService,
    private readonly jwt: JwtService,
    private readonly crypto: EncryptionService,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity) private readonly refreshTokens: Repository<RefreshTokenEntity>,
  ) {
    this.google = new OAuth2Client(config.get('GOOGLE_CLIENT_ID') || undefined);
  }

  /** Verify a Google ID token from the native sign-in SDK and upsert the user. */
  async signInWithGoogle(idToken: string): Promise<{ user: UserEntity; tokens: AuthTokens }> {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    if (!clientId) throw new AppError('AUTH_GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured on this server', HttpStatus.SERVICE_UNAVAILABLE);

    let ticket;
    try {
      ticket = await this.google.verifyIdToken({ idToken, audience: clientId });
    } catch (err) {
      this.logger.warn(`Google token verification failed: ${String(err)}`);
      throw new AppError('AUTH_INVALID_GOOGLE_TOKEN', 'Google sign-in failed. Please try again.', HttpStatus.UNAUTHORIZED);
    }
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) {
      throw new AppError('AUTH_UNVERIFIED_EMAIL', 'Your Google account email must be verified', HttpStatus.UNAUTHORIZED);
    }

    let user = await this.users.findOne({ where: { googleSub: p.sub } });
    if (!user) user = await this.users.findOne({ where: { email: p.email.toLowerCase() } });
    if (!user) {
      user = this.users.create({
        email: p.email.toLowerCase(),
        name: p.name ?? p.email.split('@')[0],
        avatarUrl: p.picture ?? null,
        googleSub: p.sub,
      });
    } else {
      user.googleSub = p.sub;
      user.avatarUrl = p.picture ?? user.avatarUrl;
      if (p.name) user.name = p.name;
    }
    user.lastSeenAt = new Date();
    user = await this.users.save(user);
    return { user, tokens: await this.issueTokens(user) };
  }

  /** Dev-only: sign in as any email, creating the user if needed. Guarded by AUTH_DEV_LOGIN. */
  async signInDev(email: string): Promise<{ user: UserEntity; tokens: AuthTokens }> {
    if (!this.config.get('AUTH_DEV_LOGIN')) {
      throw new AppError('AUTH_DEV_LOGIN_DISABLED', 'Dev login is disabled', HttpStatus.FORBIDDEN);
    }
    const normalized = email.toLowerCase();
    let user = await this.users.findOne({ where: { email: normalized } });
    if (!user) {
      user = await this.users.save(
        this.users.create({ email: normalized, name: normalized.split('@')[0], avatarUrl: null, googleSub: null }),
      );
    }
    user.lastSeenAt = new Date();
    await this.users.save(user);
    return { user, tokens: await this.issueTokens(user) };
  }

  /** Rotate a refresh token. Replay of an already-rotated token revokes the whole family. */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const hash = this.hash(rawRefreshToken);
    const existing = await this.refreshTokens.findOne({ where: { tokenHash: hash } });
    if (!existing) throw new AppError('AUTH_INVALID_REFRESH', 'Session expired. Please sign in again.', HttpStatus.UNAUTHORIZED);

    if (existing.revokedAt || existing.replacedById) {
      // Token reuse → assume theft; revoke everything for this user.
      this.logger.warn(`Refresh token reuse detected for user ${existing.userId}; revoking all sessions`);
      await this.refreshTokens.update({ userId: existing.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw new AppError('AUTH_REFRESH_REUSED', 'Session invalidated. Please sign in again.', HttpStatus.UNAUTHORIZED);
    }
    if (existing.expiresAt < new Date()) {
      throw new AppError('AUTH_REFRESH_EXPIRED', 'Session expired. Please sign in again.', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.users.findOneOrFail({ where: { id: existing.userId } });
    const tokens = await this.issueTokens(user);
    existing.replacedById = (await this.refreshTokens.findOneOrFail({ where: { tokenHash: this.hash(tokens.refreshToken) } })).id;
    await this.refreshTokens.save(existing);
    return tokens;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokens.update({ tokenHash: this.hash(rawRefreshToken) }, { revokedAt: new Date() });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) }, { revokedAt: new Date() });
  }

  private async issueTokens(user: UserEntity): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessTtl = this.config.get('JWT_ACCESS_TTL_SECONDS');
    const refreshTtl = this.config.get('JWT_REFRESH_TTL_SECONDS');

    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });
    const refreshToken = this.crypto.randomToken(48);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        revokedAt: null,
        replacedById: null,
      }),
    );
    return { accessToken, refreshToken, expiresInSeconds: accessTtl };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
