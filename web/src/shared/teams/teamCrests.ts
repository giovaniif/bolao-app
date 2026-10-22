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

export function crestUrl(team: string): string | undefined {
  const id = CREST_IDS[team];
  return id ? `https://crests.football-data.org/${id}.png` : undefined;
}

export function teamInitials(team: string): string {
  const words = team.split(/[\s-]+/).filter((w) => /^[\p{Lu}\p{N}]/u.test(w));
  if (words.length > 1) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join('');
  }
  return team.slice(0, 3).toUpperCase();
}
