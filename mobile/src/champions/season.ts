import type { MyBolao, Standing } from '../api/play';

export interface Season {
  bolao: MyBolao;
  year: number;
  ranking: Standing[];
  champion?: Standing;
  runnerUp?: Standing;
  third?: Standing;
  players: number;
  margin: number;
  tiedForFirst: boolean;
}

export interface Winner {
  id: string;
  name: string;
  titles: number;
}

function endOf(bolao: MyBolao): string {
  return bolao.finished_at ?? bolao.started_at ?? '';
}

export function seasonYear(bolao: MyBolao): number {
  const fromName = bolao.name.match(/\b(?:19|20)\d{2}\b/);
  if (fromName) return Number(fromName[0]);
  return new Date(endOf(bolao)).getFullYear();
}

export function byRecencyDesc(a: MyBolao, b: MyBolao): number {
  return new Date(endOf(b)).getTime() - new Date(endOf(a)).getTime();
}

function isTie(a: Standing, b: Standing): boolean {
  return (
    a.total_points === b.total_points &&
    a.exact_scores === b.exact_scores &&
    a.correct_results === b.correct_results &&
    (a.rounds_won ?? 0) === (b.rounds_won ?? 0)
  );
}

export function buildSeason(bolao: MyBolao, ranking: Standing[]): Season {
  const [champion, runnerUp, third] = ranking;
  return {
    bolao,
    year: seasonYear(bolao),
    ranking,
    champion,
    runnerUp,
    third,
    players: ranking.length,
    margin: champion && runnerUp ? champion.total_points - runnerUp.total_points : 0,
    tiedForFirst: !!(champion && runnerUp && isTie(champion, runnerUp)),
  };
}

export function tallyTitles(seasons: Season[]): Winner[] {
  const byUser = new Map<string, Winner>();
  for (const season of seasons) {
    const champion = season.champion;
    if (!champion) continue;
    const current = byUser.get(champion.id);
    if (current) {
      current.titles += 1;
    } else {
      byUser.set(champion.id, { id: champion.id, name: champion.display_name, titles: 1 });
    }
  }
  return [...byUser.values()].sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));
}
