import type { Season } from '../hooks/useSeasons';

export interface Winner {
  id: string;
  name: string;
  titles: number;
}

/** Counts titles per champion, aggregated client-side; there is no endpoint for it. */
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
  return [...byUser.values()].sort(
    (a, b) => b.titles - a.titles || a.name.localeCompare(b.name)
  );
}
