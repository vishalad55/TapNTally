import type { AuthTokens } from '@tapntally/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'tapntally.auth.tokens';

/**
 * Tokens live in the platform keystore (Keychain / Android Keystore via
 * expo-secure-store). Web falls back to localStorage for the dev preview only.
 */
let cache: AuthTokens | null | undefined;

export const tokenStore = {
  async get(): Promise<AuthTokens | null> {
    if (cache !== undefined) return cache;
    try {
      const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
      cache = raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      cache = null;
    }
    return cache;
  },
  async set(tokens: AuthTokens): Promise<void> {
    cache = tokens;
    const raw = JSON.stringify(tokens);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, raw);
    else await SecureStore.setItemAsync(KEY, raw);
  },
  async clear(): Promise<void> {
    cache = null;
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
