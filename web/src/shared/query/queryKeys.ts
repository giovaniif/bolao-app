export const queryKeys = {
  rounds: (bolaoId?: string) => ['rounds', bolaoId ?? 'active'] as const,
  matches: (round: number) => ['matches', round] as const,
  classification: (bolaoId?: string, round?: number) =>
    ['classification', bolaoId ?? 'active', round ?? 'all'] as const,
  users: ['users'] as const,
  teams: ['teams'] as const,
  predictions: (round: number) => ['predictions', round] as const,
  boloes: ['boloes'] as const,
  activeBolao: ['boloes', 'active'] as const,
  bolaoParticipants: (bolaoId: string) => ['boloes', bolaoId, 'participants'] as const,
};
