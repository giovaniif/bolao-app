import type { Bolao } from '../../boloes/api/boloesApi';

export function seasonYear(bolao: Bolao): number {
  const fromName = bolao.name.match(/\b(?:19|20)\d{2}\b/);
  if (fromName) return Number(fromName[0]);
  return new Date(bolao.finished_at ?? bolao.started_at).getFullYear();
}

export function byRecencyDesc(a: Bolao, b: Bolao): number {
  const at = new Date(a.finished_at ?? a.started_at).getTime();
  const bt = new Date(b.finished_at ?? b.started_at).getTime();
  return bt - at;
}
