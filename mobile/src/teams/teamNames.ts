const SHORT_NAMES: Record<string, string> = {
  'Athletico-PR': 'Athletico',
  'Atlético-MG': 'Atlético',
  Internacional: 'Inter',
  Chapecoense: 'Chape',
};

export function shortTeamName(team: string): string {
  return SHORT_NAMES[team] ?? team;
}
