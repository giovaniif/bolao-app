import { useMemo, useState } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { formatDateTime } from '../../../shared/utils/date';
import { useBoloes } from '../../boloes/hooks/useBoloes';
import { useClassification } from '../../classification/hooks/useClassification';
import { ClassificationRow } from '../../classification/components/ClassificationRow';
import type { UserWithStats } from '../../classification/api/classificationApi';
import { Podium } from '../components/Podium';

function isTie(a: UserWithStats, b: UserWithStats): boolean {
  return (
    a.total_points === b.total_points &&
    a.exact_scores === b.exact_scores &&
    a.correct_results === b.correct_results &&
    a.rounds_won === b.rounds_won
  );
}

export function ChampionsPage() {
  const { data: boloes = [], isLoading: loadingBoloes } = useBoloes();

  const finished = useMemo(() => boloes.filter((b) => b.status === 'finished'), [boloes]);

  const [selectedId, setSelectedId] = useState('');
  const bolaoId = selectedId || finished[0]?.id;
  const bolao = finished.find((b) => b.id === bolaoId);

  const {
    data: ranking = [],
    isLoading: loadingRanking,
    error,
  } = useClassification(undefined, bolaoId, !!bolaoId);

  const hasResults = ranking.length > 0 && ranking[0].total_points > 0;
  const tiedForFirst = ranking.length > 1 && isTie(ranking[0], ranking[1]);

  if (loadingBoloes) {
    return (
      <Layout title="Hall dos Campeões">
        <p className="text-center py-8 text-[var(--color-text-muted)]">Carregando...</p>
      </Layout>
    );
  }

  if (finished.length === 0) {
    return (
      <Layout title="Hall dos Campeões">
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl" aria-hidden="true">
            🏆
          </p>
          <p className="text-[var(--color-text-muted)]">Nenhum bolão encerrado ainda.</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Os campeões aparecem aqui quando um bolão é finalizado.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Hall dos Campeões">
      <div className="space-y-4">
        {finished.length > 1 && (
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Bolão</label>
            <select
              value={bolaoId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
            >
              {finished.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {bolao && (
          <div>
            <p className="font-medium">{bolao.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {formatDateTime(bolao.started_at)}
              {bolao.finished_at ? ` – ${formatDateTime(bolao.finished_at)}` : ''}
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center py-4">
            {error instanceof Error ? error.message : 'Erro ao carregar'}
          </p>
        )}

        {loadingRanking ? (
          <p className="text-center py-8 text-[var(--color-text-muted)]">Carregando...</p>
        ) : !hasResults ? (
          !error && (
            <p className="text-center py-8 text-[var(--color-text-muted)]">
              Sem resultados registrados neste bolão.
            </p>
          )
        ) : (
          <>
            <Podium top={ranking.slice(0, 3)} tiedForFirst={tiedForFirst} />

            <div className="space-y-2">
              <h2 className="text-sm text-[var(--color-text-muted)]">Classificação completa</h2>
              {ranking.map((u, i) => (
                <ClassificationRow key={u.id} rank={i + 1} user={u} isChamp={i === 0} medals />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
