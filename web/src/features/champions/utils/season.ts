import type { Bolao } from '../../boloes/api/boloesApi';

/**
 * Season year, read from the name before the date.
 *
 * The admin wrote "Brasileirão 2025" and that is the year people think in. A bolão that
 * started in Mar 2025 and finished in Feb 2026 would show 2026 from the date alone.
 */
export function seasonYear(bolao: Bolao): number {
  const fromName = bolao.name.match(/\b(?:19|20)\d{2}\b/);
  if (fromName) return Number(fromName[0]);
  return new Date(bolao.finished_at ?? bolao.started_at).getFullYear();
}

/** Newest first. Finished bolões sort by finished_at, the rest by started_at. */
export function byRecencyDesc(a: Bolao, b: Bolao): number {
  const at = new Date(a.finished_at ?? a.started_at).getTime();
  const bt = new Date(b.finished_at ?? b.started_at).getTime();
  return bt - at;
}
