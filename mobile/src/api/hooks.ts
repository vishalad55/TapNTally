import type {
  Budget,
  BudgetProgress,
  Category,
  Connection,
  CreateManualTransactionRequest,
  Household,
  Paginated,
  Recap,
  SmsIngestRequest,
  SmsIngestResponse,
  SpendSummary,
  TbefBill,
  Transaction,
  TransactionQuery,
  UpdateTransactionRequest,
  UpsertBudgetRequest,
  User,
} from '@tapntally/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

/** Query keys in one place so invalidation stays correct as screens grow. */
export const qk = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  transactions: (q: TransactionQuery) => ['transactions', q] as const,
  transaction: (id: string) => ['transaction', id] as const,
  summary: (period: 'month' | 'week', offset: number, scope: 'personal' | 'shared') => ['summary', period, offset, scope] as const,
  budgets: ['budgets'] as const,
  recap: (period: 'weekly' | 'monthly', scope: 'personal' | 'shared') => ['recap', period, scope] as const,
  connections: ['connections'] as const,
  household: ['household'] as const,
};

// ------------------------------------------------------------------ reads

export const useCategories = () =>
  useQuery({ queryKey: qk.categories, queryFn: () => api<Category[]>('/categories'), staleTime: 5 * 60_000 });

export const useTransactions = (query: TransactionQuery) =>
  useInfiniteQuery({
    queryKey: qk.transactions(query),
    queryFn: ({ pageParam }) =>
      api<Paginated<Transaction>>('/transactions', {
        query: { ...query, cursor: pageParam ?? undefined, limit: query.limit ?? 30 },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const useTransaction = (id: string) =>
  useQuery({ queryKey: qk.transaction(id), queryFn: () => api<Transaction>(`/transactions/${id}`) });

export const useSummary = (period: 'month' | 'week' = 'month', offset = 0, scope: 'personal' | 'shared' = 'personal') =>
  useQuery({
    queryKey: qk.summary(period, offset, scope),
    queryFn: () => api<SpendSummary>('/transactions/summary', { query: { period, offset, scope } }),
  });

export const useBudgets = () => useQuery({ queryKey: qk.budgets, queryFn: () => api<BudgetProgress[]>('/budgets') });

export const useRecap = (period: 'weekly' | 'monthly', scope: 'personal' | 'shared' = 'personal') =>
  useQuery({ queryKey: qk.recap(period, scope), queryFn: () => api<Recap>('/insights/recap', { query: { period, scope } }) });

export const useConnections = () =>
  useQuery({ queryKey: qk.connections, queryFn: () => api<Connection[]>('/connections'), refetchInterval: (q) =>
    q.state.data?.some((c) => c.status === 'backfilling') ? 5_000 : false,
  });

export const useHousehold = () => useQuery({ queryKey: qk.household, queryFn: () => api<Household | null>('/households/me') });

// ----------------------------------------------------------------- writes

/** Anything that changes spend must refresh feed, charts, budgets and recap together. */
function useInvalidateSpend() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['transaction'] }),
      qc.invalidateQueries({ queryKey: ['summary'] }),
      qc.invalidateQueries({ queryKey: qk.budgets }),
      qc.invalidateQueries({ queryKey: ['recap'] }),
    ]);
}

export const useCreateTransaction = () => {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (body: CreateManualTransactionRequest) => api<Transaction>('/transactions', { method: 'POST', body }),
    onSuccess: invalidate,
  });
};

export const useUpdateTransaction = (id: string) => {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (body: UpdateTransactionRequest) => api<Transaction>(`/transactions/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
};

export const useDeleteTransaction = () => {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
};

export interface NfcIngestResult {
  transaction: Transaction;
  created: boolean;
  signatureVerified: boolean;
}

export const useIngestNfcBill = () => {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (body: { bill: TbefBill; idempotencyKey: string }) => api<NfcIngestResult>('/nfc/bills', { method: 'POST', body }),
    onSuccess: invalidate,
  });
};

export const useUpsertBudget = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertBudgetRequest) => api<BudgetProgress>('/budgets', { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.budgets }),
  });
};

export const useDeleteBudget = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.budgets }),
  });
};

/** Six-character code a partner terminal uses to route a bill to this account (server-to-server path). */
export const usePairingCode = () => useMutation({ mutationFn: () => api<{ code: string; expiresAt: string }>('/pos/pairing-code', { method: 'POST' }) });

export const useUpdateMe = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; aggregateInsightsConsent?: boolean; onboardingCompleted?: boolean }) => api<User>('/users/me', { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
};

export const useConnectionMutations = () => {
  const qc = useQueryClient();
  const invalidateSpend = useInvalidateSpend();
  const refresh = () => qc.invalidateQueries({ queryKey: qk.connections });
  return {
    connectGmail: useMutation({
      mutationFn: (authCode: string) => api<Connection>('/connections/gmail', { method: 'POST', body: { authCode } }),
      onSuccess: refresh,
    }),
    syncGmail: useMutation({ mutationFn: () => api<Connection>('/connections/gmail/sync', { method: 'POST' }), onSuccess: refresh }),
    disconnectGmail: useMutation({ mutationFn: () => api<void>('/connections/gmail', { method: 'DELETE' }), onSuccess: refresh }),
    enableSms: useMutation({ mutationFn: () => api<Connection>('/connections/sms', { method: 'POST' }), onSuccess: refresh }),
    disableSms: useMutation({ mutationFn: () => api<void>('/connections/sms', { method: 'DELETE' }), onSuccess: refresh }),
    ingestSms: useMutation({
      mutationFn: (body: SmsIngestRequest) => api<SmsIngestResponse>('/connections/sms/ingest', { method: 'POST', body }),
      onSuccess: async () => {
        await refresh();
        await invalidateSpend();
      },
    }),
  };
};

export const useHouseholdMutations = () => {
  const qc = useQueryClient();
  const invalidateSpend = useInvalidateSpend();
  const done = async () => {
    await qc.invalidateQueries({ queryKey: qk.household });
    await qc.invalidateQueries({ queryKey: qk.me });
    await qc.invalidateQueries({ queryKey: qk.budgets });
    await invalidateSpend();
  };
  return {
    create: useMutation({ mutationFn: (name: string) => api<Household>('/households', { method: 'POST', body: { name } }), onSuccess: done }),
    join: useMutation({ mutationFn: (inviteCode: string) => api<Household>('/households/join', { method: 'POST', body: { inviteCode } }), onSuccess: done }),
    leave: useMutation({ mutationFn: () => api<void>('/households/leave', { method: 'POST' }), onSuccess: done }),
    rotateInvite: useMutation({ mutationFn: () => api<Household>('/households/invite/rotate', { method: 'POST' }), onSuccess: done }),
  };
};

export type { Budget };
