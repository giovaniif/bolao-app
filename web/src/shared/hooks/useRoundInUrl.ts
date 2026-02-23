import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const RODADA_KEY = 'rodada';

/**
 * Sincroniza a rodada selecionada com a URL (?rodada=N).
 * Mantém a rodada entre abas (Palpites, Galera, Parciais) e ao recarregar.
 */
export function useRoundInUrl(rounds: number[]): [number, (round: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const rodadaParam = searchParams.get(RODADA_KEY);
  const rodadaNum = rodadaParam ? parseInt(rodadaParam, 10) : NaN;
  const validFromUrl =
    Number.isFinite(rodadaNum) && rounds.length > 0 && rounds.includes(rodadaNum);
  const defaultRound = rounds.length > 0 ? rounds[0] : 0;
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
