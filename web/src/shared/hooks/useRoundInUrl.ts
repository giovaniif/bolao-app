import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const RODADA_KEY = 'rodada';

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

  const writeRound = useCallback(
    (r: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(RODADA_KEY, String(r));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (rounds.length === 0) return;
    if (!validFromUrl) {
      writeRound(round);
    }
  }, [rounds.length, validFromUrl, round, writeRound]);

  return [round, writeRound];
}
