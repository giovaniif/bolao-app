export type Score = { home: number; away: number };
export type SaveStatus = 'saving' | 'saved' | 'error';

type Options = {
  save: (matchId: string, score: Score) => Promise<void>;
  onStatus: (matchId: string, status: SaveStatus) => void;
  retryDelays?: number[];
};

const same = (a: Score | undefined, b: Score) => !!a && a.home === b.home && a.away === b.away;

export function createAutoSaver({ save, onStatus, retryDelays = [2000, 5000, 15000] }: Options) {
  const saved = new Map<string, Score>();
  const pending = new Map<string, Score>();
  const inFlight = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  async function run(matchId: string, attempt: number) {
    const score = pending.get(matchId);
    if (!score) return;
    pending.delete(matchId);
    inFlight.add(matchId);
    onStatus(matchId, 'saving');
    try {
      await save(matchId, score);
      saved.set(matchId, score);
      inFlight.delete(matchId);
      const next = pending.get(matchId);
      if (next && !same(score, next)) {
        void run(matchId, 0);
      } else {
        pending.delete(matchId);
        onStatus(matchId, 'saved');
      }
    } catch {
      inFlight.delete(matchId);
      if (!pending.has(matchId)) pending.set(matchId, score);
      onStatus(matchId, 'error');
      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      clearTimeout(timers.get(matchId));
      timers.set(matchId, setTimeout(() => void run(matchId, attempt + 1), delay));
    }
  }

  return {
    setBaseline(matchId: string, score: Score) {
      if (!pending.has(matchId) && !inFlight.has(matchId)) saved.set(matchId, score);
    },
    leave(matchId: string, score: Score, locked: boolean) {
      if (locked) return;
      if (!inFlight.has(matchId) && same(saved.get(matchId), score)) return;
      pending.set(matchId, score);
      if (inFlight.has(matchId)) return;
      clearTimeout(timers.get(matchId));
      void run(matchId, 0);
    },
    markSaved(matchId: string, score: Score) {
      saved.set(matchId, score);
      pending.delete(matchId);
      clearTimeout(timers.get(matchId));
    },
    dispose() {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    },
  };
}
