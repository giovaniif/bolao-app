export const queryKeys = {
  rounds: ['rounds'] as const,
  matches: (round: number) => ['matches', round] as const,
  classification: (round?: number) => ['classification', round ?? 'all'] as const,
  users: ['users'] as const,
  teams: ['teams'] as const,
  predictions: (round: number) => ['predictions', round] as const,
};
