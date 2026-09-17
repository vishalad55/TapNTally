import { Injectable, Logger } from '@nestjs/common';
import { auth as googleAuth, gmail, type gmail_v1 } from '@googleapis/gmail';
import { AppConfigService } from '../../config/app-config.service';
import { htmlToText } from './parsing/gmail-parser';

/**
 * Narrow scope: read-only. We never request modify/send. `gmail.metadata`
 * would be narrower still, but it forbids the `q` search parameter we rely
 * on to fetch *only* purchase emails — so `readonly` is the least privilege
 * that still lets us avoid scanning the whole inbox.
 *
 * Uses the per-API `@googleapis/gmail` package (a few MB) rather than the
 * monolithic `googleapis` (~130 MB) so the API fits in a serverless function.
 */
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export interface GmailTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
  token_type?: string | null;
}

export interface GmailMessageSummary {
  id: string;
  from: string;
  subject: string;
  receivedAt: Date;
}

export interface GmailMessageFull extends GmailMessageSummary {
  bodyText: string;
}

@Injectable()
export class GmailClient {
  private readonly logger = new Logger(GmailClient.name);

  constructor(private readonly config: AppConfigService) {}

  private oauth(tokens?: GmailTokens, onTokens?: (t: GmailTokens) => void) {
    const client = new googleAuth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      // Mobile (native SDK) server auth codes exchange against this redirect.
      'postmessage',
    );
    if (tokens) client.setCredentials(tokens);
    if (onTokens) client.on('tokens', (t) => onTokens(t as GmailTokens));
    return client;
  }

  async exchangeCode(authCode: string): Promise<GmailTokens> {
    const { tokens } = await this.oauth().getToken(authCode);
    if (!tokens.refresh_token) {
      this.logger.warn('Google did not return a refresh_token — user may need to re-consent with prompt=consent');
    }
    return tokens as GmailTokens;
  }

  async revoke(tokens: GmailTokens): Promise<void> {
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return;
    try {
      await this.oauth(tokens).revokeToken(token);
    } catch (err) {
      this.logger.warn(`Token revoke failed (already revoked?): ${String(err)}`);
    }
  }

  private api(tokens: GmailTokens, onTokens?: (t: GmailTokens) => void): gmail_v1.Gmail {
    return gmail({ version: 'v1', auth: this.oauth(tokens, onTokens) });
  }

  async profile(tokens: GmailTokens, onTokens?: (t: GmailTokens) => void): Promise<{ emailAddress: string; historyId: string }> {
    const res = await this.api(tokens, onTokens).users.getProfile({ userId: 'me' });
    return { emailAddress: res.data.emailAddress ?? '', historyId: String(res.data.historyId ?? '') };
  }

  /** List message ids matching a Gmail search query, following pagination up to `max`. */
  async listMessageIds(tokens: GmailTokens, query: string, max: number, onTokens?: (t: GmailTokens) => void): Promise<string[]> {
    const api = this.api(tokens, onTokens);
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const res = await api.users.messages.list({ userId: 'me', q: query, maxResults: Math.min(100, max - ids.length), pageToken });
      for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && ids.length < max);
    return ids;
  }

  /** Headers only — cheap pre-filter before pulling bodies. */
  async getSummary(tokens: GmailTokens, id: string, onTokens?: (t: GmailTokens) => void): Promise<GmailMessageSummary> {
    const res = await this.api(tokens, onTokens).users.messages.get({
      userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'],
    });
    return this.summaryFrom(res.data);
  }

  async getFull(tokens: GmailTokens, id: string, onTokens?: (t: GmailTokens) => void): Promise<GmailMessageFull> {
    const res = await this.api(tokens, onTokens).users.messages.get({ userId: 'me', id, format: 'full' });
    const summary = this.summaryFrom(res.data);
    return { ...summary, bodyText: extractBody(res.data.payload) };
  }

  /** Message ids added since `startHistoryId`. Returns null if the cursor is too old (404) → caller must re-backfill. */
  async historySince(tokens: GmailTokens, startHistoryId: string, onTokens?: (t: GmailTokens) => void): Promise<{ ids: string[]; historyId: string } | null> {
    const api = this.api(tokens, onTokens);
    const ids = new Set<string>();
    let pageToken: string | undefined;
    let latest = startHistoryId;
    try {
      do {
        const res = await api.users.history.list({ userId: 'me', startHistoryId, historyTypes: ['messageAdded'], pageToken });
        for (const h of res.data.history ?? []) for (const m of h.messagesAdded ?? []) if (m.message?.id) ids.add(m.message.id);
        if (res.data.historyId) latest = String(res.data.historyId);
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (err) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
    return { ids: [...ids], historyId: latest };
  }

  /** Register for push notifications via Pub/Sub. Expires in ≤7 days; renew from cron. */
  async watch(tokens: GmailTokens, topic: string, onTokens?: (t: GmailTokens) => void): Promise<{ historyId: string; expiration: Date }> {
    const res = await this.api(tokens, onTokens).users.watch({ userId: 'me', requestBody: { topicName: topic, labelIds: ['INBOX'] } });
    return { historyId: String(res.data.historyId ?? ''), expiration: new Date(Number(res.data.expiration ?? Date.now())) };
  }

  private summaryFrom(m: gmail_v1.Schema$Message): GmailMessageSummary {
    const headers = m.payload?.headers ?? [];
    const h = (name: string) => headers.find((x) => x.name?.toLowerCase() === name)?.value ?? '';
    return {
      id: m.id ?? '',
      from: h('from'),
      subject: h('subject'),
      receivedAt: m.internalDate ? new Date(Number(m.internalDate)) : new Date(h('date') || Date.now()),
    };
  }
}

/** Walk the MIME tree; prefer text/plain, fall back to stripped text/html. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  let plain = '';
  let html = '';
  const visit = (p: gmail_v1.Schema$MessagePart) => {
    const data = p.body?.data;
    if (data) {
      const decoded = Buffer.from(data, 'base64url').toString('utf8');
      if (p.mimeType === 'text/plain' && !plain) plain = decoded;
      else if (p.mimeType === 'text/html' && !html) html = decoded;
    }
    for (const part of p.parts ?? []) visit(part);
  };
  visit(payload);
  return plain.trim() || htmlToText(html);
}
