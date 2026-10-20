import type { Page, Route } from '@playwright/test';

export const NOW = new Date('2026-10-10T15:00:00-03:00');

const ACTIVE_ROUND = 5;
const activeBolao = { id: 'b-2026', name: 'Bolão 2026', status: 'active', started_at: '2026-04-01T00:00:00Z' };
const finishedBolao = {
  id: 'b-2025',
  name: 'Bolão 2025',
  status: 'finished',
  started_at: '2025-04-01T00:00:00Z',
  finished_at: '2025-12-08T00:00:00Z',
};

const people = [
  { id: 'u-ana', username: 'ana', display_name: 'Ana Souza', favorite_team: 'Flamengo', is_admin: true },
  { id: 'u-bruno', username: 'bruno', display_name: 'Bruno Lima', favorite_team: 'Palmeiras', is_admin: false },
  { id: 'u-carla', username: 'carla', display_name: 'Carla Dias', favorite_team: 'Corinthians', is_admin: false },
  { id: 'u-diego', username: 'diego', display_name: 'Diego Rocha', favorite_team: 'Grêmio', is_admin: false },
];

const teams = [
  'Flamengo', 'Palmeiras', 'Corinthians', 'Grêmio', 'Internacional', 'São Paulo',
  'Fluminense', 'Botafogo', 'Atlético-MG', 'Cruzeiro',
];

function matchesOf(round: number) {
  const played = round < ACTIVE_ROUND;
  const closes = new Date(NOW.getTime() + ((round - ACTIVE_ROUND) * 7 + 1) * 86_400_000).toISOString();
  return [0, 2, 4, 6, 8].map((i) => ({
    id: `m-${round}-${i}`,
    round,
    home_team: teams[(i + round) % teams.length],
    away_team: teams[(i + round + 1) % teams.length],
    market_closes_at: closes,
    ...(played ? { home_goals: (i + round) % 3, away_goals: i % 2 } : {}),
    ...(i > 0 ? { provider_match_id: round * 100 + i } : {}),
    locked: i === 4,
  }));
}

const allMatches = [1, 2, 3, 4, 5].flatMap(matchesOf);

function standings(scale = 1) {
  return people.map((p, i) => ({
    ...p,
    amount_paid: 50,
    total_points: Math.round((120 - i * 17) * scale),
    exact_scores: 6 - i,
    correct_results: 14 - i * 2,
    rounds_won: i < 2 ? 2 - i : 0,
  }));
}

function predictionsOf(round: number, userId: string) {
  return matchesOf(round).map((m, i) => ({
    id: `p-${userId}-${m.id}`,
    user_id: userId,
    match_id: m.id,
    home_goals: (i + userId.length) % 3,
    away_goals: i % 2,
  }));
}

type Handler = (url: URL, match: RegExpMatchArray) => unknown;

const myBoloes = [
  { ...activeBolao, role: 'admin', member_status: 'active', member_count: people.length },
  { id: 'b-firma', name: 'Bolão da Firma', status: 'active', started_at: '2026-09-01T00:00:00Z', role: 'owner', member_status: 'active', member_count: 7 },
  { id: 'b-familia', name: 'Família', status: 'active', started_at: '2026-09-10T00:00:00Z', role: 'participant', member_status: 'pending', member_count: 9 },
];

const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/me\/boloes$/, () => myBoloes],
  ['GET', /^\/competitions$/, () => [{ id: 'c-bsa', name: 'Brasileirão Série A 2026', provider_code: 'BSA', season: 2026, status: 'active' }]],
  ['GET', /^\/rules$/, () => ({
    match: [
      { key: 'correct_result', points: 9, text: 'Acertar o vencedor, ou o empate com o placar exato' },
      { key: 'correct_draw', points: 12, text: 'Acertar que vai dar empate, sem acertar o placar' },
      { key: 'correct_home_goals', points: 3, text: 'Acertar os gols do mandante' },
      { key: 'correct_away_goals', points: 3, text: 'Acertar os gols do visitante' },
      { key: 'exact_score', points: 3, text: 'Placar exato em jogo com até 3 gols' },
      { key: 'exact_score_high', points: 10, text: 'Placar exato em jogo com 4 gols ou mais (no lugar dos 3)' },
      { key: 'total_goals_high', points: 3, text: 'Acertar o total de gols em jogo com 4 gols ou mais' },
    ],
    round: [{ key: 'round_total_goals', points: 10, text: 'Acertar o total de gols da rodada inteira' }],
    exact_score_variety_bonus: [
      { score_types: 1, points: 0, text: '1 placares exatos diferentes na rodada' },
      { score_types: 2, points: 10, text: '2 placares exatos diferentes na rodada' },
      { score_types: 3, points: 20, text: '3 placares exatos diferentes na rodada' },
      { score_types: 4, points: 30, text: '4 ou mais placares exatos diferentes na rodada' },
    ],
    notes: [
      'Os palpites de cada jogo fecham no horário de fechamento do mercado, que é o início do jogo nos bolões automáticos.',
      'Quem não palpitar um jogo fica com 0 x 0 nele quando o jogo começa.',
      'O bônus de gols da rodada só vale com a rodada completa.',
    ],
  })],
  ['GET', /^\/members$/, () => [
    ...people.map((p, i) => ({ ...p, role: i === 0 ? 'owner' : i === 1 ? 'admin' : 'participant', status: 'active', amount_paid: 50 })),
    { id: 'u-eva', username: 'eva', display_name: 'Eva Martins', role: 'participant', status: 'pending', amount_paid: 0 },
  ]],
  ['GET', /^\/boloes\/[^/]+\/invite$/, () => ({ code: 'FIRMA234' })],
  ['GET', /^\/invites\/[^/]+$/, () => ({ name: 'Bolão da Firma', member_count: 7, max_members: 50, joins: 'request' })],
  ['GET', /^\/boloes\/active$/, () => activeBolao],
  ['GET', /^\/boloes$/, () => [activeBolao, finishedBolao]],
  ['GET', /^\/boloes\/[^/]+\/participants$/, () => people.map((p) => ({ ...p, amount_paid: 50, joined_at: '2026-04-01T00:00:00Z' }))],
  ['GET', /^\/matches\/rounds\/summary$/, () => ({ rounds: [1, 2, 3, 4, 5], active: ACTIVE_ROUND, pending_results: 0 })],
  ['GET', /^\/matches\/round\/(\d+)$/, (_, m) => matchesOf(Number(m[1]))],
  ['GET', /^\/matches$/, () => allMatches],
  ['GET', /^\/classification$/, (url) => standings(url.searchParams.get('bolao_id') === finishedBolao.id ? 1.4 : 1)],
  ['GET', /^\/parciais\/round\/(\d+)\/classification$/, () => standings(0.1)],
  ['GET', /^\/parciais\/round\/(\d+)$/, (_, m) =>
    matchesOf(Number(m[1])).map((x, i) => ({ id: x.id, home_team: x.home_team, away_team: x.away_team, partial_home: i % 3, partial_away: 1 })),
  ],
  ['GET', /^\/predictions$/, (url) => predictionsOf(Number(url.searchParams.get('round') ?? ACTIVE_ROUND), people[0].id)],
  ['GET', /^\/predictions\/round\/(\d+)\/user\/([^/]+)$/, (_, m) => predictionsOf(Number(m[1]), m[2])],
  ['GET', /^\/me$/, () => ({ ...people[0] })],
  ['GET', /^\/users$/, () => people],
  ['GET', /^\/teams$/, () => teams],
  ['GET', /^\/push\/public-key$/, () => ({ public_key: 'BElr3ePDdGdF0V8Ox1qZ7ZfPq0l5G9Wn3d2vYkq0xX0' })],
];

export async function mockApi(page: Page): Promise<string[]> {
  const unmocked: string[] = [];
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '').replace(/^\/boloes\/[^/]+(?=\/(matches|classification|parciais|predictions|export|members)(\/|$))/, '');
    for (const [method, pattern, handler] of routes) {
      const match = path.match(pattern);
      if (request.method() === method && match) {
        await route.fulfill({ json: handler(url, match) });
        return;
      }
    }
    unmocked.push(`${request.method()} ${path}`);
    await route.fulfill({ status: 404, json: { error: 'not mocked' } });
  });
  return unmocked;
}

export async function signIn(page: Page, admin = true): Promise<void> {
  const user = { id: people[0].id, username: people[0].username, is_admin: admin, must_change_password: false };
  await page.addInitScript((u) => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
}
