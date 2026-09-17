import type { NfcTapStatus, TbefBill } from '@tapntally/shared';

export type NfcReadResult =
  | { status: 'success'; bill: TbefBill; raw: string }
  | { status: Exclude<`${NfcTapStatus}`, 'success' | 'sync_failed'>; message: string; errors?: string[] };

/**
 * One interface, two drivers:
 *  - RealNfcReader:  react-native-nfc-manager, reads an NDEF MIME record from
 *                    the terminal (physical tag or HCE-emulated Type 4 tag).
 *  - MockTerminal:   pulls a signed demo bill from the backend, so the whole
 *                    tap → flash → dashboard flow is demoable on any device,
 *                    in the simulator, or in Expo Go.
 */
export interface NfcReader {
  readonly kind: 'real' | 'mock';
  isAvailable(): Promise<boolean>;
  /** Resolves when a tag is read or the session ends. Never throws. */
  read(opts?: { onSessionStart?: () => void }): Promise<NfcReadResult>;
  cancel(): Promise<void>;
}
