import { TBEF_MIME_TYPE, validateTbefBill } from '@tapntally/shared';
import { Platform } from 'react-native';
import type { NfcReader, NfcReadResult } from './types';

// Loaded lazily: the native module only exists in a dev/production build,
// not in Expo Go or on web. Everything degrades to "NFC unavailable".
type NfcManagerModule = typeof import('react-native-nfc-manager');
let nfcModule: NfcManagerModule | null = null;
function loadNfc(): NfcManagerModule | null {
  if (nfcModule) return nfcModule;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nfcModule = require('react-native-nfc-manager') as NfcManagerModule;
    return nfcModule;
  } catch {
    return null;
  }
}

export class RealNfcReader implements NfcReader {
  readonly kind = 'real' as const;
  private started = false;

  async isAvailable(): Promise<boolean> {
    const mod = loadNfc();
    if (!mod) return false;
    try {
      const supported = await mod.default.isSupported();
      if (!supported) return false;
      if (!this.started) {
        await mod.default.start();
        this.started = true;
      }
      return Platform.OS === 'ios' ? true : await mod.default.isEnabled();
    } catch {
      return false;
    }
  }

  async read(opts: { onSessionStart?: () => void } = {}): Promise<NfcReadResult> {
    const mod = loadNfc();
    if (!mod || !(await this.isAvailable())) {
      return { status: 'nfc_unavailable', message: 'NFC is off or not supported on this phone.' };
    }
    const { default: NfcManager, NfcTech, Ndef } = mod;

    try {
      opts.onSessionStart?.();
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold your phone near the payment terminal',
        invalidateAfterFirstRead: true,
      });
      const tag = await NfcManager.getTag();
      const records = tag?.ndefMessage ?? [];
      if (records.length === 0) {
        return { status: 'no_tag_found', message: "We didn't catch the bill. Hold your phone still against the terminal and try again." };
      }

      const record = records.find(
        (r) => r.tnf === Ndef.TNF_MIME_MEDIA && Ndef.util.bytesToString(r.type ?? []) === TBEF_MIME_TYPE,
      );
      if (!record) {
        return { status: 'unsupported_terminal', message: "This terminal isn't TapNTally-enabled yet." };
      }

      const raw = Ndef.util.bytesToString(record.payload ?? []);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { status: 'malformed_bill', message: 'The terminal sent a bill we could not read.', errors: ['invalid JSON'] };
      }
      const validation = validateTbefBill(parsed);
      if (!validation.ok) {
        return { status: 'malformed_bill', message: 'The terminal sent a bill we could not read.', errors: validation.errors };
      }
      return { status: 'success', bill: validation.bill, raw };
    } catch (err) {
      const msg = String((err as Error)?.message ?? err).toLowerCase();
      if (msg.includes('cancel') || msg.includes('user')) return { status: 'cancelled', message: 'Scan cancelled.' };
      return { status: 'no_tag_found', message: "We didn't catch the bill. Try tapping again." };
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        /* session already closed */
      }
    }
  }

  async cancel(): Promise<void> {
    const mod = loadNfc();
    try {
      await mod?.default.cancelTechnologyRequest();
    } catch {
      /* no active session */
    }
  }
}
