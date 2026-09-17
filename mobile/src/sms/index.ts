import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import type { SmsIngestRequest } from '@tapntally/shared';

/**
 * Android-only SMS access. iOS exposes no SMS API, so the feature is hidden
 * there (see the Connections screen).
 *
 * Privacy posture: messages are filtered on-device to bank/merchant-looking
 * senders and forwarded to the API only for parsing — the API extracts the
 * amount/merchant and drops the body. Nothing is stored on the phone.
 */
const LAST_SCAN_KEY = 'tapntally.sms.lastScanMs';
const BACKFILL_DAYS = 180;
const MAX_PER_BATCH = 500;

/** Bank / payment sender ids look like "VM-HDFCBK", "AD-ICICIB", "JD-PAYTMB". */
const SENDER_PATTERN = /^[A-Z]{2}-[A-Z0-9]{5,8}$|^[A-Z]{5,8}$/;
const BODY_HINT = /\b(debited|spent|paid|payment|purchase|txn|transaction|charged)\b/i;

interface RawSms {
  _id: number | string;
  address: string;
  body: string;
  date: number;
}

type SmsAndroidModule = {
  list: (filter: string, fail: (e: string) => void, success: (count: number, list: string) => void) => void;
};

function loadModule(): SmsAndroidModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-get-sms-android').default as SmsAndroidModule;
  } catch {
    return null;
  }
}

export const smsSupported = Platform.OS === 'android';

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read purchase SMS',
    message: 'TapNTally scans only bank and merchant payment alerts to log your purchases. Personal messages are never read or uploaded.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

function listSince(minDate: number): Promise<RawSms[]> {
  const mod = loadModule();
  if (!mod) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    mod.list(
      JSON.stringify({ box: 'inbox', minDate, maxCount: MAX_PER_BATCH }),
      (err) => reject(new Error(err)),
      (_count, list) => resolve(JSON.parse(list) as RawSms[]),
    );
  });
}

/**
 * Read messages newer than the last scan (or the backfill window on first
 * run), keep only plausible payment alerts, and return them as an ingest
 * batch. Caller posts it and then calls `markScanned()`.
 */
export async function collectPaymentSms(opts: { fullBackfill?: boolean } = {}): Promise<SmsIngestRequest['messages']> {
  if (!smsSupported || !(await hasSmsPermission())) return [];
  const lastScan = Number((await AsyncStorage.getItem(LAST_SCAN_KEY)) ?? 0);
  const since = opts.fullBackfill || !lastScan ? Date.now() - BACKFILL_DAYS * 86_400_000 : lastScan - 60_000;

  const raw = await listSince(since);
  return raw
    .filter((m) => SENDER_PATTERN.test(m.address) && BODY_HINT.test(m.body))
    .map((m) => ({ id: String(m._id), sender: m.address, body: m.body, receivedAt: new Date(m.date).toISOString() }));
}

export async function markScanned(): Promise<void> {
  await AsyncStorage.setItem(LAST_SCAN_KEY, String(Date.now()));
}

export async function resetScanCursor(): Promise<void> {
  await AsyncStorage.removeItem(LAST_SCAN_KEY);
}
