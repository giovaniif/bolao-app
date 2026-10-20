const scoped = <T extends readonly unknown[]>(key: T, scope?: string) =>
  (scope ? [...key, scope] : key) as readonly unknown[];

export const queryKeys = {
  rounds: (bolaoId?: string, scope?: string) => scoped(['rounds', bolaoId ?? 'active'] as const, scope),
  matches: (round: number, scope?: string) => scoped(['matches', round] as const, scope),
  classification: (bolaoId?: string, round?: number, scope?: string) =>
    scoped(['classification', bolaoId ?? 'active', round ?? 'all'] as const, scope),
  users: (scope?: string) => scoped(['users'] as const, scope),
  teams: ['teams'] as const,
  predictions: (round: number, scope?: string) => scoped(['predictions', round] as const, scope),
  partials: (round: number, scope?: string) => scoped(['parciais', round] as const, scope),
  partialClassification: (round: number, scope?: string) =>
    scoped(['parciais', 'classification', round] as const, scope),
  predictionsByUser: (round: number, userId: string | null, scope?: string) =>
    scoped(['predictionsByUser', round, userId] as const, scope),
  myBoloes: ['me', 'boloes'] as const,
  boloes: ['boloes'] as const,
  activeBolao: ['boloes', 'active'] as const,
  bolaoParticipants: (bolaoId: string) => ['boloes', bolaoId, 'participants'] as const,
  pushStatus: ['push', 'status'] as const,
};
