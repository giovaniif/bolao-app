export interface TeamBadgeStyle {
  initials: string;
  fill: string;
  ring: string;
  text: string;
}

const COLORS: Record<string, [string, string]> = {
  Fluminense: ['#7a1f3d', '#0b6b3a'],
  'Atlético-MG': ['#111111', '#f5f5f5'],
  Grêmio: ['#1c6fb5', '#111111'],
  'Athletico-PR': ['#c8102e', '#111111'],
  Palmeiras: ['#0b6b3a', '#f5f5f5'],
  Botafogo: ['#111111', '#f5f5f5'],
  Cruzeiro: ['#1d3f9a', '#f5f5f5'],
  Chapecoense: ['#0b8a3e', '#f5f5f5'],
  'São Paulo': ['#f5f5f5', '#c8102e'],
  Bahia: ['#1d4fa3', '#c8102e'],
  Corinthians: ['#f5f5f5', '#111111'],
  Vasco: ['#111111', '#f5f5f5'],
  Vitória: ['#c8102e', '#111111'],
  Flamengo: ['#c8102e', '#111111'],
  Coritiba: ['#0b6b3a', '#f5f5f5'],
  Bragantino: ['#f5f5f5', '#c8102e'],
  Remo: ['#1b2f6b', '#f5f5f5'],
  Mirassol: ['#f2c500', '#0b6b3a'],
  Internacional: ['#c8102e', '#f5f5f5'],
  Santos: ['#f5f5f5', '#111111'],
};

const PALETTE = ['#c8102e', '#1d4fa3', '#0b6b3a', '#7a1f3d', '#f2c500', '#e8590c', '#5f3dc4', '#111111'];

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

function hash(text: string): number {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  }
  return h;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
}

export function teamBadge(team: string): TeamBadgeStyle {
  const known = COLORS[team];
  const h = hash(team);
  const fill = known ? known[0] : PALETTE[h % PALETTE.length];
  const ring = known ? known[1] : PALETTE[(h >> 3) % PALETTE.length] === fill ? '#f5f5f5' : PALETTE[(h >> 3) % PALETTE.length];
  return { initials: teamInitials(team), fill, ring, text: isLight(fill) ? '#111111' : '#ffffff' };
}
