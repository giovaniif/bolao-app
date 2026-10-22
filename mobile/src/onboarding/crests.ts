const CREST_IDS: Record<string, number> = {
  Fluminense: 1765,
  'Atlético-MG': 1766,
  Grêmio: 1767,
  'Athletico-PR': 1768,
  Palmeiras: 1769,
  Botafogo: 1770,
  Cruzeiro: 1771,
  Chapecoense: 1772,
  'São Paulo': 1776,
  Bahia: 1777,
  Corinthians: 1779,
  Vasco: 1780,
  Vitória: 1782,
  Flamengo: 1783,
  Coritiba: 4241,
  Bragantino: 4286,
  Remo: 4287,
  Mirassol: 4364,
  Internacional: 6684,
  Santos: 6685,
};

const SHORT_NAMES: Record<string, string> = {
  'Athletico-PR': 'Athletico',
  'Atlético-MG': 'Atlético',
  Internacional: 'Inter',
  Chapecoense: 'Chape',
};

export function crestUrl(team: string): string | null {
  const id = CREST_IDS[team];
  return id ? `https://crests.football-data.org/${id}.png` : null;
}

export function shortTeamName(team: string): string {
  return SHORT_NAMES[team] ?? team;
}

export function teamInitials(team: string): string {
  return team
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
