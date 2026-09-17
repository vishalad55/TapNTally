import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { MockTerminal, type MockScenario } from './mock-terminal';
import { RealNfcReader } from './real-reader';
import type { NfcReader, NfcReadResult } from './types';

export type { NfcReadResult } from './types';
export type { MockScenario } from './mock-terminal';

const PREF_KEY = 'tapntally.nfc.mode';

interface NfcPrefs {
  /** 'auto' = real hardware when present, mock otherwise. */
  mode: 'auto' | 'real' | 'mock';
  scenario: MockScenario;
  hydrated: boolean;
  setMode: (m: NfcPrefs['mode']) => void;
  setScenario: (s: MockScenario) => void;
  hydrate: () => Promise<void>;
}

export const useNfcPrefs = create<NfcPrefs>((set, get) => ({
  mode: 'auto',
  scenario: 'signed',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    void AsyncStorage.setItem(PREF_KEY, JSON.stringify({ mode, scenario: get().scenario }));
  },
  setScenario: (scenario) => {
    set({ scenario });
    void AsyncStorage.setItem(PREF_KEY, JSON.stringify({ mode: get().mode, scenario }));
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<NfcPrefs>;
        set({ mode: p.mode ?? 'auto', scenario: p.scenario ?? 'signed' });
      }
    } finally {
      set({ hydrated: true });
    }
  },
}));

const real = new RealNfcReader();
const mock = new MockTerminal();

async function pickReader(mode: NfcPrefs['mode']): Promise<NfcReader> {
  if (mode === 'mock') return mock;
  if (mode === 'real') return real;
  return (await real.isAvailable()) ? real : mock;
}

export type TapPhase = 'idle' | 'scanning' | 'reading';

/**
 * Drives one tap session. Screens call `tap()` and render on `phase`;
 * the result is handed back for the caller to post to the API.
 */
export function useNfcTap() {
  const prefs = useNfcPrefs();
  const [phase, setPhase] = useState<TapPhase>('idle');
  const [readerKind, setReaderKind] = useState<'real' | 'mock' | null>(null);
  const active = useRef<NfcReader | null>(null);

  useEffect(() => {
    if (!prefs.hydrated) void prefs.hydrate();
  }, [prefs]);

  useEffect(() => {
    let alive = true;
    void pickReader(prefs.mode).then((r) => alive && setReaderKind(r.kind));
    return () => {
      alive = false;
    };
  }, [prefs.mode]);

  const tap = useCallback(async (): Promise<NfcReadResult> => {
    const reader = await pickReader(prefs.mode);
    if (reader.kind === 'mock') mock.scenario = prefs.scenario;
    active.current = reader;
    setReaderKind(reader.kind);
    setPhase('scanning');
    try {
      return await reader.read({ onSessionStart: () => setPhase('reading') });
    } finally {
      setPhase('idle');
      active.current = null;
    }
  }, [prefs.mode, prefs.scenario]);

  const cancel = useCallback(async () => {
    await active.current?.cancel();
  }, []);

  return { tap, cancel, phase, readerKind };
}
