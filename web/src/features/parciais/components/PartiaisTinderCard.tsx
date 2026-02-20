import { useRef, useState } from 'react';
import type { MatchWithPartial } from '../api/parciaisApi';

interface PartiaisTinderCardProps {
  match: MatchWithPartial;
  homeGoals: number | null;
  awayGoals: number | null;
  onGoalsChange: (home: number | null, away: number | null) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  currentIndex: number;
  total: number;
}

export function PartiaisTinderCard({
  match,
  homeGoals,
  awayGoals,
  onGoalsChange,
  onSwipeLeft,
  onSwipeRight,
  hasNext,
  hasPrev,
  currentIndex,
  total,
}: PartiaisTinderCardProps) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const dragXRef = useRef(0);
  const SWIPE_THRESHOLD = 60;
  dragXRef.current = dragX;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const diff = e.touches[0].clientX - startX.current;
    setDragX(diff);
  }

  function handleTouchEnd() {
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      if (dragX > 0 && hasPrev) {
        onSwipeRight();
      } else if (dragX < 0 && hasNext) {
        onSwipeLeft();
      }
    }
    setDragX(0);
  }

  function handleMouseDown(e: React.MouseEvent) {
    startX.current = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const d = ev.clientX - startX.current;
      dragXRef.current = d;
      setDragX(d);
    };
    const onUp = () => {
      const dx = dragXRef.current;
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        if (dx > 0 && hasPrev) onSwipeRight();
        else if (dx < 0 && hasNext) onSwipeLeft();
      }
      setDragX(0);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function adjust(team: 'home' | 'away', delta: number) {
    const curH = homeGoals ?? 0;
    const curA = awayGoals ?? 0;
    if (team === 'home') {
      const v = Math.max(0, Math.min(99, curH + delta));
      onGoalsChange(v, awayGoals);
    } else {
      const v = Math.max(0, Math.min(99, curA + delta));
      onGoalsChange(homeGoals, v);
    }
  }

  const displayHome = homeGoals ?? '–';
  const displayAway = awayGoals ?? '–';
  const homeIsZero = homeGoals === 0;
  const awayIsZero = awayGoals === 0;

  const opacity = Math.max(0.3, 1 - Math.abs(dragX) / 200);

  return (
    <div className="select-none">
      <div
        className="touch-pan-y touch-pan-x"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div
          className="rounded-2xl bg-[var(--color-card)] border-2 border-slate-600 p-6 shadow-xl transition-transform duration-150"
          style={{
            transform: `translateX(${dragX}px)`,
            opacity,
          }}
        >
          <div className="text-center mb-6">
            <p className="text-sm text-[var(--color-text-muted)]">
              Jogo {currentIndex + 1} de {total}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Arraste para o próximo ou anterior
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-sm text-[var(--color-text-muted)] mb-2">
                Mandante
              </p>
              <p className="text-lg font-semibold truncate">{match.home_team}</p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={() => adjust('home', -1)}
                  disabled={homeIsZero}
                  className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-bold flex items-center justify-center"
                  aria-label="Diminuir gols mandante"
                >
                  −
                </button>
                <span className="w-14 text-3xl font-bold text-center">
                  {displayHome}
                </span>
                <button
                  type="button"
                  onClick={() => adjust('home', 1)}
                  className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-2xl font-bold flex items-center justify-center"
                  aria-label="Aumentar gols mandante"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-center text-[var(--color-text-muted)] text-xl">
              ×
            </div>

            <div>
              <p className="text-sm text-[var(--color-text-muted)] mb-2">
                Visitante
              </p>
              <p className="text-lg font-semibold truncate">{match.away_team}</p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={() => adjust('away', -1)}
                  disabled={awayIsZero}
                  className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-bold flex items-center justify-center"
                  aria-label="Diminuir gols visitante"
                >
                  −
                </button>
                <span className="w-14 text-3xl font-bold text-center">
                  {displayAway}
                </span>
                <button
                  type="button"
                  onClick={() => adjust('away', 1)}
                  className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-2xl font-bold flex items-center justify-center"
                  aria-label="Aumentar gols visitante"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {match.real_home_goals !== undefined && match.real_away_goals !== undefined && (
            <p className="text-xs text-[var(--color-text-muted)] text-center mt-4">
              Resultado final: {match.real_home_goals} × {match.real_away_goals}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 px-2">
        <button
          type="button"
          onClick={onSwipeRight}
          disabled={!hasPrev}
          className="py-2 px-4 rounded-lg bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          ← Anterior
        </button>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === currentIndex
                  ? 'bg-[var(--color-primary)] scale-125'
                  : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSwipeLeft}
          disabled={!hasNext}
          className="py-2 px-4 rounded-lg bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
