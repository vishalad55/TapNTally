import type { ApiError, AuthTokens } from '@tapntally/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { tokenStore } from './token-store';

/**
 * Thin fetch wrapper: bearer auth, one automatic refresh-and-retry on 401,
 * typed error envelope. No axios — keeps the bundle small and the behaviour
 * obvious for whoever maintains this next.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
  get isNetwork() {
    return this.status === 0;
  }
}

function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:3000/api/v1';
  // Android emulator maps the host machine's localhost to 10.0.2.2.
  if (Platform.OS === 'android' && configured.includes('localhost')) return configured.replace('localhost', '10.0.2.2');
  // On a physical device, Expo exposes the dev machine's LAN IP via hostUri.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && configured.includes('localhost') && Platform.OS !== 'web') {
    const lanHost = hostUri.split(':')[0];
    if (lanHost && !/^(localhost|127\.)/.test(lanHost)) return configured.replace('localhost', lanHost);
  }
  return configured;
}

export const API_BASE_URL = resolveBaseUrl();

let refreshInFlight: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const current = await tokenStore.get();
      if (!current?.refreshToken) return null;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) {
          await tokenStore.clear();
          return null;
        }
        const tokens = (await res.json()) as AuthTokens;
        await tokenStore.set(tokens);
        return tokens;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, headers = {} } = opts;
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }

  const doFetch = async (retry: boolean): Promise<T> => {
    const tokens = auth ? await tokenStore.get() : null;
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiClientError(0, 'NETWORK', "Can't reach TapNTally right now. Check your connection.", err);
    }

    if (res.status === 401 && auth && retry) {
      const refreshed = await refreshTokens();
      if (refreshed) return doFetch(false);
    }
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const e = (json ?? {}) as Partial<ApiError>;
      throw new ApiClientError(res.status, e.code ?? `HTTP_${res.status}`, e.message ?? res.statusText, e.details);
    }
    return json as T;
  };

  return doFetch(true);
}
