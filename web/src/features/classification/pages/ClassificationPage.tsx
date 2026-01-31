import { useState } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { useClassification } from '../hooks/useClassification';
import { useRounds } from '../../matches/hooks/useMatches';
import { downloadExportRound, downloadExportAll } from '../api/exportApi';
import type { UserWithStats } from '../api/classificationApi';

export function ClassificationPage() {
  const [selectedRound, setSelectedRound] = useState<number | ''>('');
  const [exporting, setExporting] = useState<'round' | 'all' | null>(null);

  const { data: rounds = [] } = useRounds();
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
  const displayRound = selectedRound === '' ? maxRound : selectedRound;
  const roundForQuery = selectedRound === '' ? undefined : selectedRound;

  const { data: classification = [], isLoading, error } = useClassification(roundForQuery);

  return (
    <Layout title="Classificação">
      <div className="space-y-4">
        {rounds.length > 0 && (
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Rodada
            </label>
            <select
              value={selectedRound}
              onChange={(e) =>
                setSelectedRound(e.target.value ? Number(e.target.value) : '')
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
            >
              <option value="">Todas (até a última)</option>
              {rounds.map((r) => (
                <option key={r} value={r}>
                  Rodada {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={async () => {
              setExporting('round');
              try {
                await downloadExportRound(Number(displayRound) || 1);
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Erro ao exportar');
              } finally {
                setExporting(null);
              }
            }}
            disabled={exporting !== null || rounds.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-slate-600 text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
          >
            {exporting === 'round' ? 'Exportando...' : 'Exportar rodada'}
          </button>
          <button
            onClick={async () => {
              setExporting('all');
              try {
                await downloadExportAll();
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Erro ao exportar');
              } finally {
                setExporting(null);
              }
            }}
            disabled={exporting !== null || rounds.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-slate-600 text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
          >
            {exporting === 'all' ? 'Exportando...' : 'Exportar todas'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center py-4">
            {error instanceof Error ? error.message : 'Erro ao carregar'}
          </p>
        )}

        {isLoading ? (
          <p className="text-center py-8 text-[var(--color-text-muted)]">
            Carregando...
          </p>
        ) : (
          <div className="space-y-2">
            {classification.map((u, i) => (
              <ClassificationRow
                key={u.id}
                rank={i + 1}
                user={u}
                isChamp={i === 0 && displayRound > 0}
              />
            ))}
            {classification.length === 0 && !error && (
              <p className="text-center py-8 text-[var(--color-text-muted)]">
                Nenhum resultado ainda
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ClassificationRow({
  rank,
  user,
  isChamp,
}: {
  rank: number;
  user: UserWithStats;
  isChamp: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg ${
        isChamp ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]' : 'bg-[var(--color-card)]'
      }`}
    >
      <span
        className={`w-8 text-center font-bold ${
          rank <= 3 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
        }`}
      >
        {rank}º
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.display_name}</p>
        {user.favorite_team && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {user.favorite_team}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="font-bold text-[var(--color-primary)]">{user.total_points}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {user.exact_scores} placares · {user.correct_results} resultados
        </p>
      </div>
    </div>
  );
}
