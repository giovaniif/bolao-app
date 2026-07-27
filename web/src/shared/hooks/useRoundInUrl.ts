import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const RODADA_KEY = 'rodada';

/**
 * Sincroniza a rodada selecionada com a URL (?rodada=N).
 * Mantém a rodada entre abas (Palpites, Galera, Parciais) e ao recarregar.
 *
 * Pass activeRound (see useActiveRound) to default to the round in play rather than the
 * last one that exists. It comes from the same request as `rounds`, so by the time there
 * are rounds to show it has already arrived; the highest round is only a safety net.
 */
export function useRoundInUrl(
  rounds: number[],
  activeRound?: number
): [number, (round: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const rodadaParam = searchParams.get(RODADA_KEY);
  const rodadaNum = rodadaParam ? parseInt(rodadaParam, 10) : NaN;
  const validFromUrl =
    Number.isFinite(rodadaNum) && rounds.length > 0 && rounds.includes(rodadaNum);

  let defaultRound = 0;
  if (activeRound !== undefined && rounds.includes(activeRound)) {
    defaultRound = activeRound;
  } else if (rounds.length > 0) {
    defaultRound = Math.max(...rounds);
  }
  const round = validFromUrl ? rodadaNum : defaultRound;

  // Ao carregar rounds, corrige URL se rodada estiver ausente ou inválida
  useEffect(() => {
    if (rounds.length === 0) return;
    if (!validFromUrl) {
      setSearchParams({ [RODADA_KEY]: String(round) }, { replace: true });
    }
  }, [rounds.length, validFromUrl, round, setSearchParams]);

  const setRound = useCallback(
    (r: number) => {
      setSearchParams({ [RODADA_KEY]: String(r) }, { replace: true });
    },
    [setSearchParams]
  );

  return [round, setRound];
}
