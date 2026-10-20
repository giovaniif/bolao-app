import { useState } from 'react';
import type { MyBolao } from '../api/myBoloesApi';

export function BolaoSwitcher({
  boloes,
  current,
  onSelect,
}: {
  boloes: MyBolao[];
  current?: MyBolao;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const playable = boloes.filter((b) => b.member_status === 'active');
  if (playable.length < 2 || !current) {
    return null;
  }

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 min-w-0 max-w-[60vw] px-3 py-1.5 rounded-full bg-card text-sm font-semibold"
      >
        <span className="truncate">{current.name}</span>
        <span aria-hidden className="text-text-muted">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-64 max-w-[85vw] rounded-xl bg-card border border-slate-700 shadow-xl py-1 z-20">
          {playable.map((b) => (
            <button
              key={b.id}
              role="menuitem"
              aria-current={b.id === current.id}
              onClick={() => {
                setOpen(false);
                onSelect(b.id);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3 ${
                b.id === current.id ? 'text-primary font-semibold' : ''
              }`}
            >
              <span className="truncate">{b.name}</span>
              <span className="text-xs text-text-muted shrink-0">{b.member_count} pessoas</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
