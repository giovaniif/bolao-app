export function returnTo(voltar: string | undefined, fallback: string): string {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : fallback;
}
