import { create } from 'zustand';

/**
 * Lets any screen ask the always-mounted TapFlow (in the tabs layout) to
 * start a scan — e.g. the Home quick-action tile — without prop drilling.
 */
interface TapRequestState {
  requestId: number;
  requestTap: () => void;
}

export const useTapRequest = create<TapRequestState>((set) => ({
  requestId: 0,
  requestTap: () => set((s) => ({ requestId: s.requestId + 1 })),
}));
