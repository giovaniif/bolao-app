import type { RuleBook } from '../api/createBolaoApi';

export function RulesSummary({ rules }: { rules: RuleBook }) {
  const rows = [...rules.match, ...rules.round];
  return (
    <div className="space-y-4">
      <ul className="rounded-xl bg-card divide-y divide-slate-700/60">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm">{r.text}</span>
            <span className="shrink-0 min-w-10 text-center rounded-full bg-primary/15 text-primary font-bold text-sm px-2 py-0.5">
              {r.points}
            </span>
          </li>
        ))}
      </ul>
      {rules.exact_score_variety_bonus.length > 0 && (
        <div className="rounded-xl bg-card px-4 py-3">
          <p className="text-sm font-semibold mb-2">Bônus por placares exatos diferentes na rodada</p>
          <ul className="space-y-1">
            {rules.exact_score_variety_bonus
              .filter((t) => t.points > 0)
              .map((t) => (
                <li key={t.score_types} className="flex justify-between text-sm text-text-muted">
                  <span>{t.text}</span>
                  <span className="text-accent font-semibold">+{t.points}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
      <ul className="space-y-1 text-xs text-text-muted list-disc pl-5">
        {rules.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
